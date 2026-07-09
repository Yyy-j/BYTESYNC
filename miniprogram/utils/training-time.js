// utils/training-time.js — 训练日期和周次工具
// 本文件提供训练功能所需的日期计算，遵循 ISO 8601 周定义
// 周一为一周第一天，周次格式为 YYYY-Www

/**
 * 获取本地日期字符串（YYYY-MM-DD）
 * 使用本地时区，避免 UTC 转换导致的日期偏移
 * @param {Date} [date] - Date 对象，默认当前时间
 * @returns {string} 格式化的日期字符串
 */
const formatLocalDate = (date = new Date()) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 解析日期字符串为 Date 对象（本地时间）
 * @param {string} dateStr - YYYY-MM-DD 格式的日期字符串
 * @returns {Date} Date 对象
 */
const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * 获取 ISO 周标识
 * 格式：YYYY-Www（如 2026-W28）
 * 遵循 ISO 8601：周一为一周第一天，每年第一周包含该年第一个周四
 * @param {Date} [date] - Date 对象，默认当前时间
 * @returns {string} 周标识字符串
 */
const getWeekId = (date = new Date()) => {
  // 复制日期对象，避免修改原对象
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  // ISO 周：周一=1, 周日=7
  // JavaScript getDay()：周日=0, 周一=1, ..., 周六=6
  const dayOfWeek = target.getDay() || 7  // 将周日的 0 转为 7
  
  // 将日期调整到本周四（ISO 周的参考日）
  // 周四是一周的中间，用于判断该周属于哪一年
  target.setDate(target.getDate() + 4 - dayOfWeek)
  
  // 获取该周四所在年份的第一天
  const yearStart = new Date(target.getFullYear(), 0, 1)
  
  // 计算周四距离年初的天数，然后计算周次
  const daysDiff = Math.floor((target - yearStart) / (24 * 60 * 60 * 1000))
  const weekNum = Math.ceil((daysDiff + 1) / 7)
  
  return `${target.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

/**
 * 根据周标识获取该周周一的日期
 * @param {string} weekId - 周标识，格式 YYYY-Www
 * @returns {string} 周一日期，格式 YYYY-MM-DD
 */
const getWeekStartDate = (weekId) => {
  // 解析周标识
  const match = weekId.match(/^(\d{4})-W(\d{2})$/)
  if (!match) {
    throw new Error('无效的周标识格式，应为 YYYY-Www')
  }
  
  const year = parseInt(match[1], 10)
  const week = parseInt(match[2], 10)
  
  // 找到该年 1 月 4 日（一定在第 1 周）
  const jan4 = new Date(year, 0, 4)
  
  // 获取 1 月 4 日是周几（ISO：周一=1, 周日=7）
  const jan4Day = jan4.getDay() || 7
  
  // 计算第 1 周的周一
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - jan4Day + 1)
  
  // 计算目标周的周一
  const targetMonday = new Date(week1Monday)
  targetMonday.setDate(week1Monday.getDate() + (week - 1) * 7)
  
  return formatLocalDate(targetMonday)
}

/**
 * 根据周标识获取该周周日的日期
 * @param {string} weekId - 周标识，格式 YYYY-Www
 * @returns {string} 周日日期，格式 YYYY-MM-DD
 */
const getWeekEndDate = (weekId) => {
  const mondayStr = getWeekStartDate(weekId)
  const monday = parseLocalDate(mondayStr)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return formatLocalDate(sunday)
}

/**
 * 获取一周中每天的日期数组
 * @param {string} weekId - 周标识，格式 YYYY-Www
 * @returns {Array<string>} 包含 7 个日期字符串的数组，从周一到周日
 */
const getWeekDates = (weekId) => {
  const mondayStr = getWeekStartDate(weekId)
  const monday = parseLocalDate(mondayStr)
  
  const dates = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    dates.push(formatLocalDate(day))
  }
  
  return dates
}

/**
 * 获取下一周周一的日期
 * @param {Date} [date] - 参考日期，默认当前时间
 * @returns {string} 下周一日期，格式 YYYY-MM-DD
 */
const getNextWeekStart = (date = new Date()) => {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  // 计算当前是周几（ISO：周一=1, 周日=7）
  const dayOfWeek = current.getDay() || 7
  
  // 计算到下周一的天数
  const daysUntilNextMonday = 8 - dayOfWeek
  
  const nextMonday = new Date(current)
  nextMonday.setDate(current.getDate() + daysUntilNextMonday)
  
  return formatLocalDate(nextMonday)
}

/**
 * 根据日期获取其在周内的索引
 * 周一=0, 周二=1, ..., 周日=6
 * @param {Date|string} date - Date 对象或 YYYY-MM-DD 格式字符串
 * @returns {number} 0-6 的索引
 */
const getDayIndex = (date) => {
  const d = typeof date === 'string' ? parseLocalDate(date) : date
  const dayOfWeek = d.getDay()
  // JavaScript: 周日=0, 周一=1, ..., 周六=6
  // 需要转换为: 周一=0, 周二=1, ..., 周日=6
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1
}

/**
 * 验证周标识格式是否正确
 * @param {string} weekId - 周标识
 * @returns {boolean} 是否为有效格式
 */
const isValidWeekId = (weekId) => {
  if (!weekId || typeof weekId !== 'string') {
    return false
  }
  const match = weekId.match(/^(\d{4})-W(\d{2})$/)
  if (!match) {
    return false
  }
  const week = parseInt(match[2], 10)
  // ISO 周次范围 01-53
  return week >= 1 && week <= 53
}

/**
 * 获取当前周的周标识
 * @returns {string} 当前周标识
 */
const getCurrentWeekId = () => {
  return getWeekId(new Date())
}

/**
 * 获取今天的日期字符串
 * @returns {string} 今天日期，格式 YYYY-MM-DD
 */
const getToday = () => {
  return formatLocalDate(new Date())
}

// 导出模块
module.exports = {
  formatLocalDate,
  parseLocalDate,
  getWeekId,
  getWeekStartDate,
  getWeekEndDate,
  getWeekDates,
  getNextWeekStart,
  getDayIndex,
  isValidWeekId,
  getCurrentWeekId,
  getToday
}
