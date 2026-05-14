const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
    }
  } catch (_) { /* ignore */ }
  return { apiKey: '' }
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
}

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 860,
    resizable: false,
    title: 'HHVideo',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  mainWindow.loadFile('index.html')

  const menu = Menu.buildFromTemplate([
    {
      label: 'HHVideo',
      submenu: [
        { label: '设置', accelerator: 'CmdOrCtrl+,', click: () => openSettings() },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于 HHVideo', click: () => {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: '关于 HHVideo',
            message: 'HHVideo v1.0.0',
            detail: '基于阿里云百炼视频生成 API 的客户端应用'
          })
        }}
      ]
    }
  ])
  Menu.setApplicationMenu(menu)
}

function openSettings() {
  const settings = loadSettings()
  mainWindow.webContents.send('open-settings', settings)
}

ipcMain.handle('load-settings', () => loadSettings())

ipcMain.handle('save-settings', (_, settings) => {
  saveSettings(settings)
})

ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const data = fs.readFileSync(filePath)
  const ext = path.extname(filePath).slice(1)
  const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' }
  const base64 = `data:${mime[ext] || 'image/png'};base64,${data.toString('base64')}`
  return base64
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
