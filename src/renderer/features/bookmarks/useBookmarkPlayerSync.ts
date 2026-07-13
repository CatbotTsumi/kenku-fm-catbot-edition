import { useEffect } from "react";
import { useSelector } from "react-redux";

import { RootState } from "../../app/store";

export function useBookmarkPlayerSync() {
  const bookmarks = useSelector((state: RootState) => state.bookmarks.bookmarks);

  useEffect(() => {
    window.kenku.syncBookmarksToPlayer(bookmarks);
  }, [bookmarks]);
}
