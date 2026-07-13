import { ipcMain, BrowserWindow, webContents } from "electron";
import Fastify, { FastifyInstance } from "fastify";
import { registerRemote } from "../remote";

import { BookmarksCollection } from "../../types/bookmark";
import { Guild } from "../../types/discord";

declare const PLAYER_WINDOW_WEBPACK_ENTRY: string;
declare const PLAYER_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

export type OpenUrlPayload = {
  url: string;
  title: string;
  icon: string;
};

export class PlayerManager {
  registeredViewId?: number;
  fastify: FastifyInstance | null = null;
  address = "127.0.0.1";
  port = "3333";

  private window: BrowserWindow;
  private cachedBookmarks: BookmarksCollection | null = null;
  private cachedGuilds: Guild[] = [];
  private connectionReady = false;
  private cachedOutputs = new Set<string>(["local"]);

  constructor(window: BrowserWindow) {
    this.window = window;
    ipcMain.on("PLAYER_GET_URL", this._handleGetURL);
    ipcMain.on("PLAYER_GET_PRELOAD_URL", this._handleGetPreloadURL);
    ipcMain.on("PLAYER_REGISTER_VIEW", this._handleRegisterView);
    ipcMain.on("PLAYER_START_REMOTE", this._handleStartRemote);
    ipcMain.on("PLAYER_STOP_REMOTE", this._handleStopRemote);
    ipcMain.on("PLAYER_BOOKMARKS_SYNC", this._handleBookmarksSync);
    ipcMain.on("PLAYER_OPEN_URL", this._handleOpenUrl);
  }

  destroy() {
    ipcMain.off("PLAYER_GET_URL", this._handleGetURL);
    ipcMain.off("PLAYER_GET_PRELOAD_URL", this._handleGetPreloadURL);
    ipcMain.off("PLAYER_REGISTER_VIEW", this._handleRegisterView);
    ipcMain.off("PLAYER_START_REMOTE", this._handleStartRemote);
    ipcMain.off("PLAYER_STOP_REMOTE", this._handleStopRemote);
    ipcMain.off("PLAYER_BOOKMARKS_SYNC", this._handleBookmarksSync);
    ipcMain.off("PLAYER_OPEN_URL", this._handleOpenUrl);
    this.stopRemote();
  }

  getView() {
    if (this.registeredViewId) {
      return webContents.fromId(this.registeredViewId);
    }
  }

  forwardToPlayer(channel: string, ...args: unknown[]) {
    if (channel === "DISCORD_GUILDS") {
      this.cachedGuilds = (args[0] as Guild[]) ?? [];
    } else if (channel === "DISCORD_READY") {
      this.connectionReady = true;
    } else if (channel === "DISCORD_DISCONNECTED") {
      this.connectionReady = false;
      this.cachedGuilds = [];
      this.cachedOutputs = new Set(["local"]);
    } else if (channel === "DISCORD_CHANNEL_JOINED") {
      const channelId = args[0] as string;
      this.cachedOutputs.add(channelId);
    } else if (channel === "DISCORD_CHANNEL_LEFT") {
      const channelId = args[0] as string;
      this.cachedOutputs.delete(channelId);
    }

    const view = this.getView();
    if (view && !view.isDestroyed()) {
      view.send(channel, ...args);
    }
  }

  startRemote(address: string, port: string) {
    this.address = address;
    this.port = port;

    this.fastify = Fastify();

    registerRemote(this);

    this.fastify.listen(this.port, this.address, (err) => {
      const windows = BrowserWindow.getAllWindows();
      if (err) {
        for (const window of windows) {
          window.webContents.send("ERROR", err.message);
        }
        this.stopRemote();
      } else {
        for (const window of windows) {
          window.webContents.send("PLAYER_REMOTE_ENABLED", true);
        }
      }
    });
  }

  stopRemote() {
    if (this.fastify) {
      this.fastify.close();
      this.fastify = null;

      const windows = BrowserWindow.getAllWindows();
      for (const window of windows) {
        window.webContents.send("PLAYER_REMOTE_ENABLED", false);
      }
    }
  }

  getRemoteInfo() {
    return `Running: ${this.fastify !== null}\nAddress: ${
      this.address
    }\nPort: ${this.port}`;
  }

  private _pushCachedStateToPlayer() {
    const view = this.getView();
    if (!view || view.isDestroyed()) {
      return;
    }

    if (this.cachedBookmarks) {
      view.send("PLAYER_BOOKMARKS_SYNC", this.cachedBookmarks);
    }

    if (this.connectionReady) {
      view.send("DISCORD_READY");
    } else {
      view.send("DISCORD_DISCONNECTED");
    }

    view.send("DISCORD_GUILDS", this.cachedGuilds);

    for (const channelId of this.cachedOutputs) {
      if (channelId !== "local") {
        view.send("DISCORD_CHANNEL_JOINED", channelId);
      }
    }
  }

  _handleStartRemote = (
    _: Electron.IpcMainEvent,
    address: string,
    port: string,
  ) => this.startRemote(address, port);

  _handleStopRemote = () => this.stopRemote();

  _handleGetURL = (event: Electron.IpcMainEvent) => {
    event.returnValue = PLAYER_WINDOW_WEBPACK_ENTRY;
  };

  _handleGetPreloadURL = (event: Electron.IpcMainEvent) => {
    event.returnValue = PLAYER_WINDOW_PRELOAD_WEBPACK_ENTRY;
  };

  _handleRegisterView = (_: Electron.IpcMainEvent, viewId: number) => {
    this.registeredViewId = viewId;
    this._pushCachedStateToPlayer();
  };

  _handleBookmarksSync = (
    _: Electron.IpcMainEvent,
    bookmarks: BookmarksCollection,
  ) => {
    this.cachedBookmarks = bookmarks;
    this.forwardToPlayer("PLAYER_BOOKMARKS_SYNC", bookmarks);
  };

  _handleOpenUrl = (_: Electron.IpcMainEvent, payload: OpenUrlPayload) => {
    this.window.webContents.send("PLAYER_OPEN_URL_REQUEST", payload);
  };
}
