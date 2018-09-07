const server = require("http").createServer();
const io = require("socket.io")(server);
const Redis = require("ioredis");
const crypto = require("crypto");

var redis = new Redis();

redis.set("maps:sample", "2\n2\n.A\nB.");
redis.set(
  "maps:qualification",
  "4\n4\n" + "####\n" + "A..B\n" + "A11B\n" + ".99."
);
redis.set("brains:noop", 'brain "Noop" {\njump 0\n}');

redis.set(
  "brains:liechtenstein",
  require("fs")
    .readFileSync("liechtenstein.brain")
    .toString()
);
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
  return redis.lrange(key + ":brains", 0, -1).then(brains => {
    redis.hgetall(key + ":result:points")
  })
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
    clearStatus(chan, message);
  } else {
    if (chan === "gameResults") {
      let key = message;
      eloifyGame(key).then(() => {
        redis.get(key+":scoreOnly").then(scoreOnly => {
          if (scoreOnly)
            unlinkKeys(key)
        })
      })
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

io.on("connection", function(client) {
  console.log("connection", client.id);
  client.on("event", function(data) {
    console.log("event", data);
  });

  client.on("mapRequest", data => {
    console.log("mapRequest", JSON.parse(data));
    const { map, preview } = JSON.parse(data);

    let key = "maps:" + hash(map);
    redis.set(key, map);
    if (preview) redis.set(key + ":preview", preview);

    redis.rpush("mapQueue", key);
    redis.publish("ping", key);
    client.emit("status", `queued ${key}`);

    onStatus(key, "processing", () => client.emit("started processing " + key));
    onStatus(key, "mapResults", () => {
      clearStatus(key, "processing");
      redis.get(key + ":init").then(init => {
        if (preview) unlinkKeys(key);
        client.emit("status", "processed map");
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
    let qualification = makeGame({
      brains: [key, "brains:noop"],
      map: "maps:qualification",
      rounds: 1000,
      seed: 123
    });
    console.log("[QUAL]", qualification);

    client.emit("status", "starting qualification match...");
    redis.rpush("gameQueue", qualification);
    onStatus(qualification, "gameResults", () => {
      redis.get(qualification + ":error").then(error => {
        if (error) {
          client.emit("status", error);
          client.emit("brainResult", "game errored");
          return;
        }

        redis.hget(qualification + ":result:points", "A").then(ptsA => {
          ptsA = (ptsA && JSON.parse(ptsA)) || 0;
          client.emit("status", `qualification results: ${ptsA} points`);
          if (ptsA > 0) {
            redis.zadd("ranking", 1200, key);
            client.emit(
              "brainResult",
              "brain qualified with " + ptsA + " points"
            );
          } else {
            // unlinkKeys(qualification);
            // unlinkKeys(key);
            client.emit("brainResult", "brain did not qualify :(");
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
        while (data.length) {
          let elo = data.pop(0);
          let name = data.pop(0);
          ranking.push({ name, elo, games: -1 });
        }
        client.emit("ranking", JSON.stringify(ranking));
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
      console.log("[Queue]", count, "games");
    } else {
      console.log("queueing random game");
      let map = "maps:qualification";
      let game_brains = brains.slice();
      shuffleArray(game_brains);
      game_brains = game_brains.slice(0, 2);
      let gameID = makeGame({
        rounds: 1000,
        scoreOnly: true,
        seed: Math.round(Math.random() * 1337 * 420),
        brains: game_brains,
        map
      });
      redis.rpush("gameQueue", gameID);
    }
  });
}, 1000);

function refreshBrains() {
  let brainStream = redis.scanStream({ match: "brains:*" });
  let _brains = [];
  brainStream.on("data", keys => {
    for (let key of keys) if (key.lastIndexOf(":") === 6) _brains.push(key);
  });
  brainStream.on("end", () => {
    brains = _brains;
  });
}
refreshBrains();
setInterval(refreshBrains, 1000 * 60 * 10);

console.log("listening on :3044");
server.listen(3044);
