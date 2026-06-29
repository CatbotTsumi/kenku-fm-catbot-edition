import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { arrayMove } from "@dnd-kit/sortable";

export type ConnectionStatus = "disconnected" | "connecting" | "ready";
export type StreamingMode = "lowLatency" | "performance";

export interface SettingsState {
  discordToken: string;
  urlBarEnabled: boolean;
  remoteEnabled: boolean;
  remoteAddress: string;
  remotePort: string;
  externalInputsEnabled: boolean;
  multipleInputsEnabled: boolean;
  multipleOutputsEnabled: boolean;
  streamingMode: StreamingMode;
  sidebarCollapsed: boolean;
  hiddenGuildIds: string[];
  hiddenChannelIds: string[];
  bookmarksSectionOpen: boolean;
  inputsSectionOpen: boolean;
  outputsSectionOpen: boolean;
  collapsedGuildIds: string[];
  guildOrder: string[];
}

const initialState: SettingsState = {
  discordToken: "",
  urlBarEnabled: true,
  remoteEnabled: false,
  remoteAddress: "127.0.0.1",
  remotePort: "3333",
  externalInputsEnabled: false,
  multipleInputsEnabled: false,
  multipleOutputsEnabled: false,
  streamingMode: "performance",
  sidebarCollapsed: false,
  hiddenGuildIds: [],
  hiddenChannelIds: [],
  bookmarksSectionOpen: true,
  inputsSectionOpen: true,
  outputsSectionOpen: true,
  collapsedGuildIds: [],
  guildOrder: [],
};

export const connectionSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setDiscordToken: (state, action: PayloadAction<string>) => {
      state.discordToken = action.payload;
    },
    setURLBarEnabled: (state, action: PayloadAction<boolean>) => {
      state.urlBarEnabled = action.payload;
    },
    setRemoteEnabled: (state, action: PayloadAction<boolean>) => {
      state.remoteEnabled = action.payload;
    },
    setRemoteAddress: (state, action: PayloadAction<string>) => {
      state.remoteAddress = action.payload;
    },
    setRemotePort: (state, action: PayloadAction<string>) => {
      state.remotePort = action.payload;
    },
    setExternalInputsEnabled: (state, action: PayloadAction<boolean>) => {
      state.externalInputsEnabled = action.payload;
    },
    setMultipleInputsEnabled: (state, action: PayloadAction<boolean>) => {
      state.multipleInputsEnabled = action.payload;
    },
    setMultipleOutputsEnabled: (state, action: PayloadAction<boolean>) => {
      state.multipleOutputsEnabled = action.payload;
    },
    setStreamingMode: (state, action: PayloadAction<StreamingMode>) => {
      state.streamingMode = action.payload;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
    setBookmarksSectionOpen: (state, action: PayloadAction<boolean>) => {
      state.bookmarksSectionOpen = action.payload;
    },
    setInputsSectionOpen: (state, action: PayloadAction<boolean>) => {
      state.inputsSectionOpen = action.payload;
    },
    setOutputsSectionOpen: (state, action: PayloadAction<boolean>) => {
      state.outputsSectionOpen = action.payload;
    },
    toggleGuildCollapsed: (
      state,
      action: PayloadAction<{ guildId: string; collapsed: boolean }>,
    ) => {
      const { guildId, collapsed } = action.payload;
      if (collapsed) {
        if (!state.collapsedGuildIds.includes(guildId)) {
          state.collapsedGuildIds.push(guildId);
        }
      } else {
        state.collapsedGuildIds = state.collapsedGuildIds.filter(
          (id) => id !== guildId,
        );
      }
    },
    moveGuild: (
      state,
      action: PayloadAction<{ active: string; over: string }>,
    ) => {
      const { active, over } = action.payload;
      if (active === over || state.guildOrder.length === 0) {
        return;
      }
      const oldIndex = state.guildOrder.indexOf(active);
      const newIndex = state.guildOrder.indexOf(over);
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }
      state.guildOrder = arrayMove(state.guildOrder, oldIndex, newIndex);
    },
    mergeGuildOrder: (state, action: PayloadAction<string[]>) => {
      const incoming = action.payload;
      if (state.guildOrder.length === 0) {
        state.guildOrder = [...incoming];
        return;
      }
      const existing = new Set(state.guildOrder);
      for (const guildId of incoming) {
        if (!existing.has(guildId)) {
          state.guildOrder.push(guildId);
          existing.add(guildId);
        }
      }
    },
    removeGuildPreferences: (state, action: PayloadAction<string>) => {
      const guildId = action.payload;
      state.guildOrder = state.guildOrder.filter((id) => id !== guildId);
      state.collapsedGuildIds = state.collapsedGuildIds.filter(
        (id) => id !== guildId,
      );
    },
    setGuildHidden: (
      state,
      action: PayloadAction<{ guildId: string; hidden: boolean }>,
    ) => {
      const { guildId, hidden } = action.payload;
      if (hidden) {
        if (!state.hiddenGuildIds.includes(guildId)) {
          state.hiddenGuildIds.push(guildId);
        }
      } else {
        state.hiddenGuildIds = state.hiddenGuildIds.filter(
          (id) => id !== guildId,
        );
      }
    },
    setChannelHidden: (
      state,
      action: PayloadAction<{ channelId: string; hidden: boolean }>,
    ) => {
      const { channelId, hidden } = action.payload;
      if (hidden) {
        if (!state.hiddenChannelIds.includes(channelId)) {
          state.hiddenChannelIds.push(channelId);
        }
      } else {
        state.hiddenChannelIds = state.hiddenChannelIds.filter(
          (id) => id !== channelId,
        );
      }
    },
    pruneHiddenDiscordIds: (
      state,
      action: PayloadAction<{ guildIds: string[]; channelIds: string[] }>,
    ) => {
      const { guildIds, channelIds } = action.payload;
      state.hiddenGuildIds = state.hiddenGuildIds.filter((id) =>
        guildIds.includes(id),
      );
      state.hiddenChannelIds = state.hiddenChannelIds.filter((id) =>
        channelIds.includes(id),
      );
      state.guildOrder = state.guildOrder.filter((id) =>
        guildIds.includes(id),
      );
      state.collapsedGuildIds = state.collapsedGuildIds.filter((id) =>
        guildIds.includes(id),
      );
    },
  },
});

export const {
  setDiscordToken,
  setURLBarEnabled,
  setRemoteEnabled,
  setRemoteAddress,
  setRemotePort,
  setExternalInputsEnabled,
  setMultipleInputsEnabled,
  setMultipleOutputsEnabled,
  setStreamingMode,
  setSidebarCollapsed,
  setBookmarksSectionOpen,
  setInputsSectionOpen,
  setOutputsSectionOpen,
  toggleGuildCollapsed,
  moveGuild,
  mergeGuildOrder,
  removeGuildPreferences,
  setGuildHidden,
  setChannelHidden,
  pruneHiddenDiscordIds,
} = connectionSlice.actions;

export default connectionSlice.reducer;
