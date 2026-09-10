#!/usr/bin/env python3
"""
Fetches WoWthing profile data for a given account and produces a compact
data.json consumed by the static site.
"""
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone

WOWTHING_USER = "cta"
BASE = "https://wowthing.org"

# Currency IDs we care about (Midnight Season 2, as of this writing).
# These can drift each season -- update if wowthing adds a new crest tier.
CREST_IDS = [3437, 3438, 3439, 3440, 3441]      # Adventurer..Myth Mistcrest
CATALYST_IDS = [2167]                            # Catalyst Charges
BONUS_ROLL_IDS = [3028, 3310]                    # Restored Coffer Key, Coffer Key Shards

MIN_LEVEL = 90
MIN_ITEM_LEVEL = 290

# Current Mythic+ season, hand-pinned (Midnight Season 2). Update each
# season: season id from apps/frontend/data/mythic-plus.ts `seasonMap`,
# dungeon map ids from the matching `order...` array + MapChallengeMode enum,
# names looked up in rawChallengeDungeons.
MYTHIC_PLUS_SEASON_ID = 18
MYTHIC_PLUS_DUNGEONS = [
    (588, "Altar of Fangs"),
    (586, "Den of Nalorakk"),
    (587, "Murder Row"),
    (584, "The Blinding Vale"),
    (585, "Voidscar Arena"),
    (399, "Ruby Life Pools"),
    (249, "Kings' Rest"),
    (250, "Temple of Sethraliss"),
]

RAID_DIFFICULTY_SHORT = {17: "LFR", 14: "N", 15: "HC", 16: "M", 233: "Normal"}
RAID_DIFFICULTY_ORDER = [17, 14, 15, 16, 233]

SLOT_NAMES = {
    0: "Ammo", 1: "Head", 2: "Neck", 3: "Shoulders", 4: "Shirt", 5: "Chest",
    6: "Waist", 7: "Legs", 8: "Feet", 9: "Wrist", 10: "Hands", 11: "Ring 1",
    12: "Ring 2", 13: "Trinket 1", 14: "Trinket 2", 15: "Back", 16: "Main Hand",
    17: "Off Hand", 18: "Ranged", 19: "Tabard",
}

DIFFICULTY_NAMES = {
    1: "Normal", 2: "Heroic", 23: "Mythic", 8: "Mythic Keystone",
    14: "Normal", 15: "Heroic", 16: "Mythic", 17: "LFR", 24: "Timewalking",
}

QUALITY_COLORS = {
    0: "#9d9d9d", 1: "#ffffff", 2: "#1eff00", 3: "#0070dd",
    4: "#a335ee", 5: "#ff8000", 6: "#e6cc80", 7: "#00ccff",
}


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "wowthing-site-builder/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "wowthing-site-builder/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8")


def get_asset_paths(html):
    paths = {}
    for key in ["data-user", "data-static", "data-item"]:
        m = re.search(rf'{key}="([^"]+)"', html)
        if m:
            paths[key] = m.group(1).replace("&amp;", "&")
    return paths


