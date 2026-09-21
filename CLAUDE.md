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
node test.js moles      # Moles maths, reshuffle, payouts, guards + sound smoke
node test.js shot       # Long Shot drag-aiming (real mouse drags)
node test.js sports     # Sportsbook pricing, accas, cash out, suspensions, layout
node test.js coop       # two-window presence, join invites, side bets
node test.js fight      # Fight Night engine, outcome mix, RTP, joint accas
node test.js cards      # Stack Cards: isolation, numbering, saving, grading, slab, wear + trading
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

18 single-player games + sportsbook + fight night + Stack Cards, 8 party tables, 8 card skins, 2 cosmetic types, accounts, admin portal, dev mode.

**Single player:** Moles, Long Shot, Plinko, Blackjack, Video Poker, Slots, Chicken Road, Balloon Pump, Fortune Wheel, Mines, Dice, Roulette, Keno, Hi-Lo, Baccarat, Tower, Limbo, Scratch (4 ticket designs), Craps.

**Moles** (`MO` state) — Stake Originals clone. 7 holes, player picks 1–6 moles as the volatility dial, max 8 hits, moles reshuffle after every hit so each swing is an independent `M/7`. `mult(k) = 0.98 / p^k`, **kept exact — never round it**; truncating to 2dp cost 0.4% RTP. `moFmt()` displays up to 4dp so the shown multiplier matches the payout. `0.98 × 7⁸ = 5,649,504.98` is the real game's max win and `test.js moles` asserts it.
Default is **5 moles** (71.4%); 3 averages 0.75 hits a round and reads as broken.
**The moles reshuffle every hit and hitting one does NOT remove it.** Constant `p` is
forced by the maths — it is the only way `0.98/p^8` reaches that max win. Alex misread
the bust reveal as a fixed board being uncovered, so the board twitches on each redeal
and the bust screen spells it out. If this confuses someone again, fix the explanation,
never the mechanics.

**Long Shot** (`SHOT` state) — the only skill game. Drag from the cannon **towards** the
target; power is drag distance. Do **not** re-introduce slingshot "pull back" aiming: the
cannon sits on the ground line, so below-and-behind is off-screen, every drag clamped to
`vy=0`, flight time `2*vy/g` became 0 and the ball died at the cannon's feet. Arms only
after an 18-unit drag, and a weak release cancels rather than firing a dud.
97% is a **ceiling, not an average**: the landing is `physics(aim) + visibleWind + hiddenGust`,
and only flawless aim leaves the gust alone, so `qMax = P(|gust| ≤ half)` and payout is
`0.97/qMax`. Skill closes the gap toward 97% and can never exceed it. The gust must stay
**triangular** — with a uniform gust the convolution against aiming error is flat, so
sloppy aim costs nothing and skill stops mattering. `test.js rtp` simulates both a
flawless and a sloppy aimer and requires the sloppy one to return strictly less.

**Party (`PT` array):** The Heist, The Run, The Vault, Blackjack, Hold'em, Crash, Derby, Coin Duel.

> **Skyline and The Strip are documented but not built.** Neither exists in `stack-casino.html` — no view, no `PT` entry, no renderer. Section 3's Strip money-conservation rules and `test.js strip` are kept for if they get built; the suite skips Strip and no longer calls the missing views. Verified 2026-09-20 by counting views and `PT`. Don't re-add them to this list without the code.

**Cosmetics:** 8 card skins (`SKINS`), 7 avatar frames (`FRAMES`), 7 nameplates (`PLATES`), auto wealth rank (`WEALTH`).

**Accounts.** `S.players` is the account list on this device, `S.cur` is who's logged in (`-1` = nobody), `S.session` is the username restored on load. `P()` returns the logged-in account or a read-only `GUEST` stub, so nothing crashes before login. `#authGate` covers the app until `loggedIn()`. There is no server and no cross-device account — identity travels to the other player over PeerJS in `myProf()`, which sends `user` (stable handle) as well as `name` (display).

**Admin portal** (`admin` view, `ADM` state, unlocked with `ADMIN_PW`, hidden from the nav until then). Two populations, and the distinction matters:

