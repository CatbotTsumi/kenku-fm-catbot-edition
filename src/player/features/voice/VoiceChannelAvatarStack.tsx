import React from "react";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";

import { VoiceChannelMember } from "../../../types/discord";

const AVATAR_SIZE = 24;
const AVATAR_OVERLAP = 8;
const MAX_VISIBLE = 10;

type VoiceChannelAvatarStackProps = {
  members: VoiceChannelMember[];
  selected?: boolean;
};

export function VoiceChannelAvatarStack({
  members,
  selected = false,
}: VoiceChannelAvatarStackProps) {
  const theme = useTheme();

  if (members.length === 0) {
    return null;
  }

  const visible = members.slice(0, MAX_VISIBLE);
  const overflow = members.length - MAX_VISIBLE;
  const borderColor = selected
    ? theme.palette.action.selected
    : theme.palette.background.paper;

  const avatarSx = (index: number, total: number) => ({
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    ml: index > 0 ? `-${AVATAR_OVERLAP}px` : 0,
    zIndex: total - index,
    border: `2px solid ${borderColor}`,
    boxSizing: "border-box" as const,
  });

  return (
    <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
      {visible.map((member, index) => (
        <Avatar
          key={member.id}
          src={member.avatarUrl}
          alt={member.name}
          sx={avatarSx(index, visible.length + (overflow > 0 ? 1 : 0))}
        />
      ))}
      {overflow > 0 && (
        <Avatar
          sx={{
            ...avatarSx(visible.length, visible.length + 1),
            fontSize: "0.65rem",
            fontWeight: 600,
            bgcolor: "action.hover",
            color: "text.secondary",
          }}
        >
          +{overflow}
        </Avatar>
      )}
    </Box>
  );
}
