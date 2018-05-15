const config = require('config')
const Client = require('./client')
const Redis = require('ioredis')
const subRedis = new Redis(config.redis)
const pubRedis = new Redis(config.redis)

let uid = '201803060001'
new Client(uid)

// subRedis.subscribe(`c:devices@${uid}`)

// subRedis.on('message', (ch, msg) => {
//   console.log(ch, msg)
// })

// setTimeout(() => {
//   let data = {
//     cmd: 'start',
//     time: 2
//   }
//   pubRedis.publish(`s:devices@${uid}`, JSON.stringify(data))
// }, 1000)
