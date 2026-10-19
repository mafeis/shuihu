#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
);
const blockers = [];
const checks = [];

function fail(message) {
  blockers.push(message);
}

function pass(message) {
  checks.push(message);
}

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`missing required file: ${relativePath}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    fail(`invalid JSON: ${relativePath}`);
    return null;
  }
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function commandExists(command) {
  return spawnSync("which", [command], { encoding: "utf8" }).status === 0;
}

const identity = readJson("steam/release_identity.json");
if (identity) {
  for (const field of [
    "legalName",
    "supportEmail",
    "supportUrl",
    "privacyContact",
    "eulaGoverningLaw",
  ]) {
    if (nonEmptyString(identity[field])) pass(`release identity: ${field}`);
    else fail(`release identity is missing ${field}`);
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.supportEmail || "")) {
    pass("support email is syntactically valid");
  } else {
    fail("support email is not valid");
  }
  if (
    nonEmptyString(identity.supportUrl) &&
    /^https:\/\//.test(identity.supportUrl)
  ) {
    pass("support URL uses HTTPS");
  } else {
    fail("support URL must use HTTPS");
  }
  for (const field of ["appId", "windowsDepotId", "macosDepotId"]) {
    if (positiveInteger(identity[field])) pass(`release identity: ${field}`);
    else fail(`release identity is missing ${field}`);
  }
  if (
    Array.isArray(identity.releaseTerritories) &&
    identity.releaseTerritories.length > 0
  ) {
    pass("release territories are declared");
  } else {
    fail("release territories are not declared");
  }
}

const appIdPath = path.join(root, "steam", "steam_appid.txt");
let configuredAppId = null;
if (existsSync(appIdPath)) {
  configuredAppId = Number(readFileSync(appIdPath, "utf8").trim());
  if (positiveInteger(configuredAppId)) pass("steam_appid.txt is configured");
  else fail("steam_appid.txt does not contain a positive AppID");
} else {
  fail("missing steam/steam_appid.txt");
}
if (
  identity &&
  positiveInteger(identity.appId) &&
  configuredAppId !== identity.appId
) {
  fail("steam_appid.txt does not match release_identity.json");
}

for (const [relativePath, depotField] of [
  ["steam/app_build.vdf", "appId"],
  ["steam/depot_build_windows.vdf", "windowsDepotId"],
  ["steam/depot_build_macos.vdf", "macosDepotId"],
]) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`missing SteamPipe config: ${relativePath}`);
    continue;
  }
  const content = readFileSync(absolutePath, "utf8");
  const expected = identity?.[depotField];
  if (depotField === "appId") {
    if (positiveInteger(expected) && content.includes(`"${expected}"`)) {
      pass("AppID is present in app_build.vdf");
    } else {
      fail("AppID is missing from app_build.vdf");
    }
  } else if (positiveInteger(expected) && content.includes(`"${expected}"`)) {
    pass(`${depotField} is present in ${path.basename(relativePath)}`);
  } else {
    fail(`${depotField} is missing from ${path.basename(relativePath)}`);
  }
}

const windowsRoot = path.join(root, "release", "win-unpacked");
const macApp = path.join(root, "release", "mac-arm64", "星命水浒.app");
if (existsSync(path.join(windowsRoot, "星命水浒.exe"))) {
  pass("Windows x64 unpacked candidate exists");
} else {
  fail("missing release/win-unpacked/星命水浒.exe");
}
if (existsSync(macApp)) pass("macOS ARM64 app candidate exists");
else fail("missing release/mac-arm64/星命水浒.app");

if (existsSync(macApp) && commandExists("codesign")) {
  const verification = spawnSync(
    "codesign",
    ["--verify", "--deep", "--strict", "--verbose=2", macApp],
    { encoding: "utf8" },
  );
  if (verification.status === 0) pass("macOS code signature verifies");
  else fail("macOS code signature is invalid or ad-hoc");
  const assessment = spawnSync(
    "spctl",
    ["--assess", "--type", "execute", "--verbose=4", macApp],
    { encoding: "utf8" },
  );
  if (assessment.status === 0) pass("macOS Gatekeeper assessment passes");
  else fail("macOS Gatekeeper assessment fails; notarization is not accepted");
} else {
  fail("macOS code signing verification is unavailable");
}

const windowsCandidates = [
  "release/win-unpacked/星命水浒.exe",
  `release/XingmingShuihu-${packageJson.version}-win-x64.exe`,
];
for (const relativePath of windowsCandidates) {
  if (!existsSync(path.join(root, relativePath))) {
    fail(`missing Windows signature candidate: ${relativePath}`);
    continue;
  }
  if (process.platform === "win32") {
    const verification = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `(Get-AuthenticodeSignature -LiteralPath '${path
          .join(root, relativePath)
          .replaceAll("'", "''")}').Status`,
      ],
      { encoding: "utf8" },
    );
    if (verification.stdout.trim() === "Valid") {
      pass(`Authenticode verifies: ${relativePath}`);
    } else {
      fail(`Authenticode is missing or invalid: ${relativePath}`);
    }
  } else if (commandExists("osslsigncode")) {
    const verification = spawnSync(
      "osslsigncode",
      ["verify", "-in", path.join(root, relativePath)],
      { encoding: "utf8" },
    );
    if (verification.status === 0) {
      pass(`Authenticode verifies: ${relativePath}`);
    } else {
      fail(`Authenticode is missing or invalid: ${relativePath}`);
    }
  } else {
    fail(
      `Cannot verify Authenticode on this host: install osslsigncode or run preflight on Windows (${relativePath})`,
    );
  }
}

