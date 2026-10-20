const fs = require("node:fs");
const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  net,
  protocol,
  session,
  shell,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const steam = require("./steam.cjs");

const GAME_SCHEME = "game";
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
const APP_USER_MODEL_ID = "com.xingmingshuihu.game";
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self' ws://localhost:* http://localhost:*",
  "worker-src 'none'",
].join("; ");
const MIME_TYPES = {
  ".css": "text/css",
  ".html": "text/html",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: GAME_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow = null;
let quitting = false;

app.commandLine.appendSwitch(
  "disable-features",
  "WebBluetooth,WebHID,WebSerial,WebUSB",
);

function logDirectory() {
  return path.join(app.getPath("userData"), "logs");
}

function appendLog(level, event, details = null) {
  try {
    const directory = logDirectory();
    fs.mkdirSync(directory, { recursive: true });
    const record = {
      timestamp: new Date().toISOString(),
      level,
      event,
      details,
    };
    fs.appendFileSync(
      path.join(directory, "main.log"),
      `${JSON.stringify(record)}\n`,
      "utf8",
    );
    return true;
  } catch {
    return false;
  }
}

function safeDiagnostic(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function gameRoot() {
  return path.join(app.getAppPath(), "dist");
}

function registerGameProtocol() {
  protocol.handle(GAME_SCHEME, async (request) => {
    const requestUrl = new URL(request.url);
    let pathname = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
    if (!pathname || !path.extname(pathname)) pathname = "index.html";

    const root = path.resolve(gameRoot());
    const filePath = path.resolve(root, pathname);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const response = await net.fetch(pathToFileURL(filePath).toString());
      if (!response.ok) return response;
      const headers = new Headers(response.headers);
      headers.set(
        "Content-Type",
        MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      );
      headers.set("Cache-Control", app.isPackaged ? "public, max-age=31536000, immutable" : "no-store");
      headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
      headers.set("Cross-Origin-Opener-Policy", "same-origin");
      headers.set("Cross-Origin-Resource-Policy", "same-origin");
      headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), serial=()");
      headers.set("Referrer-Policy", "no-referrer");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("X-Frame-Options", "DENY");
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  });
}

function isSafeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function hardenSession(gameSession) {
  gameSession.setPermissionCheckHandler(() => false);
  gameSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  gameSession.setDevicePermissionHandler(() => false);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "星命水浒",
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    useContentSize: true,
    show: false,
    backgroundColor: "#080d0e",
    autoHideMenuBar: true,
    fullscreenable: true,
    icon: path.join(app.getAppPath(), "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      navigateOnDragDrop: false,
      webviewTag: false,
    },
  });

  mainWindow.setMenu(null);
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on("enter-full-screen", () => {
    mainWindow.webContents.send("shell:fullscreen", true);
  });
  mainWindow.on("leave-full-screen", () => {
    mainWindow.webContents.send("shell:fullscreen", false);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    appendLog("error", "renderer-process-gone", details);
  });
  mainWindow.webContents.on("unresponsive", () => {
    appendLog("error", "renderer-unresponsive");
  });
  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    appendLog("error", "preload-error", {
      preloadPath,
      error: safeDiagnostic(error),
    });
  });
  mainWindow.webContents.on("did-fail-load", (_event, code, description, url) => {
    appendLog("error", "did-fail-load", { code, description, url });
  });
  mainWindow.webContents.on("console-message", (details) => {
    const level = details.level || "info";
    if (level !== "error" && level !== "warning") return;
    appendLog(level, "renderer-console", details);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();
    const currentProtocol = currentUrl ? new URL(currentUrl).protocol : "";
    const nextProtocol = new URL(url).protocol;
    if (currentProtocol !== nextProtocol) {
      event.preventDefault();
      if (isSafeExternalUrl(url)) shell.openExternal(url);
    }
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
    if (!app.isPackaged && (input.control || input.meta) && input.shift && input.key.toLowerCase() === "i") {
      event.preventDefault();
      mainWindow.webContents.toggleDevTools();
    }
  });

  if (app.isPackaged) {
    mainWindow.loadURL(`${GAME_SCHEME}://app/index.html`);
  } else {
    mainWindow.loadURL(DEV_SERVER_URL);
  }
}

function registerIpc() {
  ipcMain.handle("shell:status", () => ({
    desktop: true,
    platform: process.platform,
    version: app.getVersion(),
    fullscreen: Boolean(mainWindow?.isFullScreen()),
    logDirectory: logDirectory(),
  }));
  ipcMain.handle("shell:set-fullscreen", (_event, value) => {
    if (!mainWindow) return false;
    mainWindow.setFullScreen(Boolean(value));
    return mainWindow.isFullScreen();
  });
  ipcMain.handle("shell:toggle-fullscreen", () => {
    if (!mainWindow) return false;
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    return mainWindow.isFullScreen();
  });
  ipcMain.handle("shell:quit", () => {
    quitting = true;
    app.quit();
  });
  ipcMain.handle("shell:open-external", (_event, url) => {
    if (!isSafeExternalUrl(url)) return false;
    shell.openExternal(url);
    return true;
  });
  ipcMain.handle("diagnostics:report", (_event, payload) => {
    const level = ["info", "warning", "error"].includes(payload?.level)
      ? payload.level
      : "info";
    const event = String(payload?.event || "renderer-event").slice(0, 160);
    appendLog(level, event, safeDiagnostic(payload?.details));
    return true;
  });
  ipcMain.handle("diagnostics:open-log-folder", async () => {
    const directory = logDirectory();
    fs.mkdirSync(directory, { recursive: true });
    const error = await shell.openPath(directory);
    return { ok: !error, error: error || null, directory };
  });
  ipcMain.handle("steam:status", () => steam.getStatus());
  ipcMain.handle("steam:achievements:unlock", (_event, ids) =>
    steam.unlockAchievements(ids),
  );
  ipcMain.handle("steam:stats:sync", (_event, values) => steam.syncStats(values));
  ipcMain.handle("steam:presence:set", (_event, values) => steam.setPresence(values));
  ipcMain.handle("steam:cloud:read", () => steam.readCloudSave());
  ipcMain.handle("steam:cloud:write", (_event, content) =>
    steam.writeCloudSave(content),
  );
  ipcMain.handle("steam:cloud:delete", () => steam.deleteCloudSave());
  ipcMain.handle("steam:overlay:achievements", () => steam.openAchievements());
}

process.on("uncaughtException", (error) => {
  appendLog("error", "uncaught-exception", safeDiagnostic(error));
});

process.on("unhandledRejection", (error) => {
  appendLog("error", "unhandled-rejection", safeDiagnostic(error));
});

steam.enableOverlay(app);
app.setAppUserModelId(APP_USER_MODEL_ID);

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    hardenSession(session.defaultSession);
    const steamStatus = steam.initialize(app);
    appendLog("info", "app-ready", {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      steam: steamStatus,
    });
    registerGameProtocol();
    registerIpc();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("before-quit", () => {
  appendLog("info", "app-quit");
});

app.on("window-all-closed", () => {
  if (quitting || process.platform !== "darwin") app.quit();
});
