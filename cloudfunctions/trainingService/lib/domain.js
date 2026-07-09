// cloudfunctions/trainingService/lib/domain.js — 训练业务逻辑
// 本文件包含所有训练相关的数据库操作和业务规则

const time = require('./time')
const validation = require('./validation')

const { TRAINING_ERRORS } = validation

// ═══════════════════════════════════════════════════════════════
// 数据库集合名
// ═══════════════════════════════════════════════════════════════

const COLLECTIONS = {
  TEMPLATES: 'trainingTemplates',
  WEEKS: 'trainingWeeks',
  EXERCISES: 'trainingExercises'
}

// ═══════════════════════════════════════════════════════════════
// 错误响应工具
// ═══════════════════════════════════════════════════════════════

const success = (data = {}) => ({
  success: true,
  ...data
})

const fail = (error) => ({
  success: false,
  error: error || TRAINING_ERRORS.INTERNAL_ERROR
})

// ═══════════════════════════════════════════════════════════════
// 模板相关业务
// ═══════════════════════════════════════════════════════════════

/**
 * 获取用户训练模板
 * @param {Object} db - 数据库实例
 * @param {string} openid - 用户标识
 */
async function getTemplate(db, openid) {
  const result = await db.collection(COLLECTIONS.TEMPLATES)
    .where({ openid })
    .limit(1)
    .get()
  
  if (result.data && result.data.length > 0) {
    return success({ template: result.data[0] })
  }
  
  return success({ template: null })
}

/**
 * 创建用户训练模板
 * 首次创建模板时，同时创建当前周的周计划
 * @param {Object} db - 数据库实例
 * @param {string} openid - 用户标识
 * @param {Array} days - 7天的训练安排
 */
async function createTemplate(db, openid, days) {
  // 校验模板数据
  const validationResult = validation.validateTemplateDays(days)
  if (!validationResult.valid) {
    return fail(validationResult.error)
  }
  
  // 检查是否已有模板
  const existingResult = await db.collection(COLLECTIONS.TEMPLATES)
    .where({ openid })
    .count()
  
  if (existingResult.total > 0) {
    return fail(TRAINING_ERRORS.TEMPLATE_EXISTS)
  }
  
  const now = new Date()
  const template = {
    openid,
    days,
    version: 1,
    createdAt: now,
    updatedAt: now
  }
  
  const addResult = await db.collection(COLLECTIONS.TEMPLATES).add({ data: template })
  
  // 首次创建模板时，立即创建当前周的周计划
  const currentWeekId = time.getWeekId(now)
  await createWeekFromTemplate(db, openid, currentWeekId, days)
  
  return success({
    templateId: addResult._id,
    weekId: currentWeekId
  })
}

/**
 * 更新用户训练模板
 * 模板更改从下周一生效
 * @param {Object} db - 数据库实例
 * @param {string} openid - 用户标识
 * @param {Array} days - 新的7天训练安排
 */
async function updateTemplate(db, openid, days) {
  // 校验模板数据
  const validationResult = validation.validateTemplateDays(days)
  if (!validationResult.valid) {
    return fail(validationResult.error)
  }
  
  const now = new Date()
  
  // 更新模板，version +1
  const updateResult = await db.collection(COLLECTIONS.TEMPLATES)
    .where({ openid })
    .update({
      data: {
        days,
        updatedAt: now,
        version: db.command.inc(1)
      }
    })
  
  if (updateResult.stats.updated === 0) {
    return fail(TRAINING_ERRORS.TEMPLATE_NOT_FOUND)
  }
  
  return success({
    message: '模板已更新，将于下周一生效'
  })
}

// ═══════════════════════════════════════════════════════════════
// 周计划相关业务
// ═══════════════════════════════════════════════════════════════

/**
 * 从模板创建周计划（内部方法）
 * @param {Object} db - 数据库实例
 * @param {string} openid - 用户标识
 * @param {string} weekId - 周标识
 * @param {Array} templateDays - 模板天数据
 */
async function createWeekFromTemplate(db, openid, weekId, templateDays) {
  // 深拷贝模板数据，为每个项目添加完成计数
  const days = templateDays.map(day => ({
    dayIndex: day.dayIndex,
    date: time.getWeekDates(weekId)[day.dayIndex],
    exercises: day.exercises.map(exercise => ({
      ...exercise,
      completedSets: 0,
      setDetails: []
    }))
  }))
  
  const now = new Date()
  const weekPlan = {
    openid,
    weekId,
    startDate: time.getWeekStartDate(weekId),
    endDate: time.getWeekEndDate(weekId),
    days,
    createdAt: now,
    updatedAt: now
  }
  
  try {
    await db.collection(COLLECTIONS.WEEKS).add({ data: weekPlan })
    return success({ weekId })
  } catch (err) {
    // 可能是重复创建（唯一索引冲突）
    console.log('createWeekFromTemplate error:', err)
    return success({ weekId })
  }
}

