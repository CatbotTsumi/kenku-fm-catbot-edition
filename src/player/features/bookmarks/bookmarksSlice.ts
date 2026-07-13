import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { BookmarksCollection, BookmarksState } from "../../../types/bookmark";

const initialState: BookmarksState = {
  bookmarks: {
    byId: {},
    allIds: [],
  },
};

export const bookmarksSlice = createSlice({
  name: "bookmarks",
  initialState,
  reducers: {
    setBookmarks: (state, action: PayloadAction<BookmarksCollection>) => {
      state.bookmarks = action.payload;
    },
  },
});

export const { setBookmarks } = bookmarksSlice.actions;

export default bookmarksSlice.reducer;
