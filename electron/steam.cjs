const fs = require("node:fs");
const path = require("node:path");

const MAX_CLOUD_SAVE_BYTES = 1024 * 1024;
const PRESENCE_KEYS = new Set(["status", "mode", "chapter", "progress"]);

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "steam", "steamworks.json"), "utf8"),
);

let client = null;
let status = {
  available: false,
  reason: "not-initialized",
  appId: null,
  playerName: null,
  steamId: null,
  cloudEnabled: false,
  overlayRequested: false,
  overlayError: null,
};

function resolveAppId(app) {
  const fromEnv = Number(process.env.STEAM_APP_ID);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv;

  const candidates = [
    path.join(app.getAppPath(), "steam_appid.txt"),
    path.join(app.getAppPath(), "steam", "steam_appid.txt"),
    path.join(process.cwd(), "steam_appid.txt"),
    path.join(process.cwd(), "steam", "steam_appid.txt"),
  ];
  for (const candidate of candidates) {
    try {
      const value = Number(fs.readFileSync(candidate, "utf8").trim());
      if (Number.isInteger(value) && value > 0) return value;
    } catch {
      // A Steam AppID is optional outside Steam builds.
    }
  }
  return null;
}

function enableOverlay(app) {
  if (!resolveAppId(app)) return false;
  try {
    const steamworks = require("steamworks.js");
    steamworks.electronEnableSteamOverlay();
    status.overlayRequested = true;
    return true;
  } catch (error) {
    status.overlayError = String(error?.message || error);
    return false;
  }
}

function initialize(app) {
  const appId = resolveAppId(app);
  if (!appId) {
    status = {
      ...status,
      available: false,
      reason: "missing-app-id",
      appId: null,
    };
    return getStatus();
  }

  try {
    const steamworks = require("steamworks.js");
    client = steamworks.init(appId);
    const steamId = client.localplayer.getSteamId();
    status = {
      ...status,
      available: true,
      reason: "ready",
      appId,
      playerName: client.localplayer.getName(),
      steamId: String(steamId.steamId64),
      cloudEnabled: Boolean(
        client.cloud.isEnabledForAccount() && client.cloud.isEnabledForApp(),
      ),
    };
  } catch (error) {
    client = null;
    status = {
      ...status,
      available: false,
      reason: "steam-unavailable",
      appId,
      error: String(error?.message || error),
      cloudEnabled: false,
    };
  }
  return getStatus();
}

function getStatus() {
  return { ...status };
}

function unlockAchievements(ids) {
  if (!client || !Array.isArray(ids)) {
    return { ok: false, unlocked: [], reason: status.reason };
  }
  const unlocked = [];
  for (const id of ids) {
    const apiName = config.achievements[id];
    if (!apiName || typeof client.achievement?.activate !== "function") continue;
    try {
      if (client.achievement.activate(apiName)) unlocked.push(id);
    } catch {
      // Steam may be shutting down or the backend may not yet define the achievement.
    }
  }
  if (unlocked.length) client.stats?.store?.();
  return { ok: true, unlocked };
}

function syncStats(values) {
  if (!client || !values || typeof values !== "object") {
    return { ok: false, updated: [], reason: status.reason };
  }
  const updated = [];
  for (const [key, apiName] of Object.entries(config.stats)) {
    const value = Number(values[key]);
    if (!Number.isFinite(value) || typeof client.stats?.setInt !== "function") continue;
    try {
      if (client.stats.setInt(apiName, Math.max(0, Math.trunc(value)))) {
        updated.push(key);
      }
    } catch {
      // Keep local progression authoritative when Steam rejects a stat.
    }
  }
  if (updated.length) client.stats.store();
  return { ok: true, updated };
}

function setPresence(values) {
  if (!client || !values || typeof values !== "object") {
    return { ok: false, reason: status.reason };
  }
  try {
    for (const [key, value] of Object.entries(values)) {
      if (!PRESENCE_KEYS.has(key)) continue;
      client.localplayer.setRichPresence(key, String(value).slice(0, 120));
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: String(error?.message || error) };
  }
}

function readCloudSave() {
  if (!client || !status.cloudEnabled) {
    return { ok: false, exists: false, reason: "cloud-disabled" };
  }
  try {
    if (!client.cloud.fileExists(config.cloudSaveFile)) {
      return { ok: true, exists: false, content: null };
    }
    return {
      ok: true,
      exists: true,
      content: client.cloud.readFile(config.cloudSaveFile),
    };
  } catch (error) {
    return { ok: false, exists: false, reason: String(error?.message || error) };
  }
}

function writeCloudSave(content) {
  if (!client || !status.cloudEnabled) {
    return { ok: false, reason: "cloud-disabled" };
  }
  if (typeof content !== "string" || Buffer.byteLength(content, "utf8") > MAX_CLOUD_SAVE_BYTES) {
    return { ok: false, reason: "invalid-save" };
  }
  try {
    return {
      ok: client.cloud.writeFile(config.cloudSaveFile, content),
      reason: null,
    };
  } catch (error) {
    return { ok: false, reason: String(error?.message || error) };
  }
}

function deleteCloudSave() {
  if (!client || !status.cloudEnabled) {
    return { ok: false, reason: "cloud-disabled" };
  }
  try {
    if (!client.cloud.fileExists(config.cloudSaveFile)) return { ok: true };
    return { ok: client.cloud.deleteFile(config.cloudSaveFile), reason: null };
  } catch (error) {
    return { ok: false, reason: String(error?.message || error) };
  }
}

function openAchievements() {
  if (!client) return { ok: false, reason: status.reason };
  try {
    client.overlay.activateDialog(client.overlay.Dialog.Achievements);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: String(error?.message || error) };
  }
}

module.exports = {
  config,
  deleteCloudSave,
  enableOverlay,
  getStatus,
  initialize,
  openAchievements,
  readCloudSave,
  setPresence,
  syncStats,
  unlockAchievements,
  writeCloudSave,
};
