#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

import { firefox, webkit } from "playwright";

import { SAVE_KEY } from "../src/state.js";

const visualQaDir = path.resolve("artifacts/qa/browser");
const engines = [
  { name: "firefox", launcher: firefox },
  { name: "webkit", launcher: webkit },
];

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHttp(url, attempts = 120) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const forceTimer = setTimeout(() => child.kill("SIGKILL"), 2000);
    child.once("exit", () => {
      clearTimeout(forceTimer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

function trackPageErrors(page) {
  const errors = [];
  let phase = "online";
  page.on("pageerror", (error) => {
    errors.push(`${phase}: pageerror: ${error.stack || error.message}`);
  });
  page.on("console", (message) => {
    if (phase !== "offline" && message.type() === "error") {
      errors.push(`${phase}: console: ${message.text()}`);
    }
  });
  page.on("requestfailed", (request) => {
    if (phase === "offline") return;
    const failure = request.failure()?.errorText || "unknown";
    if (
      /cancelled|aborted|NS_BINDING_ABORTED|ERR_ABORTED/i.test(failure)
    ) {
      return;
    }
    errors.push(
      `${phase}: request failed: ${request.url()} (${failure})`,
    );
  });
  return {
    errors,
    setPhase(nextPhase) {
      phase = nextPhase;
    },
  };
}

async function waitForScreen(page, screenName) {
  await page.waitForSelector(`.game-frame.screen-${screenName}`, {
    state: "visible",
    timeout: 20000,
  });
}

async function screenshot(page, name) {
  await mkdir(visualQaDir, { recursive: true });
  await page.screenshot({
    path: path.join(visualQaDir, name),
    fullPage: false,
    animations: "disabled",
  });
}

async function readHorizontalLayout(page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
}

async function assertNoHorizontalOverflow(page, label) {
  const layout = await readHorizontalLayout(page);
  assert.ok(
    layout.documentScrollWidth <= layout.innerWidth + 1,
    `${label}: document is ${layout.documentScrollWidth - layout.innerWidth}px wider than the viewport`,
  );
  assert.ok(
    layout.bodyScrollWidth <= layout.innerWidth + 1,
    `${label}: body is ${layout.bodyScrollWidth - layout.innerWidth}px wider than the viewport`,
  );
}

async function assertTitleArtwork(page, engineName, posterRequests) {
  await waitForScreen(page, "title");
  await page.waitForFunction(
    () => {
      const images = [...document.querySelectorAll(".title-figures img")];
      return (
        images.length === 8 &&
        images.every((image) => image.complete && image.naturalWidth > 0)
      );
    },
    null,
    { timeout: 20000 },
  );

  const artwork = await page.evaluate(() => {
    const images = [...document.querySelectorAll(".title-figures img")];
    const resources = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name);
    return {
      viewportHeight: window.innerHeight,
      images: images.map((image) => {
        const rect = image.getBoundingClientRect();
        const style = getComputedStyle(image);
        return {
          src: image.currentSrc || image.src,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          renderedWidth: rect.width,
          renderedHeight: rect.height,
          top: rect.top,
          bottom: rect.bottom,
          objectFit: style.objectFit,
          objectPosition: style.objectPosition,
        };
      }),
      cutoutRequests: resources.filter((url) => url.includes("/cutout.png")),
      posterRequests: resources.filter((url) =>
        url.includes("bianjing_snow_night_poster"),
      ),
    };
  });

  assert.equal(artwork.images.length, 8, `${engineName}: title should show 8 heroes`);
  assert.equal(
    new Set(artwork.images.map((image) => image.src)).size,
    8,
    `${engineName}: every featured hero should request a distinct thumbnail`,
  );
  assert.equal(
    artwork.cutoutRequests.length,
    0,
    `${engineName}: title should not load full-resolution cutouts`,
  );
  assert.ok(
    artwork.images.every(
      (image) =>
        image.naturalWidth > 0 &&
        image.naturalHeight > 0 &&
        image.renderedWidth >= 40 &&
        image.renderedHeight >= 150 &&
        image.top >= 0 &&
        image.bottom <= artwork.viewportHeight + 1,
    ),
    `${engineName}: every title thumbnail should render fully inside its hero slot`,
  );
  assert.ok(
    artwork.images.every(
      (image) =>
        image.objectFit === "contain" &&
        image.objectPosition.includes("50%") &&
        image.objectPosition.includes("100%"),
    ),
    `${engineName}: title thumbnails must use contain/bottom-center without stretching`,
  );
  assert.equal(
    new Set(
      artwork.images.map(
        (image) => `${image.naturalWidth}x${image.naturalHeight}`,
      ),
    ).size,
    1,
    `${engineName}: title thumbnails must share one normalized canvas`,
  );
  assert.equal(
    `${artwork.images[0].naturalWidth}x${artwork.images[0].naturalHeight}`,
    "320x366",
    `${engineName}: title thumbnail dimensions must stay canonical`,
  );
  await assertNoHorizontalOverflow(page, `${engineName} desktop title`);

  await page.waitForTimeout(400);
  assert.equal(
    posterRequests.length,
    1,
    `${engineName}: the title poster should be requested exactly once`,
  );
}

async function assertDesktopSettings(page, engineName) {
  await page.locator('button[data-action="title-settings"]').first().click();
  await waitForScreen(page, "settings");

  const cardCount = await page.locator(".settings-card").count();
  assert.ok(
    cardCount >= 11,
    `${engineName}: desktop settings should expose all core cards, found ${cardCount}`,
  );
  await assertNoHorizontalOverflow(page, `${engineName} desktop settings`);

  const cardLayout = await page.locator(".settings-card").evaluateAll((nodes) => ({
    viewportWidth: window.innerWidth,
    cards: nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
      };
    }),
  }));
  assert.ok(
    cardLayout.cards.every(
      (card) =>
        card.left >= -1 &&
        card.right <= cardLayout.viewportWidth + 1 &&
        card.scrollWidth <= card.clientWidth + 1,
    ),
    `${engineName}: settings cards must not clip or overflow horizontally`,
  );
  await screenshot(page, `shuihu-${engineName}-settings-desktop.png`);

  await page
    .locator('button[data-action="battle-speed"][data-speed="4"]')
    .click();
  await page.waitForFunction(
    (saveKey) => {
      const saved = JSON.parse(localStorage.getItem(saveKey) || "null");
      return (
        saved?.settings?.battleSpeed === 4 &&
        document
          .querySelector('button[data-action="battle-speed"][data-speed="4"]')
          ?.classList.contains("is-selected")
      );
    },
    SAVE_KEY,
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForScreen(page, "title");
  await page.locator('button[data-action="title-settings"]').first().click();
  await waitForScreen(page, "settings");
  assert.equal(
    await page
      .locator('button[data-action="battle-speed"][data-speed="4"]')
      .evaluate((node) => node.classList.contains("is-selected")),
    true,
    `${engineName}: 4x battle speed should survive a reload`,
  );

  await page
    .locator(
      'button[data-action="show-legal-document"][data-document="privacy"]',
    )
    .click();
  await page.waitForSelector(".modal-panel .legal-notice-text", {
    state: "visible",
  });
  const legalDocument = await page.locator(".legal-notice-text").evaluate((node) => {
    const panel = node.closest(".modal-panel");
    const panelRect = panel.getBoundingClientRect();
    return {
      viewportHeight: window.innerHeight,
      tabIndex: node.tabIndex,
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      panelTop: panelRect.top,
      panelBottom: panelRect.bottom,
    };
  });
  assert.equal(
    legalDocument.tabIndex,
    0,
    `${engineName}: legal document should be keyboard focusable`,
  );
  assert.ok(
    legalDocument.scrollHeight > legalDocument.clientHeight,
    `${engineName}: legal document should scroll instead of expanding past the dialog`,
  );
  assert.ok(
    legalDocument.panelTop >= -1 &&
      legalDocument.panelBottom <= legalDocument.viewportHeight + 1,
    `${engineName}: legal dialog should remain inside the viewport`,
  );
  await page.locator(".legal-notice-text").focus();
  assert.equal(
    await page.evaluate(
      () => document.activeElement?.classList.contains("legal-notice-text"),
    ),
    true,
    `${engineName}: legal document should accept keyboard focus`,
  );
  await screenshot(page, `shuihu-${engineName}-privacy.png`);
  await page
    .locator('.modal-actions button[data-action="close-modal"]')
    .click();
  await page.locator('button[data-action="back-from-settings"]').click();
  await waitForScreen(page, "title");
}

