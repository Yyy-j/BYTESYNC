// utils/training-api.js — 训练功能前端 API
// 封装所有训练相关的云函数调用

const { callCloudFunction } = require('./api')
const { getWeekId } = require('./training-time')

// 云函数名称
const CLOUD_FUNCTION = 'trainingService'

/**
 * 调用训练云函数
 * @param {string} action - 操作名称
 * @param {Object} data - 请求数据
 */
const callTrainingService = (action, data = {}) => {
  return callCloudFunction(CLOUD_FUNCTION, { action, ...data })
}

// ═══════════════════════════════════════════════════════════════
// 请求 ID 生成
// ═══════════════════════════════════════════════════════════════

/**
 * 生成唯一的请求 ID（用于幂等性）
 * @returns {string} 唯一标识符
 */
const createTrainingRequestId = () => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `tr_${timestamp}_${random}`
}

// ═══════════════════════════════════════════════════════════════
// 模板相关 API
// ═══════════════════════════════════════════════════════════════

/**
 * 获取用户训练模板
 * @returns {Promise<{success: boolean, template?: Object}>}
 */
const getTrainingTemplate = () => {
  return callTrainingService('getTemplate')
}

/**
 * 创建训练模板
 * @param {Array} days - 7天训练安排
 * @returns {Promise<{success: boolean, templateId?: string, weekId?: string}>}
 */
const createTrainingTemplate = (days) => {
  return callTrainingService('createTemplate', { days })
}

/**
 * 更新训练模板
 * @param {Array} days - 新的7天训练安排
 * @returns {Promise<{success: boolean, message?: string}>}
 */
const updateTrainingTemplate = (days) => {
  return callTrainingService('updateTemplate', { days })
}

// ═══════════════════════════════════════════════════════════════
// 周计划相关 API
// ═══════════════════════════════════════════════════════════════

/**
 * 获取指定周的周计划
 * @param {string} [weekId] - 周标识，默认当前周
 * @returns {Promise<{success: boolean, week?: Object}>}
 */
const getTrainingWeek = (weekId) => {
  const targetWeekId = weekId || getWeekId(new Date())
  return callTrainingService('getOrCreateWeek', { weekId: targetWeekId })
}

/**
 * 获取或创建周计划
 * @param {string} [weekId] - 周标识，默认当前周
 * @returns {Promise<{success: boolean, week?: Object}>}
 */
const getOrCreateTrainingWeek = (weekId) => {
  return getTrainingWeek(weekId)
}

/**
 * 获取周计划历史列表
 * @param {Object} options - 分页选项
 * @param {number} [options.limit=10] - 每页数量
 * @param {number} [options.offset=0] - 偏移量
 * @returns {Promise<{success: boolean, weeks?: Array, total?: number}>}
 */
const getTrainingWeekHistory = (options = {}) => {
  const { limit = 10, offset = 0 } = options
  return callTrainingService('getWeekHistory', { limit, offset })
}

// ═══════════════════════════════════════════════════════════════
// 打卡相关 API
// ═══════════════════════════════════════════════════════════════

/**
 * 打卡：完成一组
 * @param {Object} params - 打卡参数
 * @param {string} params.weekId - 周标识
 * @param {number} params.dayIndex - 天索引 (0-6)
 * @param {string} params.itemId - 项目ID
 * @param {string} [params.requestId] - 请求ID（用于幂等，不传则自动生成）
 * @param {number} [params.weight] - 完成重量
 * @param {number} [params.reps] - 完成次数
 * @param {number} [params.rpe] - RPE (1-10)
 * @param {string} [params.remark] - 备注
 * @returns {Promise<{success: boolean, completedSets?: number, targetSets?: number}>}
 */
const incrementExerciseSet = (params) => {
  const {
    weekId,
    dayIndex,
    itemId,
    requestId = createTrainingRequestId(),
    weight,
    reps,
    rpe,
    remark
  } = params
  
  return callTrainingService('incrementSet', {
    weekId,
    dayIndex,
    itemId,
    requestId,
    weight,
    reps,
    rpe,
    remark
  })
}

/**
 * 更新已完成组的详情
 * @param {Object} params - 更新参数
 * @param {string} params.weekId - 周标识
 * @param {number} params.dayIndex - 天索引
 * @param {string} params.itemId - 项目ID
 * @param {number} params.setNumber - 组号
 * @param {number} [params.weight] - 重量
 * @param {number} [params.reps] - 次数
 * @param {number} [params.rpe] - RPE
 * @param {string} [params.remark] - 备注
 * @returns {Promise<{success: boolean}>}
 */
