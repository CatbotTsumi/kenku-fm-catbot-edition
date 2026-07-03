import { BrowserWindow, ipcMain, shell, WebContentsView } from "electron";
import { getBrowserPartition } from "../browserProfile";
import { getUserAgent } from "../userAgent";

const browserPartition = getBrowserPartition();

export type ViewLifecycleCallbacks = {
  onViewAdded?: (
    id: number,
    view: WebContentsView,
    preload?: string,
  ) => void;
  onViewRemoved?: (id: number) => void;
};

/**
 * Manager to help create and manager browser views
 * This class is to be run on the main thread
 * For the render thread counterpart see `BrowserViewManagerPreload.ts`
 */
export class BrowserViewManagerMain {
  window: BrowserWindow;
  views: Record<number, WebContentsView>;
  topView: WebContentsView;
  private viewLifecycleCallbacks?: ViewLifecycleCallbacks;

  constructor(window: BrowserWindow) {
    this.window = window;
    this.views = {};

    ipcMain.on(
      "BROWSER_VIEW_CREATE_BROWSER_VIEW",
      this._handleCreateBrowserView
    );
    ipcMain.on(
      "BROWSER_VIEW_REMOVE_BROWSER_VIEW",
      this._handleRemoveBrowserView
    );
    ipcMain.on(
      "BROWSER_VIEW_REMOVE_ALL_BROWSER_VIEWS",
      this._handleRemoveAllBrowserViews
    );
    ipcMain.on("BROWSER_VIEW_HIDE_BROWSER_VIEW", this._handleHideBrowserView);
    ipcMain.on("BROWSER_VIEW_SHOW_BROWSER_VIEW", this._handleShowBrowserView);
    ipcMain.on(
      "BROWSER_VIEW_SET_BROWSER_VIEW_BOUNDS",
      this._handleSetBrowserViewBounds
    );
    ipcMain.on("BROWSER_VIEW_LOAD_URL", this._handleLoadURL);
    ipcMain.on("BROWSER_VIEW_GO_FORWARD", this._handleGoForward);
    ipcMain.on("BROWSER_VIEW_GO_BACK", this._handleGoBack);
    ipcMain.on("BROWSER_VIEW_RELOAD", this._handleReload);
    ipcMain.on("BROWSER_VIEW_ZOOM_IN", this._handleZoomIn);
    ipcMain.on("BROWSER_VIEW_ZOOM_OUT", this._handleZoomOut);
    ipcMain.on("BROWSER_VIEW_RESET_ZOOM", this._handleResetZoom);

    this.window.on("resize", this._resizeListener);
  }

  setViewLifecycleCallbacks(callbacks: ViewLifecycleCallbacks | undefined) {
    this.viewLifecycleCallbacks = callbacks;
  }

  destroy() {
    ipcMain.off(
      "BROWSER_VIEW_CREATE_BROWSER_VIEW",
      this._handleCreateBrowserView
    );
    ipcMain.off(
      "BROWSER_VIEW_REMOVE_BROWSER_VIEW",
      this._handleRemoveBrowserView
    );
    ipcMain.off(
      "BROWSER_VIEW_REMOVE_ALL_BROWSER_VIEWS",
      this._handleRemoveAllBrowserViews
    );
    ipcMain.off("BROWSER_VIEW_HIDE_BROWSER_VIEW", this._handleHideBrowserView);
    ipcMain.off("BROWSER_VIEW_SHOW_BROWSER_VIEW", this._handleShowBrowserView);
    ipcMain.off(
      "BROWSER_VIEW_SET_BROWSER_VIEW_BOUNDS",
      this._handleSetBrowserViewBounds
    );
    ipcMain.off("BROWSER_VIEW_LOAD_URL", this._handleLoadURL);
    ipcMain.off("BROWSER_VIEW_GO_FORWARD", this._handleGoForward);
    ipcMain.off("BROWSER_VIEW_GO_BACK", this._handleGoBack);
    ipcMain.off("BROWSER_VIEW_RELOAD", this._handleReload);
    ipcMain.off("BROWSER_VIEW_ZOOM_IN", this._handleZoomIn);
    ipcMain.off("BROWSER_VIEW_ZOOM_OUT", this._handleZoomOut);
    ipcMain.off("BROWSER_VIEW_RESET_ZOOM", this._handleResetZoom);

    this.window.off("resize", this._resizeListener);
    this.removeAllBrowserViews();
  }

