// pages/record/record.js
const { addMeal, analyzeMeal } = require('../../utils/api')
const { getCurrentDate, getCurrentTime } = require('../../utils/time')

const app = getApp()

Page({
  data: {
    state:          'idle',    // 'idle' | 'loading' | 'result'
    tempImageUrl:   '',
    foodData:       null,
    loadingText:    '识别中…',
    loadingSubtext: '正在估算这份料理',
  },

  onLoad() {},

  // 配对守卫：未配对则跳转 pairing
  onShow() {
    app._initPromise.then(() => {
      if (!app.globalData.pairId) {
        wx.redirectTo({ url: '/pages/pairing/pairing' })
      }
    })
  },

  // 点击拍照按钮
  onCameraTap() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],   // 系统层面压缩，大幅减小体积
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({
          tempImageUrl:   tempFilePath,
          state:          'loading',
          loadingText:    '上传中…',
          loadingSubtext: '正在上传图片',
        })
        this._analyze(tempFilePath)
      },
      fail: () => {},
    })
  },

  // 上传 + AI 识别
  _analyze(tempFilePath) {
    // 双重压缩：sizeType 已做系统压缩，这里再降 quality 减小体积
    wx.compressImage({
      src:     tempFilePath,
      quality: 40,
      success: ({ tempFilePath: compressed }) => this._upload(compressed),
      fail:    ()                            => this._upload(tempFilePath),
    })
  },

  _upload(filePath) {
    const cloudPath = `meals/${Date.now()}.jpg`
    console.log('[record] uploading to', cloudPath)

    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (uploadRes) => {
        const fileID = uploadRes.fileID
        console.log('[record] upload ok', fileID)

        // 阶段 2：调用 AI 云函数
        this.setData({
          loadingText:    '识别中…',
          loadingSubtext: '正在估算这份料理',
        })

        analyzeMeal(fileID)
          .then(result => {
            if (!result.success) {
              throw new Error(result.error || 'AI 识别失败')
            }
            this.setData({
              foodData: {
                name:     result.name,
                calories: result.calories,
                protein:  result.protein,
                carbs:    result.carbs,
                fat:      result.fat,
                imageUrl: fileID,
              },
              state: 'result',
            })
          })
          .catch(err => {
            console.error('[record] AI 识别失败', err)
            wx.showToast({ title: '识别失败，请重试', icon: 'none', duration: 2000 })
            // 保留 tempImageUrl，用户可以重拍
            this.setData({ state: 'idle' })
          })
      },
      fail: (err) => {
        console.error('[record] 上传失败', JSON.stringify(err))
        wx.showToast({ title: '上传失败，请重试', icon: 'none', duration: 2000 })
        this.setData({ state: 'idle', tempImageUrl: '' })
      },
    })
  },

  // 记录这一餐 → 写入云数据库 meals collection
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
        console.error('[record] 保存失败', err)
        wx.showToast({ title: '保存失败，请重试', icon: 'none', duration: 2000 })
      })
  },

  // 重新拍摄
  onRetake() {
    this.setData({ state: 'idle', tempImageUrl: '', foodData: null })
    this.onCameraTap()
  },
})
