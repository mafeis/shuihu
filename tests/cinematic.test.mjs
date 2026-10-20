import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  cinematicImageFit,
  endingCinematicProfile,
  openingCinematicProfile,
} from "../src/cinematic.js";

const root = process.cwd();
const SOURCE_TITLE_POSTER = "/assets/video/bianjing_snow_night_poster.webp";

function assetPath(asset) {
  return path.join(root, String(asset).replace(/^\/+/, ""));
}

test("opening cinematic starts with the Water Margin conflict and ends on the title frame", () => {
  const profile = openingCinematicProfile(null);
  assert.equal(profile.variant, "first-cycle");
  assert.equal(profile.scenes.length, 7);
  assert.equal(profile.scenes.at(-1).asset, SOURCE_TITLE_POSTER);
  assert.equal(profile.scenes.at(-1).focal, "66% center");
  for (const scene of profile.scenes) {
    assert.ok(scene.label.length >= 4);
    assert.ok(scene.title.length >= 4);
    assert.ok(scene.text.length >= 12);
    assert.ok(existsSync(assetPath(scene.asset)), `missing opening asset ${scene.asset}`);
    assert.match(scene.focal, /(center|\d+%)/);
  }
});

test("a completed ending changes the next opening without breaking its final transition", () => {
  for (const endingId of ["brotherhood", "order", "freedom"]) {
    const profile = openingCinematicProfile({ ending: endingId });
    assert.equal(profile.variant, endingId);
    assert.equal(profile.scenes.length, 7);
    assert.equal(profile.scenes[0].id, `echo-${endingId}`);
    assert.equal(profile.scenes.at(-1).asset, SOURCE_TITLE_POSTER);
    assert.equal(new Set(profile.scenes.map((scene) => scene.id)).size, 7);
  }
});

test("each ending has a distinct three-beat cinematic with valid production assets", () => {
  const seenAssets = new Set();
  for (const endingId of ["brotherhood", "order", "freedom"]) {
    const profile = endingCinematicProfile(endingId, {
      choices: {
        ferry: 0,
        bianjing: 1,
        boar_forest: 0,
      },
    });
    assert.equal(profile.id, endingId);
    assert.equal(profile.frames.length, 3);
    assert.equal(profile.decisionCount, 3);
    assert.ok(profile.echo.length >= 12);
    assert.ok(existsSync(assetPath(profile.background)));
    for (const frame of profile.frames) {
      assert.ok(frame.label.length >= 4);
      assert.ok(frame.title.length >= 4);
      assert.ok(frame.text.length >= 12);
      assert.ok(existsSync(assetPath(frame.asset)), `missing ending asset ${frame.asset}`);
      seenAssets.add(frame.asset);
      if (frame.portrait) {
        assert.ok(
          existsSync(assetPath(`assets/characters/${frame.portrait}/cutout.webp`)),
          `missing ending portrait ${frame.portrait}`,
        );
      }
    }
  }
  assert.ok(seenAssets.size >= 5, "ending cinematics should use varied environments");
});

test("cinematic images always preserve aspect ratio", () => {
  assert.equal(cinematicImageFit("backdrop"), "cover");
  assert.equal(cinematicImageFit("portrait"), "contain");
  assert.equal(cinematicImageFit("unknown"), "cover");
});
