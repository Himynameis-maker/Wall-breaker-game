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

  const PIXEL_FONT = {
    A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    D: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    G: ["01111", "10000", "10000", "10111", "10001", "10001", "01110"],
    H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
    J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"]
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

    getBannerCanvas(text, boilPhase) {
      const str = String(text || "").toUpperCase();
      const key = str + "_" + boilPhase;
      const cached = this.bannerCache.get(key);
      if (cached) return cached;
      if (this.bannerCache.size > 120) {
        this.bannerCache.clear();
      }

      const scale = 2;
      const pad = 5;
      const cols = Math.max(1, str.length * 6 - 1);
      const rows = 7;
      const pw = cols * scale + pad * 2;
      const ph = rows * scale + pad * 2;
      const body = new Uint8Array(pw * ph);

      for (let i = 0; i < str.length; i++) {
        const glyph = PIXEL_FONT[str[i]] || PIXEL_FONT[" "];
        for (let r = 0; r < rows; r++) {
          const line = glyph[r];
          for (let c = 0; c < 5; c++) {
            if (line[c] === "1") {
              const bx = pad + (i * 6 + c) * scale;
              const by = pad + r * scale;
              for (let sy = 0; sy < scale; sy++) {
                const rowOff = (by + sy) * pw;
                for (let sx = 0; sx < scale; sx++) {
                  body[rowOff + bx + sx] = 1;
                }
              }
            }
          }
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = pw;
      canvas.height = ph;
      const g = canvas.getContext("2d");
      const angle = boilPhase >= 0 ? boilPhase * (Math.PI / 2) : 0;

      g.fillStyle = "#060914";
      for (let y = 0; y < ph; y++) {
        const y0 = Math.max(0, y - 3);
        const y1 = Math.min(ph - 1, y + 3);
        for (let x = 0; x < pw; x++) {
          if (body[y * pw + x]) continue;
          const x0 = Math.max(0, x - 3);
          const x1 = Math.min(pw - 1, x + 3);
          let minD2 = 99;
          for (let ny = y0; ny <= y1; ny++) {
            const dy = ny - y;
            const dy2 = dy * dy;
            const rowOff = ny * pw;
            for (let nx = x0; nx <= x1; nx++) {
              if (!body[rowOff + nx]) continue;
              const dx = nx - x;
              const d2 = dx * dx + dy2;
              if (d2 < minD2) minD2 = d2;
            }
          }
          if (minD2 <= 2) {
            g.fillRect(x, y, 1, 1);
          } else if (boilPhase < 0) {
            if (minD2 <= 5) {
              g.fillRect(x, y, 1, 1);
            }
          } else {
            const wave = Math.sin(x * 0.36 + angle) + Math.cos(y * 0.44 - angle);
            if (wave >= -0.7) {
              const limit = wave >= 0.35 ? 8 : 5;
              if (minD2 <= limit) {
                g.fillRect(x, y, 1, 1);
              }
            }
          }
        }
      }

      g.fillStyle = "#ffffff";
      for (let y = 0; y < ph; y++) {
        const rowOff = y * pw;
        for (let x = 0; x < pw; x++) {
          if (body[rowOff + x]) {
            g.fillRect(x, y, 1, 1);
          }
        }
      }

      this.bannerCache.set(key, canvas);
      return canvas;
    }

    drawBannerText(ctx, canvasW, text, centerY, boilPhase) {
      const img = this.getBannerCanvas(text, boilPhase);
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

      // 表側キャラ層（表ザコ敵 → プレイヤー → 火の玉）
      if (world.enemies) {
        for (const enemy of world.enemies) {
          if (!enemy.isBack) this.drawEnemy(enemy, w, world);
        }
      }
      this.drawActor(world.mario, this.marioSprites, w, world);
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

      if (world.marioHitEnemy) {
        const m = world.mario;
        const f = world.f || 0;
        const blink = ((f >> 1) & 1) === 0;
        const boxW = 24;
        const boxH = 11;
        const hx = Math.max(1, Math.min(w - boxW - 1, Math.round(m.x - 4)));
        const hy = Math.max(camOffset + 2, Math.round(m.y - 40));
        ctx.fillStyle = blink ? "#d82020" : "#181820";
        ctx.fillRect(hx, hy, boxW, boxH);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(hx + 0.5, hy + 0.5, boxW - 1, boxH - 1);
        ctx.fillStyle = blink ? "#ffffff" : "#ffec48";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("HIT", hx + boxW / 2, hy + boxH / 2 + 0.5);
      }

      ctx.restore();

      if (world.introActive) {
        const text = "STAGE " + (world.stageNumber || 1);
        const boilPhase = this.isIntroCamMoving ? (Math.floor(world.introFrame / 6) % 4) : -1;
        this.drawBannerText(ctx, w, text, 44, boilPhase);
      } else if (world.startBannerTimer > 0) {
        this.drawBannerText(ctx, w, "START!", 44, -1);
      }
    }
  }

  root.WreckRender = Object.assign(root.WreckRender || {}, {
    Renderer,
    bakeSprite,
    makeSpriteSet
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
