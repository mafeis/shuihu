import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  ACHIEVEMENTS,
  ARENA_ENCOUNTERS,
  ARENA_MILESTONES,
  ARENA_RELICS,
  CHAPTERS,
  CHAIN_FORMATIONS,
  ENEMIES,
  EQUIPMENT,
  HERO_BONDS,
  HERO_CHRONICLES,
  HERO_DOCTRINES,
  HERO_LEGENDS,
  HERO_QUESTS,
  HERO_RECRUITMENTS,
  HEROES,
  HERO_ORDER,
  PATHS,
  STORY_ARCHIVE_CHAPTERS,
} from "../src/data.js";

const root = process.cwd();

function assetPath(asset) {
  return path.join(root, String(asset).replace(/^\/+/, ""));
}

test("campaign data is complete and references valid runtime content", () => {
  assert.equal(CHAPTERS.length, 9);
  assert.equal(HERO_ORDER.length, 108);
  assert.equal(new Set(HERO_ORDER).size, HERO_ORDER.length);
  assert.equal(
    new Set(HERO_ORDER.map((heroId) => HEROES[heroId].name)).size,
    HERO_ORDER.length,
    "hero names must be unique",
  );
  assert.equal(
    new Set(HERO_ORDER.map((heroId) => HEROES[heroId].nickname)).size,
    HERO_ORDER.length,
    "hero nicknames must identify distinct people",
  );
  assert.equal(Object.keys(EQUIPMENT).length, 124);
  assert.deepEqual(
    CHAPTERS.map((chapter) => chapter.index),
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
  );

  for (const chapter of CHAPTERS) {
    assert.ok(chapter.intro.length >= 3, `${chapter.id} intro is too short`);
    assert.ok(chapter.outro.length >= 2, `${chapter.id} outro is too short`);
    assert.ok(chapter.choice.options.length >= 2, `${chapter.id} needs choices`);
    assert.ok(existsSync(assetPath(chapter.bg)), `${chapter.id} background is missing`);
    assert.ok(chapter.parRounds > 0, `${chapter.id} needs a round target`);
    assert.ok(chapter.battle.reward.copper > 0);
    assert.ok(chapter.battle.reward.xp > 0);
    for (const enemy of chapter.battle.enemies) {
      assert.ok(ENEMIES[enemy.id], `${chapter.id} has unknown enemy ${enemy.id}`);
    }
    for (const heroId of chapter.battle.recruit || []) {
      assert.ok(HERO_ORDER.includes(heroId), `${chapter.id} recruits unknown hero`);
    }
  }
});

test("the readable saga exposes all 28 chapters from the prologue to the final temple", () => {
  assert.equal(STORY_ARCHIVE_CHAPTERS.length, 28);
  assert.equal(
    new Set(STORY_ARCHIVE_CHAPTERS.map((chapter) => chapter.id)).size,
    STORY_ARCHIVE_CHAPTERS.length,
  );
  assert.equal(STORY_ARCHIVE_CHAPTERS[0].title, "张天师祈禳瘟疫");
  assert.ok(
    STORY_ARCHIVE_CHAPTERS.some(
      (chapter) =>
        chapter.location.includes("六和寺") ||
        chapter.title.includes("听潮"),
    ),
    "the complete saga should end at the Six Harmonies Temple",
  );
  for (const [index, chapter] of STORY_ARCHIVE_CHAPTERS.entries()) {
    assert.ok(chapter.title.length >= 4, `saga chapter ${index + 1} needs a title`);
    assert.ok(chapter.summary.length >= 24, `${chapter.id} needs a readable saga summary`);
    assert.ok(chapter.intro.length >= 3, `${chapter.id} needs a full opening scene`);
    assert.ok(chapter.outro.length >= 2, `${chapter.id} needs a closing scene`);
    assert.ok(chapter.choice.options.length >= 2, `${chapter.id} needs branch choices`);
    assert.ok(existsSync(assetPath(chapter.bg)), `${chapter.id} saga backdrop is missing`);
    assert.ok(chapter.battle.enemies.length >= 2, `${chapter.id} needs a playable formation`);
    assert.equal(
      JSON.stringify(chapter).includes("${"),
      false,
      `${chapter.id} saga copy still contains a template placeholder`,
    );
  }
});

