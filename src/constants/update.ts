/** Catbot Edition fork — auto-update feed via update.electronjs.org. */
export const FORK_GITHUB_REPO = {
  owner: "CatbotTsumi",
  name: "kenku-fm-catbot-edition",
} as const;

export const FORK_RELEASE_PAGE_URL = `https://github.com/${FORK_GITHUB_REPO.owner}/${FORK_GITHUB_REPO.name}/releases/latest`;

/**
 * Owlbear Kenku FM version last merged into this fork.
 * Bump when pulling upstream; used to detect new official releases to merge.
 */
export const UPSTREAM_BASELINE_VERSION = "1.5.5";

/** Official upstream Kenku FM — manual update link when upstream is ahead of baseline. */
export const OFFICIAL_RELEASE_GITHUB_REPO = {
  owner: "owlbear-rodeo",
  name: "kenku-fm",
} as const;

export const OFFICIAL_RELEASE_PAGE_URL = `https://github.com/${OFFICIAL_RELEASE_GITHUB_REPO.owner}/${OFFICIAL_RELEASE_GITHUB_REPO.name}/releases/latest`;

export const OFFICIAL_RELEASE_API_URL = `https://api.github.com/repos/${OFFICIAL_RELEASE_GITHUB_REPO.owner}/${OFFICIAL_RELEASE_GITHUB_REPO.name}/releases/latest`;

export const FORK_UPDATE_SERVER = "https://update.electronjs.org";

export function getForkUpdateFeedUrl(
  platform: string,
  arch: string,
  version: string,
): string {
  return `${FORK_UPDATE_SERVER}/${FORK_GITHUB_REPO.owner}/${FORK_GITHUB_REPO.name}/${platform}-${arch}/${version}`;
}
