import { Dependency } from "../types";

export async function getPubDevInfo(name: string, currentVersion: string): Promise<Partial<Dependency>> {
  try {
    const res = await fetch(`https://pub.dev/api/packages/${encodeURIComponent(name)}`);
    if (!res.ok) return {};

    const data = await res.json() as any;
    const latestVersion = data.latest?.version ?? currentVersion;
    const isOutdated = currentVersion !== latestVersion;

    const updatedAt = data.latest?.published;
    const daysSinceUpdate = updatedAt
      ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000)
      : 0;

    const isDeprecated = Boolean(data.isDiscontinued);

    return { latestVersion, isOutdated, daysSinceUpdate, weeklyDownloads: 0, isDeprecated };
  } catch {
    return {};
  }
}
