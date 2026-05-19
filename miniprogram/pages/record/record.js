// pages/record/record.js
Page({
  data: {
    state: 'idle',       // 'idle' | 'loading' | 'result'
    tempImageUrl: '',
    foodData: null,
  },

  onLoad() {},

  // 点击拍照按钮
  onCameraTap() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempImageUrl = res.tempFiles[0].tempFilePath
        this.setData({ tempImageUrl, state: 'loading' })
        this._mockAnalyze(tempImageUrl)
      },
      fail: () => {
        // 用户取消，不处理
      }
    })
  },

  // 模拟 AI 识别（mock 数据）
  _mockAnalyze(imageUrl) {
    setTimeout(() => {
      this.setData({
        foodData: {
          name: '牛肉便当',
          calories: 680,
          protein: 32,
          fat: 24,
          carbs: 78,
          imageUrl,
        },
        state: 'result',
      })
    }, 1500)
  },

  // 记录这一餐
  onSave() {
    wx.showToast({ title: '已记录', icon: 'success', duration: 1200 })
    setTimeout(() => {
      this.setData({ state: 'idle', tempImageUrl: '', foodData: null })
    }, 1200)
  },

  // 重新拍摄
  onRetake() {
    this.setData({ state: 'idle', tempImageUrl: '', foodData: null })
  },
})
