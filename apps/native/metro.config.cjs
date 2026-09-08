const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("wasm");
// The browser preview exercises the native controller too. The production web
// app uses Vite and retains its fine-grained Solid signal adapter.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "./versionSignal") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "../../src/lib/app-state/versionSignal.native.ts"),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
