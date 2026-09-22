# Stack Clash: game design spec

A lane-based battle card game built on top of the existing **Stack Cards** collection (`stack-cards.html`). Players build decks from the cards they've pulled from packs and battle an AI opponent or a friend.

This spec covers the rules, the card data changes, the game modes and how collecting feeds into the game. The existing pack opening, binder and card art stay as they are. The battle game is a new section of the same app.

---

## 1. The game in one paragraph

Each player has **6 crystals**. Both players place creatures into **3 lanes**, and each creature fights the enemy directly across from it. Knocking out an enemy creature shatters some of the opponent's crystals. The first player to shatter all 6 of the opponent's crystals wins. Energy goes up each turn, so games start with small baby creatures and build up to big final evolutions. You evolve by **stacking** the next stage on top of a creature already in play, and stacked creatures hit harder. After attacking, you can risk a **dice roll** for bonus damage.

---

## 2. Card data changes

Every creature card needs three stats plus a type and a trait. The existing `energy cost` (1, 2 or 3 by stage) stays.

### Stats
| Stage | Attack | Health | Energy cost | Crystals lost when knocked out |
|---|---|---|---|---|
| Baby (stage 1) | 2 | 4 | 1 | 1 |
| Teen (stage 2) | 4 | 7 | 2 | 2 |
| Final (stage 3) | 6 | 10 | 3 | 3 |

These are baselines. Each creature line can shift them by ±1 to suit its trait (a tanky golem trades 1 attack for 1 health, a glass-cannon phoenix does the opposite).

**Rarity never changes stats.** The Holo, Full Art, SIR and Mono Rare versions of a final all have the same stats as each other. Rarity is cosmetic only (see section 8).

### Types
There are 8 types. A type advantage adds **+2 damage**.

| Type | Creature lines | Strong against |
|---|---|---|
| Flame | Fox, Red dragon, Phoenix | Verdant, Frost |
| Tide | Serpent, Koi, Anglerfish, Pufferfish, Jellyfish, Slime | Flame, Stone |
| Verdant | Green dragon, Moth, Sprout knight, Tiger | Tide, Stone |
| Stone | Turtle, Golem, Gem dragon | Flame, Storm |
| Storm | Storm wolf, Sky serpent | Tide, Frost |
| Frost | Hare, Yeti | Verdant, Storm |
| Shadow | Cat, Ghost, Owl | Light |
| Light | Lion, Stag | Shadow |

Use each line's existing card hue for its type colour in the UI.

### Traits
Each creature line has one special power that applies at every stage.

| Line | Trait | Effect |
|---|---|---|
| Fox | Kindle | At the start of your turn, deal 1 damage to the enemy in this lane |
| Serpent | Undertow | Once per turn, swap this creature with one of your others |
| Lion | Pride | +1 attack for each other creature you have in play |
| Owl | Foresight | When played, look at the top card of your deck; you may put it on the bottom |
| Hare | Chill | Enemies hit by this creature deal 1 less damage next turn |
| Green dragon | Regrow | Heals 2 at the start of your turn |
| Red dragon | Scorch | Its attacks also deal 1 damage to enemies in the neighbouring lanes |
| Storm wolf | Surge | Dice rolls of 5 also count as a double |
| Turtle | Shell | Takes 1 less damage from every hit |
| Moth | Metamorph | After 2 turns in play, evolves for free if you hold its next stage |
| Cat | Pounce | Can attack the turn it's played |
| Stag | Guide | When played, search your deck for a baby and add it to your hand |
| Phoenix | Rebirth | When knocked out, flip a coin: heads, return it to your hand |
| Sky serpent | Gust | Once per game, move an enemy creature to an empty lane |
| Gem dragon | Refract | The first hit it takes each turn deals 0 damage |
| Tiger | Ferocity | +2 attack against creatures that are already damaged |
| Golem | Bulwark | Enemy creatures can't attack past this lane into your crystals |
| Yeti | Avalanche | When it evolves, deal 2 damage to the enemy across |
| Sprout knight | Thorns | Creatures that attack it take 1 damage |
| Koi | Ascend | +3 attack while it has 2 cards stacked under it |
| Anglerfish | Lure | When played, pull an enemy creature into the lane across from it |
| Pufferfish | Spines | Attackers take 2 damage, but it has 1 less attack |
| Slime | Split | When knocked out, leave a 1/1 Blob in its lane (Blob loses no crystals) |
| Jellyfish | Sting | The enemy it hits skips its next attack on a coin flip |
| Ghost | Phase | The first attack against it each game misses on a coin flip |

