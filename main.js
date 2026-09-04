const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const bluetooth = require('./bluetooth');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.removeMenu();

  // The Help links (and the logo) point at mecoffee.nl with target="_blank".
  // Send those to the system browser instead of letting Electron open its
  // own window for them - that old site's own console noise has no reason
  // to run inside this app's window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);

    return { action: 'deny' };
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow();
  });
});

app.on('window-all-closed', () => {
  bluetooth.disconnect().catch(() => {});

  if (process.platform !== 'darwin')
    app.quit();
});

app.on('before-quit', () => {
  bluetooth.disconnect().catch(() => {});
});

ipcMain.handle('bt:list-devices', async () => {
  try {
    return { success: true, devices: await bluetooth.listPairedDevices() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('bt:connect', async (event, deviceName) => {
  try {
    await bluetooth.connect(deviceName, (data) => {
      if (mainWindow)
        mainWindow.webContents.send('bt:data', data);
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('bt:disconnect', async () => {
  await bluetooth.disconnect();

  return { success: true };
});

ipcMain.handle('bt:send', async (event, line) => {
  try {
    await bluetooth.send(line);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
