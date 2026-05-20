// cloudfunctions/analyzeMeal/index.js
const cloud = require('wx-server-sdk')
const https  = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ── 配置 ──────────────────────────────────────────────────
const QWEN_KEY      = process.env.QWEN_API_KEY
const QWEN_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

// ── 封装 HTTPS POST ────────────────────────────────────────
function httpsPost(url, extraHeaders, bodyStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const options = {
      hostname: u.hostname,
      path:     u.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...extraHeaders,
      },
    }
    const req = https.request(options, (res) => {
      let raw = ''
      res.on('data',  chunk => { raw += chunk })
      res.on('end',   () => {
        try   { resolve(JSON.parse(raw)) }
        catch { reject(new Error('JSON parse fail: ' + raw.slice(0, 300))) }
      })
    })
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

// ── 从 AI 返回文本中提取营养 JSON（鲁棒版）──────────────────
function parseNutrition(content) {
  if (!content) return null

  // 步骤 1：去除 markdown 代码块（```json ... ``` 或 ``` ... ```）
  let cleaned = content
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim()

  // 步骤 2：提取最外层 {...}（允许嵌套，用栈匹配）
  let start = -1, depth = 0, jsonStr = null
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      if (depth === 0) start = i
      depth++
    } else if (cleaned[i] === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        jsonStr = cleaned.slice(start, i + 1)
        break
      }
    }
  }
  if (!jsonStr) return null

  try {
    const obj = JSON.parse(jsonStr)

    // 解析 dishes 数组
    const dishes = Array.isArray(obj.dishes)
      ? obj.dishes.slice(0, 8).map(d => ({
          name:     String(d.name || '').slice(0, 20),
          calories: Math.round(Number(d.calories) || 0),
        })).filter(d => d.name)
      : []

    return {
      name:     String(obj.name     || '未知食物').slice(0, 30),
      calories: Math.round(Number(obj.calories) || 0),
      protein:  Math.round(Number(obj.protein)  || 0),
      carbs:    Math.round(Number(obj.carbs)     || 0),
      fat:      Math.round(Number(obj.fat)       || 0),
      dishes,
    }
  } catch {
    return null
  }
}

// ── 延迟工具 ──────────────────────────────────────────────
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// ── 图片模式：单次识别 ─────────────────────────────────────
async function callQwen(base64, hint) {
  const body = JSON.stringify({
    model: 'qwen-vl-max',
    messages: [
      {
        role: 'user',
        content: [
          {
            type:      'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64}` },
          },
          {
            type: 'text',
            text: `请识别图中食物，估算1人份营养成分。` +
                  (hint ? `用户补充说明：「${hint}」，若与图片不冲突则优先结合说明估算。` : '') +
                  `如果图中有多道菜，请识别每一道菜并返回各自卡路里，同时返回整份餐食的总营养。` +
                  `你必须只返回严格JSON，不能返回markdown、不能包含代码块标记、不能有任何解释或额外文字。` +
                  `返回格式固定为：` +
                  `{"name":"整体餐食名称（中文，30字内）","calories":整数,"protein":整数,"carbs":整数,"fat":整数,` +
                  `"dishes":[{"name":"菜名1（10字内）","calories":整数},{"name":"菜名2","calories":整数}]}` +
                  `rules：calories/protein/carbs/fat为整份总量；dishes最多8项，只含name和calories；若只有一道菜dishes也保留1项；所有数值为整数；单位calories=千卡，protein/carbs/fat=克。`,
          },
        ],
      },
    ],
  })

  const apiRes = await httpsPost(QWEN_ENDPOINT, {
    Authorization: `Bearer ${QWEN_KEY}`,
  }, body)

  if (!apiRes.choices || !apiRes.choices[0]) {
    throw new Error('API 响应异常: ' + JSON.stringify(apiRes).slice(0, 200))
  }

  const nutrition = parseNutrition(apiRes.choices[0].message.content)
  if (!nutrition) {
    throw new Error('AI 返回格式异常: ' + apiRes.choices[0].message.content.slice(0, 200))
  }
  return nutrition
}

// ── 文字模式：单次识别 ─────────────────────────────────────
async function callQwenText(text) {
  const body = JSON.stringify({
    model: 'qwen-max',
    messages: [
      {
        role: 'user',
        content: `用户描述了一份食物，请根据描述估算1人份营养成分。` +
                 `食物描述：「${text}」` +
                 `你必须只返回严格JSON，不能返回markdown、不能包含代码块标记、不能有任何解释或额外文字。` +
                 `返回格式固定为：` +
                 `{"name":"食物名称（中文，20字内）","calories":整数,"protein":整数,"carbs":整数,"fat":整数,` +
                 `"dishes":[{"name":"菜名1","calories":整数}]}` +
                 `单位：calories=千卡，protein/carbs/fat=克，所有数值为整数。`,
      },
    ],
  })

  const apiRes = await httpsPost(QWEN_ENDPOINT, {
    Authorization: `Bearer ${QWEN_KEY}`,
  }, body)

  if (!apiRes.choices || !apiRes.choices[0]) {
    throw new Error('API 响应异常: ' + JSON.stringify(apiRes).slice(0, 200))
  }

  const nutrition = parseNutrition(apiRes.choices[0].message.content)
  if (!nutrition) {
    throw new Error('AI 返回格式异常: ' + apiRes.choices[0].message.content.slice(0, 200))
  }
  return nutrition
}

// ── 主函数 ────────────────────────────────────────────────
exports.main = async (event) => {
  const { fileID, hint = '', text = '', mode = 'image' } = event

  if (!QWEN_KEY) {
    return { success: false, error: 'QWEN_API_KEY 未配置' }
  }

  try {
    // ── 文字模式 ──
    if (mode === 'text') {
      if (!text.trim()) return { success: false, error: '文字描述不能为空' }
      let nutrition
      try {
        nutrition = await callQwenText(text)
      } catch (firstErr) {
        console.warn('[analyzeMeal] 文字模式首次失败，300ms 后重试:', firstErr.message)
        await delay(300)
        nutrition = await callQwenText(text)
      }
      return { success: true, ...nutrition }
    }

    // ── 图片模式 ──
    if (!fileID) return { success: false, error: 'fileID 不能为空' }

    // 1. 从云存储下载图片 → base64
    const dl     = await cloud.downloadFile({ fileID })
    const base64 = dl.fileContent.toString('base64')

    // 2. 调用 API，失败后等 800ms 自动重试一次
    let nutrition
    try {
      nutrition = await callQwen(base64, hint)
    } catch (firstErr) {
      console.warn('[analyzeMeal] 首次识别失败，300ms 后重试:', firstErr.message)
      await delay(300)
      nutrition = await callQwen(base64, hint)
    }

    return { success: true, ...nutrition }

  } catch (err) {
    console.error('[analyzeMeal] error:', err.message)
    return { success: false, error: err.message }
  }
}
