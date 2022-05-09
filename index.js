const
  path = require("path"),
  fs = require("fs"),
  { app, BrowserWindow } = require('electron');

const app_module = require('./modules/app.js');

const App = new app_module({
  develop: {
    enable: process.argv.includes('--develop'),
    minecraft: false,
    frame: true,
    titleBarStyle: 'default'
  }
});

if (App.setupAutoUpdater()) App.init();

const allowedModules = new Set([]);
const proxiedModules = new Set(['fs', 'mineflayer']);
const allowedElectronModules = new Set(['shell'])
const allowedGlobals = new Set();

app.on('remote-require', (event, webContents, moduleName) => {
  if (proxiedModules.has(moduleName)) {
    event.returnValue = require(moduleName);
  }
  if (!allowedModules.has(moduleName)) {
    event.preventDefault()
  }
});

app.on('remote-get-builtin', (event, webContents, moduleName) => {
  if (!allowedElectronModules.has(moduleName)) {
    event.preventDefault()
  }
});

app.on('remote-get-global', (event, webContents, globalName) => {
  if (!allowedGlobals.has(globalName)) {
    console.log(`RemoveGetGlobal`);
    event.preventDefault();
  } else console.log(`RemoveGetGlobal`);
});

app.on('remote-get-current-window', (event, webContents) => {
  console.log(`RemoveGetCurrentWindow`.red);
  event.preventDefault();
});

app.on('remote-get-current-web-contents', (event, webContents) => {
  event.preventDefault();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
});


// reg ADD "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\ActiveDesktop" /v "NoChangingWallPaper" /t REG_DWORD /d 0
// reg ADD "HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\ActiveDesktop" /v "NoChangingWallPaper" /t REG_DWORD /d 0