/**
 * 获取或创建周计划
 * @param {Object} db - 数据库实例
 * @param {string} openid - 用户标识
 * @param {string} weekId - 周标识（可选，默认当前周）
 */
async function getOrCreateWeek(db, openid, weekId) {
  // 默认当前周
  const targetWeekId = weekId || time.getWeekId(new Date())
  
  // 验证周标识格式
  if (!time.isValidWeekId(targetWeekId)) {
    return fail(TRAINING_ERRORS.WEEK_ID_INVALID)
  }
  
  // 尝试获取已有的周计划
  const existingResult = await db.collection(COLLECTIONS.WEEKS)
    .where({ openid, weekId: targetWeekId })
    .limit(1)
    .get()
  
  if (existingResult.data && existingResult.data.length > 0) {
    return success({ week: existingResult.data[0] })
  }
  
  // 没有周计划，需要从模板创建
  const templateResult = await getTemplate(db, openid)
  if (!templateResult.template) {
    return fail(TRAINING_ERRORS.TEMPLATE_NOT_FOUND)
  }
  
  // 从模板创建周计划
  await createWeekFromTemplate(db, openid, targetWeekId, templateResult.template.days)
  
  // 重新获取创建的周计划
  const newResult = await db.collection(COLLECTIONS.WEEKS)
    .where({ openid, weekId: targetWeekId })
    .limit(1)
    .get()
  
  if (newResult.data && newResult.data.length > 0) {
    return success({ week: newResult.data[0] })
  }
  
  return fail(TRAINING_ERRORS.INTERNAL_ERROR)
}

/**
 * 获取周计划历史列表
 * @param {Object} db - 数据库实例
 * @param {string} openid - 用户标识
 * @param {number} limit - 返回数量限制
 * @param {number} offset - 偏移量
 */
async function getWeekHistory(db, openid, limit = 10, offset = 0) {
  const result = await db.collection(COLLECTIONS.WEEKS)
    .where({ openid })
    .orderBy('weekId', 'desc')
    .skip(offset)
    .limit(limit)
    .get()
  
  return success({
    weeks: result.data || [],
    total: result.data ? result.data.length : 0
  })
}

// ═══════════════════════════════════════════════════════════════
// 打卡相关业务
// ═══════════════════════════════════════════════════════════════

/**
 * 打卡：增加一组
 * 使用 requestId 实现幂等性
 * @param {Object} db - 数据库实例
 * @param {string} openid - 用户标识
 * @param {string} weekId - 周标识
 * @param {number} dayIndex - 天索引 0-6
 * @param {string} itemId - 项目ID
 * @param {Object} checkinData - 打卡数据
 */
async function incrementSet(db, openid, weekId, dayIndex, itemId, checkinData) {
  // 校验打卡输入
  const validationResult = validation.validateCheckinInput(checkinData)
  if (!validationResult.valid) {
    return fail(validationResult.error)
  }
  
  const { requestId, weight, reps, rpe, remark } = checkinData
  
  // 获取周计划
  const weekResult = await db.collection(COLLECTIONS.WEEKS)
    .where({ openid, weekId })
    .limit(1)
    .get()
  
  if (!weekResult.data || weekResult.data.length === 0) {
    return fail(TRAINING_ERRORS.WEEK_NOT_FOUND)
  }
  
  const week = weekResult.data[0]
  
  // 找到对应的天和项目
  const day = week.days.find(d => d.dayIndex === dayIndex)
  if (!day) {
    return fail(TRAINING_ERRORS.WEEK_ITEM_NOT_FOUND)
  }
  
  const exercise = day.exercises.find(e => e.itemId === itemId)
  if (!exercise) {
    return fail(TRAINING_ERRORS.WEEK_ITEM_NOT_FOUND)
  }
  
  // 检查是否已达到目标组数
  if (exercise.completedSets >= exercise.targetSets) {
    return fail(TRAINING_ERRORS.TARGET_REACHED)
  }
  
  // 检查幂等性：是否已有相同 requestId 的记录
  const existingDetail = exercise.setDetails.find(d => d.requestId === requestId)
  if (existingDetail) {
    // 幂等返回：已处理过的请求
    return success({
      completedSets: exercise.completedSets,
      message: '该组已记录（幂等返回）'
    })
  }
  
  // 构建新的组详情
  const setDetail = {
    requestId,
    setNumber: exercise.completedSets + 1,
    weight: weight !== undefined && weight !== null ? Number(weight) : null,
    reps: reps !== undefined && reps !== null ? Number(reps) : null,
    rpe: rpe !== undefined && rpe !== null ? Number(rpe) : null,
    remark: remark || null,
    completedAt: new Date()
  }
  
  // 使用数据库命令更新
  const dayKey = `days.${week.days.indexOf(day)}`
  const exerciseKey = `${dayKey}.exercises.${day.exercises.indexOf(exercise)}`
  
  await db.collection(COLLECTIONS.WEEKS)
    .doc(week._id)
    .update({
      data: {
        [`${exerciseKey}.completedSets`]: db.command.inc(1),
        [`${exerciseKey}.setDetails`]: db.command.push(setDetail),
        updatedAt: new Date()
      }
    })
  
  return success({
    completedSets: exercise.completedSets + 1,
    targetSets: exercise.targetSets
  })
}

