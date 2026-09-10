# Current Roster

Personal dashboard: pulls [wowthing.org/user/cta](https://wowthing.org/user/cta),
writes `data.json`, deployed to GitHub Pages. Level 90+ / ilvl 290+ characters only.

## Commands

```
python3 scripts/fetch_data.py   # regenerate data.json
python3 -m http.server 8080     # serve locally
```

Manual re-scrape: Actions tab -> "Update roster data and deploy" -> Run workflow.
(The in-page Refresh button only re-fetches `data.json`; it doesn't re-scrape wowthing.)

## Season-specific constants (scripts/fetch_data.py) -- bump these when stale

| Constant | Update when | How |
|---|---|---|
| `CREST_IDS` | New crest tier | `rawCurrencies` in `.../api/static-*.json`, match by name |
| `CATALYST_IDS`, `BONUS_ROLL_IDS` | New season renames these | Same, but verify against a real known value -- duplicate-name ids happen (see code comments) |
| `MYTHIC_PLUS_SEASON_ID`, `MYTHIC_PLUS_DUNGEONS` | New M+ season | wowthing's `seasonMap` / matching `order...` array |
| `CURRENT_SEASON_BONUS_GROUPS` | New season | wowthing's `seasonItemBonusListGroups` |
| `TIER_SET_BY_CLASS` | New raid tier | wowthing's `currentTier` in `data/gear.ts` |
| `CURRENT_EXPANSION_INDEX` | New expansion | +1 |
