const { contextBridge, ipcRenderer } = require("electron");

const shellBridge = Object.freeze({
  isDesktop: true,
  platform: process.platform,
  getStatus: () => ipcRenderer.invoke("shell:status"),
  setFullscreen: (value) => ipcRenderer.invoke("shell:set-fullscreen", Boolean(value)),
  toggleFullscreen: () => ipcRenderer.invoke("shell:toggle-fullscreen"),
  quit: () => ipcRenderer.invoke("shell:quit"),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", String(url)),
  onFullscreenChanged: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, value) => callback(Boolean(value));
    ipcRenderer.on("shell:fullscreen", listener);
    return () => ipcRenderer.removeListener("shell:fullscreen", listener);
  },
});

const steamBridge = Object.freeze({
  getStatus: () => ipcRenderer.invoke("steam:status"),
  unlockAchievements: (ids) =>
    ipcRenderer.invoke("steam:achievements:unlock", Array.isArray(ids) ? ids : []),
  syncStats: (values) => ipcRenderer.invoke("steam:stats:sync", values || {}),
  setPresence: (values) =>
    ipcRenderer.invoke("steam:presence:set", values || {}),
  readCloudSave: () => ipcRenderer.invoke("steam:cloud:read"),
  writeCloudSave: (content) =>
    ipcRenderer.invoke("steam:cloud:write", String(content ?? "")),
  deleteCloudSave: () => ipcRenderer.invoke("steam:cloud:delete"),
  openAchievements: () => ipcRenderer.invoke("steam:overlay:achievements"),
});

const diagnosticsBridge = Object.freeze({
  report: (level, event, details) =>
    ipcRenderer.invoke("diagnostics:report", {
      level: String(level || "info"),
      event: String(event || "renderer-event"),
      details,
    }),
  openLogFolder: () => ipcRenderer.invoke("diagnostics:open-log-folder"),
});

contextBridge.exposeInMainWorld("gameShell", shellBridge);
contextBridge.exposeInMainWorld("gameSteam", steamBridge);
contextBridge.exposeInMainWorld("gameDiagnostics", diagnosticsBridge);
