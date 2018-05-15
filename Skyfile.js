/* global sneaky */
sneaky('ay', function () {
  this.description = 'Deploy to dev environment'
  this.user = 'root'
  this.host = '47.74.252.32'
  this.path = '~/server/rss/'
  this.filter = `
+ config
+ config/default.json
+ package.json
+ app.js
+ socket.js
+ yarn.lock
- *
`
  this.after('yarn && pm2 restart sock')
  this.overwrite = true
  this.nochdir = true
})
