import { WebContents } from "electron";
import { BrowserViewManagerMain } from "../managers/BrowserViewManagerMain";
import {
  TunaTrackData,
  YOUTUBE_MUSIC_METADATA_SCRIPT,
} from "./youtubeMusicMetadata";

const POLL_INTERVAL_MS = 500;
const COOLDOWN_MS = 10_000;
const MAX_FAILURES_BEFORE_COOLDOWN = 3;
const DEFAULT_PORT = 1608;

const STOPPED_DATA: TunaTrackData = {
  status: "stopped",
  title: "",
  artists: [],
  progress: 0,
  duration: 0,
};

function isYoutubeMusicUrl(url: string): boolean {
  try {
    return new URL(url).hostname === "music.youtube.com";
  } catch {
    return false;
  }
}

function getTunaPort(): number {
  const raw = process.env.KENKU_TUNA_PORT;
  if (!raw) {
    return DEFAULT_PORT;
  }
  const port = Number.parseInt(raw, 10);
  return Number.isFinite(port) && port > 0 && port <= 65535
    ? port
    : DEFAULT_PORT;
}

function trackDataKey(data: TunaTrackData): string {
  return JSON.stringify({
    title: data.title,
    artists: data.artists,
    status: data.status,
    cover: data.cover,
    album: data.album,
    album_url: data.album_url,
  });
}

export class TunaManager {
  private viewManager: BrowserViewManagerMain;
  private port: number;
  private interval?: ReturnType<typeof setInterval>;
  private playingViews = new Set<number>();
  private playerViewIds = new Set<number>();
  private lastActiveViewId?: number;
  private lastTrackKey?: string;
  private failureCount = 0;
  private cooldownUntil = 0;
  private wasPlaying = false;
  private warnedOffline = false;

  constructor(viewManager: BrowserViewManagerMain) {
    this.viewManager = viewManager;
    this.port = getTunaPort();

    viewManager.setViewLifecycleCallbacks({
      onViewAdded: (id, view, preload) => {
        if (preload) {
          this.playerViewIds.add(id);
          return;
        }
        this._attachViewListeners(id, view.webContents);
      },
      onViewRemoved: (id) => {
        this.playingViews.delete(id);
        this.playerViewIds.delete(id);
        if (this.lastActiveViewId === id) {
          this.lastActiveViewId = undefined;
        }
      },
    });

    console.log(
      `Tuna OBS integration enabled (localhost:${this.port}). Configure OBS Tuna: Web browser source.`,
    );
    this.interval = setInterval(() => {
      void this._poll();
    }, POLL_INTERVAL_MS);
  }

  destroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.viewManager.setViewLifecycleCallbacks(undefined);
    if (this.wasPlaying) {
      void this._post(STOPPED_DATA);
    }
  }

  private _attachViewListeners(id: number, webContents: WebContents) {
    webContents.on("media-started-playing", () => {
      this.playingViews.add(id);
      this.lastActiveViewId = id;
    });
    webContents.on("media-paused", () => {
      this.playingViews.delete(id);
    });
  }

  private async _poll() {
    if (Date.now() < this.cooldownUntil) {
      return;
    }

    const candidateId = this._pickCandidateViewId();
    if (candidateId === undefined) {
      if (this.wasPlaying) {
        await this._post(STOPPED_DATA);
        this.wasPlaying = false;
        this.lastTrackKey = undefined;
      }
      return;
    }

    const view = this.viewManager.views[candidateId];
    if (!view || view.webContents.isDestroyed()) {
      return;
    }

    let trackData: TunaTrackData | null;
    try {
      trackData = await view.webContents.executeJavaScript(
        YOUTUBE_MUSIC_METADATA_SCRIPT,
        true,
      );
    } catch {
      return;
    }

    if (!trackData || !trackData.title) {
      if (this.wasPlaying && this.lastActiveViewId === candidateId) {
        await this._post(STOPPED_DATA);
        this.wasPlaying = false;
        this.lastTrackKey = undefined;
      }
      return;
    }

    const trackKey = trackDataKey(trackData);
    const isPlaying = trackData.status === "playing";

    if (
      !isPlaying &&
      this.lastTrackKey === trackKey &&
      trackData.status === "stopped"
    ) {
      return;
    }

    if (!isPlaying && trackKey === this.lastTrackKey) {
      return;
    }

    await this._post(trackData);
    this.lastTrackKey = trackKey;
    this.wasPlaying = isPlaying;
    this.lastActiveViewId = candidateId;
  }

  private _pickCandidateViewId(): number | undefined {
    for (const id of this.playingViews) {
      if (this.playerViewIds.has(id)) {
        continue;
      }
      const view = this.viewManager.views[id];
      if (!view || view.webContents.isDestroyed()) {
        continue;
      }
      if (isYoutubeMusicUrl(view.webContents.getURL())) {
        return id;
      }
    }

    const topView = this.viewManager.topView;
    if (topView && !topView.webContents.isDestroyed()) {
      const topId = topView.webContents.id;
      if (
        !this.playerViewIds.has(topId) &&
        isYoutubeMusicUrl(topView.webContents.getURL())
      ) {
        return topId;
      }
    }

    for (const id in this.viewManager.views) {
      const viewId = Number(id);
      if (this.playerViewIds.has(viewId)) {
        continue;
      }
      const view = this.viewManager.views[viewId];
      if (!view || view.webContents.isDestroyed()) {
        continue;
      }
      if (isYoutubeMusicUrl(view.webContents.getURL())) {
        return viewId;
      }
    }

    return undefined;
  }

  private async _post(data: TunaTrackData) {
    const payload = {
      data,
      hostname: "music.youtube.com",
      date: Date.now(),
    };

    try {
      const response = await fetch(`http://localhost:${this.port}/`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.failureCount = 0;
      this.warnedOffline = false;
    } catch {
      this.failureCount++;
      if (this.failureCount === 1 && !this.warnedOffline) {
        console.warn(
          `Tuna OBS not reachable on localhost:${this.port}. Is OBS running with Tuna Web browser source enabled?`,
        );
        this.warnedOffline = true;
      }
      if (this.failureCount >= MAX_FAILURES_BEFORE_COOLDOWN) {
        this.cooldownUntil = Date.now() + COOLDOWN_MS;
        this.failureCount = 0;
      }
    }
  }
}
