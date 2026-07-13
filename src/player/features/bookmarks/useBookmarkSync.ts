import { useEffect } from "react";
import { useDispatch } from "react-redux";

import { BookmarksCollection } from "../../../types/bookmark";
import { setBookmarks } from "./bookmarksSlice";

export function useBookmarkSync() {
  const dispatch = useDispatch();

  useEffect(() => {
    window.player.on("PLAYER_BOOKMARKS_SYNC", (args) => {
      const bookmarks = args[0] as BookmarksCollection;
      dispatch(setBookmarks(bookmarks));
    });

    return () => {
      window.player.removeAllListeners("PLAYER_BOOKMARKS_SYNC");
    };
  }, [dispatch]);
}
