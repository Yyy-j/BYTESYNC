// pages/summary/summary.js
const { formatDate } = require('../../utils/formatter')

// ── Mock 数据（Step 6 替换为云数据库查询）──
const MOCK_DAILY = {
  me: {
    name: '我',
    role: 'me',
    calories: 1450,
    calorieGoal: 2000,
    protein: 68,
    proteinGoal: 90,
    carbs: 180,
    carbsGoal: 250,
    fat: 42,
    fatGoal: 60,
  },
  ta: {
    name: 'Ta',
    role: 'ta',
    calories: 1680,
    calorieGoal: 2000,
    protein: 80,
    proteinGoal: 90,
    carbs: 210,
    carbsGoal: 250,
    fat: 50,
    fatGoal: 60,
  },
  foods: [
    { id: '1', name: '燕麦粥',     calories: 280, protein: 12, carbs: 48, fat: 6,  imageUrl: '', user: 'me', userName: '我', time: '08:20' },
    { id: '2', name: '鸡胸肉沙拉', calories: 320, protein: 38, carbs: 12, fat: 14, imageUrl: '', user: 'ta', userName: 'Ta', time: '12:10' },
    { id: '3', name: '牛肉便当',   calories: 680, protein: 32, carbs: 78, fat: 24, imageUrl: '', user: 'me', userName: '我', time: '12:30' },
    { id: '4', name: '水果酸奶',   calories: 190, protein: 8,  carbs: 32, fat: 4,  imageUrl: '', user: 'ta', userName: 'Ta', time: '15:00' },
    { id: '5', name: '红烧肉饭',   calories: 720, protein: 28, carbs: 88, fat: 32, imageUrl: '', user: 'ta', userName: 'Ta', time: '18:30' },
  ],
}

Page({
  data: {
    currentDate: '',
    me: null,
    ta: null,
    foods: [],
  },

  onLoad() {
    // mock 数据只在 onLoad 设置一次，避免每次切日期触发 summary-card/macro-bar 的
    // observer 链（summary-card×2 + macro-bar×2 共 5 次 setData，会导致 timeout）
    this.setData({
      currentDate: formatDate(new Date()),
      me: MOCK_DAILY.me,
      ta: MOCK_DAILY.ta,
      foods: MOCK_DAILY.foods,
    })
  },

  onDateChange(e) {
    const { direction } = e.detail
    // 用 new Date(y, m-1, d) 构造，避免 ISO 字符串解析时区歧义
    const [y, m, d] = this.data.currentDate.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    date.setDate(date.getDate() + direction)
    // 只更新日期文本，不触碰 me/ta/foods，避免级联 setData
    this.setData({ currentDate: formatDate(date) })
    // TODO Step 6: 按 currentDate 从云数据库 meals collection 查询，
    //              再 setData({ me, ta, foods }) 刷新两人数据
  },
})
