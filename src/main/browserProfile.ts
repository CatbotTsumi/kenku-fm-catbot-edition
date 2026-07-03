import { session, Session } from "electron";

const PROFILE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/i;
const RESERVED_NAMES = new Set(["default"]);

function parseArgvProfile(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--browser-profile=")) {
      return arg.slice("--browser-profile=".length);
    }
    if (arg === "--browser-profile" && i + 1 < argv.length) {
      return argv[i + 1];
    }
  }
  return undefined;
}

function normalizeProfileName(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  const name = raw.trim().toLowerCase();
  if (!name) {
    return undefined;
  }

  if (RESERVED_NAMES.has(name)) {
    console.warn(
      `Invalid browser profile "${raw}": "default" is reserved. Using default session.`,
    );
    return undefined;
  }

  if (!PROFILE_NAME_PATTERN.test(name)) {
    console.warn(
      `Invalid browser profile "${raw}": use 1-32 alphanumeric or hyphen characters. Using default session.`,
    );
    return undefined;
  }

  return name;
}

const browserProfileName = normalizeProfileName(
  process.env.KENKU_BROWSER_PROFILE ?? parseArgvProfile(process.argv),
);

export function getBrowserProfileName(): string | undefined {
  return browserProfileName;
}

export function isStreamBrowserProfile(): boolean {
  return browserProfileName === "stream";
}

export function getBrowserPartition(): string | undefined {
  if (!browserProfileName) {
    return undefined;
  }
  return `persist:kenku-${browserProfileName}`;
}

export function getBrowserSession(): Session {
  const partition = getBrowserPartition();
  if (!partition) {
    return session.defaultSession;
  }
  return session.fromPartition(partition);
}

export function formatAppTitle(base: string): string {
  if (!browserProfileName) {
    return base;
  }
  const label =
    browserProfileName.charAt(0).toUpperCase() + browserProfileName.slice(1);
  return `${base} · ${label}`;
}
