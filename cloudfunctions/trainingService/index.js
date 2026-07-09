// cloudfunctions/trainingService/index.js — 训练功能云函数主入口
// 所有训练相关的 API 请求都通过这个云函数处理

const cloud = require('wx-server-sdk')
const domain = require('./lib/domain')
const validation = require('./lib/validation')

const { TRAINING_ERRORS } = validation

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// ═══════════════════════════════════════════════════════════════
// Action 处理器映射
// ═══════════════════════════════════════════════════════════════

const handlers = {
  // 模板相关
  getTemplate: async (openid, data) => {
    return domain.getTemplate(db, openid)
  },
  
  createTemplate: async (openid, data) => {
    return domain.createTemplate(db, openid, data.days)
  },
  
  updateTemplate: async (openid, data) => {
    return domain.updateTemplate(db, openid, data.days)
  },
  
  // 周计划相关
  getOrCreateWeek: async (openid, data) => {
    return domain.getOrCreateWeek(db, openid, data.weekId)
  },
  
  getWeekHistory: async (openid, data) => {
    return domain.getWeekHistory(db, openid, data.limit, data.offset)
  },
  
  // 打卡相关
  incrementSet: async (openid, data) => {
    return domain.incrementSet(
      db, 
      openid, 
      data.weekId, 
      data.dayIndex, 
      data.itemId, 
      {
        requestId: data.requestId,
        weight: data.weight,
        reps: data.reps,
        rpe: data.rpe,
        remark: data.remark
      }
    )
  },
  
  updateSetDetail: async (openid, data) => {
    return domain.updateSetDetail(
      db,
      openid,
      data.weekId,
      data.dayIndex,
      data.itemId,
      data.setNumber,
      {
        weight: data.weight,
        reps: data.reps,
        rpe: data.rpe,
        remark: data.remark
      }
    )
  },
  
  // 自定义动作相关
  getCustomExercises: async (openid, data) => {
    return domain.getCustomExercises(db, openid)
  },
  
  createCustomExercise: async (openid, data) => {
    return domain.createCustomExercise(db, openid, {
      name: data.name,
      itemType: data.itemType,
      defaultSets: data.defaultSets,
      defaultReps: data.defaultReps,
      defaultWeight: data.defaultWeight,
      videoLinks: data.videoLinks
    })
  },
  
  updateCustomExercise: async (openid, data) => {
    return domain.updateCustomExercise(db, openid, data.exerciseId, {
      name: data.name,
      itemType: data.itemType,
      defaultSets: data.defaultSets,
      defaultReps: data.defaultReps,
      defaultWeight: data.defaultWeight,
      videoLinks: data.videoLinks
    })
  },
  
  deleteCustomExercise: async (openid, data) => {
    return domain.deleteCustomExercise(db, openid, data.exerciseId)
  },
  
  // 视频相关
  addVideo: async (openid, data) => {
    return domain.addVideo(
      db,
      openid,
      data.weekId,
      data.dayIndex,
      data.itemId,
      { title: data.title, url: data.url }
    )
  },
  
  updateVideo: async (openid, data) => {
    return domain.updateVideo(
      db,
      openid,
      data.weekId,
      data.dayIndex,
      data.itemId,
      data.videoIndex,
      { title: data.title, url: data.url }
    )
  },
  
  deleteVideo: async (openid, data) => {
    return domain.deleteVideo(
      db,
      openid,
      data.weekId,
      data.dayIndex,
      data.itemId,
      data.videoIndex
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// 云函数入口
// ═══════════════════════════════════════════════════════════════

exports.main = async (event, context) => {
  // 从微信服务端获取 openid，确保安全性
  const { OPENID } = cloud.getWXContext()
  
  if (!OPENID) {
    return {
      success: false,
      error: TRAINING_ERRORS.UNAUTHORIZED
    }
  }
  
  const { action, ...data } = event
  
  // 检查 action 是否存在
  if (!action || typeof action !== 'string') {
    return {
      success: false,
      error: TRAINING_ERRORS.INVALID_INPUT
    }
  }
  
  // 查找对应的处理器
  const handler = handlers[action]
  
  if (!handler) {
    return {
      success: false,
      error: {
        code: 'TRAINING_UNKNOWN_ACTION',
        message: `未知的操作: ${action}`
      }
    }
  }
  
  try {
    // 执行处理器
    const result = await handler(OPENID, data)
    return result
  } catch (err) {
    console.error(`[trainingService] ${action} error:`, err)
    return {
      success: false,
      error: {
        code: 'TRAINING_INTERNAL_ERROR',
        message: err.message || '服务器内部错误'
      }
    }
  }
}
