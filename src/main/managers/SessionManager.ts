import { BrowserWindow } from "electron";
import { isStreamBrowserProfile } from "../browserProfile";
import { TunaManager } from "../tuna/TunaManager";
import { YoutubeMusicTracker } from "../tuna/YoutubeMusicTracker";
import { BrowserViewManagerMain } from "./BrowserViewManagerMain";
import { PlaybackManager } from "./PlaybackManager";
import { PlayerManager } from "./PlayerManager";
import { WindowManager } from "./WindowManager";

export class SessionManager {
  private playbackManager: PlaybackManager;
  private playerManager: PlayerManager;
  private viewManager: BrowserViewManagerMain;
  private windowManager: WindowManager;
  private youtubeMusicTracker: YoutubeMusicTracker;
  private tunaManager?: TunaManager;

  constructor(window: BrowserWindow) {
    this.viewManager = new BrowserViewManagerMain(window);
    this.youtubeMusicTracker = new YoutubeMusicTracker(this.viewManager);
    this.playbackManager = new PlaybackManager(window, this.youtubeMusicTracker);
    this.windowManager = new WindowManager(window);
    this.playerManager = new PlayerManager();

    if (isStreamBrowserProfile()) {
      this.tunaManager = new TunaManager(this.youtubeMusicTracker);
    }
  }

  destroy() {
    this.tunaManager?.destroy();
    this.playbackManager.destroy();
    this.youtubeMusicTracker.destroy();
    this.viewManager.destroy();
    this.windowManager.destroy();
    this.playerManager.destroy();
  }
}
