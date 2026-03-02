import { Dependency } from "../types";

function isStable(version: string): boolean {
  return !version.includes("-");
}

export async function getNugetInfo(name: string, currentVersion: string): Promise<Partial<Dependency>> {
  try {
    const id = encodeURIComponent(name.toLowerCase());
    const res = await fetch(`https://api.nuget.org/v3-flatcontainer/${id}/index.json`);
    if (!res.ok) return {};

    const data = await res.json() as any;
    const versions = Array.isArray(data.versions) ? data.versions as string[] : [];
    if (versions.length === 0) return {};

    const stableVersions = versions.filter(isStable);
    const latestStable = stableVersions[stableVersions.length - 1];
    const latestAny = versions[versions.length - 1];
    const latestVersion = (latestStable ?? latestAny ?? currentVersion).replace(/^v/i, "");
    const isOutdated = currentVersion !== latestVersion;

    return {
      latestVersion,
      isOutdated,
      daysSinceUpdate: 0,
      weeklyDownloads: 0,
      isDeprecated: false,
    };
  } catch {
    return {};
  }
}
