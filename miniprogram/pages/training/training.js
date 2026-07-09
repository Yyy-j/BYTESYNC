// pages/training/training.js — 训练首页
// 展示训练模板状态，支持创建或编辑模板

const { getTrainingTemplate } = require('../../utils/training-api')

const app = getApp()

Page({
  data: {
    // 页面状态：loading | empty | loaded | error
    state: 'loading',
    // 模板数据
    template: null,
    // 错误信息
    errorMsg: ''
  },

  onLoad() {
    // 等待 app 初始化完成后加载模板
    this._loadTemplate()
  },

  onShow() {
    // 从编辑页返回时刷新
    if (this._needRefresh) {
      this._needRefresh = false
      this._loadTemplate()
    }
  },

  /**
   * 加载训练模板
   */
  async _loadTemplate() {
    this.setData({ state: 'loading', errorMsg: '' })

    try {
      // 等待 app 初始化完成
      await app._initPromise

      // 获取模板
      const result = await getTrainingTemplate()
      
      if (result.template) {
        // 有模板
        this.setData({
          state: 'loaded',
          template: result.template
        })
      } else {
        // 无模板
        this.setData({
          state: 'empty',
          template: null
        })
      }
    } catch (err) {
      console.error('[training] 加载模板失败', err)
      this.setData({
        state: 'error',
        errorMsg: err.message || '加载失败'
      })
    }
  },

  /**
   * 重试加载
   */
  onRetry() {
    this._loadTemplate()
  },

  /**
   * 跳转到模板编辑页
   */
  onEditTemplate() {
    // 标记需要刷新
    this._needRefresh = true
    
    // 传递是否已有模板的信息
    const hasTemplate = this.data.template ? '1' : '0'
    wx.navigateTo({
      url: `/pages/training-template/training-template?hasTemplate=${hasTemplate}`
    })
  }
})
