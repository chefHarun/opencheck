# 🔍 OpenCheck

> Dependency security & health checker for Node.js projects — fast, free, no AI required.

[![npm version](https://img.shields.io/npm/v/opencheck)](https://npmjs.com/package/opencheck)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## Features

- 🔴 **Security scanning** via [OSV.dev](https://osv.dev) (Google's open vulnerability DB)
- 🟡 **Outdated package detection** via NPM Registry
- 📦 **Deprecated package warnings**
- 📊 **Weekly download stats** (is this package still maintained?)
- 🚀 **CI/CD ready** — exits with code 1 if critical issues found
- 💻 **Beautiful terminal output**

## Install

```bash
npm install -g opencheck
```

Or use without installing:

```bash
npx opencheck check
```

## Usage

```bash
# Check current directory
opencheck check

# Check specific project
opencheck check ./my-project

# Show only issues (skip healthy packages)
opencheck check --only-issues

# JSON output (for CI/CD pipelines)
opencheck check --json
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
```

## GitHub Actions

```yaml
- name: Check dependencies
  run: npx opencheck check --only-issues
```

## Roadmap

- [ ] v0.1 - CLI (current)
- [ ] v0.2 - HTML report export
- [ ] v0.3 - GitHub Actions native integration
- [ ] v0.4 - Web dashboard
- [ ] v1.0 - Pro plan (team features, Slack notifications)

## Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT © [Your Name](https://github.com/yourusername)