async function assertServiceWorkerOffline(page, errors, engineName) {
  const serviceWorker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        });
        window.setTimeout(resolve, 2500);
      });
    }
    return {
      active: Boolean(registration.active),
      controlled: Boolean(navigator.serviceWorker.controller),
    };
  });
  if (!serviceWorker.controlled) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForScreen(page, "title");
  }
  const controlled = await page.evaluate(
    () => Boolean(navigator.serviceWorker.controller),
  );
  assert.equal(
    serviceWorker.active && controlled,
    true,
    `${engineName}: service worker must be active and controlling the page`,
  );

  errors.setPhase("offline");
  await page.context().setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForScreen(page, "title");
  const titleVisible = await page
    .locator(".title-content h1")
    .isVisible()
    .catch(() => false);
  assert.equal(
    titleVisible,
    true,
    `${engineName}: offline reload must render the title screen`,
  );
  await page.context().setOffline(false);
  errors.setPhase("online");
}

async function runDesktopEngine(browser, engineName, origin) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "zh-CN",
    colorScheme: "dark",
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errorTracker = trackPageErrors(page);
  const posterRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("bianjing_snow_night_poster")) {
      posterRequests.push(request.url());
    }
  });

  try {
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await assertTitleArtwork(page, engineName, posterRequests);
    await screenshot(page, `shuihu-${engineName}-title-desktop.png`);
    await assertDesktopSettings(page, engineName);
    await assertServiceWorkerOffline(
      page,
      errorTracker,
      engineName,
    );
    assert.deepEqual(
      errorTracker.errors,
      [],
      `${engineName} desktop console errors:\n${errorTracker.errors.join("\n")}`,
    );
  } finally {
    await context.setOffline(false).catch(() => {});
    await context.close();
  }
}

