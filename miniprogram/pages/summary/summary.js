// pages/summary/summary.js
const { formatDate } = require('../../utils/formatter')
const { getMealsByDate } = require('../../utils/api')
const config = require('../../utils/config')

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
    // 初始化为全零，避免 WXML 访问 null 报错
    me: { name: '我',  role: 'me', calories: 0, protein: 0, carbs: 0, fat: 0, calorieGoal: 2000, proteinGoal: 90, carbsGoal: 250, fatGoal: 60 },
    ta: { name: 'Ta', role: 'ta', calories: 0, protein: 0, carbs: 0, fat: 0, calorieGoal: 2000, proteinGoal: 90, carbsGoal: 250, fatGoal: 60 },
    foods: [],
    loading: false,
  },

  onLoad() {
    // 只设置日期；数据由 onShow 加载（onLoad 后 onShow 必然触发）
    this.setData({ currentDate: formatDate(new Date()) })
  },

  onShow() {
    // 每次页面可见时刷新：首次加载 + 从 record 页保存后切回来
    const { currentDate } = this.data
    if (!currentDate) return
    this._loadData(currentDate)
  },

  _loadData(dateStr) {
    this.setData({ loading: true })

    getMealsByDate(dateStr, config.pairId)
      .then((res) => {
        const allFoods = res.data || []

        // 按 userId 拆分两人
        const meFoods = allFoods.filter(f => f.userId === config.myUserId)
        const taFoods = allFoods.filter(f => f.userId === config.taUserId)

        // 聚合两人宏量数据（目标值来自 config.goals）
        const me = {
          name: config.myUserName,
          role: 'me',
          ...config.goals.me,
          ...sumMacros(meFoods),
        }
        const ta = {
          name: config.taUserName,
          role: 'ta',
          ...config.goals.ta,
          ...sumMacros(taFoods),
        }

        // 格式化为 food-list-item 需要的结构
        const foods = allFoods.map(f => ({
          id:       f._id,
          name:     f.name,
          calories: f.calories,
          protein:  f.protein,
          carbs:    f.carbs,
          fat:      f.fat,
          imageUrl: f.imageUrl || '',
          user:     f.role,
          userName: f.userName,
          time:     f.time,
        }))

        this.setData({ me, ta, foods, loading: false })
      })
      .catch((err) => {
        console.error('[summary] 读取数据失败', err)
        this.setData({ loading: false })
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
})

