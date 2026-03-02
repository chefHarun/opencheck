import { existsSync, readdirSync } from "fs";
import { resolve } from "path";
import { LanguageDetectResult } from "./types";

export function detectLanguage(projectPath: string): LanguageDetectResult {
  const root = resolve(projectPath);

  const knownFiles: Array<Omit<LanguageDetectResult, "filePath"> & { file: string }> = [
    { file: "package.json", language: "nodejs", ecosystem: "npm" },
    { file: "requirements.txt", language: "python", ecosystem: "PyPI" },
    { file: "Cargo.toml", language: "rust", ecosystem: "crates.io" },
    { file: "Gemfile", language: "ruby", ecosystem: "RubyGems" },
    { file: "composer.json", language: "php", ecosystem: "Packagist" },
    { file: "go.mod", language: "go", ecosystem: "Go" },
    { file: "pom.xml", language: "java", ecosystem: "Maven" },
    { file: "build.gradle", language: "java", ecosystem: "Maven" },
    { file: "build.gradle.kts", language: "java", ecosystem: "Maven" },
    { file: "packages.lock.json", language: "dotnet", ecosystem: "NuGet" },
    { file: "pubspec.yaml", language: "dart", ecosystem: "Pub" },
  ];

  for (const candidate of knownFiles) {
    const filePath = resolve(root, candidate.file);
    if (existsSync(filePath)) {
      return {
        language: candidate.language,
        ecosystem: candidate.ecosystem,
        filePath,
      };
    }
  }

  const entries = readdirSync(root, { withFileTypes: true });
  const csproj = entries.find((entry) => entry.isFile() && entry.name.endsWith(".csproj"));
  if (csproj) {
    return {
      language: "dotnet",
      ecosystem: "NuGet",
      filePath: resolve(root, csproj.name),
    };
  }

  return {
    language: "unknown",
    ecosystem: "unknown",
    filePath: "",
  };
}
