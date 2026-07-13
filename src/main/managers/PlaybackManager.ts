import { createAudioResource } from "@discordjs/voice";
import { BrowserWindow } from "electron";
import { DiscordBroadcast } from "../broadcast/DiscordBroadcast";
import { YoutubeMusicTracker } from "../tuna/YoutubeMusicTracker";
import { AudioCaptureManagerMain } from "./AudioCaptureManagerMain";
import { PlayerManager } from "./PlayerManager";

export class PlaybackManager {
  discord: DiscordBroadcast;
  audioCaptureManager: AudioCaptureManagerMain;

  constructor(
    window: BrowserWindow,
    youtubeMusicTracker: YoutubeMusicTracker,
    playerManager: PlayerManager,
  ) {
    this.discord = new DiscordBroadcast(
      window,
      youtubeMusicTracker,
      playerManager,
    );
    this.audioCaptureManager = new AudioCaptureManagerMain();
    this.audioCaptureManager.on("streamStart", (stream) => {
      const resource = createAudioResource(stream);
      this.discord.audioPlayer.play(resource);
    });
    this.audioCaptureManager.on("streamEnd", () => {
      this.discord.audioPlayer.stop();
    });
  }

  destroy() {
    this.discord.destroy();
    this.audioCaptureManager.destroy();
  }
}