---

## 3. Rules

### Setup
- Each player brings a **20-card deck** (see section 5).
- Each player starts with **6 crystals**.
- Shuffle both decks. Each player draws **4 cards**.
- **Opening hand guarantee:** every opening hand contains at least one baby. If a player draws none, reshuffle and redraw automatically.
- **One mulligan:** each player may shuffle their opening hand back once and draw a new 4.
- A coin flip decides who goes first. The player going second draws 1 extra card on their first turn.

### Turn order
1. **Gain energy.** Maximum energy goes up by 1 (starting at 1, capped at 6). Refill to the maximum. Unused energy does **not** carry over.
2. **Draw 1 card.**
3. **Play cards** in any order, as long as you have the energy:
   - Place a **baby** into an empty lane in your row.
   - **Evolve** a creature by placing its next stage on top of it.
   - Play a **Trick** (phase 2).
   - **Swap a card:** once per turn, pay 1 energy to put a card from your hand on the bottom of your deck and draw a new one.
4. **Attack.** Each of your creatures may attack once, in any order you choose.
5. **End of turn.** If you hold more than **7 cards**, discard down to 7.

### Placing and evolving (stacking)
- Only **babies** can be placed into an empty lane.
- A **teen** can only go on top of its own baby. A **final** can only go on top of its own teen.
- Evolving costs the new card's energy cost.
- The evolved creature uses the new card's stats and is fully healed.
- **Stack bonus:** +1 attack for each card underneath. A full stack (final on teen on baby) gets **+2 attack**.
- A creature placed **this turn can't attack** (except the Cat's Pounce). Evolving a creature that was already in play does **not** stop it attacking.

### Attacking
- A creature attacks the enemy creature **directly across** from it.
- Damage = attack + stack bonus + type advantage (if any) + traits.
- Damage stays on a creature until it's knocked out or evolves.
- **Empty lane:** if there's no enemy across, the attack hits the opponent directly and shatters **1 crystal**.
- **Knockout:** when a creature's health reaches 0, it's removed, along with every card stacked under it, into its owner's discard pile. The owner loses crystals by the top card's stage: baby 1, teen 2, final 3.

### Dice roll (optional risk)
After a creature's attack resolves, its player may roll one six-sided die for bonus damage against the same target:
- **1:** backfire. No bonus, and the attacking creature takes 1 damage.
- **2 to 5:** add that much damage.
- **6:** double the attack's damage.

Only one roll per creature per turn. Show a large animated die in the middle of the screen.

### Winning
- A player wins the moment the opponent has **0 crystals**.
- If a player has to draw from an empty deck, they lose 1 crystal instead.

---

## 4. Collecting feeds into battle

These bonuses reward collecting, but they're deliberately small so a smarter deck can still beat a bigger collection.

- **Bond:** if your deck contains the baby, teen and final of the same line, evolving that line costs **1 less energy** (minimum 1).
- **Mastery:** every creature line earns Mastery XP when you play it in battle. Winning earns more.
  - **Level 1:** alternate card art.
  - **Level 2:** an **Awakened power**, a second ability usable once per game. Examples: the Fox's whole row gains Kindle for one turn; the Golem can't be damaged for one turn.
  - **Level 3:** animated card and gold border.
- **Legend:** once you own **all 5 cards** of a line (baby, teen, holo final, Full Art, SIR, plus the Mono Rare for dragons), that line can be set as your deck's **Champion**. The Champion's final starts each game in your hand and has **+2 health**.

---

## 5. Deck building

