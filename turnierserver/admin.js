const Redis = require("ioredis");
const inquirer = require("inquirer");

var ui = new inquirer.ui.BottomBar();

var redis = new Redis();

function expirePat(start) {
  let stream = redis.scanStream({ match: start + "*" });
  stream.on("data", results => {
    for (let key of results) {
      ui.log.write(`expire ${key} 60`);
      redis.expire(key, 60);
    }
  });
}

async function getMapPool() {
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

  return mapPool;
}

function mainmenu() {
  inquirer
    .prompt([
      {
        choices: [
          "edit map",
          "remove brain",
          "map maintenance",
          "expire stuck games"
        ],
        type: "list",
        name: "action"
      }
    ])
    .then(async res => {
      console.log(res);
      switch (res.action) {
        case "edit map":
          let mappool = await getMapPool();
          console.log(mappool);
          let mapswithname = [];
          for (let key of Object.keys(mappool)) {
            mapswithname.push(key + " % " + (await redis.get(key + ":name")));
          }
          res = await inquirer.prompt({
            choices: mapswithname,
            type: "list",
            name: "map"
          });
          let key = res.map.split(" % ")[0];
          let map = await redis.get(key);
          let name = await redis.get(key + ":name");
          console.log("key", key);
          console.log("name", name);
          console.log(map);
          res = await inquirer.prompt({
            choices: ["edit name", "edit weight"],
            type: "list",
            name: "action"
          });
          if (res.action === "edit name") {
            res = await inquirer.prompt({
              type: "input",
              name: "name",
              message: "new name"
            });
            await redis.set(key + ":name", res.name);
            console.log("ok");
          }
          break;
        case "map maintenance":
          // needs to be run twice
          let maps = Object.keys(await getMapPool());
          for (let key of maps) {
            console.log(key);
            // await redis.rpush("mapQueue", key);
            await redis.persist(key + ":log_gz");
            await redis.set(key + ":rounds", 10000);
            await redis.persist(key + ":rounds");
          }
          // await redis.publish("ping", "M");
          break;
        case "remove brain":
          let brains = await redis.zrevrangebyscore("ranking", "inf", "0");
          console.log(brains);
          let brainswithname = [];
          for (let key of brains) {
            brainswithname.push(key + " % " + (await redis.get(key + ":name")));
          }
          res = await inquirer.prompt({
            choices: brainswithname,
            type: "list",
            name: "brain"
          });
          await expirePat(res.brain.split(" % ")[0]);
          await redis.zrem("ranking", res.brain.split(" % ")[0]);
          break;
        case "expire stuck games":
          await expirePat("games:");
      }
      mainmenu();
    })
    .catch(e => {
      console.log(e);
      throw e;
    });
}
mainmenu();
