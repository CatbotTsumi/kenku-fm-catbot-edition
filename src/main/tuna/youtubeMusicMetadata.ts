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
  song_url?: string;
  artist_url?: string;
  artist_image?: string;
  artist_channel_id?: string;
}

export function trackDataKey(data: TunaTrackData): string {
  return JSON.stringify({
    title: data.title,
    artists: data.artists,
    status: data.status,
    cover: data.cover,
    album: data.album,
    album_url: data.album_url,
    song_url: data.song_url,
    artist_url: data.artist_url,
    artist_image: data.artist_image,
    artist_channel_id: data.artist_channel_id,
  });
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

  function videoIdFromString(str) {
    if (!str) {
      return undefined;
    }
    var match = str.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : undefined;
  }

  function songUrlFromVideoId(videoId) {
    if (!videoId) {
      return undefined;
    }
    return "https://music.youtube.com/watch?v=" + videoId;
  }

  function songUrlFromHref(href) {
    if (!href) {
      return undefined;
    }
    var videoId = videoIdFromString(href);
    if (videoId) {
      return songUrlFromVideoId(videoId);
    }
    try {
      var u = new URL(href, window.location.origin);
      videoId = u.searchParams.get("v");
      if (videoId) {
        return songUrlFromVideoId(videoId);
      }
    } catch (e) {}
    return undefined;
  }

  function findVideoIdFromPlayerApi() {
    var moviePlayer = document.getElementById("movie_player");
    if (moviePlayer) {
      try {
        if (typeof moviePlayer.getVideoData === "function") {
          var data = moviePlayer.getVideoData();
          if (data && data.video_id) {
            return data.video_id;
          }
        }
      } catch (e) {}

      try {
        if (typeof moviePlayer.getPlayerResponse === "function") {
          var response = moviePlayer.getPlayerResponse();
          if (
            response &&
            response.videoDetails &&
            response.videoDetails.videoId
          ) {
            return response.videoDetails.videoId;
          }
        }
      } catch (e) {}

      try {
        if (typeof moviePlayer.getVideoUrl === "function") {
          var videoId = videoIdFromString(moviePlayer.getVideoUrl());
          if (videoId) {
            return videoId;
          }
        }
      } catch (e) {}
    }

    return undefined;
  }

  function queryAllDeep(root, selector) {
    var results = [];
    if (!root || !root.querySelectorAll) {
      return results;
    }

    root.querySelectorAll(selector).forEach(function(el) {
      results.push(el);
    });

    root.querySelectorAll("*").forEach(function(el) {
      if (el.shadowRoot) {
        results = results.concat(queryAllDeep(el.shadowRoot, selector));
      }
    });

    return results;
  }

  function findSongUrl(cover) {
    var fromPlayer = songUrlFromVideoId(findVideoIdFromPlayerApi());
    if (fromPlayer) {
      return fromPlayer;
    }

    var watchLinks = queryAllDeep(
      document,
      'a[href*="/watch"], a[href*="watch?v="]',
    );
    for (var i = 0; i < watchLinks.length; i++) {
      var linkEl = watchLinks[i];
      if (!linkEl.closest("ytmusic-player-bar, .ytmusic-player-bar")) {
        continue;
      }
      var fromLink = songUrlFromHref(
        linkEl.href || linkEl.getAttribute("href"),
      );
      if (fromLink) {
        return fromLink;
      }
    }

    var titleEl = document.querySelector(
      ".ytmusic-player-bar .title, .ytmusic-player-bar-title, a.title.ytmusic-player-bar-title, .ytmusic-player-bar.title",
    );
    if (titleEl) {
      var link = titleEl.href ? titleEl : titleEl.closest("a");
      if (link) {
        var fromTitle = songUrlFromHref(link.href || link.getAttribute("href"));
        if (fromTitle) {
          return fromTitle;
        }
      }
    }

    var fromLocation = songUrlFromHref(window.location.href);
    if (fromLocation) {
      return fromLocation;
    }

    if (cover) {
      var coverMatch = cover.match(/\\/vi\\/([a-zA-Z0-9_-]{11})\\//);
      if (coverMatch) {
        return songUrlFromVideoId(coverMatch[1]);
      }
    }

    return undefined;
  }

  function isValidImageUrl(url) {
    return url && !url.startsWith("data:") && url.indexOf("http") === 0;
  }

  function thumbnailUrlFromRenderer(renderer) {
    if (!renderer || !renderer.thumbnails || !renderer.thumbnails.length) {
      return undefined;
    }
    return renderer.thumbnails[renderer.thumbnails.length - 1].url;
  }

  function findArtistChannelId() {
    var moviePlayer = document.getElementById("movie_player");
    if (!moviePlayer || typeof moviePlayer.getPlayerResponse !== "function") {
      return undefined;
    }
    try {
      var response = moviePlayer.getPlayerResponse();
      return (
        response &&
        response.videoDetails &&
        response.videoDetails.channelId
      );
    } catch (e) {}
    return undefined;
  }

  function channelIdFromArtistUrl(url) {
    if (!url) {
      return undefined;
    }
    var match = url.match(/\\/channel\\/([^/?#]+)/);
    return match ? match[1] : undefined;
  }

  function findArtistImageFromPlayerResponse(cover) {
    var moviePlayer = document.getElementById("movie_player");
    if (!moviePlayer || typeof moviePlayer.getPlayerResponse !== "function") {
      return undefined;
    }

    try {
      var response = moviePlayer.getPlayerResponse();
      if (!response) {
        return undefined;
      }

      var candidates = [];
      var microformat =
        response.microformat &&
        response.microformat.playerMicroformatRenderer;
      if (microformat && microformat.ownerThumbnail) {
        var ownerUrl = thumbnailUrlFromRenderer(microformat.ownerThumbnail);
        if (ownerUrl) {
          candidates.push(ownerUrl);
        }
      }

      for (var i = 0; i < candidates.length; i++) {
        if (isValidImageUrl(candidates[i]) && candidates[i] !== cover) {
          return candidates[i];
        }
      }
    } catch (e) {}

    return undefined;
  }

  function findPrimaryArtist(cover) {
    var channelSelector =
      '.ytmusic-player-bar.byline [href*="channel/"]:not([href*="channel/MPREb_"]):not([href*="browse/MPREb_"])';
    var browseSelector =
      '.ytmusic-player-bar.byline [href*="browse/FEmusic_library_privately_owned_artist_detaila_"]';
    var link =
      document.querySelector(channelSelector) ||
      document.querySelector(browseSelector);
    if (!link) {
      return { url: undefined, image: undefined, channelId: findArtistChannelId() };
    }

    var artistUrl = link.href || undefined;
    var img = link.querySelector("img, yt-img-shadow img");
    var artistImage =
      img && isValidImageUrl(img.src) ? img.src : undefined;

    if (!artistImage) {
      artistImage = findArtistImageFromPlayerResponse(cover);
    }

    var artistChannelId =
      channelIdFromArtistUrl(artistUrl) || findArtistChannelId();

    return { url: artistUrl, image: artistImage, channelId: artistChannelId };
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

  var artistElements = Array.from(
    document.querySelectorAll(artistsSelectors.join(",")),
  );
  var artists = [];
  var seenArtists = {};
  artistElements.forEach(function(x) {
    var name = x.innerText.trim();
    if (name && !seenArtists[name]) {
      seenArtists[name] = true;
      artists.push(name);
    }
  });

  var bylineEl = document.querySelector(".ytmusic-player-bar.byline");
  if (bylineEl) {
    var bylineText = bylineEl.innerText.trim();
    var artistSegment = bylineText.split("•")[0].trim();
    if (artistSegment) {
      var fromByline = artistSegment
        .split(/\s*,\s*|\s*&\s*/)
        .map(function(name) {
          return name.trim();
        })
        .filter(function(name) {
          return name.length > 0;
        });
      if (fromByline.length > artists.length) {
        artists = fromByline;
      }
    }
  }

  var album = query(albumSelectors.join(","), function(e) {
    return e.textContent;
  });

  var albumUrl = query(albumSelectors.join(","), function(e) {
    return e.href;
  });

  var artwork = navigator.mediaSession.metadata.artwork;
  var cover = artwork && artwork.length > 0 ? artwork[artwork.length - 1].src : "";

  var songUrl = findSongUrl(cover);
  var primaryArtist = findPrimaryArtist(cover);

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
    song_url: songUrl || undefined,
    artist_url: primaryArtist.url || undefined,
    artist_image: primaryArtist.image || undefined,
    artist_channel_id: primaryArtist.channelId || undefined,
  };
})()`;
