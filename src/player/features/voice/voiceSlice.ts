import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { Guild } from "../../../types/discord";

export type ConnectionStatus = "disconnected" | "connecting" | "ready";

export interface VoiceState {
  guilds: Guild[];
  outputs: string[];
  connectionStatus: ConnectionStatus;
}

const initialState: VoiceState = {
  guilds: [],
  outputs: ["local"],
  connectionStatus: "disconnected",
};

export const voiceSlice = createSlice({
  name: "voice",
  initialState,
  reducers: {
    setGuilds: (state, action: PayloadAction<Guild[]>) => {
      state.guilds = action.payload;
    },
    setConnectionStatus: (state, action: PayloadAction<ConnectionStatus>) => {
      state.connectionStatus = action.payload;
    },
    addOutput: (state, action: PayloadAction<string>) => {
      if (!state.outputs.includes(action.payload)) {
        state.outputs.push(action.payload);
      }
    },
    removeOutput: (state, action: PayloadAction<string>) => {
      state.outputs = state.outputs.filter(
        (channel) => channel !== action.payload,
      );
    },
    resetOutputs: (state) => {
      state.outputs = ["local"];
    },
  },
});

export const {
  setGuilds,
  setConnectionStatus,
  addOutput,
  removeOutput,
  resetOutputs,
} = voiceSlice.actions;

export default voiceSlice.reducer;
