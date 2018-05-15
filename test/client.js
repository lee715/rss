const config = require('config')
const net = require('net')

module.exports = class Client {
  constructor (uid) {
    this.uid = uid
    this.c = net.createConnection({
      port: config.sockport || 7000,
      host: '47.74.252.32'
    }, () => {
      this.sayOk()
    })
    this.c.on('data', (data) => {
      this.handleMsg(data.toString())
    })
    this.status = 'idle'
    this.heart()
  }

  sayOk () {
    this.c.write(`~${this.uid}#0000#OK!\n`)
  }

  sayStatus () {
    this.c.write(`~${this.uid}#0000#${this.status}#0000!\n`)
  }

  sayCheckOk () {
    this.c.write(`~${this.uid}#check#ok!\n`)
  }

  sayWorkWithTime (time) {
    this.status = 'work'
    setTimeout(() => {
      this.status = 'idle'
    }, time * 60 * 1000)
    this.sayOk()
  }

  handleMsg (msg) {
    console.log('recived: ', msg)
    if (!/^~/.test(msg)) return null
    msg = msg.replace(/[^0-9a-zA-Z#]+/g, '')
    let arr = msg.split('#')
    let action
    switch (arr.length) {
      case 2:
        action = arr[1]
        if (action === 'check') {
          this.sayCheckOk()
        }
        break
      case 3:
        if (arr[1] === 'startup') {
          this.sayWorkWithTime(+arr[2])
        }
        break
      default:
        console.log('unknown msg', msg)
    }
  }

  heart () {
    setInterval(() => {
      this.sayStatus()
    }, 10 * 1000)
  }
}
