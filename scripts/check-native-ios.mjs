import { spawnSync } from "node:child_process";
if (process.platform !== "darwin") throw new Error("Local iOS builds require macOS and Xcode.");
const pod = spawnSync("pod", ["--version"], { encoding: "utf8" });
const [major = 0, minor = 0] = pod.stdout.trim().split(".").map(Number);
if (pod.status !== 0 || major < 1 || (major === 1 && minor < 16)) {
  throw new Error(
    "iOS builds require CocoaPods >= 1.16. Upgrade CocoaPods before running native:ios. Do not change dependency podspecs to work around an old CocoaPods installation.",
  );
}
const xcode = spawnSync("xcodebuild", ["-version"], { encoding: "utf8" });
if (xcode.status !== 0)
  throw new Error("Install and select Xcode 26.4 or newer before building Expo SDK 57.");
process.stdout.write(
  `Native iOS prerequisites: CocoaPods ${pod.stdout.trim()}, ${xcode.stdout.trim()}\n`,
);
