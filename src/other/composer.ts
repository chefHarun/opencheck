import { Dependency } from "../types";

export async function getComposerInfo(name: string, currentVersion: string): Promise<Partial<Dependency>> {
  try {
    const res = await fetch(`https://repo.packagist.org/packages/${encodeURIComponent(name)}.json`);
    if (!res.ok) return {};
    const data = await res.json() as any;

    const versions = Object.keys(data.package?.versions ?? {}).filter(v => !v.startsWith("dev-"));
    const latestVersion = versions[0]?.replace(/^v/, "") ?? currentVersion;
    const isOutdated = currentVersion !== latestVersion;
    const weeklyDownloads = data.package?.downloads?.monthly ?? 0;

    return { latestVersion, isOutdated, weeklyDownloads, daysSinceUpdate: 0, isDeprecated: false };
  } catch {
    return {};
  }
}