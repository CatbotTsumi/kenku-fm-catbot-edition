import React from "react";

import Checkbox from "@mui/material/Checkbox";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";

import VolumeIcon from "@mui/icons-material/VolumeUpRounded";

import { VoiceChannel } from "./outputSlice";

type OutputChannelRowProps = {
  voiceChannel: VoiceChannel;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
};

export function OutputChannelRow({
  voiceChannel,
  visible,
  onVisibilityChange,
}: OutputChannelRowProps) {
  return (
    <ListItem dense sx={{ pl: 2 }}>
      <Checkbox
        size="small"
        checked={visible}
        onChange={(_, checked) => onVisibilityChange(checked)}
        sx={{ p: 0.5, mr: 0.5 }}
      />
      <ListItemIcon sx={{ minWidth: "28px" }}>
        <VolumeIcon sx={{ fontSize: "1rem" }} />
      </ListItemIcon>
      <ListItemText
        primary={voiceChannel.name}
        primaryTypographyProps={{ noWrap: true, sx: { fontSize: "0.8rem" } }}
      />
    </ListItem>
  );
}
