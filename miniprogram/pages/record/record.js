// pages/record/record.js
Page({
  data: {
    meals: []
  },

  onLoad() {},

  onShow() {
    // TODO: 拉取今日记录
  },

  onCameraTap() {
    // TODO: 调起相机，识别食物
    wx.showToast({ title: '拍照功能开发中', icon: 'none' })
  }
})
