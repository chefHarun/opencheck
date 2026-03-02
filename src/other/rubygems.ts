import { Dependency } from "../types";

export async function getRubyGemsInfo(name: string, currentVersion: string): Promise<Partial<Dependency>> {
  try {
    const res = await fetch(`https://rubygems.org/api/v1/gems/${encodeURIComponent(name)}.json`);
    if (!res.ok) return {};
    const data = await res.json() as any;

    const latestVersion = data.version ?? currentVersion;
    const isOutdated = currentVersion !== latestVersion;
    const weeklyDownloads = data.downloads ?? 0;

    return { latestVersion, isOutdated, weeklyDownloads, daysSinceUpdate: 0, isDeprecated: false };
  } catch {
    return {};
  }
}