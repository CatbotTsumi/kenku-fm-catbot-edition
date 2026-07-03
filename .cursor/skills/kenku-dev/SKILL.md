---
name: kenku-dev
description: Kenku FM Electron dev workflow, remote API patterns, and castlabs build setup. Use when working on Kenku FM, editing src/main/, src/player/, remote routes, or when user says kenku-dev.
---

# Kenku FM Development

## Quick start

```powershell
copy .env.example .env
yarn
yarn start
```

See `AGENTS.md` for full architecture map.

## Dev workflow

| Command | When |
|---------|------|
| `yarn start` | Daily dev — Electron Forge + webpack HMR |
| `yarn lint` | Before committing |
| `yarn make` | Production build (needs `.env` via env-cmd) |

`yarn start` does **not** load `.env`. Only `package`/`make`/`publish` use `env-cmd`.

## CI (GitHub Actions)

- **Push to `main`** → [`.github/workflows/build.yml`](../../.github/workflows/build.yml) builds Windows `.exe` + Linux packages; download from Actions → Artifacts.
- **Tag `v*.*.*`** → [`.github/workflows/release.yml`](../../.github/workflows/release.yml) publishes a GitHub Release (Squirrel files enable fork auto-update).

No repo secrets needed for unsigned builds. Signed macOS/Windows release pipeline is upstream's `publish-stable.yaml` (Owlbear secrets).

## castlabs Electron install

If `yarn` fails fetching electron:

1. Ensure `.env` exists with `ELECTRON_MIRROR=https://github.com/castlabs/electron-releases/releases/download/`
2. Retry `yarn` (or `npx yarn install`)
3. Binary is large — first install takes several minutes

**Windows native modules:** `zlib-sync` requires Visual Studio Build Tools with "Desktop development with C++". Without it, `yarn install` and `yarn start` both fail at node-gyp rebuild.

Widevine loads via `components.whenReady()` in `src/index.ts`. DRM failure is non-fatal.

## Adding a remote API endpoint

End-to-end path:

1. **Route** — `src/main/remote/routes/<domain>/<action>.ts`
   - Export factory: `(manager: PlayerManager) => FastifyPluginCallback`
   - Use TypeBox schemas for request/response
   - `manager.getView()?.send("PLAYER_REMOTE_*", payload)` or 503

2. **Register** — `src/main/remote/index.ts`
   - `manager.fastify.register(handler(manager), { prefix: "/v1/..." })`

3. **Player handler** — `src/player/features/<domain>/*Remote.tsx` or `src/player/preload.ts`
   - Listen for `PLAYER_REMOTE_*`, perform action, send `*_REPLY`

4. **Types** — `src/types/player.ts` if new reply shape

Test with remote enabled in Settings (`127.0.0.1:3333` default).

## Fork vs upstream

This is the **CatbotTsumi** fork. Custom features welcome.

Updates (`src/autoUpdate.ts`):

1. **Catbot fork** — `autoUpdater` checks `update.electronjs.org/CatbotTsumi/kenku-fm-catbot-edition` (packaged win/mac). Downloads and applies fork releases; snackbar on ready.
2. **Official Kenku FM** — only when fork is current: GitHub check + green sidebar icon opens upstream release page (manual).

Publish fork builds with `yarn publish` after configuring GitHub token. Requires GitHub Releases on the fork repo.

Do not commit or publish without explicit user request.

## Common edit locations

| Task | Files |
|------|-------|
| New setting | `settingsSlice.ts`, `Settings.tsx`, store migration |
| Discord change | `DiscordBroadcast.ts`, `preload.ts` DISCORD handlers |
| New tab type | `tabsSlice.ts`, `BrowserViewManagerMain.ts` |
| Playlist feature | `src/player/features/playlists/` |
| Soundboard feature | `src/player/features/soundboards/` |
