# Stack GP — Build Spec

Build **Stack GP**, a Formula-style motor racing betting game for the Stack ecosystem. It sits alongside Stack Racing (horses), Stack Cases, Stack Markets and Stack Garage. You watch a simulated Grand Prix from a TV-broadcast-style camera and bet on it before and during the race, with odds that swing as the race unfolds.

The two things that matter most:
1. **It has to be fun to watch.** The race should look like a TV broadcast: battles, overtakes, pit stops, safety cars, a timing tower and commentary.
2. **Stack branding everywhere.** Every car livery, every trackside board, the kerbs, the gantries and the pit wall all advertise Stack products. It should feel like Stack owns the sport.

---

## 1. Hard rules (same as every Stack game)

- **One self-contained HTML file** (`stack-gp.html`). All JS, CSS, art and sound inline. No external requests at runtime. If you use a library, bundle and inline it.
- **Fake currency.** Start balance $1,000. A **Top up** button adds $1,000. Balance and history saved in `localStorage` under `stackGP.v1`.
- **Shared wallet hook.** If `window.StackBridge` exists, use `StackBridge.getBalance()`, `StackBridge.spend(n)` and `StackBridge.credit(n)` instead of the local balance.
- **Honest odds.** Every price comes from Monte Carlo runs of the *exact same* simulation the race uses, priced so bets return **97% on average**. There are no hidden rigs and no near-miss tricks. The sim alone decides the result.
- **Phone first.** The main player is on an iPhone inside the Claude app, and it must also work on desktop.
  - Use `pointerdown` handlers on anything inside a list that re-renders, so taps never get eaten by a re-render.
  - Use `dataURL` images only. `blob:` URLs are blocked in the iPhone Claude app.
  - Don't use `-webkit-text-stroke`.
  - No horizontal page scroll at 393px width. Use `minmax(0,1fr)` grid columns.
- **Memory safe.** Cache and reuse every generated graphic (car sprites, decals, textures). Never rebuild them every frame or on every bet. If you use WebGL, use one context only and handle `webglcontextlost` / `webglcontextrestored`.
- **Style matches Stack.** Dark navy background (`#0f1923`), panels `#1a2633`, accent green `#00e701`, white bold type, rounded cards. Header has "Stack **GP**", the balance and the Top up button.

---

## 2. Rendering approach

Use **2D canvas, top-down broadcast view**, not 3D. It runs reliably on iPhone, looks sharp, and matches Stack Racing.

- **The camera** zooms and pans to follow the action. It is not a static full-track map.
  - By default it follows the lead battle.
  - It auto-cuts to any fight within 0.6s, a pit stop, a crash or the safety car.
  - It smooths relative to the followed car so it never lags or jitters. Interpolate car positions between sim steps and point the camera at the interpolated positions, never at the next sim step. We hit this jitter bug in Stack Racing.
- **Zoom** is close enough that cars are about 60–90px long on a phone, so liveries and sponsor decals are readable.
- **Mini-map** in a corner shows the full circuit with coloured dots. Your bets' cars are highlighted.
- **Camera buttons:** Leader battle, Follow my car, Onboard (tight zoom, rotates with the car), and Full track.
- **TV frame on top of the canvas:**
  - Top-left: lap counter ("LAP 7/15").
  - Left: timing tower (position, 3-letter driver code, team colour chip, gap to leader or interval, tyre compound icon with age, pit-stop count, DRS indicator).
  - Top-right: live flags banner (green, yellow, SC, VSC, chequered).

---

## 3. The circuit

Tracks are built from a **centreline spline** (Catmull-Rom through hand-placed points), with track width about 12–14m in sim units. Draw from the spline:

- **Tarmac** with subtle texture, a racing line (darker rubbered strip) and skid marks at braking zones.
- **Kerbs** at every apex and exit: alternating Stack green and white blocks. On the big kerbs, repeat a small **STACK** wordmark along them.
- **Run-off areas:** tarmac run-off painted with huge Stack logos (like real painted run-off ads) and gravel traps in a sandy texture.
- **Tyre walls and barriers:** barriers wrapped in sponsor banners. Tyre stacks have coloured bands.
- **Grandstands** at key corners: blocks of crowd dots with the odd flag.
- **Start/finish straight:** a big overhead **gantry** (drawn as a band across the track) with STACK GP branding, start lights and a timing board. It has a pit lane with a pit wall, **10 team garages** (each with its team colour and sponsor) and a pit speed-limit line.
- **DRS zones:** marked detection line and activation line, with "DRS" painted on the tarmac.
- **Sector markers:** 3 sectors.