test("hero runtime assets and progression targets exist", () => {
  for (const heroId of HERO_ORDER) {
    const hero = HEROES[heroId];
    assert.ok(hero, `missing hero ${heroId}`);
    assert.ok(existsSync(assetPath(hero.keyart)), `${heroId} key art is missing`);
    assert.ok(existsSync(assetPath(hero.cutout)), `${heroId} cutout is missing`);
    const thumbPath = assetPath(`assets/characters/${heroId}/thumb.webp`);
    assert.ok(existsSync(thumbPath), `${heroId} title thumbnail is missing`);
    const thumbBytes = statSync(thumbPath).size;
    assert.ok(
      thumbBytes >= 2_000,
      `${heroId} title thumbnail is unexpectedly small`,
    );
    assert.ok(
      thumbBytes <= 120_000,
      `${heroId} title thumbnail should stay lightweight`,
    );
    assert.ok(
      existsSync(assetPath(`assets/characters/${heroId}/turnaround.png`)),
      `${heroId} turnaround sheet is missing`,
    );
    assert.ok(
      new RegExp(HEROES[heroId].name).test(hero.bio),
      `${heroId} biography should identify its hero`,
    );
    assert.ok(hero.skills.length >= 4, `${heroId} needs a full skill set`);
  }
});

test("hero cutouts share one normalized commercial runtime canvas", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(root, "assets/manifest.json"), "utf8"),
  );
  const cutouts = manifest.assets.filter(
    (asset) => asset.type === "character_cutout",
  );
  assert.equal(cutouts.length, HERO_ORDER.length);
  for (const asset of cutouts) {
    assert.equal(asset.width, 896, `${asset.id} width should be normalized`);
    assert.equal(asset.height, 1024, `${asset.id} height should be normalized`);
    assert.equal(asset.mode, "RGBA", `${asset.id} should preserve transparency`);
    const [left, top, right, bottom] = asset.alpha_bbox;
    assert.ok(left >= 0 && top >= 0, `${asset.id} alpha bounds should be valid`);
    assert.ok(right <= asset.width, `${asset.id} alpha should fit horizontally`);
    assert.ok(bottom <= asset.height, `${asset.id} alpha should fit vertically`);
    assert.equal(
      bottom,
      asset.height - 12,
      `${asset.id} should share the same bottom safety line`,
    );
    assert.ok(
      right - left >= 48,
      `${asset.id} alpha silhouette should not be nearly empty`,
    );
    assert.ok(
      bottom - top >= 72,
      `${asset.id} alpha silhouette should not be nearly empty`,
    );
  }
});

test("every enemy runtime sprite exists and uses a distinct combat silhouette", () => {
  const sprites = new Set();
  for (const enemy of Object.values(ENEMIES)) {
    assert.ok(existsSync(assetPath(enemy.sprite)), `${enemy.id} sprite is missing`);
    sprites.add(enemy.sprite);
  }
  assert.equal(
    sprites.size,
    Object.keys(ENEMIES).length,
    "enemy sprites should not be silently reused across combat identities",
  );
});

test("hero bond runtime definitions use valid heroes and readable effects", () => {
  assert.equal(Object.keys(HERO_BONDS).length, 72);
  const bondKinds = Object.values(HERO_BONDS).reduce(
    (counts, bond) => ({
      ...counts,
      [bond.kind]: (counts[bond.kind] || 0) + 1,
    }),
    {},
  );
  assert.deepEqual(bondKinds, { pair: 58, trio: 14 });
  for (const bond of Object.values(HERO_BONDS)) {
    assert.equal(HERO_BONDS[bond.id], bond);
    assert.ok(["pair", "trio"].includes(bond.kind));
    assert.ok(bond.heroIds.length >= 2);
    assert.equal(new Set(bond.heroIds).size, bond.heroIds.length);
    for (const heroId of bond.heroIds) {
      assert.ok(HEROES[heroId], `${bond.id} references unknown hero ${heroId}`);
    }
    assert.ok(Object.keys(bond.effects || {}).length > 0);
    assert.ok(bond.reward.copper > 0);
    assert.ok(bond.reward.xp > 0);
  }
});

