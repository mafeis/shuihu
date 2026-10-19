import { execFileSync } from "node:child_process";
import path from "node:path";

import { signAsync } from "@electron/osx-sign";

export async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  const mainEntitlements = path.resolve("build/entitlements.mac.plist");
  const inheritEntitlements = path.resolve(
    "build/entitlements.mac.inherit.plist",
  );

  await signAsync({
    app: appPath,
    identity: "-",
    identityValidation: false,
    platform: "darwin",
    preAutoEntitlements: false,
    optionsForFile(filePath) {
      return {
        entitlements:
          path.resolve(filePath) === path.resolve(appPath)
            ? mainEntitlements
            : inheritEntitlements,
        hardenedRuntime: true,
        timestamp: "none",
      };
    },
  });

  execFileSync(
    "codesign",
    ["--verify", "--deep", "--strict", "--verbose=2", appPath],
    { stdio: "inherit" },
  );
}
