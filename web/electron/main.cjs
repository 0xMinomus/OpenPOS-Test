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
        const seed = {
          app: 'openpos-offline', version: 1, exportedAt: new Date().toISOString(),
          data: {
            settings: { ownerName: 'Andika', storeName: 'Toko Uji', address: '', phone: '', receiptHeader: '', receiptFooter: '', paper: '58mm', timezone: 'Asia/Jakarta', taxEnabled: false, taxPct: 0 },
            categories: [{ id: 'c1', name: 'Minuman', active: true, created_at: new Date().toISOString() }],
            products: [{ id: 'p1', name: 'Aqua 600ml', sku: 'A-001', categoryId: 'c1', categoryName: 'Minuman', buyPrice: 3500, sellPrice: 4000, stock: 48, unit: 'botol', active: true, created_at: new Date().toISOString() }],
            transactions: [], movements: [], seq: 0,
          },
        }
        await win.webContents.executeJavaScript(`localStorage.setItem('op_offline_db', ${JSON.stringify(JSON.stringify(seed))})`)
        await win.webContents.executeJavaScript('location.reload()')
        await new Promise((r) => setTimeout(r, 4000))
        const ok = await win.webContents.executeJavaScript(
          `(() => { const t = document.body.innerText; return !!document.querySelector('#root') && (t.includes('Ringkasan toko') || t.includes('Selamat datang') || t.includes('Dashboard')) })()`,
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
