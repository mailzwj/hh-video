const $ = id => document.getElementById(id)

const modelEl = $('model')
const imageGroup = $('imageGroup')
const ratioGroup = $('ratioGroup')
const promptEl = $('prompt')
const submitBtn = $('submitBtn')
const loadingEl = $('loading')
const pollingLoadingEl = $('pollingLoading')
const pollingStatusEl = $('pollingStatus')
const resultEl = $('result')
const requestIdEl = $('requestId')
const taskInfoEl = $('taskInfo')
const videoWrapper = $('videoWrapper')
const videoPlayer = $('videoPlayer')

let selectedImage = null
let polling = false

modelEl.addEventListener('change', () => {
  const isI2V = modelEl.value === 'happyhorse-1.0-i2v'
  imageGroup.classList.toggle('hidden', !isI2V)
  ratioGroup.classList.toggle('hidden', isI2V)
})

$('selectImageBtn').addEventListener('click', async () => {
  const base64 = await window.electronAPI.selectImage()
  if (!base64) return
  selectedImage = base64
  $('selectImageBtn').textContent = '已选择图片 ✓'
  $('imageName').classList.remove('hidden')
})

$('clearImageBtn').addEventListener('click', () => {
  selectedImage = null
  $('selectImageBtn').textContent = '选择图片'
  $('imageName').classList.add('hidden')
})

submitBtn.addEventListener('click', async () => {
  if (polling) return

  const model = modelEl.value
  const prompt = promptEl.value.trim()

  if (!prompt) { showResult('请输入提示词', 'error'); return }

  const isI2V = model === 'happyhorse-1.0-i2v'
  if (isI2V && !selectedImage) { showResult('图生视频模式请选择一张图片', 'error'); return }

  const settings = await window.electronAPI.loadSettings()
  const apiKey = (settings && settings.apiKey) || ''
  if (!apiKey) { showResult('请先在"HHVideo > 设置"中配置 API Key', 'error'); return }

  submitBtn.disabled = true
  polling = true
  loadingEl.classList.add('show')
  resultEl.classList.remove('show', 'success', 'error')
  requestIdEl.classList.remove('show')
  taskInfoEl.textContent = ''
  videoWrapper.classList.remove('show')
  pollingLoadingEl.classList.remove('show')

  try {
    const body = { model, input: { prompt } }

    if (isI2V) {
      body.input.media = [{ type: 'first_frame', url: selectedImage }]
    } else {
      const ratio = document.querySelector('input[name="ratio"]:checked').value
      body.parameters = { ratio }
    }

    const resolution = document.querySelector('input[name="resolution"]:checked').value
    const duration = parseInt(document.querySelector('input[name="duration"]:checked').value)
    body.parameters = { ...(body.parameters || {}), resolution, duration }

    const resp = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis', {
      method: 'POST',
      headers: {
        'X-DashScope-Async': 'enable',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    const data = await resp.json()

    if (data.code) {
      showResult(JSON.stringify(data, null, 2), 'error')
      return
    }

    const taskId = data.output && data.output.task_id
    if (!taskId) {
      showResult('创建任务成功但未获取到 task_id\n' + JSON.stringify(data, null, 2), 'error')
      return
    }

    requestIdEl.textContent = 'Request ID: ' + data.request_id
    requestIdEl.classList.add('show')

    loadingEl.classList.remove('show')
    pollingLoadingEl.classList.add('show')
    pollingStatusEl.textContent = '任务已提交，正在查询状态...'

    await pollTask(apiKey, taskId)
  } catch (err) {
    showResult('请求失败: ' + err.message, 'error')
    polling = false
    submitBtn.disabled = false
    loadingEl.classList.remove('show')
    pollingLoadingEl.classList.remove('show')
  }
})

async function pollTask(apiKey, taskId) {
  const POLL_INTERVAL = 3000
  const MAX_RETRIES = 300
  let retries = 0

  while (retries < MAX_RETRIES) {
    retries++
    pollingStatusEl.textContent = `查询任务状态中... (${retries})`

    try {
      const resp = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })

      const data = await resp.json()
      const output = data.output || {}
      const status = output.task_status

      switch (status) {
        case 'PENDING':
        case 'RUNNING':
          taskInfoEl.textContent = `任务状态: ${status}，已等待 ${Math.round(retries * POLL_INTERVAL / 1000)}s`
          break

        case 'SUCCEEDED':
          pollingLoadingEl.classList.remove('show')
          taskInfoEl.textContent = ''
          if (output.video_url) {
            videoPlayer.src = output.video_url
            videoWrapper.classList.add('show')
            showResult('视频生成成功！', 'success')
          } else {
            showResult('任务成功但未返回视频地址\n' + JSON.stringify(data, null, 2), 'success')
          }
          endPoll()
          return

        case 'FAILED':
          pollingLoadingEl.classList.remove('show')
          const errCode = output.code || ''
          const errMsg = output.message || '未知错误'
          showResult(`任务失败\n${errCode ? '错误码: ' + errCode + '\n' : ''}错误信息: ${errMsg}`, 'error')
          endPoll()
          return

        case 'UNKNOWN':
          pollingLoadingEl.classList.remove('show')
          showResult('任务状态未知(UNKNOWN)\n' + JSON.stringify(data, null, 2), 'error')
          endPoll()
          return

        default:
          if (data.code) {
            pollingLoadingEl.classList.remove('show')
            showResult('查询任务失败\n' + JSON.stringify(data, null, 2), 'error')
            endPoll()
            return
          }
      }
    } catch (err) {
      taskInfoEl.textContent = `查询异常: ${err.message}，正在重试...`
    }

    await sleep(POLL_INTERVAL)
  }

  pollingLoadingEl.classList.remove('show')
  showResult('轮询超时，任务处理时间过长，请稍后查询 task_id: ' + taskId, 'error')
  endPoll()
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function endPoll() {
  polling = false
  submitBtn.disabled = false
  pollingLoadingEl.classList.remove('show')
}

function showResult(msg, type) {
  resultEl.textContent = msg
  resultEl.className = 'result show ' + type
}

window.electronAPI.onOpenSettings((settings) => {
  $('settingsOverlay').classList.remove('hidden')
  $('settingsApiKey').value = (settings && settings.apiKey) || ''
  $('settingsApiKey').focus()
})

$('settingsSaveBtn').addEventListener('click', async () => {
  const apiKey = $('settingsApiKey').value.trim()
  await window.electronAPI.saveSettings({ apiKey })
  $('settingsOverlay').classList.add('hidden')
})

$('settingsCancelBtn').addEventListener('click', () => {
  $('settingsOverlay').classList.add('hidden')
})

$('settingsOverlay').addEventListener('click', (e) => {
  if (e.target === $('settingsOverlay')) $('settingsOverlay').classList.add('hidden')
})
