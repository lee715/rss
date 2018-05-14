const config = require('config')
const Redis = require('ioredis')
const subRedis = new Redis(config.redis)
const pubRedis = new Redis(config.redis)

subRedis.on('message', (ch, msg) => {
  sockCol.handleSub(ch, msg)
})

const sockMap = {}

const sockCol = module.exports = {
  get: (uid) => {
    if (!uid) return null
    return sockMap[uid]
  },

  ensureAgent: (uid, sock) => {
    if (sockMap[uid]) return sockMap[uid]
    sockMap[uid] = new SockAgent(uid, sock)
    sock.uid = uid
    return sockMap[uid]
  },

  closeSock: function (sock) {
    if (sock.uid) {
      sockMap[sock.uid] = null
      this.unsubscribe(sock.uid)
      sock.uid = null
    }
  },

  handleSub: function (ch, msg) {
    let uid = ch.split('@')[1]
    let sock = this.get(uid)
    if (!sock) {
      this.unsubscribe(uid)
      return this.publishErr(uid, msg, 'sock not found')
    }
    msg = JSON.parse(msg)
    console.log(ch, msg)
    switch (msg.cmd) {
      case 'start':
        let time = msg.time
        if (!time) return this.publishErr(uid, msg, 'time not provide')
        this.start(uid, time, (err, status) => {
          if (err) return this.publishErr(uid, msg, `start failed: ${err.message}`)
          this.publish(uid, msg)
        })
        break
      case 'check':
        this.check(uid, (err, status) => {
          if (err) return this.publishErr(uid, msg, `check failed: ${err.message}`)
          this.publish(uid, msg)
        })
        break
      default:
        this.publishErr(uid, msg, `unknown cmd: ${msg.cmd}`)
    }
  },

  unsubscribe: (uid) => {
    subRedis.unsubscribe(`s:devices@${uid}`)
  },

  publishErr: function (uid, msg, errmsg) {
    msg.errmsg = errmsg
    this.publish(uid, msg)
  },

  publish: (uid, msg) => {
    pubRedis.publish(`c:devices@${uid}`, JSON.stringify(msg))
  },

  start: (uid, time, callback) => {
    let sock = sockCol.get(uid)
    if (!sock) return callback(new Error('sock not found'))
    sock.sendStart(time, (err) => {
      if (err) callback(err)
      callback(null, 'started')
    })
  },

  check: (uid, callback) => {
    let sock = sockCol.get(uid)
    if (!sock) return callback(new Error('sock not found'))
    sock.checkStart(uid, (err) => {
      if (err) callback(err)
      callback(null, 'checked')
    })
  },

  checkSockAsync: (uid) => {
    return new Promise((resolve, reject) => {
      let sock = sockCol.get(uid)
      if (!sock) reject(new Error('sock not found'))
      sock.checkStart(uid, (err) => {
        if (err) reject(err)
        resolve(null, 'checked')
      })
    })
  },

  startAsync: (uid, time) => {
    console.log('start device', uid, time)
    return new Promise((resolve, reject) => {
      let sock = sockCol.get(uid)
      if (!sock) reject(new Error('sock not found'))
      sock.sendStart(time, (err) => {
        if (err) reject(err)
        resolve(null, 'started')
      })
    })
  }
}

class SockAgent {
  constructor (uid, sock) {
    this.sock = sock
    this.uid = uid
    subRedis.subscribe(`s:devices@${uid}`, (err) => {
      console.log(err, 'subscribed')
    })
    this._cache = {}
    return this
  }

  handleMsg (msg) {
    switch (msg.type) {
      case 'OP_RES':
        this.doCache(null, 'ok')
        break
      case 'CHECK_RES':
        this.doCache(null, 'check')
        break
      case 'STATUS':
        this.record(msg)
        this._ok()
        break
    }
  }

  sendStart (time, callback) {
    let self = this
    let timer = setInterval(function () {
      self._start(time)
    }, 3000)
    this._start(time)
    this.cache('start', callback, timer)
  }

  _start (time) {
    console.log('_start', this.uid, time, `~${this.uid}#startup#${time}\r`)
    this.sock.write(`~${this.uid}#startup#${time}\r`)
  }

  checkStart (uid, callback) {
    let timer = setTimeout(function () {
      callback(new Error('device unreachable'))
    }, 1000 * 5)
    this._check(uid)
    this.cache('check', callback, timer)
  }

  _check (uid) {
    console.log('_check', this.uid, `~${this.uid}#check\r`)
    this.sock.write(`~${this.uid}#check\r`)
  }

  _ok () {
    this.sock.write(`~${this.uid}#OK\r`)
  }

  cache (type, fn, timer) {
    let c = this._cache[type] = {}
    c.fn = fn
    c.timer = timer
  }

  doCache (err, type) {
    console.log('doCache', err, type)
    let cache
    switch (type) {
      case 'ok':
        cache = this._cache.start
        if (cache) {
          cache.fn(err, type)
          clearInterval(cache.timer)
          this._cache.start = null
        }
        break
      case 'check':
        cache = this._cache.check
        if (cache) {
          cache.fn(err, type)
          clearTimeout(cache.timer)
          this._cache.check = null
        }
        break
    }
  }

  clearCache () {
    this._cache = null
    this._timer && clearInterval(this._timer)
    this._timer = null
  }

  record (msg) {
  }
}
