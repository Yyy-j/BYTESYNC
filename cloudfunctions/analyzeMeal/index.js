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

// ── 从 AI 返回文本中提取营养 JSON ──────────────────────────
function parseNutrition(content) {
  // 尽量宽松匹配 {...}，防止 AI 在 JSON 外加文字
  const match = content.match(/\{[^{}]*\}/)
  if (!match) return null
  try {
    const obj = JSON.parse(match[0])
    return {
      name:     String(obj.name     || '未知食物').slice(0, 20),
      calories: Math.round(Number(obj.calories) || 0),
      protein:  Math.round(Number(obj.protein)  || 0),
      carbs:    Math.round(Number(obj.carbs)     || 0),
      fat:      Math.round(Number(obj.fat)       || 0),
    }
  } catch {
    return null
  }
}

// ── 主函数 ────────────────────────────────────────────────
exports.main = async (event) => {
  const { fileID, hint = '' } = event

  if (!QWEN_KEY) {
    return { success: false, error: 'QWEN_API_KEY 未配置' }
  }

  try {
    // 1. 从云存储下载图片 → base64
    const dl     = await cloud.downloadFile({ fileID })
    const base64 = dl.fileContent.toString('base64')

    // 2. 组装 Qwen VL Plus 请求
    const body = JSON.stringify({
      model: 'qwen-vl-plus',
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
              text: `请识别图中食物，估算1人份营养成分。${hint ? `用户补充说明：「${hint}」，请结合图片和说明（若不冲突则优先采纳说明）估算。` : ''}只返回如下JSON，不要任何额外文字：{"name":"食物名（中文10字内）","calories":数字,"protein":数字,"carbs":数字,"fat":数字}。单位：calories=千卡，protein/carbs/fat=克，均为整数。`,
            },
          ],
        },
      ],
    })

    // 3. 调用 API
    const apiRes = await httpsPost(QWEN_ENDPOINT, {
      Authorization: `Bearer ${QWEN_KEY}`,
    }, body)

    if (!apiRes.choices || !apiRes.choices[0]) {
      throw new Error('API 响应异常: ' + JSON.stringify(apiRes).slice(0, 200))
    }

    const content   = apiRes.choices[0].message.content
    const nutrition = parseNutrition(content)

    if (!nutrition) {
      throw new Error('AI 返回格式异常: ' + content.slice(0, 200))
    }

    return { success: true, ...nutrition }

  } catch (err) {
    console.error('[analyzeMeal] error:', err.message)
    return { success: false, error: err.message }
  }
}
