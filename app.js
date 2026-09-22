(function () {
  "use strict";

  var CATEGORIES = [
    { key: "military", label: "Military", color: "#e0625c" },
    { key: "treasury", label: "Treasury", color: "#f0c15c" },
    { key: "wonders", label: "Wonders", color: "#4dd0e8" },
    { key: "civilian", label: "Civilian", color: "#60a5fa" },
    { key: "scientific", label: "Scientific", color: "#4ade80" },
    { key: "commerce", label: "Commerce", color: "#f0955c" },
    { key: "guilds", label: "Guilds", color: "#c084fc" }
  ];

  var WONDERS = [
    "Colossus of Rhodes",
    "Lighthouse of Alexandria",
    "Great Library",
    "Hanging Gardens",
    "Mausoleum of Halicarnassus",
    "Pyramids of Giza",
    "Statue of Zeus",
    "Temple of Artemis"
  ];

  var state = {
    players: [],
    games: [],
    playerCount: 4,
    sheet: [] // { playerId, playerName, wonder, scores: {key: n} }
  };

  // ---------------- API ----------------

  function api(path, opts) {
    return fetch(path, opts).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          throw new Error(body.error || ("Request failed: " + res.status));
        });
      }
      if (res.status === 204) return null;
      return res.json().catch(function () { return null; });
    });
  }

  function loadPlayers() {
    return api("/api/players").then(function (data) {
      state.players = Array.isArray(data) ? data : [];
    }).catch(function () { state.players = state.players || []; });
  }

  function loadGames() {
    return api("/api/games").then(function (data) {
      state.games = Array.isArray(data) ? data : [];
    }).catch(function () { state.games = state.games || []; });
  }

  // ---------------- Helpers ----------------

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-visible"); }, 2200);
  }

  function shareAppLink() {
    var url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: document.title, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        toast("Link copied — share it on WhatsApp!");
      }, function () {
        toast("Could not copy link");
      });
      return;
    }
    var input = el("textarea");
    input.value = url;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand("copy");
      toast("Link copied — share it on WhatsApp!");
    } catch (err) {
      toast("Could not copy link");
    }
    document.body.removeChild(input);
  }

  function emptySheetEntry(index) {
    return {
      playerId: null,
      playerName: "Player " + (index + 1),
      wonder: WONDERS[index % WONDERS.length],
      scores: (function () {
        var s = {};
        CATEGORIES.forEach(function (c) { s[c.key] = 0; });
        return s;
      })()
    };
  }

  function ensureSheetLength(n) {
    while (state.sheet.length < n) {
      state.sheet.push(emptySheetEntry(state.sheet.length));
    }
    state.sheet.length = n;
  }

  function total(entry) {
    var t = 0;
    CATEGORIES.forEach(function (c) { t += Number(entry.scores[c.key]) || 0; });
    return t;
  }

  // ---------------- Navigation ----------------

  function show(viewName) {
    $all(".view").forEach(function (v) {
      v.classList.toggle("is-hidden", v.getAttribute("data-view") !== viewName);
    });
    if (viewName === "players") renderPlayerGrid();
    if (viewName === "rankings") renderRankings();
    if (viewName === "trends") renderTrends();
    if (viewName === "history") renderHistory();
    window.scrollTo(0, 0);
  }

  // ---------------- Player count pills ----------------

  function renderPlayerCountPills() {
    var wrap = $("#playercount-pills");
    wrap.innerHTML = "";
    for (var n = 2; n <= 7; n++) {
      (function (n) {
        var b = el("button", "pill" + (n === state.playerCount ? " is-selected" : ""), String(n));
        b.type = "button";
        b.addEventListener("click", function () {
          state.playerCount = n;
          ensureSheetLength(n);
          renderPlayerCountPills();
          renderSheetTable();
        });
        wrap.appendChild(b);
      })(n);
    }
  }

  // ---------------- Scoring sheet ----------------

  function playerOptionsHtml(selectedId, selectedName) {
    var html = "";
    var found = false;
    state.players.forEach(function (p) {
      var sel = p.id === selectedId ? " selected" : "";
      if (sel) found = true;
      html += '<option value="' + p.id + '"' + sel + ">" + escapeHtml(p.name) + "</option>";
    });
    if (!found) {
      html = '<option value="" selected>' + escapeHtml(selectedName) + "</option>" + html;
    }
    return html;
  }

  function wonderOptionsHtml(selected) {
    return WONDERS.map(function (w) {
      return '<option value="' + escapeHtml(w) + '"' + (w === selected ? " selected" : "") + ">" + escapeHtml(w) + "</option>";
    }).join("");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderSheetTable() {
    ensureSheetLength(state.playerCount);

    var headRow = $("#sheet-head-row");
    headRow.innerHTML = '<th class="cat-col">Categories</th>';
    state.sheet.forEach(function (entry, i) {
      var th = el("th", "player-col-head");
      th.innerHTML =
        '<select class="player-name-select" data-idx="' + i + '" data-role="name">' +
          playerOptionsHtml(entry.playerId, entry.playerName) +
        "</select>" +
        '<select class="player-wonder-select" data-idx="' + i + '" data-role="wonder">' +
          wonderOptionsHtml(entry.wonder) +
        "</select>";
      headRow.appendChild(th);
    });

    var body = $("#sheet-body");
    body.innerHTML = "";
    CATEGORIES.forEach(function (cat) {
      var tr = el("tr", "cat-row");
      var labelTd = el("td", "cat-col");
      labelTd.innerHTML = '<span class="cat-label-cell"><span class="cat-dot" style="background:' + cat.color + '"></span>' + cat.label + "</span>";
      tr.appendChild(labelTd);

      state.sheet.forEach(function (entry, i) {
        var td = el("td");
        var val = Number(entry.scores[cat.key]) || 0;
        td.innerHTML =
          '<span class="stepper" data-idx="' + i + '" data-key="' + cat.key + '">' +
            '<button type="button" class="minus" data-delta="-1">−</button>' +
            '<span class="val">' + val + "</span>" +
            '<button type="button" class="plus" data-delta="1" style="background:' + cat.color + '">+</button>' +
          "</span>";
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });

    renderTotalsRow();
  }

  function renderTotalsRow() {
    var totalRow = $("#sheet-total-row");
    totalRow.innerHTML = '<td class="cat-col">Total</td>';
    var best = null;
    state.sheet.forEach(function (entry) {
      var t = total(entry);
      if (best === null || t > best.total) best = { name: entry.playerName, total: t };
      var td = el("td");
      td.innerHTML = '<span class="total-value">' + t + "</span>";
      totalRow.appendChild(td);
    });
    var leadingText = $("#leading-text");
    if (best && best.total > 0) {
      leadingText.textContent = "Leading: " + best.name + " · " + best.total;
    } else {
      var firstName = state.sheet.length ? state.sheet[0].playerName : "—";
      leadingText.textContent = "Leading: " + firstName + " · 0";
    }
  }

  function onSheetTableClick(e) {
    var plusMinus = e.target.closest("button.plus, button.minus");
    if (plusMinus) {
      var stepper = plusMinus.closest(".stepper");
      var idx = Number(stepper.getAttribute("data-idx"));
      var key = stepper.getAttribute("data-key");
      var delta = Number(plusMinus.getAttribute("data-delta"));
      var entry = state.sheet[idx];
      var next = (Number(entry.scores[key]) || 0) + delta;
      if (next < 0) next = 0;
      entry.scores[key] = next;
      stepper.querySelector(".val").textContent = next;
      renderTotalsRow();
    }
  }

  function onSheetTableChange(e) {
    var t = e.target;
    if (t.matches(".player-name-select")) {
      var idx = Number(t.getAttribute("data-idx"));
      var opt = t.options[t.selectedIndex];
      state.sheet[idx].playerId = opt.value || null;
      state.sheet[idx].playerName = opt.value ? opt.textContent : ("Player " + (idx + 1));
      renderTotalsRow();
    } else if (t.matches(".player-wonder-select")) {
      var idx2 = Number(t.getAttribute("data-idx"));
      state.sheet[idx2].wonder = t.value;
    }
  }

  function resetSheet(opts) {
    var keepPlayers = !opts || opts.keepPlayers !== false;
    if (keepPlayers) {
      state.sheet.forEach(function (entry) {
        CATEGORIES.forEach(function (c) { entry.scores[c.key] = 0; });
      });
      ensureSheetLength(state.playerCount);
    } else {
      state.sheet = [];
      ensureSheetLength(state.playerCount);
    }
    renderSheetTable();
  }

  function saveGame() {
    var entries = state.sheet.map(function (entry) {
      return {
        playerId: entry.playerId,
        playerName: entry.playerName,
        wonder: entry.wonder,
        scores: entry.scores
      };
    });
    var btn = $("#btn-save-game");
    btn.disabled = true;
    btn.textContent = "Saving…";
    api("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: entries })
    }).then(function (game) {
      state.games.push(game);
      toast("Game saved — " + game.winnerName + " wins!");
      resetSheet();
    }).catch(function (err) {
      toast(err.message || "Could not save game");
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = "Save Game";
    });
  }

  // ---------------- Player profiles ----------------

  function renderPlayerGrid() {
    var grid = $("#player-grid");
    var emptyNote = $("#players-empty-note");
    grid.innerHTML = "";
    if (!state.players.length) {
      emptyNote.classList.remove("is-hidden");
      return;
    }
    emptyNote.classList.add("is-hidden");
    state.players.forEach(function (p) {
      var card = el("div", "player-card");
      card.innerHTML =
        '<span class="player-card__icon">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
        "</span>" +
        '<span class="player-card__name">' + escapeHtml(p.name) + "</span>" +
        '<button class="player-card__delete" type="button" aria-label="Remove ' + escapeHtml(p.name) + '">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
        "</button>";
      card.querySelector(".player-card__delete").addEventListener("click", function () {
        deletePlayer(p.id);
      });
      grid.appendChild(card);
    });
  }

  function addPlayer() {
    var input = $("#new-player-name");
    var name = input.value.trim();
    if (!name) return;
    api("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name })
    }).then(function (player) {
      state.players.push(player);
      input.value = "";
      renderPlayerGrid();
      renderSheetTable();
      toast(player.name + " added");
    }).catch(function (err) {
      toast(err.message || "Could not add player");
    });
  }

  function deletePlayer(id) {
    api("/api/players?id=" + encodeURIComponent(id), { method: "DELETE" }).then(function () {
      state.players = state.players.filter(function (p) { return p.id !== id; });
      state.sheet.forEach(function (entry) {
        if (entry.playerId === id) {
          entry.playerId = null;
        }
      });
      renderPlayerGrid();
      renderSheetTable();
      toast("Player removed");
    }).catch(function (err) {
      toast(err.message || "Could not remove player");
    });
  }

  // ---------------- Global rankings ----------------

  function computeRankings() {
    var byName = {};
    state.games.forEach(function (g) {
      g.entries.forEach(function (e) {
        var key = e.playerName;
        if (!byName[key]) byName[key] = { name: key, wins: 0, best: 0, games: 0 };
        byName[key].games += 1;
        if (e.total > byName[key].best) byName[key].best = e.total;
        if (e.playerName === g.winnerName) byName[key].wins += 1;
      });
    });
    return Object.keys(byName).map(function (k) { return byName[k]; }).sort(function (a, b) {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.best - a.best;
    });
  }

  function renderRankings() {
    var list = $("#rankings-list");
    var empty = $("#rankings-empty");
    var ranks = computeRankings();
    if (!state.games.length) {
      empty.classList.remove("is-hidden");
      list.innerHTML = "";
      return;
    }
    empty.classList.add("is-hidden");
    list.innerHTML = "";
    ranks.forEach(function (r, i) {
      var card = el("div", "rank-card" + (i === 0 ? " rank-card--1" : ""));
      card.innerHTML =
        '<span class="rank-num">' + (i + 1) + "</span>" +
        '<span class="rank-info">' +
          '<p class="rank-name">' + escapeHtml(r.name) + "</p>" +
          '<p class="rank-meta">' + r.games + " game" + (r.games === 1 ? "" : "s") + " played</p>" +
        "</span>" +
        '<span class="rank-stats">' +
          '<div class="rank-wins">' + r.wins + " win" + (r.wins === 1 ? "" : "s") + "</div>" +
          '<div class="rank-best">best ' + r.best + "</div>" +
        "</span>";
      list.appendChild(card);
    });
  }

  // ---------------- Trends ----------------

  function renderTrends() {
    var content = $("#trends-content");
    var empty = $("#trends-empty");
    if (!state.games.length) {
      empty.classList.remove("is-hidden");
      content.innerHTML = "";
      return;
    }
    empty.classList.add("is-hidden");

    var allEntries = [];
    state.games.forEach(function (g) { g.entries.forEach(function (e) { allEntries.push(e); }); });

    var totalGames = state.games.length;
    var avgTotal = allEntries.reduce(function (s, e) { return s + e.total; }, 0) / allEntries.length;
    var highest = allEntries.reduce(function (m, e) { return e.total > m.total ? e : m; }, allEntries[0]);

    var wonderCounts = {};
    allEntries.forEach(function (e) {
      wonderCounts[e.wonder] = (wonderCounts[e.wonder] || 0) + 1;
    });
    var wonderWins = {};
    state.games.forEach(function (g) {
      var winnerEntry = g.entries.filter(function (e) { return e.playerName === g.winnerName; })[0];
      if (winnerEntry) wonderWins[winnerEntry.wonder] = (wonderWins[winnerEntry.wonder] || 0) + 1;
    });

    var catAverages = CATEGORIES.map(function (c) {
      var sum = allEntries.reduce(function (s, e) { return s + (Number(e.scores[c.key]) || 0); }, 0);
      return { cat: c, avg: sum / allEntries.length };
    });
    var maxCatAvg = Math.max.apply(null, catAverages.map(function (c) { return c.avg; })) || 1;

    var topWonders = Object.keys(wonderCounts).map(function (w) {
      return { wonder: w, plays: wonderCounts[w], wins: wonderWins[w] || 0 };
    }).sort(function (a, b) { return b.plays - a.plays; }).slice(0, 6);
    var maxWonderPlays = Math.max.apply(null, topWonders.map(function (w) { return w.plays; })) || 1;

    var winningScores = state.games.map(function (g) {
      var w = g.entries.filter(function (e) { return e.playerName === g.winnerName; })[0];
      return w ? w.total : 0;
    });

    content.innerHTML = "";

    var tiles = el("div", "stat-tiles");
    tiles.appendChild(statTile("Games Recorded", String(totalGames), ""));
    tiles.appendChild(statTile("Avg. Score", Math.round(avgTotal), "per player, per game"));
    tiles.appendChild(statTile("Highest Score", String(highest.total), escapeHtml(highest.playerName)));
    tiles.appendChild(statTile("Top Wonder", topWonders[0] ? topWonders[0].wonder : "—", topWonders[0] ? topWonders[0].plays + " plays" : ""));
    content.appendChild(tiles);

    var catCard = el("div", "chart-card");
    var catBars = catAverages.map(function (c) {
      return '<div class="hbar-row">' +
        '<span class="hbar-label">' + c.cat.label + "</span>" +
        '<span class="hbar-track"><span class="hbar-fill" style="width:' + Math.max(4, (c.avg / maxCatAvg) * 100) + "%;background:" + c.cat.color + '"></span></span>' +
        '<span class="hbar-value">' + c.avg.toFixed(1) + "</span>" +
      "</div>";
    }).join("");
    catCard.innerHTML = '<p class="chart-card__title">Average Score by Category</p>' + catBars;
    content.appendChild(catCard);

    var wonderCard = el("div", "chart-card");
    var wonderBars = topWonders.map(function (w) {
      return '<div class="hbar-row">' +
        '<span class="hbar-label">' + escapeHtml(w.wonder) + "</span>" +
        '<span class="hbar-track"><span class="hbar-fill" style="width:' + Math.max(4, (w.plays / maxWonderPlays) * 100) + '%;background:#e0b25c"></span></span>' +
        '<span class="hbar-value">' + w.plays + "</span>" +
      "</div>";
    }).join("");
    wonderCard.innerHTML = '<p class="chart-card__title">Most-Played Wonders</p>' + wonderBars;
    content.appendChild(wonderCard);

    var sparkCard = el("div", "chart-card");
    sparkCard.innerHTML = '<p class="chart-card__title">Winning Score Trend</p><div class="sparkline-wrap"></div>';
    sparkCard.querySelector(".sparkline-wrap").appendChild(buildSparkline(winningScores));
    content.appendChild(sparkCard);
  }

  function statTile(label, value, sub) {
    var t = el("div", "stat-tile");
    t.innerHTML = '<p class="stat-tile__label">' + label + '</p><p class="stat-tile__value">' + value + "</p>" +
      (sub ? '<p class="stat-tile__sub">' + sub + "</p>" : "");
    return t;
  }

  function buildSparkline(values) {
    var w = 300, h = 90, pad = 10;
    var max = Math.max.apply(null, values) || 1;
    var min = Math.min.apply(null, values);
    var range = Math.max(1, max - min);
    var stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
    var points = values.map(function (v, i) {
      var x = pad + i * stepX;
      var y = h - pad - ((v - min) / range) * (h - pad * 2);
      return [x, y];
    });
    var path = points.map(function (p, i) { return (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
    svg.setAttribute("preserveAspectRatio", "none");

    var polyline = document.createElementNS(ns, "path");
    polyline.setAttribute("d", path);
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", "#e0b25c");
    polyline.setAttribute("stroke-width", "2.5");
    polyline.setAttribute("stroke-linecap", "round");
    polyline.setAttribute("stroke-linejoin", "round");
    svg.appendChild(polyline);

    points.forEach(function (p) {
      var c = document.createElementNS(ns, "circle");
      c.setAttribute("cx", p[0]);
      c.setAttribute("cy", p[1]);
      c.setAttribute("r", "3.5");
      c.setAttribute("fill", "#1a1530");
      c.setAttribute("stroke", "#e0b25c");
      c.setAttribute("stroke-width", "2");
      svg.appendChild(c);
    });

    return svg;
  }

  // ---------------- History ----------------

  function renderHistory() {
    var list = $("#history-list");
    var empty = $("#history-empty");
    if (!state.games.length) {
      empty.classList.remove("is-hidden");
      list.innerHTML = "";
      return;
    }
    empty.classList.add("is-hidden");
    list.innerHTML = "";
    state.games.slice().reverse().forEach(function (g) {
      var card = el("div", "history-card");
      var date = new Date(g.ts);
      var dateStr = isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      var scoresHtml = g.entries.map(function (e) {
        return '<span class="history-score"><strong>' + escapeHtml(e.playerName) + "</strong> " + e.total + "</span>";
      }).join("");
      card.innerHTML =
        '<div class="history-card__top">' +
          '<span class="history-card__date">' + dateStr + " · " + g.playerCount + " players</span>" +
          '<span class="history-card__winner">🏆 ' + escapeHtml(g.winnerName) + "</span>" +
        "</div>" +
        '<div class="history-card__scores">' + scoresHtml + "</div>";
      list.appendChild(card);
    });
  }

  // ---------------- Wire up ----------------

  function init() {
    Promise.all([loadPlayers(), loadGames()]).then(function () {
      ensureSheetLength(state.playerCount);
      renderPlayerCountPills();
      renderSheetTable();
    });

    $("#sheet-table").addEventListener("click", onSheetTableClick);
    $("#sheet-table").addEventListener("change", onSheetTableChange);
    $("#btn-reset").addEventListener("click", function () {
      resetSheet();
      toast("Sheet reset");
    });
    $("#btn-save-game").addEventListener("click", saveGame);
    $("#btn-home-icon").addEventListener("click", function () { show("sheet"); });
    $("#btn-share").addEventListener("click", shareAppLink);

    $("#btn-history").addEventListener("click", function () { show("history"); });
    $("#btn-trends-shortcut").addEventListener("click", function () { show("trends"); });
    $("#btn-players-shortcut").addEventListener("click", function () { show("players"); });
    $("#btn-rankings-shortcut").addEventListener("click", function () { show("rankings"); });

    $all("[data-back]").forEach(function (b) { b.addEventListener("click", function () { show("sheet"); }); });
    $all("[data-goto]").forEach(function (b) { b.addEventListener("click", function () { show(b.getAttribute("data-goto")); }); });

    $("#btn-add-player").addEventListener("click", addPlayer);
    $("#new-player-name").addEventListener("keydown", function (e) {
      if (e.key === "Enter") addPlayer();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
