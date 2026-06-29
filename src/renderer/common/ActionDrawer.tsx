import React, { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import SettingsIcon from "@mui/icons-material/SettingsRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { Toolbar, Stack, Typography, Link } from "@mui/material";
import { OutputListItems } from "../features/output/OutputListItems";
import { InputListItems } from "../features/input/InputListItems";
import { BookmarkListItems } from "../features/bookmarks/BookmarkListItems";
import { Settings } from "../features/settings/Settings";

import { RootState } from "../app/store";
import { useDispatch, useSelector } from "react-redux";
import { setSidebarCollapsed } from "../features/settings/settingsSlice";

import { AppLogo } from "./AppLogo";
import { UpdateButton } from "./UpdateButton";
import { useHideScrollbar } from "./useHideScrollbar";
import { showWindowControls } from "./showWindowControls";

export const drawerWidth = 240;

export function getDrawerWidth(collapsed: boolean): number {
  return collapsed ? 0 : drawerWidth;
}

export function ActionDrawer() {
  const dispatch = useDispatch();
  const settings = useSelector((state: RootState) => state.settings);
  const connection = useSelector((state: RootState) => state.connection);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [visibilityEditMode, setVisibilityEditMode] = useState(false);

  const discordReady = connection.status === "ready";

  const collapsed = showWindowControls && settings.sidebarCollapsed;
  const width = getDrawerWidth(collapsed);

  const scrollRef = useRef<HTMLDivElement>(null);
  const hideScrollbar = useHideScrollbar(scrollRef);

  return (
    <Box
      component="nav"
      sx={{
        width,
        flexShrink: 0,
        overflow: "hidden",
        transition: (theme) =>
          theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
      }}
    >
      <Drawer
        variant="permanent"
        sx={{
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width,
            border: "none",
            bgcolor: "background.default",
            overflowY: "initial",
            overflowX: "hidden",
            transition: (theme) =>
              theme.transitions.create("width", {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
          },
        }}
        open
      >
        <Toolbar
          sx={{
            justifyContent: showWindowControls ? "space-between" : "end",
            bgcolor: "background.paper",
            px: 1,
            WebkitAppRegion: "drag",
            minHeight: "52px",
          }}
          disableGutters
          variant="dense"
          onDoubleClick={(e) =>
            e.target === e.currentTarget && window.kenku.toggleMaximize()
          }
        >
          {showWindowControls && (
            <IconButton
              onClick={() => dispatch(setSidebarCollapsed(true))}
              sx={{ WebkitAppRegion: "no-drag", m: 0.5, p: 0.5 }}
            >
              <Box sx={{ width: "36px", height: "36px" }}>
                <AppLogo />
              </Box>
            </IconButton>
          )}
          <Stack direction="row" sx={{ WebkitAppRegion: "no-drag" }}>
            {discordReady && (
              <IconButton
                onClick={() => setVisibilityEditMode((v) => !v)}
                color={visibilityEditMode ? "primary" : "default"}
                aria-label="Edit output visibility"
              >
                <VisibilityOutlinedIcon />
              </IconButton>
            )}
            <UpdateButton />
            <IconButton
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
            >
              <SettingsIcon />
            </IconButton>
          </Stack>
          <Settings
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
          />
        </Toolbar>
        <Box sx={{ overflowY: "auto" }} ref={scrollRef} {...hideScrollbar}>
          <Stack>
            <BookmarkListItems />
            {settings.externalInputsEnabled && <InputListItems />}
            <OutputListItems
              visibilityEditMode={visibilityEditMode}
              onVisibilityEditModeChange={setVisibilityEditMode}
            />
            {connection.status === "disconnected" && (
              <Typography variant="caption" align="center" marginY={2}>
                Connect{" "}
                <Link
                  component="button"
                  variant="caption"
                  onClick={() => setSettingsOpen(true)}
                >
                  Discord
                </Link>{" "}
                for more outputs
              </Typography>
            )}
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}