const updateExerciseSetDetail = (params) => {
  const { weekId, dayIndex, itemId, setNumber, weight, reps, rpe, remark } = params
  
  return callTrainingService('updateSetDetail', {
    weekId,
    dayIndex,
    itemId,
    setNumber,
    weight,
    reps,
    rpe,
    remark
  })
}

// ═══════════════════════════════════════════════════════════════
// 自定义动作相关 API
// ═══════════════════════════════════════════════════════════════

/**
 * 获取用户自定义动作列表
 * @returns {Promise<{success: boolean, exercises?: Array}>}
 */
const getCustomExercises = () => {
  return callTrainingService('getCustomExercises')
}

/**
 * 创建自定义动作
 * @param {Object} exerciseData - 动作数据
 * @param {string} exerciseData.name - 动作名称
 * @param {string} [exerciseData.itemType='strength'] - 项目类型
 * @param {number} [exerciseData.defaultSets] - 默认组数
 * @param {number} [exerciseData.defaultReps] - 默认次数
 * @param {number} [exerciseData.defaultWeight] - 默认重量
 * @param {Array} [exerciseData.videoLinks] - 视频链接
 * @returns {Promise<{success: boolean, exerciseId?: string}>}
 */
const createCustomExercise = (exerciseData) => {
  return callTrainingService('createCustomExercise', exerciseData)
}

/**
 * 更新自定义动作
 * @param {string} exerciseId - 动作ID
 * @param {Object} exerciseData - 要更新的数据
 * @returns {Promise<{success: boolean}>}
 */
const updateCustomExercise = (exerciseId, exerciseData) => {
  return callTrainingService('updateCustomExercise', { exerciseId, ...exerciseData })
}

/**
 * 删除自定义动作
 * @param {string} exerciseId - 动作ID
 * @returns {Promise<{success: boolean}>}
 */
const deleteCustomExercise = (exerciseId) => {
  return callTrainingService('deleteCustomExercise', { exerciseId })
}

// ═══════════════════════════════════════════════════════════════
// 视频相关 API
// ═══════════════════════════════════════════════════════════════

/**
 * 为周计划中的项目添加视频
 * @param {Object} params - 参数
 * @param {string} params.weekId - 周标识
 * @param {number} params.dayIndex - 天索引
 * @param {string} params.itemId - 项目ID
 * @param {string} params.title - 视频标题
 * @param {string} params.url - 视频URL (HTTPS)
 * @returns {Promise<{success: boolean}>}
 */
const addTrainingVideo = (params) => {
  const { weekId, dayIndex, itemId, title, url } = params
  return callTrainingService('addVideo', { weekId, dayIndex, itemId, title, url })
}

/**
 * 更新视频
 * @param {Object} params - 参数
 * @param {string} params.weekId - 周标识
 * @param {number} params.dayIndex - 天索引
 * @param {string} params.itemId - 项目ID
 * @param {number} params.videoIndex - 视频索引
 * @param {string} params.title - 新标题
 * @param {string} params.url - 新URL
 * @returns {Promise<{success: boolean}>}
 */
const updateTrainingVideo = (params) => {
  const { weekId, dayIndex, itemId, videoIndex, title, url } = params
  return callTrainingService('updateVideo', { weekId, dayIndex, itemId, videoIndex, title, url })
}

/**
 * 删除视频
 * @param {Object} params - 参数
 * @param {string} params.weekId - 周标识
 * @param {number} params.dayIndex - 天索引
 * @param {string} params.itemId - 项目ID
 * @param {number} params.videoIndex - 视频索引
 * @returns {Promise<{success: boolean}>}
 */
const deleteTrainingVideo = (params) => {
  const { weekId, dayIndex, itemId, videoIndex } = params
  return callTrainingService('deleteVideo', { weekId, dayIndex, itemId, videoIndex })
}

// 导出模块
module.exports = {
  // 请求工具
  createTrainingRequestId,
  
  // 模板
  getTrainingTemplate,
  createTrainingTemplate,
  updateTrainingTemplate,
  
  // 周计划
  getTrainingWeek,
  getOrCreateTrainingWeek,
  getTrainingWeekHistory,
  
  // 打卡
  incrementExerciseSet,
  updateExerciseSetDetail,
  
  // 自定义动作
  getCustomExercises,
  createCustomExercise,
  updateCustomExercise,
  deleteCustomExercise,
  
  // 视频
  addTrainingVideo,
  updateTrainingVideo,
  deleteTrainingVideo
}
