(function (root) {
  "use strict";

  const G = root.WreckGame || {};
  const TILE = G.TILE || {
    EMPTY: 0x00,
    LADDER: 0x01,
    SAND_LADDER: 0x02,
    DOOR_OPEN: 0x04,
    DOOR_CLOSING_1: 0x05,
    DOOR_CLOSING_2: 0x07,
    WALL: 0x08,
    DRUM: 0x08,
    HOLE: 0x09,
    HOLE_FALLING: 0x0c,
    DRUM_FALLING: 0x0d,
    DOOR_OPENING_2: 0x62,
    DOOR_OPENING_1: 0x63,
    WALL_1: 0xc1,
    WALL_2: 0x92,
    WALL_3: 0xa3,
    BOMB: 0xb1,
    TIMED_BOMB: 0xb2,
    BREAK_LADDER: 0xd1,
    DOOR: 0xe1,
    PILLAR: 0xf1
  };
  const isHoleTile = G.isHoleTile || (t => t >= 0x09 && t <= 0x0b);
  const isCrumblingLadderTile = G.isCrumblingLadderTile || (t => t >= 0x51 && t <= 0x55);
  const isSameLadderType = G.isSameLadderType || ((a, b) =>
    (a === TILE.LADDER && b === TILE.LADDER) ||
    (a === TILE.BREAK_LADDER && b === TILE.BREAK_LADDER) ||
    (a === TILE.SAND_LADDER && b === TILE.SAND_LADDER));
  const EDGE_SAFE_COLS = G.EDGE_SAFE_COLS || 2;
  const isEdgeSafeCol = G.isEdgeSafeCol || ((col, cols) => {
    if (!cols || cols <= EDGE_SAFE_COLS * 2) return false;
    const wc = ((col % cols) + cols) % cols;
    return wc < EDGE_SAFE_COLS || wc >= cols - EDGE_SAFE_COLS;
  });

  const INTRO_START_CAM_Y = -122;
  const INTRO_GROUND_OVERSHOOT = 64;

  const SPACE_STAR_THEMES = [
    { core: "#ffffff", mid: "#a8dcff", outer: "#486eb8" }, // 青白恒星
    { core: "#f4ffff", mid: "#80e2ff", outer: "#386da4" }, // シアン星
    { core: "#fff6ff", mid: "#d49eff", outer: "#64449c" }, // 星雲バイオレット
    { core: "#fffcf0", mid: "#ffe08c", outer: "#946c38" }, // 淡ゴールド恒星
    { core: "#fff2f6", mid: "#ffa4be", outer: "#883e5c" }  // 淡ローズ星
  ];

  // ファミコン8x8タイル基準（実描画7x7、太線ゴシック調）
  const PIXEL_FONT = {
    A: ["0011100", "0111110", "1100011", "1100011", "1111111", "1100011", "1100011"],
    B: ["1111110", "1100011", "1100011", "1111110", "1100011", "1100011", "1111110"],
    C: ["0111110", "1100011", "1100000", "1100000", "1100000", "1100011", "0111110"],
    D: ["1111100", "1100110", "1100011", "1100011", "1100011", "1100110", "1111100"],
    E: ["1111111", "1100000", "1100000", "1111110", "1100000", "1100000", "1111111"],
    F: ["1111111", "1100000", "1100000", "1111110", "1100000", "1100000", "1100000"],
    G: ["0111110", "1100011", "1100000", "1101111", "1100011", "1100011", "0111110"],
    H: ["1100011", "1100011", "1100011", "1111111", "1100011", "1100011", "1100011"],
    I: ["0111110", "0011100", "0011100", "0011100", "0011100", "0011100", "0111110"],
    J: ["0011111", "0001100", "0001100", "0001100", "1101100", "1101100", "0111000"],
    K: ["1100011", "1100110", "1101100", "1111000", "1101100", "1100110", "1100011"],
    L: ["1100000", "1100000", "1100000", "1100000", "1100000", "1100000", "1111111"],
    M: ["1100011", "1110111", "1111111", "1101011", "1100011", "1100011", "1100011"],
    N: ["1100011", "1110011", "1111011", "1101111", "1100111", "1100011", "1100011"],
    O: ["0111110", "1100011", "1100011", "1100011", "1100011", "1100011", "0111110"],
    P: ["1111110", "1100011", "1100011", "1111110", "1100000", "1100000", "1100000"],
    Q: ["0111110", "1100011", "1100011", "1100011", "1101011", "1100110", "0111101"],
    R: ["1111110", "1100011", "1100011", "1111110", "1101100", "1100110", "1100011"],
    S: ["0111110", "1100011", "1100000", "0111110", "0000011", "1100011", "0111110"],
    T: ["1111111", "0011100", "0011100", "0011100", "0011100", "0011100", "0011100"],
    U: ["1100011", "1100011", "1100011", "1100011", "1100011", "1100011", "0111110"],
    V: ["1100011", "1100011", "1100011", "1100011", "0110110", "0111110", "0011100"],
    W: ["1100011", "1100011", "1100011", "1101011", "1111111", "1110111", "1100011"],
    X: ["1100011", "1100011", "0110110", "0011100", "0110110", "1100011", "1100011"],
    Y: ["1100011", "1100011", "0110110", "0011100", "0011100", "0011100", "0011100"],
    Z: ["1111111", "0000111", "0001110", "0011100", "0111000", "1110000", "1111111"],
    "0": ["0111110", "1100011", "1100111", "1101011", "1110011", "1100011", "0111110"],
    "1": ["0011100", "0111100", "0011100", "0011100", "0011100", "0011100", "0111110"],
    "2": ["0111110", "1100011", "0000011", "0011110", "0111000", "1100000", "1111111"],
    "3": ["0111110", "1100011", "0000011", "0011110", "0000011", "1100011", "0111110"],
    "4": ["0001110", "0011110", "0110110", "1100110", "1111111", "0000110", "0000110"],
    "5": ["1111111", "1100000", "1111110", "0000011", "0000011", "1100011", "0111110"],
    "6": ["0111110", "1100000", "1100000", "1111110", "1100011", "1100011", "0111110"],
    "7": ["1111111", "1100011", "0000011", "0000110", "0001100", "0001100", "0001100"],
    "8": ["0111110", "1100011", "1100011", "0111110", "1100011", "1100011", "0111110"],
    "9": ["0111110", "1100011", "1100011", "0111111", "0000011", "0000011", "0111110"],
    "!": ["0111110", "0111110", "0011100", "0011100", "0011100", "0000000", "0011100"],
    "-": ["0000000", "0000000", "0000000", "0111110", "0000000", "0000000", "0000000"],
    ":": ["0000000", "0011100", "0011100", "0000000", "0011100", "0011100", "0000000"],
    " ": ["0000000", "0000000", "0000000", "0000000", "0000000", "0000000", "0000000"]
  };

  function bakeSprite(rows, palette, flipX) {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 26;
    const g = c.getContext("2d");
    for (let y = 0; y < 26; y++) {
      const line = rows[y] || "";
      for (let x = 0; x < 16; x++) {
        const ch = line[x];
        const color = palette[ch];
        if (!color) continue;
        g.fillStyle = color;
        g.fillRect(flipX ? 15 - x : x, y, 1, 1);
      }
    }
    return c;
  }

  function makeSpriteSet(patterns, palette) {
    const set = {};
    for (const [k, rows] of Object.entries(patterns)) {
      set[k + "_R"] = bakeSprite(rows, palette, false);
      set[k + "_L"] = bakeSprite(rows, palette, true);
    }
    return set;
  }

  class Renderer {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.ctx.imageSmoothingEnabled = false;
      this.viewHeight = options.viewHeight || 240;
      this.camY = 0;
      this.isIntroCamMoving = false;
      this.startBannerBlinkTick = 0;
      this.lastStartBannerTimer = null;
      this.bannerCache = new Map();
      this.spaceGradient = null;
      this.spaceFieldCache = new Map();

      this.marioSprites = {};
      this.spikeSprites = {};
      if (typeof this.initActorSprites === "function") {
        this.initActorSprites();
      }
      this.wireFencePattern = this.makeWireFencePattern();
      this.floorBlockPattern = this.makeFloorBlockPattern();
    }

    getSpaceField(w) {
      const cached = this.spaceFieldCache.get(w);
      if (cached) return cached;
      if (this.spaceFieldCache.size > 12) {
        this.spaceFieldCache.clear();
      }

      let seed = (0x5a17c391 ^ Math.imul(w | 0, 2654435761)) >>> 0;
      const rand = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      const stars = [];
      const nebula = [];
      const cols = Math.max(1, Math.floor(w / 16));
      const bandTop = -123;
      const rowH = 14;
      const rows = 8; // -123 .. -12

      // 遠い深宇宙の淡い星雲微粒子（斜めの銀河帯）
      const nebulaColors = ["#384a86", "#4f3e7c", "#2d5584"];
      for (let i = 0; i < cols * 2; i++) {
        const nx = Math.floor(rand() * w);
        const t = w > 1 ? nx / w : 0.5;
        const centerY = -44 - t * 48 + Math.sin(t * Math.PI * 2.2) * 14;
        const ny = Math.round(centerY + (rand() - 0.5) * 32);
        if (ny < -123 || ny > -12) continue;
        nebula.push({
          x: nx,
          y: ny,
          w: rand() < 0.25 ? 2 : 1,
          color: nebulaColors[Math.floor(rand() * nebulaColors.length)],
          alpha: 0.14 + rand() * 0.10
        });
      }

      // 層状配置でバランス良く宇宙の星々を配置
      for (let r = 0; r < rows; r++) {
        const yMin = bandTop + r * rowH;
        const yMax = Math.min(-12, yMin + rowH - 2);
        for (let c = 0; c < cols; c++) {
          if (rand() > 0.44) continue;
          const xMin = c * 16 + 2;
          const xMax = Math.min(w - 3, xMin + 12);
          if (xMax < xMin) continue;

          const sx = xMin + Math.floor(rand() * (xMax - xMin + 1));
          const sy = yMin + Math.floor(rand() * (yMax - yMin + 1));
          const roll = rand();

          let type = 0;
          if (roll > 0.94 && r < rows - 1) {
            type = 3; // 主役の輝き星（5x5までキラッと広がる）
          } else if (roll > 0.80) {
            type = 2; // キラキラ十字星（3x3）
          } else if (roll > 0.58) {
            type = 1; // 瞬き小星
          }

          const themeRoll = rand();
          let themeIdx = 0;
          if (themeRoll > 0.90) themeIdx = 4;
          else if (themeRoll > 0.72) themeIdx = 3;
          else if (themeRoll > 0.48) themeIdx = 2;
          else if (themeRoll > 0.24) themeIdx = 1;

          stars.push({
            x: sx,
            y: sy,
            type,
            theme: SPACE_STAR_THEMES[themeIdx],
            phase: Math.floor(rand() * 256),
            speed: type === 0
              ? (18 + Math.floor(rand() * 16))
              : (type === 1 ? (10 + Math.floor(rand() * 8)) : (6 + Math.floor(rand() * 4)))
          });
        }
      }

      const field = { stars, nebula };
      this.spaceFieldCache.set(w, field);
      return field;
    }

    drawSpaceSky(ctx, w, camOffset, viewH, world) {
      if (camOffset >= 0) return;
      const visTop = camOffset;
      const visBottom = Math.min(0, camOffset + viewH);
      if (visBottom <= visTop) return;

      if (!this.spaceGradient) {
        const grad = ctx.createLinearGradient(0, -126, 0, 0);
        grad.addColorStop(0.00, "#03040a");
        grad.addColorStop(0.26, "#080c1e");
        grad.addColorStop(0.56, "#14173b");
        grad.addColorStop(0.84, "#0b122a");
        grad.addColorStop(1.00, "#080b14");
        this.spaceGradient = grad;
      }

      ctx.save();
      ctx.fillStyle = this.spaceGradient;
      ctx.fillRect(0, visTop, w, visBottom - visTop);

      const field = this.getSpaceField(w);
      for (let i = 0; i < field.nebula.length; i++) {
        const n = field.nebula[i];
        if (n.y < visTop || n.y >= visBottom) continue;
        ctx.globalAlpha = n.alpha;
        ctx.fillStyle = n.color;
        ctx.fillRect(n.x, n.y, n.w, 1);
      }

      const animFrame = (world.introFrame || 0) + (world.f || 0);
      for (let i = 0; i < field.stars.length; i++) {
        const s = field.stars[i];
        if (s.y + 2 < visTop || s.y - 2 >= visBottom) continue;

        const tick = Math.floor((animFrame + s.phase) / s.speed);
        const th = s.theme;

        if (s.type === 0) {
          const step = tick & 3;
          ctx.globalAlpha = step === 2 ? 0.85 : (step === 0 ? 0.45 : 0.65);
          ctx.fillStyle = step === 2 ? th.mid : th.outer;
          ctx.fillRect(s.x, s.y, 1, 1);
        } else if (s.type === 1) {
          const step = tick & 3;
          if (step === 1) {
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = th.core;
            ctx.fillRect(s.x, s.y, 1, 1);
          } else if (step === 2) {
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = th.core;
            ctx.fillRect(s.x, s.y, 1, 1);
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = th.mid;
            ctx.fillRect(s.x + 1, s.y, 1, 1);
          } else {
            ctx.globalAlpha = 0.72;
            ctx.fillStyle = th.mid;
            ctx.fillRect(s.x, s.y, 1, 1);
          }
        } else if (s.type === 2) {
          const step = tick % 8;
          if (step < 3) {
            ctx.globalAlpha = 0.82;
            ctx.fillStyle = th.mid;
            ctx.fillRect(s.x, s.y, 1, 1);
          } else if (step === 3 || step === 6) {
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = th.core;
            ctx.fillRect(s.x, s.y, 1, 1);
            ctx.globalAlpha = 0.75;
            ctx.fillStyle = th.outer;
            ctx.fillRect(s.x - 1, s.y, 1, 1);
            ctx.fillRect(s.x + 1, s.y, 1, 1);
            ctx.fillRect(s.x, s.y - 1, 1, 1);
            ctx.fillRect(s.x, s.y + 1, 1, 1);
          } else if (step === 4) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = th.core;
            ctx.fillRect(s.x, s.y, 1, 1);
            ctx.fillStyle = th.mid;
            ctx.fillRect(s.x - 1, s.y, 1, 1);
            ctx.fillRect(s.x + 1, s.y, 1, 1);
            ctx.fillRect(s.x, s.y - 1, 1, 1);
            ctx.fillRect(s.x, s.y + 1, 1, 1);
            ctx.globalAlpha = 0.42;
            ctx.fillStyle = th.outer;
            ctx.fillRect(s.x - 1, s.y - 1, 1, 1);
            ctx.fillRect(s.x + 1, s.y - 1, 1, 1);
            ctx.fillRect(s.x - 1, s.y + 1, 1, 1);
            ctx.fillRect(s.x + 1, s.y + 1, 1, 1);
          } else if (step === 5) {
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = th.core;
            ctx.fillRect(s.x, s.y, 1, 1);
            ctx.fillStyle = th.mid;
            ctx.fillRect(s.x - 1, s.y, 1, 1);
            ctx.fillRect(s.x + 1, s.y, 1, 1);
            ctx.fillRect(s.x, s.y - 1, 1, 1);
            ctx.fillRect(s.x, s.y + 1, 1, 1);
          } else {
            ctx.globalAlpha = 0.88;
            ctx.fillStyle = th.mid;
            ctx.fillRect(s.x, s.y, 1, 1);
          }
        } else {
          const step = tick % 10;
          if (step < 4) {
            ctx.globalAlpha = 0.92;
            ctx.fillStyle = th.core;
            ctx.fillRect(s.x, s.y, 1, 1);
            ctx.globalAlpha = 0.60;
            ctx.fillStyle = th.outer;
            ctx.fillRect(s.x - 1, s.y, 1, 1);
            ctx.fillRect(s.x + 1, s.y, 1, 1);
            ctx.fillRect(s.x, s.y - 1, 1, 1);
            ctx.fillRect(s.x, s.y + 1, 1, 1);
          } else if (step === 4 || step === 7) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = th.core;
            ctx.fillRect(s.x, s.y, 1, 1);
            ctx.fillStyle = th.mid;
            ctx.fillRect(s.x - 1, s.y, 1, 1);
            ctx.fillRect(s.x + 1, s.y, 1, 1);
            ctx.fillRect(s.x, s.y - 1, 1, 1);
            ctx.fillRect(s.x, s.y + 1, 1, 1);
          } else if (step === 5) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = th.core;
            ctx.fillRect(s.x, s.y, 1, 1);
            ctx.fillStyle = th.mid;
            ctx.fillRect(s.x - 1, s.y, 1, 1);
            ctx.fillRect(s.x + 1, s.y, 1, 1);
            ctx.fillRect(s.x, s.y - 1, 1, 1);
            ctx.fillRect(s.x, s.y + 1, 1, 1);
            ctx.globalAlpha = 0.78;
            ctx.fillStyle = th.outer;
            ctx.fillRect(s.x - 2, s.y, 1, 1);
            ctx.fillRect(s.x + 2, s.y, 1, 1);
            ctx.fillRect(s.x, s.y - 2, 1, 1);
            ctx.fillRect(s.x, s.y + 2, 1, 1);
            ctx.globalAlpha = 0.45;
            ctx.fillRect(s.x - 1, s.y - 1, 1, 1);
            ctx.fillRect(s.x + 1, s.y - 1, 1, 1);
            ctx.fillRect(s.x - 1, s.y + 1, 1, 1);
            ctx.fillRect(s.x + 1, s.y + 1, 1, 1);
          } else if (step === 6) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = th.core;
            ctx.fillRect(s.x, s.y, 1, 1);
            ctx.fillStyle = th.mid;
            ctx.fillRect(s.x - 1, s.y - 1, 1, 1);
            ctx.fillRect(s.x + 1, s.y - 1, 1, 1);
            ctx.fillRect(s.x - 1, s.y + 1, 1, 1);
            ctx.fillRect(s.x + 1, s.y + 1, 1, 1);
            ctx.globalAlpha = 0.70;
            ctx.fillStyle = th.outer;
            ctx.fillRect(s.x - 1, s.y, 1, 1);
            ctx.fillRect(s.x + 1, s.y, 1, 1);
            ctx.fillRect(s.x, s.y - 1, 1, 1);
            ctx.fillRect(s.x, s.y + 1, 1, 1);
          } else {
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = th.mid;
            ctx.fillRect(s.x, s.y, 1, 1);
          }
        }
      }

      ctx.restore();
    }

    makeWireFencePattern() {
      const c = document.createElement("canvas");
      c.width = 8;
      c.height = 8;
      const g = c.getContext("2d");
      for (let i = 0; i < 8; i++) {
        g.fillStyle = "#8a94a6";
        g.fillRect(i, i, 1, 1);
        g.fillStyle = "#727c8e";
        g.fillRect(7 - i, i, 1, 1);
      }
      g.fillStyle = "#aab4c4";
      g.fillRect(0, 0, 1, 1);
      g.fillRect(7, 0, 1, 1);
      g.fillRect(3, 3, 2, 2);
      g.fillRect(0, 7, 1, 1);
      g.fillRect(7, 7, 1, 1);
      return this.ctx.createPattern(c, "repeat");
    }

    makeFloorBlockPattern() {
      const c = document.createElement("canvas");
      c.width = 8;
      c.height = 8;
      const g = c.getContext("2d");
      // 8x8 正方形の青ブロック（立体縁取り＋内側デザイン入り）
      g.fillStyle = "#1e4498";
      g.fillRect(0, 0, 8, 8);
      // 上・左のハイライト
      g.fillStyle = "#4278d8";
      g.fillRect(0, 0, 7, 1);
      g.fillRect(0, 0, 1, 7);
      g.fillStyle = "#78a8ff";
      g.fillRect(0, 0, 1, 1);
      // 下・右の暗影（目地）
      g.fillStyle = "#0c183c";
      g.fillRect(0, 7, 8, 1);
      g.fillRect(7, 0, 1, 8);
      // 内側のちょっとした凹凸デザイン
      g.fillStyle = "#142e72";
      g.fillRect(2, 2, 4, 1);
      g.fillRect(2, 2, 1, 4);
      g.fillStyle = "#2b5cc2";
      g.fillRect(3, 5, 3, 1);
      g.fillRect(5, 3, 1, 3);
      return this.ctx.createPattern(c, "repeat");
    }

    ensureCanvasSize(world) {
      const targetW = world.worldWidth;
      const targetH = this.viewHeight;
      if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
        this.canvas.width = targetW;
        this.canvas.height = targetH;
        this.ctx.imageSmoothingEnabled = false;
      }
      this.canvas.style.aspectRatio = targetW + " / " + targetH;
    }

    getWorldHeight(world) {
      return world.rows * 32 + 24;
    }

    getBaseCamY(world) {
      const minCamY = -24;
      const maxCamY = Math.max(minCamY, this.getWorldHeight(world) - this.viewHeight);
      const targetY = Math.round(world.mario.y - this.viewHeight * 0.58);
      return Math.max(minCamY, Math.min(maxCamY, targetY));
    }

    resetCamera(world) {
      this.isIntroCamMoving = false;
      this.startBannerBlinkTick = 0;
      this.lastStartBannerTimer = null;
      this.camY = world.introActive ? INTRO_START_CAM_Y : this.getBaseCamY(world);
    }

    updateCamera(world) {
      const minCamY = -24;
      const maxCamY = Math.max(minCamY, this.getWorldHeight(world) - this.viewHeight);
      const baseCamY = this.getBaseCamY(world);

      if (world.snapCameraRequested) {
        world.snapCameraRequested = false;
        this.camY = baseCamY;
        this.isIntroCamMoving = false;
        return;
      }

      if (world.marioDead || world.clearPhase === 2) {
        this.isIntroCamMoving = false;
        return;
      }

      if (world.introActive) {
        const t = world.introFrame || 0;
        const total = world.introTotalFrames || 288;
        const holdStart = 12;
        const holdEnd = 18;
        const moveBudget = Math.max(60, total - holdStart - holdEnd);
        const introStart = INTRO_START_CAM_Y;
        const introBottom = maxCamY + INTRO_GROUND_OVERSHOOT;
        const dDown = Math.max(1, introBottom - introStart);
        const dUp = Math.max(1, introBottom - baseCamY);
        const downFrames = Math.max(30, Math.min(moveBudget - 30, Math.round(moveBudget * (dDown / (dDown + dUp)))));
        const upFrames = moveBudget - downFrames;
        const downEnd = holdStart + downFrames;
        const upEnd = holdStart + moveBudget;

        if (t <= holdStart) {
          this.camY = introStart;
          this.isIntroCamMoving = false;
        } else if (t < downEnd) {
          const p = (t - holdStart) / downFrames;
          this.camY = introStart + dDown * p;
          this.isIntroCamMoving = true;
        } else if (t === downEnd) {
          this.camY = introBottom;
          this.isIntroCamMoving = true;
        } else if (t < upEnd) {
          const p = (t - downEnd) / upFrames;
          this.camY = introBottom - dUp * p;
          this.isIntroCamMoving = true;
        } else {
          this.camY = baseCamY;
          this.isIntroCamMoving = false;
        }
        return;
      }

      this.isIntroCamMoving = false;
      if (maxCamY === minCamY) {
        this.camY = minCamY;
        return;
      }
      const diff = baseCamY - this.camY;
      if (Math.abs(diff) <= 1.5) {
        this.camY = baseCamY;
      } else {
        this.camY += diff * 0.2;
      }
    }

    getBannerCanvas(text) {
      const str = String(text || "").toUpperCase();
      const cached = this.bannerCache.get(str);
      if (cached) return cached;
      if (this.bannerCache.size > 120) {
        this.bannerCache.clear();
      }

      const scale = 2;
      const glyphW = 7;
      const glyphH = 7;
      const stepX = 8; // 7px文字 + 1px文字間（8x8グリッド基準）
      const gridW = Math.max(1, str.length * stepX - 1);
      const gridH = glyphH;
      const padLeft = 1;
      const padTop = 1;
      const totalGridW = gridW + 3; // 左1ドット縁 + 右2ドット(縁+影)
      const totalGridH = gridH + 3; // 上1ドット縁 + 下2ドット(縁+影)

      const body = new Uint8Array(totalGridW * totalGridH);
      for (let i = 0; i < str.length; i++) {
        const glyph = PIXEL_FONT[str[i]] || PIXEL_FONT[" "];
        const baseX = padLeft + i * stepX;
        for (let r = 0; r < glyphH; r++) {
          const line = glyph[r];
          const rowOff = (padTop + r) * totalGridW;
          for (let c = 0; c < glyphW; c++) {
            if (line[c] === "1") {
              body[rowOff + baseX + c] = 1;
            }
          }
        }
      }

      const pw = totalGridW * scale;
      const ph = totalGridH * scale;
      const canvas = document.createElement("canvas");
      canvas.width = pw;
      canvas.height = ph;
      const g = canvas.getContext("2d");

      const hasBody = (gx, gy) => {
        if (gx < 0 || gy < 0 || gx >= totalGridW || gy >= totalGridH) return false;
        return body[gy * totalGridW + gx] === 1;
      };

      // 文字と同じドット粒度(scale=2)の黒縁取り ＋ 右下1ドット立体影
      g.fillStyle = "#04060c";
      for (let gy = 0; gy < totalGridH; gy++) {
        for (let gx = 0; gx < totalGridW; gx++) {
          if (hasBody(gx, gy)) continue;
          let hit = false;
          for (let dy = -1; dy <= 1 && !hit; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (hasBody(gx + dx, gy + dy) || hasBody(gx - 1 + dx, gy - 1 + dy)) {
                hit = true;
                break;
              }
            }
          }
          if (hit) {
            g.fillRect(gx * scale, gy * scale, scale, scale);
          }
        }
      }

      // 文字本体（白単色）
      g.fillStyle = "#ffffff";
      for (let gy = 0; gy < totalGridH; gy++) {
        for (let gx = 0; gx < totalGridW; gx++) {
          if (hasBody(gx, gy)) {
            g.fillRect(gx * scale, gy * scale, scale, scale);
          }
        }
      }

      this.bannerCache.set(str, canvas);
      return canvas;
    }

    drawBannerText(ctx, canvasW, text, centerY) {
      const img = this.getBannerCanvas(text);
      const x = Math.round((canvasW - img.width) / 2);
      const y = Math.round(centerY - img.height / 2);
      ctx.drawImage(img, x, y);
    }

    drawRoof(ctx, w) {
      // 天井の屋根（平べったい台形シルエット＋ブロック模様：y = -9 .. 6、下端6pxで1段目の縦幅を他段と統一）
      ctx.fillStyle = "#1e4498";
      ctx.fillRect(10, -9, Math.max(0, w - 20), 2);
      ctx.fillRect(6, -7, Math.max(0, w - 12), 3);
      ctx.fillRect(2, -4, Math.max(0, w - 4), 4);

      // 上面の明るいハイライト＆肩の縁
      ctx.fillStyle = "#689cff";
      ctx.fillRect(10, -9, Math.max(0, w - 20), 1);
      ctx.fillRect(6, -7, 4, 1);
      ctx.fillRect(w - 10, -7, 4, 1);
      ctx.fillStyle = "#4278d8";
      ctx.fillRect(2, -4, 4, 1);
      ctx.fillRect(w - 6, -4, 4, 1);
      ctx.fillRect(10, -8, Math.max(0, w - 20), 1);

      // 屋根の縦目地・デザインリブ（8px単位で屋根瓦／板金風）
      for (let x = 8; x < w - 8; x += 8) {
        const topY = (x >= 10 && x < w - 10) ? -8 : -6;
        ctx.fillStyle = "#0c183c";
        ctx.fillRect(x, topY, 1, -topY);
        ctx.fillStyle = "#3468c8";
        ctx.fillRect(x + 1, topY, 1, -topY);
      }

      // 屋根上部の平べったい装飾凹み（16px単位）
      for (let x = 16; x < w - 24; x += 16) {
        ctx.fillStyle = "#142e72";
        ctx.fillRect(x + 4, -5, 8, 2);
        ctx.fillStyle = "#2b5cc2";
        ctx.fillRect(x + 4, -3, 8, 1);
      }

      // 軒先の横桁・平べったい青ブロック帯（y = 0 .. 6、他段鉄骨と同じ6px厚）
      ctx.fillStyle = "#1e4498";
      ctx.fillRect(0, 0, w, 6);
      ctx.fillStyle = "#4278d8";
      ctx.fillRect(0, 0, w, 1);
      ctx.fillStyle = "#0c183c";
      ctx.fillRect(0, 5, w, 1);
      for (let x = 0; x < w; x += 8) {
        ctx.fillStyle = "#4278d8";
        ctx.fillRect(x, 0, 1, 5);
        ctx.fillStyle = "#0c183c";
        ctx.fillRect(x + 7, 0, 1, 6);
        ctx.fillStyle = "#142e72";
        ctx.fillRect(x + 2, 2, 4, 2);
      }
    }

    draw(world) {
      this.ensureCanvasSize(world);
      this.updateCamera(world);

      const ctx = this.ctx;
      const w = world.worldWidth;
      const h = this.viewHeight;
      const camOffset = Math.round(this.camY);

      ctx.fillStyle = "#080b14";
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(0, -camOffset);

      // 屋根より上の宇宙空間（深宇宙グラデーション＋キラキラ星、映らない範囲は自動スキップ）
      this.drawSpaceSky(ctx, w, camOffset, h, world);

      // 左右端ループゾーンの目印（ごく薄いガイド線）
      ctx.fillStyle = "rgba(88, 144, 248, 0.08)";
      ctx.fillRect(0, 6, 1, Math.max(0, world.rows * 32 - 6));
      ctx.fillRect(w - 1, 6, 1, Math.max(0, world.rows * 32 - 6));

      // 抜けた穴の背景影（裏側キャラより奥に描き、穴落ち中の体が隠れないようにする）
      ctx.fillStyle = "#0d1222";
      for (let row = 0; row < world.rows - 1; row++) {
        const floorY = (row + 1) * 32;
        for (let col = 0; col < world.cols; col++) {
          const tile = world.getTile(row, col);
          if (isHoleTile(tile) || tile === TILE.HOLE_FALLING) {
            ctx.fillRect(col * 16, floorY, 16, 6);
          }
        }
      }

      // 裏側キャラ層（親方 ＋ 裏ザコ敵：金網・床・扉・ハシゴ・鉄柱・ドラム缶の奥側に描画）
      this.drawActor(world.spike, this.spikeSprites, w, world);
      if (world.enemies) {
        for (const enemy of world.enemies) {
          if (enemy.isBack) this.drawEnemy(enemy, w, world);
        }
      }

      // 画面端2マス（左右合計4マス）の背景金網グラフィック（明るめグレー）
      if (world.cols > EDGE_SAFE_COLS * 2 && this.wireFencePattern) {
        const edgeW = EDGE_SAFE_COLS * 16;
        const fenceTop = 6;
        const fenceH = Math.max(0, world.rows * 32 - fenceTop);
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = this.wireFencePattern;
        ctx.fillRect(0, fenceTop, edgeW, fenceH);
        ctx.translate(w - edgeW, 0);
        ctx.fillRect(0, fenceTop, edgeW, fenceH);
        ctx.restore();
      }

      // 画面外の天井（平べったい青屋根）と画面外の床（小さい正方形の青ブロック）
      this.drawRoof(ctx, w);
      if (this.floorBlockPattern) {
        const floorBottomStartY = world.rows * 32 + 6;
        const viewBottomY = camOffset + h;
        const fillH = viewBottomY - floorBottomStartY;
        if (fillH > 0) {
          ctx.save();
          ctx.translate(0, floorBottomStartY);
          ctx.fillStyle = this.floorBlockPattern;
          ctx.fillRect(0, 0, w, fillH);
          ctx.restore();
        }
      }

      // 床（穴・落下開始穴 $0C および同種連続はしごの中間以外は鉄骨を描画、最下段は常に足場あり）
      for (let row = 0; row < world.rows; row++) {
        const floorY = (row + 1) * 32;
        const isBottomRow = row === world.rows - 1;
        for (let col = 0; col < world.cols; col++) {
          const tile = world.getTile(row, col);
          const belowTile = !isBottomRow ? world.getTile(row + 1, col) : TILE.EMPTY;
          const isContLad = !isBottomRow && (
            isSameLadderType(tile, belowTile) ||
            (tile === TILE.BREAK_LADDER && isCrumblingLadderTile(belowTile)) ||
            (isCrumblingLadderTile(tile) && world.hasCrumblingBelowSame && world.hasCrumblingBelowSame(row, col))
          );
          const x = col * 16;

          if (!isBottomRow && (isHoleTile(tile) || tile === TILE.HOLE_FALLING || isContLad)) {
            continue;
          }
          if (isEdgeSafeCol(col, world.cols)) {
            ctx.fillStyle = "#c86018";
            ctx.fillRect(x, floorY, 16, 6);
            ctx.fillStyle = "#ff9c38";
            ctx.fillRect(x, floorY, 16, 2);
            ctx.fillStyle = "#6e2c08";
            ctx.fillRect(x + 2, floorY + 2, 12, 2);
          } else {
            ctx.fillStyle = "#2858b8";
            ctx.fillRect(x, floorY, 16, 6);
            ctx.fillStyle = "#5890f8";
            ctx.fillRect(x, floorY, 16, 2);
            ctx.fillStyle = "#183070";
            ctx.fillRect(x + 2, floorY + 2, 12, 2);
          }
        }
      }

      // マップタイル
      for (let row = 0; row < world.rows; row++) {
        const yTop = row * 32;
        for (let col = 0; col < world.cols; col++) {
          const val = world.getTile(row, col);
          this.drawTileAt(ctx, col * 16, yTop, val, world);
        }
      }

      // 鉄柱の滞空・落下オブジェクト＋白い床板
      this.drawFallingPillars(ctx, world);

      // 破壊破片エフェクト
      if (world.breakEffects) {
        for (const ef of world.breakEffects) {
          const t = ef.maxTimer - ef.timer;
          const cx = ef.col * 16 + 8;
          const cy = ef.row * 32 + 16;
          if (ef.tile === TILE.BREAK_LADDER) {
            ctx.fillStyle = "#ff88a8";
          } else if (ef.tile === TILE.PILLAR) {
            ctx.fillStyle = "#98acc4";
          } else {
            ctx.fillStyle = "#d07850";
          }
          ctx.fillRect(cx - 4 - t * 0.5, cy - 6 + t * 0.8, 3, 3);
          ctx.fillRect(cx + 2 + t * 0.5, cy - 4 + t * 0.9, 3, 3);
          ctx.fillRect(cx - 5 - t * 0.3, cy + 2 + t * 1.1, 3, 3);
          ctx.fillRect(cx + 3 + t * 0.4, cy + 1 + t * 1.0, 3, 3);
        }
      }

      // 表側キャラ層（表ザコ敵 → プレイヤー → 火の玉、死亡時は最前面へ回す）
      if (world.enemies) {
        for (const enemy of world.enemies) {
          if (!enemy.isBack) this.drawEnemy(enemy, w, world);
        }
      }
      if (!world.marioDead) {
        this.drawActor(world.mario, this.marioSprites, w, world);
      }
      if (world.fireball) {
        this.drawFireball(world.fireball);
      }

      // 爆風・崩落煙エフェクト
      if (world.explosions) {
        for (const ex of world.explosions) {
          const cx = ex.col * 16 + 8;
          const cy = ex.row * 32 + 16;
          const phase = (ex.timer >> 1) & 1;

          if (ex.kind === "spark") {
            ctx.fillStyle = phase ? "#fff080" : "#ff9840";
            ctx.fillRect(cx - 4, cy - 1, 8, 2);
            ctx.fillRect(cx - 1, cy - 4, 2, 8);
          } else if (ex.kind === "wall") {
            const r = Math.max(3, Math.round(8 * (ex.timer / ex.maxTimer)));
            ctx.fillStyle = phase ? "#e89840" : "#b86830";
            ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
            ctx.fillStyle = "#fff090";
            ctx.fillRect(cx - 2, cy - 2, 4, 4);
          } else {
            const isAllDanger = (ex.age || 0) >= 21;
            const r = isAllDanger
              ? 12
              : Math.max(5, Math.round(10 * (0.4 + 0.6 * (ex.timer / ex.maxTimer))));
            ctx.fillStyle = isAllDanger
              ? (phase ? "#ff2820" : "#ffffff")
              : (phase ? "#ff5820" : "#ffa820");
            ctx.fillRect(cx - r, cy - 4, r * 2, 8);
            ctx.fillRect(cx - 4, cy - r, 8, r * 2);
            ctx.fillStyle = isAllDanger
              ? (phase ? "#ffff80" : "#ff5020")
              : (phase ? "#fff058" : "#ffffff");
            ctx.fillRect(cx - Math.max(2, r - 4), cy - Math.max(2, r - 4), Math.max(4, (r - 4) * 2), Math.max(4, (r - 4) * 2));
          }
        }
      }

      // 死亡演出中のプレイヤーは一番手前（最前面）へ描画
      if (world.marioDead) {
        this.drawActor(world.mario, this.marioSprites, w, world);
      }

      ctx.restore();

      if (world.clearPhase === 2) {
        this.startBannerBlinkTick = 0;
        this.lastStartBannerTimer = null;
        this.drawBannerText(ctx, w, "CLEAR!", 100);
      } else if (world.introActive) {
        this.startBannerBlinkTick = 0;
        this.lastStartBannerTimer = null;
        const text = "STAGE " + (world.stageNumber || 1);
        this.drawBannerText(ctx, w, text, 44);
      } else if (world.startBannerTimer > 0) {
        if (this.lastStartBannerTimer !== null && this.lastStartBannerTimer !== world.startBannerTimer) {
          this.startBannerBlinkTick++;
        }
        this.lastStartBannerTimer = world.startBannerTimer;
        if (Math.floor(this.startBannerBlinkTick / 6) % 2 === 0) {
          this.drawBannerText(ctx, w, "START!", 44);
        }
      } else {
        this.startBannerBlinkTick = 0;
        this.lastStartBannerTimer = null;
      }
    }
  }

  root.WreckRender = Object.assign(root.WreckRender || {}, {
    Renderer,
    bakeSprite,
    makeSpriteSet
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
