import { Dependency } from "../types";

export async function getPypiInfo(name: string, currentVersion: string): Promise<Partial<Dependency>> {
  try {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
    if (!res.ok) return {};
    const data = await res.json() as any;

    const latestVersion = data.info?.version ?? currentVersion;
    const isOutdated = currentVersion !== latestVersion;
    const isDeprecated = !!(data.info?.classifiers ?? []).some((c: string) =>
      c.toLowerCase().includes("inactive") || c.toLowerCase().includes("abandoned")
    );

    const releaseDate = data.releases?.[latestVersion]?.[0]?.upload_time;
    const daysSinceUpdate = releaseDate
      ? Math.floor((Date.now() - new Date(releaseDate).getTime()) / 86400000)
      : 0;

    return { latestVersion, isOutdated, isDeprecated, daysSinceUpdate, weeklyDownloads: 0 };
  } catch {
    return {};
  }
}