# Current Roster

A small static dashboard showing [WoWthing](https://wowthing.org/user/cta)
character data for level 90+ / item level 290+ characters, laid out
AlterEgo-style with characters as columns: realm/faction/race, item level
(color-coded low-to-high), Mythic+ rating/current keystone/per-dungeon
scores, weekly Great Vault status (raid/dungeon/world), professions, crest
and other tracked currencies, and a raid boss-kill grid by difficulty.
Clicking a character opens their full equipped gear list, with Wowhead
tooltips (icon, live stats, everything) on hover.

Bag/inventory contents are intentionally not shown -- wowthing's public API
never includes them for any account (confirmed in their own backend source:
the public item query only includes equipped bag containers and a small
hardcoded set of currency/progress items, never general loose items). That's
a hard restriction on their end, not a privacy setting the account owner can
toggle, so there's nothing to fetch here.

## How it works

- `scripts/fetch_data.py` pulls the public WoWthing profile JSON, resolves
  item/enchant/gem names, decodes gear upgrade tracks and tier-set pieces,
  filters characters, and writes a compact `data.json`.
- `index.html` / `style.css` / `app.js` render `data.json` client-side — no
  build step, no framework. Item/gem/currency links use Wowhead's own
  tooltip widget (`wow.zamimg.com/widgets/power.js`) for icons and live
  stats rather than us computing or hosting either ourselves.
- A GitHub Actions workflow (`.github/workflows/update-and-deploy.yml`) runs
  the fetch script every 3 hours, commits `data.json` if it changed, and
  deploys the site to GitHub Pages. WoWthing's API doesn't send CORS
  headers, so the browser can't fetch it directly — the scheduled commit is
  the workaround.

## Refreshing data

Two different things, easy to conflate:

- The in-page **Refresh** button just re-fetches the already-generated
  `data.json` — useful if the scheduled Action already ran since you last
  loaded the page, but it does not talk to wowthing.org.
- To actually re-scrape wowthing.org on demand: Actions tab → "Update
  roster data and deploy" → Run workflow. This is the only thing that can
  trigger a real scrape; a public page can't safely do it itself without
  embedding a GitHub token client-side.

## Maintenance: hand-pinned, season-specific constants

wowthing's data doesn't cleanly expose "what's current" for several things,
and in a few cases multiple ids/values share the exact same display name
across seasons (see the code comments at each constant for how each one was
verified against real data, not just a name match). All of these live at
or near the top of `scripts/fetch_data.py` and need bumping periodically:

| Constant | Update when | How |
|---|---|---|
| `CREST_IDS` | New season adds a new crest tier | Look up in `.../api/static-*.json` `rawCurrencies`, matched by name |
| `CREST_MAX_OVERRIDE` | Every Tuesday reset | +100/week per tier from season start; Myth is always 100 less than the rest |
| `CATALYST_IDS`, `BONUS_ROLL_IDS` | New season renames/replaces these | Same as `CREST_IDS` — verify against a real known value, not just name |
| `MYTHIC_PLUS_SEASON_ID`, `MYTHIC_PLUS_DUNGEONS` | New M+ season | Season id from wowthing's `seasonMap`; dungeon map ids from the matching `order...` array |
| `CURRENT_SEASON_BONUS_GROUPS` | New season (usually with new M+ season) | wowthing's `seasonItemBonusListGroups`; wrong groups here silently produce correct-looking but wrong item levels |
| `TIER_SET_BY_CLASS` | New raid tier | wowthing's `currentTier` array in `data/gear.ts` |
| `CURRENT_EXPANSION_INDEX` | New expansion launch (rare) | Increment by 1 |
| `RAID_DIFFICULTY_FORCE` | New small/single-difficulty raid appears | Self-correcting if wrong — see the comment at the constant |

## Local development

```
python3 scripts/fetch_data.py   # regenerate data.json
python3 -m http.server 8080     # serve the site locally
```
