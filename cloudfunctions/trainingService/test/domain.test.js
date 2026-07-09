// cloudfunctions/trainingService/test/domain.test.js — 纯逻辑单元测试
// 使用 Node.js 内置 assert 模块，无需任何第三方测试框架
// 运行方式：node cloudfunctions/trainingService/test/domain.test.js

const assert = require('assert')

// 引入被测试模块
const time = require('../lib/time')
const validation = require('../lib/validation')

// 测试结果统计
let passed = 0
let failed = 0
const errors = []

/**
 * 测试辅助函数
 */
function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`✓ ${name}`)
  } catch (err) {
    failed++
    errors.push({ name, error: err.message })
    console.log(`✗ ${name}`)
    console.log(`  Error: ${err.message}`)
  }
}

// ═══════════════════════════════════════════════════════════════
// 日期时间工具测试
// ═══════════════════════════════════════════════════════════════

console.log('\n--- 日期时间工具测试 ---\n')

test('formatLocalDate 返回 YYYY-MM-DD 格式', () => {
  const date = new Date(2026, 0, 15) // 2026-01-15
  const result = time.formatLocalDate(date)
  assert.strictEqual(result, '2026-01-15')
})

test('parseLocalDate 正确解析日期字符串', () => {
  const result = time.parseLocalDate('2026-06-15')
  assert.strictEqual(result.getFullYear(), 2026)
  assert.strictEqual(result.getMonth(), 5) // 6月，月份从0开始
  assert.strictEqual(result.getDate(), 15)
})

test('getWeekId 返回正确的 ISO 周格式', () => {
  // 2026年1月15日是周四，属于第3周
  const date = new Date(2026, 0, 15)
  const result = time.getWeekId(date)
  assert.match(result, /^\d{4}-W\d{2}$/, '应匹配 YYYY-Www 格式')
})

test('getWeekStartDate 返回周一日期', () => {
  // 2026-W03 的周一
  const result = time.getWeekStartDate('2026-W03')
  // 验证是一个有效日期格式
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/)
})

test('getWeekEndDate 返回周日日期', () => {
  const start = time.getWeekStartDate('2026-W03')
  const end = time.getWeekEndDate('2026-W03')
  
  const startDate = time.parseLocalDate(start)
  const endDate = time.parseLocalDate(end)
  
  // 周日应该比周一晚6天
  const diff = (endDate - startDate) / (24 * 60 * 60 * 1000)
  assert.strictEqual(diff, 6)
})

test('getWeekDates 返回7天日期数组', () => {
  const dates = time.getWeekDates('2026-W03')
  assert.strictEqual(dates.length, 7)
  // 所有元素都是日期格式
  dates.forEach(d => {
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/)
  })
})

test('isValidWeekId 验证正确格式', () => {
  assert.strictEqual(time.isValidWeekId('2026-W01'), true)
  assert.strictEqual(time.isValidWeekId('2026-W53'), true)
  assert.strictEqual(time.isValidWeekId('2026-W00'), false)
  assert.strictEqual(time.isValidWeekId('2026-W54'), false)
  assert.strictEqual(time.isValidWeekId('2026W01'), false)
  assert.strictEqual(time.isValidWeekId(''), false)
  assert.strictEqual(time.isValidWeekId(null), false)
})

// ═══════════════════════════════════════════════════════════════
// 校验工具测试
// ═══════════════════════════════════════════════════════════════

console.log('\n--- 校验工具测试 ---\n')

test('validateString 必填字段校验', () => {
  const result1 = validation.validateString('hello')
  assert.strictEqual(result1.valid, true)
  assert.strictEqual(result1.value, 'hello')
  
  const result2 = validation.validateString('')
  assert.strictEqual(result2.valid, false)
  
  const result3 = validation.validateString('  ', { required: true })
  assert.strictEqual(result3.valid, false)
  
  const result4 = validation.validateString('', { required: false })
  assert.strictEqual(result4.valid, true)
})

test('validateString 长度限制', () => {
  const result1 = validation.validateString('hello', { maxLength: 10 })
  assert.strictEqual(result1.valid, true)
  
  const result2 = validation.validateString('a'.repeat(50), { maxLength: 40 })
  assert.strictEqual(result2.valid, false)
})

test('validateInteger 整数校验', () => {
  const result1 = validation.validateInteger(5, { min: 1, max: 10 })
  assert.strictEqual(result1.valid, true)
  assert.strictEqual(result1.value, 5)
  
  const result2 = validation.validateInteger(0, { min: 1 })
  assert.strictEqual(result2.valid, false)
  
  const result3 = validation.validateInteger(3.5, { min: 1, max: 10 })
  assert.strictEqual(result3.valid, false, '小数应该失败')
})

test('validateNumber 数字校验（含小数）', () => {
  const result1 = validation.validateNumber(3.5, { min: 0, max: 10 })
  assert.strictEqual(result1.valid, true)
  assert.strictEqual(result1.value, 3.5)
  
  const result2 = validation.validateNumber(-1, { min: 0 })
  assert.strictEqual(result2.valid, false)
})

test('isValidHttpsUrl HTTPS 链接校验', () => {
  assert.strictEqual(validation.isValidHttpsUrl('https://example.com'), true)
  assert.strictEqual(validation.isValidHttpsUrl('https://example.com/path?q=1'), true)
  assert.strictEqual(validation.isValidHttpsUrl('http://example.com'), false)
  assert.strictEqual(validation.isValidHttpsUrl('ftp://example.com'), false)
  assert.strictEqual(validation.isValidHttpsUrl('not a url'), false)
  assert.strictEqual(validation.isValidHttpsUrl(''), false)
})

