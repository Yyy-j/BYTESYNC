// pages/record/record.js
const { addMeal, addMeals, analyzeMeal, analyzeMealByText, deleteCloudFile, getUsersByPairId } = require('../../utils/api')
const { getCurrentDate, getCurrentTime } = require('../../utils/time')

const app = getApp()

Page({
  data: {
    state:          'idle',    // 'idle' | 'loading' | 'result'
    tempImageUrl:   '',
    foodData:       null,
    baseFoodData:   null,
    portionRatio:   1,
    aiHint:         '',
    loadingText:    '识别中…',
    loadingSubtext: '正在估算这份料理',
    loadingProgress: 0,
    manualExpanded: false,
    manualForm: { name: '', calories: '', protein: '', carbs: '', fat: '' },
    shareMode:    'solo',
    sharePreview: { meCalories: 0, taCalories: 0 },
  },

  onLoad() {},

  onHintInput(e) {
    this.setData({ aiHint: e.detail.value })
  },

  // ── 手动记录 ──────────────────────────────
  toggleManualForm() {
    this.setData({ manualExpanded: !this.data.manualExpanded })
  },

  onManualInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`manualForm.${field}`]: e.detail.value })
  },

  onManualSave() {
    const { name, calories, protein, carbs, fat } = this.data.manualForm
    const cal = Number(calories)
    if (!calories || cal <= 0) {
      wx.showToast({ title: '请填写卡路里', icon: 'none', duration: 1500 })
      return
    }
    const foodData = {
      name:     name.trim() || '手动记录',
      calories: Math.round(cal),
      protein:  Math.round(Number(protein) || 0),
      carbs:    Math.round(Number(carbs)   || 0),
      fat:      Math.round(Number(fat)     || 0),
      imageUrl: '',
      hint:     '',
      source:   'manual',
    }
    this.setData({
      baseFoodData:   foodData,
      foodData:       foodData,
      portionRatio:   1,
      state:          'result',
      manualExpanded: false,
    })
  },
  // ── 共享逻辑辅助 ─────────────────────────────────
  _getShareRatios(mode) {
    const map = { solo: [1, 0], half: [0.5, 0.5], me_1_3: [1/3, 2/3], me_2_3: [2/3, 1/3] }
    return map[mode] || [1, 0]
  },

  _calcSharePreview(calories, mode) {
    const [me, ta] = this._getShareRatios(mode)
    return { meCalories: Math.round(calories * me), taCalories: Math.round(calories * ta) }
  },

  _buildMeal(ratio, foodData, userId, userName, role, pairId, shareMode, sharedMealId) {
    return {
      pairId, userId, userName, role,
      name:         foodData.name,
      calories:     Math.round(foodData.calories * ratio),
      protein:      Math.round(foodData.protein  * ratio),
      carbs:        Math.round(foodData.carbs    * ratio),
      fat:          Math.round(foodData.fat      * ratio),
      imageUrl:     foodData.imageUrl  || '',
      hint:         foodData.hint      || '',
      source:       foodData.source    || 'ai',
      portionRatio: this.data.portionRatio,
      shareMode,
      sharedMealId: sharedMealId || '',
      date:         getCurrentDate(),
      time:         getCurrentTime(),
      createdAt:    new Date(),
    }
  },

  onShareModeChange(e) {
    const clicked = e.currentTarget.dataset.mode
    const newMode = clicked === 'solo' ? 'solo'
      : (this.data.shareMode === 'solo' ? 'half' : this.data.shareMode)
    const cal = (this.data.foodData && this.data.foodData.calories) || 0
    this.setData({ shareMode: newMode, sharePreview: this._calcSharePreview(cal, newMode) })
  },

  onSplitTap(e) {
    const mode = e.currentTarget.dataset.mode
    const cal  = (this.data.foodData && this.data.foodData.calories) || 0
    this.setData({ shareMode: mode, sharePreview: this._calcSharePreview(cal, mode) })
  },
  // 配对守卫：未配对则跳转 pairing
  onShow() {
    app._initPromise.then(() => {
      if (!app.globalData.pairId) {
        wx.redirectTo({ url: '/pages/pairing/pairing' })
      }
    })
  },

  // 文字描述直接识别
  onTextAnalyze() {
    const hint = (this.data.aiHint || '').trim()
    if (!hint) {
      wx.showToast({ title: '请输入食物描述', icon: 'none', duration: 1500 })
      return
    }
    this.setData({
      state:          'loading',
      tempImageUrl:   '',
      loadingText:    '查询中…',
      loadingSubtext: '正在估算这份料理',
      loadingProgress: 60,
    })
    analyzeMealByText(hint)
      .then(result => {
        if (!result.success) throw new Error(result.error || '查询失败')
        const originalFoodData = {
          name:            result.name,
          calories:        result.calories,
          protein:         result.protein,
          carbs:           result.carbs,
          fat:             result.fat,
          imageUrl:        '',
          previewImageUrl: '',
          hint,
          source:          'text',
        }
        this.setData({ baseFoodData: originalFoodData, foodData: originalFoodData, portionRatio: 1, state: 'result' })
      })
      .catch(err => {
        console.error('[record] 文字识别失败', err)
        wx.showToast({ title: '查询失败，请重试', icon: 'none', duration: 2000 })
        this.setData({ state: 'idle' })
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
          loadingProgress: 30,
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
          loadingProgress: 75,
        })

        analyzeMeal(fileID, this.data.aiHint)
          .then(result => {
            if (!result.success) {
              throw new Error(result.error || 'AI 识别失败')
            }
            // 识别成功后删除云存储临时文件（不阻塞主流程）
            deleteCloudFile(fileID).catch(err => console.warn('[record] 删除临时图片失败', err))
            const originalFoodData = {
              name:            result.name,
              calories:        result.calories,
              protein:         result.protein,
              carbs:           result.carbs,
              fat:             result.fat,
              imageUrl:        '',
              previewImageUrl: this.data.tempImageUrl,
              hint:            this.data.aiHint,
              source:          'ai',
            }
            this.setData({
              baseFoodData: originalFoodData,
              foodData:     originalFoodData,
              portionRatio: 1,
              state:        'result',
            })
          })
          .catch(err => {
            // 识别失败也尝试删除云存储文件
            deleteCloudFile(fileID).catch(e => console.warn('[record] 删除临时图片失败', e))
            console.error('[record] AI 识别失败', err)
            wx.showToast({ title: '识别失败，请重试', icon: 'none', duration: 2000 })
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

  // 快捷比例调整
  onRatioTap(e) {
    const base  = this.data.baseFoodData
    const ratio = Number(e.currentTarget.dataset.ratio)
    const newFoodData = {
      ...base,
      calories: Math.round(base.calories * ratio),
      protein:  Math.round(base.protein  * ratio),
      carbs:    Math.round(base.carbs    * ratio),
      fat:      Math.round(base.fat      * ratio),
    }
    this.setData({
      portionRatio: ratio,
      foodData:     newFoodData,
      sharePreview: this._calcSharePreview(newFoodData.calories, this.data.shareMode),
    })
  },

  // 记录这一餐 → 写入云数据库 meals collection
  onSave() {
    const { foodData, shareMode } = this.data
    const { openid, userProfile, pairId } = app.globalData

    if (!openid || !userProfile || !pairId) {
      console.warn('[record] globalData not ready', { openid, userProfile, pairId })
      wx.showToast({ title: '初始化未完成，请稍后重试', icon: 'none', duration: 2000 })
      return
    }

    wx.showLoading({ title: '保存中…', mask: true })

    const [meRatio, taRatio] = this._getShareRatios(shareMode)
    const sharedMealId = shareMode !== 'solo' ? 'shared_' + Date.now() : ''
    const myMeal = this._buildMeal(meRatio, foodData, openid, userProfile.userName, userProfile.role, pairId, shareMode, sharedMealId)

    const doSave = shareMode === 'solo'
      ? addMeal(myMeal)
      : getUsersByPairId(pairId).then(res => {
          const ta = (res.data || []).find(u => u.openid !== openid)
          if (!ta) throw new Error('找不到配对用户')
          const taMeal = this._buildMeal(taRatio, foodData, ta.openid, ta.userName, ta.role, pairId, shareMode, sharedMealId)
          return addMeals([myMeal, taMeal])
        })

    doSave
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已记录', icon: 'success', duration: 1200 })
        setTimeout(() => {
          this.setData({
            state: 'idle', tempImageUrl: '', foodData: null,
            baseFoodData: null, portionRatio: 1, aiHint: '',
            shareMode: 'solo', sharePreview: { meCalories: 0, taCalories: 0 },
            manualExpanded: false,
            manualForm: { name: '', calories: '', protein: '', carbs: '', fat: '' },
          })
        }, 1200)
      })
      .catch((err) => {
        wx.hideLoading()
        console.error('[record] 保存失败', err)
        wx.showToast({ title: '保存失败，请重试', icon: 'none', duration: 2000 })
      })
  },

  // 重新拍摄（保留 aiHint，用户可能只是照片拍错了）
  onRetake() {
    this.setData({
      state: 'idle', tempImageUrl: '', foodData: null,
      baseFoodData: null, portionRatio: 1,
      shareMode: 'solo', sharePreview: { meCalories: 0, taCalories: 0 },
      manualExpanded: false,
      manualForm: { name: '', calories: '', protein: '', carbs: '', fat: '' },
    })
    this.onCameraTap()
  },
})
