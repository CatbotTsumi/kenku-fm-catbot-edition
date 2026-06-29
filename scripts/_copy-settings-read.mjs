import { app, BrowserWindow } from "electron";
import fs from "fs";

const [installedUserData, rendererDir, outFile] = process.argv.slice(2);

if (!installedUserData || !rendererDir || !outFile) {
  console.error("Usage: electron _copy-settings-read.mjs <userData> <rendererDir> <outFile>");
  process.exit(1);
}

app.setPath("userData", installedUserData);

async function readPersist(htmlPath, keys) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true },
  });
  await win.loadFile(htmlPath);
  const result = {};
  for (const key of keys) {
    result[key] = await win.webContents.executeJavaScript(
      `localStorage.getItem(${JSON.stringify(key)})`,
    );
  }
  win.destroy();
  return result;
}

app.whenReady().then(async () => {
  const data = {
    ...(await readPersist(`${rendererDir}/main_window/index.html`, ["persist:root"])),
    ...(await readPersist(`${rendererDir}/player_window/index.html`, [
      "persist:player",
      "persist:playback",
    ])),
  };

  const migrated = Object.entries(data).filter(([, value]) => value != null);
  if (migrated.length === 0) {
    console.error("No persist data found in installed profile.");
    app.exit(1);
    return;
  }

  for (const [key] of migrated) {
    console.log(`Read ${key}`);
  }

  fs.writeFileSync(outFile, JSON.stringify(data));
  app.exit(0);
});
