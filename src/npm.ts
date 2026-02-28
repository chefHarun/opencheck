import { Dependency } from "./types";

export async function getNpmInfo(
  name: string,
  currentVersion: string
): Promise<Partial<Dependency>> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${name}`);
    if (!res.ok) throw new Error(`NPM API error for ${name}`);
    const data = await res.json() as any;
    
    const latestVersion = data["dist-tags"]?.latest ?? currentVersion;
    const latestTime = data.time?.[latestVersion];
    const daysSinceUpdate = latestTime
      ? Math.floor(
          (Date.now() - new Date(latestTime).getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0;

    const weeklyDownloads = await getWeeklyDownloads(name);
    const isDeprecated = !!data.versions?.[latestVersion]?.deprecated;
    const isOutdated = currentVersion !== latestVersion;

    return {
      latestVersion,
      isOutdated,
      daysSinceUpdate,
      weeklyDownloads,
      isDeprecated,
    };
  } catch {
    return {
      latestVersion: currentVersion,
      isOutdated: false,
      daysSinceUpdate: 0,
      weeklyDownloads: 0,
      isDeprecated: false,
    };
  }
}

async function getWeeklyDownloads(name: string): Promise<number> {
  try {
    const res = await fetch(
      `https://api.npmjs.org/downloads/point/last-week/${name}`
    );
    const data = await res.json() as any;
    return data.downloads ?? 0;
  } catch {
    return 0;
  }
}