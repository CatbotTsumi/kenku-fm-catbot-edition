import { BrowserWindow, ipcMain } from "electron";
import {
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  GuildChannel,
  Interaction,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import {
  createAudioPlayer,
  getVoiceConnection,
  joinVoiceChannel,
  NoSubscriberBehavior,
} from "@discordjs/voice";
import { formatAppTitle } from "../browserProfile";
import { APP_DISPLAY_NAME } from "../../constants/appName";
import { TunaTrackData } from "../tuna/youtubeMusicMetadata";
import { fetchArtistImage } from "../tuna/artistImage";
import { YoutubeMusicTracker } from "../tuna/YoutubeMusicTracker";
import { PlayerManager } from "../managers/PlayerManager";

type VoiceChannelMember = {
  id: string;
  name: string;
  avatarUrl: string;
};

type VoiceChannel = {
  id: string;
  name: string;
  position: number;
  members: VoiceChannelMember[];
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
const YOUTUBE_MUSIC_EMOJI = "<:YoutubeMusic:1522756150163013773>";
const YOUTUBE_EMOJI = "<:Youtube:1522756009917939863>";

function formatDurationMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function youtubeVideoUrl(songUrl: string): string {
  return songUrl.replace(
    "https://music.youtube.com/",
    "https://www.youtube.com/",
  );
}

function formatArtistsList(artists: string[]): string {
  if (artists.length === 0) {
    return "";
  }
  if (artists.length === 1) {
    return artists[0];
  }
  if (artists.length === 2) {
    return `${artists[0]} & ${artists[1]}`;
  }
  return `${artists.slice(0, -1).join(", ")} & ${artists[artists.length - 1]}`;
}

function buildNowPlayingEmbed(track: TunaTrackData): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(track.title ?? "Unknown")
    .setColor(0xff0000);

  if (track.song_url) {
    embed.setURL(track.song_url);
  }

  const primaryArtist = track.artists?.[0];
  if (primaryArtist) {
    const author: { name: string; url?: string; iconURL?: string } = {
      name: primaryArtist,
    };
    if (track.artist_url) {
      author.url = track.artist_url;
    } else if (track.artist_channel_id) {
      author.url = `https://music.youtube.com/channel/${track.artist_channel_id}`;
    }
    if (track.artist_image) {
      author.iconURL = track.artist_image;
    }
    embed.setAuthor(author);
  }

  if (track.cover) {
    embed.setImage(track.cover);
  }

  const artists = track.artists?.filter(Boolean) ?? [];
  if (artists.length > 0) {
    embed.addFields({
      name: "Artist",
      value: formatArtistsList(artists),
      inline: true,
    });
  }

  if (track.album) {
    embed.addFields({ name: "Album", value: track.album, inline: true });
  }

  if (track.song_url) {
    const ytVideoUrl = youtubeVideoUrl(track.song_url);
    embed.addFields({
      name: "Link",
      value: `[${YOUTUBE_MUSIC_EMOJI}](${track.song_url}) [${YOUTUBE_EMOJI}](${ytVideoUrl})`,
    });
  }

  const state = track.status === "playing" ? "Playing" : "Paused";
  let footer = state;
  if (track.progress !== undefined && track.duration) {
    footer += ` · ${formatDurationMs(track.progress)} / ${formatDurationMs(track.duration)}`;
  }
  embed.setFooter({ text: footer });

  return embed;
}

async function enrichTrackArtistImage(
  track: TunaTrackData,
): Promise<TunaTrackData> {
  if (track.artist_image) {
    return track;
  }

  const image = await fetchArtistImage(
    track.artist_url,
    track.artist_channel_id,
  );
  if (!image) {
    return track;
  }

  return { ...track, artist_image: image };
}

function getChannelMembers(channel: GuildChannel): VoiceChannelMember[] {
  if (!channel.isVoiceBased()) {
    return [];
  }
  return [...channel.members.values()].map((member) => ({
    id: member.id,
    name: member.displayName,
    avatarUrl: member.displayAvatarURL({ extension: "png", size: 32 }),
  }));
}

export class DiscordBroadcast {
  window: BrowserWindow;
  client?: Client;
  private youtubeMusicTracker: YoutubeMusicTracker;
  private playerManager?: PlayerManager;
  private voiceStateDebounceTimer?: ReturnType<typeof setTimeout>;
  audioPlayer = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
      // Set max missed frames to 60 seconds (20ms per frame)
      maxMissedFrames: 3000,
    },
  });

  constructor(
    window: BrowserWindow,
    youtubeMusicTracker: YoutubeMusicTracker,
    playerManager?: PlayerManager,
  ) {
    this.window = window;
    this.youtubeMusicTracker = youtubeMusicTracker;
    this.playerManager = playerManager;
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
    this._teardownClient();
  }

  _resetWindowTitle() {
    this.window.setTitle(DEFAULT_WINDOW_TITLE);
  }

  private _sendDiscordEvent(channel: string, ...args: unknown[]) {
    this.window.webContents.send(channel, ...args);
    this.playerManager?.forwardToPlayer(channel, ...args);
  }

  private _replyDiscordEvent(
    event: Electron.IpcMainEvent,
    channel: string,
    ...args: unknown[]
  ) {
    event.reply(channel, ...args);
    this.playerManager?.forwardToPlayer(channel, ...args);
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
              members: getChannelMembers(channel),
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

  private _teardownClient() {
    if (this.voiceStateDebounceTimer) {
      clearTimeout(this.voiceStateDebounceTimer);
      this.voiceStateDebounceTimer = undefined;
    }
    if (this.client) {
      this.client.off(Events.InteractionCreate, this._handleInteractionCreate);
      this.client.off(Events.VoiceStateUpdate, this._handleVoiceStateUpdate);
      this.client.destroy();
      this.client = undefined;
    }
  }

  _handleVoiceStateUpdate = () => {
    if (this.voiceStateDebounceTimer) {
      clearTimeout(this.voiceStateDebounceTimer);
    }
    this.voiceStateDebounceTimer = setTimeout(async () => {
      this.voiceStateDebounceTimer = undefined;
      if (!this.client) {
        return;
      }
      try {
        const guilds = await this._fetchGuilds();
        this._sendDiscordEvent("DISCORD_GUILDS", guilds);
      } catch (err) {
        console.error("Failed to refresh guilds after voice state update:", err);
      }
    }, 200);
  };

  private async _registerSlashCommands(token: string) {
    if (!this.client?.user) {
      return;
    }
    const rest = new REST().setToken(token);
    await rest.put(Routes.applicationCommands(this.client.user.id), {
      body: [
        new SlashCommandBuilder()
          .setName("nowplaying")
          .setDescription("Show the current YouTube Music track")
          .toJSON(),
      ],
    });
  }

  _handleInteractionCreate = async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }
    if (interaction.commandName !== "nowplaying") {
      return;
    }

    let track = await this.youtubeMusicTracker.fetchCurrentTrack();
    if (!track?.title) {
      await interaction.reply({
        content: "Nothing playing on YouTube Music.",
        ephemeral: true,
      });
      return;
    }

    const needsArtistImage =
      !track.artist_image &&
      Boolean(track.artist_url || track.artist_channel_id);

    if (needsArtistImage) {
      await interaction.deferReply();
      track = await enrichTrackArtistImage(track);
      await interaction.editReply({ embeds: [buildNowPlayingEmbed(track)] });
      return;
    }

    await interaction.reply({ embeds: [buildNowPlayingEmbed(track)] });
  };

  _handleConnect = async (event: Electron.IpcMainEvent, token: string) => {
    if (!token) {
      this._resetWindowTitle();
      this._replyDiscordEvent(event, "DISCORD_DISCONNECTED");
      event.reply("ERROR", "Error connecting to bot: Invalid token");
      return;
    }
    this._teardownClient();

    try {
      this.client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
      });
      this.client.on(Events.InteractionCreate, this._handleInteractionCreate);
      this.client.on(Events.VoiceStateUpdate, this._handleVoiceStateUpdate);
      this.client.once(Events.ClientReady, async () => {
        const profile = this._getBotProfile();
        if (profile) {
          this.window.setTitle(formatAppTitle(profile.name));
          this._replyDiscordEvent(event, "DISCORD_READY", profile);
        } else {
          this._replyDiscordEvent(event, "DISCORD_READY");
        }
        event.reply("MESSAGE", "Connected");
        try {
          await this._registerSlashCommands(token);
        } catch (err) {
          console.error("Failed to register slash commands:", err);
        }
        const guilds = await this._fetchGuilds();
        this._replyDiscordEvent(event, "DISCORD_GUILDS", guilds);
      });
      this.client.on("error", (err) => {
        this._resetWindowTitle();
        this._replyDiscordEvent(event, "DISCORD_DISCONNECTED");
        event.reply("ERROR", `Error connecting to bot: ${err.message}`);
      });
      await this.client.login(token);
    } catch (err) {
      this._resetWindowTitle();
      this._replyDiscordEvent(event, "DISCORD_DISCONNECTED");
      event.reply("ERROR", `Error connecting to bot: ${err.message}`);
    }
  };

  _handleDisconnect = async (event: Electron.IpcMainEvent) => {
    this._resetWindowTitle();
    this._replyDiscordEvent(event, "DISCORD_DISCONNECTED");
    this._replyDiscordEvent(event, "DISCORD_GUILDS", []);
    this._replyDiscordEvent(event, "DISCORD_CHANNEL_JOINED", "local");
    this._teardownClient();
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
          this._replyDiscordEvent(event, "DISCORD_CHANNEL_JOINED", channelId);
          connection.on("error", (e) => {
            console.error(e);
            connection.destroy();
            this._replyDiscordEvent(event, "DISCORD_CHANNEL_LEFT", channelId);
            event.reply(
              "ERROR",
              `Error connecting to voice channel: ${e.message}`,
            );
          });
        } catch (e) {
          console.error(e);
          this._replyDiscordEvent(event, "DISCORD_CHANNEL_LEFT", channelId);
          event.reply(
            "ERROR",
            `Error connecting to voice channel: ${e.message}`,
          );
        }
      }
    } else {
      this._replyDiscordEvent(event, "DISCORD_CHANNEL_LEFT", channelId);
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
    this.playerManager?.forwardToPlayer("DISCORD_CHANNEL_LEFT", channelId);
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
        this._replyDiscordEvent(event, "DISCORD_CHANNEL_LEFT", channelId);
      }

      await guild.leave();
      const guilds = await this._fetchGuilds();
      this._replyDiscordEvent(event, "DISCORD_GUILDS", guilds);
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
