import type { UpdateInfo } from '../shared/ipc-contract';

const RELEASES_URL =
  'https://api.github.com/repos/drudilea/property-tracker/releases/latest';

/** Parse a semver string (tolerates leading "v" and missing segments) into
 * numeric [major, minor, patch], ignoring any pre-release suffix after "-". */
function parseVersion(v: string): [number, number, number] {
  const clean = v.replace(/^v/i, '').split('-')[0];
  const parts = clean.split('.').map((n) => parseInt(n, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** Returns true iff `latest` is strictly greater than `current`. */
export function isNewerVersion(latest: string, current: string): boolean {
  const [lMaj, lMin, lPat] = parseVersion(latest);
  const [cMaj, cMin, cPat] = parseVersion(current);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

/** Checks GitHub Releases for a newer version. Never throws — a network error
 * or missing release returns { updateAvailable: false }. */
export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo> {
  try {
    const res = await fetch(RELEASES_URL, {
      headers: {
        'User-Agent': 'property-tracker',
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) return { updateAvailable: false };

    const data = (await res.json()) as { tag_name?: string; html_url?: string };
    const tagName = data.tag_name ?? '';
    const htmlUrl = data.html_url ?? '';

    if (isNewerVersion(tagName, currentVersion)) {
      return { updateAvailable: true, latestVersion: tagName, url: htmlUrl };
    }
    return { updateAvailable: false };
  } catch {
    return { updateAvailable: false };
  }
}
