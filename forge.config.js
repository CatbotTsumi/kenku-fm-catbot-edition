const path = require("path");

const config = {
  packagerConfig: {
    executableName: "kenku-fm",
    out: "./out",
    icon: "./src/assets/icon",
    appBundleId: "com.kenku.fm",
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "kenku_fm",
        setupIcon: path.join(__dirname, "src", "assets", "setup.ico"),
        loadingGif: path.join(__dirname, "src", "assets", "loading.gif"),
        remoteReleases:
          "https://github.com/CatbotTsumi/kenku-fm-catbot-edition",
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        name: "kenku_fm",
        productName: "Kenku FM Catbot Edition",
        homepage: "https://kenku.fm",
        icon: path.join(__dirname, "src", "assets", "icons", "256x256.png"),
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["linux", "darwin"],
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {
        name: "kenku_fm",
        productName: "Kenku FM Catbot Edition",
        homepage: "https://kenku.fm",
        icon: path.join(__dirname, "src", "assets", "icons", "256x256.png"),
      },
    },
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "CatbotTsumi",
          name: "kenku-fm-catbot-edition",
        },
        prerelease: false,
        draft: false,
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-webpack",
      config: {
        mainConfig: "./webpack.main.config.js",
        renderer: {
          config: "./webpack.renderer.config.js",
          entryPoints: [
            {
              html: "./src/index.html",
              js: "./src/renderer.ts",
              name: "main_window",
              preload: {
                js: "./src/preload.ts",
              },
            },
            {
              html: "./src/player/index.html",
              js: "./src/player/renderer.ts",
              name: "player_window",
              preload: {
                js: "./src/player/preload.ts",
              },
            },
            {
              html: "./src/audioCapture/index.html",
              js: "./src/audioCapture/renderer.ts",
              name: "audio_capture_window",
              preload: {
                js: "./src/audioCapture/preload.ts",
              },
            },
          ],
        },
        devContentSecurityPolicy: "",
      },
    },
    {
      name: "@timfish/forge-externals-plugin",
      config: {
        externals: ["opusscript", "prism-media", "@snazzah/davey"],
        includeDeps: true,
      },
    },
  ],
};

module.exports = config;
