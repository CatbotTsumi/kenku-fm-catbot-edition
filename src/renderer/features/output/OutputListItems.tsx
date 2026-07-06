import React, { useState, useEffect, useMemo } from "react";

import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";

import ExpandLess from "@mui/icons-material/ExpandLessRounded";
import ExpandMore from "@mui/icons-material/ExpandMoreRounded";
import SearchIcon from "@mui/icons-material/SearchRounded";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { RootState } from "../../app/store";
import { useSelector, useDispatch } from "react-redux";
import { addOutput, removeOutput, setGuilds, setOutput, Guild, VoiceChannel } from "./outputSlice";
import {
  setGuildHidden,
  setChannelHidden,
  pruneHiddenDiscordIds,
  setOutputsSectionOpen,
  toggleGuildCollapsed,
  moveGuild,
  mergeGuildOrder,
  removeGuildPreferences,
} from "../settings/settingsSlice";

import { OutputListItem } from "./OutputListItem";
import { OutputGuildRow } from "./OutputGuildRow";
import { OutputChannelRow } from "./OutputChannelRow";
import {
  OutputGuildSection,
  OutputGuildSectionOverlay,
} from "./OutputGuildSection";
import { SortableItem } from "../../common/SortableItem";
import { applyGuildOrder, guildMatchesSearch } from "./guildOrder";

type OutputListItemsProps = {
  visibilityEditMode: boolean;
  onVisibilityEditModeChange: (mode: boolean) => void;
};

function matchesSearch(text: string, query: string): boolean {
  return text.toLowerCase().includes(query);
}

function channelHasMembers(channel: VoiceChannel): boolean {
  return (channel.members?.length ?? 0) > 0;
}

function filterGuildsForDisplay(
  guilds: Guild[],
  hiddenGuildIds: string[],
  hiddenChannelIds: string[],
  searchQuery: string,
  editMode: boolean,
  hideEmptyVoiceChannels: boolean,
): Guild[] {
  const query = searchQuery.trim().toLowerCase();

  if (editMode) {
    return guilds
      .map((guild) => {
        const guildMatches = !query || matchesSearch(guild.name, query);
        const channels = guild.voiceChannels.filter(
          (channel) =>
            !query ||
            guildMatches ||
            matchesSearch(channel.name, query),
        );
        if (
          query &&
          !guildMatches &&
          channels.length === 0 &&
          !guild.voiceChannels.some((c) => matchesSearch(c.name, query))
        ) {
          return null;
        }
        return { ...guild, voiceChannels: query ? channels : guild.voiceChannels };
      })
      .filter((guild): guild is Guild => guild !== null);
  }

  return guilds
    .filter((guild) => !hiddenGuildIds.includes(guild.id))
    .map((guild) => {
      let channels = guild.voiceChannels.filter(
        (channel) => !hiddenChannelIds.includes(channel.id),
      );
      if (hideEmptyVoiceChannels) {
        channels = channels.filter(channelHasMembers);
      }
      if (query) {
        const guildMatches = matchesSearch(guild.name, query);
        channels = channels.filter(
          (channel) => guildMatches || matchesSearch(channel.name, query),
        );
      }
      return { ...guild, voiceChannels: channels };
    })
    .filter((guild) => {
      if (guild.voiceChannels.length > 0) {
        return true;
      }
      return query.length > 0 && matchesSearch(guild.name, query);
    });
}

