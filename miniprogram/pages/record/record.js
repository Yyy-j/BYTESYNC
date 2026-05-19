// pages/record/record.js
const { addMeal } = require('../../utils/api')
const { getCurrentDate, getCurrentTime } = require('../../utils/time')
const config = require('../../utils/config')

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

  // 模拟 AI 识别（Step 7+ 接 AI 后替换）
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

  // 记录这一餐 → 写入云数据库 meals collection
  onSave() {
    const { foodData } = this.data

    wx.showLoading({ title: '保存中…', mask: true })

    addMeal({
      pairId:    config.pairId,
      userId:    config.myUserId,
      userName:  config.myUserName,
      role:      'me',
      name:      foodData.name,
      calories:  foodData.calories,
      protein:   foodData.protein,
      carbs:     foodData.carbs,
      fat:       foodData.fat,
      imageUrl:  foodData.imageUrl || '',
      date:      getCurrentDate(),
      time:      getCurrentTime(),
      createdAt: new Date(),
    })
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已记录', icon: 'success', duration: 1200 })
        setTimeout(() => {
          this.setData({ state: 'idle', tempImageUrl: '', foodData: null })
        }, 1200)
      })
      .catch((err) => {
        wx.hideLoading()
        console.error('[record] 保存失败', err)
        wx.showToast({ title: '保存失败，请重试', icon: 'none', duration: 2000 })
        // 保留 result 状态，让用户可以重试
      })
  },

  // 重新拍摄：重置状态后立即重新打开相机
  onRetake() {
    this.setData({ state: 'idle', tempImageUrl: '', foodData: null })
    this.onCameraTap()
  },
})

