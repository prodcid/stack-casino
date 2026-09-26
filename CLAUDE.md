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
node test.js clash      # Stack Clash: two-window party battle (lobby, ready sync, start, move sync)
node test-gp.js sim      # Stack GP: calibration, recorded race == priced race, 97% per market (Node, ~5 min)
node test-gp.js ui       # Stack GP: screens 1280x860 + 393x852, live bet, settlement, memory over 10 races
node test-nrl.js sim     # Stack League: NRL calibration, recorded == priced, 97% per market (~5 min)
node test-nrl.js ui      # Stack League: screens, players move, live bet, settlement, ladder, memory
node test-slots.js sim   # Dragon Stacks: whole-game RTP incl. features, feature odds, fair gamble/wheel/envelopes (~1 min)
node test-egypt.js sim   # Ra's Fortune: RTP, both buys, feature odds, honest strips/features (~2 min)
node test-egypt.js ui    # Ra's Fortune: collect, Sun, Rain, Book of Ra, Treasure, buys, gamble - wallet audited
node test-olympus.js sim # Olympus Storm: RTP, bought-bonus RTP, FS odds, cap, honest draws (~2 min)
node test-olympus.js ui  # Olympus Storm: tumbles, orbs, a bought bonus with the wallet audited, autoplay
node test-slots.js ui    # Dragon Stacks: every feature forced + played out with the wallet audited, gamble, autoplay
node test.js frames     # new home + Racing/Markets on the casino wallet
node test.js garage     # Stack Garage: wallet bridge, crate + Spin, two-window part trade (accept + decline)
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
- **Runs:** open in any browser. **PC only** — Alex said 2026-09-22 not to spend time on phone layouts from now on. Don't test or tune at phone widths.
- **Money:** fake credits, one wallet per account, saved to `localStorage` (and `window.storage` when hosted).
- **Ship:** `node ship.js "what changed"` → `dist/` → your mate's `launcher.html` self-updates. See `SHIPPING.md`.
- **Net:** PeerJS over WebRTC, loaded from CDN at runtime. Host-authoritative.

---

## 2. Current scope

**Stack is an ecosystem** (2026-09-24): the Big Three are **Stack Sports** (hub `ssports` → Racing, Fight Night, Football), **Stack Markets** and **Stack Cards**; then **Stack Casino** (solo originals) and **Stack Tables** (card/table games + party).
18 single-player games + Football sportsbook + fight night + Stack Racing + Stack GP + Stack League (NRL) + Stack Markets + Stack Cards (with the Stack Clash battle game) + Stack Garage, 8 party tables, 8 card skins, 2 cosmetic types, accounts, admin portal, dev mode.

**Single player:** Moles, Long Shot, Plinko, Blackjack, Video Poker, Dragon Stacks (slots, frame game), Olympus Storm (tumble slot, frame game), Ra's Fortune (Egyptian coin slot, frame game), Chicken Road, Balloon Pump, Fortune Wheel, Mines, Dice, Roulette, Keno, Hi-Lo, Baccarat, Tower, Limbo, Scratch (4 ticket designs), Craps.

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

**Admin line (2026-09-26, works without a party):** every logged-in client listens on its own PeerJS id,
`adlId(user,slot)` with 4 slots (the broker can hold a released id for ~a minute after logout/relaunch, so the
player takes the first free slot and the admin dials all four). Admin proves `adlTok(user)` (hash of ADMIN_PW), then
the player streams `myProf()` every 2 s; admin commands `{t:'adm',a:'bal'|'give'|'msg'|'susp'}` apply via
`onAdminCmd`. Grant is a delta (`give`), not an absolute set. Offline commands queue in `S.admQ` and flush when
the line answers; the portal redials remote users every 10 s while it's open. `node test.js adminline` covers it
with two browser contexts (needs internet). Same trust model as before: ADMIN_PW is in the (public) file.

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

**Brand system** — every platform = the Stack hexagon mark (`bMark(k)`) + wordmark `STACK <NAME>` in
Barlow Condensed heavy italic (`bLock(k,size)`); only colour + glyph change (`BRANDS`: stack green,
sports blue/yellow, markets violet/teal, cards gold, casino pink, tables teal, garage grey). Home =
`buildEco()` (hero, `BIG3` panels, `#tilesCasino`/`#tilesTables`, More, scoreboard). Sidebar = `NAVG`
groups in `buildNav()`; keep `data-g` on every entry (tests + `go()` highlight rely on it).
Don't name a CSS custom property `--a` — it's registered as an `<angle>` (`@property`).

