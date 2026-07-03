/**
 * YouTube Music metadata extraction for Tuna OBS integration.
 * Selectors adapted from Tuna's browser userscript:
 * https://github.com/univrsal/tuna/blob/master/deps/tuna_browser.user.js
 */

export interface TunaTrackData {
  cover?: string;
  title?: string;
  artists?: string[];
  status?: string;
  progress?: number;
  duration?: number;
  album_url?: string;
  album?: string;
}

export interface TunaPayload {
  data: TunaTrackData;
  hostname: string;
  date: number;
}

/** Self-contained script run inside a browser tab via executeJavaScript. */
export const YOUTUBE_MUSIC_METADATA_SCRIPT = `(function() {
  function query(target, fun, alt) {
    var element = document.querySelector(target);
    if (element !== null) {
      return fun(element);
    }
    return alt;
  }

  function timestampToMs(ts) {
    var splits = ts.split(":");
    if (splits.length === 2) {
      return splits[0] * 60 * 1000 + splits[1] * 1000;
    } else if (splits.length === 3) {
      return splits[0] * 60 * 60 * 1000 + splits[1] * 60 * 1000 + splits[2] * 1000;
    }
    return 0;
  }

  if (window.location.hostname !== "music.youtube.com") {
    return null;
  }

  if (!navigator.mediaSession || !navigator.mediaSession.metadata) {
    return null;
  }

  var artistsSelectors = [
    '.ytmusic-player-bar.byline [href*="channel/"]:not([href*="channel/MPREb_"]):not([href*="browse/MPREb_"])',
    '.ytmusic-player-bar.byline .yt-formatted-string:nth-child(2n+1):not([href*="browse/"]):not([href*="channel/"]):not(:nth-last-child(1)):not(:nth-last-child(3))',
    '.ytmusic-player-bar.byline [href*="browse/FEmusic_library_privately_owned_artist_detaila_"]',
  ];
  var albumSelectors = [
    '.ytmusic-player-bar [href*="browse/MPREb_"]',
    '.ytmusic-player-bar [href*="browse/FEmusic_library_privately_owned_release_detailb_"]',
  ];

  var time = query(".ytmusic-player-bar.time-info", function(e) {
    return e.innerText.split(" / ");
  });

  var playbackState = navigator.mediaSession.playbackState;
  var status = playbackState === "playing" ? "playing" : "stopped";

  var title = query(".ytmusic-player-bar.title", function(e) {
    return e.title;
  });

  var artists = Array.from(document.querySelectorAll(artistsSelectors)).map(function(x) {
    return x.innerText;
  });

  var album = query(albumSelectors.join(","), function(e) {
    return e.textContent;
  });

  var artwork = navigator.mediaSession.metadata.artwork;
  var cover = artwork && artwork.length > 0 ? artwork[artwork.length - 1].src : "";

  var albumUrl = query(albumSelectors.join(","), function(e) {
    return e.href;
  });

  var progress = time && time[0] ? timestampToMs(time[0]) : 0;
  var duration = time && time[1] ? timestampToMs(time[1]) : 0;

  if (title === null || title === undefined) {
    return null;
  }

  return {
    cover: cover,
    title: title,
    artists: artists,
    status: status,
    progress: progress,
    duration: duration,
    album_url: albumUrl || undefined,
    album: album || undefined,
  };
})()`;
