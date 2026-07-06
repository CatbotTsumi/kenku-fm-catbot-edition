import React, { useEffect, useState } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";

export function UpdateButton() {
  const [available, setAvailable] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);

  useEffect(() => {
    window.kenku.on("UPDATE_AVAILABLE", (args) => {
      const payload = args[0] as { restartRequired?: boolean } | undefined;
      setAvailable(true);
      setRestartRequired(Boolean(payload?.restartRequired));
    });

    window.kenku.on("UPDATE_OFFICIAL_CLEAR", () => {
      setAvailable(false);
      setRestartRequired(false);
    });

    window.kenku.checkForUpdate().then((result) => {
      if (result.available) {
        setAvailable(true);
        setRestartRequired(Boolean(result.restartRequired));
      }
    });

    return () => {
      window.kenku.removeAllListeners("UPDATE_AVAILABLE");
      window.kenku.removeAllListeners("UPDATE_OFFICIAL_CLEAR");
    };
  }, []);

  if (!available) {
    return null;
  }

  const label = restartRequired
    ? "Update downloaded — restart to apply"
    : "Upstream Kenku FM release available to merge";

  function handleClick() {
    if (restartRequired) {
      window.kenku.quitAndInstallUpdate();
    } else {
      window.kenku.openReleasePage();
    }
  }

  return (
    <Tooltip title={label}>
      <IconButton
        onClick={handleClick}
        color="success"
        aria-label={label}
      >
        <SystemUpdateAltIcon />
      </IconButton>
    </Tooltip>
  );
}
