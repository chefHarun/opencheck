import chalk from "chalk";
import inquirer from "inquirer";
import { spawnSync } from "child_process";
import { resolve } from "path";
import { version } from "../package.json";

const LOGO = `
  ${chalk.gray("░█████╗░██████╗░███████╗███╗░██╗░█████╗░██╗░░██╗███████╗░█████╗░██╗░░██╗")}
  ${chalk.white("██╔══██╗██╔══██╗██╔════╝████╗██║██╔══██╗██║░██╔╝██╔════╝██╔══██╗██║░██╔╝")}
  ${chalk.white("██║░░██║██████╔╝█████╗░░██╔████║██║░░╚═╝█████═╝░█████╗░░██║░░╚═╝█████═╝░")}
  ${chalk.white("██║░░██║██╔═══╝░██╔══╝░░██║╚███║██║░░██╗██╔═██╗░██╔══╝░░██║░░██╗██╔═██╗░")}
  ${chalk.gray("╚█████╔╝██║░░░░░███████╗██║░╚██║╚█████╔╝██║░╚██╗███████╗╚█████╔╝██║░╚██╗")}
`;

export async function runInteractive() {
  console.clear();
  console.log(LOGO);
  console.log("  " + chalk.gray("Created for developers.") + "  " + chalk.cyan(`v${version}`));
  console.log("  " + chalk.gray("──────────────────────────────────────────────────────────────────────────"));
  console.log();

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: chalk.white("Select an action"),
      prefix: "  " + chalk.cyan("›"),
      choices: [
        { name: "  " + chalk.white("🔍 Scan current directory"), value: "scan" },
        { name: "  " + chalk.white("📄 Export HTML report"),     value: "html" },
        { name: "  " + chalk.white("🔧 Show fix commands"),      value: "fix"  },
        { name: "  " + chalk.white("📊 JSON output"),            value: "json" },
        { name: "  " + chalk.white("⚙️  Generate GitHub Actions"), value: "gha" },
        new inquirer.Separator("  " + chalk.gray("──────────────────────────────────────────────────────────────────────────")),
        { name: "  " + chalk.gray("🚪 Exit"),                    value: "exit" },
      ],
      pageSize: 10,
    },
  ]);

  if (action === "exit") {
    console.clear();
    console.log(LOGO);
    console.log("  " + chalk.gray("Goodbye! 👋"));
    console.log();
    process.exit(0);
  }

  const { onlyIssues } = await inquirer.prompt([
    {
      type: "confirm",
      name: "onlyIssues",
      message: chalk.white("Show only issues?"),
      prefix: "  " + chalk.cyan("›"),
      default: false,
    },
  ]);

  let flag = "";
  if (action === "html") flag = "--html";
  else if (action === "fix") flag = "--fix";
  else if (action === "json") flag = "--json";
  else if (action === "gha") flag = "--gha";

  const args = ["check", ".", flag, onlyIssues ? "--only-issues" : ""].filter(Boolean);

  console.log();
  console.log("  " + chalk.cyan("›") + " " + chalk.gray("Running OpenCheck..."));
  console.log();

  spawnSync(
    "node",
    [resolve(__dirname, "cli.js"), ...args],
    {
      stdio: "inherit",
      env: { ...process.env, FORCE_COLOR: "1" },
    }
  );

  console.log();
  console.log("  " + chalk.gray("─────────────────────────────────────────────────────────────────────────"));
  console.log("  " + chalk.gray("⭐ Star us on GitHub: github.com/chefHarun/opencheck"));
  console.log();
}