import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { ICON_COMPONENTS } from "../src/icons.js";

const iconNames = `
accessibility arrow-left arrow-right arrow-up arrow-up-right badge-check
book-open book-open-check bot calendar-days castle check chevron-down
chevron-right chevron-up
chevrons-right chevrons-up circle circle-alert circle-check cloud coins compass
crosshair crown download eye file-text flag flame gauge gavel gem hammer hand hand-fist
heart heart-pulse history home hourglass info landmark layout-grid list-checks
list-restart link lock-keyhole map maximize-2 medal menu minimize-2 monitor-up
map-pin moon-star mouse-pointer-2 orbit package-open play plus power refresh-cw
rotate-ccw route save scroll-text settings shield shield-check shield-plus
sliders-horizontal snowflake sparkles stamp star swords target text timer
trash-2 trending-up trophy upload user-round-plus users volume-2 volume-x
wand-sparkles wind x zap
`
  .trim()
  .split(/\s+/);

function toPascalCase(iconName) {
  return iconName
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

test("runtime icon subset covers every static and dynamic icon name", () => {
  for (const iconName of iconNames) {
    assert.ok(
      ICON_COMPONENTS[toPascalCase(iconName)],
      `missing icon component for ${iconName}`,
    );
  }
});

test("source icon references resolve through the selective icon bundle", async () => {
  const root = process.cwd();
  const files = [
    "src/main.js",
    "src/data.js",
    "src/state.js",
    "src/arena-week.js",
  ];
  const referenced = new Set();
  for (const file of files) {
    const source = await readFile(path.join(root, file), "utf8");
    for (const match of source.matchAll(
      /\bicon(?::\s*|\(\s*)"([a-z0-9-]+)"/g,
    )) {
      referenced.add(match[1]);
    }
  }

  assert.ok(referenced.size >= 70);
  for (const iconName of referenced) {
    assert.ok(
      ICON_COMPONENTS[toPascalCase(iconName)],
      `${iconName} is referenced but not imported`,
    );
  }
});
