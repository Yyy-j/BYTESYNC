// pages/training/training.js — 训练首页
// 展示当前周计划和打卡功能，支持日期切换

const { getTrainingTemplate, getOrCreateTrainingWeek } = require('../../utils/training-api')
const { getWeekId, getDayIndex, formatLocalDate } = require('../../utils/training-time')

const app = getApp()

// 星期显示文案
const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

Page({
  data: {
    // 页面状态：loading | empty | loaded | error
    state: 'loading',
    // 错误信息
    errorMsg: '',
    // 模板数据
    template: null,
    // 当前周计划
    weekPlan: null,
    weekDocId: '',
    // 日期切换
    dayNames: DAY_NAMES,
    selectedDayIndex: 0,  // 0=周一, 6=周日
    todayDayIndex: 0,
    // 当前日期的训练项目
    currentDayExercises: [],
    // 是否刷新中
    isRefreshing: false
  },

  onLoad() {
    this._loadData()
  },

  onShow() {
    // 每次显示页面时刷新数据，确保同步最新的模板变更
    if (this.data.state !== 'loading') {
      this._loadData()
    }
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    if (this.data.isRefreshing) return
    this.setData({ isRefreshing: true })
    try {
      await this._loadData()
    } finally {
      this.setData({ isRefreshing: false })
      wx.stopPullDownRefresh()
    }
  },

  /**
   * 加载数据：模板和周计划
   */
  async _loadData() {
    this.setData({ state: 'loading', errorMsg: '' })

    try {
      // 等待 app 初始化完成
      await app._initPromise

      // 获取今天是周几
      const todayDayIndex = getDayIndex(new Date())

      // 获取模板
      const templateResult = await getTrainingTemplate()
      
      if (!templateResult.template) {
        // 无模板
        this.setData({
          state: 'empty',
          template: null,
          todayDayIndex,
          selectedDayIndex: todayDayIndex
        })
        return
      }

      // 有模板，获取或创建当前周计划
      const template = templateResult.template
      const weekResult = await getOrCreateTrainingWeek()
      const weekPlan = weekResult.week

      this.setData({
        state: 'loaded',
        template,
        weekPlan,
        weekDocId: weekPlan._id,
        todayDayIndex,
        selectedDayIndex: todayDayIndex
      })

      // 更新当日训练项目
      this._updateCurrentDayExercises(todayDayIndex)

    } catch (err) {
      console.error('[training] 加载数据失败', err)
      this.setData({
        state: 'error',
        errorMsg: err.message || '加载失败'
      })
    }
  },

  /**
   * 更新当前日期的训练项目
   */
  _updateCurrentDayExercises(dayIndex) {
    const { weekPlan } = this.data
    if (!weekPlan || !weekPlan.days) {
      this.setData({ currentDayExercises: [] })
      return
    }

    const dayPlan = weekPlan.days.find(d => d.dayIndex === dayIndex)
    const exercises = dayPlan?.exercises || []

    this.setData({ currentDayExercises: exercises })
  },

  /**
   * 切换日期
   */
  onDayChange(e) {
    const dayIndex = parseInt(e.currentTarget.dataset.day, 10)
    if (dayIndex === this.data.selectedDayIndex) return

    this.setData({ selectedDayIndex: dayIndex })
    this._updateCurrentDayExercises(dayIndex)
  },

  /**
   * 重试加载
   */
  onRetry() {
    this._loadData()
  },

  /**
   * 跳转到模板编辑页
   */
  onEditTemplate() {
    this._needRefresh = true
    const hasTemplate = this.data.template ? '1' : '0'
    wx.navigateTo({
      url: `/pages/training-template/training-template?hasTemplate=${hasTemplate}`
    })
  },

  /**
   * 跳转到训练历史页
   */
  onGoHistory() {
    wx.navigateTo({
      url: '/pages/training-history/training-history'
    })
  },

  /**
   * 打卡成功回调，刷新周计划
   */
  async onCheckinSuccess() {
    try {
      const weekResult = await getOrCreateTrainingWeek()
      const weekPlan = weekResult.week
      this.setData({ weekPlan, weekDocId: weekPlan._id })
      this._updateCurrentDayExercises(this.data.selectedDayIndex)
    } catch (err) {
      console.error('[training] 刷新周计划失败', err)
    }
  }
})