Build **4–6 fictional circuits** for a season, each with its own shape and character. Suggested:

| Circuit | Character |
|---|---|
| Capital Circuit (Canberra) | Flowing, fast sweepers around a lake |
| Stack Park Street Circuit | Tight 90° corners, walls everywhere, safety cars likely |
| Molonglo Ring | Classic high-speed, long straights, lots of DRS passing |
| Harbour Night GP | Night race, floodlights, darker palette with lit boards |
| Outback Raceway | Desert, dusty run-off, high tyre wear |
| Alpine Hillclimb Circuit | Elevation shown with shading, a big hairpin |

Each circuit has stats that feed the sim: overtaking difficulty, tyre wear, safety car likelihood, pit lane time loss, lap distance and number of laps (10–16 laps so a race lasts about 3–5 minutes at 1x).

---

## 4. Stack advertising (make it everywhere)

Build a **sponsor library** of about 15 advertisers, drawn procedurally as logos and wordmarks on canvas. Cache each as an image and reuse it.

**Stack brands (the main ones):**
- **STACK** (the main green wordmark)
- **Stack Cases** (crate icon)
- **Stack Markets** (with a live-looking ticker: "STKM ▲ 2.4%")
- **Stack Racing** (horse head icon)
- **Stack Garage** (spanner icon)
- **Stack Cards** (card fan icon)
- **Stack Casino** (chip icon)
- **Stack Parts Co.** (gear icon)
- **Stack GP** (chequered flag icon)

**A few fictional non-Stack sponsors** for variety. Don't use real brands:
- Capital Energy Drink
- Molonglo Mining
- Ridgeway Freight
- Brindabella Water
- Velocity Tyres (the official tyre supplier)
- Nightline Watches

**Where the ads go:**
- **Cars:**
  - Main sponsor on the sidepods and engine cover.
  - Secondary sponsors on the front wing endplates, rear wing and nose.
  - Driver number on the nose and engine cover.
  - "Velocity" on tyre sidewalls (as text or a coloured stripe per compound).
- **Track:** barrier banners on every straight, painted run-off logos, kerb wordmarks, the start/finish gantry, grandstand fronts, marshal posts, the pit wall and garage fronts.
- **Broadcast graphics:**
  - "Stack Markets Fastest Lap", "Stack Cases Overtake of the Race" and "Stack Garage Pit Stop Challenge" as sponsored TV graphics.
  - A rotating sponsor bug in the corner.
- **Rotating boards:** some trackside boards cycle between ads every few seconds, like LED perimeter boards.

---

## 5. Teams, drivers and cars

**10 fictional teams, 2 drivers each (20 cars).** Each team is title-sponsored:

| Team | Livery |
|---|---|
| Stack Cases Racing | Blue with orange, crate-stencil graphics |
| Stack Markets F1 Team | Black and green, candlestick-chart stripes along the sidepods |
| Stack Racing Thoroughbred GP | Green and gold |
| Stack Garage Motorsport | Gunmetal with red, with bolt and rivet details |
| Stack Casino Royale | Red and black, playing-chip pattern |
| Stack Cards Holo Racing | Holographic purple-cyan gradient |
| Capital Energy Racing | Yellow and black |
| Molonglo Mining Works | Copper and charcoal |
| Ridgeway Freight Racing | White and navy |
| Nightline Hypercar | Midnight purple |

**Car art:** draw each car procedurally top-down and cache it as an image per team:
- Long nose, front wing with endplates, halo, cockpit and helmet in the driver's colour.
- Sidepods, engine cover with shark fin, rear wing, four exposed wheels with compound-coloured tyre stripes.
- Mirrors, number, sponsor decals, and a highlight and shadow for depth.

**Car effects:**
- Wheels visibly steer.
- Brake glow on the discs in heavy braking.
- A spark trail under cars at high speed on bumpy sections.
- The rain light blinks under the Safety Car.
- A DRS flap animation when DRS is open.
- Dirty-air ripple particles behind cars.
- Tyre smoke on lock-ups.
- Debris and a spin animation on crashes.

**Drivers:** fictional names with a 3-letter code, nationality flag, team colour and ratings:
- Pace
- Racecraft (overtaking and defending)
- Consistency (mistake rate)
- Tyre management
- Wet skill
- Aggression

Keep a small persistent career record per driver: wins, podiums, poles, DNFs.

**Car ratings per team:** straight-line speed, cornering, reliability, pit crew speed.

---

## 6. The simulation

