# 🔍 OpenCheck

I love open-source ❤️

> Dependency security & health checker for Node.js projects — fast, free

[![npm version](https://img.shields.io/npm/v/opencheck-cli)](https://npmjs.com/package/opencheck-cli)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## Features

- 🔴 **Security scanning** via [OSV.dev](https://osv.dev) (Google's open vulnerability DB)
- 🟡 **Outdated package detection** via NPM Registry
- 📦 **Deprecated package warnings**
- 📊 **Weekly download stats** (is this package still maintained?)
- 🚀 **CI/CD ready** — exits with code 1 if critical issues found
- 💻 **Beautiful terminal output**
- 📄 **HTML report export** — beautiful dark-mode report
- 🔧 **Fix suggestions** — instant npm update commands
- ⚙️ **GitHub Actions** — auto-generate workflow file

## Supported Ecosystems

- Node.js (`package.json`)
- Python (`requirements.txt`)
- Rust (`Cargo.toml`)
- Ruby (`Gemfile`)
- PHP/Composer (`composer.json`)
- Go (`go.mod`)
- Java (`pom.xml`, `build.gradle`, `build.gradle.kts`)
- .NET (`.csproj`, `packages.lock.json`)
- Dart (`pubspec.yaml`)

## Install

```bash
npm install -g opencheck-cli
```

Or use without installing:

```bash
npx opencheck-cli check .
```

## Usage

```bash
# Check current directory
opencheck check .

# Check specific project
opencheck check ./my-project

# Show only issues (skip healthy packages)
opencheck check . --only-issues

# Export a beautiful HTML report
opencheck check . --html

# Show fix commands for outdated/vulnerable packages
opencheck check . --fix

# JSON output (for CI/CD pipelines)
opencheck check . --json

# Generate GitHub Actions workflow file
opencheck check . --gha
```

## Example Output

```
🔍 OpenCheck Report
Checked at: 28.02.2026
Total packages: 42

  🔴 Critical: 1  🟡 Warning: 3  🟢 OK: 38

┌─────────────────────┬──────────┬──────────┬────────────┬─────────────┬─────────────────┬────────────┐
│ Package             │ Current  │ Latest   │ Updated    │ Downloads/wk│ Vulnerabilities │ Status     │
├─────────────────────┼──────────┼──────────┼────────────┼─────────────┼─────────────────┼────────────┤
│ lodash              │ 4.17.15  │ 4.17.21  │ 3y ago     │ 45M         │ HIGH            │ 🔴 CRITICAL│
│ moment ⚠️           │ 2.29.1   │ 2.30.1   │ 1y ago     │ 12M         │ none            │ 🟡 WARNING │
└─────────────────────┴──────────┴──────────┴────────────┴─────────────┴─────────────────┴────────────┘

🔧 Fix Commands:
  npm install lodash@4.17.21  ← has vulnerabilities!
  npm install moment@2.30.1

  Run all at once:
  npm install lodash@4.17.21 moment@2.30.1
```

## HTML Report

Run `opencheck check . --html` to generate a beautiful `opencheck-report.html` file in your project directory.

## GitHub Actions

Auto-generate a workflow file with:

```bash
opencheck check . --gha
```

Or add manually to your workflow:

```yaml
- name: Check dependencies
  run: npx opencheck-cli check . --only-issues

- name: Export HTML Report
  if: always()
  run: npx opencheck-cli check . --html

- name: Upload Report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: opencheck-report
    path: opencheck-report.html
```

## Roadmap

- [x] v0.1 - CLI
- [x] v0.2 - HTML report export
- [x] v0.3 - GitHub Actions integration
- [x] v0.4 - Fix suggestions & JSON output
- [ ] v1.0 - Web dashboard
- [ ] v1.1 - Pro plan (team features, Slack notifications)

## Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT © [chefHarun](https://github.com/chefHarun)
