import React from "react";
import { useSelector } from "react-redux";

import { RootState } from "../app/store";
import { APP_DISPLAY_NAME } from "../../constants/appName";
import icon from "../../assets/icon.svg";

export function AppLogo() {
  const connection = useSelector((state: RootState) => state.connection);
  const showBotAvatar =
    connection.status === "ready" && connection.botAvatarUrl;
  const src = showBotAvatar ? connection.botAvatarUrl : icon;
  const alt = showBotAvatar && connection.botName ? connection.botName : APP_DISPLAY_NAME;

  return (
    <img
      src={src}
      width="36"
      height="36"
      alt={alt}
      style={{ borderRadius: showBotAvatar ? "50%" : undefined }}
    />
  );
}