  _resizeListener = () => {
    if (!this.window || !this.topView) {
      return;
    }
    const bounds = this.window.getBounds();
    const viewBounds = this.topView.getBounds();

    this.topView.setBounds({
      x: viewBounds.x,
      y: viewBounds.y,
      width: bounds.width - viewBounds.x,
      height: bounds.height - viewBounds.y,
    });
  };

  _handleCreateBrowserView = (
    event: Electron.IpcMainEvent,
    url: string,
    x: number,
    y: number,
    width: number,
    height: number,
    preload?: string
  ) => {
    const id = this.createBrowserView(url, x, y, width, height, preload);
    this.views[id].webContents.on(
      "did-start-navigation",
      (_, url, __, isMainFrame) => {
        if (isMainFrame) {
          event.reply("BROWSER_VIEW_DID_NAVIGATE", id, url);
        }
      }
    );
    this.views[id].webContents.on("page-title-updated", (_, title) => {
      event.reply("BROWSER_VIEW_TITLE_UPDATED", id, title);
    });
    this.views[id].webContents.on("page-favicon-updated", (_, favicons) => {
      event.reply("BROWSER_VIEW_FAVICON_UPDATED", id, favicons);
    });
    this.views[id].webContents.on("media-started-playing", () => {
      event.reply("BROWSER_VIEW_MEDIA_STARTED_PLAYING", id);
    });
    this.views[id].webContents.on("media-paused", () => {
      event.reply("BROWSER_VIEW_MEDIA_PAUSED", id);
    });
    this.views[id].webContents.setWindowOpenHandler(({ url }) => {
      event.reply("BROWSER_VIEW_NEW_TAB", url);
      return { action: "deny" };
    });

    let loaded = false;
    this.views[id].webContents.on("did-finish-load", () => {
      if (!loaded) {
        event.reply("BROWSER_VIEW_LOADED", id);
        loaded = true;
      }
    });
    event.returnValue = id;
  };

  _handleRemoveBrowserView = (_: Electron.IpcMainEvent, id: number) =>
    this.removeBrowserView(id);

  _handleRemoveAllBrowserViews = () => this.removeAllBrowserViews();

  _handleHideBrowserView = (_: Electron.IpcMainEvent, id: number) =>
    this.hideBrowserView(id);

  _handleShowBrowserView = (_: Electron.IpcMainEvent, id: number) =>
    this.showBrowserView(id);

  _handleSetBrowserViewBounds = (
    _: Electron.IpcMainEvent,
    id: number,
    x: number,
    y: number,
    width: number,
    height: number
  ) => this.setBrowserViewBounds(id, x, y, width, height);

  _handleLoadURL = (_: Electron.IpcMainEvent, id: number, url: string) =>
    this.loadURL(id, url);

  _handleGoForward = (_: Electron.IpcMainEvent, id: number) =>
    this.goForward(id);

  _handleGoBack = (_: Electron.IpcMainEvent, id: number) => this.goBack(id);

  _handleReload = (_: Electron.IpcMainEvent, id: number) => this.reload(id);

  _handleZoomIn = (_: Electron.IpcMainEvent, id: number) => this.zoomIn(id);

  _handleZoomOut = (_: Electron.IpcMainEvent, id: number) => this.zoomOut(id);

  _handleResetZoom = (_: Electron.IpcMainEvent, id: number) =>
    this.resetZoom(id);

