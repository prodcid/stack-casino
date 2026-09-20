# CLAUDE.md — Stack Casino

Fake-currency casino, single HTML file, played by Alex + one mate.

**This file is the project's memory. Sections 2, 5 and 6 are yours to maintain — `devkit.js check` fails if the game changed and this file didn't.** Keep it token-light: dense bullets, prune stale detail rather than letting it pile up.

---

## 0. Working rules (read every session)

**Before you finish any task that touched the file:**
```
node devkit.js check
```
Must print `PASSED`. It checks four things: syntax, duplicate top-level declarations, `$('id')` calls with no matching element, and **whether this file is stale**.

**Keeping memory current is not optional.** If `stack-casino.html` is newer than `CLAUDE.md`, `check` fails. Don't work around it by touching the file — record what actually changed:
```
node devkit.js log "why you chose X over Y"      # -> section 6, dated
node devkit.js issue "what's left broken"        # -> section 5
node devkit.js issue -r "text of a fixed issue"  # removes it from section 5
```
Then edit section 2 by hand if you added or removed a game. Nothing worth recording? Log that you reviewed it and why — don't skip silently. Alex should never have to remember to do this.

**Don't read the whole file to find something.** It's ~420 KB / ~8k lines. Use:
```
node devkit.js map <pattern>     # declarations + line numbers
node devkit.js ids <pattern>     # DOM ids + line numbers
node devkit.js size              # where the bytes are, biggest js sections
```

**Testing — never claim something works without running it.**
```
node test.js            # everything (~6 min)
node test.js solo       # single-player + tickets + cosmetics
node test.js mp         # two-window multiplayer, all 8 tables + login/identity
node test.js strip      # The Strip full game + money audit (skips: not built)
node test.js rtp        # maths only, no clicking (~2 min)
node test.js admin      # admin portal: stats, user table, suspend, audit
npm run test:launcher   # the auto-update path end to end
```
First run needs `npm i -D playwright && npx playwright install chromium`.

`test:launcher` serves `dist/` locally and checks cold download, warm cached start,
picking up a new version, **the player's account surviving an update**, and booting
offline. Run it after touching `launcher.html`, `ship.js`, or anything in the
storage/account layer.

- New single-player game → add it to the `games` list in `test.js` `solo()`.
- New party table → add its key to the list in `mp()`.
- New game with money maths → add an RTP row in `rtp()` with a sensible tolerance.

**"Verified" vs "should work".** Say verified only when a command actually ran and passed. Otherwise say what you didn't test.

**Editing style.** Anchored string replacement (python or Edit), not full-file rewrites. Assert the anchor appears exactly once — a silent 0-match or 2-match patch is the main way this file gets corrupted.

**Talking to Alex.** Direct, no filler, Australian spelling, plain words. Short lists are fine. Don't pad with caveats.

---

## 1. Project identity

- **File:** `stack-casino.html` — one file, no build step, no dependencies to install.
- **Runs:** open in any browser. Must work on desktop and phone (test at 390px).
- **Money:** fake credits, one wallet per account, saved to `localStorage` (and `window.storage` when hosted).
- **Ship:** `node ship.js "what changed"` → `dist/` → your mate's `launcher.html` self-updates. See `SHIPPING.md`.
- **Net:** PeerJS over WebRTC, loaded from CDN at runtime. Host-authoritative.

---

## 2. Current scope

16 single-player games, 8 party tables, 8 card skins, 2 cosmetic types, accounts, admin portal, dev mode.

**Single player:** Plinko, Blackjack, Video Poker, Slots, Chicken Road, Balloon Pump, Fortune Wheel, Mines, Dice, Roulette, Keno, Hi-Lo, Baccarat, Tower, Limbo, Scratch (4 ticket designs), Craps.

**Party (`PT` array):** The Heist, The Run, The Vault, Blackjack, Hold'em, Crash, Derby, Coin Duel.

> **Skyline and The Strip are documented but not built.** Neither exists in `stack-casino.html` — no view, no `PT` entry, no renderer. Section 3's Strip money-conservation rules and `test.js strip` are kept for if they get built; the suite skips Strip and no longer calls the missing views. Verified 2026-09-20 by counting views and `PT`. Don't re-add them to this list without the code.

**Cosmetics:** 8 card skins (`SKINS`), 7 avatar frames (`FRAMES`), 7 nameplates (`PLATES`), auto wealth rank (`WEALTH`).

