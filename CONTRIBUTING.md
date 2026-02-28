# Contributing to OpenCheck

First off, thank you for considering contributing to OpenCheck! 🎉  
Every contribution — big or small — is greatly appreciated.

---

## 🐛 Reporting Bugs

If you find a bug, please [open an issue](https://github.com/chefHarun/opencheck/issues/new) and include:

- Your Node.js version (`node --version`)
- Your OS (Windows / Mac / Linux)
- The command you ran
- The full error output

---

## 💡 Suggesting Features

Have an idea? [Open a feature request](https://github.com/chefHarun/opencheck/issues/new) and describe:

- What problem it solves
- How you'd expect it to work
- Any examples from similar tools

---

## 🚀 Getting Started

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/opencheck.git
cd opencheck

# 2. Install dependencies
npm install

# 3. Run in development mode
npm run dev -- check .
```

---

## 🔧 Project Structure

```
opencheck/
├── src/
│   ├── types.ts      # Type definitions
│   ├── npm.ts        # NPM Registry API
│   ├── osv.ts        # OSV.dev security API
│   ├── checker.ts    # Core analysis logic
│   └── cli.ts        # CLI interface
├── dist/             # Compiled output (auto-generated)
├── package.json
└── tsconfig.json
```

---

## 📦 Making Changes

1. Create a new branch:

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes in `src/`

3. Build and test:

   ```bash
   npm run build
   npm run dev -- check .
   ```

4. Commit with a clear message:

   ```bash
   git commit -m "feat: add HTML report export"
   ```

5. Push and open a Pull Request:
   ```bash
   git push origin feat/your-feature-name
   ```

---

## ✅ Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix      | When to use           |
| ----------- | --------------------- |
| `feat:`     | New feature           |
| `fix:`      | Bug fix               |
| `docs:`     | Documentation only    |
| `refactor:` | Code refactor         |
| `chore:`    | Build, config changes |

---

## 🤝 Code of Conduct

Be kind, respectful, and constructive. We're all here to build something useful together.

---

Thank you for contributing! ❤️
