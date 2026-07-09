// components/training-exercise-card/training-exercise-card.js — 训练打卡组件
// 显示单个动作的打卡进度和已完成组详情

const { incrementExerciseSet, createTrainingRequestId } = require('../../utils/training-api')

Component({
  properties: {
    // 训练项目数据
    exercise: {
      type: Object,
      value: {}
    },
    // 周计划文档 ID
    weekDocId: {
      type: String,
      value: ''
    }
  },

  data: {
    // 表单数据
    inputWeight: '',
    inputReps: '',
    inputRpe: '',
    inputRemark: '',
    // 是否展开输入框
    showInput: false,
    // 是否提交中
    isSubmitting: false,
    // 当前请求 ID（用于幂等）
    currentRequestId: ''
  },

  observers: {
    // 监听 exercise 变化，初始化输入默认值
    'exercise': function(exercise) {
      if (!exercise) return
      // strength 默认重量和次数取目标值
      const isStrength = exercise.itemType !== 'cardio'
      this.setData({
        inputWeight: isStrength ? String(exercise.targetWeight || 0) : '',
        inputReps: isStrength ? String(exercise.targetReps || 12) : ''
      })
    }
  },

  methods: {
    /**
     * 展开/收起输入框
     */
    toggleInput() {
      this.setData({ showInput: !this.data.showInput })
    },

    /**
     * 输入重量
     */
    onWeightInput(e) {
      this.setData({ inputWeight: e.detail.value })
    },

    /**
     * 输入次数
     */
    onRepsInput(e) {
      this.setData({ inputReps: e.detail.value })
    },

    /**
     * 输入 RPE
     */
    onRpeInput(e) {
      this.setData({ inputRpe: e.detail.value })
    },

    /**
     * 输入备注
     */
    onRemarkInput(e) {
      this.setData({ inputRemark: e.detail.value })
    },

    /**
     * 打卡 +1 组
     */
    async onCheckin() {
      // 防止连续点击
      if (this.data.isSubmitting) return

      const { exercise, weekDocId, inputWeight, inputReps, inputRpe, inputRemark } = this.data

      // 检查是否已达目标
      if (exercise.completedSets >= exercise.targetSets) {
        wx.showToast({ title: '已完成全部组数', icon: 'none' })
        return
      }

      // 生成或复用 requestId（幂等）
      let requestId = this.data.currentRequestId
      if (!requestId) {
        requestId = createTrainingRequestId()
        this.setData({ currentRequestId: requestId })
      }

      this.setData({ isSubmitting: true })

      try {
        const params = {
          weekDocId,
          weekItemId: exercise.weekItemId,
          requestId
        }

        // 解析输入值
        const weight = parseFloat(inputWeight)
        const reps = parseInt(inputReps, 10)
        const rpe = parseInt(inputRpe, 10)

        if (!isNaN(weight)) params.weight = weight
        if (!isNaN(reps)) params.reps = reps
        if (!isNaN(rpe) && rpe >= 1 && rpe <= 10) params.rpe = rpe
        if (inputRemark.trim()) params.remark = inputRemark.trim()

        const result = await incrementExerciseSet(params)

        // 成功后清除 requestId，准备下一组
        this.setData({
          currentRequestId: '',
          inputRpe: '',
          inputRemark: '',
          showInput: false
        })

        // 通知页面刷新
        this.triggerEvent('checkinSuccess', { result })

        // 显示提示
        if (result.duplicate) {
          wx.showToast({ title: '重复请求，已忽略', icon: 'none' })
        } else {
          wx.showToast({ title: '打卡成功', icon: 'success' })
        }

      } catch (err) {
        console.error('[training-exercise-card] 打卡失败', err)
        
        // 错误处理
        if (err.code === 'TRAINING_TARGET_REACHED') {
          // 已达目标，刷新数据
          this.setData({ currentRequestId: '' })
          this.triggerEvent('checkinSuccess', {})
        }
        
        wx.showToast({ title: err.message || '打卡失败', icon: 'none' })
      } finally {
        this.setData({ isSubmitting: false })
      }
    },

    /**
     * 格式化组详情显示
     */
    formatSetDetail(detail) {
      if (!detail) return ''
      const parts = []
      if (detail.weight !== undefined) parts.push(`${detail.weight}kg`)
      if (detail.reps !== undefined) parts.push(`× ${detail.reps}`)
      if (detail.rpe !== undefined) parts.push(`RPE ${detail.rpe}`)
      return parts.join(' ')
    }
  }
})
