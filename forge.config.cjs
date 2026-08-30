const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");
const desktopAuth = require("./desktop-auth.config.json");

const packageFiles = [
  "/dist",
  "/dist-electron",
  "/package.json",
  "/LICENSE",
  "/THIRD_PARTY_NOTICES.md",
];

function ignoreUnpackagedFiles(filePath) {
  if (filePath === "") return false;
  const normalizedPath = filePath.replaceAll("\\", "/");
  return !packageFiles.some(
    (packageFile) => normalizedPath === packageFile || normalizedPath.startsWith(`${packageFile}/`),
  );
}

module.exports = {
  packagerConfig: {
    appBundleId: desktopAuth.scheme,
    asar: true,
    extraResource: [
      "LICENSE",
      "THIRD_PARTY_NOTICES.md",
      "public/geist-OFL-1.1.txt",
      "public/stockfish-18-Copying.txt",
    ],
    ignore: ignoreUnpackagedFiles,
    name: "En Passant",
    protocols: [
      {
        name: "En Passant authentication",
        schemes: [desktopAuth.scheme],
      },
    ],
  },
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin", "win32"],
    },
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "en_passant",
      },
    },
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    }),
  ],
};
