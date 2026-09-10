(function () {
  "use strict";

  let DATA = null;

  const theadEl = document.getElementById("roster-thead");
  const tbodyEl = document.getElementById("roster-tbody");
  const detailPanel = document.getElementById("detail-panel");

  const CLASS_COLORS = {
    warrior: "#C79C6E", paladin: "#F58CBA", hunter: "#ABD473", rogue: "#FFF569",
    priest: "#FFFFFF", "death-knight": "#C41F3B", shaman: "#0070DE", mage: "#69CCF0",
    warlock: "#9482C9", monk: "#00FF96", druid: "#FF7D0A", "demon-hunter": "#A330C9",
    evoker: "#33937F",
  };

  function fmtNumber(n) {
    return (n || 0).toLocaleString("en-US");
  }

  function classInfo(char) {
    return DATA.classes[char.classId] || { name: "Unknown", slug: "" };
  }

  function classColor(char) {
    return CLASS_COLORS[classInfo(char).slug] || "#c99a44";
  }

  function realmName(char) {
    const realm = DATA.realms[char.realmId];
    return realm ? realm.name : "\u2014";
  }

  function raceName(char) {
    const race = DATA.races[char.raceId];
    return race ? race.name : "\u2014";
  }

  const FACTION_NAMES = { 0: "Alliance", 1: "Horde" };
  function factionName(char) {
    return FACTION_NAMES[char.faction] || "\u2014";
  }

  function qualityColor(quality) {
    return (DATA.qualityColors && DATA.qualityColors[quality]) || "#3a3427";
  }

  // ---------------- Grid header ----------------

  function renderHeader(chars) {
    theadEl.innerHTML = `
      <tr class="row-character">
        <th class="row-label"></th>
        ${chars.map((c) => `
          <th class="char-col" data-char-id="${c.id}" tabindex="0" role="button">
            <span class="char-col-name" style="color:${classColor(c)}">${c.name}</span>
          </th>`).join("")}
      </tr>
    `;
  }

  // ---------------- Grid body rows ----------------

  function rowRealm(chars) {
    return `<tr>
      <td class="row-label">Realm</td>
      ${chars.map((c) => `<td class="cell-dim">${realmName(c)}</td>`).join("")}
    </tr>`;
  }

  function rowFaction(chars) {
    return `<tr>
      <td class="row-label">Faction</td>
      ${chars.map((c) => `<td class="cell-dim">${factionName(c)}</td>`).join("")}
    </tr>`;
  }

  function rowRace(chars) {
    return `<tr>
      <td class="row-label">Race</td>
      ${chars.map((c) => `<td class="cell-dim">${raceName(c)}</td>`).join("")}
    </tr>`;
  }

  function rowItemLevel(chars) {
    return `<tr>
      <td class="row-label">Item Level</td>
      ${chars.map((c) => `<td class="cell-gold cell-strong">${c.itemLevel}</td>`).join("")}
    </tr>`;
  }

  function rowProfession(index, chars) {
    return `<tr>
      <td class="row-label">Profession ${index + 1}</td>
      ${chars.map((c) => {
        const p = c.professions[index];
        if (!p) return `<td class="cell-dim">\u2014</td>`;
        return `<td class="cell-profession">${p.name} <span class="profession-skill">${p.currentSkill}/${p.maxSkill}</span></td>`;
      }).join("")}
    </tr>`;
  }

  function rowRating(chars) {
    return `<tr>
      <td class="row-label">Rating</td>
      ${chars.map((c) => `<td class="cell-rating">${fmtNumber(c.mythicPlus.rating)}</td>`).join("")}
    </tr>`;
  }

  function rowKeystone(chars) {
    return `<tr>
      <td class="row-label">Current Keystone</td>
      ${chars.map((c) => {
        const k = c.mythicPlus.currentKeystone;
        if (!k) return `<td class="cell-dim">\u2014</td>`;
        return `<td class="cell-keystone"><span class="keystone-level">+${k.level}</span> ${k.dungeonName}</td>`;
      }).join("")}
    </tr>`;
  }

  function vaultCellHtml(slots) {
    if (!slots || slots.length === 0) return `<span class="vault-slot vault-empty">\u2014</span>`;
    return slots
      .map((s) => `<span class="vault-slot ${s.met ? "vault-met" : "vault-empty"}">${s.met ? s.label : "\u2014"}</span>`)
      .join("");
  }

  function rowVault(chars) {
    return `
      <tr>
        <td class="row-label">Vault: Raid</td>
        ${chars.map((c) => `<td>${vaultCellHtml(c.vault.raid)}</td>`).join("")}
      </tr>
      <tr>
        <td class="row-label">Vault: Dungeons</td>
        ${chars.map((c) => `<td>${vaultCellHtml(c.vault.dungeon)}</td>`).join("")}
      </tr>
    `;
  }

  function rowMythicPlusSectionHeader(chars) {
    return `<tr class="section-row">
      <td class="row-label section-label">Mythic+</td>
      <td class="section-fill" colspan="${chars.length}"></td>
    </tr>`;
  }

  function rowDungeon(dungeon, chars) {
    return `<tr>
      <td class="row-label row-label-sub">${dungeon.name}</td>
      ${chars.map((c) => {
        const d = c.mythicPlus.dungeonScores.find((x) => x.mapId === dungeon.mapId);
        if (!d || d.level === 0) return `<td class="cell-dim">\u2014</td>`;
        return `<td class="cell-dungeon"><span class="dungeon-level">${d.level}</span><span class="dungeon-score">${fmtNumber(d.score)}</span></td>`;
      }).join("")}
    </tr>`;
  }

  function rowRaidSectionHeader(raidName, chars) {
    return `<tr class="section-row">
      <td class="row-label section-label">${raidName}</td>
      <td class="section-fill" colspan="${chars.length}"></td>
    </tr>`;
  }

  function escapeHtml(str) {
    const div = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(str).replace(/[&<>"']/g, (ch) => div[ch]);
  }

  function rowRaidDifficulty(raidName, difficultyLabel, bosses, chars) {
    return `<tr>
      <td class="row-label row-label-sub">${difficultyLabel}</td>
      ${chars.map((c) => {
        const row = (c.raidGrids[raidName] || {})[difficultyLabel];
        if (!row) return `<td>\u2014</td>`;
        const squares = row
          .map((dead, i) => {
            let cls = "boss-square boss-unknown";
            let status = "Unsaved";
            if (dead === true) { cls = "boss-square boss-dead"; status = "Saved"; }
            else if (dead === false) { cls = "boss-square boss-alive"; }
            const bossName = bosses[i] || `Boss ${i + 1}`;
            const tooltipText = escapeHtml(`${bossName} \u2014 ${status}`);
            return `<span class="${cls}" data-tooltip="${tooltipText}" aria-label="${tooltipText}"></span>`;
          })
          .join("");
        return `<td><div class="boss-row">${squares}</div></td>`;
      }).join("")}
    </tr>`;
  }

  function render() {
    const chars = DATA.characters;
    renderHeader(chars);

    let rows = "";
    rows += rowRealm(chars);
    rows += rowFaction(chars);
    rows += rowRace(chars);
    rows += rowItemLevel(chars);
    rows += rowRating(chars);
    rows += rowKeystone(chars);
    rows += rowVault(chars);
    rows += rowProfession(0, chars);
    rows += rowProfession(1, chars);
    rows += rowMythicPlusSectionHeader(chars);
    for (const dungeon of DATA.mythicPlusDungeons) {
      rows += rowDungeon(dungeon, chars);
    }
    for (const raid of DATA.raids || []) {
      rows += rowRaidSectionHeader(raid.name, chars);
      for (const diff of raid.difficulties) {
        rows += rowRaidDifficulty(raid.name, diff.label, raid.bosses, chars);
      }
    }

    tbodyEl.innerHTML = rows;

    document.querySelectorAll(".char-col").forEach((th) => {
      const charId = Number(th.dataset.charId);
      const open = () => openDetail(charId);
      th.addEventListener("click", open);
      th.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
  }

  // ---------------- Detail panel (gear / currencies / bags) ----------------

  // Wowhead's tooltip widget (power.js, loaded in index.html) shows the
  // full authoritative tooltip -- icon included -- when hovering any of
  // these links. We tried also auto-injecting a standalone icon via <ins>
  // per Wowhead's "iconizelinks" feature, but that rendered blank for most
  // items and overlapped adjacent text for gems, so we dropped it: the
  // hover tooltip is the one mechanism that's actually confirmed working.
  function wowheadLink(item, extraCls) {
    const cls = extraCls || "";
    return `<a href="${item.wowheadUrl}" class="wh-item-link ${cls}" target="_blank" rel="noopener">${item.name}</a>`;
  }

  function renderGearRow(item) {
    const border = qualityColor(item.quality);
    const ilvlTxt = item.itemLevel > 0
      ? (item.itemLevelEstimated ? `~${item.itemLevel}` : item.itemLevel)
      : "\u2014";
    const ilvlTooltip = item.itemLevelEstimated
      ? ` data-tooltip="Not reported by the API directly -- inferred from this item's upgrade rank" aria-label="Estimated item level"`
      : "";
    const slotTxt = item.slotName || `Bag ${item.bagId}`;

    const upgradeTxt = item.upgrade
      ? `<span class="item-upgrade">${item.upgrade.track} ${item.upgrade.rank}/${item.upgrade.maxRank}</span>`
      : "";
    const craftedTxt = item.craftedQuality > 0
      ? `<span class="item-crafted">Crafted Q${item.craftedQuality}</span>`
      : "";
    const tierTxt = item.isTierPiece ? `<span class="item-tier-badge" data-tooltip="Tier set piece" aria-label="Tier set piece">T</span>` : "";

    const enchantLine = item.enchant
      ? `<div class="item-subline item-enchant">${item.enchant}</div>`
      : "";
    const gemsLine = (item.gems && item.gems.length > 0)
      ? `<div class="item-subline item-gems">${item.gems.map((g) => `\u25c6 ${wowheadLink({ wowheadUrl: g.wowheadUrl, name: g.name }, "gem-link")}`).join(" &nbsp; ")}</div>`
      : "";

    return `<li class="gear-row" style="border-left-color:${border}">
      <div class="gear-row-main">
        <div class="gear-row-top">
          <span class="slot">${slotTxt}</span>
          <span class="item-name">${wowheadLink({ wowheadUrl: item.wowheadUrl, name: item.itemName }, "item-name-link")}${tierTxt}</span>
          <span class="item-ilvl"${ilvlTooltip}>${ilvlTxt}</span>
        </div>
        <div class="gear-row-meta">${upgradeTxt}${craftedTxt}</div>
        ${enchantLine}
        ${gemsLine}
      </div>
    </li>`;
  }

  function renderCurrencySection(title, items) {
    if (!items || items.length === 0) return "";

    if (items.length === 1) {
      const cur = items[0];
      const qty = cur.max > 0 ? `${fmtNumber(cur.quantity)} / ${fmtNumber(cur.max)}` : fmtNumber(cur.quantity);
      return `<div class="currency-section">
        <h4>${title}</h4>
        <div class="currency-stat">
          ${wowheadLink({ wowheadUrl: cur.wowheadUrl, name: qty }, "currency-stat-value")}
        </div>
      </div>`;
    }

    const chips = items.map((cur) => {
      const empty = cur.quantity === 0 && cur.max === 0;
      const qty = cur.max > 0 ? `${fmtNumber(cur.quantity)}/${fmtNumber(cur.max)}` : fmtNumber(cur.quantity);
      return `<div class="currency-chip${empty ? " currency-chip-empty" : ""}">
        ${wowheadLink({ wowheadUrl: cur.wowheadUrl, name: cur.shortName || cur.name }, "currency-chip-name")}
        <span class="currency-chip-qty">${qty}</span>
      </div>`;
    }).join("");

    return `<div class="currency-section">
      <h4>${title}</h4>
      <div class="currency-chips">${chips}</div>
    </div>`;
  }

  function fillList(id, items, renderFn, emptyText) {
    const el = document.getElementById(id);
    if (!items || items.length === 0) {
      el.innerHTML = `<li class="empty-msg">${emptyText}</li>`;
      return;
    }
    el.innerHTML = items.map(renderFn).join("");
  }

  function openDetail(charId) {
    const char = DATA.characters.find((c) => c.id === charId);
    if (!char) return;

    document.getElementById("detail-name").textContent = char.name;
    document.getElementById("detail-name").style.color = classColor(char);
    document.getElementById("detail-meta").textContent =
      `${classInfo(char).name} \u00b7 ${realmName(char)} \u00b7 level ${char.level} \u00b7 ilvl ${char.itemLevel} \u00b7 tier ${char.tierPieceCount}pc`;

    fillList("detail-equipped", char.equipped, renderGearRow, "No equipped gear data.");

    document.getElementById("detail-currencies").innerHTML =
      renderCurrencySection("Crests", char.currencies.crests) +
      renderCurrencySection("Catalyst charges", char.currencies.catalyst) +
      renderCurrencySection("Bonus rolls", char.currencies.bonusRolls);

    detailPanel.hidden = false;
    if (typeof detailPanel.scrollIntoView === "function") {
      detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  document.getElementById("detail-close").addEventListener("click", () => {
    detailPanel.hidden = true;
  });

  // ---------------- Header stats + init ----------------

  function renderTopStats() {
    document.getElementById("stat-warband-gold").textContent = fmtNumber(DATA.warbandGold || 0) + "g";
    document.getElementById("stat-char-count").textContent = DATA.characters.length;

    const generated = new Date(DATA.generatedAt);
    document.getElementById("generated-at").textContent =
      "Last updated " + generated.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  async function init() {
    try {
      const res = await fetch("data.json", { cache: "no-store" });
      DATA = await res.json();
    } catch (err) {
      tbodyEl.innerHTML = `<tr><td class="empty-msg">Could not load character data. Try again shortly.</td></tr>`;
      console.error(err);
      return;
    }
    renderTopStats();
    render();
  }

  init();
})();
