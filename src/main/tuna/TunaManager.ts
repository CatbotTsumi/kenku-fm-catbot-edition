import { TunaTrackData } from "./youtubeMusicMetadata";
import { YoutubeMusicTracker } from "./YoutubeMusicTracker";

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

export class TunaManager {
  private port: number;
  private unsubscribe?: () => void;
  private failureCount = 0;
  private cooldownUntil = 0;
  private wasPlaying = false;
  private warnedOffline = false;

  constructor(tracker: YoutubeMusicTracker) {
    this.port = getTunaPort();

    console.log(
      `Tuna OBS integration enabled (localhost:${this.port}). Configure OBS Tuna: Web browser source.`,
    );

    this.unsubscribe = tracker.onTrackUpdate((track) => {
      void this._handleTrackUpdate(track);
    });
  }

  destroy() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (this.wasPlaying) {
      void this._post(STOPPED_DATA);
    }
  }

  private async _handleTrackUpdate(track: TunaTrackData | null) {
    if (Date.now() < this.cooldownUntil) {
      return;
    }

    if (!track || !track.title) {
      if (this.wasPlaying) {
        await this._post(STOPPED_DATA);
        this.wasPlaying = false;
      }
      return;
    }

    await this._post(track);
    this.wasPlaying = track.status === "playing";
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
