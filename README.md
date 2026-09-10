# cta's Roster

A small static dashboard showing [WoWthing](https://wowthing.org/user/cta) character
data for level 90+ / item level 290+ characters: equipped gear, bag contents,
crest/catalyst/bonus-roll currencies, active lockouts, and gold.

## How it works

- `scripts/fetch_data.py` pulls the public WoWthing profile JSON, resolves item
  names, filters characters, and writes a compact `data.json`.
- `index.html` / `style.css` / `app.js` render `data.json` client-side — no
  build step, no framework.
- A GitHub Actions workflow (`.github/workflows/update-and-deploy.yml`) runs
  the fetch script every 3 hours, commits `data.json` if it changed, and
  deploys the site to GitHub Pages. WoWthing's API doesn't send CORS headers,
  so the browser can't fetch it directly — the scheduled commit is the
  workaround.

## Updating the tracked currencies

`scripts/fetch_data.py` hand-pins the currency IDs for crests, catalyst
charges, and bonus rolls (`CREST_IDS`, `CATALYST_IDS`, `BONUS_ROLL_IDS`) to
whatever the current season uses. When a new WoW season/patch changes these,
update the ID lists at the top of the script — look up the new IDs from
`https://wowthing.org/api/static-*.json` (`rawCurrencies`, matched by name).

## Local development

```
python3 scripts/fetch_data.py   # regenerate data.json
python3 -m http.server 8080     # serve the site locally
```

## Manually triggering a refresh

Actions tab → "Update roster data and deploy" → Run workflow.
