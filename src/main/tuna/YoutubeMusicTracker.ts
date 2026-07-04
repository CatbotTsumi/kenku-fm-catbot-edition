import { WebContents } from "electron";
import { BrowserViewManagerMain } from "../managers/BrowserViewManagerMain";
import {
  TunaTrackData,
  trackDataKey,
  YOUTUBE_MUSIC_METADATA_SCRIPT,
} from "./youtubeMusicMetadata";

const POLL_INTERVAL_MS = 500;

export type TrackUpdateListener = (track: TunaTrackData | null) => void;

function isYoutubeMusicUrl(url: string): boolean {
  try {
    return new URL(url).hostname === "music.youtube.com";
  } catch {
    return false;
  }
}

export class YoutubeMusicTracker {
  private viewManager: BrowserViewManagerMain;
  private interval?: ReturnType<typeof setInterval>;
  private playingViews = new Set<number>();
  private playerViewIds = new Set<number>();
  private lastActiveViewId?: number;
  private lastTrackKey?: string;
  private wasPlaying = false;
  private currentTrack: TunaTrackData | null = null;
  private listeners = new Set<TrackUpdateListener>();

  constructor(viewManager: BrowserViewManagerMain) {
    this.viewManager = viewManager;

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
    this.listeners.clear();
    this.currentTrack = null;
  }

  getCurrentTrack(): TunaTrackData | null {
    return this.currentTrack;
  }

  async fetchCurrentTrack(): Promise<TunaTrackData | null> {
    const candidateId = this._pickCandidateViewId();
    if (candidateId === undefined) {
      return null;
    }

    const view = this.viewManager.views[candidateId];
    if (!view || view.webContents.isDestroyed()) {
      return this.currentTrack;
    }

    try {
      const trackData: TunaTrackData | null =
        await view.webContents.executeJavaScript(
          YOUTUBE_MUSIC_METADATA_SCRIPT,
          true,
        );
      if (trackData?.title) {
        this.currentTrack = trackData;
        return trackData;
      }
    } catch {
      return this.currentTrack;
    }

    return null;
  }

  onTrackUpdate(listener: TrackUpdateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private _emit(track: TunaTrackData | null) {
    this.currentTrack = track;
    for (const listener of this.listeners) {
      listener(track);
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
    const candidateId = this._pickCandidateViewId();
    if (candidateId === undefined) {
      if (this.wasPlaying) {
        this.wasPlaying = false;
        this.lastTrackKey = undefined;
        this._emit(null);
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
        this.wasPlaying = false;
        this.lastTrackKey = undefined;
        this._emit(null);
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

    this.lastTrackKey = trackKey;
    this.wasPlaying = isPlaying;
    this.lastActiveViewId = candidateId;
    this._emit(trackData);
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
}
