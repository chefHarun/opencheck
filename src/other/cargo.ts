import { Dependency } from "../types";

export async function getCargoInfo(name: string, currentVersion: string): Promise<Partial<Dependency>> {
  try {
    const res = await fetch(`https://crates.io/api/v1/crates/${encodeURIComponent(name)}`, {
      headers: { "User-Agent": "opencheck-cli" },
    });
    if (!res.ok) return {};
    const data = await res.json() as any;

    const latestVersion = data.crate?.newest_version ?? currentVersion;
    const isOutdated = currentVersion !== latestVersion;
    const weeklyDownloads = data.crate?.recent_downloads ?? 0;

    const updatedAt = data.crate?.updated_at;
    const daysSinceUpdate = updatedAt
      ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000)
      : 0;

    return { latestVersion, isOutdated, daysSinceUpdate, weeklyDownloads, isDeprecated: false };
  } catch {
    return {};
  }
}