// pages/record/record.js
const { addMeal } = require('../../utils/api')
const { getCurrentDate, getCurrentTime } = require('../../utils/time')

const app = getApp()

Page({
  data: {
    state: 'idle',
    tempImageUrl: '',
    foodData: null,
  },

  onLoad() {},

  onShow() {
    app._initPromise.then(() => {
      if (!app.globalData.pairId) {
        wx.redirectTo({ url: '/pages/pairing/pairing' })
      }
    })
  },

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
      fail: () => {},
    })
  },

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

  onSave() {
    const { foodData } = this.data
    const { openid, userProfile, pairId } = app.globalData

    if (!openid || !userProfile || !pairId) {
      console.warn('[record] globalData not ready', { openid, userProfile, pairId })
      wx.showToast({ title: '初始化未完成，请稍后重试', icon: 'none', duration: 2000 })
      return
    }

    wx.showLoading({ title: '保存中…', mask: true })

    addMeal({
      pairId,
      userId:    openid,
      userName:  userProfile.userName,
      role:      userProfile.role,
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
        console.error('[record] save failed', err)
        wx.showToast({ title: '保存失败，请重试', icon: 'none', duration: 2000 })
      })
  },

  onRetake() {
    this.setData({ state: 'idle', tempImageUrl: '', foodData: null })
    this.onCameraTap()
  },
})
