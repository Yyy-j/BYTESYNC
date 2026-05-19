// utils/api.js — 云函数调用封装（后续对接微信云开发）

/**
 * 调用云函数
 * @param {string} name 云函数名称
 * @param {object} data 入参
 * @returns {Promise}
 */
const callCloudFunction = (name, data = {}) => {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: res => resolve(res.result),
      fail: err => reject(err)
    })
  })
}

module.exports = { callCloudFunction }