**Accounts.** `S.players` is the account list on this device, `S.cur` is who's logged in (`-1` = nobody), `S.session` is the username restored on load. `P()` returns the logged-in account or a read-only `GUEST` stub, so nothing crashes before login. `#authGate` covers the app until `loggedIn()`. There is no server and no cross-device account — identity travels to the other player over PeerJS in `myProf()`, which sends `user` (stable handle) as well as `name` (display).

**Admin portal** (`admin` view, `ADM` state, unlocked with `ADMIN_PW`, hidden from the nav until then). Two populations, and the distinction matters:

- **Local accounts** (`S.players`) — full control: balance, rename, reset password, grant admin, suspend, delete, log in as.
- **Roster** (`S.roster`) — everyone who has ever joined one of your parties, kept after they disconnect. Their figures are **self-reported by their client** on every `prof` message via `myProf().st`. Balance / suspend / message / kick are sent as `{t:'adm'}` and handled by `onAdminCmd()` on their side, so they only land while connected and only if their client co-operates. **Advisory, not enforcement** — never describe it otherwise.

Per-account stats: `created`, `lastSeen`, `playMs`, `sessions`, `wagered`, `won`, `bets`, `big`. `ensureStats()` backfills old accounts. Playtime ticks every 10s only while the tab is visible. Every admin action writes to `S.audit`.

**Shipping.** `node ship.js "what changed"`. See section 7.

---

## 3. System design notes

### House edge — the rule that must never break
Every game returns **96–99%**. Non-negotiable, and every change to payouts needs an RTP re-run.

Two patterns, don't mix them up:

- **Single-player:** house edge baked into the payout table. Escalating games use `mult(k) = 0.97 / p^k` — the 0.97 applies **once**, not per step. `0.97/p` per step compounds the edge and silently drops RTP.
- **Multiplayer:** **zero-sum between players**, house takes a flat **3% rake** at settlement only. Money must never be created or destroyed mid-game.

### Multiplayer architecture
- Host runs the whole game. `PG` = host truth. `PS` = the view a client renders.
- `viewFor(who)` **strips anything that player shouldn't see** before sending. Hole cards, unopened lockers, secret picks. Getting this wrong is a cheating bug — `test.js mp` checks it.
- Clients send intents via `act()`. Host validates. Never trust a client-sent amount.
- `push()` broadcasts state; animation happens by pushing state in steps with `wait2()` delays.
- `busy()` blocks table switching mid-round. If a new game's round can be abandoned, add it there.
- Guest disconnect → `hostOnGuestLeft()` must reset or cancel your game's state.

### The Strip — money conservation
`cash.H + cash.G + pot` must **always** equal `ante × 2`. Property book value is *not* separate money — it already lives in the pot. `test.js strip` audits this every single turn.

### Adding a party game — checklist
`PT` · `hostInit` · `hostStopAll` · `hostOnGuestLeft` · `busy()` · pick-init in `hostAct` · act dispatch · `viewFor` case · renderer dispatch. Miss one and it half-works.

---

## 4. Style guide

- **Look:** Stake.com — navy `#0f212e`, panels `#1a2c38`, green `#00e701`, gold `#ffc800`. Outfit font.
- **Every game needs:** real animation, synthesised sound via `SND`, particle feedback (`burst`/`burstAt`/`floatText`), a clear win moment (`bigWin` at 10×+).
- **Sound is all synthesised** in `SND` — no audio files, ever.
- **Card skins** dress zones (frame, index plates, one top module, back), not whole-card colour washes. Alex rejected "weird" themes — keep them premium and real-material: metal, lacquer, leather, gemstone. No cartoon art on faces; face cards are serif monograms.
- **Animation restraint:** one module per card, calm timing. Alex pushed back hard on over-stimulating designs.
- **Odds are always shown** on the button before the player commits. Nothing hidden.
- **No dark patterns.** No fake near-misses, no loss-disguised-as-win, no hidden odds. Tension comes from real decisions, not manipulation.

---

## 5. Known issues / open items

- Google Fonts is blocked in sandboxed test runs — harmless, falls back to system sans. Ignore that proxy warning.
- PeerJS needs internet on both devices. Mobile data sometimes fails NAT traversal where Wi-Fi works.
- Dev password (`CID`) is plaintext in the file. Fine for mates, not a secret.
- Host can technically see all game state on their own device. Fine for mates.
- Balances persist via `localStorage` on a plain local file, and via `window.storage` when hosted. Private-browsing windows still reset.
- Account passwords are a non-cryptographic hash in localStorage. Fine for mates, not security.
- Skyline and The Strip are in the docs but not in the build. test.js skips them; decide whether to build or drop.
- Balloon Pump's element used id='bal', which collided with the header wallet - FIXED, now #bpBal. Watch for new duplicate ids; devkit check does not catch two elements sharing one id.
- **Auto-update is not live yet.** Alex still has to do the one-time setup in `SHIPPING.md`: `node ship.js setup <github-user> stack-casino`, create the empty **public** repo, then ship once. Until then `launcher.html` shows a "not configured" screen.
- Admin password ADMIN_PW is plaintext in the file, same as the old dev password. Anyone who opens the file can read it.
- Roster figures are self-reported by the other player's client. Treat as a record, not proof.