test("four star-chain formations cover every three-path combination", () => {
  const formations = Object.values(CHAIN_FORMATIONS);
  assert.equal(formations.length, 4);
  assert.equal(
    new Set(formations.map((formation) => formation.id)).size,
    formations.length,
  );
  const pathSets = formations.map((formation) =>
    [...formation.paths].sort().join("+"),
  );
  assert.equal(new Set(pathSets).size, 4);
  for (const formation of formations) {
    assert.equal(CHAIN_FORMATIONS[formation.id], formation);
    assert.equal(new Set(formation.paths).size, 3);
    assert.ok(formation.paths.every((pathId) => PATHS[pathId]));
    assert.ok(formation.name.length >= 4);
    assert.ok(formation.desc.length >= 24);
    assert.ok(formation.reward.copper > 0);
    assert.ok(formation.reward.xp > 0);
  }
});

test("every hero has two valid endgame doctrine paths", () => {
  for (const heroId of HERO_ORDER) {
    const config = HERO_DOCTRINES[heroId];
    assert.ok(config, `${heroId} is missing doctrine config`);
    assert.equal(config.heroId, heroId);
    const paths = Object.values(config.paths || {});
    assert.equal(paths.length, 2, `${heroId} must offer two doctrine paths`);
    for (const doctrine of paths) {
      assert.equal(config.paths[doctrine.id], doctrine);
      assert.ok(doctrine.name.length >= 2);
      assert.ok(doctrine.desc.length >= 12);
      assert.ok(Object.keys(doctrine.effects || doctrine.teamEffects || {}).length > 0);
    }
  }
});

test("every hero has a three-stage personal quest chain", () => {
  const allQuests = Object.values(HERO_QUESTS).flat();
  assert.equal(allQuests.length, HERO_ORDER.length * 3);
  assert.equal(allQuests.length, 324);
  assert.equal(new Set(allQuests.map((quest) => quest.id)).size, allQuests.length);
  assert.deepEqual(Object.keys(HERO_QUESTS).sort(), [...HERO_ORDER].sort());

  const validMetrics = new Set(["wins", "kills", "damage", "ultimates"]);
  for (const heroId of HERO_ORDER) {
    const quests = HERO_QUESTS[heroId];
    assert.equal(quests.length, 3, `${heroId} needs three personal quests`);
    assert.doesNotMatch(
      JSON.stringify(quests),
      /第[123]次同阵|旧名并非空号/,
      `${heroId} still exposes generated stage copy`,
    );
    assert.equal(
      JSON.stringify(quests).includes("${"),
      false,
      `${heroId} quest copy still contains a template placeholder`,
    );
    assert.deepEqual(
      quests.map((quest) => quest.stage),
      [1, 2, 3],
      `${heroId} quest stages must advance in order`,
    );
    assert.equal(
      new Set(quests.map((quest) => quest.title)).size,
      3,
      `${heroId} quest stages need distinct titles`,
    );
    assert.equal(
      new Set(quests.map((quest) => quest.epithet)).size,
      3,
      `${heroId} quest stages need distinct epithets`,
    );
    let previousChapter = 0;
    for (const quest of quests) {
      assert.ok(quest.title.length >= 3, `${quest.id} needs a real title`);
      assert.ok(quest.premise.length >= 30, `${quest.id} needs a story premise`);
      assert.ok(quest.epithet.length >= 2, `${quest.id} needs an earned epithet`);
      assert.equal(validMetrics.has(quest.objective.metric), true);
      assert.ok(quest.objective.target > 0);
      assert.ok(quest.objective.label.includes(String(quest.objective.target)));
      assert.ok(quest.requiredChapter >= previousChapter);
      assert.ok(quest.requiredChapter <= CHAPTERS.length);
      assert.ok(quest.reward.copper > 0);
      assert.ok(quest.reward.xp > 0);
      previousChapter = quest.requiredChapter;
    }
  }
});