export function OutputListItems({
  visibilityEditMode,
  onVisibilityEditModeChange,
}: OutputListItemsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const output = useSelector((state: RootState) => state.output);
  const settings = useSelector((state: RootState) => state.settings);
  const connection = useSelector((state: RootState) => state.connection);
  const dispatch = useDispatch();

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 10 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const orderedGuilds = useMemo(
    () => applyGuildOrder(output.guilds, settings.guildOrder),
    [output.guilds, settings.guildOrder],
  );

  const displayGuilds = useMemo(
    () =>
      filterGuildsForDisplay(
        orderedGuilds,
        settings.hiddenGuildIds,
        settings.hiddenChannelIds,
        searchQuery,
        visibilityEditMode,
        settings.hideEmptyVoiceChannels,
      ),
    [
      orderedGuilds,
      settings.hiddenGuildIds,
      settings.hiddenChannelIds,
      settings.hideEmptyVoiceChannels,
      searchQuery,
      visibilityEditMode,
    ],
  );

  const searchActive = searchQuery.trim().length > 0;

  useEffect(() => {
    if (connection.status !== "ready") {
      onVisibilityEditModeChange(false);
    }
  }, [connection.status, onVisibilityEditModeChange]);

  useEffect(() => {
    window.kenku.on("DISCORD_GUILDS", (args) => {
      const guilds = args[0] as Guild[];
      dispatch(setGuilds(guilds));
      dispatch(mergeGuildOrder(guilds.map((g) => g.id)));
      dispatch(
        pruneHiddenDiscordIds({
          guildIds: guilds.map((g) => g.id),
          channelIds: guilds.flatMap((g) =>
            g.voiceChannels.map((c) => c.id),
          ),
        }),
      );
    });

    window.kenku.on("DISCORD_CHANNEL_LEFT", (args) => {
      const id = args[0];
      dispatch(removeOutput(id));
    });

    window.kenku.on("DISCORD_CHANNEL_JOINED", (args) => {
      dispatch(addOutput(args[0]));
    });

    return () => {
      window.kenku.removeAllListeners("DISCORD_GUILDS");
      window.kenku.removeAllListeners("DISCORD_CHANNEL_LEFT");
      window.kenku.removeAllListeners("DISCORD_CHANNEL_JOINED");
    };
  }, [dispatch]);

  useEffect(() => {
    if (output.guilds.length > 0) {
      dispatch(mergeGuildOrder(output.guilds.map((g) => g.id)));
    }
  }, [output.guilds, dispatch]);

  function toggleOpen() {
    dispatch(setOutputsSectionOpen(!settings.outputsSectionOpen));
  }

  function handleDragStart(event: DragStartEvent) {
    setDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      dispatch(
        moveGuild({ active: String(active.id), over: String(over.id) }),
      );
    }
    setDragId(null);
  }

  function isGuildCollapsed(guild: Guild): boolean {
    if (searchActive && guildMatchesSearch(guild, searchQuery.trim().toLowerCase())) {
      return false;
    }
    return settings.collapsedGuildIds.includes(guild.id);
  }

  function handleToggleGuildCollapsed(guildId: string) {
    const collapsed = settings.collapsedGuildIds.includes(guildId);
    dispatch(toggleGuildCollapsed({ guildId, collapsed: !collapsed }));
  }

  function handleChannelChange(channelId: string) {
    if (settings.multipleOutputsEnabled) {
      if (output.outputs.includes(channelId)) {
        dispatch(removeOutput(channelId));
        if (channelId === "local") {
          window.kenku.setLoopback(false);
        } else {
          window.kenku.leaveChannel(channelId);
        }
      } else {
        dispatch(addOutput(channelId));
        if (channelId === "local") {
          window.kenku.setLoopback(true);
        } else {
          const channelsToGuild: Record<string, string> = {};
          for (const guild of output.guilds) {
            for (const channel of guild.voiceChannels) {
              channelsToGuild[channel.id] = guild.id;
            }
          }
          const currentGuild = channelsToGuild[channelId];
          let guildChannel: string | undefined;
          for (const id of output.outputs) {
            const guild = channelsToGuild[id];
            if (guild === currentGuild) {
              guildChannel = id;
            }
          }
          if (guildChannel) {
            dispatch(removeOutput(guildChannel));
            window.kenku.leaveChannel(guildChannel);
          }

          window.kenku.joinChannel(channelId);
        }
      }
    } else {
      const prev = output.outputs[0];

      if (prev === channelId) {
        return;
      }

      if (prev) {
        if (prev === "local") {
          window.kenku.setLoopback(false);
        } else {
          window.kenku.leaveChannel(prev);
        }
      }
      dispatch(setOutput(channelId));
      if (channelId === "local") {
        window.kenku.setLoopback(true);
      } else {
        window.kenku.joinChannel(channelId);
      }
    }
  }

  function handleLeaveGuild(guild: Guild) {
    for (const channel of guild.voiceChannels) {
      if (output.outputs.includes(channel.id)) {
        dispatch(removeOutput(channel.id));
      }
    }
    dispatch(setGuildHidden({ guildId: guild.id, hidden: false }));
    dispatch(removeGuildPreferences(guild.id));
    window.kenku.leaveGuild(guild.id);
  }

  const showSearch = output.guilds.length > 0;
  const dragGuild = dragId
    ? displayGuilds.find((g) => g.id === dragId) ??
      orderedGuilds.find((g) => g.id === dragId)
    : undefined;

  return (
    <>
      <ListItemButton onClick={toggleOpen}>
        <ListItemText
          primary={settings.multipleOutputsEnabled ? "Outputs" : "Output"}
        />
        {settings.outputsSectionOpen ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>
      <Collapse in={settings.outputsSectionOpen} timeout="auto" unmountOnExit>
        {showSearch && (
          <Box sx={{ px: 1, pb: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search servers & channels"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: "1rem" }} />
                  </InputAdornment>
                ),
              }}
              inputProps={{ sx: { fontSize: "0.8rem", py: 0.75 } }}
            />
          </Box>
        )}
        <List component="div" disablePadding>
          {!visibilityEditMode && (
            <>
              <OutputListItem
                voiceChannel={{ id: "local", name: "This Computer" }}
                selected={output.outputs.includes("local")}
                tick={
                  settings.multipleOutputsEnabled &&
                  output.outputs.includes("local")
                }
                onClick={handleChannelChange}
              />
              <Divider variant="middle" />
            </>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayGuilds.map((g) => g.id)}
              strategy={verticalListSortingStrategy}
            >
              {visibilityEditMode
                ? displayGuilds.map((guild) => (
                    <SortableItem key={guild.id} id={guild.id} dragHandle>
                      <List sx={{ py: 0 }}>
                        <OutputGuildRow
                          guild={guild}
                          visible={!settings.hiddenGuildIds.includes(guild.id)}
                          onVisibilityChange={(visible) =>
                            dispatch(
                              setGuildHidden({
                                guildId: guild.id,
                                hidden: !visible,
                              }),
                            )
                          }
                          onLeave={() => handleLeaveGuild(guild)}
                        />
                        {guild.voiceChannels.map((channel) => (
                          <OutputChannelRow
                            key={channel.id}
                            voiceChannel={channel}
                            visible={
                              !settings.hiddenChannelIds.includes(channel.id)
                            }
                            onVisibilityChange={(visible) =>
                              dispatch(
                                setChannelHidden({
                                  channelId: channel.id,
                                  hidden: !visible,
                                }),
                              )
                            }
                          />
                        ))}
                      </List>
                    </SortableItem>
                  ))
                : displayGuilds.map((guild) => (
                    <SortableItem key={guild.id} id={guild.id} dragHandle>
                      <OutputGuildSection
                        guild={guild}
                        collapsed={isGuildCollapsed(guild)}
                        onToggleCollapsed={() =>
                          handleToggleGuildCollapsed(guild.id)
                        }
                        selectedChannelIds={output.outputs}
                        multipleOutputsEnabled={
                          settings.multipleOutputsEnabled
                        }
                        onChannelClick={handleChannelChange}
                      />
                    </SortableItem>
                  ))}
            </SortableContext>
            <DragOverlay>
              {dragGuild ? (
                <OutputGuildSectionOverlay guild={dragGuild} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </List>
      </Collapse>
    </>
  );
}
