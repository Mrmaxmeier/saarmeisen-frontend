const server = require("http").createServer();
const io = require("socket.io")(server);
const Redis = require("ioredis");
const crypto = require("crypto");

const processEloGame = require("./elo");

var redis = new Redis();

redis.defineCommand("expMovingAverage", {
  numberOfKeys: 2,
  lua: `redis.call('set', KEYS[1], (0.99 * redis.call('get', KEYS[1])) + (1.0 - 0.99) * KEYS[2])`
});

redis.set("maps:sample", "2\n2\n.A\nB.");
redis.set(
  "maps:qualification",
  "4\n4\n" + "####\n" + "A..B\n" + "A11B\n" + ".99."
);
redis.set("maps:qualification:rounds", 10000);
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
redis.zadd("mappool", "NX", 1, "maps:qualification");

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

function weightedRand(spec) {
  let total = 0;
  for (let key of Object.keys(spec)) {
    total += spec[key];
  }
  let sum = 0;
  let r = Math.random() * total;
  for (let key of Object.keys(spec)) {
    sum += spec[key];
    if (r <= sum) return key;
  }
}

async function eloifyGame(key) {
  let brains = await redis.lrange(key + ":brains", 0, -1);
  let points = await redis.hgetall(key + ":result:points");
  let map = await redis.get(key + ":map");
  if (brains.length === 2) {
    let [brainA, brainB] = brains;
    await redis.incr(brainA + ":games");
    await redis.incr(brainB + ":games");
    await redis.incr(map + ":games");
    let time = await redis.get(key + ":time");
    await redis.expMovingAverage(map + ":time", time);
    console.log(brains, points);
    let eloA = await redis.zscore("ranking", brainA);
    let eloB = await redis.zscore("ranking", brainB);
    let res = processEloGame(
      { elo: parseInt(eloA, 10), points: parseInt(points.A, 10) },
      { elo: parseInt(eloB, 10), points: parseInt(points.B, 10) }
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
  if (!data.rounds) {
    data.rounds = await redis.get(data.map + ":rounds");
  }
  var pipeline = redis.pipeline();
  let key = "games:" + hash(JSON.stringify(data));
  for (let e of Object.keys(data)) {
    if (e !== "brains") pipeline.set(key + ":" + e, data[e]);
    pipeline.expire(key + ":" + e, 60);
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

io.on("connection", function(client) {
  function emitStatus(status) {
    if (typeof status === "string") status = { message: status };
    client.emit("status", JSON.stringify(status));
  }
  console.log("connection", client.id, client.request.connection.remoteAddress);
  client.on("event", function(data) {
    console.log("event", data);
  });

  client.on("mapRequest", async data => {
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

    await redis.rpush("mapQueue", key);
    redis.publish("ping", "M");
    emitStatus(`queued ${key}`);

    onStatus(key, "processing", () => client.emit("started processing " + key));
    onStatus(key, "mapResults", async () => {
      clearStatus(key, "processing");
      if (preview) {
        unlinkKeys(key);
        emitStatus("Got map preview");
      } else {
        redis.zadd("mappool", 1, key);
        redis.set(key + ":rounds", 10000);
        emitStatus("Submitted to the map-pool");
        refreshMaps();
      }
      let buf = await redis.getBuffer(key + ":log_gz");
      if (buf !== null) {
        client.emit("mapResult", buf);
        await redis.persist(key + ":log_gz");
      } else {
        emitStatus("Failed to parse map");
      }
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
      seed: 123
    });
    console.log("[QUAL]", qualification);

    emitStatus("queueing qualification match for " + name + "...");
    await redis.rpush("gameQueue", qualification);
    redis.rpush("ping", "B");
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
      50
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

  client.on("loadGame", async key => {
    console.log("[G]", key);

    let buf = await redis.getBuffer(key + ":log_gz");

    if (buf) client.emit("gameData", buf);
    else emitStatus({ negative: true, message: "couldn't find game" });
  });

  client.on("listGames", _ => {
    let stream = redis.scanStream({ match: "games:*:log_gz" });
    let games = [];
    stream.on("data", sd => {
      for (let game of sd) games.push({ key: game.replace(":log_gz", "") });
    });
    stream.on("end", async () => {
      let pipeline = redis.pipeline();
      for (let { key } of games) {
        pipeline.get(key + ":map");
        pipeline.get(key + ":rounds");
        pipeline.ttl(key + ":log_gz");
        pipeline.lrange(key + ":brains", 0, -1);
      }
      let gameData = await pipeline.exec();
      for (let i = 0; i < games.length; i++) {
        games[i].map = gameData.shift()[1];
        games[i].rounds = gameData.shift()[1];
        games[i].ttl = gameData.shift()[1];
        games[i].brains = gameData.shift()[1];
      }
      games.sort((a, b) => a.ttl - b.ttl);
      client.emit("gameList", JSON.stringify(games));
    });
  });

  client.on("listMaps", async _ => {
    let _cached = await redis.get("cache:mapList")
    if (cached)
      return client.emit("mapList", _cached)
    let maps_ = await redis.zrevrangebyscore(
      "mappool",
      "inf",
      "0",
      "WITHSCORES",
      "LIMIT",
      0,
      50
    );
    let maps = [];
    while (maps_.length) {
      let key = maps_.shift();
      let weight = maps_.shift();
      let rounds = await redis.get(key + ":rounds");
      let name = await redis.get(key + ":name");
      let time = await redis.get(key + ":time");
      let games = await redis.get(key + ":games");
      maps.push({ key, weight, rounds, games, name, time: Math.round(time) });
    }
    client.emit("mapList", JSON.stringify(maps));
    await redis.set("cache:mapList", JSON.stringify(maps))
    await redis.expire("cache:mapList", 10)
  });

  client.on("disconnect", function() {
    console.log("disconnect", client.id);
  });
});

let brains = [];
let mapPool = {};

setInterval(async () => {
  let count = await redis.llen("gameQueue");
  if (count) {
    console.log("[in queue]", count, "games");
    redis.publish("ping", "Q");
  } else {
    if (brains.length < 2) {
      console.log("[W]", "neeed moorrreee braaaaaaainns");
      return;
    }
    console.log("queueing random games");
    for (let i = 0; i < 100; i++) {
      if (i % 10 == 0) await redis.publish("ping", "Q");
      let map = weightedRand(mapPool);
      let game_brains = brains.slice();
      shuffleArray(game_brains);
      game_brains = game_brains.slice(0, 2);
      let gameID = await makeGame({
        scoreOnly: true,
        seed: Math.round(Math.random() * 1337 * 420),
        brains: game_brains,
        map
      });
      await redis.rpush("gameQueue", gameID);
    }
    await redis.publish("ping", "Q");
  }
}, 10000);

async function refreshBrains() {
  brains = await redis.zrevrangebyscore(
    "ranking",
    "inf",
    "-inf",
    "LIMIT",
    0,
    50
  );
}
refreshBrains();
setInterval(refreshBrains, 1000 * 60 * 10);

async function refreshMaps() {
  let maps = await redis.zrevrangebyscore(
    "mappool",
    "inf",
    "0",
    "WITHSCORES",
    "LIMIT",
    0,
    50
  );
  mapPool = {};
  while (maps.length) {
    mapPool[maps.shift()] = parseInt(maps.shift());
  }
}
refreshMaps();
setInterval(refreshMaps, 1000 * 60 * 10);

console.log("listening on :3044");
server.listen(3044);