/**
 * 更新已完成组的详情
 * @param {Object} db - 数据库实例
 * @param {string} openid - 用户标识
 * @param {string} weekId - 周标识
 * @param {number} dayIndex - 天索引
 * @param {string} itemId - 项目ID
 * @param {number} setNumber - 组号
 * @param {Object} updateData - 更新数据
 */
async function updateSetDetail(db, openid, weekId, dayIndex, itemId, setNumber, updateData) {
  // 校验更新数据
  if (updateData.weight !== undefined) {
    const weightResult = validation.validateNumber(updateData.weight, {
      min: 0, max: 1000,
      required: false,
      error: TRAINING_ERRORS.WEIGHT_INVALID
    })
    if (!weightResult.valid) {
      return fail(weightResult.error)
    }
  }
  
  if (updateData.reps !== undefined) {
    const repsResult = validation.validateInteger(updateData.reps, {
      min: 1, max: 999,
      error: TRAINING_ERRORS.REPS_INVALID
    })
    if (!repsResult.valid) {
      return fail(repsResult.error)
    }
  }
  
  if (updateData.rpe !== undefined) {
    const rpeResult = validation.validateInteger(updateData.rpe, {
      min: 1, max: 10,
      error: TRAINING_ERRORS.RPE_INVALID
    })
    if (!rpeResult.valid) {
      return fail(rpeResult.error)
    }
  }
  
  // 获取周计划
  const weekResult = await db.collection(COLLECTIONS.WEEKS)
    .where({ openid, weekId })
    .limit(1)
    .get()
  
  if (!weekResult.data || weekResult.data.length === 0) {
    return fail(TRAINING_ERRORS.WEEK_NOT_FOUND)
  }
  
  const week = weekResult.data[0]
  const dayIdx = week.days.findIndex(d => d.dayIndex === dayIndex)
  if (dayIdx === -1) {
    return fail(TRAINING_ERRORS.WEEK_ITEM_NOT_FOUND)
  }
  
  const exerciseIdx = week.days[dayIdx].exercises.findIndex(e => e.itemId === itemId)
  if (exerciseIdx === -1) {
    return fail(TRAINING_ERRORS.WEEK_ITEM_NOT_FOUND)
  }
  
  const setIdx = week.days[dayIdx].exercises[exerciseIdx].setDetails.findIndex(
    s => s.setNumber === setNumber
  )
  if (setIdx === -1) {
    return fail(TRAINING_ERRORS.WEEK_ITEM_NOT_FOUND)
  }
  
  // 构建更新对象
  const updateObj = { updatedAt: new Date() }
  const basePath = `days.${dayIdx}.exercises.${exerciseIdx}.setDetails.${setIdx}`
  
  if (updateData.weight !== undefined) {
    updateObj[`${basePath}.weight`] = updateData.weight
  }
  if (updateData.reps !== undefined) {
    updateObj[`${basePath}.reps`] = updateData.reps
  }
  if (updateData.rpe !== undefined) {
    updateObj[`${basePath}.rpe`] = updateData.rpe
  }
  if (updateData.remark !== undefined) {
    updateObj[`${basePath}.remark`] = updateData.remark
  }
  
  await db.collection(COLLECTIONS.WEEKS)
    .doc(week._id)
    .update({ data: updateObj })
  
  return success({ message: '已更新' })
}

// ═══════════════════════════════════════════════════════════════
// 自定义动作相关业务
// ═══════════════════════════════════════════════════════════════

/**
 * 获取用户自定义动作列表
 */