Simulate on a fixed timestep (for example 0.1s of race time). Each car has a distance along the lap spline, a lateral offset (for side-by-side racing) and a speed.

**Pace model:**
- Target speed at each point comes from the circuit's speed profile (fast on straights, slow at corners), scaled by car cornering, straight-line speed and driver pace.
- Small per-lap random variation.
- A slowly varying "form" wobble so drivers have good and bad spells.

**Tyres:** Soft, Medium and Hard compounds (plus Inter/Wet if rain is on).
- Softs are fastest but wear quickest.
- Grip falls off with tyre age, and there's a "cliff" when a tyre is spent.
- Driver tyre management and the circuit's wear rate change how fast they wear.

**Fuel:** cars get slightly faster as fuel burns off.

**Dirty air:** following within about 1s costs cornering speed and adds tyre wear, so passing isn't free.

**DRS:** within 1s at the detection line gives a straight-line boost in the zone.

**Overtaking:**
- When a faster car is close behind, each corner or straight gives an overtake attempt.
- The chance depends on the pace difference, DRS, attacker racecraft against defender racecraft, and circuit difficulty.
- An attempt can end as:
  - a clean pass
  - side by side through the next corner (show it)
  - a failed attempt that loses time
  - rarely, contact: front wing damage (slower, and forces a pit stop) or a crash (DNF)

**Mistakes:** lock-ups, running wide and spins at a low rate scaled by consistency, aggression, wet weather and tyre wear.

**Reliability:** a small chance per lap of engine or gearbox failure (smoke, then the car pulls off).

**Pit stops:**
- Each car has a strategy chosen before the race (1-stop or 2-stop, and which compounds), with some randomness and reactive stops (damage, or cheap stops under the safety car).
- A stop means lap time lost in the pit lane plus stationary time from pit crew speed, with random variance.
- A rare slow stop (wheel-gun problem, 5–10s) is a big moment.
- Show the car pulling into its branded garage box with the crew around it and a stop timer ("2.3s" in green, or red if slow).

**Safety car:**
- Triggered by crashes or debris.
- The field bunches up behind a Stack-branded safety car (with a green light bar) and pits happen cheaply.
- Restart on a later lap.
- VSC is a lighter version that slows everyone but doesn't bunch them.

**Weather (optional per race):** a chance of rain mid-race, bringing a scramble for Inters and chaos.

**Start:** 5 red lights, then lights out. Grid launches vary with reaction time and driver consistency. There's a first-corner squeeze with a higher contact chance.

**Finish:** a chequered flag waves on the gantry. Record exact crossing times. If the gap is under 0.05s, show a photo finish.

**Calibration targets.** Tune these with a Node test harness running thousands of races:
- The pole sitter wins about 35–45% of races.
- The favourite by pre-race price wins about 30–40%.
- About 15–30 on-track position changes per race.
- A safety car in about 30–60% of races, depending on the circuit.
- 0–3 DNFs per race on average.
- A typical winning margin of 1–8 seconds. Close finishes should happen sometimes.

---

## 7. Qualifying (short and punchy)

Before each race, run a **quick qualifying shootout**:
- Each car sets one hot lap, shown as a leaderboard building up with sector times.
- Colour the sector times: purple for fastest overall, green for a personal best, yellow for slower.
- Show the last few drivers' laps live on camera.
- It takes about 30–45 seconds, with a skip button.
- The result sets the grid.
- Bets on **pole position** close before qualifying starts.

---

## 8. Betting

**Pre-race markets** (open after qualifying, closed at lights out):
- Race winner
- Podium finish (top 3)
- Points finish (top 10)
- Head-to-head: any driver against their teammate, plus featured matchups
- Fastest lap
- Safety car: yes or no
- Number of classified finishers (over/under)
- Winning margin band (<1s, 1–5s, 5–10s, 10s+)
- First retirement
- Winning team

**In-race (live) markets:**
- Race winner at live odds
- Top 3 at live odds
- Next pit stopper among the top 5
- Tapping a live price **pauses the race**, reprices from the exact current state (fresh Monte Carlo of about 300 sims), shows the stake panel, then resumes.
- Suspend live markets on the final lap and while the safety car is deploying.
- Never take a bet at a stale price.

**Pricing:**
- Price = floor(0.97 / p, to 2 decimals).
- Smooth p with (wins + 0.5) / (n + 1).
- Suspend any selection whose price would round below 1.02.
- Cap at $501.
- Pre-race pricing runs about 1,500–2,500 sims time-sliced in the background with a "Pricing the field… 60%" progress bar. Show prices only once they're final so they never drift after the player taps them.
- Keep the Monte Carlo fast by using a cheaper lap-level version of the same model (per-lap pace, tyres, pit stops, overtake and safety car rolls). Verify in Node that it gives the same result distribution as the full sim.

