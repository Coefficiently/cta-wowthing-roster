Design plan (internal notes, not shipped):

Subject: a personal WoW character-roster dashboard for one player's raid-ready
alts. Audience is the player themselves + guildmates glancing at gear/currency
status. Job: scan progression at a glance, drill into one character's loadout.

Color (dark, stone-and-bronze — not Anthropic terracotta, not generic SaaS navy):
  --bg:      #16140f   (near-black warm charcoal, like weathered stone)
  --panel:   #1f1c15
  --panel-2: #262219
  --line:    #3a3427
  --ink:     #ece6d6   (warm parchment white)
  --ink-dim: #a89f89
  --gold:    #c99a44   (bronze/gold accent — crest/currency theme)
  --gold-2:  #e8c374
  quality colors are fixed by WoW convention (poor/common/uncommon/rare/epic/
  legendary) — used functionally as left-border accents on gear rows only.

Type: "Spectral" (serif, display) for character names / section headers —
evokes carved stone plaques / armory. "Inter" (sans) for body & data. No
monospace data tables (skill flags that as a tell).

Layout: single page. Top bar = roster title + warband gold + refresh time.
Below: a filter/sort strip, then a card grid (one card per qualifying
character: name, class·race·realm, level, ilvl badge). Clicking a card
expands an in-place detail panel (gear two-column armory layout, bag items,
currency trackers as small bars, lockout list) rather than navigating away —
keeps the "scan then drill in" job in one view.

Motion: one thing only — the detail panel expands/collapses with a height
transition. No hover-lift on every card.

Avoided: eyebrow all-caps labels, middle-dot meta strings dressed up, rounded
SaaS cards with identical shadows, →  arrows on buttons.