**Frame games** — Dragon Stacks (`stack-slots.html`), Olympus Storm (`stack-olympus.html`), Ra's Fortune (`stack-egypt.html`), Stack Garage, **Stack Racing** (`stack-racing.html`), **Stack GP** (`stack-gp.html`) and **Stack Markets**
(`stack-markets.html`) all use the same host: `FRAME_IDS` / `FG[id]` / `fgMount` / `fgView` /
`fgReload`, bridge = `FrameBridges[id]` (saves on `P()[id]`). Racing/Markets patches: bridge load/save,
Top up hidden, `drawBal(-1)` after a bridged spend, `window.StackFrame.refresh`. `GAR`, `garNet`,
`garView`, `garReload` remain as garage aliases. **Audio:** `frameAudio()` is injected before each frame's code and splices a host-controlled gain into every AudioContext (`ctx.destination` becomes that gain); `fgPause` mutes it via `__frameMute`, so hidden games stay silent while they keep running. Gain, not `suspend()`: a suspended context queues sounds and bursts them on resume. Frames also get the dark scrollbar CSS (`FRAME_SB`). sync-cards.js strips CRLF from the sources (git autocrlf checks them out as CRLF). Add a frame game: source file + `FRAMES` in
sync-cards.js + marker block + `FRAME_IDS` + a `<id>View` section with `<id>Host`/`<id>Load`.

**Stack League** (`nrl` view, under Stack Sports) — rugby league you watch: `stack-nrl.html` (edit directly, then
`node sync-cards.js`). Engine between `/*==CORE==*/` markers (test-nrl.js evals it): one match = ~135 plays
simulated tackle by tackle (hit-ups, shifts, breaks, errors/scrums, penalties, six-agains, sin bins, last-tackle
kicks, 40/20s, tries + conversions by angle, penalty goals, field goals, golden point). Per-set `luck` gives
in-game volatility without the MC "knowing" the winner (big hidden day form made favourites win 78%). The
recorded plays drive `buildPlay` choreography: scripted actors (dummy half, pass chain, runner, tacklers,
kicker/catcher, scorer) + everyone else steering to attack/defence shapes; the sim is stepped lazily just ahead
of the picture, and live markets suspend while a score the picture hasn't shown yet is pending. Figures carry
`tid` (club) vs `team` (match side) - kits come from `KIT[tid]` (away side wears its clash strip). 8 clubs,
7 rounds + a Grand Final, ladder in `S.season`. Calibrated to NRL: ~42 pts, 7.5 tries, 74% conversions, fav 62%.

**Stack GP** (`gp` view, under Stack Sports) — F1-style betting game built from `stack-gp-spec.md`. **Edit
`stack-gp.html` directly, then `node sync-cards.js`.** The engine sits between `/*==CORE==*/` and
`/*==END CORE==*/` (test-gp.js evals that slice in Node, so keep it DOM-free). Design choice vs the spec: there
is ONE simulation, event-driven per track segment (apex to apex); overtakes, DRS, dirty air, pits, SC/VSC,
mistakes, failures and rain resolve when a car enters a segment. The viewer places cars along the circuit's speed
profile between recorded segment times (`rawPose`/`framePoses`), so the race you watch IS the priced sim and
there's no separate lap-level model to keep in step. ~0.5ms per race: 2,000 pre-race runs, 300 live, 20,000
for pole. The live sim runs 2.5s ahead of the display so a defender's pushed-back exit never jumps on screen.
`priceOf` suspends anything seen <5 times or whose fair price is over the $501 cap (without that, long shots
returned ~50%). Tracks: 6 circuits from Catmull-Rom control points in `CIRCUITS`, line auto-placed 62% down the
longest straight, pit lane on the side with room. Don't name CSS vars `--a`… (casino only) and don't reuse `CW`
(car width) in the GP UI. Circuits are ~1.2km with real F1 speeds so a race is ~4.5 min at 1x.

