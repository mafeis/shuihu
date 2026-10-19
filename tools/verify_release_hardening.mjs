#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const checks = [];

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (condition) checks.push(message);
  else failures.push(message);
}

const packageJson = JSON.parse(read("package.json"));
const indexHtml = read("index.html");
const electronMain = read("electron/main.cjs");
const viteConfig = read("vite.config.js");
const webManifest = JSON.parse(read("public/manifest.webmanifest"));
const serviceWorker = read("public/sw.js");
const mainSource = read("src/main.js");
const entitlementsPath = "build/entitlements.mac.plist";
const inheritEntitlementsPath = "build/entitlements.mac.inherit.plist";
const macSigningHookPath = "tools/after-pack-macos.mjs";

assert(packageJson.private === true, "package must remain private");
assert(
  packageJson.build?.asar === true,
  "desktop packages must use ASAR",
);
assert(
  packageJson.build?.files?.includes("dist/**/*"),
  "desktop package must include the current production build",
);
assert(
  viteConfig.includes('publicDir: "public"'),
  "Vite must copy packaged legal notices from public/",
);

const cspMatch = indexHtml.match(
  /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/,
);
const indexCsp = cspMatch?.[1] || "";
for (const directive of [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "script-src 'self'",
  "worker-src 'self'",
]) {
  assert(indexCsp.includes(directive), `index.html CSP missing: ${directive}`);
}
assert(
  indexHtml.includes('rel="manifest" href="/manifest.webmanifest"'),
  "browser build must expose a Web App Manifest",
);
assert(
  indexHtml.includes('rel="apple-touch-icon" href="/app-icon-192.png"'),
  "browser build must expose an install icon",
);
assert(
  mainSource.includes('navigator.serviceWorker.register("/sw.js"'),
  "production browser build must register the offline service worker",
);
assert(
  mainSource.includes("import.meta.env.PROD"),
  "service worker registration must stay disabled in development",
);
assert(
  serviceWorker.includes("self.addEventListener(\"fetch\""),
  "offline service worker must intercept runtime requests",
);
assert(
  serviceWorker.includes("url.pathname === \"/sw.js\""),
  "offline service worker must never intercept its own update request",
);
assert(
  serviceWorker.includes("request.headers.has(\"range\")"),
  "offline service worker must leave byte-range media requests to the server",
);
assert(
  webManifest.id === "/" &&
    webManifest.start_url === "/" &&
    webManifest.scope === "/",
  "Web App Manifest must use the root scope",
);
assert(
  webManifest.display === "standalone",
  "Web App Manifest must support standalone installation",
);
assert(
  webManifest.icons?.some(
    (icon) => icon.sizes === "192x192" && icon.type === "image/png",
  ) &&
    webManifest.icons?.some(
      (icon) => icon.sizes === "512x512" && icon.type === "image/png",
    ),
  "Web App Manifest must include 192px and 512px PNG icons",
);
for (const iconPath of ["public/app-icon-192.png", "public/app-icon-512.png"]) {
  assert(existsSync(path.join(root, iconPath)), `missing ${iconPath}`);
}

const legalPages = [
  "public/legal/privacy.html",
  "public/legal/eula.html",
  "public/legal/support.html",
  "public/legal/refund.html",
];
for (const legalPage of legalPages) {
  assert(existsSync(path.join(root, legalPage)), `missing ${legalPage}`);
  if (existsSync(path.join(root, legalPage))) {
    const source = read(legalPage);
    assert(
      source.includes("/legal/legal.css"),
      `${legalPage} must load the shared release stylesheet`,
    );
    assert(
      !/\bTODO\b|待填写/.test(source),
      `${legalPage} contains unresolved placeholders`,
    );
  }
}
assert(
  serviceWorker.includes("/legal/privacy.html") &&
    serviceWorker.includes("/legal/eula.html") &&
    serviceWorker.includes("/legal/support.html") &&
    serviceWorker.includes("/legal/refund.html"),
  "offline service worker must cache every browser release document",
);

for (const directive of [
  "Content-Security-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
]) {
  assert(
    electronMain.includes(`headers.set("${directive}"`),
    `custom protocol response missing security header: ${directive}`,
  );
}
assert(
  !/Permissions-Policy"[^\n]*\b(?:usb|hid)=\(\)/.test(electronMain),
  "Permissions-Policy omits unrecognized usb/hid features",
);

