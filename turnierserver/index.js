const server = require("http").createServer();
const io = require("socket.io")(server);
const Redis = require("ioredis");
const crypto = require("crypto");

const processEloGame = require("./elo");

var redis = new Redis();

redis.set("maps:sample", "2\n2\n.A\nB.");
redis.set(
  "maps:qualification",
  "4\n4\n" + "####\n" + "A..B\n" + "A11B\n" + ".99."
);
redis.set("brains:noop", 'brain "Noop" {\njump 0\n}');
redis.set("brains:noop:name", "Noop");

redis.set(
  "brains:liechtenstein",
  require("fs")
    .readFileSync("liechtenstein.brain")
    .toString()
);
redis.set("brains:liechtenstein:name", "liechtenstein");
redis.zadd("ranking", 1200, "brains:liechtenstein");

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // eslint-disable-line no-param-reassign
  }
}

function hash(data) {
  return crypto
    .createHash("SHA256")
    .update(data)
    .digest("hex")
    .slice(0, 16);
}

function eloifyGame(key) {
  return redis
    .pipeline()
    .lrange(key + ":brains", 0, -1)
    .hgetall(key + ":result:points")
    .exec((err, [[_e1, brains], [_e2, points]]) => {
      if (brains.length === 2) {
        let [brainA, brainB] = brains;
        redis.incr(brainA + ":games");
        redis.incr(brainB + ":games");
        console.log(brains, points);
        redis.zscore("ranking", brainA).then(eloA => {
          redis.zscore("ranking", brainB).then(eloB => {
            let res = processEloGame(
              { elo: JSON.parse(eloA), points: JSON.parse(points.A) },
              { elo: JSON.parse(eloB), points: JSON.parse(points.B) }
            );
            redis.zadd("ranking", res.A, brainA);
            redis.zadd("ranking", res.B, brainB);
          });
        });
      } else {
        console.log("expected 2 brains");
      }
    });
}

var RESULT_CALLBACKS = {
  mapResults: {},
  gameResults: {},
  processing: {}
};

function onStatus(key, chan, callback) {
  if (RESULT_CALLBACKS[chan][key] !== undefined)
    console.log("[W] reassigned", key, chan);
  RESULT_CALLBACKS[chan][key] = callback;
}
function clearStatus(key, chan) {
  if (RESULT_CALLBACKS[chan][key]) delete RESULT_CALLBACKS[chan][key];
}

var subConnection = new Redis();
subConnection.subscribe("mapResults", "gameResults", "processing");
subConnection.on("message", (chan, message) => {
  console.log("[PS]", chan, message);
  if (RESULT_CALLBACKS[chan][message]) {
    RESULT_CALLBACKS[chan][message]();
    clearStatus(message, chan);
  } else {
    if (chan === "gameResults") {
      let key = message;
      eloifyGame(key).then(() => {
        redis.get(key + ":scoreOnly").then(scoreOnly => {
          if (scoreOnly) unlinkKeys(key);
        });
      });
    }
  }
});

function makeGame(data) {
  var pipeline = redis.pipeline();
  let key = "games:" + hash(JSON.stringify(data));
  for (let e of Object.keys(data)) {
    if (e !== "brains") pipeline.set(key + ":" + e, data[e]);
  }
  pipeline.del(key + ":brains");
  pipeline.del(key + ":error");
  for (let brain of data["brains"]) {
    pipeline.rpush(key + ":brains", brain);
  }
  pipeline.exec((err, result) => {
    if (err) console.log(err);
  });
  return key;
}

function unlinkKeys(start) {
  let stream = redis.scanStream({ match: start + "*" });
  stream.on("data", results => {
    for (let key of results) redis.unlink(key);
  });
}

function ttlKeys(start, ttl) {
  let stream = redis.scanStream({ match: start + "*" });
  stream.on("data", results => {
    for (let key of results) redis.expire(key, ttl);
  });
}

