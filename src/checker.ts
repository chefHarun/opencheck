import { readFileSync } from "fs";
import { basename } from "path";
import { Dependency, CheckResult } from "./types";
import { getNpmInfo } from "./npm";
import { getVulnerabilities } from "./osv";
import { detectLanguage } from "./detect";
import { getPypiInfo } from "./other/pypi";
import { getCargoInfo } from "./other/cargo";
import { getRubyGemsInfo } from "./other/rubygems";
import { getComposerInfo } from "./other/composer";
import { getGoModInfo } from "./other/gomod";
import { getMavenInfo } from "./other/maven";
import { getNugetInfo } from "./other/nuget";
import { getPubDevInfo } from "./other/pubdev";

function getStatus(dep: Dependency): Dependency["status"] {
  if (dep.vulnerabilities.some((v) => v.severity === "CRITICAL" || v.severity === "HIGH"))
    return "critical";
  if (dep.isDeprecated || dep.vulnerabilities.length > 0 || dep.daysSinceUpdate > 365)
    return "warning";
  return "ok";
}

function normalizeVersion(value: string): string {
  const normalized = value
    .replace(/^["']|["']$/g, "")
    .replace(/^[\^~><= ]+/, "")
    .replace(/^v/i, "")
    .trim();

  return normalized || "0.0.0";
}

function parsePomDeps(content: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const dependencyBlocks = content.match(/<dependency>[\s\S]*?<\/dependency>/g) ?? [];

  for (const block of dependencyBlocks) {
    const groupId = block.match(/<groupId>\s*([^<]+)\s*<\/groupId>/)?.[1]?.trim();
    const artifactId = block.match(/<artifactId>\s*([^<]+)\s*<\/artifactId>/)?.[1]?.trim();
    const scope = block.match(/<scope>\s*([^<]+)\s*<\/scope>/)?.[1]?.trim();
    const versionRaw = block.match(/<version>\s*([^<]+)\s*<\/version>/)?.[1]?.trim() ?? "0.0.0";

    if (!groupId || !artifactId || scope === "test") continue;

    const version = versionRaw.includes("${") ? "0.0.0" : normalizeVersion(versionRaw);
    deps[`${groupId}:${artifactId}`] = version;
  }

  return deps;
}

function parseGradleDeps(content: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const regex =
    /(?:implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly)\s*\(?\s*["']([^:"']+):([^:"']+):([^"')]+)["']\s*\)?/g;

  for (const match of content.matchAll(regex)) {
    const group = match[1]?.trim();
    const artifact = match[2]?.trim();
    const version = normalizeVersion(match[3] ?? "0.0.0");

    if (!group || !artifact) continue;
    deps[`${group}:${artifact}`] = version;
  }

  return deps;
}

function parseCsprojDeps(content: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const inlinePattern = /<PackageReference[^>]*Include="([^"]+)"[^>]*Version="([^"]+)"[^>]*\/?>/g;

  for (const match of content.matchAll(inlinePattern)) {
    const name = match[1]?.trim();
    const version = normalizeVersion(match[2] ?? "0.0.0");
    if (name) deps[name] = version;
  }

  const blockPattern = /<PackageReference[^>]*Include="([^"]+)"[^>]*>([\s\S]*?)<\/PackageReference>/g;
  for (const match of content.matchAll(blockPattern)) {
    const name = match[1]?.trim();
    const versionTag = match[2]?.match(/<Version>\s*([^<]+)\s*<\/Version>/)?.[1];
    if (name && versionTag) deps[name] = normalizeVersion(versionTag);
  }

  return deps;
}

function parsePackagesLockDeps(content: string): Record<string, string> {
  const deps: Record<string, string> = {};

  try {
    const data = JSON.parse(content) as any;
    const frameworks = data.dependencies ?? {};

    for (const framework of Object.keys(frameworks)) {
      const packages = frameworks[framework] ?? {};
      for (const [name, meta] of Object.entries(packages)) {
        const packageMeta = meta as any;
        const versionRaw = packageMeta?.resolved ?? packageMeta?.requested ?? "0.0.0";
        deps[name] = normalizeVersion(String(versionRaw));
      }
    }
  } catch {
    return deps;
  }

  return deps;
}

function parsePubspecDeps(content: string): Record<string, string> {
  const deps: Record<string, string> = {};
  let section: "dependencies" | "dev_dependencies" | null = null;

  for (const line of content.split("\n")) {
    const commentFree = line.replace(/#.*/, "");
    if (!commentFree.trim()) continue;

    const topLevel = commentFree.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*$/);
    if (topLevel) {
      const key = topLevel[1];
      section = key === "dependencies" || key === "dev_dependencies" ? key : null;
      continue;
    }

    if (!section) continue;

    const match = commentFree.match(/^\s{2}([a-zA-Z0-9_]+):\s*(.+)?$/);
    if (!match) continue;

    const name = match[1];
    const value = (match[2] ?? "").trim();
    if (!value || value === "any") continue;

    if (
      value.startsWith("{") ||
      value.startsWith("sdk:") ||
      value.startsWith("path:") ||
      value.startsWith("git:") ||
      value.startsWith("file:")
    ) {
      continue;
    }

    deps[name] = normalizeVersion(value);
  }

  return deps;
}

function parseDeps(content: string, language: string, manifestPath: string): Record<string, string> {
  const deps: Record<string, string> = {};

  if (language === "nodejs") {
    const pkg = JSON.parse(content);
    return {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
  }

  if (language === "python") {
    for (const line of content.split("\n")) {
      const clean = line.trim().split("#")[0].trim();
      if (!clean) continue;
      const match = clean.match(/^([A-Za-z0-9_\-\.]+)\s*([>=<!].+)?$/);
      if (match) {
        deps[match[1]] = match[2]?.replace(/[>=<!]/g, "").trim() ?? "0.0.0";
      }
    }
    return deps;
  }

  if (language === "rust") {
    for (const line of content.split("\n")) {
      const match = line.match(/^([a-z0-9_\-]+)\s*=\s*"([^"]+)"/);
      if (match) deps[match[1]] = match[2];
    }
    return deps;
  }

  if (language === "ruby") {
    for (const line of content.split("\n")) {
      const match = line.match(/gem\s+['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/);
      if (match) deps[match[1]] = normalizeVersion(match[2]);
    }
    return deps;
  }

  if (language === "php") {
    const pkg = JSON.parse(content);
    return {
      ...(pkg.require ?? {}),
      ...(pkg["require-dev"] ?? {}),
    };
  }

  if (language === "go") {
    for (const line of content.split("\n")) {
      const match = line.trim().match(/^([^\s]+)\s+v([^\s]+)/);
      if (match && !match[1].startsWith("//")) deps[match[1]] = match[2];
    }
    return deps;
  }

  if (language === "java") {
    if (manifestPath.endsWith(".xml")) return parsePomDeps(content);
    return parseGradleDeps(content);
  }

  if (language === "dotnet") {
    if (basename(manifestPath) === "packages.lock.json") return parsePackagesLockDeps(content);
    return parseCsprojDeps(content);
  }

  if (language === "dart") {
    return parsePubspecDeps(content);
  }

  return deps;
}

async function getRegistryInfo(name: string, version: string, language: string) {
  if (language === "nodejs")  return getNpmInfo(name, version);
  if (language === "python")  return getPypiInfo(name, version);
  if (language === "rust")    return getCargoInfo(name, version);
  if (language === "ruby")    return getRubyGemsInfo(name, version);
  if (language === "php")     return getComposerInfo(name, version);
  if (language === "go")      return getGoModInfo(name, version);
  if (language === "java")    return getMavenInfo(name, version);
  if (language === "dotnet")  return getNugetInfo(name, version);
  if (language === "dart")    return getPubDevInfo(name, version);
  return {};
}

export async function checkProject(projectPath: string): Promise<CheckResult> {
  const detected = detectLanguage(projectPath);

  if (detected.language === "unknown") {
    throw new Error(
      "No supported project file found. Supported: package.json, requirements.txt, Cargo.toml, Gemfile, composer.json, go.mod, pom.xml, build.gradle(.kts), .csproj, packages.lock.json, pubspec.yaml"
    );
  }

  const content = readFileSync(detected.filePath, "utf-8");
  const allDeps = parseDeps(content, detected.language, detected.filePath);
  const names = Object.keys(allDeps).filter(n => n !== "php" && n !== "ext-json");

  const results: Dependency[] = [];

  for (let i = 0; i < names.length; i += 5) {
    const batch = names.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(async (name) => {
        const rawVersion = (allDeps[name] ?? "0.0.0").replace(/[\^~>=<*]/g, "").split(" ")[0].trim() || "0.0.0";

        const [info, vulns] = await Promise.all([
          getRegistryInfo(name, rawVersion, detected.language),
          getVulnerabilities(name, rawVersion, detected.ecosystem),
        ]);

        const dep: Dependency = {
          name,
          currentVersion: rawVersion,
          latestVersion: (info as any).latestVersion ?? rawVersion,
          isOutdated: (info as any).isOutdated ?? false,
          daysSinceUpdate: (info as any).daysSinceUpdate ?? 0,
          weeklyDownloads: (info as any).weeklyDownloads ?? 0,
          isDeprecated: (info as any).isDeprecated ?? false,
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
    language: detected.language,
  };
}