async function runMobileEngine(browser, engineName, origin) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    locale: "zh-CN",
    colorScheme: "dark",
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errorTracker = trackPageErrors(page);

  try {
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await waitForScreen(page, "title");
    await assertNoHorizontalOverflow(page, `${engineName} mobile title`);
    await page.locator('button[data-action="new-game"]').click();
    await waitForScreen(page, "map");
    await page.locator('button[data-action="nav-settings"]').click();
    await waitForScreen(page, "settings");
    await assertNoHorizontalOverflow(page, `${engineName} mobile settings`);

    const cardLayout = await page
      .locator(".settings-card")
      .evaluateAll((nodes) => ({
        viewportWidth: window.innerWidth,
        cards: nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            clientWidth: node.clientWidth,
            scrollWidth: node.scrollWidth,
          };
        }),
      }));
    assert.ok(
      cardLayout.cards.length >= 11,
      `${engineName}: mobile settings cards are missing`,
    );
    assert.ok(
      cardLayout.cards.every(
        (card) =>
          card.left >= -1 &&
          card.right <= cardLayout.viewportWidth + 1 &&
          card.scrollWidth <= card.clientWidth + 1,
      ),
      `${engineName}: mobile settings cards must not clip or overflow horizontally`,
    );
    await screenshot(page, `shuihu-${engineName}-settings-mobile.png`);
    assert.deepEqual(
      errorTracker.errors,
      [],
      `${engineName} mobile console errors:\n${errorTracker.errors.join("\n")}`,
    );
  } finally {
    await context.close();
  }
}

async function runReducedMotion(browser, engineName, origin) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "zh-CN",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errorTracker = trackPageErrors(page);
  try {
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await waitForScreen(page, "title");
    await page.waitForTimeout(250);
    const reducedMotion = await page.evaluate(() => ({
      mediaMatches: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      documentMode: document.documentElement.dataset.motion,
      videoPaused: document.querySelector(".title-video")?.paused,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    }));
    assert.equal(
      reducedMotion.mediaMatches,
      true,
      `${engineName}: reduced-motion media query should match`,
    );
    assert.equal(
      reducedMotion.documentMode,
      "reduced",
      `${engineName}: reduced-motion preference should reach the game shell`,
    );
    assert.equal(
      reducedMotion.videoPaused,
      true,
      `${engineName}: title ambience video should pause under reduced motion`,
    );
    assert.equal(
      reducedMotion.scrollBehavior,
      "auto",
      `${engineName}: smooth scrolling should be disabled under reduced motion`,
    );
    assert.deepEqual(
      errorTracker.errors,
      [],
      `${engineName} reduced-motion console errors:\n${errorTracker.errors.join("\n")}`,
    );
  } finally {
    await context.close();
  }
}

const previewPort = await freePort();
const origin = `http://127.0.0.1:${previewPort}`;
let preview = null;

try {
  preview = spawn(
    "npm",
    ["run", "preview", "--", "--port", String(previewPort), "--strictPort"],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  preview.stdout.pipe(process.stderr);
  preview.stderr.pipe(process.stderr);
  await waitForHttp(origin);

  for (const engine of engines) {
    const browser = await engine.launcher.launch({ headless: true });
    try {
      console.error(`\n[${engine.name}] ${browser.version()}`);
      await runDesktopEngine(browser, engine.name, origin);
      await runMobileEngine(browser, engine.name, origin);
      await runReducedMotion(browser, engine.name, origin);
      console.error(`[${engine.name}] compatibility checks passed`);
    } finally {
      await browser.close();
    }
  }
} finally {
  await stopProcess(preview);
}
