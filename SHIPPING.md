# Shipping updates

## No terminal needed

Double-click these in the `Stack Casino` folder. They do everything below for you.

| File | What it does |
|---|---|
| **1 - Play.cmd** | Opens your working copy of the game |
| **2 - Try before shipping.cmd** | Builds exactly what your mate would get, and opens it. Sends nothing. |
| **3 - Test everything.cmd** | Runs the full 6-minute check. Look for `44/44 checks passed`. |
| **4 - Ship to mate.cmd** | Asks what changed, then publishes it |
| **5 - First time setup.cmd** | The one-time GitHub setup |

If one of them fails it tells you why and stops. Nothing reaches your mate unless
**4** finishes cleanly.

The rest of this file is the same thing from a terminal.

---

One command ships. Your mate never gets sent a file again after the first time.

```
node ship.js "fixed the balloon"
```

That runs `devkit check`, stamps a new version, writes `dist/`, commits and pushes.
Next time your mate opens `launcher.html`, he's on the new build.

---

## One-time setup

**1. Point the launcher at your repo**

```bash
node ship.js setup YOUR-GITHUB-USERNAME stack-casino
```

This fills in `launcher.html`, runs `git init`, and adds the remote.

**2. Make the repo on GitHub**

Go to [github.com/new](https://github.com/new). Name it **stack-casino**, make it
**public**, and create it **empty** — no README, no .gitignore, no licence. This
folder supplies all of that.

> Public matters: the launcher downloads the build over plain HTTPS with no
> credentials. A private repo won't be readable and the launcher will fall back to
> its cached copy forever.

**3. Ship the first build**

```bash
node ship.js "first build"
```

If git asks you to sign in, do it once and it's remembered.

**4. Send your mate `launcher.html`**

That's the only file he ever needs. Discord, email, whatever. He saves it
somewhere he won't delete it and opens it in Chrome or Safari.

---

## Day to day

| Command | What it does |
|---|---|
| `node ship.js "what changed"` | check, stamp, build, commit, push |
| `node ship.js --local "notes"` | build into `dist/` without pushing — use to test a build |
| `node ship.js status` | local build vs shipped build, uncommitted files, launcher config |

Versions are `YYYY.MM.DD.N` — the counter resets each day, so the third ship on
20 Sep 2026 is `2026.09.20.3`. The build number shows in the Account modal, so you
can ask your mate what he's on.

---

## How the launcher works

1. Fetches `dist/version.json` (a few bytes).
2. Same version as its cache? Boots the cache instantly — no download.
3. Newer? Downloads `dist/stack-casino.html`, caches it, boots it.
4. Offline or GitHub down? Boots the last cached build and says so.

It runs the game with `document.write` on the launcher's own origin, so **accounts,
wallets and cosmetics survive every update**. Two mirrors are tried in order
(raw.githubusercontent, then jsdelivr) so one being slow doesn't block a session.

### Things that will bite you

- **Don't hand-edit `dist/`.** It's regenerated every ship and your changes vanish.
- **`ship.js` refuses to publish if `devkit check` fails.** That's deliberate — a
  broken build would auto-install on your mate with no way for him to roll back.
- **Testing the launcher yourself:** open `launcher.html`. To force a re-download,
  clear the site data for that file, or run
  `localStorage.removeItem('stack-launcher-version')` in the console.
- **The mate's cached build lives in his browser's localStorage.** If he clears site
  data he needs internet once more to re-download.

---

## Rolling back

```bash
git log --oneline          # find the good build
git revert <bad-commit>
node ship.js "roll back the thing that broke"
```

Your mate picks up the rollback the same way he picks up a fix — it's just another
version number.
