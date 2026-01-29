const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  screen,
  nativeImage,
  nativeTheme,
} = require("electron");
const path = require("path");
const si = require("systeminformation");

let mainWindow;
let tray;
let trayAnimationInterval;

const w = 300;
const h = 300;

const trayFrames = [
  "icon-0.png",
  "icon-1.png",
  "icon-2.png",
  "icon-3.png",
  "icon-4.png",
  "icon-5.png",
  "icon-6.png",
  "icon-7.png",
];

// 👇 Funzione per creare la finestra principale
function createWindow() {
  mainWindow = new BrowserWindow({
    width: w,
    height: h,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  // mainWindow.setPosition(1200, 800, true);
  mainWindow.loadFile("renderer/index.html");
  return mainWindow;
}

// 👇 Finestra delle impostazioni
function createSettingsWindow() {
  const win = new BrowserWindow({
    width: 300,
    height: 300,
    title: "Index Settings",
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile("renderer/settings.html");
}

// ✅ Funzione per ridimensionare e animare la tray icon
function animateTrayIcon() {
  let frame = 0;

  trayAnimationInterval = setInterval(() => {
    const iconPath = path.join(__dirname, "assets", trayFrames[frame]);
    const image = nativeImage
      .createFromPath(iconPath)
      .resize({ width: 16, height: 16 });
    tray.setImage(image);
    frame = (frame + 1) % trayFrames.length;
  }, 250);
}

// 👇 Se vuoi anche animare la finestra (bouncing)
function animateWindow(win) {
  const display = screen.getPrimaryDisplay();
  const screenWidth = display.workArea.width;
  const screenHeight = display.workArea.height;

  let x = 2;
  let y = 2;
  let dx = 2;
  let dy = 2;
  const width = w;
  const height = h;

  setInterval(() => {
    x += dx;
    y += dy;

    if (x <= 0 || x + width >= screenWidth) dx *= -1;
    if (y <= 0 || y + height >= screenHeight) dy *= -1;

    win.setBounds({ x, y, width, height });
  }, 16);
}

// ✅ Funzioni esposte via ipc
ipcMain.handle("get-battery", async () => await si.battery());
ipcMain.handle("get-cpu", async () => await si.currentLoad());
ipcMain.handle("get-mem", async () => await si.mem());
ipcMain.handle("get-cpu-info", async () => await si.cpu());
ipcMain.handle("get-processes", async () => await si.processes());
ipcMain.handle("get-time-info", async () => await si.time());
ipcMain.handle("get-mouse-position", () => screen.getCursorScreenPoint());

app.whenReady().then(() => {
  // Inizializza tray icon
  const initialIcon = nativeImage
    .createFromPath(path.join(__dirname, "assets", "icon-0.png"))
    .resize({ width: 16, height: 16 });

  tray = new Tray(initialIcon);
  tray.setToolTip("Is active!");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { 
        label: "Purple", 
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send("animation-mode", "purple");
          }
        }
      },
      { 
        label: "Green", 
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send("animation-mode", "green");
          }
        }
      },
      { type: "separator" },
      { label: "Quit", role: "quit" },
    ])
  );

  const win = createWindow();
  //animateWindow(win); // attivazione movimento opzionale

  animateTrayIcon(); // 🌀 Avvia animazione tray icon

  ipcMain.on("open-mouse-position", () => {
    createMousePositionWindow(); // se esiste
  });
});

// ✅ Chiudi tutto
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
