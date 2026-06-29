import http from "http";
import { app, BrowserWindow } from "electron";
import fs from "fs";

const [devUserData, inFile] = process.argv.slice(2);

if (!devUserData || !inFile) {
  console.error("Usage: electron _copy-settings-write.mjs <userData> <inFile>");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inFile, "utf8"));
const entries = Object.entries(data).filter(([, value]) => value != null);

if (entries.length === 0) {
  console.error("Nothing to write.");
  process.exit(1);
}

app.setPath("userData", devUserData);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<!doctype html><title>Kenku settings migrate</title>");
});

app.whenReady().then(async () => {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(3000, "127.0.0.1", resolve);
  });

  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true },
  });

  await win.loadURL("http://127.0.0.1:3000/");

  for (const [key, value] of entries) {
    await win.webContents.executeJavaScript(
      `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`,
    );
    console.log(`Wrote ${key}`);
  }

  win.destroy();
  server.close();
  app.exit(0);
});