- **Local accounts** (`S.players`) — full control: balance, rename, reset password, grant admin, suspend, delete, log in as.
- **Roster** (`S.roster`) — everyone who has ever joined one of your parties, kept after they disconnect. Their figures are **self-reported by their client** on every `prof` message via `myProf().st`. Balance / suspend / message / kick are sent as `{t:'adm'}` and handled by `onAdminCmd()` on their side, so they only land while connected and only if their client co-operates. **Advisory, not enforcement** — never describe it otherwise.

Per-account stats: `created`, `lastSeen`, `playMs`, `sessions`, `wagered`, `won`, `bets`, `big`. `ensureStats()` backfills old accounts. Playtime ticks every 10s only while the tab is visible. Every admin action writes to `S.audit`.

**Sportsbook** (`sports` view, `FB` state) — simulated football: card of 3 fixtures,
markets (1X2 / O-U 2.5 / BTTS / correct score), bet slip, accumulators, live in-play
odds, cash out. Solo and party. Four rules that must not be broken:

- **Price from the exact `Binomial(90, lam/90)` the generator uses**, never a Poisson
  approximation. If model and generator disagree the RTP drifts and nothing visible
  catches it. `test.js sports` compares priced odds against 20k simulated matches.
- **Accumulators apply the edge once** — `0.97 / Πp`, not per leg. Per-leg is `0.97^n`
  (86% on a 5-fold): a real-book practice, a house-rule breach, and a hidden cost.
  Same-match legs are blocked; correlated outcomes make the product rule lie.
- **Cash out at fair value** `stake × price × p_now`, no second margin. Provably neutral
  since `E[p_now] = p_at_placement`.
- **Suspend settled markets.** A certainty prices at `0.97/1 = 0.97` — a guaranteed
  loss. `FB_MINODDS` gates every quote.

**One fixture at a time**, rolling to the next automatically — the three-match card
pushed the slip's cash-out button below the fold. Because there is only one match,
accumulator legs are **correlated**, so they are priced from the **joint distribution
over the score grid**, never the product of singles (multiplying "home win" by
"over 2.5" measured 5.00pp wrong against simulation; joint is 0.03pp).

Party sync is **seed-based**: host owns the card and drives kick-off, both pre-simulate
identically, only the seed and a kick-off cross the wire. Bets are always vs the house at 97% (in party
too) — no money moves between players, so the zero-sum party rule is untouched; the
party layer only shares fixtures and a profit leaderboard.

**Fight Night** (`fight` view, `FN` state) — pixel boxing, 3 live rounds, full book
(winner / distance / stoppage round / method), accumulators, live odds, cash out.

**The simulator IS the pricing model.** Boxing has no closed form for "red by KO in
round 2", so `fnPrices()` runs `fnPlayOut()` — the exact engine the player watches —
a few thousand times from the current state and counts outcomes. Model and generator
cannot drift apart because they are the same function. Accumulator legs count runs
where every leg lands, so correlation is exact (nested legs like "wins" + "wins by KO"
are 4.8pp off under a product rule, 0.03pp off jointly).

Balance is **measured, never eyeballed** — target ~35% KO / ~53% decision / ~12% draw,
with stoppages common in **every** round or the round 1/2 markets never land.
A realistic 3-rounder would mostly go to the cards, but this is a 60-second thing you
watch and Alex reported that knockouts "basically never happen" at 15%. `test.js fight`
asserts the mix.

