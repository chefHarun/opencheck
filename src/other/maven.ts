import { Dependency } from "../types";

function splitCoordinate(name: string): { groupId: string; artifactId: string } | null {
  const parts = name.split(":");
  if (parts.length < 2) return null;

  const groupId = parts[0].trim();
  const artifactId = parts[1].trim();
  if (!groupId || !artifactId) return null;

  return { groupId, artifactId };
}

export async function getMavenInfo(name: string, currentVersion: string): Promise<Partial<Dependency>> {
  const coordinate = splitCoordinate(name);
  if (!coordinate) return {};

  try {
    const params = new URLSearchParams({
      q: `g:"${coordinate.groupId}" AND a:"${coordinate.artifactId}"`,
      rows: "1",
      wt: "json",
    });

    const res = await fetch(`https://search.maven.org/solrsearch/select?${params.toString()}`);
    if (!res.ok) return {};

    const data = await res.json() as any;
    const doc = data.response?.docs?.[0];

    const latestVersion = doc?.latestVersion ?? currentVersion;
    const isOutdated = currentVersion !== latestVersion;

    const updatedAt = doc?.timestamp;
    const daysSinceUpdate = updatedAt
      ? Math.floor((Date.now() - Number(updatedAt)) / 86400000)
      : 0;

    return { latestVersion, isOutdated, daysSinceUpdate, weeklyDownloads: 0, isDeprecated: false };
  } catch {
    return {};
  }
}
