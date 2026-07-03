import { BrowserWindow, ipcMain } from "electron";
import { ChannelType, Client, Events, GatewayIntentBits } from "discord.js";
import {
  createAudioPlayer,
  getVoiceConnection,
  joinVoiceChannel,
  NoSubscriberBehavior,
} from "@discordjs/voice";
import { formatAppTitle } from "../browserProfile";
import { APP_DISPLAY_NAME } from "../../constants/appName";

type VoiceChannel = {
  id: string;
  name: string;
  position: number;
};

type Guild = {
  id: string;
  name: string;
  icon: string;
  voiceChannels: VoiceChannel[];
};

export type DiscordBotProfile = {
  name: string;
  avatarUrl: string;
};

const DEFAULT_WINDOW_TITLE = formatAppTitle(APP_DISPLAY_NAME);

export class DiscordBroadcast {
  window: BrowserWindow;
  client?: Client;
  audioPlayer = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
      // Set max missed frames to 60 seconds (20ms per frame)
      maxMissedFrames: 3000,
    },
  });
  constructor(window: BrowserWindow) {
    this.window = window;
    ipcMain.on("DISCORD_CONNECT", this._handleConnect);
    ipcMain.on("DISCORD_DISCONNECT", this._handleDisconnect);
    ipcMain.on("DISCORD_JOIN_CHANNEL", this._handleJoinChannel);
    ipcMain.on("DISCORD_LEAVE_CHANNEL", this._handleLeaveChannel);
    ipcMain.on("DISCORD_LEAVE_GUILD", this._handleLeaveGuild);
    this.audioPlayer.on("error", this._handleBroadcastError);
  }

  destroy() {
    ipcMain.off("DISCORD_CONNECT", this._handleConnect);
    ipcMain.off("DISCORD_DISCONNECT", this._handleDisconnect);
    ipcMain.off("DISCORD_JOIN_CHANNEL", this._handleJoinChannel);
    ipcMain.off("DISCORD_LEAVE_CHANNEL", this._handleLeaveChannel);
    ipcMain.off("DISCORD_LEAVE_GUILD", this._handleLeaveGuild);
    this.client?.destroy();
    this.client = undefined;
  }

  _resetWindowTitle() {
    this.window.setTitle(DEFAULT_WINDOW_TITLE);
  }

  _getBotProfile(): DiscordBotProfile | null {
    const user = this.client?.user;
    if (!user) {
      return null;
    }
    return {
      name: user.displayName ?? user.username,
      avatarUrl: user.displayAvatarURL({ extension: "png", size: 128 }),
    };
  }

  async _fetchGuilds(): Promise<Guild[]> {
    const rawGuilds = await this.client.guilds.fetch();
    return Promise.all(
      rawGuilds.map(async (baseGuild) => {
        const guild = await baseGuild.fetch();
        const voiceChannels: VoiceChannel[] = [];
        const channels = await guild.channels.fetch();
        channels.forEach((channel) => {
          if (channel && channel.isVoiceBased()) {
            voiceChannels.push({
              id: channel.id,
              name: channel.name,
              position: channel.rawPosition,
            });
          }
        });
        return {
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL(),
          voiceChannels: voiceChannels.sort((a, b) => a.position - b.position),
        };
      }),
    );
  }

  _handleConnect = async (event: Electron.IpcMainEvent, token: string) => {
    if (!token) {
      this._resetWindowTitle();
      event.reply("DISCORD_DISCONNECTED");
      event.reply("ERROR", "Error connecting to bot: Invalid token");
      return;
    }
    if (this.client) {
      this.client.destroy();
      this.client = undefined;
    }

    try {
      this.client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
      });
      this.client.once(Events.ClientReady, async () => {
        const profile = this._getBotProfile();
        if (profile) {
          this.window.setTitle(formatAppTitle(profile.name));
          event.reply("DISCORD_READY", profile);
        } else {
          event.reply("DISCORD_READY");
        }
        event.reply("MESSAGE", "Connected");
        const guilds = await this._fetchGuilds();
        event.reply("DISCORD_GUILDS", guilds);
      });
      this.client.on("error", (err) => {
        this._resetWindowTitle();
        event.reply("DISCORD_DISCONNECTED");
        event.reply("ERROR", `Error connecting to bot: ${err.message}`);
      });
      await this.client.login(token);
    } catch (err) {
      this._resetWindowTitle();
      event.reply("DISCORD_DISCONNECTED");
      event.reply("ERROR", `Error connecting to bot: ${err.message}`);
    }
  };

  _handleDisconnect = async (event: Electron.IpcMainEvent) => {
    this._resetWindowTitle();
    event.reply("DISCORD_DISCONNECTED");
    event.reply("DISCORD_GUILDS", []);
    event.reply("DISCORD_CHANNEL_JOINED", "local");
    this.client.destroy();
    this.client = undefined;
  };

  _handleJoinChannel = async (
    event: Electron.IpcMainEvent,
    channelId: string,
  ) => {
    if (this.client) {
      const channel = await this.client.channels.fetch(channelId);
      if (channel && channel.isVoiceBased() && channel.joinable) {
        try {
          const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
          });
          connection.subscribe(this.audioPlayer);
          event.reply("DISCORD_CHANNEL_JOINED", channelId);
          connection.on("error", (e) => {
            console.error(e);
            connection.destroy();
            event.reply("DISCORD_CHANNEL_LEFT", channelId);
            event.reply(
              "ERROR",
              `Error connecting to voice channel: ${e.message}`,
            );
          });
        } catch (e) {
          console.error(e);
          event.reply("DISCORD_CHANNEL_LEFT", channelId);
          event.reply(
            "ERROR",
            `Error connecting to voice channel: ${e.message}`,
          );
        }
      }
    } else {
      event.reply("DISCORD_CHANNEL_LEFT", channelId);
      event.reply(
        "ERROR",
        `Unable to join voice channel. This channel might be full or this bot might not have permission to join.`,
      );
    }
  };

  _handleLeaveChannel = async (
    event: Electron.IpcMainEvent,
    channelId: string,
  ) => {
    const channel = await this.client.channels.fetch(channelId);
    if (channel.type === ChannelType.GuildVoice) {
      const connection = getVoiceConnection(channel.guild.id);
      connection.destroy();
    }
    event.reply("DISCORD_CHANNEL_LEFT", channelId);
  };

  _handleLeaveGuild = async (
    event: Electron.IpcMainEvent,
    guildId: string,
  ) => {
    if (!this.client) {
      event.reply("ERROR", "Unable to leave server: not connected to Discord");
      return;
    }

    try {
      const guild = await this.client.guilds.fetch(guildId);
      if (!guild) {
        event.reply("ERROR", "Unable to leave server: server not found");
        return;
      }

      const connection = getVoiceConnection(guildId);
      if (connection) {
        const channelId = connection.joinConfig.channelId;
        connection.destroy();
        event.reply("DISCORD_CHANNEL_LEFT", channelId);
      }

      await guild.leave();
      const guilds = await this._fetchGuilds();
      event.reply("DISCORD_GUILDS", guilds);
      event.reply("MESSAGE", `Left ${guild.name}`);
    } catch (err) {
      event.reply(
        "ERROR",
        `Error leaving server: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  _handleBroadcastError = (error: Error) => {
    this.window.webContents.send("ERROR", error.message);
    console.error(error);
  };
}
