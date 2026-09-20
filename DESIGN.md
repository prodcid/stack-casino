# DESIGN.md — maths, research, reference

Background for Stack Casino. Read before changing any payout. Working rules live in `CLAUDE.md`.

---

## 1. RTP reference

Every figure below was verified by Monte Carlo against the live page code, not calculated on paper. Re-run with `node test.js rtp`.

### Single player

| Game | RTP | Odds of a win | Top prize |
|---|---|---|---|
| Blackjack (basic strategy) | 99.1% | — | — |
| Craps — Pass / Don't Pass | 98.6% | — | — |
| Craps — odds behind the point | 100% (no edge) | — | — |
| Plinko (all risk levels) | 99.0% | — | 170× |
| Dice | 99.0% | you set it | 9,900× |
| Limbo | 99.0% at any target | 99/target | 1,000,000× |
| Mines | 99.0% | — | ~25× |
| Hi-Lo | 99.0% per guess | — | — |
| Fortune Wheel | 98% low / 97% med+high | — | 29.1× |
| Skyline | **97.0% for every strategy** | — | unbounded |
| Tower | 97.0% at every floor | — | 3,973× (Nightmare) |
| Chicken Road | 97.0% at every lane | — | 210× (Insane) |
| Balloon Pump | 97.0% at any cash-out | — | — |
| Keno | 97.0% all pick counts | — | 1,000× |
| Roulette (European) | 97.3% | — | 35:1 |
| Slots | 96.7% | 66% of spins | 1,200× |
| Scratch (all 4 tickets) | 96.0% | ~1 in 3.4 | 30,000× |
| Video Poker | 97.3% perfect / 95.8% simple | — | 800× |
| Baccarat | Banker 98.9 / Player 98.8 / **Tie 85.6** | — | 8:1 |
| Craps prop bets | Any 7 **83.4%**, hard ways ~91% | — | 15:1 |

Tie and the prop bets are deliberately terrible — that's authentic, and they're labelled as sucker bets in the UI.

### Multiplayer
All zero-sum between players, **3% rake** at settlement. Exception below.

| Table | Notes |
|---|---|
| The Strip | 3% rake. Winner-takes-all on bankruptcy, else split on net worth |
| The Heist | 3% rake — **except both-steal, which returns 80%** (deliberate punishment, documented in-game) |
| The Run | 3% rake, winner takes pot |
| The Vault | 3% rake |
| Crash | 97% |
| Derby | 95% |
| Coin Duel | 98% (2% fee) |
| Hold'em | 2.5% rake, flop-seen pots only |
| MP Blackjack | vs the house, same as single-player |
| Strip side bets | fair odds (1.0 EV) — variance only, no drain |

---

## 2. The two payout patterns

**Escalating single-player games** (Skyline, Tower, Chicken Road, Mines, Balloon):
```
mult(k) = 0.97 / p^k          correct — edge applied once
mult(k) = (0.97 / p)^k        WRONG  — edge compounds every step
```
Check: `P(survive k) × mult(k)` must equal `0.97` for every k.

**Skyline with mixed jump types** — same idea, product form:
```
mult = 0.97 / (p1 × p2 × ... × pk)
```
Each successful jump multiplies the running multiplier by `1/p`. Because the edge is applied once at the start, RTP is exactly 97% for **any** mix of jumps, any wind, and any banking point. That's why the player's risk choice changes variance but never their return — which is the honest version of "pick your own style".

**Partial banking is RTP-neutral.** Banking half just stops gambling that half. No adjustment needed.

**Fat tails.** If one payout tier holds more than ~3% of total RTP at odds longer than 1-in-100k, the game *feels* worse than its stated RTP because that tier almost never pays. Trim the tail and push the return into frequent tiers. This is why several top prizes were cut (see `CLAUDE.md` decision log).

**Caps must not bind.** A payout cap that a real run can reach silently breaks the RTP promise. Skyline's worst case within 18 roofs is `0.97/0.31^18 ≈ 3.7e9`, so its cap sits at `1e10` where it can never trigger.

---

## 3. Scratch ticket research

Studied 20+ real ticket formats from the Texas, Florida, California, Montana, Maryland and South Carolina lotteries, including official game procedure documents.

### Game families
Crossword · Bingo · Key Number Match · Tic-Tac-Toe · Match 3 · Poker · Find Legend · Match Up.

### Staging — the thing worth stealing
The good tickets use **several play areas that feed each other**, not one big panel:

- **Classic Bingo** ($2, Texas): scratch the Caller's Card (28 numbers) → daub four bingo cards → separate Bonus Quick Win box.
- **Bonus Letter Crossword** (Florida): the bonus box yields **extra letters that go back into the puzzles** — one area changes another's outcome.
- **Xtreme Crossword** (Florida): two puzzles + an X Multiplier box (2×–20×) + an independent Fast Bonus side game.
- **Power 7s Crossword Tripler**: completing a word containing a "7" triples the legend prize.
- **Loteria Azul** ($5, Texas): 21-symbol Caller's Card → 5×5 playboard → separate bonus games. Up to six wins per ticket.

