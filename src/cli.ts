#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { checkProject } from "./checker";
import { Dependency, CheckResult } from "./types";

program
  .name("opencheck")
  .description("🔍 Dependency security & health checker")
  .version("0.1.0");

program
  .command("check [path]")
  .description("Check dependencies in a project")
  .option("--json", "Output results as JSON")
  .option("--html", "Export results as HTML report")
  .option("--only-issues", "Show only warnings and critical packages")
  .option("--fix", "Show fix commands for outdated/vulnerable packages")
  .option("--gha", "Generate GitHub Actions workflow file")
  .action(async (projectPath = ".", options) => {
    if (options.gha) {
      generateGHA(projectPath);
      return;
    }

    const spinner = ora("Analyzing dependencies...").start();

    try {
      const result = await checkProject(projectPath);
      spinner.stop();

      if (options.json) {
        const jsonOutput = {
          summary: {
            total: result.totalPackages,
            critical: result.critical.length,
            warnings: result.warnings.length,
            ok: result.ok.length,
            checkedAt: result.checkedAt,
          },
          critical: result.critical,
          warnings: result.warnings,
          ok: result.ok,
        };
        console.log(JSON.stringify(jsonOutput, null, 2));
        return;
      }

      if (options.html) {
        const htmlPath = resolve(projectPath, "opencheck-report.html");
        writeFileSync(htmlPath, generateHTML(result));
        console.log(chalk.green(`✅ HTML report saved to: ${htmlPath}`));
        return;
      }

      console.log("\n" + chalk.bold.cyan("🔍 OpenCheck Report"));
      console.log(chalk.gray(`Checked at: ${result.checkedAt.toLocaleString()}`));
      console.log(chalk.gray(`Total packages: ${result.totalPackages}\n`));

      console.log(
        chalk.red(`  🔴 Critical: ${result.critical.length}`) +
        "  " +
        chalk.yellow(`🟡 Warning: ${result.warnings.length}`) +
        "  " +
        chalk.green(`🟢 OK: ${result.ok.length}`)
      );
      console.log();

      const showDeps = [
        ...result.critical,
        ...result.warnings,
        ...(options.onlyIssues ? [] : result.ok),
      ];

      if (showDeps.length === 0) {
        console.log(chalk.green("✅ All dependencies look healthy!"));
        return;
      }

      const table = new Table({
        head: [
          chalk.white("Package"),
          chalk.white("Current"),
          chalk.white("Latest"),
          chalk.white("Updated"),
          chalk.white("Downloads/wk"),
          chalk.white("Vulnerabilities"),
          chalk.white("Status"),
        ],
        style: { head: [], border: ["gray"] },
        colWidths: [25, 12, 12, 14, 14, 17, 10],
      });

      for (const dep of showDeps) {
        const statusIcon =
          dep.status === "critical"
            ? chalk.red("🔴 CRIT")
            : dep.status === "warning"
            ? chalk.yellow("🟡 WARN")
            : chalk.green("🟢 OK");

        const vulnStr =
          dep.vulnerabilities.length > 0
            ? dep.vulnerabilities
                .map((v) =>
                  v.severity === "CRITICAL" || v.severity === "HIGH"
                    ? chalk.red(v.severity)
                    : chalk.yellow(v.severity)
                )
                .join(", ")
            : chalk.gray("none");

        const updatedStr =
          dep.daysSinceUpdate > 365
            ? chalk.red(`${Math.floor(dep.daysSinceUpdate / 365)}y ago`)
            : dep.daysSinceUpdate > 90
            ? chalk.yellow(`${dep.daysSinceUpdate}d ago`)
            : chalk.gray(`${dep.daysSinceUpdate}d ago`);

        const downloadsStr =
          dep.weeklyDownloads > 1_000_000
            ? chalk.green(`${(dep.weeklyDownloads / 1_000_000).toFixed(1)}M`)
            : dep.weeklyDownloads > 1_000
            ? `${(dep.weeklyDownloads / 1000).toFixed(0)}K`
            : chalk.red(`${dep.weeklyDownloads}`);

        table.push([
          dep.isDeprecated ? chalk.red(dep.name + " ⚠️") : dep.name,
          dep.currentVersion,
          dep.isOutdated ? chalk.yellow(dep.latestVersion) : chalk.green(dep.latestVersion),
          updatedStr,
          downloadsStr,
          vulnStr,
          statusIcon,
        ]);
      }

      console.log(table.toString());

      const vulnDeps = showDeps.filter((d) => d.vulnerabilities.length > 0);
      if (vulnDeps.length > 0) {
        console.log("\n" + chalk.bold.red("⚠️  Vulnerability Details:"));
        for (const dep of vulnDeps) {
          for (const v of dep.vulnerabilities) {
            console.log(
              `  ${chalk.bold(dep.name)} → ${chalk.red(v.severity)} ${chalk.gray(v.id)}`
            );
            console.log(`    ${v.summary}`);
            console.log(`    ${chalk.cyan(v.url)}`);
          }
        }
      }

      if (options.fix) {
        const fixDeps = [...result.critical, ...result.warnings].filter(
          (d) => d.isOutdated || d.vulnerabilities.length > 0
        );
        if (fixDeps.length > 0) {
          console.log("\n" + chalk.bold.yellow("🔧 Fix Commands:"));
          for (const dep of fixDeps) {
            console.log(
              `  ${chalk.cyan(`npm install ${dep.name}@${dep.latestVersion}`)}` +
              (dep.vulnerabilities.length > 0 ? chalk.red("  ← has vulnerabilities!") : "")
            );
          }
          console.log(
            "\n" + chalk.gray("Run all at once:") + "\n  " +
            chalk.cyan(`npm install ${fixDeps.map((d) => `${d.name}@${d.latestVersion}`).join(" ")}`)
          );
        } else {
          console.log(chalk.green("\n✅ Nothing to fix!"));
        }
      }

      if (result.critical.length > 0) {
        process.exit(1);
      }
    } catch (err: any) {
      spinner.fail(chalk.red("Error: " + err.message));
      process.exit(1);
    }
  });

