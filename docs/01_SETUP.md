# 01 — Setup: Lovable + GitHub + Claude Code

Do this once per laptop. First person: ~30 min. Each teammate: ~10 min.

## The loop

```
Lovable  ⇄  GitHub (main branch)  ⇄  Claude Code
```
- Every Lovable prompt becomes a commit on `main`.
- Every Claude Code push to `main` syncs back into Lovable.

## Already done (by the project owner)

- [x] Lovable project created
- [x] Lovable connected to GitHub → repo `pareeyaporn/energy-twin-dashboard`
- [x] Lovable code visible on GitHub

## Step 1 — Add teammates

- **GitHub:** repo → Settings → Collaborators → Add people (each teammate's GitHub username).
- **Lovable:** invite teammates to the workspace so they can prompt.

## Step 2 — Install tools (each laptop)

1. **Git:** `git --version` (Mac offers to install it; Windows: install Git for Windows).
2. **Node.js 20+:** `node --version` (install from nodejs.org if missing).
3. **GitHub CLI:** `brew install gh` (Mac) or from cli.github.com. Then:
   ```bash
   gh auth login
   ```
4. **Claude Code:**
   - Mac / Linux: `curl -fsSL https://claude.ai/install.sh | bash`
   - Windows (PowerShell): `irm https://claude.ai/install.ps1 | iex`
   - Open a NEW terminal, then: `claude --version`
   - Or use Claude Code on the web (claude.ai/code) or the desktop app — same rules apply.

## Step 3 — Get the repo

```bash
gh repo clone pareeyaporn/energy-twin-dashboard
cd energy-twin-dashboard
npm install
npm run dev     # optional: check the app runs locally
```

## Step 4 — Add this kit to the repo

Copy these files into the repo root, keeping the folders:
```
CLAUDE.md
docs/01_SETUP.md
docs/02_ENGINE_SPEC.md
docs/03_DATA_SPEC.md
docs/04_3D_SPEC.md
docs/05_CLAUDE_CODE_PROMPTS.md
docs/06_LOVABLE_PROMPTS.md
docs/07_DEMO_CHECKLIST.md
```
Then:
```bash
git add CLAUDE.md docs
git commit -m "docs: add Energy Twin kit"
git push
```

## Step 5 — Test the loop (before building anything)

1. **Claude Code → Lovable:** open Lovable's code view. `CLAUDE.md` and `docs/` should appear within ~1 minute.
2. **Lovable → laptop:** make a tiny change in Lovable (e.g. change the tagline). Then:
   ```bash
   git pull
   git log --oneline -3
   ```
   The newest commit should be Lovable's.

Both work → you're connected.

## Step 6 — Start Claude Code

```bash
cd energy-twin-dashboard
claude
```
Then follow `docs/05_CLAUDE_CODE_PROMPTS.md` in order.

## Daily workflow

**Claude Code users:**
1. `git pull`
2. `claude` → paste the next prompt
3. Let it run tests + build
4. Ask it to commit and push to `main`
5. Check Lovable's preview

**Lovable users:**
1. One small prompt per change, naming the component
2. Add "don't modify src/engine, src/data or src/three" when working nearby
3. Broke something? Use Lovable's version history to roll back

**Team habits:**
- Say "pushing engine changes" in team chat before pushing
- Push every 30–60 minutes
- Merge conflict → ask Claude Code to resolve it carefully. Never force-push.

## Secrets (when you need AI or APIs)

1. Lovable → turn on **Lovable Cloud**.
2. Add secrets there (AI key, NREL key, Rewiring America key). Never in code, never in GitHub.
3. Backend functions in `supabase/functions/` read them.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| My push isn't in Lovable | Pushed to `main`? Check `git branch` |
| Lovable's changes aren't on my laptop | `git pull` |
| `claude: command not found` | Open a new terminal |
| 3D packages won't install | Match versions to React (see CLAUDE.md) |
| Sync stopped entirely | Did someone rename/move the repo? Check GitHub → Settings → Applications → Lovable has access to this repo |
| Build fails after pulling | `npm install` (package.json changed) |