  /**
   * Create a new browser view and attach it to the current window
   * @param url Initial URL
   * @param xOffset Offset from the left side of the screen
   * @returns id of the created window
   */
  createBrowserView(
    url: string,
    x: number,
    y: number,
    width: number,
    height: number,
    preload?: string
  ): number {
    const view = new WebContentsView({
      webPreferences: {
        preload,
        ...(browserPartition ? { partition: browserPartition } : {}),
      },
    });
    this.window.contentView.addChildView(view);

    view.setBounds({
      x,
      y,
      width,
      height,
    });

    try {
      view.webContents.loadURL(url);
    } catch (err) {
      console.error(err);
    }

    // Spoof user agent to fix compatibility issues with 3rd party apps
    view.webContents.setUserAgent(getUserAgent());

    this._attachZoomShortcuts(view);

    this.views[view.webContents.id] = view;
    this.topView = view;

    this.viewLifecycleCallbacks?.onViewAdded?.(
      view.webContents.id,
      view,
      preload,
    );

    return view.webContents.id;
  }

  removeBrowserView(id: number) {
    if (this.views[id]) {
      if (this.topView === this.views[id]) {
        this.topView = undefined;
      }
      this.views[id].webContents.close({ waitForBeforeUnload: false });
      this.window.contentView.removeChildView(this.views[id]);
      (this.views[id].webContents as any).destroy();
      delete this.views[id];
      this.viewLifecycleCallbacks?.onViewRemoved?.(id);
    }
  }

  removeAllBrowserViews() {
    for (let id in this.views) {
      const viewId = Number(id);
      this.views[viewId].webContents.close({ waitForBeforeUnload: false });
      this.window.contentView.removeChildView(this.views[viewId]);
      (this.views[viewId].webContents as any).destroy();
      this.viewLifecycleCallbacks?.onViewRemoved?.(viewId);
      this.topView = undefined;
      delete this.views[viewId];
    }
  }

  hideBrowserView(id: number) {
    if (this.views[id]) {
      if (this.topView === this.views[id]) {
        this.topView = undefined;
      }
      this.window.contentView.removeChildView(this.views[id]);
    }
  }

  showBrowserView(id: number) {
    if (this.views[id]) {
      this.window.contentView.addChildView(this.views[id]);
      this.topView = this.views[id];
    }
  }

  setBrowserViewBounds(
    id: number,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    try {
      this.views[id].setBounds({ x, y, width, height });
    } catch (err) {
      console.error(err);
    }
  }

  loadURL(id: number, url: string) {
    try {
      this.views[id].webContents.loadURL(url);
    } catch (err) {
      console.error(err);
    }
  }

  goForward(id: number) {
    try {
      this.views[id].webContents.navigationHistory.goForward();
    } catch (err) {
      console.error(err);
    }
  }

  goBack(id: number) {
    try {
      this.views[id].webContents.navigationHistory.goBack();
    } catch (err) {
      console.error(err);
    }
  }

  reload(id: number) {
    try {
      this.views[id].webContents.reload();
    } catch (err) {
      console.error(err);
    }
  }

  zoomIn(id: number) {
    try {
      const webContents = this.views[id].webContents;
      webContents.setZoomLevel(webContents.getZoomLevel() + 1);
    } catch (err) {
      console.error(err);
    }
  }

  zoomOut(id: number) {
    try {
      const webContents = this.views[id].webContents;
      webContents.setZoomLevel(webContents.getZoomLevel() - 1);
    } catch (err) {
      console.error(err);
    }
  }

  resetZoom(id: number) {
    try {
      this.views[id].webContents.setZoomLevel(0);
    } catch (err) {
      console.error(err);
    }
  }

  _attachZoomShortcuts(view: WebContentsView) {
    const id = view.webContents.id;
    view.webContents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") {
        return;
      }
      if (!input.control && !input.meta) {
        return;
      }

      if (
        input.key === "=" ||
        input.key === "+" ||
        input.code === "Equal" ||
        input.code === "NumpadAdd"
      ) {
        event.preventDefault();
        this.zoomIn(id);
      } else if (input.key === "-" || input.code === "Minus" || input.code === "NumpadSubtract") {
        event.preventDefault();
        this.zoomOut(id);
      } else if (input.key === "0" || input.code === "Digit0" || input.code === "Numpad0") {
        event.preventDefault();
        this.resetZoom(id);
      }
    });
  }
}
