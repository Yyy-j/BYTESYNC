// pages/summary/summary.js
const { formatDate } = require('../../utils/formatter')

Page({
  data: {
    date: '',
    members: []
  },

  onLoad() {
    this.setData({ date: formatDate(new Date()) })
  },

  onShow() {
    // TODO: 拉取当日两人数据
  },

  onDateChange(e) {
    const { direction } = e.detail
    const d = new Date(this.data.date)
    d.setDate(d.getDate() + direction)
    this.setData({ date: formatDate(d) })
    // TODO: 重新拉取对应日期数据
  }
})