**Dragon Stacks** (`slots` view, replaced the old 3-reel Slots 2026-09-25) — Dragon Cash-style 5x3, 243 ways. **Edit
`stack-slots.html` directly, then `node sync-cards.js`.** Maths between `/*==CORE==*/` markers (test-slots.js evals it).
Real reel strips (`buildStrip`, seeded, fixed) with a uniform stop per reel; specials sit >=2 plain cells apart so a reel
never shows two different specials. Features: Hold & Spin (6+ pearls, 3 respins reset on each new pearl, x2 pearl doubles
cash pearls, fill 15 = GRAND; `runHold` precomputes every respin and the UI replays it in the same cell order), free games
(pick Jade 14/x2, Ruby 10/x3, Gold 6/x5 - balanced within ~5%), Dragon Wheel (gong on reels 1+5, 20 equal segments),
Lucky Envelopes (reels 1/3/5, 18-envelope board, first to 3), Dragon Breath (random 2-4 wilds), red/black/suit gamble
(exact 50%/25% at 2x/4x, so RTP-neutral). Jackpots are fixed multiples (MINI 15, MINOR 40, MAJOR 200, GRAND 2000 x bet).
Measured 97.2% over 12M rounds; shares ~ base 52 / fs 14 / hs 21 / wheel 4 / env 4.5. `playRound` simulates one whole
round - keep it matching the UI's feature order. Near misses are REAL only: dense pearls (5 pearls ~1/50, 2 lanterns
~1/15) and `anticNeeded()` slows a reel with the drum roll only when the feature can still land. Alex asked for "plenty of
near misses" and forwarded advice to fake them and celebrate sub-stake wins; kept to section 4 instead and told him so -
under-bet wins read "$x back from your $y bet", no fanfare. Changing that is his call, made explicitly.
Canvas stage 1600x800 logical, scaled to fit; all art is canvas paths, all sound synthesised (`SFX`: Karplus-Strong
guzheng, gong, taiko; generated pentatonic music with base/fs/hs/big moods). `let` globals (S, busy, lastWin) are not
window props - tests reach them with `frameWindow.eval`.

**Olympus Storm** (`olympus` view, added 2026-09-26) — Gates-of-Olympus-style tumble slot, `stack-olympus.html`
(edit it, then `node sync-cards.js`; built from scratchpad parts, audio building blocks copied from Dragon Stacks).
6x5, 8+ of a symbol anywhere pays, winners removed and the rest fall (`tumble` in the CORE, records every step for the
show; the UI replays by cell `id`). Every cell/refill is an independent draw from `W` (base) / `WF` (free spins) - no
strips. Orbs (x2-x500) stay through a sequence; if it paid they sum and multiply it. 4+ scatters = 15 free spins where
orbs on paying tumbles add to a running total multiplier (+5 on 3 scatters), 5000x cap. Buy = `spinBuy` (normal board
with exactly 4 scatters) at `BUY_X`=115x, priced from the measured bonus EV (~111x) so it returns ~97%.
Measured 97.35% (3M); shares base 66 / scat 1 / fs 30; free spins ~1 in 355, avg ~109x.
**Name clash lesson:** the core's weighted picker was first called `drawSym`, same as the art function; the later
declaration won in the page (not in Node), so every cell was `undefined`. Core helpers must not share names with art/UI.
Zeus (`drawZeus`, pose throw/charge) hurls a bolt at each orb as it lands (`ZQ` queue); anticipation (`ANTIC` column)
only while a 4th scatter can still land.
Features (2026-09-26, all in the CORE and in `playRound`, which the sims use): Zeus's Wrath (`WRATH_P` 1/80, `wrathOn`
converts cells to the commonest paying symbol so it always pays), Hera's Blessing (`HERA_P` on dead spins with <3
scatters: whole-board re-drop with a guaranteed orb), Titan Battle (exactly 3 scatters, pot `TITAN_P0`=3x, 3 rounds,
every attack has q*m+(1-q)*0.4=1 so the choice only changes the swing), Temple of Gods (before every free spins round,
pick 3 of 9 shuffled statues: spins/start mult/cash), Double Chance (`ANTE_X` 1.25, scatter weight `WA`), buy tiers
`BUYS` (109x / 162x start x10 / 334x 20 spins from x25, priced from measured EV), Lightning Gamble (50/50 at 2x).
Measured: normal 97.3%, ante 97.7%, buys 96.7/97.3/97.0%. Second name clash hit here too (`TEMPLE` statue list vs the
sky's temple position, now `TEMPLE_POS`) - scan for duplicate top-level names after adding a part.

**Ra's Fortune** (`egypt` view, added 2026-09-26) - red + gold Egyptian slot, `stack-egypt.html` (edit it, then
`node sync-cards.js`; built from scratchpad parts). 5x4, 1,024 ways, real strips. Gold coins carry values; the Pharaoh
mask `COLL` (reel 5 only) collects every coin. Minis: Sun of Ra (`SUN_P` 1/40, a whole reel wild), Coin Rain (`RAIN_P`
1/85, 2-4 coins + a guaranteed collector). Bigs: Book of Ra free games (3+ scatters, `pickBook` chooses the expanding
symbol, `EXPAY` pays by reels covered, collects multiply and step up to x10), Pharaoh's Treasure hold & win (6+ coins,
`runHold` on a 5 x 4..6 board: sun coins double, pyramid coins add a row, full board = GRAND). Buys: free games 31x,
treasure 26x. Tuned for frequent wins (any win 1 in 2.1) after Alex said Dragon Stacks felt slow; measured 97.1-98.2%.

