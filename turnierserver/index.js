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
redis.zadd("ranking", "NX", 1200, "brains:liechtenstein");

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

async function eloifyGame(key) {
  let brains = await redis.lrange(key + ":brains", 0, -1);
  let points = await redis.hgetall(key + ":result:points");
  if (brains.length === 2) {
    let [brainA, brainB] = brains;
    await redis.incr(brainA + ":games");
    await redis.incr(brainB + ":games");
    console.log(brains, points);
    let eloA = await redis.zscore("ranking", brainA);
    let eloB = await redis.zscore("ranking", brainB);
    let res = processEloGame(
      { elo: JSON.parse(eloA), points: JSON.parse(points.A) },
      { elo: JSON.parse(eloB), points: JSON.parse(points.B) }
    );
    await redis.zadd("ranking", res.A, brainA);
    await redis.zadd("ranking", res.B, brainB);
  } else {
    console.log("expected 2 brains");
  }
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
subConnection.on("message", async (chan, message) => {
  console.log("[PS]", chan, message);
  if (RESULT_CALLBACKS[chan][message]) {
    RESULT_CALLBACKS[chan][message]();
    clearStatus(message, chan);
  } else {
    if (chan === "gameResults") {
      let key = message;
      await eloifyGame(key);
      let scoreOnly = await redis.get(key + ":scoreOnly");
      if (scoreOnly) unlinkKeys(key);
    }
  }
});

async function makeGame(data) {
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
  await pipeline.exec();
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
    onStatus(key, "mapResults", async () => {
      clearStatus(key, "processing");
      let init = await redis.get(key + ":init");
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

  client.on("brainRequest", async data => {
    console.log("brainRequest", data);
    let key = "brains:" + hash(data);
    redis.set(key, data);
    let name = (data.match(/brain.*?"(.*?)"/) || [0, undefined])[1];
    redis.set(key + ":name", name);
    redis.set(key + ":games", 0);
    let qualification = await makeGame({
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
    onStatus(qualification, "gameResults", async () => {
      clearStatus(qualification, "processing");
      let error = await redis.get(qualification + ":error");
      if (error) {
        emitStatus({
          message: error,
          negative: true,
          title: "Internal error"
        });
        return;
      }

      let ptsA = await redis.hget(qualification + ":result:points", "A");
      ptsA = (ptsA && JSON.parse(ptsA)) || 0;
      if (ptsA > 0) {
        await redis.zadd("ranking", 1200, key);
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

  client.on("fetchRanking", async _ => {
    let scoreData = await redis.zrevrangebyscore(
      "ranking",
      "inf",
      "-inf",
      "WITHSCORES",
      "LIMIT",
      0,
      10
    );
    let ranking = [];
    let pipeline = redis.pipeline();
    while (scoreData.length) {
      let key = scoreData.shift();
      let elo = scoreData.shift();
      pipeline.get(key + ":name");
      pipeline.get(key + ":games");
      ranking.push({ key, elo });
    }
    let otherData = await pipeline.exec();
    for (let i = 0; i < ranking.length; i++) {
      ranking[i].name = otherData.shift()[1];
      ranking[i].games = otherData.shift()[1];
    }
    client.emit("ranking", JSON.stringify(ranking));
  });

  client.on("loadGame", async s => {
    const data = JSON.parse(s); // TODO: ranges
    const key = data.key;
    console.log("[G]", key);

    let count = await redis.llen(key + ":steps");
    console.log("[G]", "sending", count, "steps");
    let init = await redis.get(key + ":init");
    init = JSON.parse(init);
    let steps = await redis.lrange(key + ":steps", 0, -1);
    steps = steps.map(v => JSON.parse(v));
    client.emit("gameData", JSON.stringify({ init, steps }));
  });

  client.on("disconnect", function() {
    console.log("disconnect", client.id);
  });
});

let brains = [];

setInterval(async () => {
  let count = await redis.llen("gameQueue");
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
      let gameID = await makeGame({
        rounds: 10000,
        scoreOnly: true,
        seed: Math.round(Math.random() * 1337 * 420),
        brains: game_brains,
        map
      });
      await redis.rpush("gameQueue", gameID);
    }
  }
}, 10000);

async function refreshBrains() {
  brains = await redis.zrevrangebyscore(
    "ranking",
    "inf",
    "-inf",
    "LIMIT",
    0,
    10
  );
}
refreshBrains();
setInterval(refreshBrains, 1000 * 60 * 10);

console.log("listening on :3044");
server.listen(3044);
