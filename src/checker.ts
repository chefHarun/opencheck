import { readFileSync } from "fs";
import { resolve } from "path";
import { Dependency, CheckResult } from "./types";
import { getNpmInfo } from "./npm";
import { getVulnerabilities } from "./osv";

function getStatus(dep: Dependency): Dependency["status"] {
  if (dep.vulnerabilities.some((v) => v.severity === "CRITICAL" || v.severity === "HIGH"))
    return "critical";
  if (dep.isDeprecated || dep.vulnerabilities.length > 0 || dep.daysSinceUpdate > 365)
    return "warning";
  return "ok";
}

export async function checkProject(projectPath: string): Promise<CheckResult> {
  const pkgPath = resolve(projectPath, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  const names = Object.keys(allDeps);
  const results: Dependency[] = [];

  // Process in parallel batches of 5
  for (let i = 0; i < names.length; i += 5) {
    const batch = names.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(async (name) => {
        const rawVersion = allDeps[name].replace(/[\^~>=<]/g, "").split(" ")[0];
        const [npmInfo, vulns] = await Promise.all([
          getNpmInfo(name, rawVersion),
          getVulnerabilities(name, rawVersion),
        ]);

        const dep: Dependency = {
          name,
          currentVersion: rawVersion,
          latestVersion: npmInfo.latestVersion ?? rawVersion,
          isOutdated: npmInfo.isOutdated ?? false,
          daysSinceUpdate: npmInfo.daysSinceUpdate ?? 0,
          weeklyDownloads: npmInfo.weeklyDownloads ?? 0,
          isDeprecated: npmInfo.isDeprecated ?? false,
          vulnerabilities: vulns,
          status: "ok",
        };
        dep.status = getStatus(dep);
        return dep;
      })
    );
    results.push(...batchResults);
  }

  return {
    totalPackages: results.length,
    critical: results.filter((d) => d.status === "critical"),
    warnings: results.filter((d) => d.status === "warning"),
    ok: results.filter((d) => d.status === "ok"),
    checkedAt: new Date(),
  };
}