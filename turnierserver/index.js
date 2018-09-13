const server = require("http").createServer();
const io = require("socket.io")(server);
const Redis = require("ioredis");
const crypto = require("crypto");

const processEloGame = require("./elo");

var redis = new Redis();

redis.defineCommand("expMovingAverage", {
  numberOfKeys: 2,
  lua: `redis.call('set', KEYS[1], (0.95 * (redis.call('get', KEYS[1])) or KEYS[2]) + (1.0 - 0.95) * KEYS[2])`
});

/*
redis.set(
  "maps:qualification",
  "4\n4\n" + "####\n" + "A..B\n" + "A11B\n" + ".99."
);
redis.set("maps:qualification:rounds", 10000);
*/
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

redis.set("stats:avg_rtt", 0);

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
  let sum = Number.MIN_VALUE;
  let r = Math.random() * total;
  for (let key of Object.keys(spec)) {
    sum += spec[key];
    if (r <= sum) return key;
  }
}

async function processResult(key) {
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
    let queued_time = await redis.get(key + ":queued_time");
    let curr_time = await redis.time();

    queued_time = parseFloat(queued_time);
    curr_time = parseFloat(curr_time[0]);
    await redis.expMovingAverage("stats:avg_rtt", curr_time - queued_time);

    console.log(brains, points);
    let eloA = await redis.zscore("ranking", brainA);
    let eloB = await redis.zscore("ranking", brainB);
    if (eloA == null || eloB == null) {
      console.log("not ranking qualification game ", key);
      return;
    }
    let res = processEloGame(
      { elo: parseInt(eloA, 10), points: parseInt(points.A, 10) },
      { elo: parseInt(eloB, 10), points: parseInt(points.B, 10) }
    );
    await redis.zadd("ranking", res.A, brainA);
    await redis.zadd("ranking", res.B, brainB);
  } else {
    console.log("expected 2 brains, got", brains);
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
  }

  if (chan === "gameResults") {
    let key = message;
    await processResult(key);
    let scoreOnly = await redis.get(key + ":scoreOnly");
    if (scoreOnly) unlinkKeys(key);
  }
});