**Bet slip:**
- Tap any price to add it.
- A stake box you can type into, plus $5/$10/$25/$50/$100/$250 chips.
- The return updates live as you type.
- Show the total stake and potential return.
- Settle bets instantly at the flag.

**Verification.** Include a Node harness that proves each market type returns 97% ± noise across 1,000+ simulated races.

---

## 9. Commentary

A text commentary line under the canvas, with a small history log. Calls are generated only from real sim events and include your-bet callouts ("that's your driver!"):

- "Lights out and away we go!"
- "Great launch from [driver], up to P3."
- "[driver] locks up into Turn 1!"
- "DRS open for [driver]… he's alongside… and he's through!"
- "Side by side through Turns 4 and 5!"
- "Contact! Front wing damage for [driver]."
- "Safety car! Safety car!"
- "Big moment in the pits, a slow stop for [driver], 7.8 seconds."
- "[driver] sets the fastest lap, purple in all three sectors."
- "Smoke from the back of the [team]! That's a retirement."
- "Final lap! [driver] leads by 0.8s…"
- "[driver] wins the [GP name]!"

Pace the calls with a minimum gap between them, apart from urgent ones.

---

## 10. Sound (WebAudio, no files)

Start sound on the first tap. Include a mute button.

- **Engine note:** a sawtooth or pulse whose pitch follows the followed car's speed and gear. Downshift blips on braking. Louder when the camera is close.
- **Doppler whoosh** when cars pass the camera.
- **Start:** 5 light beeps, then a roar at lights out.
- **Crowd:** noise that swells at overtakes and the finish.
- **Pit stop:** a rapid wheel-gun rattle.
- **Warnings:** a warning tone for the safety car, and a crash crunch.
- **Chequered flag:** a win chime if your bet lands.

---

## 11. Screens and layout

1. **Race weekend hub:**
   - Circuit card with a track-shape thumbnail, GP name, laps, weather and the circuit's traits.
   - Championship standings (drivers and teams).
   - Buttons for Qualifying, then Race.
2. **Qualifying:** the viewer plus the building leaderboard.
3. **Race:**
   - The viewer (with camera modes, speed 1x/2x/4x, skip to result) and the commentary line.
   - Below the viewer: a **live timing tower** list with a live price and Back button per driver, plus **Your bets** with a live "if it finishes now" payout.
   - On desktop, bets go in a side panel.
4. **Result:**
   - A podium celebration (the top 3 cars on a podium graphic with champagne spray particles and Stack-branded boards behind).
   - Full classification with gaps, fastest lap and DNFs.
   - Your bets settled, with profit or loss.
   - Championship points updated.
   - A "Next GP" button.
5. **Season:** 6 races, a championship table, and a season-end trophy screen.

Also include:
- A "How it works" panel explaining tyres, DRS, safety cars and how the odds are calculated.
- A history of your last 30 bets with net profit or loss.

---

## 12. Quality bar

- **Frame rate:** a steady 60fps on a recent iPhone. Precompute the track (render the static circuit, boards and grandstands once to an offscreen canvas at a few zoom levels, or as tiles). Only cars, particles and rotating boards are drawn per frame.
- **Readability:** cars must be readable on a phone, with visible sponsor decals and tyre stripes.
- **No jitter:** the camera follows interpolated positions.
- **Stable memory:** no memory growth across 10 races in a row. Verify in a test.
- **Tests:** Playwright screenshots at 393×852 and 1280×860 for the hub, qualifying, race start, a mid-race battle, a pit stop, the safety car, the result and podium, and the bet slip. There should be no console errors.
- **Node checks:**
  - The calibration targets in section 6.
  - 97% return per market.
  - The lap-level Monte Carlo matches the full sim.

---

## 13. Build order

1. Track spline, track rendering and the sponsor/decal library. Get this looking great first.
2. Car art and team liveries, with a showcase screen of all 10 cars.
3. The sim (full and lap-level), with the Node calibration harness.
4. The race viewer: camera, timing tower, mini-map, flags and commentary.
5. Qualifying.
6. Betting: pre-race markets, live markets, bet slip and settlement, plus the 97% verification.
7. The podium and results screen, the championship season, and persistence.
8. Sound, polish, particles and the Playwright tests.