**Stack Garage** (`garage` view) — 3D car-parts game (three.js). **`stack-garage.html` is the source of
truth**; `sync-cards.js` copies it into an inert `text/plain` block (`#stack-garage`, script tags escaped
as `x-script`) and `garMount()` runs it in a same-origin **srcdoc iframe** — its page-wide CSS and
`document.getElementById` code can't share the casino document. `window.GarageBridge` (in the
`stack-bridge` script): casino wallet (`take`/`pay`), saves on `P().garage`, party send/name, toast,
go-to-party. Our patches to the original: bridge load/save, Top up hidden, reveal's green button is
**Spin · $price** (re-opens the crate), widebody wheels pushed out (`WIDE_OUT=.12`), `__gPaused` stops
rendering when you leave, and a **Trade tab** (`GT`): open your mate's spare parts (`garageReq/Inv`),
offer parts + cash, escrow in `bt.escrow`, incoming parts rebuilt from the `Na` catalogue with value
capped per tier, `garageLost` refunds. Messages route via the casino net switch → `garNet`.
**Status 2026-09-24: in the build but HIDDEN — `GARAGE_LIVE=false` removes its sidebar/home entries. Alex said hold it until he says the word; to release, set `GARAGE_LIVE=true` and ship.**
Telemetry: with `TELE_URL=''` it queues locally only and the first-login notice + account-modal note stay hidden; setting the Worker URL turns both on.
Header wallet coin = `.scoin` SVG (ridged rim, engraved S).
If Alex sends a newer stack-garage.html, re-apply the patches (anchors are minified names).

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
- **Signed & error cards** (`VAR`, `rollVar`, `addCard`). Rolled per card in packs and Trade
  Ups (signed 1/400, error 1/350: wrong ink, double print, miscut, missing name, upside-down art).
  Always an individual copy in `col.inst` with `.v`. On a Full Art+ it's also one of the counted
  raw copies (condition, gradeable, slab label names it). On a common/holo it is NOT in `col[id]`
  counts — `takeItems/giveItems` only touch counts for HI cards. Rendered by `varFront()` over
  the normal front; shown in their own "Signed & errors" binder row.
