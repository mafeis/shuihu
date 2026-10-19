#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const blockers = [];
const checks = [];

function pass(message) {
  checks.push(message);
}

function fail(message) {
  blockers.push(message);
}

function readText(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`missing required file: ${relativePath}`);
    return null;
  }
  return readFileSync(absolutePath, "utf8");
}

function readJson(relativePath) {
  const source = readText(relativePath);
  if (source === null) return null;
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`invalid JSON in ${relativePath}: ${error.message}`);
    return null;
  }
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validHttpsUrl(value) {
  if (!nonEmptyString(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const validation = spawnSync(
  process.execPath,
  ["tools/validate_browser_release.mjs"],
  {
    cwd: root,
    encoding: "utf8",
  },
);
if (validation.status === 0) {
  pass("browser release package and every file checksum verify");
} else {
  fail("browser release package is missing or invalid");
}

const identity = readJson("store/browser_release_identity.json");
if (identity) {
  for (const field of [
    "legalName",
    "supportEmail",
    "privacyContact",
    "eulaGoverningLaw",
    "priceCurrency",
  ]) {
    if (nonEmptyString(identity[field])) pass(`release identity: ${field}`);
    else fail(`release identity is missing ${field}`);
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.supportEmail || "")) {
    pass("support email is syntactically valid");
  } else {
    fail("support email is not valid");
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.privacyContact || "")) {
    pass("privacy contact is syntactically valid");
  } else {
    fail("privacy contact is not valid");
  }
  for (const field of ["supportUrl", "salesUrl"]) {
    if (validHttpsUrl(identity[field])) pass(`release identity: ${field} uses HTTPS`);
    else fail(`release identity: ${field} must use HTTPS`);
  }
  if (
    Array.isArray(identity.releaseTerritories) &&
    identity.releaseTerritories.length > 0
  ) {
    pass("release territories are declared");
  } else {
    fail("release territories are not declared");
  }
  for (const field of [
    "legalReviewComplete",
    "privacyReviewComplete",
    "consumerRightsReviewComplete",
    "aiCommercialTermsVerified",
  ]) {
    if (identity[field] === true) pass(`release review complete: ${field}`);
    else fail(`release review incomplete: ${field}`);
  }
}

for (const relativePath of [
  "public/legal/privacy.html",
  "public/legal/eula.html",
  "public/legal/support.html",
  "public/legal/refund.html",
]) {
  const source = readText(relativePath);
  if (source === null) continue;
  if (/\bTODO\b|待填写|example\.com/i.test(source)) {
    fail(`${relativePath} still contains placeholder release information`);
  } else {
    pass(`${relativePath} has no unresolved placeholders`);
  }
}

const packageJson = readJson("package.json");
const releaseManifest = readJson(
  `release/browser/XingmingShuihu-web-${packageJson?.version || "0.0.0"}/release-manifest.json`,
);
const qa = readJson("store/browser_qa_attestations.json");
if (qa && releaseManifest) {
  if (qa.schemaVersion === 1) pass("browser QA attestation schema is v1");
  else fail("browser QA attestation schemaVersion must be 1");
  if (qa.buildHash === releaseManifest.buildHash) {
    pass("browser QA attestation matches the packaged build");
  } else {
    fail("browser QA attestation does not match the packaged build");
  }
  if (
    nonEmptyString(qa.testedAt) &&
    Number.isFinite(Date.parse(qa.testedAt))
  ) {
    pass("browser QA attestation has a valid timestamp");
  } else {
    fail("browser QA attestation has no valid testedAt timestamp");
  }
  for (const field of [
    "automation.firefox",
    "automation.webkit",
    "automation.offlineReload",
    "automation.fullCampaign",
    "physicalDevices.safariDesktop",
    "physicalDevices.iosSafari",
    "physicalDevices.androidChrome",
    "physicalDevices.touchControls",
  ]) {
    const value = field
      .split(".")
      .reduce((current, key) => current?.[key], qa);
    if (value === true) pass(`browser QA attestation: ${field}`);
    else fail(`browser QA attestation missing: ${field}`);
  }
}

console.log(
  JSON.stringify(
    {
      status: blockers.length ? "blocked" : "ready",
      version: packageJson?.version || null,
      checks: checks.length,
      buildHash: releaseManifest?.buildHash || null,
      blockers,
    },
    null,
    2,
  ),
);
if (blockers.length) process.exitCode = 1;
