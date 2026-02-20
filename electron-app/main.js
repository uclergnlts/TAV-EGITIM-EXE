const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');

// Check if running in development mode
const isDev = process.env.NODE_ENV === 'development' || 
               process.argv.includes('--dev') ||
               !app.isPackaged;

let mainWindow;
let serverProcess = null;
const APP_HOST = '127.0.0.1';
let runtimePort = 0;

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function resolveServerEntry() {
  const candidates = [
    // electron-builder (asar: false) typical
    path.join(process.resourcesPath, 'app', '.next', 'standalone', 'server.js'),
    // electron-packager / local project run from electron-app
    path.join(__dirname, '..', '.next', 'standalone', 'server.js'),
    // standalone copied into electron-app folder
    path.join(__dirname, '.next', 'standalone', 'server.js'),
    // custom dist packaging fallback
    path.join(__dirname, '..', 'dist', 'app', 'server.js'),
  ];

  return candidates.find(fileExists);
}

function resolveBundledDb() {
  const candidates = [
    path.join(process.resourcesPath, 'app', 'local.db'),
    path.join(__dirname, 'local.db'),
    path.join(__dirname, '..', 'local.db'),
  ];
  return candidates.find(fileExists);
}

function resolveSourceStaticDir() {
  const candidates = [
    path.join(process.resourcesPath, 'app', '.next', 'static'),
    path.join(__dirname, '.next', 'static'),
    path.join(__dirname, '..', '.next', 'static'),
  ];
  return candidates.find(fileExists);
}

function resolveSourcePublicDir() {
  const candidates = [
    path.join(process.resourcesPath, 'app', 'public'),
    path.join(__dirname, 'public'),
    path.join(__dirname, '..', 'public'),
  ];
  return candidates.find(fileExists);
}

function ensureStandaloneAssets(serverEntry) {
  const standaloneRoot = path.dirname(serverEntry);
  const targetStaticDir = path.join(standaloneRoot, '.next', 'static');
  const targetPublicDir = path.join(standaloneRoot, 'public');

  const sourceStaticDir = resolveSourceStaticDir();
  const sourcePublicDir = resolveSourcePublicDir();

  if (sourceStaticDir) {
    fs.mkdirSync(path.dirname(targetStaticDir), { recursive: true });
    fs.cpSync(sourceStaticDir, targetStaticDir, { recursive: true, force: true });
  }
  if (sourcePublicDir) {
    fs.cpSync(sourcePublicDir, targetPublicDir, { recursive: true, force: true });
  }
}

function prepareRuntimeDb() {
  const bundledDb = resolveBundledDb();
  if (!bundledDb) {
    throw new Error('Paket icinde local.db bulunamadi.');
  }

  const userDbDir = app.getPath('userData');
  const userDbPath = path.join(userDbDir, 'local.db');

  if (!fileExists(userDbPath) || fs.statSync(userDbPath).size === 0) {
    fs.mkdirSync(userDbDir, { recursive: true });
    fs.copyFileSync(bundledDb, userDbPath);
  }

  return userDbPath;
}

function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else if (Date.now() - started > timeoutMs) {
          reject(new Error(`Server did not become ready (${res.statusCode})`));
        } else {
          setTimeout(attempt, 500);
        }
      });

      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error('Server did not become ready in time'));
        } else {
          setTimeout(attempt, 500);
        }
      });

      req.setTimeout(2000, () => req.destroy());
    };

    attempt();
  });
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, APP_HOST, () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : 0;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        if (!port) {
          reject(new Error('Bos port bulunamadi.'));
          return;
        }
        resolve(port);
      });
    });
  });
}

async function startEmbeddedServer() {
  const serverEntry = resolveServerEntry();
  if (!serverEntry) {
    throw new Error('Next standalone server.js bulunamadi. Build paketine .next/standalone dahil edilmeli.');
  }
  ensureStandaloneAssets(serverEntry);
  const runtimeDbPath = prepareRuntimeDb();
  runtimePort = await getAvailablePort();

  // Use the Electron binary as node runtime
  serverProcess = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(runtimePort),
      HOSTNAME: APP_HOST,
      TURSO_DATABASE_URL: pathToFileURL(runtimeDbPath).href,
    },
    stdio: 'ignore',
    windowsHide: true,
  });

  serverProcess.on('error', (err) => {
    console.error('Embedded server process error:', err);
  });

  await waitForServer(`http://${APP_HOST}:${runtimePort}`);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    title: 'TAV Eğitim Sistemi'
  });

  // Load the app
  if (isDev) {
    // Development: Load from Next.js dev server
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Start standalone Next server and connect via HTTP
    try {
      await mainWindow.webContents.session.clearCache();
      await startEmbeddedServer();
      await mainWindow.loadURL(`http://${APP_HOST}:${runtimePort}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to start production app:', message);
      dialog.showErrorBox('Uygulama Başlatılamadı', message);
      mainWindow.loadURL('data:text/plain;charset=utf-8,Uygulama baslatilamadi. Lutfen paketlemeyi kontrol edin.');
    }
  }

  // Create menu
  const template = [
    {
      label: 'Dosya',
      submenu: [
        {
          label: 'Çıkış',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Düzen',
      submenu: [
        { label: 'Geri Al', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Yinele', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Kes', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Kopyala', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Yapıştır', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: 'Görünüm',
      submenu: [
        { label: 'Yenile', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Geliştirici Araçları', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Tam Ekran', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Yardım',
      submenu: [
        {
          label: 'Hakkında',
          click: () => {
            shell.openExternal('https://github.com/tav-egitim');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {}
    serverProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });
});
