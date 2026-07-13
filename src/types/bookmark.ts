export interface Bookmark {
  url: string;
  icon: string;
  title: string;
  id: string;
}

export interface BookmarksCollection {
  byId: Record<string, Bookmark>;
  allIds: string[];
}

export interface BookmarksState {
  bookmarks: BookmarksCollection;
}
