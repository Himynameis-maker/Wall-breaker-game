(function (root) {
  "use strict";

  const G = root.WreckGame || {};
  const RIGHT = G.RIGHT || 1;
  const LEFT = G.LEFT || 2;
  const EDGE_SAFE_COLS = G.EDGE_SAFE_COLS || 2;
  const TILE = G.TILE || {
    EMPTY: 0x00,
    LADDER: 0x01,
    SAND_LADDER: 0x02,
    DRUM: 0x08,
    HOLE: 0x09,
    WALL_1: 0xc1,
    WALL_2: 0x92,
    WALL_3: 0xa3,
    BOMB: 0xb1,
    TIMED_BOMB: 0xb2,
    BREAK_LADDER: 0xd1,
    DOOR: 0xe1,
    PILLAR: 0xf1
  };
  const isEdgeSafeCol = G.isEdgeSafeCol || function (col, cols) {
    if (!cols || cols <= EDGE_SAFE_COLS * 2) return false;
    const wc = ((col % cols) + cols) % cols;
    return wc < EDGE_SAFE_COLS || wc >= cols - EDGE_SAFE_COLS;
  };
  const isClearTargetTile = G.isClearTargetTile || function (t) {
    if ((t & 0x80) === 0) return false;
    if (t === TILE.BOMB || t === TILE.TIMED_BOMB || t === TILE.PILLAR) return false;
    if ((t & 0xf0) === 0xe0) return false;
    return true;
  };

  const STORAGE_KEY = "wreck_stage_editor_slots_v1";
  const MAX_ENEMIES = 7;

  const EDITOR_TOOLS = [
    { id: "erase", label: "床 (消す)", group: "terrain", kind: "erase", desc: "穴を埋めて床に戻し、置いたモノ・親方・敵を消します" },
    { id: "wall1", label: "1回壁(木箱)", group: "wall", kind: "tile", tile: TILE.WALL_1, desc: "1回叩くと壊れる壁（クリア対象）" },
    { id: "wall2", label: "2回壁(銀)", group: "wall", kind: "tile", tile: TILE.WALL_2, desc: "2回叩くと壊れる壁（クリア対象）" },
    { id: "wall3", label: "3回壁(黒)", group: "wall", kind: "tile", tile: TILE.WALL_3, desc: "3回叩くと壊れる壁（クリア対象）" },
    { id: "ladder", label: "通常ハシゴ", group: "terrain", kind: "tile", tile: TILE.LADDER, desc: "全員が昇り降りできるハシゴ" },
    { id: "breakLadder", label: "壊れハシゴ", group: "terrain", kind: "tile", tile: TILE.BREAK_LADDER, desc: "叩くと崩れるハシゴ（クリア対象）" },
    { id: "sandLadder", label: "砂嵐ハシゴ", group: "terrain", kind: "tile", tile: TILE.SAND_LADDER, desc: "敵だけ使える・主人公は掴めず落ちるハシゴ" },
    { id: "drum", label: "ドラム缶", group: "terrain", kind: "tile", tile: TILE.DRUM, desc: "通れない・上に乗れる・鉄柱で落ちる" },
    { id: "hole", label: "穴", group: "terrain", kind: "tile", tile: TILE.HOLE, desc: "足場のない落とし穴（一番下の段以外）" },
    { id: "bomb", label: "爆弾", group: "wall", kind: "tile", tile: TILE.BOMB, desc: "左右へ連鎖爆発・ドア全開" },
    { id: "timedBomb", label: "時限爆弾", group: "wall", kind: "tile", tile: TILE.TIMED_BOMB, desc: "設定秒数で爆発（叩き無効）" },
    { id: "door", label: "自動ドア", group: "wall", kind: "tile", tile: TILE.DOOR, desc: "叩くと開く（敵が裏側へ出入り）" },
    { id: "pillar", label: "鉄柱", group: "wall", kind: "tile", tile: TILE.PILLAR, desc: "叩くと真上1マス分が落下（縦2連続は不可）" },
    { id: "mario", label: "主人公", group: "actor", kind: "actor", desc: "主人公の開始位置（再タップで向き反転）" },
    { id: "spike", label: "親方ロボ", group: "actor", kind: "actor", desc: "親方を配置（再タップで向き反転 / 床で消去）" },
    { id: "spanagon", label: "黄ロボ", group: "actor", kind: "enemy", enemyType: "spanagon", desc: "主人公を追う標準ロボ（再タップで向き反転）" },
    { id: "spanagonFast", label: "赤高速ロボ", group: "actor", kind: "enemy", enemyType: "spanagonFast", desc: "少し速く追う危険ロボ（再タップで向き反転）" },
    { id: "eggplant", label: "緑四つ足", group: "actor", kind: "enemy", enemyType: "eggplant", desc: "高速直進・ハシゴ好きロボ（再タップで向き反転）" }
  ];

  function clampInt(v, min, max, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function normalizeTimedSec(sec) {
    const n = Number(sec);
    if (n === 15 || n === 30 || n === 45 || n === 60) return n;
    return 30;
  }

  function normalizeDir(dir, fallback) {
    if (dir === LEFT || dir === "LEFT" || dir === "L") return LEFT;
    if (dir === RIGHT || dir === "RIGHT" || dir === "R") return RIGHT;
    return fallback;
  }

  function createBlankStage(cols = 20, rows = 8, slotIdx = 0) {
    const c = clampInt(cols, 14, 24, 20);
    const r = clampInt(rows, 6, 10, 8);
    return {
      name: "お試しステージ " + (slotIdx + 1),
      cols: c,
      rows: r,
      tiles: [],
      timedBombs: [],
      mario: { row: r - 1, col: Math.min(4, c - 3), dir: RIGHT },
      spike: { row: 1, col: Math.max(2, c - 5), dir: LEFT },
      enemies: [],
      fireballMode: "normal"
    };
  }

  function cloneStageData(data) {
    return {
      name: String(data.name || "ステージ"),
      cols: data.cols,
      rows: data.rows,
      tiles: (data.tiles || []).map(t => ({ row: t.row, col: t.col, tile: t.tile })),
      timedBombs: (data.timedBombs || []).map(tb => ({ row: tb.row, col: tb.col, sec: tb.sec })),
      mario: { row: data.mario.row, col: data.mario.col, dir: data.mario.dir },
      spike: data.spike
        ? { row: data.spike.row, col: data.spike.col, dir: data.spike.dir }
        : null,
      enemies: (data.enemies || []).map(e => ({
        enemyType: e.enemyType,
        row: e.row,
        col: e.col,
        dir: e.dir
      })),
      fireballMode: data.fireballMode || "normal"
    };
  }

  function keyOf(row, col) {
    return row + "," + col;
  }

  function hasActorAt(data, row, col) {
    if (data.mario.row === row && data.mario.col === col) return true;
    if (data.spike && data.spike.row === row && data.spike.col === col) return true;
    for (let i = 0; i < data.enemies.length; i++) {
      if (data.enemies[i].row === row && data.enemies[i].col === col) return true;
    }
    return false;
  }

  function findNearestFreeCell(data, startRow, startCol, drumSet) {
    let best = null;
    let bestDist = Infinity;
    for (let r = 0; r < data.rows; r++) {
      for (let c = 0; c < data.cols; c++) {
        if (drumSet.has(keyOf(r, c))) continue;
        const dist = Math.abs(r - startRow) * 2 + Math.abs(c - startCol);
        if (dist < bestDist) {
          bestDist = dist;
          best = { row: r, col: c };
        }
      }
    }
    return best;
  }

  function normalizeStageData(raw, slotIdx = 0) {
    const base = createBlankStage(
      raw && raw.cols != null ? raw.cols : 20,
      raw && raw.rows != null ? raw.rows : 8,
      slotIdx
    );
    if (!raw || typeof raw !== "object") return base;

    if (raw.name) base.name = String(raw.name);
    const cols = base.cols;
    const rows = base.rows;

    const tileMap = new Map();
    if (Array.isArray(raw.tiles)) {
      for (let i = 0; i < raw.tiles.length; i++) {
        const item = raw.tiles[i];
        let r, c, t;
        if (Array.isArray(item)) {
          r = clampInt(item[0], -1, rows, -1);
          c = clampInt(item[1], -1, cols, -1);
          t = Number(item[2]);
        } else if (item && typeof item === "object") {
          r = clampInt(item.row, -1, rows, -1);
          c = clampInt(item.col, -1, cols, -1);
          t = Number(item.tile);
        } else {
          continue;
        }
        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
        if (isEdgeSafeCol(c, cols)) continue;
        if (!Number.isFinite(t) || t === TILE.EMPTY) continue;
        if (t === TILE.HOLE && r >= rows - 1) continue;
        tileMap.set(keyOf(r, c), { row: r, col: c, tile: t });
      }
    }

    const tbSecMap = new Map();
    if (Array.isArray(raw.timedBombs)) {
      for (let i = 0; i < raw.timedBombs.length; i++) {
        const tb = raw.timedBombs[i];
        if (!tb) continue;
        const r = clampInt(tb.row, -1, rows, -1);
        const c = clampInt(tb.col, -1, cols, -1);
        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
        tbSecMap.set(keyOf(r, c), normalizeTimedSec(tb.sec));
      }
    }

    const defaultTbSec = normalizeTimedSec(raw.timedBombSec);
    const sortedTiles = Array.from(tileMap.values()).sort((a, b) => (a.row - b.row) || (a.col - b.col));
    base.tiles = sortedTiles;
    base.timedBombs = [];
    const drumSet = new Set();
    for (let i = 0; i < sortedTiles.length; i++) {
      const cell = sortedTiles[i];
      if (cell.tile === TILE.DRUM) {
        drumSet.add(keyOf(cell.row, cell.col));
      }
      if (cell.tile === TILE.TIMED_BOMB) {
        const k = keyOf(cell.row, cell.col);
        base.timedBombs.push({
          row: cell.row,
          col: cell.col,
          sec: tbSecMap.has(k) ? tbSecMap.get(k) : defaultTbSec
        });
      }
    }

    function parseActorPos(src, fallbackPos, fallbackDir) {
      if (!src || typeof src !== "object") {
        return { row: fallbackPos.row, col: fallbackPos.col, dir: fallbackDir };
      }
      let r = fallbackPos.row;
      let c = fallbackPos.col;
      if (src.row != null && src.col != null) {
        r = clampInt(src.row, 0, rows - 1, fallbackPos.row);
        c = clampInt(src.col, 0, cols - 1, fallbackPos.col);
      } else if (src.x != null && src.y != null) {
        c = clampInt(Math.floor((Number(src.x) + 8) / 16), 0, cols - 1, fallbackPos.col);
        r = clampInt(Math.floor((Number(src.y) - 32) / 32), 0, rows - 1, fallbackPos.row);
      }
      return { row: r, col: c, dir: normalizeDir(src.dir != null ? src.dir : src.facing, fallbackDir) };
    }

    base.mario = parseActorPos(raw.mario, base.mario, RIGHT);
    if (drumSet.has(keyOf(base.mario.row, base.mario.col))) {
      const free = findNearestFreeCell(base, base.mario.row, base.mario.col, drumSet);
      if (free) {
        base.mario.row = free.row;
        base.mario.col = free.col;
      }
    }

    if (raw.spike === null || raw.spike === false || raw.hasSpike === false) {
      base.spike = null;
    } else {
      base.spike = parseActorPos(raw.spike, base.spike, LEFT);
      if (drumSet.has(keyOf(base.spike.row, base.spike.col))) {
        const free = findNearestFreeCell(base, base.spike.row, base.spike.col, drumSet);
        if (free) {
          base.spike.row = free.row;
          base.spike.col = free.col;
        }
      }
    }

    const enemyList = [];
    const seenEnemy = new Set();
    if (Array.isArray(raw.enemies)) {
      for (let i = 0; i < raw.enemies.length; i++) {
        if (enemyList.length >= MAX_ENEMIES) break;
        const e = raw.enemies[i];
        if (!e || typeof e !== "object") continue;
        const type = (e.enemyType === "spanagonFast" || e.enemyType === "eggplant") ? e.enemyType : "spanagon";
        const pos = parseActorPos(e, { row: rows - 1, col: Math.min(cols - 3, 8) }, LEFT);
        const k = keyOf(pos.row, pos.col);
        if (seenEnemy.has(k)) continue;
        if (drumSet.has(k)) {
          const free = findNearestFreeCell(base, pos.row, pos.col, drumSet);
          if (!free) continue;
          pos.row = free.row;
          pos.col = free.col;
        }
        seenEnemy.add(keyOf(pos.row, pos.col));
        enemyList.push({
          enemyType: type,
          row: pos.row,
          col: pos.col,
          dir: pos.dir
        });
      }
    }
    base.enemies = enemyList;

    if (raw.fireballMode === "off" || raw.fireballMode === "fast" || raw.fireballMode === "normal") {
      base.fireballMode = raw.fireballMode;
    } else if (raw.fireball === false) {
      base.fireballMode = "off";
    } else if (raw.fireballFast) {
      base.fireballMode = "fast";
    } else {
      base.fireballMode = "normal";
    }

    return base;
  }

  function resizeStageData(data, newCols, newRows) {
    const copy = cloneStageData(data);
    copy.cols = clampInt(newCols, 14, 24, data.cols);
    copy.rows = clampInt(newRows, 6, 10, data.rows);
    return normalizeStageData(copy);
  }

  function getTileAt(data, row, col) {
    for (let i = 0; i < data.tiles.length; i++) {
      if (data.tiles[i].row === row && data.tiles[i].col === col) {
        return data.tiles[i].tile;
      }
    }
    return TILE.EMPTY;
  }

  function getTimedBombSecAt(data, row, col) {
    for (let i = 0; i < data.timedBombs.length; i++) {
      if (data.timedBombs[i].row === row && data.timedBombs[i].col === col) {
        return data.timedBombs[i].sec;
      }
    }
    return 30;
  }

  function setTileAt(data, row, col, tileVal, timedSec = 30) {
    if (row < 0 || row >= data.rows || col < 0 || col >= data.cols) {
      return { ok: false, changed: false, message: "範囲外です" };
    }
    if (isEdgeSafeCol(col, data.cols)) {
      if (tileVal === TILE.EMPTY) {
        return { ok: true, changed: false };
      }
      return { ok: false, changed: false, message: "両端2列は通路専用のため置けません" };
    }
    if (tileVal === TILE.HOLE && row >= data.rows - 1) {
      return { ok: false, changed: false, message: "一番下の段には穴を作れません" };
    }
    if (tileVal === TILE.DRUM && hasActorAt(data, row, col)) {
      return { ok: false, changed: false, message: "キャラがいるマスにはドラム缶を置けません" };
    }
    if (tileVal === TILE.PILLAR) {
      const aboveIsPillar = row > 0 && getTileAt(data, row - 1, col) === TILE.PILLAR;
      const belowIsPillar = row < data.rows - 1 && getTileAt(data, row + 1, col) === TILE.PILLAR;
      if (aboveIsPillar || belowIsPillar) {
        return { ok: false, changed: false, message: "鉄柱は縦に2つ連続して置けません" };
      }
    }

    const validSec = normalizeTimedSec(timedSec);
    let changed = false;

    const existingIdx = data.tiles.findIndex(t => t.row === row && t.col === col);
    if (tileVal === TILE.EMPTY) {
      if (existingIdx >= 0) {
        data.tiles.splice(existingIdx, 1);
        changed = true;
      }
    } else if (existingIdx >= 0) {
      if (data.tiles[existingIdx].tile !== tileVal) {
        data.tiles[existingIdx].tile = tileVal;
        changed = true;
      }
    } else {
      data.tiles.push({ row, col, tile: tileVal });
      data.tiles.sort((a, b) => (a.row - b.row) || (a.col - b.col));
      changed = true;
    }

    const tbIdx = data.timedBombs.findIndex(tb => tb.row === row && tb.col === col);
    if (tileVal === TILE.TIMED_BOMB) {
      if (tbIdx >= 0) {
        if (data.timedBombs[tbIdx].sec !== validSec) {
          data.timedBombs[tbIdx].sec = validSec;
          changed = true;
        }
      } else {
        data.timedBombs.push({ row, col, sec: validSec });
        data.timedBombs.sort((a, b) => (a.row - b.row) || (a.col - b.col));
        changed = true;
      }
    } else if (tbIdx >= 0) {
      data.timedBombs.splice(tbIdx, 1);
      changed = true;
    }

    return { ok: true, changed };
  }

  function removeEnemyAt(data, row, col) {
    const idx = data.enemies.findIndex(e => e.row === row && e.col === col);
    if (idx >= 0) {
      data.enemies.splice(idx, 1);
      return true;
    }
    return false;
  }

  function applyToolAt(data, toolId, row, col, opts = {}) {
    if (row < 0 || row >= data.rows || col < 0 || col >= data.cols) {
      return { ok: false, changed: false, message: "範囲外です" };
    }
    const tool = EDITOR_TOOLS.find(t => t.id === toolId);
    if (!tool) return { ok: false, changed: false };

    const timedSec = normalizeTimedSec(opts.timedSec);
    const actorDir = normalizeDir(opts.actorDir, LEFT);
    const isDrag = !!opts.isDrag;

    if (tool.kind === "erase") {
      const removedEnemy = removeEnemyAt(data, row, col);
      let removedSpike = false;
      if (data.spike && data.spike.row === row && data.spike.col === col) {
        data.spike = null;
        removedSpike = true;
      }
      const tileRes = setTileAt(data, row, col, TILE.EMPTY, timedSec);
      const anyChanged = removedEnemy || removedSpike || tileRes.changed;
      return {
        ok: true,
        changed: anyChanged,
        message: anyChanged ? "床（消去）を適用しました" : ""
      };
    }

    if (tool.kind === "tile") {
      return setTileAt(data, row, col, tool.tile, timedSec);
    }

    if (isDrag) {
      return { ok: true, changed: false };
    }

    if (getTileAt(data, row, col) === TILE.DRUM) {
      return { ok: false, changed: false, message: "ドラム缶の上にはキャラを置けません" };
    }

    if (tool.id === "mario") {
      if (data.mario.row === row && data.mario.col === col) {
        data.mario.dir = data.mario.dir === RIGHT ? LEFT : RIGHT;
        return { ok: true, changed: true, message: "主人公の向きを反転しました" };
      }
      data.mario = { row, col, dir: normalizeDir(opts.actorDir, RIGHT) };
      return { ok: true, changed: true, message: "主人公を配置しました" };
    }

    if (tool.id === "spike") {
      if (data.spike && data.spike.row === row && data.spike.col === col) {
        data.spike.dir = data.spike.dir === RIGHT ? LEFT : RIGHT;
        return { ok: true, changed: true, message: "親方の向きを反転しました" };
      }
      data.spike = { row, col, dir: actorDir };
      return { ok: true, changed: true, message: "親方を配置しました" };
    }

    if (tool.kind === "enemy") {
      const idx = data.enemies.findIndex(e => e.row === row && e.col === col);
      if (idx >= 0) {
        if (data.enemies[idx].enemyType === tool.enemyType) {
          data.enemies[idx].dir = data.enemies[idx].dir === RIGHT ? LEFT : RIGHT;
          return { ok: true, changed: true, message: tool.label + "の向きを反転しました" };
        }
        data.enemies[idx].enemyType = tool.enemyType;
        data.enemies[idx].dir = actorDir;
        return { ok: true, changed: true, message: tool.label + "に変更しました" };
      }
      if (data.enemies.length >= MAX_ENEMIES) {
        return { ok: false, changed: false, message: "ザコ敵は最大" + MAX_ENEMIES + "体まで配置できます" };
      }
      data.enemies.push({
        enemyType: tool.enemyType,
        row,
        col,
        dir: actorDir
      });
      return { ok: true, changed: true, message: tool.label + "を配置しました" };
    }

    return { ok: false, changed: false };
  }

  function countClearTargets(data) {
    let count = 0;
    for (let i = 0; i < data.tiles.length; i++) {
      if (isClearTargetTile(data.tiles[i].tile)) count += 1;
    }
    return count;
  }

  function toWorldConfig(data, options = {}) {
    const cfg = {
      stageNumber: options.stageNumber != null ? options.stageNumber : 1,
      cols: data.cols,
      rows: data.rows,
      tiles: data.tiles.map(t => [t.row, t.col, t.tile]),
      mario: {
        x: data.mario.col * 16,
        y: (data.mario.row + 1) * 32,
        dir: data.mario.dir
      },
      spike: data.spike ? {
        x: data.spike.col * 16,
        y: (data.spike.row + 1) * 32,
        dir: data.spike.dir
      } : null
    };
    if (data.timedBombs.length > 0) {
      cfg.timedBombs = data.timedBombs.map(tb => ({ row: tb.row, col: tb.col, sec: tb.sec }));
    }
    if (data.enemies.length > 0) {
      cfg.enemies = data.enemies.map(e => ({
        enemyType: e.enemyType,
        x: e.col * 16,
        y: (e.row + 1) * 32,
        dir: e.dir
      }));
    }
    if (data.fireballMode === "off") {
      cfg.fireball = false;
    } else if (data.fireballMode === "fast") {
      cfg.fireballFast = true;
    }
    if (options.skipIntro) {
      cfg.skipIntro = true;
    }
    return cfg;
  }

  const TILE_CONST_NAME = {
    [TILE.LADDER]: "L",
    [TILE.SAND_LADDER]: "SL",
    [TILE.DRUM]: "D",
    [TILE.HOLE]: "H",
    [TILE.WALL_1]: "W1",
    [TILE.WALL_2]: "W2",
    [TILE.WALL_3]: "W3",
    [TILE.BOMB]: "B",
    [TILE.TIMED_BOMB]: "TB",
    [TILE.BREAK_LADDER]: "BL",
    [TILE.DOOR]: "DR",
    [TILE.PILLAR]: "P"
  };

  function formatSingleStageJS(data, stageNumber = 1, keyName = "customStage" + stageNumber) {
    const byRow = new Map();
    for (let i = 0; i < data.tiles.length; i++) {
      const t = data.tiles[i];
      if (!byRow.has(t.row)) byRow.set(t.row, []);
      byRow.get(t.row).push(t);
    }
    const tileLines = [];
    const sortedRows = Array.from(byRow.keys()).sort((a, b) => a - b);
    for (let i = 0; i < sortedRows.length; i++) {
      const list = byRow.get(sortedRows[i]);
      const items = list.map(t => "[" + t.row + ", " + t.col + ", " + (TILE_CONST_NAME[t.tile] || ("0x" + t.tile.toString(16))) + "]");
      tileLines.push("        " + items.join(", "));
    }

    const lines = [];
    lines.push("    " + keyName + ": {");
    lines.push("      stageNumber: " + stageNumber + ",");
    lines.push("      cols: " + data.cols + ",");
    lines.push("      rows: " + data.rows + ",");
    if (tileLines.length > 0) {
      lines.push("      tiles: [");
      lines.push(tileLines.join(",\n"));
      lines.push("      ],");
    } else {
      lines.push("      tiles: [],");
    }
    if (data.timedBombs.length > 0) {
      lines.push("      timedBombs: [");
      lines.push(data.timedBombs.map(tb => "        { row: " + tb.row + ", col: " + tb.col + ", sec: " + tb.sec + " }").join(",\n"));
      lines.push("      ],");
    }
    lines.push("      mario: { x: " + (data.mario.col * 16) + ", y: " + ((data.mario.row + 1) * 32) + ", dir: " + (data.mario.dir === LEFT ? "LEFT" : "RIGHT") + " },");
    const spikeLine = data.spike
      ? ("      spike: { x: " + (data.spike.col * 16) + ", y: " + ((data.spike.row + 1) * 32) + ", dir: " + (data.spike.dir === LEFT ? "LEFT" : "RIGHT") + " }")
      : "      spike: null";
    const hasEnemies = data.enemies.length > 0;
    const hasFireballOpt = data.fireballMode !== "normal";
    lines.push(spikeLine + ((hasEnemies || hasFireballOpt) ? "," : ""));
    if (hasEnemies) {
      lines.push("      enemies: [");
      lines.push(data.enemies.map(e =>
        "        { enemyType: \"" + e.enemyType + "\", x: " + (e.col * 16) + ", y: " + ((e.row + 1) * 32) + ", dir: " + (e.dir === LEFT ? "LEFT" : "RIGHT") + " }"
      ).join(",\n"));
      lines.push("      ]" + (hasFireballOpt ? "," : ""));
    }
    if (data.fireballMode === "off") {
      lines.push("      fireball: false");
    } else if (data.fireballMode === "fast") {
      lines.push("      fireballFast: true");
    }
    lines.push("    }");
    return lines.join("\n");
  }

  function exportThreeStagesBundle(slots) {
    const out = {};
    for (let i = 0; i < 3; i++) {
      const data = normalizeStageData(slots[i], i);
      out["demo" + (i + 1)] = toWorldConfig(data, { stageNumber: i + 1 });
    }
    return JSON.stringify(out);
  }

  function loadSlotsFromStorage() {
    const slots = [
      createBlankStage(20, 8, 0),
      createBlankStage(20, 8, 1),
      createBlankStage(20, 8, 2)
    ];
    try {
      if (!root.localStorage) return slots;
      const raw = root.localStorage.getItem(STORAGE_KEY);
      if (!raw) return slots;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return slots;
      for (let i = 0; i < 3; i++) {
        if (parsed[i]) {
          slots[i] = normalizeStageData(parsed[i], i);
        }
      }
    } catch (_) {}
    return slots;
  }

  function saveSlotsToStorage(slots) {
    try {
      if (!root.localStorage) return false;
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
      return true;
    } catch (_) {
      return false;
    }
  }

  function drawOutlinedText(ctx, text, x, y, color) {
    ctx.font = "bold 7px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(4, 6, 14, 0.95)";
    ctx.lineWidth = 2.4;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawEditorOverlay(ctx, data, state = {}) {
    const cols = data.cols;
    const rows = data.rows;
    const w = cols * 16;
    const h = rows * 32;

    ctx.save();
    ctx.translate(0, 24);

    // 左右端2列の通行専用ゾーン表示
    if (cols > EDGE_SAFE_COLS * 2) {
      const edgeW = EDGE_SAFE_COLS * 16;
      ctx.fillStyle = "rgba(255, 148, 48, 0.10)";
      ctx.fillRect(0, 0, edgeW, h);
      ctx.fillRect(w - edgeW, 0, edgeW, h);

      ctx.strokeStyle = "rgba(255, 170, 72, 0.55)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(edgeW + 0.5, 0);
      ctx.lineTo(edgeW + 0.5, h);
      ctx.moveTo(w - edgeW - 0.5, 0);
      ctx.lineTo(w - edgeW - 0.5, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 薄いマス目グリッド
    ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < cols; c++) {
      ctx.moveTo(c * 16 + 0.5, 0);
      ctx.lineTo(c * 16 + 0.5, h);
    }
    for (let r = 1; r < rows; r++) {
      ctx.moveTo(0, r * 32 + 0.5);
      ctx.lineTo(w, r * 32 + 0.5);
    }
    ctx.stroke();

    // 時限爆弾の秒数ラベル（上の床に重ならない y+23 付近にフチ付きで表示）
    if (data.timedBombs.length > 0) {
      for (let i = 0; i < data.timedBombs.length; i++) {
        const tb = data.timedBombs[i];
        drawOutlinedText(ctx, String(tb.sec), tb.col * 16 + 8, tb.row * 32 + 23, "#ffe066");
      }
    }

    // キャラの位置＆向きマーカー（上の床 y+0..5 を絶対隠さないよう y+7 以降のみ描画）
    function drawActorBadge(row, col, dir, tag, color) {
      const x = col * 16;
      const y = row * 32;
      ctx.save();
      ctx.globalAlpha = 0.68;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 6.5, 15, 25);
      ctx.restore();

      const label = tag + (dir === LEFT ? "←" : "→");
      drawOutlinedText(ctx, label, x + 8, y + 7, color);
    }

    if (data.spike) {
      drawActorBadge(data.spike.row, data.spike.col, data.spike.dir, "親", "#ff8e80");
    }
    for (let i = 0; i < data.enemies.length; i++) {
      const e = data.enemies[i];
      const tag = e.enemyType === "eggplant" ? "緑" : (e.enemyType === "spanagonFast" ? "赤" : "黄");
      const colr = e.enemyType === "eggplant" ? "#98ff70" : (e.enemyType === "spanagonFast" ? "#ff7858" : "#ffe868");
      drawActorBadge(e.row, e.col, e.dir, tag, colr);
    }
    drawActorBadge(data.mario.row, data.mario.col, data.mario.dir, "P", "#68e8ff");

    // 選択中 / ホバー中マスハイライト
    if (state.hoverCell && state.hoverCell.row >= 0 && state.hoverCell.row < rows &&
        state.hoverCell.col >= 0 && state.hoverCell.col < cols) {
      const hx = state.hoverCell.col * 16;
      const hy = state.hoverCell.row * 32;
      ctx.strokeStyle = isEdgeSafeCol(state.hoverCell.col, cols)
        ? "rgba(255, 150, 80, 0.9)"
        : "rgba(120, 235, 255, 0.95)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx + 1, hy + 6, 14, 25);
    }

    ctx.restore();
  }

  const api = {
    EDITOR_TOOLS,
    MAX_ENEMIES,
    createBlankStage,
    cloneStageData,
    normalizeStageData,
    resizeStageData,
    getTileAt,
    getTimedBombSecAt,
    setTileAt,
    applyToolAt,
    countClearTargets,
    toWorldConfig,
    formatSingleStageJS,
    exportThreeStagesBundle,
    loadSlotsFromStorage,
    saveSlotsToStorage,
    drawEditorOverlay
  };

  root.WreckEditor = Object.assign(root.WreckEditor || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : window);
