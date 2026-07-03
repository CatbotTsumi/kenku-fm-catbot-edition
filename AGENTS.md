# Kenku FM Catbot Edition — Agent Guide

Local Cursor agent onboarding for this fork. Read this before editing.

## Project identity

- **Fork:** [CatbotTsumi/kenku-fm-catbot-edition](https://github.com/CatbotTsumi/kenku-fm-catbot-edition)
- **Upstream:** [owlbear-rodeo/kenku-fm](https://github.com/owlbear-rodeo/kenku-fm) v1.5.5
- **Purpose:** Desktop Electron app — share local music, web audio (YouTube/Spotify), and soundboards to Discord voice calls
- **Fork goal:** Custom catbot features on top of upstream. Upstream accepts bug-fix PRs only; this fork may diverge freely
- **License:** GPL-3.0

## Architecture

### Process topology

```
src/index.ts (main)
  └── SessionManager (per BrowserWindow lifecycle)
        ├── PlaybackManager → DiscordBroadcast + AudioCaptureManagerMain
        ├── BrowserViewManagerMain
        ├── WindowManager
        └── PlayerManager → Fastify remote API
```

### Webpack entry points (`forge.config.js`)

| Entry | Bootstrap | Preload | Role |
|-------|-----------|---------|------|
| `main_window` | `src/renderer.ts` | `src/preload.ts` | Main UI shell — tabs, bookmarks, Discord, settings. Exposes `window.kenku` |
| `player_window` | `src/player/renderer.ts` | `src/player/preload.ts` | Embedded player — playlists, soundboards, Howler. Exposes `window.player` |
| `audio_capture_window` | `src/audioCapture/renderer.ts` | `src/audioCapture/preload.ts` | Hidden off-screen window — Web Audio mix, PCM worklet → WebSocket → Opus |

### Main-process managers

| File | Responsibility |
|------|----------------|
| `src/main/managers/SessionManager.ts` | Per-window orchestrator; creates/destroys all managers |
| `src/main/managers/PlaybackManager.ts` | Audio pipeline: capture stream → Discord voice |
| `src/main/managers/PlayerManager.ts` | Player BrowserView registration, Fastify HTTP server (default `127.0.0.1:3333`) |
| `src/main/managers/BrowserViewManagerMain.ts` | WebContentsView CRUD for tabs |
| `src/main/managers/AudioCaptureManagerMain.ts` | Hidden capture window, WebSocket PCM, Opus encode |
| `src/main/broadcast/DiscordBroadcast.ts` | discord.js bot + `@discordjs/voice` join/leave/play |
| `src/main/managers/WindowManager.ts` | Frameless window chrome (maximize/minimize/close) |

### IPC conventions

- **Naming:** `SCREAMING_SNAKE_CASE`, domain-prefixed
- **Prefixes:** `DISCORD_`, `BROWSER_VIEW_`, `AUDIO_CAPTURE_`, `PLAYER_`, `PLAYER_REMOTE_`, `WINDOW_`
- **Bridges:** `window.kenku` (main UI preload), `window.player` (player preload)
- **Rules:** `contextBridge` only in preload scripts; no Node APIs in renderer
- **Patterns:** `sendSync` for view creation; `invoke`/`handle` for cache clear and WebSocket address; else `send`/`on`

### Redux stores

**Renderer** (`src/renderer/app/store.ts`) — persist key `root` v4, whitelist: `bookmarks`, `settings`

| Slice | Path |
|-------|------|
| `connection` | `features/connection/connectionSlice.ts` |
| `output` | `features/output/outputSlice.ts` |
| `settings` | `features/settings/settingsSlice.ts` |
| `bookmarks` | `features/bookmarks/bookmarksSlice.ts` |
| `tabs` | `features/tabs/tabsSlice.ts` |
| `player` | `features/player/playerSlice.ts` |
| `input` | `features/input/inputSlice.ts` |

**Player** (`src/player/app/store.ts`) — persist key `player` v1, whitelist: `playlists`, `soundboards`

| Slice | Path |
|-------|------|
| `playlists` | `features/playlists/playlistsSlice.ts` |
| `soundboards` | `features/soundboards/soundboardsSlice.ts` |
| `playlistPlayback` | `features/playlists/playlistPlaybackSlice.ts` |
| `soundboardPlayback` | `features/soundboards/soundboardPlaybackSlice.ts` |

### Remote HTTP API

Registered in `src/main/remote/index.ts` when user enables remote in settings.

| Prefix | Purpose |
|--------|---------|
| `/v1/playlist` | List playlists |
| `/v1/playlist/play` | Play playlist by id |
| `/v1/playlist/playback` | Transport controls (play/pause/volume/seek/shuffle/repeat) |
| `/v1/soundboard` | List soundboards |
| `/v1/soundboard/play` | Play sound by id |
| `/v1/soundboard/stop` | Stop sound by id |
| `/v1/soundboard/playback` | Active sounds state |

Pattern: Fastify route → `view.send("PLAYER_REMOTE_*")` → player preload handler → `*_REPLY`. Returns 503 (`VIEW_ERROR`) if player view not registered. Types in `src/types/player.ts`.

## Prerequisites (Windows)

1. **Node.js** — LTS recommended (v20–22). Node v26 may work but is untested upstream.
2. **Yarn** — `corepack enable` or `npm install -g yarn`, or use `npx yarn`
3. **Visual Studio Build Tools** — "Desktop development with C++" workload required for native modules (`zlib-sync`, electron rebuild)
4. **`.env`** — copy from `.env.example` before `yarn`

## Dev commands

```powershell
# First-time setup (copy env, then install)
copy .env.example .env
yarn

# Dev mode (hot reload)
yarn start

# Lint
yarn lint

# Production build (loads .env via env-cmd)
yarn package
yarn make
```

**Note:** Only `package`, `make`, and `publish` use `env-cmd` to load `.env`. `yarn start` does not.

## CI / GitHub Actions

| Workflow | Trigger | Output |
|----------|---------|--------|
| [`.github/workflows/build.yml`](.github/workflows/build.yml) | Push/PR to `main` | Windows + Linux build artifacts (download from Actions tab) |
| [`.github/workflows/release.yml`](.github/workflows/release.yml) | Tag `v*.*.*` (e.g. `v1.5.6`) | GitHub Release with `.exe`, Squirrel `RELEASES`/`nupkg`, Linux packages |

Push to `main` → CI builds unsigned installers automatically. Tag a version to publish a release (feeds fork auto-update on Windows).

**No extra secrets required** — uses built-in `GITHUB_TOKEN`. Builds are unsigned (no DigiCert/Apple keys). Upstream [`.github/workflows/publish-stable.yaml`](.github/workflows/publish-stable.yaml) is Owlbear's signed pipeline; fork uses `build.yml` / `release.yml` instead.

**Release:** bump tag, push:

```powershell
git tag v1.5.6
git push origin v1.5.6
```

Commit a `yarn.lock` when possible — CI runs `yarn install` without `--frozen-lockfile` until then.

## Build gotchas

1. **castlabs Electron** — `package.json` pins `electron` to `castlabs/electron-releases#37.6.0+wvcus` for Widevine DRM. Set `ELECTRON_MIRROR` in `.env` (see `.env.example`). First `yarn` is slow.
2. **Widevine** — `src/index.ts` calls `components.whenReady()` before window creation. Failure disables DRM playback but app still loads.
3. **Forge externals** — `@timfish/forge-externals-plugin` bundles `opusscript`, `prism-media`, `@snazzah/davey`, `zlib-sync`.
4. **Audio capture** — capture window uses `sandbox: false` for AudioWorklet in preload.
5. **Three webpack bundles** — main, player, and audio_capture are separate renderer entry points.

## Extension points (catbot features)

| Area | Where to edit |
|------|---------------|
| Browser profile launch | `src/main/browserProfile.ts`, `BrowserViewManagerMain.ts`, `src/index.ts` |
| Tuna OBS (stream profile) | `src/main/tuna/TunaManager.ts`, `src/main/tuna/youtubeMusicMetadata.ts`, `SessionManager.ts` |
| Settings / persistence | `src/renderer/features/settings/settingsSlice.ts` + migrations in `src/renderer/app/store.ts` |
| New remote API routes | `src/main/remote/index.ts` + route file + player handler in `src/player/features/` |
| Discord behavior | `src/main/broadcast/DiscordBroadcast.ts` |
| Audio pipeline | `src/main/managers/PlaybackManager.ts`, `src/preload/managers/AudioCaptureManagerPreload.ts` |
| UI shell | `src/renderer/app/App.tsx`, `src/renderer/features/*` |
| Player features | `src/player/features/*` |
| Fork release | `forge.config.js` publisher targets `CatbotTsumi/kenku-fm-catbot-edition`; Squirrel `remoteReleases` set for delta updates |
| Updates | Fork: `autoUpdater` via `update.electronjs.org` (auto-download Catbot releases). If fork current: green icon links to official `owlbear-rodeo/kenku-fm` releases (no upstream auto-install) |

## Agent guardrails

- **No commit or publish** unless user explicitly asks
- **Never commit** Discord tokens, bot secrets, or `.env`
- **Prefer minimal diffs** — match existing MUI + RTK patterns
- **Respect process boundaries** — main vs preload vs renderer vs player
- **Don't break IPC contracts** — remote API and Stream Deck plugin depend on `/v1/*` routes
- **Upstream policy** does not bind this fork, but avoid gratuitous refactors

## Bootstrap status

Verified 2026-06-29:

| Step | Result | Notes |
|------|--------|-------|
| `npx yarn install` | **OK** | `zlib-sync` removed — incompatible with Node 26; discord.js runs without gateway compression |
| `npx yarn start` | **OK** | Kenku FM dev window + webpack on `localhost:3000` / logger on `9000` |
| VS Build Tools | Installed | Required for other native deps if re-added |

**Dev command:** `npx yarn start` (yarn not in PATH on this machine — use `npx yarn` or install yarn globally)

**Single-instance lock:** Kenku FM allows one instance. If dev start exits instantly, close existing Kenku FM window first (Task Manager → `electron` titled "Kenku FM").

**Dev profile:** By default `yarn start` uses the **installed** settings folder (`%APPDATA%\Kenku FM`) — same bookmarks, Discord token, and playlists. Set `KENKU_DEV_ISOLATED=1` to use a separate `%APPDATA%\kenku-fm` profile. Do not run installed and dev at the same time when sharing a profile. To copy settings into an isolated dev profile, run `npx yarn copy-settings` (requires a working `electron.exe`).

**Browser profile (stream YTM account):** Launch with `--browser-profile=<name>` to isolate tab browser data (cookies, YouTube Music login) in a separate Electron session partition while sharing settings, playlists, and Discord config. Example: `kenku-fm.exe --browser-profile=stream`. Env var: `KENKU_BROWSER_PROFILE=stream`. Dev: `npx yarn start -- --browser-profile=stream`. Stream Deck: Open action → `%LOCALAPPDATA%\kenku_fm\kenku-fm.exe` with arguments `--browser-profile=stream`. First launch with a profile: open YouTube Music in a tab and sign into your stream account once; cookies persist under `userData/Partitions/kenku-<name>/`. Normal launch (no flag) keeps the default session unchanged.

**Tuna OBS integration (stream profile only):** When launched with `--browser-profile=stream`, Kenku polls YouTube Music browser tabs and POSTs now-playing metadata to the [Tuna](https://github.com/univrsal/tuna) OBS plugin (default `localhost:1608`). Override port with `KENKU_TUNA_PORT`. Setup: 
1. Install Tuna in OBS.
2. OBS → Tools → Tuna Settings → Song source: **Web browser**; enable **Host/receive information on local webserver** on port **1608**; apply/start Tuna.
3. Launch Kenku with `--browser-profile=stream`, open YouTube Music in a tab, play music.
4. Add a Tuna text or browser source in OBS. Verify at `http://localhost:1608/` while a song plays.

Integration is automatic — no Kenku setting required. Only browser tabs on `music.youtube.com` are tracked (not the embedded Howler player tab).

**Electron on Windows:** `postinstall` runs `scripts/ensure-electron-win.js` to verify `electron.exe` exists after install.
