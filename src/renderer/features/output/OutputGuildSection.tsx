import React from "react";

import Avatar from "@mui/material/Avatar";
import Collapse from "@mui/material/Collapse";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";

import ExpandLess from "@mui/icons-material/ExpandLessRounded";
import ExpandMore from "@mui/icons-material/ExpandMoreRounded";

import { SortableDragHandle } from "../../common/SortableItem";
import { Guild } from "./outputSlice";
import { OutputListItem } from "./OutputListItem";

type OutputGuildSectionProps = {
  guild: Guild;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  selectedChannelIds: string[];
  multipleOutputsEnabled: boolean;
  onChannelClick: (channelId: string) => void;
};

export function OutputGuildSection({
  guild,
  collapsed,
  onToggleCollapsed,
  selectedChannelIds,
  multipleOutputsEnabled,
  onChannelClick,
}: OutputGuildSectionProps) {
  return (
    <List sx={{ py: 0 }}>
      <ListItemButton
        dense
        onClick={onToggleCollapsed}
        sx={{ py: 0.5, pl: 0.5 }}
      >
        <SortableDragHandle />
        <ListItemAvatar sx={{ minWidth: "28px", marginTop: 0 }}>
          <Avatar
            sx={{ width: "20px", height: "20px" }}
            alt={guild.name}
            src={guild.icon}
          />
        </ListItemAvatar>
        <ListItemText
          primary={guild.name}
          primaryTypographyProps={{
            noWrap: true,
            sx: { fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.7)" },
          }}
        />
        {collapsed ? (
          <ExpandMore sx={{ fontSize: "1.1rem", opacity: 0.7 }} />
        ) : (
          <ExpandLess sx={{ fontSize: "1.1rem", opacity: 0.7 }} />
        )}
      </ListItemButton>
      <Collapse in={!collapsed} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {guild.voiceChannels.map((channel) => (
            <OutputListItem
              key={channel.id}
              voiceChannel={channel}
              selected={selectedChannelIds.includes(channel.id)}
              tick={
                multipleOutputsEnabled &&
                selectedChannelIds.includes(channel.id)
              }
              onClick={onChannelClick}
            />
          ))}
        </List>
      </Collapse>
    </List>
  );
}

type OutputGuildSectionOverlayProps = {
  guild: Guild;
};

export function OutputGuildSectionOverlay({
  guild,
}: OutputGuildSectionOverlayProps) {
  return (
    <ListItemButton dense sx={{ py: 0.5, pl: 0.5, bgcolor: "background.paper" }}>
      <ListItemAvatar sx={{ minWidth: "28px", marginTop: 0 }}>
        <Avatar
          sx={{ width: "20px", height: "20px" }}
          alt={guild.name}
          src={guild.icon}
        />
      </ListItemAvatar>
      <ListItemText
        primary={guild.name}
        primaryTypographyProps={{
          noWrap: true,
          sx: { fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.7)" },
        }}
      />
    </ListItemButton>
  );
}
