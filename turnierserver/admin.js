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

  return new Promise((resolve, reject) => {
    stream.on("end", resolve);
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
          "remove brains",
          "expire stuck brains:*",
          "expire stuck game:*",
          "map maintenance"
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
            choices: ["edit name", "delete map", "edit weight"],
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
          } else if (res.action === "delete map") {
            expirePat(key);
            await redis.zrem("mappool", key);
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
        case "remove brains":
          let brains = await redis.zrevrangebyscore("ranking", "inf", "0");
          let brainswithname = [];
          for (let key of brains) {
            let name = await redis.get(key + ":name");
            let elo = await redis.zscore("ranking", key);
            brainswithname.push(key + " % " + name + " % " + elo);
            ui.log.write(key);
          }
          res = await inquirer.prompt({
            choices: brainswithname,
            type: "checkbox",
            message: "select brains to be removed",
            name: "brains"
          });
          console.log(res);
          for (let line of res.brains) {
            let key = line.split(" % ")[0];
            await redis.zrem("ranking", key);
            await expirePat(key);
            ui.log.write("removed " + line);
          }
          break;
        case "expire stuck game:*":
          await expirePat("games:");
          break;
        case "expire stuck brains:*":
          let brainlike = await redis.keys("brains:*");
          console.log(brainlike);
          for (let key of brainlike) {
            let brainkey = "brains:" + key.split(":")[1];
            let elo = await redis.zscore("ranking", brainkey);
            if (elo === null) {
              ui.log.write("expire " + key);
              await redis.expire(key, 120);
            }
          }
          break;
        default:
          ui.log.write("unknown option " + res.action);
      }
      mainmenu();
    })
    .catch(e => {
      console.log(e);
      throw e;
    });
}
mainmenu();