async function getCustomExercises(db, openid) {
  const result = await db.collection(COLLECTIONS.EXERCISES)
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .get()
  
  return success({ exercises: result.data || [] })
}

/**
 * 创建自定义动作
 */
async function createCustomExercise(db, openid, exerciseData) {
  const validationResult = validation.validateCustomExerciseInput(exerciseData)
  if (!validationResult.valid) {
    return fail(validationResult.error)
  }
  
  const now = new Date()
  const exercise = {
    openid,
    name: exerciseData.name.trim(),
    itemType: exerciseData.itemType || 'strength',
    defaultSets: exerciseData.defaultSets || 4,
    defaultReps: exerciseData.defaultReps || 12,
    defaultWeight: exerciseData.defaultWeight || 0,
    videoLinks: exerciseData.videoLinks || [],
    createdAt: now,
    updatedAt: now
  }
  
  const addResult = await db.collection(COLLECTIONS.EXERCISES).add({ data: exercise })
  
  return success({ exerciseId: addResult._id })
}

/**
 * 更新自定义动作
 */
async function updateCustomExercise(db, openid, exerciseId, exerciseData) {
  const validationResult = validation.validateCustomExerciseInput(exerciseData)
  if (!validationResult.valid) {
    return fail(validationResult.error)
  }
  
  const updateData = {
    updatedAt: new Date()
  }
  
  if (exerciseData.name !== undefined) {
    updateData.name = exerciseData.name.trim()
  }
  if (exerciseData.itemType !== undefined) {
    updateData.itemType = exerciseData.itemType
  }
  if (exerciseData.defaultSets !== undefined) {
    updateData.defaultSets = exerciseData.defaultSets
  }
  if (exerciseData.defaultReps !== undefined) {
    updateData.defaultReps = exerciseData.defaultReps
  }
  if (exerciseData.defaultWeight !== undefined) {
    updateData.defaultWeight = exerciseData.defaultWeight
  }
  if (exerciseData.videoLinks !== undefined) {
    updateData.videoLinks = exerciseData.videoLinks
  }
  
  const updateResult = await db.collection(COLLECTIONS.EXERCISES)
    .where({ _id: exerciseId, openid })
    .update({ data: updateData })
  
  if (updateResult.stats.updated === 0) {
    return fail(TRAINING_ERRORS.CUSTOM_EXERCISE_NOT_FOUND)
  }
  
  return success({ message: '已更新' })
}

/**
 * 删除自定义动作
 */
async function deleteCustomExercise(db, openid, exerciseId) {
  const deleteResult = await db.collection(COLLECTIONS.EXERCISES)
    .where({ _id: exerciseId, openid })
    .remove()
  
  if (deleteResult.stats.removed === 0) {
    return fail(TRAINING_ERRORS.CUSTOM_EXERCISE_NOT_FOUND)
  }
  
  return success({ message: '已删除' })
}

// ═══════════════════════════════════════════════════════════════
// 视频相关业务
// ═══════════════════════════════════════════════════════════════

/**
 * 为周计划中的项目添加视频
 */
async function addVideo(db, openid, weekId, dayIndex, itemId, videoData) {
  const videoResult = validation.validateVideo(videoData)
  if (!videoResult.valid) {
    return fail(videoResult.error)
  }
  
  // 获取周计划
  const weekResult = await db.collection(COLLECTIONS.WEEKS)
    .where({ openid, weekId })
    .limit(1)
    .get()
  
  if (!weekResult.data || weekResult.data.length === 0) {
    return fail(TRAINING_ERRORS.WEEK_NOT_FOUND)
  }
  
  const week = weekResult.data[0]
  const dayIdx = week.days.findIndex(d => d.dayIndex === dayIndex)
  if (dayIdx === -1) {
    return fail(TRAINING_ERRORS.WEEK_ITEM_NOT_FOUND)
  }
  
  const exerciseIdx = week.days[dayIdx].exercises.findIndex(e => e.itemId === itemId)
  if (exerciseIdx === -1) {
    return fail(TRAINING_ERRORS.WEEK_ITEM_NOT_FOUND)
  }
  
  const exercise = week.days[dayIdx].exercises[exerciseIdx]
  const currentVideos = exercise.videoLinks || []
  
  // 检查视频数量限制
  if (currentVideos.length >= 3) {
    return fail(TRAINING_ERRORS.VIDEO_LIMIT)
  }
  
  // 检查重复
  if (currentVideos.some(v => v.url === videoResult.value.url)) {
    return fail(TRAINING_ERRORS.VIDEO_DUPLICATE)
  }
  
  const videoPath = `days.${dayIdx}.exercises.${exerciseIdx}.videoLinks`
  
  await db.collection(COLLECTIONS.WEEKS)
    .doc(week._id)
    .update({
      data: {
        [videoPath]: db.command.push(videoResult.value),
        updatedAt: new Date()
      }
    })
  
  return success({ message: '视频已添加' })
}

