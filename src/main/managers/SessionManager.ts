import { BrowserWindow } from "electron";
import { isStreamBrowserProfile } from "../browserProfile";
import { TunaManager } from "../tuna/TunaManager";
import { BrowserViewManagerMain } from "./BrowserViewManagerMain";
import { PlaybackManager } from "./PlaybackManager";
import { PlayerManager } from "./PlayerManager";
import { WindowManager } from "./WindowManager";

export class SessionManager {
  private playbackManager: PlaybackManager;
  private playerManager: PlayerManager;
  private viewManager: BrowserViewManagerMain;
  private windowManager: WindowManager;
  private tunaManager?: TunaManager;

  constructor(window: BrowserWindow) {
    this.playbackManager = new PlaybackManager(window);
    this.viewManager = new BrowserViewManagerMain(window);
    this.windowManager = new WindowManager(window);
    this.playerManager = new PlayerManager();

    if (isStreamBrowserProfile()) {
      this.tunaManager = new TunaManager(this.viewManager);
    }
  }

  destroy() {
    this.tunaManager?.destroy();
    this.playbackManager.destroy();
    this.viewManager.destroy();
    this.windowManager.destroy();
    this.playerManager.destroy();
  }
}