### Conventions worth keeping
- Every prize symbol carries a **caption** underneath — anti-fraud standard in every procedure doc.
- "**Only the highest prize won is paid**" per puzzle/card.
- The **multiplier box is always last** — that's the real "last lucky scratch" moment.
- Anatomy: game name → price flash → play areas under latex → tiny uppercase HOW TO PLAY per area → prize legend → odds in fine print.
- Real overall odds run **1 in 3 to 1 in 4**. Anything worse feels broken.

### Design principles (Scientific Games)
- Colour drives ~90% of the decision at retail.
- The biggest mistake is **overcrowding** — hierarchy should lead the eye to *how to play* and *what you can win*.
- Coating thickness and ink interaction determine how satisfying the scratch feels.

### Our four tickets

| Ticket | Format | Stages | Top |
|---|---|---|---|
| Crown Jewels | Key number match | Royal numbers → your 12 → the Crown multiplier | 30,000× |
| Deep Six | Bingo lines | Sonar sweep (12) → 4×4 card, auto-daub → treasure chest | 2,000× |
| Neon Strike | Three strikes + wild | Reveal wild → 3 rows of 3 → last lucky scratch | 36,000× |
| Golden Ticket | Classic match 3 | One stage | 10,000× |

All four: 96% RTP, ~1 in 3.4 odds.

**Implementation:** outcome is **predetermined** — roll the prize from a weighted table, then build the ticket to display exactly that result. Guarantees exact RTP no matter how complex the presentation, and it's how real tickets work. Deep Six constructs the daub set so the intended pattern is the only one present.

Sources: [Texas Classic Bingo](https://www.txbingo.org/export/sites/lottery/Documents/scratchoffs/2427procedures.pdf) · [Texas Loteria Azul](https://www.texaslottery.com/export/sites/lottery/Documents/scratchoffs/2765procedures.pdf) · [FL Bonus Letter Crossword](https://www.law.cornell.edu/regulations/florida/Fla-Admin-Code-Ann-R-53ER24-8) · [FL Xtreme Crossword](https://www.law.cornell.edu/regulations/florida/Fla-Admin-Code-Ann-R-53ER22-68) · [NE Power 7s Crossword Tripler](https://nelottery.com/homeapp/scratch/1226/0/gamedetail/web) · [California Scratchers](https://www.calottery.com/en/scratchers) · [Montana scratch games](https://montanalottery.com/scratch-games/) · [Scientific Games on ticket design](https://www.lotteryusa.com/news/exclusive-interview-scientific-games-science-of-scratch) · [Patent US10065105 — multiple play areas](https://patents.google.com/patent/US10065105)

---

## 4. Game maths detail

**Skyline** — base success and multiplier gain per jump (calm):

| Jump | p | gain |
|---|---|---|
| HOP | .92 | ×1.09 |
| JUMP | .78 | ×1.28 |
| LEAP | .58 | ×1.72 |
| SEND IT | .38 | ×2.63 |

Wind shifts p by **+.05 / 0 / −.07**, clamped to .12–.97. Multipliers recompute from the shifted p, so a headwind is riskier *and* pays more at identical RTP. 18 roofs max.

**Tower** — `p = (doors − traps) / doors`, `mult(k) = 0.97/p^k`.
Easy 1-in-4 × 9 floors (12.9×) · Med 1-in-3 × 9 (37.3×) · Hard 1-in-2 × 7 (124×) · Nightmare 3-in-4 × 6 (3,973×).

**Chicken Road** — `p` per lane: easy .92/20 lanes · med .84/16 · hard .72/12 · insane .55/9.

**Slots** — symbol weights `[30,24,18,12,8,5,3]`, 5 paylines, pays 2 and 3 in a row. Full-spin hit rate 66%.

**The Strip** — prices scale off the buy-in: `unit = ante/10`, start cash `0.7 × ante` each, pot seeded at `0.6 × ante`. Group prices 0.6–4.0 units, rents 0.06–0.56 units. Upgrades ×2.6/×5.4/×9.5, full colour set doubles rent (so max 19× base). Passing GO pays `0.8 units + 8% of book value`.

**The Heist** — stage 2 catch chances 5% / 28% / 58% for ×1.30 / ×1.75 / ×3.00. **Picking the same route as your mate multiplies the catch chance by 1.7** — that's what stops everyone just taking the roof every time, and makes it a real guessing game.

---

## 5. Testing approach

`test.js` drives a real browser. What it actually proves:

1. **Console errors** — any uncaught page error fails the run.
2. **Every game reaches settlement** — not just "renders without throwing".
3. **Hidden information doesn't leak** — inspects the data the guest page actually received, so it catches real cheating bugs.
4. **Money conservation** — The Strip is audited every turn; a leak fails immediately with the turn number.
5. **Rake is exact** — settlement compared against `stake × 0.03` to the cent.
6. **RTP** — runs the page's own generators millions of times. Per-game tolerances, because fat-tailed games swing even at millions of samples.

Bugs this has actually caught: craps double-charging persistent line bets, a payout cap silently breaking Skyline's RTP, `skBuild()` never being called so the HUD didn't exist, and a game-switch lock counting already-settled bets.
