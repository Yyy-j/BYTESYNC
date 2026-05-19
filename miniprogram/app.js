// app.js
const config = require('./utils/config')

App({
  globalData: {
    userInfo: null,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('[BiteSync] 请升级基础库至 2.2.3+ 以使用云开发')
      return
    }
    wx.cloud.init({
      // env 来自 utils/config.js，修改一处全局生效
      env: config.cloudEnvId,
      traceUser: true,
    })
  },
})

