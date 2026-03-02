import { Dependency } from "../types";

export async function getGoModInfo(name: string, currentVersion: string): Promise<Partial<Dependency>> {
  try {
    const res = await fetch(`https://proxy.golang.org/${encodeURIComponent(name)}/@latest`);
    if (!res.ok) return {};
    const data = await res.json() as any;

    const latestVersion = data.Version?.replace(/^v/, "") ?? currentVersion;
    const isOutdated = currentVersion !== latestVersion;

    const updatedAt = data.Time;
    const daysSinceUpdate = updatedAt
      ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000)
      : 0;

    return { latestVersion, isOutdated, daysSinceUpdate, weeklyDownloads: 0, isDeprecated: false };
  } catch {
    return {};
  }
}