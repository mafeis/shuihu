import assert from "node:assert/strict";

export async function waitForPageEngine(page) {
  await page.waitForFunction(
    () => globalThis.__shuihuPageEngine === "phaser",
  );
  await page.waitForTimeout(180);
}

export async function waitForPageScreen(page, screen) {
  await page.waitForFunction(
    (name) =>
      globalThis.__shuihuPageStage?.model?.screen === name &&
      globalThis.__shuihuPageEngine === "phaser",
    screen,
    { timeout: 12000 },
  );
  await page.waitForTimeout(180);
}

export async function clickPageAction(page, action, options = {}) {
  await waitForPageEngine(page);
  const point = await page.evaluate(
    ({ actionName, index }) => {
      const ui = globalThis.__shuihuPageStage.getUiSnapshot();
      const matches = Object.values(ui.hitAreas).filter(
        (item) => item.action === actionName,
      );
      const rect = matches[index] || matches[0];
      if (!rect) return null;
      return {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      };
    },
    {
      actionName: action,
      index: Number(options.index) || 0,
    },
  );
  assert.ok(
    point,
    `${await page.evaluate(() => globalThis.__shuihuPageStage?.model?.screen)}: engine action ${action} is missing`,
  );
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(35);
  await page.mouse.up();
  await page.waitForTimeout(options.delay ?? 240);
}