test('validateVideo 视频对象校验', () => {
  const validVideo = { title: '教程视频', url: 'https://example.com/video' }
  const result1 = validation.validateVideo(validVideo)
  assert.strictEqual(result1.valid, true)
  
  const noTitle = { title: '', url: 'https://example.com/video' }
  const result2 = validation.validateVideo(noTitle)
  assert.strictEqual(result2.valid, false)
  
  const badUrl = { title: '教程', url: 'http://example.com/video' }
  const result3 = validation.validateVideo(badUrl)
  assert.strictEqual(result3.valid, false)
})

test('validateVideoLinks 视频数组限制', () => {
  const videos = [
    { title: '视频1', url: 'https://a.com/1' },
    { title: '视频2', url: 'https://a.com/2' },
    { title: '视频3', url: 'https://a.com/3' }
  ]
  const result1 = validation.validateVideoLinks(videos)
  assert.strictEqual(result1.valid, true)
  
  const tooMany = [...videos, { title: '视频4', url: 'https://a.com/4' }]
  const result2 = validation.validateVideoLinks(tooMany)
  assert.strictEqual(result2.valid, false)
  assert.strictEqual(result2.error.code, 'TRAINING_VIDEO_LIMIT')
})

test('validateExerciseItem 力量项目校验', () => {
  const validItem = {
    itemId: 'item_001',
    exerciseId: 'bench_press',
    exerciseName: '杠铃卧推',
    sourceType: 'fixed',
    itemType: 'strength',
    targetSets: 4,
    targetReps: 8,
    targetWeight: 60,
    order: 1
  }
  const result = validation.validateExerciseItem(validItem)
  assert.strictEqual(result.valid, true)
})

test('validateExerciseItem 有氧项目校验', () => {
  const cardioItem = {
    itemId: 'item_002',
    exerciseId: 'treadmill',
    exerciseName: '跑步机',
    sourceType: 'custom',
    itemType: 'cardio',
    targetDuration: 30,
    order: 1
  }
  const result = validation.validateExerciseItem(cardioItem)
  assert.strictEqual(result.valid, true)
})

test('validateExerciseItem 缺少必填字段', () => {
  const invalidItem = {
    itemId: 'item_001',
    exerciseName: '测试'
    // 缺少 exerciseId, sourceType, itemType
  }
  const result = validation.validateExerciseItem(invalidItem)
  assert.strictEqual(result.valid, false)
})

test('validateTemplateDays 7天模板校验', () => {
  const validDays = Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    exercises: []
  }))
  const result = validation.validateTemplateDays(validDays)
  assert.strictEqual(result.valid, true)
})

test('validateTemplateDays 天数不足', () => {
  const invalidDays = Array.from({ length: 5 }, (_, i) => ({
    dayIndex: i,
    exercises: []
  }))
  const result = validation.validateTemplateDays(invalidDays)
  assert.strictEqual(result.valid, false)
})

test('validateTemplateDays 重复天索引', () => {
  const duplicateDays = Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i === 6 ? 0 : i, // 最后一个重复第一个
    exercises: []
  }))
  const result = validation.validateTemplateDays(duplicateDays)
  assert.strictEqual(result.valid, false)
  assert.strictEqual(result.error.code, 'TRAINING_TEMPLATE_DAY_INDEX_DUPLICATE')
})

test('validateCheckinInput 打卡数据校验', () => {
  const validCheckin = {
    requestId: 'req_001',
    weight: 60,
    reps: 8,
    rpe: 7
  }
  const result = validation.validateCheckinInput(validCheckin)
  assert.strictEqual(result.valid, true)
})

test('validateCheckinInput 缺少 requestId', () => {
  const noRequestId = {
    weight: 60,
    reps: 8
  }
  const result = validation.validateCheckinInput(noRequestId)
  assert.strictEqual(result.valid, false)
  assert.strictEqual(result.error.code, 'TRAINING_REQUEST_ID_REQUIRED')
})

test('validateCustomExerciseInput 自定义动作校验', () => {
  const validExercise = {
    name: '我的动作',
    itemType: 'strength',
    defaultSets: 4,
    defaultReps: 12
  }
  const result = validation.validateCustomExerciseInput(validExercise)
  assert.strictEqual(result.valid, true)
})

test('validateCustomExerciseInput 名称过长', () => {
  const longName = {
    name: 'a'.repeat(50), // 超过40字符
    itemType: 'strength'
  }
  const result = validation.validateCustomExerciseInput(longName)
  assert.strictEqual(result.valid, false)
  assert.strictEqual(result.error.code, 'TRAINING_EXERCISE_NAME_TOO_LONG')
})

// ═══════════════════════════════════════════════════════════════
// 测试结果汇总
// ═══════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════')
console.log(`测试完成: ${passed} 通过, ${failed} 失败`)
console.log('═══════════════════════════════════════════════')

if (failed > 0) {
  console.log('\n失败的测试:')
  errors.forEach(({ name, error }) => {
    console.log(`  - ${name}: ${error}`)
  })
  process.exit(1)
}

console.log('\n所有测试通过! ✓\n')
process.exit(0)