---

## 6. Decision log

- **Zero-sum + flat rake for multiplayer** — lets players build pots freely without inventing money.
- **`0.97/p^k` not `(0.97/p)^k`** — stops the edge compounding per step.
- **Predetermined outcome for scratch tickets** — roll the prize first, then build the ticket to show it. Exact RTP regardless of presentation complexity, and it's how real tickets work.
- **Trimmed extreme payout tiers** — a tier holding 5%+ of RTP at 1-in-a-million makes the game feel worse than its stated number. Cap tails so measured RTP converges.
- **Removed the Skyline payout cap** — it silently broke the 97% promise on long SEND IT chains. Caps that can bind are dishonest; set them where they can't.
- **Card skins redesigned twice** — first neon/fire/cyber, then koi/dragon. Both rejected as "weird". Landed on luxury materials.
- **Staged scratch tickets** — separate foil panel per area, stages unlock in order. Straight from real lottery ticket structure.
- **2026-09-20** — Replaced the two hardcoded local players (Alex/Mate) with real accounts: signup/login gate, per-device account store, session restored on load. The old model made every fresh copy of the file identity 'Alex', so a guest joining a party showed up as Alex and collided with the host.
- **2026-09-20** — Storage now falls back to localStorage when window.storage is absent, so login and wallet survive a refresh on a plain local file. Previously nothing persisted off a host.
- **2026-09-20** — Passwords use a fast non-cryptographic hash, not a real KDF. Deliberate: the account store is in the player's own browser, so this is shoulder-surf cover for a fake-money game, not security. Do not present it as secure.
- **2026-09-20** — Shipping goes through ship.js + a launcher.html the mate keeps. Launcher boots from a localStorage cache so it works offline, and document.write keeps the game on the launcher's origin so accounts survive every update.
- **2026-09-20** — Login and logout call save(true) to write through immediately; only bets stay on the 300ms debounce. A reload right after signup was losing the account, which test.js mp caught.
- **2026-09-20** — Added double-click .cmd shortcuts (1 Play / 2 Try before shipping / 3 Test everything / 4 Ship to mate / 5 First time setup) so Alex never needs a terminal. _findnode.cmd locates Node and puts it on PATH, because a freshly installed Node is absent from already-open shells. ship.js spawns process.execPath rather than bare 'node' for the same reason.
- **2026-09-20** — Admin portal added. No server exists, so 'all users' means two sources: accounts on this device (full control) and a persistent roster of everyone who has joined a party (record + live commands while connected). Chose a roster over pretending there is a central DB.
- **2026-09-20** — Accounts now track created / lastSeen / playMs / sessions / wagered / won. Playtime only ticks while the tab is visible, so an idle open tab does not report as playtime.
- **2026-09-20** — Remote admin commands (balance, suspend, kick, message) are advisory: the guest's client applies them. A modified client could ignore them. Acceptable for mates; do not describe it as enforcement.

---

## 7. Reference files

- `stack-casino.html` — the game. Everything is in here.
- `devkit.js` — `check` / `map` / `ids` / `size` / `log` / `issue`. Run `check` before finishing; it also enforces that this file stays current.
- `test.js` — browser regression + RTP. Run before claiming anything works.
- `ship.js` — `setup` / `status` / `"notes"` / `--local "notes"`. Stamps a version, writes `dist/`, commits and pushes. Runs `devkit check` first and refuses to publish a failing build.
- `launcher.html` — the only file the mate keeps. Fetches `dist/version.json`, downloads `dist/stack-casino.html` when the version moves, caches it in `localStorage`, and `document.write`s it so the game stays on the launcher's origin and accounts survive updates. Falls back to the cached build when offline.
- `test-launcher.js` — end-to-end proof that the auto-update path works. `npm run test:launcher`.
- `SHIPPING.md` — the one-time GitHub setup and the day-to-day ship commands.
- `1-5 *.cmd` + `_findnode.cmd` — double-click shortcuts so Alex never needs a terminal. Keep them working; he uses these, not the CLI.
- `dist/` — published output. Generated; never hand-edit.
- `DESIGN.md` — scratch ticket research, all RTP tables, game-by-game maths. Read before touching payouts.