- **Light Blue Diamond Edition** (`v:'dia'`, `diaHTML`). ONE card only: Infernax Mono Rare
  (`DIA_ID=36`, #037), 1 in 10 of its pulls — Alex asked for that card specifically, don't widen it.
  Stones are the edge-wear chip sizes (see `wearHTML`) in blues, on the edges AND the whole
  face; the art is hue-rotated to light blue and `--h` forced to 208. Gradeable like any Mono Rare.
- **Store** (`store` tab, the default view) + **booster box**. Store front: featured sealed box
  turning on a plinth (`boxHTML({wrap:1})`), limited-edition shelf (coming soon — future limited
  packs go here), single packs, "your boxes", slab cabinet. `BOX_COST=0` for now (goes through
  `B.spend` so a price is a one-line change). Buying cuts to `desk(u)`: pure CSS 3D (`bf()` faces,
  `BW/BD/BH`), shrink-wrap with the Stack logo → drag the box cutter along `#wrCut` (bins, 86%)
  → wrap pieces fall → push `#bxTab` → lid hinges back 104° (its underside is the display
  header) → 36 packs (2×18, leaning back 16° from the base so every top shows). Pick a pack →
  `shop({box:1})` tear screen with `BOXCTX`; the pack only leaves `col.boxes[].packs` in
  `openPack`, so backing out never loses one. Box `st`: sealed → boxed → open → done.
- **Trade Up** (`tradeup` tab, `spareStacks/tuSign`): 10 spares of a rarity → 1 random card of
  the next (c→h→fa→sir→bwr), 50% drawn from cards you don't own. Spares never include your last
  copy, slabs or signed/error copies.
- **1st Edition vintage set** (`FE_LINES` → `FE_CARDS`, `t:'fe'`, ids 2000+ in `FEI`, resolved by
  `CARD()`). 9 lines × common baby / rare final / holo rare final = 27 cards, numbered holos 1–9,
  rares 10–18, commons 19–27. Classic 1999 layout in `feFront` (own type symbols `FE_SYM`,
  "Creature" wording — no Pokémon marks). Holo = cosmos glitter only behind the creature
  (`feSky` strips the sky). Counts live in `col[id]`; they trade and show in a binder section.
  **Vintage booster** (`vskin`, `rollVintage`, `shop({vintage:1})`, `VINT`): yellow or blue retro
  wrapper in Titan One (Google Font, added to both heads), 6 cards = 5 commons + 1 rare, 1 in 3
  rares holo. Vintage packs never touch `col.pity`. `feT(p)` maps fe rarity → c/h/fa for the
  reveal/celebrate/summary code.
- **Stack Clash** (`clash` tab) — lane battle game, built from `stack-clash-game-spec.md`. (The
  spec references a `stack-cards-battle-mockup.html` that was never in the folder; built from the
  written rules.) 6 crystals, 3 lanes, energy 1→6, play babies then stack teens/finals on top for
  +1 attack per card underneath, attack the enemy across, empty lane hits crystals, KO shatters by
  stage (1/2/3). 8 types (`CL_TYPE`, +2 on advantage `CL_STRONG`) and a trait per line (`CL_TRAIT`,
  `CL_TR` for names/icons). Stats are baseline-by-stage (`CL_BA`) with small per-line shifts
  (`CL_ADJ`); **rarity is cosmetic, never changes stats**. `ID2LINE` maps a card id → line by exact
  art suffix. Bond = baby+teen+final of a line in the deck → that line evolves for 1 less.
  - **Engine** is pure and fully JSON-serializable (creatures are plain objects; no functions in
    state). `clStart / clPlay / clAttack / clDice / clEndTurn`, KO/heal/reflect helpers. Randomness
    (shuffle, dice, coin-flip traits) runs on the acting device and is baked into the state.
  - **Multiplayer is hot-potato authoritative**: the player whose turn it is owns the state and
    `clBroadcast()`s the whole game after every action (`clashState`); the other side renders it
    read-only until `g.turn` flips. Lobby: both pick a deck + ready (`clashHello/Ready/Unready`),
    host (higher name) sends `clashStart` with the built game, joiner is side 1. `clashLeave` /
    `tcgLost` abort to the menu. Host routes clash msgs via the casino net switch → `StackCards.onNet` → `clNet`.
  - **Modes:** solo vs AI (`clAIStep`, easy=random / normal=heuristic / hard=normal+finisher dice),
    pass-and-play (one device, `clPassScreen` cover between turns, `clRel()` follows `g.turn`), party.
  - **Decks** live in `col.clash.decks` (≤5, ≤2 of a card, 20-card target, ≥6 babies warning). A
    starter deck (`clStarter`) is always available so you can play with an empty collection.
  - **Verified** by 300 headless AI-vs-AI games (no errors, all terminate ≤14 turns) and a
    two-window party test (`test.js clash`).
  - **Deferred (spec phase 2/3, not built):** Mastery/Legend/Champion/awakened powers, style points
    & finisher cinematics, Gauntlet/Daily Puzzle/Draft, share-code play. Undertow (swap) works; Gust
    is displayed but inert; Foresight auto-resolves.
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
- test.js sports 'correlated legs priced jointly' is a Monte Carlo check that fails occasionally (failed once in the full run 2026-09-21, passed 4/4 on rerun) - widen its tolerance or raise the sample.

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
- **2026-09-21** — Signed/error cards are individual inst copies (not a flag on counts) so they show, trade and grade on their own and can't be spent as spares; for commons/holos they sit outside col[id] counts. Double print needed a second offset <img> - a drop-shadow on the art was clipped by the window. Trade Up: 10 spares -> next rarity, half the time from unowned cards so it helps completion; last copies, slabs and specials are never spares.
- **2026-09-22** — Light Blue Diamond Edition: Alex's mate noticed the white edge-wear chips on a PSA 6 Infernax looked cool; re-cut them as blue stones (same chip sizes) across the whole face, art hue-rotated to light blue. Infernax Mono Rare only, by request, at 1 in 10 of its pulls - 1/100 was dropped because there are only 2 Mono Rares in the set, which would make it ~1 in 6700 packs.
- **2026-09-22** — Store + booster box: pure CSS 3D (no WebGL/three.js) so it stays one file and the card art reuses the same cached <img>s; lid hinges from the back and its underside is the display header, like a real Pokemon display box. Packs lean back 16deg from their base and the open camera looks down 54deg - at 40deg you only saw crimps. A box pack is removed only when torn, not when picked. PC only from now on per Alex.
- **2026-09-22** — Diamond Infernax gets a permanent binder slot after the Mono Rare (frosted preview + odds until pulled). Bug: the stone layer was class .dia, which collided with 'vtag dia', 'zvar dia' and 'varpop dia' - the tag/banner/pop inherited position:absolute;inset:0 and covered the whole card. Renamed the layer .dstones.
- **2026-09-22** — Diamond binder slot redesigned as a frosted plaque: faceted gem icon, DIAMOND on one line with letter-spacing compensated (padding-left = letter-spacing) so it measures dead centre, divider, odds pill. Old pill wrapped the diamond glyph onto its own line.
- **2026-09-22** — Stack Clash battle game (new Clash tab). Pure JSON-serializable engine; multiplayer is hot-potato authoritative - the active player broadcasts full state (clashState) each action and the other renders read-only until g.turn flips, so randomness/traits run only on the acting device and never desync. Chose that over lockstep (25 traits + dice would desync) and over hidden-info sync (spec itself proposes share-codes/full-state). Pure CSS card tokens reuse cardFrontBase art. Icons: detailed faceted-gem crystals and lightning-bolt energy per Alex. Deferred spec phase 2/3 (Mastery/Legend/Gauntlet/finishers); Gust inert, Foresight auto.
- **2026-09-22** — 1st Edition preview: 3 baby starters (Emberkit, Tidelet, Sproutling) in the classic 1999 base-set layout (feFront, t:'fe', FE_CARDS ids 2000+, not in SET). Own type symbols and 'Creature' wording - layout/style borrowed, no Pokemon marks. Matte: gain 0, no sparks. Painterly look is a soft CSS filter + paper texture over the existing art. Shown on the store's limited-edition shelf, tap to zoom. Padding uses % insets - cqi on the .front's own padding resolved against the wrong container.
- **2026-09-22** — 1st Edition stamp redrawn (double ring, big 1 + ST, readable EDITION arc) and put in a flex row with the length/weight strip so it lines up instead of floating over the frame edge.
- **2026-09-22** — 1st Edition finals: Emberfox/Tidewyrm/Sylvanox as Stage 2 holo (STAGE 2 badge + prev-art box, Evolves from, Creature Powers, /6 numbering, star rarity). Holo is ONLY in the art window: sky rect stripped (feSky) so two twinkling seeded glitter tiles + a colour-dodge rainbow show behind the creature. Binder specials split into Diamond / Signed / Errors sections + Collection header. God pack is now 5 Full Arts, 2 SIRs, then a Mono Rare.
- **2026-09-22** — Stack Cards perf pass (visuals kept): diamond glints were 90 individually animated SVG paths per copy (180 in the binder) -> 5 opacity-twinkled layers; diamond shine animates opacity not filter; Obsidian stars drift by transform (one tile per loop, seamless) not background-position; craft-ready pulse fades a glow layer; 1st Ed rainbow slides a rotated strip by transform; sparkle stars pre-rendered to cached sprites (star() made 3-5 gradients per spark per frame); binder/trade tiles off-screen pause via IntersectionObserver; idle tilt sway repaints light every other frame (movement stays 60fps). Idle binder main-thread work 700->307ms/s, pack 706->474, store 133->97. Also: trade offers render the real cards; Trade Up / Trade / deck builder keep scroll when you pick a card (keepScroll).
- **2026-09-22** — Performance tracker in Stack Cards (FPS button in the bar): live fps/worst frame/slow-frame %/longtasks/slow events/anim+node counts, GPU renderer via WEBGL_debug_renderer_info with a software-rendering warning (SwiftShader/llvmpipe/Basic Render), and 'Diagnose binder' - scripted idle / anims paused / scroll / scroll with effect layers hidden / + art hidden phases - so Alex's real machine tells us what the lag is. Copy report -> clipboard (textarea fallback).
- **2026-09-22** — Alex's perf report (Intel Arc, GPU on, dpr 1.25): scrolling/idle 60fps in every phase; the lag was hover - pointerenter interactions took ~136ms (event timing = until next paint). activate() now reads the card size before any DOM writes (it forced a full ~10k-node binder layout), and binder/graded tiles use hover intent (90ms settle) so sweeping the mouse no longer promotes + re-rasterises every card passed over. Diagnose gained hover-sweep and hover-rest phases.
- **2026-09-22** — Binder scroll lag (Alex saw fps tank on real wheel scrolling; diagnose glides 9px/frame so never showed it): 127 unique vector arts, 9.5MB SVG, ~6.5ms (max 22ms) to rasterise each as tiles enter view - a wheel flick brings a row in at once. Grid tiles (binder/trade/deck builder/trade up) now swap to pre-rendered 360px WebP bitmaps built in requestIdleCallback (BMP cache, ~4s idle for all 127, in-memory per session); zoom/pack/slabs keep vector. Hover activation is suppressed while scrolling. Perf panel gained 'Record my scroll' (8s real use, long-animation-frame script/style/render breakdown).
- **2026-09-22** — Alex's recorded scroll: 36fps, 18 long frames (worst 303ms) with ~0 script/layout/render attributed and only 101/127 bitmaps ready - bitmap building (sync drawImage + main-thread WebP base64 encode) was running while he scrolled. Now: all art keys queued at mount (bmpPrime, 1.5s after load, ~9s to finish in idle), one per idle slot, paused while SCROLLING, encoded via async canvas.toBlob -> object URL (PC only, blob: OK). Report now includes bitmap work during the recording and unattributed main-thread ms.
- **2026-09-22** — 1st Edition vintage set: 6 more lines (wolf, owl, lion, hare, turt, rdr) + the original 3, each as common/rare/holo = 27 cards. Chose base-set structure (rare AND holo rare per final) as 'their rare versions'. Vintage booster is a separate pack (not mixed into the main set) with its own retro yellow/blue wrapper and Titan One logo; 6 cards, 1/3 rares holo, pity untouched. Also fixed a pre-existing pack bug: leaving the pack screen <0.5s after tearing threw in the delayed reveal/hint timeouts.
- **2026-09-24** — Stack Garage integrated (NOT shipped - Alex said hold until he says so). stack-garage.html is the source of truth (from Downloads, patched: bridge save to P().garage, no top-up, Spin button, widebody wheels out to WIDE_OUT=.12, render pause, Trade tab). Runs in a same-origin srcdoc iframe from an inert text/plain block that sync-cards.js fills (script tags escaped as x-script), because its page-wide CSS/JS can't share the casino document. Trade: escrow + catalogue-validated parts (Na lookup, value capped per tier), garage* msgs via the casino net switch, garageLost refunds. Build grows to ~1.6MB.
- **2026-09-24** — The new Stack: ecosystem home (Big Three: Stack Sports hub, Stack Markets, Stack Cards; then Casino + Tables rows), one brand system (hex mark + Barlow Condensed italic wordmark, colour per platform) and a sidebar grouped by platform. Racing + Markets added as frame games by generalising the garage iframe host (FG registry + FrameBridges) rather than inlining - both are whole pages with page-wide CSS/ids.
- **2026-09-24** — Shipped the new Stack with the garage hidden (GARAGE_LIVE=false) and the telemetry notice gated on TELE_URL - Alex chose to hold both. Header coin now an engraved S with a ridged rim.
- **2026-09-24** — Frame-game audio bled across tabs (Racing + Markets kept playing hidden). Fixed from the host by wrapping AudioContext inside each frame with a master gain the host mutes, instead of patching each game's own sound code - works for any future frame game. Also dark thin scrollbars site-wide.
- **2026-09-24** — Stack GP (F1 betting) built from stack-gp-spec.md as a frame game under Stack Sports. One segment-level event sim is both the race on screen and the Monte Carlo (instead of the spec's full sim + separate lap model), so pricing can never drift from what you watch. Suspend selections seen <5 times or with fair price over the 501 cap - otherwise capped long shots return ~50%.
- **2026-09-25** — Stack League (NRL) built as a watchable frame game: tackle-by-tackle sim is both the match on screen and the Monte Carlo; each play is choreographed (scripted key actors + steering for the rest). Hidden day form was swapped for per-set luck because the MC knowing the form made favourites win 78%.
- **2026-09-25** — Stack League players teleported: KO/conversion snaps and scripted actors sent further than they could run. Fixed with a 10.5 m/s cap on scripted paths, nearest-player dummy half/kicker, and a jog-back lead-in before kick-offs (snaps only at half starts). Verified: 0 frames over 12 m/s across a full match.
- **2026-09-25** — Replaced the old 3-reel Slots with Dragon Stacks, a frame game (stack-slots.html) with Hold & Spin, pick-your-free-games, Dragon Wheel, envelopes, Dragon Breath wilds and a fair gamble. Frame game over inline: ~125KB of canvas/audio code with its own globals. Near misses kept real (dense pearls/lanterns + honest anticipation) rather than faked, per section 4.
- **2026-09-25** — Added Olympus Storm, a second slot in a different style (tumble/cluster, 6x5 scatter pays, Zeus multiplier orbs, accumulating free-spin multiplier, buy bonus at 115x). Frame game like Dragon Stacks. Independent per-cell draws rather than strips: tumble refills make strips meaningless.
- **2026-09-25** — Olympus Storm visual pass: Zeus rebuilt (anatomy, seeded hair/beard strands, cape, face detail, aura, eye glow, body lightning), layered sky (Olympus temple, islands + waterfalls, drifting cloud sprites, god rays, eagles, branching lightning), ornate temple frame with braziers, lapis grid, squash/dust/shockwave/shake/electric outlines. Cells shrank 112->104 to fit the pediment. Headless software render ~50fps.
- **2026-09-25** — Olympus Storm features: Zeus's Wrath, Hera's Blessing, Titan Battle (3 scatters), Temple of Gods (before free spins), Double Chance ante, Super/Epic buy tiers, Lightning Gamble. Retuned: pays x0.8, WF orbs 55->33, temple values kept small; every mode measured at ~97%. Titan attacks are EV-equal by construction so the pick is about swing, not skill.
- **2026-09-26** — Slot control bars: gamble buttons float above the bar (they used to push the win box off-screen), fixed-size controls never flex-shrink (spin button was squashing), compact bar under 1180px. Checked at 1060/1290/1500 wide.
- **2026-09-26** — Titan Battle arena now sizes to the stage height (was width-based, so short windows cut the top off and the buttons sat on the control bar). Checked at 1540x880, 1290x760, 1100x700.
- **2026-09-26** — Added Ra's Fortune (Egyptian, red + gold): coin collect, Sun of Ra, Coin Rain, Book of Ra free games, Pharaoh's Treasure hold & win with growing rows, two buys, coin-flip gamble. Built for hit frequency (1 in 2.1) because Alex finds Dragon Stacks slow and loves Olympus's frequent wins.
- **2026-09-26** — Ra's Fortune gamble: the flip animation ended on the wrong face (9 half-turns flipped it), so a Scarab result could land showing the Pharaoh. Payout was always right. Now 10 half-turns + the result, verified 30/30, and a LANDED line says what came up.
- **2026-09-26** — All three slots: bet ladder extended to 150/200/250/300 (max 300 a spin, Alex's ask). Ra's Fortune gamble: coin now always lands showing the result (was 9 half-turns, flipping it) + LANDED line; verified 30/30.
- **2026-09-26** — Admin line: admin portal reaches remote players without a party (own PeerJS id per account, 4 slots, token from ADMIN_PW), live balance every 2 s, grant as a delta, offline commands queued in S.admQ. Alex needed to manage his mate's balance mid-session outside a party.

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
