import React, { useEffect, useState } from "react";
import IconButton from "@mui/material/IconButton";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";

export function UpdateButton() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    window.kenku.on("UPDATE_AVAILABLE", () => {
      setAvailable(true);
    });

    window.kenku.on("UPDATE_OFFICIAL_CLEAR", () => {
      setAvailable(false);
    });

    window.kenku.checkForUpdate().then((result) => {
      if (result.available) {
        setAvailable(true);
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

  return (
    <IconButton
      onClick={() => window.kenku.openReleasePage()}
      color="success"
      aria-label="Update available — open official Kenku FM release"
    >
      <SystemUpdateAltIcon />
    </IconButton>
  );
}
