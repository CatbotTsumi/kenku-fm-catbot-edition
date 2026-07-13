import { useEffect } from "react";
import { useDispatch } from "react-redux";

import { Guild } from "../../../types/discord";
import {
  addOutput,
  removeOutput,
  resetOutputs,
  setConnectionStatus,
  setGuilds,
} from "./voiceSlice";

export function useVoiceSync() {
  const dispatch = useDispatch();

  useEffect(() => {
    window.player.on("DISCORD_GUILDS", (args) => {
      const guilds = args[0] as Guild[];
      dispatch(setGuilds(guilds));
    });
    window.player.on("DISCORD_READY", () => {
      dispatch(setConnectionStatus("ready"));
    });
    window.player.on("DISCORD_DISCONNECTED", () => {
      dispatch(setConnectionStatus("disconnected"));
      dispatch(setGuilds([]));
      dispatch(resetOutputs());
    });
    window.player.on("DISCORD_CHANNEL_JOINED", (args) => {
      const channelId = args[0] as string;
      dispatch(addOutput(channelId));
    });
    window.player.on("DISCORD_CHANNEL_LEFT", (args) => {
      const channelId = args[0] as string;
      dispatch(removeOutput(channelId));
    });

    return () => {
      window.player.removeAllListeners("DISCORD_GUILDS");
      window.player.removeAllListeners("DISCORD_READY");
      window.player.removeAllListeners("DISCORD_DISCONNECTED");
      window.player.removeAllListeners("DISCORD_CHANNEL_JOINED");
      window.player.removeAllListeners("DISCORD_CHANNEL_LEFT");
    };
  }, [dispatch]);
}