/**
 * 更新视频
 */
async function updateVideo(db, openid, weekId, dayIndex, itemId, videoIndex, videoData) {
  const videoResult = validation.validateVideo(videoData)
  if (!videoResult.valid) {
    return fail(videoResult.error)
  }
  
  // 获取周计划
  const weekResult = await db.collection(COLLECTIONS.WEEKS)
    .where({ openid, weekId })
    .limit(1)
    .get()
  
  if (!weekResult.data || weekResult.data.length === 0) {
    return fail(TRAINING_ERRORS.WEEK_NOT_FOUND)
  }
  
  const week = weekResult.data[0]
  const dayIdx = week.days.findIndex(d => d.dayIndex === dayIndex)
  if (dayIdx === -1) {
    return fail(TRAINING_ERRORS.WEEK_ITEM_NOT_FOUND)
  }
  
  const exerciseIdx = week.days[dayIdx].exercises.findIndex(e => e.itemId === itemId)
  if (exerciseIdx === -1) {
    return fail(TRAINING_ERRORS.WEEK_ITEM_NOT_FOUND)
  }
  
  const exercise = week.days[dayIdx].exercises[exerciseIdx]
  const currentVideos = exercise.videoLinks || []
  
  if (videoIndex < 0 || videoIndex >= currentVideos.length) {
    return fail(TRAINING_ERRORS.VIDEO_NOT_FOUND)
  }
  
  // 检查新 URL 是否与其他视频重复
  const otherUrls = currentVideos.filter((_, i) => i !== videoIndex).map(v => v.url)
  if (otherUrls.includes(videoResult.value.url)) {
    return fail(TRAINING_ERRORS.VIDEO_DUPLICATE)
  }
  
  const videoPath = `days.${dayIdx}.exercises.${exerciseIdx}.videoLinks.${videoIndex}`
  
  await db.collection(COLLECTIONS.WEEKS)
    .doc(week._id)
    .update({
      data: {
        [videoPath]: videoResult.value,
        updatedAt: new Date()
      }
    })
  
  return success({ message: '视频已更新' })
}

/**
 * 删除视频
 */
async function deleteVideo(db, openid, weekId, dayIndex, itemId, videoIndex) {
  // 获取周计划
  const weekResult = await db.collection(COLLECTIONS.WEEKS)
    .where({ openid, weekId })
    .limit(1)
    .get()
  
  if (!weekResult.data || weekResult.data.length === 0) {
    return fail(TRAINING_ERRORS.WEEK_NOT_FOUND)
  }
  
  const week = weekResult.data[0]
  const dayIdx = week.days.findIndex(d => d.dayIndex === dayIndex)
  if (dayIdx === -1) {
    return fail(TRAINING_ERRORS.WEEK_ITEM_NOT_FOUND)
  }
  
  const exerciseIdx = week.days[dayIdx].exercises.findIndex(e => e.itemId === itemId)
  if (exerciseIdx === -1) {
    return fail(TRAINING_ERRORS.WEEK_ITEM_NOT_FOUND)
  }
  
  const exercise = week.days[dayIdx].exercises[exerciseIdx]
  const currentVideos = exercise.videoLinks || []
  
  if (videoIndex < 0 || videoIndex >= currentVideos.length) {
    return fail(TRAINING_ERRORS.VIDEO_NOT_FOUND)
  }
  
  // 移除指定索引的视频
  const newVideos = currentVideos.filter((_, i) => i !== videoIndex)
  const videoPath = `days.${dayIdx}.exercises.${exerciseIdx}.videoLinks`
  
  await db.collection(COLLECTIONS.WEEKS)
    .doc(week._id)
    .update({
      data: {
        [videoPath]: newVideos,
        updatedAt: new Date()
      }
    })
  
  return success({ message: '视频已删除' })
}

// 导出模块
module.exports = {
  COLLECTIONS,
  success,
  fail,
  
  // 模板
  getTemplate,
  createTemplate,
  updateTemplate,
  
  // 周计划
  getOrCreateWeek,
  getWeekHistory,
  
  // 打卡
  incrementSet,
  updateSetDetail,
  
  // 自定义动作
  getCustomExercises,
  createCustomExercise,
  updateCustomExercise,
  deleteCustomExercise,
  
  // 视频
  addVideo,
  updateVideo,
  deleteVideo
}
