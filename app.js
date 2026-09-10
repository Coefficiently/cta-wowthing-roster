(function () {
  "use strict";

  let DATA = null;
  let sortKey = "itemLevel";
  let searchTerm = "";

  const rosterEl = document.getElementById("roster");
  const emptyStateEl = document.getElementById("empty-state");
  const template = document.getElementById("character-card-template");

  function fmtNumber(n) {
    return (n || 0).toLocaleString("en-US");
  }

  function classRaceRealm(char) {
    const cls = DATA.classes[char.classId];
    const race = DATA.races[char.raceId];
    const realm = DATA.realms[char.realmId];
    const parts = [];
    if (race) parts.push(race.name);
    if (cls) parts.push(cls.name);
    const bits = [parts.join(" ")];
    if (realm) bits.push(realm.name);
    return bits.filter(Boolean).join(" \u2014 ");
  }

  function qualityColor(quality) {
    return (DATA.qualityColors && DATA.qualityColors[quality]) || "#3a3427";
  }

  function renderGearRow(item) {
    const li = document.createElement("li");
    li.className = "gear-row";
    li.style.borderLeftColor = qualityColor(item.quality);

    const slot = document.createElement("span");
    slot.className = "slot";
    slot.textContent = item.slotName || `Bag ${item.bagId}`;

    const name = document.createElement("span");
    name.className = "item-name";
    name.textContent = item.itemName + (item.count > 1 ? ` \u00d7${item.count}` : "");

    const ilvl = document.createElement("span");
    ilvl.className = "item-ilvl";
    ilvl.textContent = item.itemLevel > 0 ? item.itemLevel : "\u2014";

    li.append(slot, name, ilvl);
    return li;
  }

  function renderCurrencyRow(cur) {
    const li = document.createElement("li");
    li.className = "currency-row";

    const name = document.createElement("span");
    name.className = "currency-name";
    name.textContent = cur.name;

    const qty = document.createElement("span");
    qty.className = "currency-qty";
    qty.textContent = cur.max > 0 ? `${fmtNumber(cur.quantity)} / ${fmtNumber(cur.max)}` : fmtNumber(cur.quantity);

    li.append(name, qty);
    return li;
  }

  function renderLockoutRow(lock) {
    const li = document.createElement("li");
    li.className = "lockout-item";

    const name = document.createElement("span");
    name.className = "lockout-name";
    name.textContent = `${lock.name} \u2014 ${lock.difficultyName}`;

    const meta = document.createElement("span");
    meta.className = "lockout-meta";
    const reset = lock.resetTime ? new Date(lock.resetTime).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "unknown";
    meta.textContent = `${lock.defeatedBosses}/${lock.maxBosses} bosses \u00b7 resets ${reset}`;

    li.append(name, meta);
    return li;
  }

  function fillListOrEmpty(ul, items, renderFn, emptyText) {
    ul.innerHTML = "";
    if (!items || items.length === 0) {
      const li = document.createElement("li");
      li.className = "empty-msg";
      li.textContent = emptyText;
      ul.appendChild(li);
      return;
    }
    for (const item of items) {
      ul.appendChild(renderFn(item));
    }
  }

  function buildCard(char) {
    const node = template.content.firstElementChild.cloneNode(true);

    node.querySelector(".char-name").textContent = char.name;
    node.querySelector(".char-meta").textContent = `${classRaceRealm(char)} \u00b7 level ${char.level}`;
    node.querySelector(".ilvl-value").textContent = char.itemLevel;
    node.querySelector(".gold-value").textContent = fmtNumber(char.gold);

    fillListOrEmpty(
      node.querySelector(".equipped-list"),
      char.equipped,
      renderGearRow,
      "No equipped gear data."
    );

    fillListOrEmpty(
      node.querySelector(".crests-list"),
      char.currencies.crests,
      renderCurrencyRow,
      "None tracked."
    );
    fillListOrEmpty(
      node.querySelector(".catalyst-list"),
      char.currencies.catalyst,
      renderCurrencyRow,
      "None tracked."
    );
    fillListOrEmpty(
      node.querySelector(".bonusrolls-list"),
      char.currencies.bonusRolls,
      renderCurrencyRow,
      "None tracked."
    );

    fillListOrEmpty(
      node.querySelector(".bag-list"),
      char.bagItems,
      renderGearRow,
      "Bags are empty."
    );

    fillListOrEmpty(
      node.querySelector(".lockout-list"),
      char.lockouts,
      renderLockoutRow,
      "No active lockouts."
    );

    function toggle() {
      const isOpen = node.classList.contains("is-open");
      document.querySelectorAll(".char-card.is-open").forEach((el) => {
        if (el !== node) {
          el.classList.remove("is-open");
          el.setAttribute("aria-expanded", "false");
        }
      });
      node.classList.toggle("is-open", !isOpen);
      node.setAttribute("aria-expanded", String(!isOpen));
    }

    node.addEventListener("click", (e) => {
      toggle();
    });
    node.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });

    return node;
  }

  function getFilteredSortedCharacters() {
    let chars = DATA.characters.slice();

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      chars = chars.filter((c) => c.name.toLowerCase().includes(term));
    }

    chars.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "level") return b.level - a.level || b.itemLevel - a.itemLevel;
      return b.itemLevel - a.itemLevel;
    });

    return chars;
  }

  function render() {
    const chars = getFilteredSortedCharacters();
    rosterEl.innerHTML = "";

    if (chars.length === 0) {
      emptyStateEl.hidden = false;
      return;
    }
    emptyStateEl.hidden = true;

    for (const char of chars) {
      rosterEl.appendChild(buildCard(char));
    }
  }

  function renderHeader() {
    document.getElementById("stat-warband-gold").textContent =
      fmtNumber(DATA.warbandGold || 0) + "g";
    document.getElementById("stat-char-count").textContent = DATA.characters.length;

    const generated = new Date(DATA.generatedAt);
    document.getElementById("generated-at").textContent =
      "Last updated " + generated.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
  }

  function wireControls() {
    document.getElementById("search").addEventListener("input", (e) => {
      searchTerm = e.target.value;
      render();
    });

    document.querySelectorAll(".sort-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".sort-btn").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        sortKey = btn.dataset.sort;
        render();
      });
    });
  }

  async function init() {
    try {
      const res = await fetch("data.json", { cache: "no-store" });
      DATA = await res.json();
    } catch (err) {
      rosterEl.innerHTML = `<p class="empty-msg">Could not load character data. Try again shortly.</p>`;
      console.error(err);
      return;
    }
    renderHeader();
    wireControls();
    render();
  }

  init();
})();