test("every hero has one readable five-part biography chronicle", () => {
  assert.deepEqual(
    Object.keys(HERO_CHRONICLES).sort(),
    [...HERO_ORDER].sort(),
  );
  for (const heroId of HERO_ORDER) {
    const chronicle = HERO_CHRONICLES[heroId];
    const storyCopy = [
      HEROES[heroId].identity,
      ...chronicle.entries
        .filter((entry) => entry.kind !== "origin")
        .map((entry) => entry.text),
    ].filter(Boolean).join(" ");
    assert.equal(chronicle.heroId, heroId);
    assert.equal(chronicle.title, `${HEROES[heroId].name}列传`);
    assert.equal(chronicle.entries.length, 5);
    assert.deepEqual(
      chronicle.entries.map((entry) => entry.kind),
      ["origin", "quest", "quest", "quest", "legend"],
    );
    assert.equal(
      new Set(chronicle.entries.map((entry) => entry.id)).size,
      chronicle.entries.length,
    );
    assert.equal(
      new Set(chronicle.entries.map((entry) => entry.title)).size,
      chronicle.entries.length,
      `${heroId} chronicle entries need distinct headings`,
    );
    for (const entry of chronicle.entries) {
      assert.ok(entry.title.length >= 2);
      assert.ok(entry.text.length >= 30, `${entry.id} needs a full biography entry`);
    }
    assert.doesNotMatch(
      storyCopy,
      /第[123]段异闻|这名号与旧路/,
      `${heroId} still exposes generated stage copy`,
    );
    assert.deepEqual(
      chronicle.entries
        .filter((entry) => entry.kind === "quest")
        .map((entry) => entry.id),
      HERO_QUESTS[heroId].map((quest) => quest.id),
    );
    assert.equal(
      chronicle.entries.find((entry) => entry.kind === "legend").sourceId,
      HERO_LEGENDS[heroId].id,
    );
  }
});