for (const requirement of [
  ["setPermissionCheckHandler(() => false)", "permission checks are denied"],
  [
    "setPermissionRequestHandler((_webContents, _permission, callback)",
    "permission requests are denied",
  ],
  ["setDevicePermissionHandler(() => false)", "device permissions are denied"],
  ["app.setAppUserModelId(APP_USER_MODEL_ID)", "Windows AppUserModelID is set"],
  ["contextIsolation: true", "context isolation is enabled"],
  ["nodeIntegration: false", "Node integration is disabled"],
  ["sandbox: true", "renderer sandbox is enabled"],
  ["webSecurity: true", "web security is enabled"],
  ["navigateOnDragDrop: false", "drag-and-drop navigation is disabled"],
  ["webviewTag: false", "webview tag is disabled"],
  ["url.protocol === \"https:\" || url.protocol === \"http:\"", "external links are protocol-restricted"],
  ["WebBluetooth,WebHID,WebSerial,WebUSB", "unused device APIs are disabled"],
]) {
  assert(electronMain.includes(requirement[0]), requirement[1]);
}

assert(
  packageJson.build?.mac?.hardenedRuntime === true,
  "macOS hardened runtime must be enabled",
);
assert(
  packageJson.build?.mac?.identity === "-",
  "macOS public candidate must use an explicit ad-hoc identity",
);
assert(
  packageJson.build?.mac?.minimumSystemVersion === "13.0",
  "macOS candidate must retain its declared macOS 13.0 minimum",
);
assert(
  packageJson.build?.mac?.notarize === false,
  "an ad-hoc candidate must not request notarization",
);
assert(
  packageJson.build?.mac?.entitlements === entitlementsPath,
  "macOS main executable entitlements are not configured",
);
assert(
  packageJson.build?.mac?.entitlementsInherit === inheritEntitlementsPath,
  "macOS inherited entitlements are not configured",
);
assert(
  packageJson.build?.afterPack === `./${macSigningHookPath}`,
  "macOS afterPack signing hook is not configured",
);
assert(
  existsSync(path.join(root, macSigningHookPath)),
  `missing ${macSigningHookPath}`,
);
if (existsSync(path.join(root, macSigningHookPath))) {
  const macSigningHook = read(macSigningHookPath);
  for (const requirement of [
    "signAsync",
    'identity: "-"',
    "identityValidation: false",
    "preAutoEntitlements: false",
    "hardenedRuntime: true",
    'timestamp: "none"',
    "mainEntitlements",
    "inheritEntitlements",
    "codesign",
    "--verify",
  ]) {
    assert(
      macSigningHook.includes(requirement),
      `macOS signing hook is missing: ${requirement}`,
    );
  }
}
for (const entitlementPath of [entitlementsPath, inheritEntitlementsPath]) {
  assert(
    existsSync(path.join(root, entitlementPath)),
    `missing ${entitlementPath}`,
  );
}
for (const entitlementPath of [entitlementsPath, inheritEntitlementsPath]) {
  if (!existsSync(path.join(root, entitlementPath))) continue;
  const entitlements = read(entitlementPath);
  const requiredEntitlements = [
    "com.apple.security.cs.allow-jit",
    "com.apple.security.cs.allow-unsigned-executable-memory",
    "com.apple.security.cs.disable-library-validation",
  ];
  if (entitlementPath === entitlementsPath) {
    requiredEntitlements.push(
      "com.apple.security.cs.allow-dyld-environment-variables",
    );
  }
  for (const entitlement of requiredEntitlements) {
    assert(
      entitlements.includes(entitlement),
      `macOS ${entitlementPath} missing: ${entitlement}`,
    );
  }
}

assert(
  Array.isArray(packageJson.build?.win?.signtoolOptions?.signingHashAlgorithms) &&
    packageJson.build.win.signtoolOptions.signingHashAlgorithms.length === 1 &&
    packageJson.build.win.signtoolOptions.signingHashAlgorithms[0] === "sha256",
  "Windows signing must use SHA-256 only",
);
assert(
  /^https?:\/\//.test(
    packageJson.build?.win?.signtoolOptions?.rfc3161TimeStampServer || "",
  ),
  "Windows Authenticode RFC 3161 timestamp server is not configured",
);

const noticesPath = "public/THIRD_PARTY_NOTICES.txt";
assert(existsSync(path.join(root, noticesPath)), `missing ${noticesPath}`);
if (existsSync(path.join(root, noticesPath))) {
  const notices = read(noticesPath);
  for (const component of [
    "Electron",
    "Chromium",
    "steamworks.js",
    "Valve Steamworks SDK",
    "Lucide icons",
  ]) {
    assert(
      notices.includes(component),
      `third-party notices missing component: ${component}`,
    );
  }
  assert(
    !/\bTODO\b|待填写/.test(notices),
    "third-party notices contain unresolved placeholders",
  );
}

assert(
  electronMain.includes("CONTENT_SECURITY_POLICY"),
  "packaged protocol does not apply the shared CSP",
);
assert(
  electronMain.includes("\"frame-ancestors 'none'\""),
  "packaged protocol CSP must block framing",
);

const result = {
  status: failures.length ? "failed" : "passed",
  checks: checks.length,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
