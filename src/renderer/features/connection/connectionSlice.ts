import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ConnectionStatus = "disconnected" | "connecting" | "ready";

export interface ConnectionState {
  status: ConnectionStatus;
  botName: string | null;
  botAvatarUrl: string | null;
}

const initialState: ConnectionState = {
  status: "disconnected",
  botName: null,
  botAvatarUrl: null,
};

export const connectionSlice = createSlice({
  name: "connection",
  initialState,
  reducers: {
    setStatus: (state, action: PayloadAction<ConnectionStatus>) => {
      state.status = action.payload;
      if (action.payload === "disconnected") {
        state.botName = null;
        state.botAvatarUrl = null;
      }
    },
    setBotProfile: (
      state,
      action: PayloadAction<{ name: string; avatarUrl: string }>,
    ) => {
      state.botName = action.payload.name;
      state.botAvatarUrl = action.payload.avatarUrl;
    },
  },
});

export const { setStatus, setBotProfile } = connectionSlice.actions;

export default connectionSlice.reducer;