test("every hero has one complete and distinct legend battle", () => {
  const legends = Object.values(HERO_LEGENDS);
  assert.equal(legends.length, HERO_ORDER.length);
  assert.equal(new Set(legends.map((legend) => legend.id)).size, legends.length);
  assert.equal(
    new Set(legends.map((legend) => legend.rule.id)).size,
    legends.length,
  );
  assert.deepEqual(Object.keys(HERO_LEGENDS).sort(), [...HERO_ORDER].sort());

  for (const heroId of HERO_ORDER) {
    const legend = HERO_LEGENDS[heroId];
    assert.equal(legend.heroId, heroId);
    assert.ok(legend.id.startsWith(`${heroId}_`));
    assert.ok(legend.title.length >= 4, `${legend.id} needs a real title`);
    assert.ok(legend.location.length >= 2, `${legend.id} needs a location`);
    assert.ok(legend.objective.length >= 16, `${legend.id} needs an objective`);
    assert.ok(legend.readyText.length >= 30, `${legend.id} needs a ready scene`);
    assert.doesNotMatch(
      legend.readyText,
      /接下来要由他亲手决定，从前的名声/,
      `${legend.id} still uses generic legend copy`,
    );
    assert.match(
      legend.readyText,
      new RegExp(HEROES[heroId].name),
      `${legend.id} should name its featured hero`,
    );
    assert.equal(
      JSON.stringify(legend).includes("${"),
      false,
      `${legend.id} still contains a template placeholder`,
    );
    assert.ok(legend.rule, `${legend.id} needs a dedicated battle rule`);
    assert.ok(legend.rule.id.length >= 4);
    assert.ok(legend.rule.name.length >= 4);
    assert.ok(legend.rule.desc.length >= 24);
    assert.ok(
      Object.keys(legend.rule.effects || {}).length > 0,
      `${legend.id} battle rule needs at least one effect`,
    );
    assert.ok(legend.rule.name.length >= 4);
    assert.ok(legend.intro.length >= 3, `${legend.id} intro is too short`);
    assert.ok(legend.outro.length >= 2, `${legend.id} outro is too short`);
    assert.ok(legend.requiredChapter >= 1);
    assert.ok(legend.requiredChapter <= CHAPTERS.length);
    assert.ok(legend.minLevel >= 1);
    assert.ok(legend.levelOffset >= 0);
    assert.ok(existsSync(assetPath(legend.bg)), `${legend.id} background is missing`);
    assert.ok(legend.enemies.length >= 3, `${legend.id} needs a full enemy lineup`);
    for (const enemy of legend.enemies) {
      assert.ok(ENEMIES[enemy.id], `${legend.id} references unknown enemy ${enemy.id}`);
      assert.ok([0, 1, 2].includes(enemy.row), `${legend.id} enemy row is invalid`);
    }
    assert.ok(legend.enemyScale > 0);
    assert.ok(Object.keys(legend.enemyModifiers || {}).length > 0);
    assert.ok(legend.reward.copper > 0);
    assert.ok(legend.reward.xp > 0);
    assert.ok(EQUIPMENT[legend.reward.item], `${legend.id} reward item is invalid`);
  }
});

test("hero recruitment threads form a complete gated campaign loop", () => {
  const recruitments = Object.values(HERO_RECRUITMENTS);
  assert.equal(recruitments.length, 108);
  assert.deepEqual(
    Object.keys(HERO_RECRUITMENTS).sort(),
    [...HERO_ORDER].sort(),
  );
  assert.equal(
    new Set(recruitments.map((recruitment) => recruitment.rule.id)).size,
    recruitments.length,
  );
  assert.equal(
    new Set(recruitments.map((recruitment) => recruitment.title)).size,
    recruitments.length,
    "each recruitment scroll needs its own title",
  );

  for (const recruitment of recruitments) {
    const heroId = recruitment.heroId;
    const hero = HEROES[heroId];
    assert.ok(hero, `${heroId} recruitment references an unknown hero`);
    assert.equal(HERO_RECRUITMENTS[heroId], recruitment);
    assert.ok(HERO_ORDER.includes(heroId));
    assert.ok(recruitment.title.length >= 4);
    assert.doesNotMatch(
      `${recruitment.title} ${recruitment.teaser}`,
      /第[123]段异闻|这名号与旧路|旧名并非空号/,
      `${heroId} recruitment still exposes generated stage copy`,
    );
    assert.ok(recruitment.teaser.length >= 24);
    assert.equal(
      JSON.stringify(recruitment).includes("${"),
      false,
      `${heroId} recruitment still contains a template placeholder`,
    );
    assert.ok(recruitment.location.length >= 2);
    assert.doesNotMatch(
      JSON.stringify({
        location: recruitment.location,
        prompt: recruitment.choice.prompt,
        intro: recruitment.intro,
      }),
      /(?:jiangzhou|qingfeng|zhujiazhuang|damingfu|liangshan)(?![a-z_])/,
      `${heroId} recruitment exposes an internal scene key`,
    );
    assert.ok(existsSync(assetPath(recruitment.bg)));
    assert.ok(recruitment.requiredChapter >= 1);
    assert.ok(
      recruitment.requiredChapter < CHAPTERS.length,
      `${heroId} recruitment must open before the campaign has no map left`,
    );
    if (recruitment.prerequisite) {
      assert.ok(HERO_RECRUITMENTS[recruitment.prerequisite]);
      assert.ok(
        HERO_RECRUITMENTS[recruitment.prerequisite].requiredChapter <
          recruitment.requiredChapter,
        `${heroId} prerequisite must unlock in an earlier chapter`,
      );
    }
    assert.ok(recruitment.choice.options.length >= 2);
    for (const option of recruitment.choice.options) {
      assert.ok(option.text.length >= 8);
      assert.ok(option.response.length >= 24);
      assert.ok(Object.values(option.effect || {}).some((value) => value > 0));
    }
    assert.ok(recruitment.rule.name.length >= 4);
    assert.ok(recruitment.rule.desc.length >= 16);
    assert.ok(Object.keys(recruitment.rule.effects || {}).length > 0);
    assert.ok(recruitment.intro.length >= 3);
    assert.ok(recruitment.outro.length >= 2);
    assert.ok(recruitment.enemies.length >= 3);
    for (const enemy of recruitment.enemies) {
      assert.ok(ENEMIES[enemy.id]);
      assert.ok([0, 1, 2].includes(enemy.row));
    }
    assert.ok(recruitment.enemyScale > 0);
    assert.ok(Object.keys(recruitment.enemyModifiers || {}).length > 0);
    assert.ok(recruitment.reward.copper > 0);
    assert.ok(recruitment.reward.xp > 0);
    assert.ok(EQUIPMENT[recruitment.reward.item]);
  }
});