Market names are **plain English, not bookmaker jargon** ("Ends early", not "ends
inside"), and every heading carries a one-line explanation. There is a separate boxing
guide (`#fnGuide`) — do not point Fight Night at the football one.

Watch for: `fnScoreRound` (cards) is separate from `fnEndRound` (cards + advance) because
`fnDecision` must score the round still in progress — missing that scored only rounds 1-2
and drew 45% of fights. Ring uses **red/blue corner colours**, not fighter brand colours.

**Stack Cards** (`cards` view) — the trading card game. **`stack-cards.html` is the source
of truth**; it still opens on its own (demo mode). Never edit the inlined copy in
`stack-casino.html` — edit `stack-cards.html`, then `node sync-cards.js` (ship does it
automatically; `devkit check` fails if they drift).

- **Shadow DOM.** It mounts into `#tcgHost`'s shadow root with its CSS cloned from the inert
  `<template id="stack-cards-css">`. Required, not cosmetic: 14 class names collide with the
  casino (`.bal .flip .win .stage .grid .flash .sheen …`) and the casino's rules leaked in
  (Balloon Pump's `.bal` made the card header 288px tall). `@property --hr` is declared in the
  document because shadow roots can't register it.
- **Host contract** `window.StackBridge`: `getBalance / spend / load / save / onBalance /
  notify / party / send / me / onGrading`. Cards save to the **account** (`P().cards`), so every
  login has its own binder; `tcgReload()` runs on login, logout and admin log-in-as.
- **Obsidian Edition.** A black, face-hidden slot closes each evo line in the binder
  (`x / y till you can craft`). Owning the whole line (slabbed counts) unlocks Craft; crafting
  does NOT consume the line and is once per line (`col.rew[line]`). OBS ids are 1000+ and live
  outside `SET` (base set stays 127) — always look cards up with `CARD(id)`. Obsidian is not
  `HI`: no condition, wear or grading, and has no graded-filter chip. It trades like a holo.
- **Graded filters** (`GF`): rarity chips, grade-band chips, rows by grade or by rarity.
- **Art placement.** Generic FA/SIR creature offsets in `PLACE` are DERIVED from the centred
  window pose — don't hand-type x values (that's how they ended up off-centre).
- **Copies.** Commons/holos are counts (`col[id] = {n, f}`). Full Art and above are individual
  copies in `col.inst` — `{u, id, s, cd:{ctr,dir,co,ed,su}, st, due, grade, cert}` with
  `st` = `raw | grading | back | slab`. Invariant: `col[id].n` = that card's `raw` copies.
- **Grading** is PSA-shaped: centering caps the grade (≤55/45 for a 10), `stkGrade()` follows
  `condScore()` with small grader variance, halves 1.5–8.5. Sending takes the copy out of the
  binder for `GRADE_MS` (60s); `gradeTick()` returns it, toasts, and badges the sidebar.
- **Wear** is SVG from the copy's seed. Metallic borders need dark scuffing, not just white
  whitening, or it disappears. Scratches are a glint layer masked to `--mx/--my`.
- **Trading** (party only): sender's side goes into `col.escrow` on send and comes back on
  decline, cancel, disconnect or reload. Receiver commits first. Messages `tcgReq tcgCol
  tcgOffer tcgResp tcgCancel` are routed to `StackCards.onNet`.
- Every card shows its set number `NNN/127` in the bottom strip.

**Party HUD** (`CO` state, `#coHud`) — a floating panel, only while `connected()`.
Shows what your mate is playing, sends a join invite they accept, and offers side bets
on their live round.

- An invite arriving while they are **mid-round is held**, not shown, until the round
  ends. `coBusy(g)` reads `phase !== 'idle'` (or `busy`) off that game's state object.
- **Side bets are house-banked** from the spectator's own wallet at 97%. No money moves
  between players, so the zero-sum party rule is untouched.
- The **actor's game code publishes the odds** (`coOffer`) — it is the only place that
  knows them — and calls `coSettle(yes)` on the outcome. The HUD is generic. Adding a
  game is those two calls. Currently wired for Moles and Long Shot.

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
- **Sound is all synthesised** in `SND` — no audio files, ever. The engine runs a master bus → compressor → out, plus a generated convolution reverb send. Three primitives: `_o()` pitched voice (pitch + filter envelopes), `_n()` filtered noise, `_fm()` FM voice.
`SND.reel(k)`/`reelStop()` drive spinning numbers (Dice, Limbo) — **throttle callers to ~20/sec**; per-frame is 60/sec and becomes a buzz. **Build sounds in layers** — a convincing impact is a noise transient + a low body + a tail, not one oscillator. `tone()` and `noise()` keep their original signatures; don't change them, 16 games call them.
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
- Auto-update **is live** — `prodcid/stack-casino`, public. `node ship.js "notes"` publishes and the mate's `launcher.html` self-updates. Version numbers come from the git-log high-water mark, so they can only ever go up (two builds once shared a number and cached launchers silently refused to update).
- Admin password ADMIN_PW is plaintext in the file, same as the old dev password. Anyone who opens the file can read it.
- Roster figures are self-reported by the other player's client. Treat as a record, not proof.
- Sportsbook: host drives kick-off and the roll to the next match; the guest's buttons are disabled. A guest joining mid-match gets a fresh fixture and any open bets on the old one are cleared.
- Party HUD side bets are wired for Moles and Long Shot only. Other games show presence and join, but no side-bet offer until they call coOffer/coSettle.
- Fight Night party sync shares the seed and the host drives start/next, same as the sportsbook. Guest buttons are disabled.
- Stack Cards packs are FREE: the engine's PACK_COST is 0. The spend path through the casino wallet is wired and tested, so pricing packs is a one-number change in stack-cards.html.
- Stack Cards trade: if the accept message is lost after the receiver commits (connection drops mid-trade), the sender's escrow is refunded and those cards end up duplicated. No server to arbitrate.

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
- **2026-09-20** — Moles added, cloned from Stake Originals. Researched rather than guessed: 7 holes, 1-6 moles chosen as volatility, max 8 hits. Confirmed the model by reverse-engineering Stake's stated max win 5,649,504.980x = 0.98 x 7^8 exactly, which pins p=1/7 at one mole and the 8-hit cap.
- **2026-09-20** — Moles multipliers are kept EXACT, not rounded to 2dp. Truncating them cost up to 0.4% RTP (6 moles at 3 hits measured 97.61% instead of 98.00%). The display carries up to 4dp instead so what the player reads is what they are paid.
- **2026-09-20** — Moles RTP is verified analytically (p^k x mult = 0.98 for all 48 combinations) as well as by simulation. Deep streaks cannot be sampled: 1 mole to 8 hits is 1 in 5,764,801, so a Monte Carlo row there just reads 0.00%. Simulation tolerances are now derived from the estimator variance rather than guessed.
- **2026-09-20** — Sound engine rebuilt: master bus with compressor, generated convolution reverb send, and three primitives (_o pitched, _n filtered noise, _fm). Sounds are layered - an impact is transient + body + tail - which is what makes them read as distinct objects. tone() and noise() keep their old signatures so the other 16 games were untouched.
- **2026-09-20** — Long Shot added - the skill game. 97% is the CEILING, reached only by flawless aim: the outcome is decided by a hidden gust the player cannot control, so skill closes the gap toward 97% but can never beat it. The gust is TRIANGULAR on purpose - with a uniform gust the convolution with aiming error is flat, so being sloppy by up to (GUST-half) cost nothing and skill did not matter at all. Caught by an RTP test, not by eye.
- **2026-09-20** — Moles default moved from 3 moles to 5. Three moles is 42.9% a swing and averages 0.75 hits per round, which reads as broken rather than hard. Five is 71.4% and ~2.5 hits. The odds were always correct; the default was the problem.
- **2026-09-20** — Moles reshuffle is now shown, not just stated: the board twitches on every redeal and the bust screen says the moles move every hit. Alex read the bust reveal as a fixed board being uncovered and thought whacking a mole should remove it. Constant p is REQUIRED - it is the only way 0.98/p^8 yields Stake's published max win - so the fix is explanation, never mechanics.
- **2026-09-20** — Dice and Limbo spins now tick per digit via SND.reel(k), throttled to ~20/sec with pitch climbing on progress, and SND.reelStop() punctuates the lock-in. Throttling matters: firing per animation frame would be 60 a second and become a buzz.
- **2026-09-20** — Long Shot aiming rewritten. The slingshot mapping was broken at the root: the cannon sits ON the ground line (LS_CY=430), so 'pull back and below' was a sliver of off-screen pixels. Every normal drag clamped to dy=0, which gives vy=0, which gives flight time 2*vy/g = 0 - the ball landed at the cannon's feet and ate the stake every time. Now aims TOWARD the drag point, which uses the whole playfield.
- **2026-09-20** — Long Shot arms only on a real drag (18 world units), never on a bare click, and a too-weak release cancels the shot instead of firing a dud. The player paid for an attempt, so a mis-gesture must not spend it.
- **2026-09-20** — Sportsbook (Stack League) added - simulated football with a card, bet slip, accas, live in-play odds and cash out. Plays solo and, in a party, both sides share one card via a seed: the match is pre-simulated deterministically from that seed, so nothing but the seed and a kick-off command crosses the wire.
- **2026-09-20** — Sportsbook prices from the EXACT Binomial(90, lam/90) the generator uses, not a Poisson approximation of it. Model and generator must agree or the RTP drifts invisibly; a test compares priced odds against 20k simulated matches.
- **2026-09-20** — Accumulators apply the edge ONCE to the whole ticket (0.97 / product of leg probabilities), not per leg. Compounding is what real books do and it would be 0.97^n - 86% on a 5-fold - which breaks the house rule and is exactly the hidden cost this project refuses to ship. Legs from the same match are blocked because those outcomes are correlated.
- **2026-09-20** — Cash out is offered at fair value (stake x price x p_now) with no second margin. The edge was taken at placement, so charging again would penalise using an advertised feature, and E[p_now]=p_placement makes it provably neutral.
- **2026-09-20** — Fixed a layout overlap in the shell: grid-template-columns used a bare 1fr, whose min-width:auto refuses to shrink below content, and .stage centres its overflow - so a wide fixture list spilled LEFT over the control column. Now minmax(0,1fr) plus min-width:0 on ctrl/stage. This was a global bug, not a sportsbook one.
- **2026-09-20** — Sportsbook control column: flex items will not shrink below min-content in the cross axis, so the slip's nowrap prices and match names pushed past the 300px panel and got clipped. Constrained each level with min-width:0 and ellipsised the text. test.js sports now measures overlap and overflow at 1000/1280/1600px.
- **2026-09-20** — Added an in-game betting guide (#fbGuide) covering decimal odds, each market, singles vs accas, live odds, cash out and the 97%. It also states plainly where this book is MORE generous than a real one (accas not compounded, cash out at fair value) - if we are going to be honest in the maths, say so in the copy.
- **2026-09-20** — Party HUD added: a floating panel showing what your mate is playing, a join invite they accept, and side bets on their round. An invite lands while they are mid-round is HELD until the round ends rather than interrupting it - coBusy() reads phase/busy off each game's state object. Side bets are house-banked from your own wallet at 97%, so no money moves between players and the zero-sum party rule is untouched.
- **2026-09-20** — Side-bet odds are published by the ACTOR's game code (coOffer) because that is the only place that knows them; the HUD is generic. Adding a game is two calls - coOffer when the odds change, coSettle when the outcome lands. Wired for Moles and Long Shot.
- **2026-09-20** — Sportsbook now shows ONE fixture at a time and rolls to the next automatically. The three-match card pushed the bet slip and its cash-out button below the fold, and cash out is the one control you need in a hurry.
- **2026-09-20** — Same-match accumulator legs are now ALLOWED and priced from the joint distribution over the score grid, not the product of single probabilities. Multiplying correlated markets (home win AND over 2.5) was 5.00pp wrong against simulation; the joint price is 0.03pp. This replaces the old block on same-match legs, which only existed because the product rule lied.
- **2026-09-20** — Cash-out buttons now show the offer against the stake as a coloured +/- delta, so you can see at a glance whether taking it banks a profit or cuts a loss. Reviewed, nothing else to record.
- **2026-09-20** — Open-bet list is wiped when the next fixture loads, so results do not pile up across matches. Anything still unsettled at that point is refunded rather than dropped - it should be impossible, but silently eating a stake would be worse than a stray toast.
- **2026-09-20** — Fight Night added: pixel boxing, 3 live rounds, full book. PRICED BY THE SIMULATOR ITSELF - boxing has no closed form for 'red by KO in round 2', so the odds come from running the same engine a few thousand times from the current state. That makes the model and the generator the same object by construction, which is the drift the football book needed a test to guard against.
- **2026-09-20** — Fight balance took three passes, all caught by measurement rather than eye. First cut: 93% of fights ended inside the distance (punch damage was ~3x what 100hp absorbs over 240 ticks). Overcorrected to 1.1% KO. Landed at ~15% KO / 75% decision / 10% draw with stoppages possible in every round - round 1 and 2 markets are unbettable otherwise.
- **2026-09-20** — BUG found by the draw rate: fnDecision scored off cards that never included the final round, because fnEndRound was only called BETWEEN rounds. A one-round-each split finished 19-19 and was declared a draw - 45% of fights. Split into fnScoreRound (cards) and fnEndRound (cards + advance); fnDecision now scores the round in progress.
- **2026-09-20** — Fighters wear red and blue corner colours in the ring rather than their own brand colour: two of the six are near-identical greens and that bout was unfollowable. Brand colour stays on the HUD chips.
- **2026-09-20** — Knockdowns used burst() - the gold-coin WIN celebration - which showered coins over a man being counted out. Replaced with ring sparks. Check the emotion of a shared effect before reusing it.
- **2026-09-20** — Launcher no longer trusts version.json to decide whether to update. GitHub serves version.json and the build from caches that lag INDEPENDENTLY: a real launch pulled version.json at .21 while the HTML was already .23, cached the new build under the old version string, and then believed it was current forever - Fight Night was downloaded but the launcher was pinned. It now always fetches the build when online and takes the version from the build's own meta tag, which is the only self-consistent source. test-launcher.js reproduces the skew.
- **2026-09-20** — Stoppage rate raised from ~15% to ~35% after Alex reported knockouts basically never happen. A realistic 3-rounder does mostly go to the cards, but this is a 60-second thing you watch and a market has to actually land sometimes. Stoppages now spread evenly enough that round 1 and 2 are live bets.
- **2026-09-20** — Renamed the boxing markets out of bookmaker jargon: 'ends inside'/'goes the distance' became 'Ends early'/'Goes all 3 rounds', and every market heading now carries a one-line explanation. Alex had to ask what the distance meant, which means the UI was wrong, not him.
- **2026-09-20** — Fight Night had its guide button wired to the FOOTBALL guide, which explains 1X2 and over/under goals and nothing about boxing. Written a proper boxing guide covering the distance, knockdown vs stoppage vs decision, and why stoppage-round bets lose when it goes the full 3.
- **2026-09-21** — Stake boxes lost focus on every digit: oninput called the full slip render, which rebuilt the input being typed into. oninput now only rewrites the stake-dependent numbers, and live re-renders go through keepFocus() which restores focus and caret. Stake boxes switched to type=text + inputmode=decimal because Chrome gives number inputs no selection API, so the caret jumped to the start after a rebuild.
- **2026-09-21** — log() takes an optional note; sportsbook, fight and side bets pass the actual market so the history table says which bet paid. Cash outs pop the profit in green (or loss in red) and the settled row shows it too.
- **2026-09-21** — Stack Cards integrated. stack-cards.html stays the SOURCE OF TRUTH and still opens standalone; sync-cards.js inlines its CSS and script into the casino, ship.js runs it before every build, and devkit check fails if the copies drift. The casino supplies window.StackBridge (wallet, per-account save into P().cards, party send, notify, grading badge).
- **2026-09-21** — Stack Cards renders inside a SHADOW DOM. Its #tcg scoping stopped it leaking out, but nothing stopped the casino leaking in: 14 class names collide (.bal .flip .win .stage .grid .flash .sheen ...). Balloon Pump's .bal rule turned the card header into a 288px wall that swallowed the grading mailer's tear strip. Patching classes one by one would break again with the next game; the shadow root is a permanent boundary. Its CSS lives in an inert <template>; @property can't register inside a shadow root so --hr is declared in the document.
- **2026-09-21** — Full Art and above became INDIVIDUAL copies (col.inst) so each one can carry its own condition, grade and state. Commons and holos stay as counts. Invariant: col[id].n equals that card's 'raw' copies. Condition is PSA-shaped: centering caps the grade (55/45 for a 10), and the final STK grade follows condition with a little grader variance, halves 1.5-8.5 like PSA. Measured pack-fresh spread: ~11% gem, ~33% 9, ~9% under 7.
- **2026-09-21** — Card wear is an SVG drawn from each copy's seed, so a copy always looks the same. Every Full Art+ tier has a silver or gold border, where white edge-whitening vanished - wear now mixes dark scuffing with white chips so it reads on metal. Scratches sit on a separate glint layer masked to the light position, so they only flash as you tilt the card.
- **2026-09-21** — Trades escrow the sender's side on send, so it can't be graded or offered twice while pending; declined, cancelled, disconnected or reloaded offers hand it back. The receiver commits first, then the sender. If the accept message is lost after the receiver commits, the sender gets their escrow back and the traded cards exist twice - accepted for a two-person game with no server.
- **2026-09-21** — Slab reveal: the STK GRADE call-out sat on top of the slab and covered the label. Moved it under the slab as a single line above the buttons.
- **2026-09-21** — Obsidian Edition: crafted, not pulled. A black face-hidden slot closes each evo line in the binder (x / y till you can craft); crafting needs every card in the line (graded/at-grading counts) and does NOT consume them. Obsidian ids 1000+ live in OBS outside SET so the base set stays 127; resolve via CARD(id). Not HI: no condition, wear or grading. stripSky knocks out the art's sky plate so an animated .obs-bg shows behind it.
- **2026-09-21** — Graded view filters: rarity chips, grade-band chips, rows by grade or rarity (Obsidian excluded - never graded). minis() guard: card-less binder slots used to throw and leave later tiles unclickable. Off-centre FA/SIR generic creatures: hand-typed PLACE x offsets were wrong, now derived from the centred window placement; dragon poses lean by design.
- **2026-09-21** — Zoom/grading: gradeTick used to go(curView) when a grade came back, rebuilding binder/graded under an open zoom or slab opening (jump to top, zoom engine killed). Now softRefresh(): deferred while .zoom/.rwov/.stkwrap is open, keeps scroll. activate() refuses elements outside an open .zoom, and the zoom deck re-grabs the engine on pointerdown - a binder tile could steal it so dragging spun the tile behind.

---

## 7. Reference files

- `stack-casino.html` — the game. Everything is in here.
- `devkit.js` — `check` / `map` / `ids` / `size` / `log` / `issue`. Run `check` before finishing; it also enforces that this file stays current.
- `test.js` — browser regression + RTP. Run before claiming anything works.
- `ship.js` — `setup` / `status` / `"notes"` / `--local "notes"`. Stamps a version, writes `dist/`, commits and pushes. Runs `devkit check` first and refuses to publish a failing build.
- `launcher.html` — the only file the mate keeps. Fetches `dist/version.json`, downloads `dist/stack-casino.html` when the version moves, caches it in `localStorage`, and `document.write`s it so the game stays on the launcher's origin and accounts survive updates. Falls back to the cached build when offline.
- `test-launcher.js` — end-to-end proof that the auto-update path works. `npm run test:launcher`.
- `SHIPPING.md` — the one-time GitHub setup and the day-to-day ship commands.
- `stack-cards.html` — **source of truth for Stack Cards**. Opens standalone as a demo.
- `sync-cards.js` — inlines `stack-cards.html` into the casino between the `STACK-CARDS` markers. `--check` verifies they match.
- `1-5 *.cmd` + `_findnode.cmd` — double-click shortcuts so Alex never needs a terminal. Keep them working; he uses these, not the CLI.
- `dist/` — published output. Generated; never hand-edit.
- `DESIGN.md` — scratch ticket research, all RTP tables, game-by-game maths. Read before touching payouts.