- **20 cards** per deck.
- Up to **2 copies** of any single card.
- You can only use cards you **own** in your binder.
- Different rarities of the same final (Holo, Full Art, SIR, Mono Rare) count as the same card for the copy limit. Players choose which version shows.
- Save up to **5 decks** with a name and a cover card.
- The deck builder shows an **energy curve** (how many cards at each cost), counts babies and warns if the deck has fewer than 6 babies.
- Provide a **starter deck** for new players so they can play before collecting.

---

## 6. Game modes

### Phase 1 (MVP)
- **Vs AI:** play against the computer with your saved deck.
  - **Easy:** plays random legal moves.
  - **Normal:** simple rules. Prefer trades it wins, attack empty lanes, protect finals, evolve when possible, roll the dice only when a knockout is possible.
  - **Hard:** looks one turn ahead and uses dice-roll odds.
- **Pass-and-play:** two players on one device. The screen hides the next player's hand until they tap "Ready".

### Phase 2
- **The Gauntlet (solo roguelike run):** start with a 10-card deck and climb an 8-step map of fights, card rewards, shops and rest stops. The top of the map is a **boss**: one of the final creatures with a special rule (Infernax burns the whole board each turn; Spectrevail makes the first attack each turn miss). Winning gives packs and a run badge.
- **Daily Puzzle:** a set board and hand with the goal "Win this turn". Tracks a daily streak.
- **Draft (vs a friend):** both players open the same seeded packs, pick cards alternately and play with what they drafted.

### Phase 3
- **Online vs a friend:** start with **share codes** (copy and paste the game state after each turn, no server needed). Real-time play would need a small backend such as Firebase or Supabase.
- **Co-op raid:** two players against one giant boss.

---

## 7. Screens

1. **Battle menu:** Vs AI (with difficulty), Pass-and-play, Deck builder.
2. **Deck builder:** binder grid on one side, current deck list on the other, energy curve, save button.
3. **Battle board** (portrait, phone-first):
   - Top: opponent's crystals and hand count.
   - Opponent's 3 lanes.
   - Your 3 lanes.
   - Your crystals, energy dots and End Turn button.
   - Your hand along the bottom; drag cards onto lanes to play them.
   - Tap any card to inspect it with the existing tilt and spin viewer.
4. **Results screen:** win or lose, rewards, Mastery XP bars.

Stacked creatures should visibly show the cards underneath them, offset slightly, with a "+1 stack" or "+2 stack" tag.

A working visual mockup of one turn exists in `stack-cards-battle-mockup.html` and shows the intended layout and flow.

---

## 8. Rewards and cosmetics

- **Finisher animations:** when a Full Art, SIR or Mono Rare card lands a knockout, play a short cinematic. These knockouts earn **Style points**.
- Style points buy cosmetics: card backs, playmats (the SIR scene art), dice skins and board effects.
- Wins in Vs AI and the Gauntlet reward packs for the existing pack opening screen.

---

## 9. Technical notes

- Keep everything in the existing single HTML file approach, reusing the current card data (`SET`, `LINES`), card rendering (`cardEl`) and art system.
- Add the new stats, type and trait to each entry in `LINES` so all stages and rarities share them.
- Saving goes through the existing `StackBridge` (`load` / `save`). Store decks, Mastery XP and Style points alongside the collection.
- **Performance lessons already learned:**
  - Keep card art as pre-rendered images (the current `artImg` approach). Live SVG filters lag badly on phones.
  - The iPhone Claude app blocks `blob:` image URLs, which is why art uses data URLs with an inline-SVG fallback. Keep that.
  - Avoid `-webkit-text-stroke` on the Outfit font; it draws artefacts inside letters on iOS Safari.
- Match the existing visual style: Stack navy background, Stack green (`#00e701`) accents, Outfit font.

---

## 10. Build order

1. Add stats, types and traits to all 25 creature lines.
2. Deck builder with a starter deck.
3. Battle engine (rules in section 3) with pass-and-play.
4. Normal AI, then Easy and Hard.
5. Bond, Mastery and Legend bonuses.
6. Results screen and pack rewards.
7. Phase 2 modes.
