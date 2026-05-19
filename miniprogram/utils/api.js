// utils/api.js — 数据库操作封装

/**
 * 新增一条饮食记录
 * @param {object} mealData  符合 meals collection 结构的对象
 * @returns {Promise}
 */
const addMeal = (mealData) => {
  const db = wx.cloud.database()
  return db.collection('meals').add({ data: mealData })
}

/**
 * 查询指定日期、配对的所有饮食记录（按时间升序）
 * @param {string} dateStr  'YYYY-MM-DD'
 * @param {string} pairId
 * @returns {Promise<{data: Array}>}
 */
const getMealsByDate = (dateStr, pairId) => {
  const db = wx.cloud.database()
  return db.collection('meals')
    .where({ date: dateStr, pairId })
    .orderBy('time', 'asc')
    .limit(100)
    .get()
}

/**
 * 调用云函数（保留备用）
 */
const callCloudFunction = (name, data = {}) => {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: res => resolve(res.result),
      fail: err => reject(err),
    })
  })
}

module.exports = { addMeal, getMealsByDate, callCloudFunction }

