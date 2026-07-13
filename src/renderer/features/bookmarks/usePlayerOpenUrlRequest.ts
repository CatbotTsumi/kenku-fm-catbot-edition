import { useEffect } from "react";
import { useDispatch } from "react-redux";

import { addTab, selectTab } from "../tabs/tabsSlice";
import { getBounds } from "../tabs/getBounds";

type OpenUrlPayload = {
  url: string;
  title: string;
  icon: string;
};

export function usePlayerOpenUrlRequest() {
  const dispatch = useDispatch();

  useEffect(() => {
    window.kenku.on("PLAYER_OPEN_URL_REQUEST", async (args) => {
      const payload = args[0] as OpenUrlPayload;
      const bounds = getBounds();
      const id = await window.kenku.createBrowserView(
        payload.url,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
      );
      dispatch(
        addTab({
          id,
          url: payload.url,
          title: payload.title,
          icon: payload.icon,
          playingMedia: 0,
          muted: false,
        }),
      );
      dispatch(selectTab(id));
    });

    return () => {
      window.kenku.removeAllListeners("PLAYER_OPEN_URL_REQUEST");
    };
  }, [dispatch]);
}