const attestations = readJson("release/qa_attestations.json");
if (attestations) {
  if (attestations.schemaVersion === 1) pass("QA attestation schema is v1");
  else fail("QA attestation schemaVersion must be 1");
  if (attestations.buildVersion === packageJson.version) {
    pass("QA attestation matches the package version");
  } else {
    fail("QA attestation buildVersion does not match package.json");
  }
  if (attestations.signedCandidate === true) {
    pass("QA attestation covers the signed candidate");
  } else {
    fail("QA attestation does not cover a signed candidate");
  }
  if (
    nonEmptyString(attestations.testedAt) &&
    Number.isFinite(Date.parse(attestations.testedAt))
  ) {
    pass("QA attestation has a valid test timestamp");
  } else {
    fail("QA attestation has no valid testedAt timestamp");
  }
  const requiredAttestations = [
    "windowsX64.installLaunch",
    "windowsX64.fullCampaign",
    "macosArm64.installLaunch",
    "macosArm64.fullCampaign",
    "steamClient.achievements",
    "steamClient.stats",
    "steamClient.cloudConflict",
    "steamClient.overlay",
    "steamClient.richPresence",
    "input.physicalGamepad",
    "input.physicalTouchDevice",
    "input.steamDeck",
  ];
  for (const field of requiredAttestations) {
    const value = field.split(".").reduce(
      (current, key) => current?.[key],
      attestations,
    );
    if (value === true) pass(`QA attestation: ${field}`);
    else fail(`QA attestation missing: ${field}`);
  }
}

const aiDisclosure = readJson("store/steam_ai_disclosure.json");
if (aiDisclosure) {
  if (aiDisclosure.runtimeGeneration === false) {
    pass("runtime generative AI is disabled");
  } else {
    fail("runtime generative AI must be reviewed before release");
  }
  if (aiDisclosure.externalReview?.modelCommercialTermsVerified === true) {
    pass("generative-AI model commercial terms are verified");
  } else {
    fail("generative-AI model commercial terms are not verified");
  }
  if (aiDisclosure.externalReview?.finalSteamSurveySubmitted === true) {
    pass("final Steam generative-AI survey is submitted");
  } else {
    fail("final Steam generative-AI survey is not submitted");
  }
}

const result = {
  status: blockers.length ? "blocked" : "ready",
  version: packageJson.version,
  checks: checks.length,
  blockers,
};
console.log(JSON.stringify(result, null, 2));
if (blockers.length) process.exitCode = 1;