def main():
    print(f"Fetching profile page for {WOWTHING_USER}...")
    html = fetch_text(f"{BASE}/user/{WOWTHING_USER}")
    paths = get_asset_paths(html)
    if "data-user" not in paths:
        print("Could not find data-user asset path in page", file=sys.stderr)
        sys.exit(1)

    print("Fetching user data...")
    user_url = BASE + paths["data-user"]
    # This is often a redirect to a versioned file
    user_data = fetch_json(user_url)

    print("Fetching static data...")
    static_data = fetch_json(BASE + paths["data-static"])

    characters_raw = user_data.get("charactersRaw", [])

    # --- Build lookups from static data -------------------------------
    currency_by_id = {c[0]: {"name": c[8]} for c in static_data.get("rawCurrencies", [])}
    classes = {
        cid: {"name": c["name"].split("|")[0], "slug": c["slug"]}
        for cid, c in static_data.get("characterClasses", {}).items()
    }
    races = {
        rid: {"name": r["name"].split("|")[0], "slug": r["slug"]}
        for rid, r in static_data.get("characterRaces", {}).items()
    }
    realms = {}
    for r in static_data.get("rawRealms", []):
        realms[r[0]] = {"name": r[3], "slug": r[4], "region": r[1]}
    dungeon_name_by_id = {d[0]: d[3] for d in static_data.get("rawChallengeDungeons", [])}

    # --- Figure out which item ids we need names for -------------------
    needed_item_ids = set()
    qualifying = []
    for c in characters_raw:
        level = c[6]
        item_level = c[10]
        if level < MIN_LEVEL or item_level < MIN_ITEM_LEVEL:
            continue
        qualifying.append(c)
        equipped = c[30] or {}
        for arr in equipped.values():
            needed_item_ids.add(arr[2])
        for item in (c[50] or []):
            needed_item_ids.add(item[3])

    print(f"{len(qualifying)} characters qualify (level>={MIN_LEVEL}, ilvl>={MIN_ITEM_LEVEL})")

    # --- Identify raids + canonical boss order ---------------------------
    # Every distinct lockout name found is treated as its own raid, since
    # WoW dungeons don't carry a persistent weekly "lockout" the way raids
    # do (including smaller one-off raids that only have a single difficulty,
    # e.g. a 1-boss mini raid). Difficulties are grouped per raid rather than
    # assumed to always be the standard LFR/Normal/Heroic/Mythic four.
    from collections import Counter
    raid_boss_lists = {}
    raid_difficulties = {}
    for c in qualifying:
        for lo in (c[35] or {}).values():
            name = lo.get("name")
            difficulty = lo.get("difficulty")
            raid_difficulties.setdefault(name, set()).add(difficulty)
            bosses = [b.get("name") for b in lo.get("bosses", [])]
            if len(bosses) > len(raid_boss_lists.get(name, [])):
                raid_boss_lists[name] = bosses

    def difficulty_sort_key(d):
        return (RAID_DIFFICULTY_ORDER.index(d) if d in RAID_DIFFICULTY_ORDER else 99, d)

    raids = []
    for raid_name in sorted(raid_boss_lists, key=lambda n: (-len(raid_boss_lists[n]), n)):
        difficulties = sorted(raid_difficulties[raid_name], key=difficulty_sort_key)
        raids.append({
            "name": raid_name,
            "bosses": raid_boss_lists[raid_name],
            "difficulties": [
                {"id": d, "label": RAID_DIFFICULTY_SHORT.get(d, f"Diff {d}")}
                for d in difficulties
            ],
        })
    print(f"Raids detected: {[(r['name'], len(r['bosses'])) for r in raids]}")

    print(f"Fetching item names for {len(needed_item_ids)} items...")

    item_names = {}
    if needed_item_ids:
        item_data = fetch_json(BASE + paths["data-item"])
        names_array = item_data.get("names", [])
        # rawItems is delta-encoded: running item id = sum of arr[0] so far,
        # and the item's name is names_array[arr[1]] (arr[1] is a *name index*,
        # not the item id).
        running_id = 0
        remaining = set(needed_item_ids)
        for arr in item_data.get("rawItems", []):
            running_id += arr[0]
            if running_id in remaining:
                name_idx = arr[1]
                if 0 <= name_idx < len(names_array) and names_array[name_idx]:
                    item_names[running_id] = names_array[name_idx]
                remaining.discard(running_id)
                if not remaining:
                    break

    # --- Build character output ----------------------------------------
    def currency_group(raw_currencies, ids):
        by_id = {rc[0]: rc for rc in (raw_currencies or [])}
        out = []
        for cid in ids:
            rc = by_id.get(cid)
            meta = currency_by_id.get(cid, {"name": f"Currency {cid}"})
            if rc:
                out.append({
                    "id": cid,
                    "name": meta["name"],
                    "quantity": rc[1] if len(rc) > 1 else 0,
                    "max": rc[2] if len(rc) > 2 else 0,
                })
            elif cid in currency_by_id:
                out.append({"id": cid, "name": meta["name"], "quantity": 0, "max": 0})
        return out

    characters_out = []
    for c in qualifying:
        (
            char_id, name, is_resting, is_war_mode, account_id, active_spec_id,
            level, level_xp, chromie_time, class_id, equipped_item_level, faction,
            gender, guild_id, played_total, race_id, realm_id, rested_xp, gold,
            bank_tabs, current_location, hearth_location, last_api_update_unix,
            last_seen_addon_unix, daily_reset_unix, weekly_reset_unix,
            scanned_currencies_unix, transferred_currencies_unix,
            configuration, auras, raw_equipped_items, garrisons, garrison_trees,
            highest_item_level, known_spells, lockouts, mythic_plus, mythic_plus_addon,
            raw_mythic_plus_seasons, paragons, patron_orders, professions,
            profession_cooldowns, profession_specializations, profession_traits,
            raider_io, reputations, shadowlands, raw_weekly, raw_currencies,
            raw_items, raw_mythic_plus_weeks, specializations, raw_statistics,
        ) = c

        equipped_out = []
        for slot_str, arr in sorted((raw_equipped_items or {}).items(), key=lambda kv: int(kv[0])):
            slot = int(slot_str)
            item_id = arr[2]
            equipped_out.append({
                "slot": slot,
                "slotName": SLOT_NAMES.get(slot, f"Slot {slot}"),
                "itemId": item_id,
                "itemName": item_names.get(item_id, f"Item #{item_id}"),
                "itemLevel": arr[3],
                "quality": arr[4],
                "context": arr[0],
                "craftedQuality": arr[1],
            })

        bag_items_out = []
        for item in (raw_items or []):
            location, bag_id, slot, item_id, count = item[0], item[1], item[2], item[3], item[4]
            if slot == 0:
                continue  # this is a bag container itself, not contents
            if location != 1:
                continue  # only "Bags" location
            bag_items_out.append({
                "bagId": bag_id,
                "slot": slot,
                "itemId": item_id,
                "itemName": item_names.get(item_id, f"Item #{item_id}"),
                "count": count,
                "itemLevel": item[8] if len(item) > 8 else 0,
                "quality": item[9] if len(item) > 9 else 1,
            })

        lockouts_out = []
        for key, lo in (lockouts or {}).items():
            lockouts_out.append({
                "name": lo.get("name"),
                "difficulty": lo.get("difficulty"),
                "difficultyName": DIFFICULTY_NAMES.get(lo.get("difficulty"), f"Difficulty {lo.get('difficulty')}"),
                "defeatedBosses": lo.get("defeatedBosses"),
                "maxBosses": lo.get("maxBosses"),
                "resetTime": lo.get("resetTime"),
                "locked": lo.get("locked"),
                "bosses": lo.get("bosses", []),
            })
        lockouts_out.sort(key=lambda x: (x["name"] or "", x["difficulty"] or 0))

        # --- Mythic+ dungeon scores for the current season --------------
        season_key = str(MYTHIC_PLUS_SEASON_ID)
        season_scores = (raw_mythic_plus_seasons or {}).get(season_key, {})
        dungeon_scores_out = []
        total_score = 0
        for map_id, dungeon_name in MYTHIC_PLUS_DUNGEONS:
            entry = season_scores.get(str(map_id))
            if entry:
                overall_score = entry[0] or 0
                # entry[1] = fortified [level,score,duration,overTime], entry[2] = tyrannical
                fortified = entry[1] if len(entry) > 1 else None
                tyrannical = entry[2] if len(entry) > 2 else None
                best_affix = tyrannical or fortified
                level = best_affix[0] if best_affix else 0
                timed = bool(best_affix[3] == 0) if best_affix and len(best_affix) > 3 else None
                total_score += overall_score
                dungeon_scores_out.append({
                    "mapId": map_id,
                    "name": dungeon_name,
                    "level": level,
                    "score": round(overall_score),
                })
            else:
                dungeon_scores_out.append({
                    "mapId": map_id, "name": dungeon_name, "level": 0, "score": 0,
                })

        rio = (raider_io or {}).get(season_key, {})
        rating = rio.get("all") if rio.get("all") else round(total_score)

        # --- Current keystone + weekly vault -----------------------------
        current_keystone = None
        vault_raid = []
        vault_dungeon = []
        if raw_weekly:
            keystone_dungeon = raw_weekly[5] if len(raw_weekly) > 5 else 0
            keystone_level = raw_weekly[6] if len(raw_weekly) > 6 else 0
            if keystone_dungeon:
                current_keystone = {
                    "dungeonName": dungeon_name_by_id.get(keystone_dungeon, f"Dungeon #{keystone_dungeon}"),
                    "level": keystone_level,
                }

            raid_progress = raw_weekly[11] if len(raw_weekly) > 11 else []
            for slot in (raid_progress or []):
                level, tier, progress, threshold = slot[0], slot[1], slot[2], slot[3]
                met = progress >= threshold and threshold > 0
                vault_raid.append({
                    "met": met,
                    "label": RAID_DIFFICULTY_SHORT.get(level, str(level)) if met else None,
                })

            dungeon_progress = raw_weekly[10] if len(raw_weekly) > 10 else []
            for slot in (dungeon_progress or []):
                level, tier, progress, threshold = slot[0], slot[1], slot[2], slot[3]
                met = progress >= threshold and threshold > 0
                vault_dungeon.append({
                    "met": met,
                    "label": str(level) if met and level else None,
                })

        # --- Raid boss-kill grids (one per detected raid, by difficulty) -
        lockouts_by_name_diff = {}
        for lo in lockouts_out:
            lockouts_by_name_diff[(lo["name"], lo["difficulty"])] = lo

        raid_grids = {}
        for raid in raids:
            grid = {}
            for diff in raid["difficulties"]:
                lo = lockouts_by_name_diff.get((raid["name"], diff["id"]))
                if lo:
                    dead_by_name = {b.get("name"): b.get("dead") for b in lo.get("bosses", [])}
                    row = [dead_by_name.get(boss_name) for boss_name in raid["bosses"]]
                else:
                    row = [None] * len(raid["bosses"])
                grid[diff["label"]] = row
            raid_grids[raid["name"]] = grid

        characters_out.append({
            "id": char_id,
            "name": name,
            "level": level,
            "itemLevel": equipped_item_level,
            "classId": class_id,
            "raceId": race_id,
            "realmId": realm_id,
            "gender": gender,
            "faction": faction,
            "gold": gold,
            "equipped": equipped_out,
            "bagItems": bag_items_out,
            "currencies": {
                "crests": currency_group(raw_currencies, CREST_IDS),
                "catalyst": currency_group(raw_currencies, CATALYST_IDS),
                "bonusRolls": currency_group(raw_currencies, BONUS_ROLL_IDS),
            },
            "lockouts": lockouts_out,
            "mythicPlus": {
                "rating": rating,
                "currentKeystone": current_keystone,
                "dungeonScores": dungeon_scores_out,
            },
            "vault": {
                "raid": vault_raid,
                "dungeon": vault_dungeon,
            },
            "raidGrids": raid_grids,
        })

    characters_out.sort(key=lambda c: (-c["itemLevel"]))

    output = {
        "account": WOWTHING_USER,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "minLevel": MIN_LEVEL,
        "minItemLevel": MIN_ITEM_LEVEL,
        "warbandGold": user_data.get("warbankGold", 0),
        "classes": classes,
        "races": races,
        "realms": realms,
        "qualityColors": QUALITY_COLORS,
        "raids": raids,
        "mythicPlusDungeons": [{"mapId": m, "name": n} for m, n in MYTHIC_PLUS_DUNGEONS],
        "characters": characters_out,
    }

    with open("data.json", "w") as f:
        json.dump(output, f, indent=1)

    print(f"Wrote data.json with {len(characters_out)} characters.")


if __name__ == "__main__":
    main()