async function makeGame(data) {
  if (!data.rounds) {
    data.rounds = await redis.get(data.map + ":rounds");
  }
  if (!data.seed) {
    data.seed = Math.round(Math.random() * 1337 * 420);
  }
  let queued = await redis.time();
  data.queued_time = queued[0];

  var pipeline = redis.pipeline();
  let key = "games:" + hash(JSON.stringify(data));
  for (let e of Object.keys(data)) {
    if (e !== "brains") pipeline.set(key + ":" + e, data[e]);
    pipeline.expire(key + ":" + e, 600);
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

async function cacheResult(client, chan, key, compute) {
  let res = await redis.get(key);
  if (res !== null) {
    return client.emit(chan, res);
  }

  compute(async data => {
    client.emit(chan, data);
    let pl = redis.pipeline();
    pl.set(key, data);
    pl.expire(key, 2);
    await pl.exec();
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
    const { map, name, preview } = JSON.parse(data);

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

    await redis.set(key + ":name", name);
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
        await redis.set(key + ":rounds", 100000);
        await redis.set(key + ":time", 100);
        await redis.zadd("mappool", 1, key);
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
      brains: [key, "brains:liechtenstein"],
      map: "maps:qualification",
      seed: 123
    });
    console.log("[QUAL]", qualification);

    emitStatus("queueing qualification match for " + name + "...");
    await redis.lpush("gameQueue", qualification);
    redis.publish("ping", "B");
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

  client.on("triggerGame", async data => {
    let { lpush, map, brainA, brainB } = JSON.parse(data);
    let gameID = await makeGame({
      map,
      brains: [brainA, brainB]
    });

    emitStatus("adding game to queue");

    if (lpush) {
      await redis.lpush("gameQueue", gameID);
    } else {
      await redis.rpush("gameQueue", gameID);
    }

    onStatus(gameID, "processing", () =>
      emitStatus({
        title: "started processing " + gameID,
        message: "Note: JSON-serialization can take a while"
      })
    );
    onStatus(gameID, "gameResults", async () => {
      clearStatus(gameID, "processing");
      emitStatus("game ready: " + gameID);
    });

    await redis.publish("ping", "T");
  });

  client.on("fetchRanking", async _ => {
    cacheResult(client, "ranking", "cache:ranking", async emitCache => {
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
      emitCache(JSON.stringify(ranking));
    });
  });

  client.on("loadGame", async key => {
    console.log("[G]", key);

    let buf = await redis.getBuffer(key + ":log_gz");

    if (buf) {
      emitStatus("transferring " + key);
      client.emit("gameData", buf);
      emitStatus("fetched game");
    } else emitStatus({ negative: true, message: "couldn't find game" });
  });

  client.on("listGames", _ => {
    cacheResult(client, "gameList", "cache:gameList", async emitCache => {
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
          pipeline.get(key + ":time");
          pipeline.ttl(key + ":log_gz");
          pipeline.hget(key + ":result:points", "A");
          pipeline.hget(key + ":result:points", "B");
          pipeline.lrange(key + ":brains", 0, -1);
        }
        let gameData = await pipeline.exec();
        for (let i = 0; i < games.length; i++) {
          games[i].map = gameData.shift()[1];
          games[i].map = await redis.get(games[i].map + ":name");
          games[i].rounds = gameData.shift()[1];
          games[i].time = gameData.shift()[1];
          games[i].ttl = gameData.shift()[1];
          games[i].pointsA = gameData.shift()[1];
          games[i].pointsB = gameData.shift()[1];
          games[i].brains = gameData.shift()[1];
          for (let bi = 0; bi < games[i].brains.length; bi++) {
            games[i].brains[bi] = await redis.get(
              games[i].brains[bi] + ":name"
            );
          }
        }
        games.sort((a, b) => b.ttl - a.ttl);

        emitCache(JSON.stringify(games));
      });
    });
  });

  client.on("listMaps", async _ => {
    cacheResult(client, "mapList", "cache:mapList", async emitCache => {
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
      emitCache(JSON.stringify(maps));
    });
  });

  client.on("stats", async _ => {
    let avg_rtt = await redis.get("stats:avg_rtt");
    let queued = await redis.llen("gameQueue");

    client.emit(
      "stats",
      JSON.stringify({
        avgRtt: parseFloat(avg_rtt),
        queued: parseInt(queued),
        connections: io.engine.clientsCount
      })
    );
  });

  client.on("banner", async _ => {
    let banner = await redis.get("banner");
    client.emit("banner", banner || "null");
  });

  client.on("disconnect", function() {
    console.log("disconnect", client.id);
  });
});

let brains = {};
let mapPool = {};

function getMatch(brain) {
  let choices = {};
  for (let other of Object.keys(brains)) {
    let dist = brains[other] - brains[brain];
    let compatibility = Math.exp((dist * dist) / -2000);
    choices[other] = compatibility;
  }
  return weightedRand(choices);
}

setInterval(async () => {
  let count = await redis.llen("gameQueue");
  if (count > 50) {
    console.log("[in queue]", count, "games");
    redis.publish("ping", "Q");
  } else {
    if (brains.length < 2) {
      console.log("[W]", "neeed moorrreee braaaaaaainns");
      return;
    }
    console.log("queueing random games");
    for (let i = 0; i < 50; i++) {
      let map = weightedRand(mapPool);
      let brainList = Object.keys(brains);
      let brainA = brainList[Math.floor(Math.random() * brainList.length)];
      let brainB = getMatch(brainA);

      // P(getMatch A B) != P(getMatch B A)
      // some maps might not be fair, randomizing the order should fix this
      if (Math.random() > 0.5) {
        [brainA, brainB] = [brainB, brainA];
      }
      console.log("[Q]", brainA, "vs", brainB, brains[brainA], brains[brainB]);
      let gameID = await makeGame({
        scoreOnly: true,
        brains: [brainA, brainB],
        map
      });
      await redis.rpush("gameQueue", gameID);
    }
    await redis.publish("ping", "Q");
  }
}, 5000);

async function refreshBrains() {
  let brains_ = await redis.zrevrangebyscore(
    "ranking",
    "inf",
    "-inf",
    "WITHSCORES",
    "LIMIT",
    0,
    50
  );
  brains = {};
  while (brains_.length) {
    brains[brains_.shift()] = parseInt(brains_.shift());
  }
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
