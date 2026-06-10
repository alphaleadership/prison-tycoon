const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SAVE_PATH = path.join(app.getPath('userData'), 'save.json');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile('index.html');
}

ipcMain.handle('save', (_e, data) => {
  fs.writeFileSync(SAVE_PATH, JSON.stringify(data, null, 2), 'utf8');
  return SAVE_PATH;
});

ipcMain.handle('load', () => {
  if (!fs.existsSync(SAVE_PATH)) return null;
  return JSON.parse(fs.readFileSync(SAVE_PATH, 'utf8'));
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
