const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')

const SMOKE = process.argv.includes('--smoke')

ipcMain.on('offline:close', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (win) win.close()
})

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadFile(path.join(__dirname, '..', 'dist-offline', 'offline.html'))
  return win
}

app.whenReady().then(() => {
  const win = createWindow()
  if (SMOKE) {
    win.webContents.once('did-finish-load', async () => {
      try {
        const ok = await win.webContents.executeJavaScript(
          `!!document.querySelector('#root') && document.body.innerText.length > 0`,
        )
        console.log('SMOKE-RENDER:' + ok)
        process.exitCode = ok ? 0 : 1
      } catch (e) {
        console.log('SMOKE-ERROR:' + (e && e.message))
        process.exitCode = 1
      } finally {
        app.exit(process.exitCode ?? 1)
      }
    })
    setTimeout(() => { console.log('SMOKE-TIMEOUT'); app.exit(2) }, 45000).unref()
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
