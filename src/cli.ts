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
            console.log(`  ${chalk.bold(dep.name)} → ${chalk.red(v.severity)} ${chalk.gray(v.id)}`);
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
    const statusClass = dep.status === "critical" ? "critical" : dep.status === "warning" ? "warning" : "ok";
    const statusLabel = dep.status === "critical" ? "CRITICAL" : dep.status === "warning" ? "WARNING" : "OK";

    const vulns = dep.vulnerabilities.length > 0
      ? dep.vulnerabilities.map((v) => `<span class="vuln-badge vuln-${v.severity.toLowerCase()}">${v.severity}</span>`).join(" ")
      : '<span class="vuln-none">—</span>';

    const updated =
      dep.daysSinceUpdate > 365
        ? `<span class="age-old">${Math.floor(dep.daysSinceUpdate / 365)}y ago</span>`
        : dep.daysSinceUpdate > 90
        ? `<span class="age-warn">${dep.daysSinceUpdate}d ago</span>`
        : `<span class="age-ok">${dep.daysSinceUpdate}d ago</span>`;

    const downloads =
      dep.weeklyDownloads > 1_000_000
        ? `<span class="dl-high">${(dep.weeklyDownloads / 1_000_000).toFixed(1)}M</span>`
        : dep.weeklyDownloads > 1_000
        ? `<span class="dl-mid">${(dep.weeklyDownloads / 1000).toFixed(0)}K</span>`
        : `<span class="dl-low">${dep.weeklyDownloads}</span>`;

    const latestClass = dep.isOutdated ? "outdated" : "uptodate";

    return `<tr>
        <td><div class="pkg-name">${dep.isDeprecated ? `${dep.name} <span class="deprecated-tag">deprecated</span>` : dep.name}</div></td>
        <td><span class="mono">${dep.currentVersion}</span></td>
        <td><span class="mono ${latestClass}">${dep.latestVersion}</span></td>
        <td>${updated}</td>
        <td>${downloads}</td>
        <td>${vulns}</td>
        <td><span class="status ${statusClass}"><span class="status-dot"></span>${statusLabel}</span></td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenCheck Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --black: #080808;
      --white: #f5f5f0;
      --gray-1: #1a1a1a;
      --gray-2: #2a2a2a;
      --gray-3: #444;
      --gray-4: #888;
      --gray-5: #bbb;
      --red: #ff3b3b;
      --yellow: #f5c800;
      --green: #00d26a;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--black); color: var(--white); font-family: 'Syne', sans-serif; min-height: 100vh; }
    header { border-bottom: 1px solid var(--gray-2); padding: 2.5rem 3rem; display: flex; align-items: flex-end; justify-content: space-between; }
    .logo { display: flex; align-items: center; gap: 0.75rem; }
    .logo-icon { width: 36px; height: 36px; border: 2px solid var(--white); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
    .logo-text { font-size: 1.1rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    .meta { font-family: 'DM Mono', monospace; font-size: 0.7rem; color: var(--gray-4); text-align: right; line-height: 1.8; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid var(--gray-2); }
    .summary-card { padding: 2.5rem 3rem; border-right: 1px solid var(--gray-2); }
    .summary-card:last-child { border-right: none; }
    .summary-card .number { font-size: 4rem; font-weight: 800; line-height: 1; margin-bottom: 0.5rem; }
    .summary-card .label { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gray-4); }
    .summary-card.critical .number { color: var(--red); }
    .summary-card.warning .number { color: var(--yellow); }
    .summary-card.ok .number { color: var(--green); }
    .summary-card.total .number { color: var(--white); }
    .section-header { padding: 2rem 3rem 1rem; display: flex; align-items: center; gap: 1rem; }
    .section-title { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gray-4); white-space: nowrap; }
    .section-line { flex: 1; height: 1px; background: var(--gray-2); }
    .table-wrap { padding: 0 3rem 2rem; }
    table { width: 100%; border-collapse: collapse; }
    thead th { font-family: 'DM Mono', monospace; font-size: 0.6rem; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: var(--gray-3); padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--gray-2); }
    thead th:first-child { padding-left: 0; }
    tbody tr { border-bottom: 1px solid #151515; transition: background 0.15s; }
    tbody tr:hover { background: var(--gray-1); }
    tbody tr:last-child { border-bottom: none; }
    td { padding: 1rem; font-size: 0.85rem; vertical-align: middle; }
    td:first-child { padding-left: 0; }
    .pkg-name { font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; }
    .deprecated-tag { font-family: 'DM Mono', monospace; font-size: 0.6rem; padding: 0.15rem 0.4rem; background: #2a1010; color: var(--red); border-radius: 3px; }
    .mono { font-family: 'DM Mono', monospace; font-size: 0.78rem; color: var(--gray-5); }
    .outdated { color: var(--yellow) !important; }
    .uptodate { color: var(--green) !important; }
    .age-old { color: var(--red); }
    .age-warn { color: var(--yellow); }
    .age-ok { color: var(--gray-4); }
    .dl-high { color: var(--green); font-family: 'DM Mono', monospace; font-size: 0.78rem; }
    .dl-mid { color: var(--gray-5); font-family: 'DM Mono', monospace; font-size: 0.78rem; }
    .dl-low { color: var(--red); font-family: 'DM Mono', monospace; font-size: 0.78rem; }
    .vuln-badge { font-family: 'DM Mono', monospace; font-size: 0.6rem; font-weight: 500; padding: 0.2rem 0.5rem; border-radius: 3px; display: inline-block; margin: 0.1rem; }
    .vuln-critical { background: #2a0a0a; color: #ff6b6b; border: 1px solid #3a1010; }
    .vuln-high { background: #2a1500; color: #ffaa44; border: 1px solid #3a2000; }
    .vuln-medium { background: #2a2000; color: #f5c800; border: 1px solid #3a3000; }
    .vuln-low { background: #0a1a2a; color: #60a5fa; border: 1px solid #102030; }
    .vuln-none { color: var(--gray-3); font-family: 'DM Mono', monospace; font-size: 0.75rem; }
    .status { display: inline-flex; align-items: center; gap: 0.4rem; font-family: 'DM Mono', monospace; font-size: 0.65rem; font-weight: 500; letter-spacing: 0.08em; padding: 0.3rem 0.7rem; border-radius: 999px; }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .status.critical { background: #1a0505; color: var(--red); }
    .status.critical .status-dot { background: var(--red); box-shadow: 0 0 6px var(--red); }
    .status.warning { background: #1a1500; color: var(--yellow); }
    .status.warning .status-dot { background: var(--yellow); box-shadow: 0 0 6px var(--yellow); }
    .status.ok { background: #051a0d; color: var(--green); }
    .status.ok .status-dot { background: var(--green); box-shadow: 0 0 6px var(--green); }
    footer { border-top: 1px solid var(--gray-2); padding: 1.5rem 3rem; display: flex; align-items: center; justify-content: space-between; }
    footer a { color: var(--gray-4); text-decoration: none; font-family: 'DM Mono', monospace; font-size: 0.7rem; transition: color 0.2s; }
    footer a:hover { color: var(--white); }
    .footer-badge { font-family: 'DM Mono', monospace; font-size: 0.65rem; color: var(--gray-3); border: 1px solid var(--gray-2); padding: 0.3rem 0.7rem; border-radius: 999px; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .summary-card { animation: fadeUp 0.4s ease both; }
    .summary-card:nth-child(1) { animation-delay: 0.05s; }
    .summary-card:nth-child(2) { animation-delay: 0.10s; }
    .summary-card:nth-child(3) { animation-delay: 0.15s; }
    .summary-card:nth-child(4) { animation-delay: 0.20s; }
    tbody tr { animation: fadeUp 0.3s ease both; }
    tbody tr:nth-child(1) { animation-delay: 0.1s; }
    tbody tr:nth-child(2) { animation-delay: 0.15s; }
    tbody tr:nth-child(3) { animation-delay: 0.2s; }
    tbody tr:nth-child(4) { animation-delay: 0.25s; }
    tbody tr:nth-child(5) { animation-delay: 0.3s; }
  </style>
</head>
<body>
  <header>
    <div class="logo">
      <div class="logo-icon">🔍</div>
      <span class="logo-text">OpenCheck</span>
    </div>
    <div class="meta">
      Generated: ${result.checkedAt.toLocaleString()}<br>
      Total packages: ${result.totalPackages}
    </div>
  </header>
  <div class="summary">
    <div class="summary-card total">
      <div class="number">${result.totalPackages}</div>
      <div class="label">Total Packages</div>
    </div>
    <div class="summary-card critical">
      <div class="number">${result.critical.length}</div>
      <div class="label">Critical</div>
    </div>
    <div class="summary-card warning">
      <div class="number">${result.warnings.length}</div>
      <div class="label">Warnings</div>
    </div>
    <div class="summary-card ok">
      <div class="number">${result.ok.length}</div>
      <div class="label">Healthy</div>
    </div>
  </div>
  <div class="section-header">
    <span class="section-title">Dependency Analysis</span>
    <div class="section-line"></div>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Package</th>
          <th>Current</th>
          <th>Latest</th>
          <th>Last Update</th>
          <th>Downloads / wk</th>
          <th>Vulnerabilities</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <footer>
    <a href="https://github.com/chefHarun/opencheck" target="_blank">github.com/chefHarun/opencheck</a>
    <span class="footer-badge">opencheck</span>
  </footer>
</body>
</html>`;
}