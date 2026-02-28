#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { checkProject } from "./checker";
import { Dependency } from "./types";

program
  .name("opencheck")
  .description("🔍 Dependency security & health checker")
  .version("0.1.0");

program
  .command("check [path]")
  .description("Check dependencies in a project")
  .option("--json", "Output results as JSON")
  .option("--only-issues", "Show only warnings and critical packages")
  .action(async (projectPath = ".", options) => {
    const spinner = ora("Analyzing dependencies...").start();

    try {
      const result = await checkProject(projectPath);
      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Header
      console.log("\n" + chalk.bold.cyan("🔍 OpenCheck Report"));
      console.log(chalk.gray(`Checked at: ${result.checkedAt.toLocaleString()}`));
      console.log(chalk.gray(`Total packages: ${result.totalPackages}\n`));

      // Summary bar
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
            ? chalk.red("🔴 CRITICAL")
            : dep.status === "warning"
            ? chalk.yellow("🟡 WARNING")
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

      // Vulnerability details
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

      if (result.critical.length > 0) {
        process.exit(1); // CI/CD için
      }
    } catch (err: any) {
      spinner.fail(chalk.red("Error: " + err.message));
      process.exit(1);
    }
  });

program.parse();