const server = require("http").createServer();
const io = require("socket.io")(server);
const Redis = require('ioredis')
const crypto = require('crypto')

var redis = new Redis();


redis.set('maps:sample', '2\n2\n.A\nB.')
redis.set('brains:noop', 'brain \"Noop\" { jump 0 }')
redis.set('brains:noop:elo', 1200)
redis.set('brains:turnmove', 'brain \"TurnAndMove\" { flip 3 else 1\nturn left\nmove else 0\njump 0 }')
redis.set('brains:turnmove:elo', 1200)
redis.set('games:test:map', 'maps:sample')
redis.set('games:test:rounds', 1000)
redis.set('games:test:seed', 42)
redis.del('games:test:brains')
redis.rpush('games:test:brains', 'brains:noop')
redis.rpush('games:test:brains', 'brains:turnmove')

function hash(data) {
  return crypto.createHash("SHA256").update(data).digest('hex').slice(0, 16)
}

redis.set('foo', 'bar');
redis.get('foo', function (err, result) {
  if (err) {
    console.error(err);
  } else {
    console.log(result);
  }
});

var RESULT_CALLBACKS = {
  mapResults: {},
  gameResults: {}
}


var subConnection = new Redis()
subConnection.subscribe('mapResults', 'gameResults')
subConnection.on('message', (chan, message) => {
  console.log('[PS]', chan, message)
  if (RESULT_CALLBACKS[chan][message])
    RESULT_CALLBACKS[chan][message]()
})

function makeGame(redis, data) {
  let key = 'games:' + hash(JSON.stringify(data))
  for (let e of data) {
    redis.set(key + ':' + e, data[e])
  }
  return key;
}

io.on("connection", function(client) {
  console.log('connection', client.id)
  client.on("event", function(data) {
    console.log('event', data)
  });

  client.on("mapRequest", (data) => {
    console.log('mapRequest', JSON.parse(data))
    const { map, preview } = JSON.parse(data)

    let key = 'maps:' + hash(map)
    redis.set(key, map)
    if (preview)
      redis.set(key+':preview', preview)

    redis.rpush('mapQueue', key)
    redis.publish('ping', key)

    RESULT_CALLBACKS.mapResults[key] = () => {
      redis.get(key+':init').then(init => client.emit('mapResult', JSON.stringify({
        init: JSON.parse(init),
        steps: []
      })))
    }
  })

  client.on("brainRequest", (data) => {
    let key = 'brains:' + hash(data)
    redis.set(key, data)
    let qualification = makeGame({
      brains: [key, "brains:noop"],
      map: "maps:sample",
      rounds: 1000,
      seed: 123
    })
  })

  client.on("fetchRanking", (data) => {
    client.emit("ranking", JSON.stringify([
      { name: "Noop", elo: 1200, games: 3 },
      { name: "Test", elo: 1201, games: 4 }
    ]))
  })

  client.on("disconnect", function() {
    console.log('disconnect', client.id)
  });
});



console.log('listening on :3044')
server.listen(3044);
