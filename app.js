'use strict'

const net = require('net')
const config = require('config')
const sockCol = require('./socket')

net.createServer(function (sock) {
  console.log(`CONNECTED: ${sock.remoteAddress}:${sock.remotePort}`)
  sock.on('data', function (data) {
    let msg = Buffer.from(data).toString('utf8')
    console.log(msg)
    let _msg = formatMsg(msg)
    if (!_msg || !_msg.uid) {
      return console.warn('ignored msg: ' + msg, _msg)
    }
    let sa = sockCol.ensureAgent(_msg.uid, sock)
    sa.handleMsg(_msg)
  })

  sock.on('close', function () {
    console.log(`CLOSED: ${sock.remoteAddress}:${sock.remotePort}`)
    sockCol.closeSock(sock)
  })
}).listen(config.sockport || 7000, function () {
  console.log('tcp server listening on:' + (config.sockport || 7000))
})

function formatMsg (msg) {
  if (!/^\~/.test(msg)) return null
  msg = msg.replace(/[^0-9a-zA-Z\#]+/g, '')
  let arr = msg.split('#')
  if (arr.length < 3) return null
  let formated = {
    uid: arr[0].slice(-12)
  }
  if (arr[3]) arr[3] = arr[3].toLowerCase()
  if (arr[2]) arr[2] = arr[2].toLowerCase()
  if (arr.length === 3) {
    if (arr[1] === 'check') {
      formated.isOk = true
      formated.type = 'CHECK_RES'
    } else if (arr[2] === 'ok') {
      formated.isOk = true
      formated.type = 'OP_RES'
    } else {
      return null
    }
  } else if (arr.length === 4) {
    if (arr[3] === 'ok' || arr[2] === 'ok') {
      formated.isOk = true
      formated.type = 'OP_RES'
    } else {
      if (['free', 'idle'].includes(arr[2])) {
        arr[2] = 'idle'
      } else if (arr[2] !== 'work') {
        arr[2] = 'fault'
      }
      arr[3] = +arr[3].slice(1)
      formated.wxTime = arr[3]
      formated.status = arr[2]
      formated.val = arr[4]
      formated.type = 'STATUS'
    }
  } else if (arr.length === 5) {
    if (['free', 'idle'].includes(arr[3])) {
      arr[3] = 'idle'
    } else if (arr[3] !== 'work') {
      arr[3] = 'fault'
    }
    arr[2] = +arr[2].slice(1)
    formated.wxTime = arr[2]
    formated.status = arr[3]
    formated.val = arr[4]
    formated.type = 'STATUS'
  } else {
    return null
  }
  return formated
}
