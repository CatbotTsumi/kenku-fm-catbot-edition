import React, { useState } from "react";

import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";

import { SortableDragHandle } from "../../common/SortableItem";
import { drawerWidth } from "../../common/ActionDrawer";
import { showWindowControls } from "../../common/showWindowControls";
import { Guild } from "./outputSlice";

type OutputGuildRowProps = {
  guild: Guild;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  onLeave: () => void;
};

export function OutputGuildRow({
  guild,
  visible,
  onVisibilityChange,
  onLeave,
}: OutputGuildRowProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleLeaveClick() {
    setConfirmOpen(true);
  }

  function handleConfirmClose() {
    setConfirmOpen(false);
  }

  function handleConfirmLeave() {
    setConfirmOpen(false);
    onLeave();
  }

  return (
    <>
      <ListItem
        alignItems="center"
        dense
        secondaryAction={
          <Button
            size="small"
            color="error"
            onClick={handleLeaveClick}
            sx={{ minWidth: 0, px: 1, fontSize: "0.7rem" }}
          >
            Leave
          </Button>
        }
        sx={{ pr: "52px", pl: 0.5 }}
      >
        <SortableDragHandle />
        <Checkbox
          size="small"
          checked={visible}
          onChange={(_, checked) => onVisibilityChange(checked)}
          sx={{ p: 0.5, mr: 0.5 }}
        />
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
      </ListItem>
      <Dialog
        fullScreen
        sx={{ width: drawerWidth }}
        open={confirmOpen}
        onClose={handleConfirmClose}
        onKeyDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogTitle
          sx={{
            textAlign: showWindowControls ? "left" : "right",
            py: showWindowControls ? 2 : 1.5,
          }}
        >
          Leave server?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            The bot will leave &quot;{guild.name}&quot;. It must be re-invited
            to return.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleConfirmClose}>Cancel</Button>
          <Button onClick={handleConfirmLeave} color="error" autoFocus>
            Leave
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