program.parse();

function generateGHA(projectPath: string) {
  const workflowDir = resolve(projectPath, ".github", "workflows");
  const workflowPath = resolve(workflowDir, "opencheck.yml");
  const { mkdirSync } = require("fs");

  const yaml = `name: OpenCheck - Dependency Security

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
  schedule:
    - cron: '0 9 * * 1'

jobs:
  opencheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Run OpenCheck
        run: npx @chefharun/opencheck check . --only-issues
      - name: Export HTML Report
        if: always()
        run: npx @chefharun/opencheck check . --html
      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: opencheck-report
          path: opencheck-report.html
`;

  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(workflowPath, yaml);
  console.log(chalk.green(`✅ GitHub Actions workflow saved to: ${workflowPath}`));
  console.log(chalk.gray("Commit and push to activate!"));
}

function generateHTML(result: CheckResult): string {
  const allDeps = [...result.critical, ...result.warnings, ...result.ok];

  const rows = allDeps.map((dep) => {
    const statusColor =
      dep.status === "critical" ? "#ef4444" :
      dep.status === "warning" ? "#f59e0b" : "#22c55e";
    const statusLabel =
      dep.status === "critical" ? "🔴 CRITICAL" :
      dep.status === "warning" ? "🟡 WARNING" : "🟢 OK";

    const vulns = dep.vulnerabilities.length > 0
      ? dep.vulnerabilities.map((v) => `<span class="vuln vuln-${v.severity.toLowerCase()}">${v.severity}</span>`).join(" ")
      : '<span class="none">none</span>';

    const updated =
      dep.daysSinceUpdate > 365
        ? `<span style="color:#ef4444">${Math.floor(dep.daysSinceUpdate / 365)}y ago</span>`
        : dep.daysSinceUpdate > 90
        ? `<span style="color:#f59e0b">${dep.daysSinceUpdate}d ago</span>`
        : `${dep.daysSinceUpdate}d ago`;

    const downloads =
      dep.weeklyDownloads > 1_000_000
        ? `${(dep.weeklyDownloads / 1_000_000).toFixed(1)}M`
        : dep.weeklyDownloads > 1_000
        ? `${(dep.weeklyDownloads / 1000).toFixed(0)}K`
        : `${dep.weeklyDownloads}`;

    return `
      <tr>
        <td><strong>${dep.isDeprecated ? `⚠️ ${dep.name}` : dep.name}</strong></td>
        <td>${dep.currentVersion}</td>
        <td style="color:${dep.isOutdated ? "#f59e0b" : "#22c55e"}">${dep.latestVersion}</td>
        <td>${updated}</td>
        <td>${downloads}</td>
        <td>${vulns}</td>
        <td><span class="badge" style="background:${statusColor}">${statusLabel}</span></td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenCheck Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
    h1 { font-size: 1.8rem; margin-bottom: 0.25rem; }
    .subtitle { color: #94a3b8; margin-bottom: 2rem; font-size: 0.9rem; }
    .summary { display: flex; gap: 1rem; margin-bottom: 2rem; }
    .card { background: #1e293b; border-radius: 12px; padding: 1.25rem 2rem; text-align: center; }
    .card .count { font-size: 2rem; font-weight: bold; }
    .card .label { font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem; }
    .critical .count { color: #ef4444; }
    .warning .count { color: #f59e0b; }
    .ok .count { color: #22c55e; }
    table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 12px; overflow: hidden; }
    th { background: #0f172a; padding: 0.75rem 1rem; text-align: left; font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; }
    td { padding: 0.75rem 1rem; border-top: 1px solid #334155; font-size: 0.875rem; }
    tr:hover td { background: #263148; }
    .badge { padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: bold; color: white; }
    .vuln { padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
    .vuln-critical { background: #7f1d1d; color: #fca5a5; }
    .vuln-high { background: #7c2d12; color: #fdba74; }
    .vuln-medium { background: #78350f; color: #fde68a; }
    .vuln-low { background: #1e3a5f; color: #93c5fd; }
    .none { color: #475569; }
    footer { margin-top: 2rem; text-align: center; color: #475569; font-size: 0.8rem; }
    footer a { color: #60a5fa; text-decoration: none; }
  </style>
</head>
<body>
  <h1>🔍 OpenCheck Report</h1>
  <p class="subtitle">Generated at ${result.checkedAt.toLocaleString()} · Total packages: ${result.totalPackages}</p>
  <div class="summary">
    <div class="card critical"><div class="count">${result.critical.length}</div><div class="label">🔴 Critical</div></div>
    <div class="card warning"><div class="count">${result.warnings.length}</div><div class="label">🟡 Warning</div></div>
    <div class="card ok"><div class="count">${result.ok.length}</div><div class="label">🟢 OK</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Package</th><th>Current</th><th>Latest</th><th>Updated</th><th>Downloads/wk</th><th>Vulnerabilities</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <footer>Generated by <a href="https://github.com/chefHarun/opencheck" target="_blank">OpenCheck</a></footer>
</body>
</html>`;
}