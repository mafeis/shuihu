import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CHAPTERS, ENEMIES, STATUS_DEFS } from "../src/data.js";
import {
  ENEMY_GENERALS,
  ENEMY_GENERALS_BY_TIER,
  enemyGeneralsForTier,
} from "../src/lore/enemyGenerals.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUPPORTED_TARGETS = new Set([
  "enemy",
  "allEnemies",
  "allAllies",
  "frontEnemy",
  "backEnemy",
  "lowestEnemy",
  "ally",
  "self",
]);
const SUPPORTED_EFFECTS = new Set([
  "status",
  "teamStatus",
  "selfStatus",
  "targetStatus",
  "teamYiqi",
  "selfYiqi",
  "targetYiqi",
  "stealYiqi",
  "teamCleanse",
  "targetCleanse",
  "targetRemoveGood",
  "selfHeal",
  "lowestAllyYiqi",
]);

test("enemy generals form four tiers of six distinct identities", () => {
  const generals = Object.values(ENEMY_GENERALS);
  assert.equal(generals.length, 24);
  assert.deepEqual(Object.keys(ENEMY_GENERALS_BY_TIER), ["1", "2", "3", "4"]);
  for (const tier of [1, 2, 3, 4]) {
    const byTier = enemyGeneralsForTier(tier);
    assert.equal(byTier.length, 6, `tier ${tier} should hold six generals`);
    for (const general of byTier) {
      assert.equal(general.tier, tier, `${general.id} sits in the wrong tier`);
    }
  }
});

test("every enemy general draws unique art that ships with the game", () => {
  const sprites = new Map();
  for (const general of Object.values(ENEMY_GENERALS)) {
    assert.ok(
      general.sprite.startsWith("/assets/characters/"),
      `${general.id} should reuse a hero cutout as enemy art`,
    );
    assert.equal(
      existsSync(path.join(root, general.sprite.slice(1))),
      true,
      `${general.id} sprite is missing on disk`,
    );
    assert.equal(
      sprites.has(general.sprite),
      false,
      `${general.id} reuses the same art as ${sprites.get(general.sprite)}`,
    );
    sprites.set(general.sprite, general.id);
  }
  for (const [id, enemy] of Object.entries(ENEMIES)) {
    if (!ENEMY_GENERALS[id]) continue;
    assert.equal(
      sprites.get(enemy.sprite),
      id,
      `${id} must keep its own art inside the battle roster`,
    );
  }
});

test("enemy general skills stay inside the battle engine vocabulary", () => {
  const seen = new Set();
  for (const general of Object.values(ENEMY_GENERALS)) {
    assert.ok(
      general.skills.length >= 3,
      `${general.id} needs at least three skills`,
    );
    if (general.boss) {
      assert.equal(
        general.skills.length,
        4,
        `${general.id} is a boss and needs four skills`,
      );
      assert.ok(
        general.bossPhase,
        `${general.id} is a boss and needs a data driven boss phase`,
      );
    }
    for (const skill of general.skills) {
      assert.equal(
        seen.has(skill.id),
        false,
        `${skill.id} skill id is duplicated`,
      );
      seen.add(skill.id);
      assert.ok(
        SUPPORTED_TARGETS.has(skill.target),
        `${skill.id} uses unsupported target ${skill.target}`,
      );
      assert.ok(skill.name.length >= 2, `${skill.id} needs a readable name`);
      for (const effect of skill.effects || []) {
        assert.ok(
          SUPPORTED_EFFECTS.has(effect.type),
          `${skill.id} uses unsupported effect ${effect.type}`,
        );
        if (effect.status) {
          assert.ok(
            STATUS_DEFS[effect.status],
            `${skill.id} applies unknown status ${effect.status}`,
          );
        }
      }
    }
  }
});

test("boss phase rules only reference known statuses", () => {
  for (const general of Object.values(ENEMY_GENERALS)) {
    if (!general.bossPhase) continue;
    const rule = general.bossPhase;
    assert.ok(rule.text.includes(general.name) === false);
    for (const status of Object.keys(rule.selfStatuses || {})) {
      assert.ok(STATUS_DEFS[status], `${general.id} phase self status ${status}`);
    }
    for (const status of Object.keys(rule.heroStatuses || {})) {
      assert.ok(STATUS_DEFS[status], `${general.id} phase hero status ${status}`);
    }
    if (rule.healPct) {
      assert.ok(rule.healPct > 0 && rule.healPct <= 0.3, `${general.id} healPct`);
      assert.ok(
        rule.text.includes("{heal}"),
        `${general.id} should report the healed amount`,
      );
    }
  }
});

test("enemy power grows monotonically across tiers", () => {
  const average = (tier) => {
    const list = enemyGeneralsForTier(tier);
    const sum = list.reduce(
      (total, general) =>
        total + general.base.hp + general.base.atk * 6 + general.poise,
      0,
    );
    return sum / list.length;
  };
  const scores = [1, 2, 3, 4].map(average);
  for (let index = 1; index < scores.length; index += 1) {
    assert.ok(
      scores[index] > scores[index - 1],
      `tier ${index + 1} should be stronger than tier ${index}`,
    );
  }
});

test("campaign chapters field generals from the roster", () => {
  const used = new Set();
  for (const chapter of CHAPTERS) {
    for (const enemy of chapter.battle.enemies) {
      assert.ok(ENEMIES[enemy.id], `${chapter.id} fields unknown ${enemy.id}`);
      used.add(enemy.id);
    }
  }
  const generalHits = [...used].filter((id) => ENEMY_GENERALS[id]);
  assert.ok(
    generalHits.length >= 15,
    `campaign should reuse the enemy general roster, saw ${generalHits.length}`,
  );
  for (const chapterId of ["jiangzhou", "damingfu", "liangshan"]) {
    const chapter = CHAPTERS.find((item) => item.id === chapterId);
    assert.ok(
      chapter.battle.enemies.some((enemy) => ENEMY_GENERALS[enemy.id]?.boss),
      `${chapterId} should end on a boss general`,
    );
  }
});
