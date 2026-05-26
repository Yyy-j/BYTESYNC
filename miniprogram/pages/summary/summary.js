// pages/summary/summary.js
const { formatDate } = require('../../utils/formatter')
const { getMealsByDate, deleteMeal, updateMeal, getPairByPairId, updateUserGoals } = require('../../utils/api')
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
    summaryMessage: { title: '', detail: '' },
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
          id:               f._id,
          name:             f.name,
          calories:         f.calories,
          protein:          f.protein,
          carbs:            f.carbs,
          fat:              f.fat,
          originalCalories: f.originalCalories ?? f.calories,
          originalProtein:  f.originalProtein  ?? f.protein,
          originalCarbs:    f.originalCarbs    ?? f.carbs,
          originalFat:      f.originalFat      ?? f.fat,
          imageUrl:         f.imageUrl || '',
          user:             f.userId === myOpenid ? 'me' : 'ta',
          userName:         f.userId === myOpenid ? '我' : 'Ta',
          time:             f.time,
          canDelete:        f.userId === myOpenid,
          canEdit:          f.userId === myOpenid,
        }))

        const summaryMessage = this.getSummaryMessage(me, ta)
        this.setData({ me, ta, foods, summaryMessage, loading: false })
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

  // ── 修改已记录卡路里 ─────────────────────────────────────
  onEditMeal(e) {
    const { id, originalCalories, originalProtein, originalCarbs, originalFat } = e.detail
    wx.showActionSheet({
      itemList: ['全部', '1/2', '1/3', '2/3'],
      success: (res) => {
        const ratios = [1, 0.5, 1/3, 2/3]
        const ratio = ratios[res.tapIndex]
        const updatedData = {
          calories: Math.round(originalCalories * ratio),
          protein:  Math.round(originalProtein  * ratio),
          carbs:    Math.round(originalCarbs    * ratio),
          fat:      Math.round(originalFat      * ratio),
        }
        wx.showLoading({ title: '保存中…', mask: true })
        updateMeal(id, updatedData)
          .then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已更新', icon: 'success', duration: 1000 })
            this._loadData(this.data.currentDate)
          })
          .catch((err) => {
            wx.hideLoading()
            console.error('[summary] 更新失败', err)
            wx.showToast({ title: '更新失败，请重试', icon: 'none', duration: 2000 })
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

  // ── 今日小结文案生成 ──────────────────────────────────────
  getSummaryMessage(me, ta) {
    const meRemain = (me.calorieGoal || 2000) - (me.calories || 0)
    const taRemain = (ta.calorieGoal || 2000) - (ta.calories || 0)

    // 两人都超标
    if (meRemain < 0 && taRemain < 0) {
      return {
        title:  '今天吃得有点丰盛，不过没关系 💛',
        detail: `你超出 ${Math.abs(meRemain)} kcal，Ta 超出 ${Math.abs(taRemain)} kcal，明天继续轻盈一点就好～`,
      }
    }
    // 只有我超标
    if (meRemain < 0) {
      return {
        title:  '今天整体不错，我这边稍微多了一点 💛',
        detail: `你超出 ${Math.abs(meRemain)} kcal，Ta 还差 ${Math.max(taRemain, 0)} kcal，明天继续平衡一下就好～`,
      }
    }
    // 只有 Ta 超标
    if (taRemain < 0) {
      return {
        title:  '今天整体不错，Ta 那边稍微多了一点 💛',
        detail: `你还差 ${Math.max(meRemain, 0)} kcal，Ta 超出 ${Math.abs(taRemain)} kcal，明天继续平衡一下就好～`,
      }
    }
    // 两人都离目标很远
    if (meRemain > 600 && taRemain > 600) {
      return {
        title:  '今天也和 Ta 好好吃饭了 🤍',
        detail: `你还差 ${meRemain} kcal，Ta 还差 ${taRemain} kcal，慢慢吃，不着急～`,
      }
    }
    // 两人都接近目标（差 0–200）
    if (meRemain >= 0 && meRemain <= 200 && taRemain >= 0 && taRemain <= 200) {
      return {
        title:  '今天吃得很稳，快接近目标啦 🌿',
        detail: `你只差 ${meRemain} kcal，Ta 只差 ${taRemain} kcal，今天状态很好！`,
      }
    }
    // 我接近、Ta 还差较多
    if (meRemain <= 200 && taRemain > 200) {
      return {
        title:  '我快到目标啦，Ta 再补一餐就好了 ✨',
        detail: `你只差 ${meRemain} kcal，Ta 还差 ${taRemain} kcal，一起加油～`,
      }
    }
    // Ta 接近、我还差较多
    if (taRemain <= 200 && meRemain > 200) {
      return {
        title:  'Ta 快到目标了，我再努努力 ✨',
        detail: `你还差 ${meRemain} kcal，Ta 只差 ${taRemain} kcal，继续加油哦～`,
      }
    }
    // 两人都差 200–600（进度中等）
    return {
      title:  '今天进度不错，再吃一餐就更完整啦 ✨',
      detail: `你还差 ${meRemain} kcal，Ta 还差 ${taRemain} kcal，继续加油哦！`,
    }
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

