// pages/summary/summary.js
const { formatDate } = require('../../utils/formatter')
const { getMealsByDate, deleteMeal, getPairByPairId, updateUserGoals } = require('../../utils/api')
const config = require('../../utils/config')

const app = getApp()

// 对单人食物列表做宏量聚合
const sumMacros = (foods) => ({
  calories: foods.reduce((s, f) => s + (f.calories || 0), 0),
  protein:  foods.reduce((s, f) => s + (f.protein  || 0), 0),
  carbs:    foods.reduce((s, f) => s + (f.carbs    || 0), 0),
  fat:      foods.reduce((s, f) => s + (f.fat      || 0), 0),
})

Page({
  data: {
    currentDate: '',
    pairId:      '',
    inviteCode:  '',
    // 初始化为全零，避免 WXML 访问 null 报错
    me: { name: '我',  role: 'me', calories: 0, protein: 0, carbs: 0, fat: 0, calorieGoal: 2000, proteinGoal: 90, carbsGoal: 250, fatGoal: 60 },
    ta: { name: 'Ta', role: 'ta', calories: 0, protein: 0, carbs: 0, fat: 0, calorieGoal: 2000, proteinGoal: 90, carbsGoal: 250, fatGoal: 60 },
    foods: [],
    loading: false,
    goalEditing: false,
    goalInput: '',
  },

  onLoad() {
    // 只设置日期；数据由 onShow 加载（onLoad 后 onShow 必然触发）
    this.setData({ currentDate: formatDate(new Date()) })
  },

  onShow() {
    // 配对守卫：未配对则跳转 pairing
    app._initPromise.then(() => {
      if (!app.globalData.pairId) {
        wx.redirectTo({ url: '/pages/pairing/pairing' })
        return
      }
      // 每次页面可见时刷新：首次加载 + 从 record 页保存后切回来
      this.setData({ pairId: app.globalData.pairId || '' })
      // 邀请码只查一次，之后缓存在 data 里
      if (!this.data.inviteCode) {
        getPairByPairId(app.globalData.pairId)
          .then(res => {
            const code = res.data && res.data[0] && res.data[0].inviteCode
            if (code) this.setData({ inviteCode: code })
          })
          .catch(() => {})
      }
      const { currentDate } = this.data
      if (!currentDate) return
      this._loadData(currentDate)
    })
  },

  _loadData(dateStr) {
    this.setData({ loading: true })

    const pairId = app.globalData.pairId
    const myOpenid = app.globalData.openid
    console.log('[summary] _loadData', { dateStr, pairId, myOpenid })

    getMealsByDate(dateStr, pairId)
      .then((res) => {
        const allFoods = res.data || []
        console.log('[summary] query result', allFoods.length, allFoods)

        // 按当前用户拆分两人（不依赖 role 字段，防止角色混乱）
        const meFoods = allFoods.filter(f => f.userId === myOpenid)
        const taFoods = allFoods.filter(f => f.userId !== myOpenid)

        const myGoals = app.globalData.userProfile && app.globalData.userProfile.goals
        const me = {
          name: '我',
          role: 'me',
          ...config.goals.me,
          calorieGoal: (myGoals && myGoals.calorieGoal) || config.goals.me.calorieGoal || 2000,
          ...sumMacros(meFoods),
        }
        const ta = {
          name: 'Ta',
          role: 'ta',
          ...config.goals.ta,
          ...sumMacros(taFoods),
        }

        // 渲染时用当前用户视角覆写 user/userName，保证颜色和标签正确
        const foods = allFoods.map(f => ({
          id:        f._id,
          name:      f.name,
          calories:  f.calories,
          protein:   f.protein,
          carbs:     f.carbs,
          fat:       f.fat,
          imageUrl:  f.imageUrl || '',
          user:      f.userId === myOpenid ? 'me' : 'ta',
          userName:  f.userId === myOpenid ? '我' : 'Ta',
          time:      f.time,
          canDelete: f.userId === myOpenid,
        }))

        this.setData({ me, ta, foods, loading: false })
      })
      .catch((err) => {
        console.error('[summary] 读取数据失败', err)
        this.setData({ loading: false })
      })
  },

  onDeleteMeal(e) {
    const mealId = e.detail.id
    wx.showModal({
      title:        '删除这条记录？',
      content:      '删除后无法恢复',
      confirmText:  '删除',
      confirmColor: '#EB5757',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中…', mask: true })
        deleteMeal(mealId)
          .then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已删除', icon: 'success', duration: 1000 })
            this._loadData(this.data.currentDate)
          })
          .catch((err) => {
            wx.hideLoading()
            console.error('[summary] 删除失败', err)
            wx.showToast({ title: '删除失败，请重试', icon: 'none', duration: 2000 })
          })
      },
    })
  },

  onDateChange(e) {
    const { direction } = e.detail
    const [y, m, d] = this.data.currentDate.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    date.setDate(date.getDate() + direction)
    const newDate = formatDate(date)
    this.setData({ currentDate: newDate })
    this._loadData(newDate)
  },

  toggleGoalEdit() {
    this.setData({ goalEditing: !this.data.goalEditing, goalInput: '' })
  },

  onGoalInput(e) {
    this.setData({ goalInput: e.detail.value })
  },

  onSaveGoal() {
    const val = Number(this.data.goalInput)
    if (!val || val < 800 || val > 5000) {
      wx.showToast({ title: '请输入 800–5000 的数值', icon: 'none', duration: 1500 })
      return
    }
    const openid = app.globalData.openid
    const prevGoals = (app.globalData.userProfile && app.globalData.userProfile.goals) || {}
    const newGoals = { ...prevGoals, calorieGoal: val }
    wx.showLoading({ title: '保存中…', mask: true })
    updateUserGoals({ openid, goals: newGoals })
      .then(() => {
        wx.hideLoading()
        if (!app.globalData.userProfile) app.globalData.userProfile = {}
        app.globalData.userProfile.goals = newGoals
        this.setData({ goalEditing: false, goalInput: '', 'me.calorieGoal': val })
        wx.showToast({ title: '目标已更新', icon: 'success', duration: 1200 })
      })
      .catch(err => {
        wx.hideLoading()
        console.error('[summary] 保存目标失败', err)
        wx.showToast({ title: '保存失败，请重试', icon: 'none', duration: 2000 })
      })
  },
})