test("achievement and arena ladders are unique and reachable", () => {
  assert.equal(ACHIEVEMENTS.length, 19);
  assert.equal(Object.keys(ARENA_ENCOUNTERS).length, 8);
  assert.equal(ARENA_MILESTONES.length, 9);
  assert.equal(new Set(ACHIEVEMENTS.map((item) => item.id)).size, ACHIEVEMENTS.length);
  assert.equal(new Set(ARENA_MILESTONES.map((item) => item.wave)).size, ARENA_MILESTONES.length);
  assert.equal(
    new Set(ARENA_MILESTONES.map((item) => item.relicId)).size,
    ARENA_MILESTONES.length,
  );

  let previousWave = 0;
  for (const milestone of ARENA_MILESTONES) {
    assert.ok(milestone.wave > previousWave);
    assert.ok(ARENA_RELICS[milestone.relicId]);
    previousWave = milestone.wave;
  }
  for (const encounter of Object.values(ARENA_ENCOUNTERS)) {
    assert.equal(ARENA_ENCOUNTERS[encounter.id], encounter);
    assert.ok(encounter.name.length >= 4);
    assert.ok(encounter.desc.length >= 20);
    assert.ok(encounter.minWave >= 1);
    assert.ok(encounter.scorePct > 0);
    assert.ok(Object.keys(encounter.enemyModifiers || {}).length > 0);
    assert.ok(Object.keys(encounter.effects || {}).length > 0);
  }
});

test("runtime asset manifest hashes are current", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(root, "assets/manifest.json"), "utf8"),
  );
  assert.equal(manifest.asset_count, manifest.assets.length);
  assert.ok(manifest.assets.length >= 60);

  for (const asset of manifest.assets) {
    const file = assetPath(asset.file);
    assert.ok(existsSync(file), `missing manifest asset ${asset.file}`);
    const contents = await readFile(file);
    assert.ok(
      !contents.subarray(0, 64).toString().startsWith("version https://git-lfs.github.com/spec/v1"),
      `${asset.file} is a Git LFS pointer; run git lfs pull`,
    );
    assert.equal(contents.byteLength, asset.bytes, `${asset.file} byte size changed`);
    assert.equal(
      createHash("sha256").update(contents).digest("hex"),
      asset.sha256,
      `${asset.file} hash changed`,
    );
    // Internal generation workflows are optional in the public source checkout.
    if (asset.workflow && existsSync(assetPath(asset.workflow))) {
      const workflow = await readFile(assetPath(asset.workflow));
      assert.ok(workflow.byteLength > 0, `${asset.workflow} is empty`);
    }
  }
});