io.on("connection", function(client) {
  function emitStatus(status) {
    if (typeof status === "string") status = { message: status };
    client.emit("status", JSON.stringify(status));
  }
  console.log("connection", client.id);
  client.on("event", function(data) {
    console.log("event", data);
  });

  client.on("mapRequest", data => {
    console.log("mapRequest", JSON.parse(data));
    const { map, preview } = JSON.parse(data);

    if (!preview && map.match(/[C-Z]/) !== null) {
      emitStatus({
        negative: true,
        title: "Map rejected.",
        message: "The map pool consists of two-team maps only"
      });
      return;
    }

    let key = "maps:" + hash(map);
    redis.set(key, map);
    if (preview) redis.set(key + ":preview", preview);

    redis.rpush("mapQueue", key);
    redis.publish("ping", key);
    emitStatus(`queued ${key}`);

    onStatus(key, "processing", () => client.emit("started processing " + key));
    onStatus(key, "mapResults", () => {
      clearStatus(key, "processing");
      redis.get(key + ":init").then(init => {
        if (preview) {
          unlinkKeys(key);
          emitStatus("Got map preview");
        } else {
          redis.zadd("mappool", 1, key);
          emitStatus("Submitted to the map-pool");
        }
        client.emit(
          "mapResult",
          JSON.stringify({
            init: JSON.parse(init),
            steps: []
          })
        );
      });
    });
  });

  client.on("brainRequest", data => {
    console.log("brainRequest", data);
    let key = "brains:" + hash(data);
    redis.set(key, data);
    let name = (data.match(/brain.*?"(.*?)"/) || [0, undefined])[1];
    redis.set(key + ":name", name);
    redis.set(key + ":games", 0);
    let qualification = makeGame({
      brains: [key, "brains:noop"],
      map: "maps:qualification",
      rounds: 10000,
      seed: 123
    });
    console.log("[QUAL]", qualification);

    emitStatus("queueing qualification match for " + name + "...");
    redis.rpush("gameQueue", qualification);
    onStatus(qualification, "processing", () =>
      emitStatus("started qualification match for " + name)
    );
    onStatus(qualification, "gameResults", () => {
      clearStatus(qualification, "processing");
      redis.get(qualification + ":error").then(error => {
        if (error) {
          emitStatus({
            message: error,
            negative: true,
            title: "Internal error"
          });
          client.emit("brainResult", "game errored");
          return;
        }

        redis.hget(qualification + ":result:points", "A").then(ptsA => {
          ptsA = (ptsA && JSON.parse(ptsA)) || 0;
          if (ptsA > 0) {
            redis.zadd("ranking", 1200, key);
            emitStatus({
              title: "Qualified",
              message: `'${name}' reached ${ptsA} points`
            });
            refreshBrains();
          } else {
            emitStatus({
              negative: true,
              title: "Not qualified",
              message: `'${name}' reached ${ptsA} points`
            });
            // TODO: TTL on creation
            ttlKeys(qualification, 600);
            unlinkKeys(key);
          }
        });
      });
    });
  });

  client.on("fetchRanking", data => {
    redis
      .zrevrangebyscore("ranking", "inf", "-inf", "WITHSCORES", "LIMIT", 0, 10)
      .then(data => {
        let ranking = [];
        let pipeline = redis.pipeline();
        while (data.length) {
          let key = data.shift();
          let elo = data.shift();
          pipeline.get(key + ":name");
          pipeline.get(key + ":games");
          ranking.push({ key, elo });
        }
        pipeline.exec((err, data) => {
          for (let i = 0; i < ranking.length; i++) {
            ranking[i].name = data.shift()[1];
            ranking[i].games = data.shift()[1];
          }
          client.emit("ranking", JSON.stringify(ranking));
        });
      });
  });

  client.on("loadGame", s => {
    const data = JSON.parse(s); // TODO: ranges
    const key = data.key;
    console.log("[G]", key);

    redis.llen(key + ":steps").then(count => {
      console.log("[G]", "sending", count, "steps");
      redis.get(key + ":init").then(init => {
        init = JSON.parse(init);
        redis.lrange(key + ":steps", 0, -1).then(steps => {
          steps = steps.map(v => JSON.parse(v));
          client.emit("gameData", JSON.stringify({ init, steps }));
        });
      });
    });
  });

  client.on("disconnect", function() {
    console.log("disconnect", client.id);
  });
});

let brains = [];

setInterval(() => {
  redis.llen("gameQueue").then(count => {
    if (count) {
      console.log("[in queue]", count, "games");
      redis.publish("ping", "work");
      for (let i = 100; i < 10000; i += 420)
        setTimeout(() => redis.publish("ping", "work"), i);
    } else {
      if (brains.length < 2) {
        console.log("[W]", "neeed moorrreee braaaaaaainns");
        return;
      }
      console.log("queueing random games");
      for (let i = 0; i < 100; i++) {
        let map = "maps:qualification";
        let game_brains = brains.slice();
        shuffleArray(game_brains);
        game_brains = game_brains.slice(0, 2);
        let gameID = makeGame({
          rounds: 10000,
          scoreOnly: true,
          seed: Math.round(Math.random() * 1337 * 420),
          brains: game_brains,
          map
        });
        redis.rpush("gameQueue", gameID);
      }
    }
  });
}, 10000);

function refreshBrains() {
  redis
    .zrevrangebyscore("ranking", "inf", "-inf", "LIMIT", 0, 10)
    .then(_brains => (brains = _brains));
}
refreshBrains();
setInterval(refreshBrains, 1000 * 60 * 10);

console.log("listening on :3044");
server.listen(3044);
