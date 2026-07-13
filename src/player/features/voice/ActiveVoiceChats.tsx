import React, { useMemo } from "react";
import { useSelector } from "react-redux";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import VolumeIcon from "@mui/icons-material/VolumeUpRounded";

import { RootState } from "../../app/store";
import { Guild, VoiceChannel } from "../../../types/discord";
import { VoiceChannelAvatarStack } from "./VoiceChannelAvatarStack";

type OccupiedChannel = {
  channel: VoiceChannel;
  guild: Guild;
};

function getOccupiedChannels(guilds: Guild[]): OccupiedChannel[] {
  const occupied: OccupiedChannel[] = [];
  for (const guild of guilds) {
    for (const channel of guild.voiceChannels) {
      if ((channel.members?.length ?? 0) > 0) {
        occupied.push({ channel, guild });
      }
    }
  }
  return occupied;
}

export function ActiveVoiceChats() {
  const voice = useSelector((state: RootState) => state.voice);

  const occupiedChannels = useMemo(
    () => getOccupiedChannels(voice.guilds),
    [voice.guilds],
  );

  if (voice.connectionStatus !== "ready" || occupiedChannels.length === 0) {
    return null;
  }

  function handleJoin(channelId: string) {
    window.player.joinChannel(channelId);
  }

  return (
    <Box>
      <Typography variant="h5" component="div" sx={{ mb: 1 }}>
        In Voice
      </Typography>
      <Stack
        direction="row"
        gap={1.5}
        sx={{
          overflowX: "auto",
          pb: 0.5,
          "&::-webkit-scrollbar": { height: 6 },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "action.hover",
            borderRadius: 3,
          },
        }}
      >
        {occupiedChannels.map(({ channel, guild }) => {
          const selected = voice.outputs.includes(channel.id);
          const members = channel.members ?? [];

          return (
            <Card
              key={channel.id}
              sx={{
                minWidth: 200,
                maxWidth: 240,
                flexShrink: 0,
                border: selected ? 2 : 0,
                borderColor: "primary.main",
              }}
            >
              <CardActionArea onClick={() => handleJoin(channel.id)}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Stack gap={0.75}>
                    <Stack direction="row" alignItems="center" gap={0.75}>
                      <VolumeIcon
                        fontSize="small"
                        color={selected ? "primary" : "inherit"}
                      />
                      <Typography variant="subtitle1" noWrap>
                        {channel.name}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {guild.name}
                    </Typography>
                    <VoiceChannelAvatarStack
                      members={members}
                      selected={selected}
                    />
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
