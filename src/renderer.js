(function (root) {
  "use strict";

  const G = root.WreckGame || {};
  const RIGHT = G.RIGHT || 1;
  const LEFT = G.LEFT || 2;
  const DOWN = G.DOWN || 4;
  const TILE = G.TILE || {
    EMPTY: 0x00,
    LADDER: 0x01,
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
    BREAK_LADDER: 0xd1,
    DOOR: 0xe1,
    PILLAR: 0xf1
  };
  const isHoleTile = G.isHoleTile || (t => t >= 0x09 && t <= 0x0b);
  const isCrumblingLadderTile = G.isCrumblingLadderTile || (t => t >= 0x51 && t <= 0x55);
  const isPillarCrumblingTile = G.isPillarCrumblingTile || (t => t >= 0x71 && t <= 0x75);
  const isDoorRelatedTile = G.isDoorRelatedTile || (t =>
    t === TILE.DOOR_OPEN ||
    t === TILE.DOOR_CLOSING_1 ||
    t === TILE.DOOR_CLOSING_2 ||
    (t & 0x70) === 0x60);
  const isSameLadderType = G.isSameLadderType || ((a, b) =>
    (a === TILE.LADDER && b === TILE.LADDER) ||
    (a === TILE.BREAK_LADDER && b === TILE.BREAK_LADDER));
  const getHammerTiming = G.getHammerTiming || (slot => {
    if (slot.isMario) {
      return slot.isGolden
        ? { totalFrames: 7, hitFrame: 5, recoverStart: 7 }
        : { totalFrames: 21, hitFrame: 17, recoverStart: 21 };
    }
    return { totalFrames: 27, hitFrame: 14, recoverStart: 23 };
  });

  const S = root.WreckSprites || {};
  const {
    PALETTE_WORKER,
    PALETTE_SPIKE,
    PLAYER_IDLE,
    PLAYER_WALK1,
    PLAYER_WALK2,
    PLAYER_CLIMB1,
    PLAYER_CLIMB2,
    SPIKE_IDLE,
    SPIKE_WALK1,
    SPIKE_WALK2,
    SPIKE_CLIMB1,
    SPIKE_CLIMB2
  } = S;

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

      this.marioSprites = makeSpriteSet(
        {
          idle: PLAYER_IDLE,
          walk1: PLAYER_WALK1,
          walk2: PLAYER_WALK2,
          climb1: PLAYER_CLIMB1,
          climb2: PLAYER_CLIMB2
        },
        PALETTE_WORKER
      );
      this.spikeSprites = makeSpriteSet(
        {
          idle: SPIKE_IDLE,
          walk1: SPIKE_WALK1,
          walk2: SPIKE_WALK2,
          climb1: SPIKE_CLIMB1,
          climb2: SPIKE_CLIMB2
        },
        PALETTE_SPIKE
      );
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
      return world.rows * 32 + 12;
    }

    resetCamera(world) {
      const maxCamY = Math.max(0, this.getWorldHeight(world) - this.viewHeight);
      const targetY = world.mario.y - this.viewHeight * 0.58;
      this.camY = Math.max(0, Math.min(maxCamY, Math.round(targetY)));
    }

    updateCamera(world) {
      const maxCamY = Math.max(0, this.getWorldHeight(world) - this.viewHeight);
      if (maxCamY === 0) {
        this.camY = 0;
        return;
      }
      const targetY = Math.max(0, Math.min(maxCamY, world.mario.y - this.viewHeight * 0.58));
      const diff = targetY - this.camY;
      if (Math.abs(diff) <= 1.5) {
        this.camY = targetY;
      } else {
        this.camY += diff * 0.2;
      }
    }

    drawCracks(ctx, x, yTop, level) {
      ctx.fillStyle = "#181014";
      if (level >= 1) {
        ctx.fillRect(x + 3, yTop + 6, 2, 4);
        ctx.fillRect(x + 5, yTop + 10, 3, 2);
        ctx.fillRect(x + 8, yTop + 12, 2, 5);
        ctx.fillRect(x + 10, yTop + 17, 3, 2);
      }
      if (level >= 2) {
        ctx.fillRect(x + 11, yTop + 5, 2, 5);
        ctx.fillRect(x + 8, yTop + 9, 3, 2);
        ctx.fillRect(x + 4, yTop + 18, 2, 6);
        ctx.fillRect(x + 6, yTop + 23, 4, 2);
        ctx.fillRect(x + 2, yTop + 26, 3, 3);
      }
    }

    drawCrumblingLadder(ctx, x, yTop, stage, frame) {
      const blink = ((frame >> 1) & 1) === 0;
      const sideColor = stage <= 2 && blink ? "#ffd0e0" : "#b84468";
      const rungColor = stage <= 2 && blink ? "#ffffff" : "#ff88a8";

      if (stage >= 4) {
        ctx.fillStyle = sideColor;
        ctx.fillRect(x + 2, yTop + 2, 2, 28);
        ctx.fillRect(x + 12, yTop + 2, 2, 28);
        ctx.fillStyle = rungColor;
        for (let ry = 4; ry < 30; ry += 6) {
          ctx.fillRect(x + 2, yTop + ry, 4, 2);
          ctx.fillRect(x + 10, yTop + ry, 4, 2);
        }
      } else if (stage === 3) {
        ctx.fillStyle = sideColor;
        ctx.fillRect(x + 2, yTop + 4, 2, 10);
        ctx.fillRect(x + 2, yTop + 18, 2, 10);
        ctx.fillRect(x + 12, yTop + 6, 2, 10);
        ctx.fillRect(x + 12, yTop + 20, 2, 8);
        ctx.fillStyle = rungColor;
        for (let ry = 6; ry < 28; ry += 7) {
          ctx.fillRect(x + 3, yTop + ry, 3, 2);
          ctx.fillRect(x + 10, yTop + ry, 3, 2);
        }
      } else if (stage === 2) {
        ctx.fillStyle = sideColor;
        ctx.fillRect(x + 2, yTop + 6, 2, 7);
        ctx.fillRect(x + 12, yTop + 17, 2, 8);
        ctx.fillStyle = rungColor;
        ctx.fillRect(x + 3, yTop + 8, 4, 2);
        ctx.fillRect(x + 9, yTop + 19, 4, 2);
        ctx.fillRect(x + 6, yTop + 13, 3, 2);
      } else {
        ctx.fillStyle = rungColor;
        ctx.fillRect(x + 3, yTop + 7, 2, 3);
        ctx.fillRect(x + 11, yTop + 14, 2, 3);
        ctx.fillRect(x + 5, yTop + 22, 3, 2);
      }
    }

    drawPillar(ctx, x, yTop) {
      // 上下フランジ＋中央I字ビーム鉄柱（背景扱いで素通り可）
      ctx.fillStyle = "#526074";
      ctx.fillRect(x + 2, yTop, 12, 4);
      ctx.fillRect(x + 2, yTop + 28, 12, 4);
      ctx.fillStyle = "#98acc4";
      ctx.fillRect(x + 2, yTop + 1, 12, 1);
      ctx.fillRect(x + 2, yTop + 29, 12, 1);

      ctx.fillStyle = "#485468";
      ctx.fillRect(x + 5, yTop + 4, 6, 24);
      ctx.fillStyle = "#7a8da6";
      ctx.fillRect(x + 6, yTop + 4, 4, 24);
      ctx.fillStyle = "#b4c8e0";
      ctx.fillRect(x + 7, yTop + 4, 1, 24);

      // リベット・継手
      ctx.fillStyle = "#262e3c";
      ctx.fillRect(x + 3, yTop + 1, 2, 2);
      ctx.fillRect(x + 11, yTop + 1, 2, 2);
      ctx.fillRect(x + 3, yTop + 29, 2, 2);
      ctx.fillRect(x + 11, yTop + 29, 2, 2);
      ctx.fillRect(x + 5, yTop + 15, 6, 2);
    }

    drawPillarCrumbling(ctx, x, yTop, stage, frame) {
      const blink = ((frame >> 1) & 1) === 0;
      const h = Math.max(4, stage * 5);
      const offsetY = 32 - h;
      ctx.fillStyle = stage <= 2 && blink ? "#d8e6f8" : "#627288";
      ctx.fillRect(x + 5, yTop + offsetY, 6, h);
      ctx.fillStyle = blink ? "#ffffff" : "#98acc4";
      ctx.fillRect(x + 6, yTop + offsetY, 2, Math.max(2, h - 2));
      ctx.fillStyle = "#404c5c";
      ctx.fillRect(x + 2, yTop + 28, 12, 4);
    }

    drawDoor(ctx, x, yTop, tile, frame) {
      const base = tile & 0xf7;
      let panelW = 6; // 閉じた状態: 左右各6px
      let lampColor = "#2c4c50";

      if (base === TILE.DOOR_OPENING_1 || base === TILE.DOOR_CLOSING_2) {
        panelW = 4;
        if (base === TILE.DOOR_OPENING_1) {
          lampColor = (tile & 0x08) ? "#ff7840" : "#b8ffff";
        } else {
          lampColor = "#f0c048";
        }
      } else if (base === TILE.DOOR_OPENING_2 || base === TILE.DOOR_CLOSING_1) {
        panelW = 2;
        if (base === TILE.DOOR_OPENING_2) {
          lampColor = (tile & 0x08) ? "#ff7840" : "#b8ffff";
        } else {
          lampColor = "#f0c048";
        }
      } else if (base === TILE.DOOR_OPEN) {
        panelW = 0;
        lampColor = "#48f078";
      }

      // 外枠・自動ドア上部センサーレール
      ctx.fillStyle = "#1f4246";
      ctx.fillRect(x + 1, yTop + 3, 14, 29);
      ctx.fillStyle = "#3c8084";
      ctx.fillRect(x + 1, yTop + 3, 14, 3);
      ctx.fillRect(x + 1, yTop + 6, 1, 26);
      ctx.fillRect(x + 14, yTop + 6, 1, 26);
      ctx.fillStyle = "#6cc8c8";
      ctx.fillRect(x + 2, yTop + 3, 12, 1);

      // センサーランプ
      ctx.fillStyle = lampColor;
      ctx.fillRect(x + 7, yTop + 4, 2, 1);

      // 奥側の暗い出入口空間
      ctx.fillStyle = "#04060c";
      ctx.fillRect(x + 2, yTop + 6, 12, 26);
      if (panelW === 0) {
        ctx.fillStyle = "#0e1a26";
        ctx.fillRect(x + 2, yTop + 6, 1, 26);
        ctx.fillRect(x + 13, yTop + 6, 1, 26);
      }

      // 開け始めのダウン判定中フラッシュ縁取り
      if ((tile & 0x80) === 0 && (tile & 0x70) === 0x60 && ((frame >> 1) & 1) === 0) {
        ctx.fillStyle = (tile & 0x08) ? "rgba(255, 110, 60, 0.35)" : "rgba(140, 245, 255, 0.35)";
        ctx.fillRect(x + 2 + panelW, yTop + 6, 12 - panelW * 2, 26);
      }

      // 左右両開きの自動ドアパネル
      if (panelW > 0) {
        const lx = x + 2;
        const rx = x + 14 - panelW;

        ctx.fillStyle = "#3c8c8c";
        ctx.fillRect(lx, yTop + 6, panelW, 26);
        ctx.fillRect(rx, yTop + 6, panelW, 26);

        ctx.fillStyle = "#68c8c4";
        ctx.fillRect(lx, yTop + 7, Math.max(1, panelW - 1), 24);
        ctx.fillRect(rx + 1, yTop + 7, Math.max(1, panelW - 1), 24);

        // 扉の小窓・中央パッキン
        if (panelW >= 4) {
          ctx.fillStyle = "#162d38";
          ctx.fillRect(lx + 1, yTop + 10, panelW - 2, 7);
          ctx.fillRect(rx + 1, yTop + 10, panelW - 2, 7);
          ctx.fillStyle = "#a8f0f0";
          ctx.fillRect(lx + 1, yTop + 10, 1, 2);
          ctx.fillRect(rx + 1, yTop + 10, 1, 2);
        }
        ctx.fillStyle = "#1c3c40";
        ctx.fillRect(lx + panelW - 1, yTop + 6, 1, 26);
        ctx.fillRect(rx, yTop + 6, 1, 26);
      }
    }

    drawBreakableWall(ctx, x, yTop, tile) {
      const hp = tile & 0x07;
      const group = tile & 0x70; // 0x40=1回壁, 0x10=2回壁, 0x20=3回壁

      if (group === 0x40) {
        // 1回壊せる壁（軟質レンガ）
        ctx.fillStyle = "#6e2e1d";
        ctx.fillRect(x + 1, yTop + 3, 14, 29);
        ctx.fillStyle = "#b85432";
        ctx.fillRect(x + 2, yTop + 4, 5, 5);
        ctx.fillRect(x + 9, yTop + 4, 5, 5);
        ctx.fillRect(x + 2, yTop + 11, 12, 5);
        ctx.fillRect(x + 2, yTop + 18, 5, 5);
        ctx.fillRect(x + 9, yTop + 18, 5, 5);
        ctx.fillRect(x + 2, yTop + 25, 12, 6);
      } else if (group === 0x10) {
        // 2回壊せる壁（硬質ブロンズ/橙パネル）
        ctx.fillStyle = "#5a4220";
        ctx.fillRect(x + 1, yTop + 3, 14, 29);
        ctx.fillStyle = "#d08c30";
        ctx.fillRect(x + 2, yTop + 4, 12, 12);
        ctx.fillRect(x + 2, yTop + 18, 12, 12);
        ctx.fillStyle = "#f0b858";
        ctx.fillRect(x + 3, yTop + 5, 10, 2);
        ctx.fillRect(x + 3, yTop + 19, 10, 2);
        if (hp === 1) {
          this.drawCracks(ctx, x, yTop, 1);
        }
      } else {
        // 3回壊せる壁（重厚グレー鉄板）
        ctx.fillStyle = "#3a4658";
        ctx.fillRect(x + 1, yTop + 3, 14, 29);
        ctx.fillStyle = "#768aa0";
        ctx.fillRect(x + 2, yTop + 4, 12, 27);
        ctx.fillStyle = "#a8bed4";
        ctx.fillRect(x + 2, yTop + 4, 12, 2);
        ctx.fillRect(x + 2, yTop + 17, 12, 1);
        ctx.fillStyle = "#2b3442";
        ctx.fillRect(x + 3, yTop + 7, 2, 2);
        ctx.fillRect(x + 11, yTop + 7, 2, 2);
        ctx.fillRect(x + 3, yTop + 27, 2, 2);
        ctx.fillRect(x + 11, yTop + 27, 2, 2);
        if (hp === 2) {
          this.drawCracks(ctx, x, yTop, 1);
        } else if (hp <= 1) {
          this.drawCracks(ctx, x, yTop, 2);
        }
      }
    }

    drawDrum(ctx, x, yTop) {
      // 天板（yTop+6..+11）+ 円筒胴体（yTop+11..+32）：天板に乗った時の足元 yTop+11 と一致
      ctx.fillStyle = "#6c1c18";
      ctx.fillRect(x + 1, yTop + 6, 14, 5);
      ctx.fillStyle = "#c84838";
      ctx.fillRect(x + 2, yTop + 7, 12, 3);
      ctx.fillStyle = "#ee8868";
      ctx.fillRect(x + 3, yTop + 7, 6, 1);

      ctx.fillStyle = "#982820";
      ctx.fillRect(x + 1, yTop + 11, 14, 21);
      ctx.fillStyle = "#d04434";
      ctx.fillRect(x + 3, yTop + 11, 8, 21);
      ctx.fillStyle = "#f07c64";
      ctx.fillRect(x + 4, yTop + 11, 2, 21);

      // ドラム缶の補強リブ2本
      ctx.fillStyle = "#4c1410";
      ctx.fillRect(x + 1, yTop + 17, 14, 2);
      ctx.fillRect(x + 1, yTop + 25, 14, 2);
      ctx.fillStyle = "#e8a858";
      ctx.fillRect(x + 3, yTop + 17, 8, 1);
      ctx.fillRect(x + 3, yTop + 25, 8, 1);
    }

    drawBomb(ctx, x, yTop, frame) {
      // 導火線と点滅火花
      ctx.fillStyle = "#c89048";
      ctx.fillRect(x + 7, yTop + 9, 2, 4);
      const sparkOn = ((frame >> 2) & 1) === 0;
      ctx.fillStyle = sparkOn ? "#ffec48" : "#ff5020";
      ctx.fillRect(x + 8, yTop + 6, 3, 3);
      ctx.fillStyle = sparkOn ? "#ffffff" : "#ffa830";
      ctx.fillRect(x + 9, yTop + 7, 1, 1);

      // 口金
      ctx.fillStyle = "#687080";
      ctx.fillRect(x + 5, yTop + 13, 6, 2);

      // 爆弾本体（丸型ドット）
      ctx.fillStyle = "#1c2234";
      ctx.fillRect(x + 3, yTop + 15, 10, 15);
      ctx.fillRect(x + 2, yTop + 17, 12, 11);
      ctx.fillStyle = "#323c58";
      ctx.fillRect(x + 4, yTop + 16, 7, 12);
      // ハイライト & 危険マーク
      ctx.fillStyle = "#8ca4d8";
      ctx.fillRect(x + 4, yTop + 18, 2, 3);
      ctx.fillStyle = "#e83828";
      ctx.fillRect(x + 7, yTop + 21, 3, 4);
    }

    drawTileAt(ctx, x, yTop, val, world) {
      if (val === TILE.EMPTY || isHoleTile(val) || val === TILE.HOLE_FALLING || val === TILE.DRUM_FALLING) {
        return;
      }

      if (val === TILE.LADDER) {
        ctx.fillStyle = "#d89040";
        ctx.fillRect(x + 2, yTop, 2, 32);
        ctx.fillRect(x + 12, yTop, 2, 32);
        ctx.fillStyle = "#f8c068";
        for (let ry = 3; ry < 32; ry += 6) {
          ctx.fillRect(x + 2, yTop + ry, 12, 2);
        }
      } else if (val === TILE.BREAK_LADDER) {
        ctx.fillStyle = "#b84468";
        ctx.fillRect(x + 2, yTop, 2, 32);
        ctx.fillRect(x + 12, yTop, 2, 32);
        ctx.fillStyle = "#ff88a8";
        for (let ry = 3; ry < 32; ry += 6) {
          ctx.fillRect(x + 2, yTop + ry, 5, 2);
          ctx.fillRect(x + 9, yTop + ry, 5, 2);
        }
      } else if (isCrumblingLadderTile(val)) {
        const info = world.getCrumblingInfo ? world.getCrumblingInfo(Math.floor(yTop / 32), Math.floor(x / 16)) : null;
        const stage = info ? info.stage : (val & 0x07);
        this.drawCrumblingLadder(ctx, x, yTop, stage, world.f);
      } else if (val === TILE.PILLAR) {
        this.drawPillar(ctx, x, yTop);
      } else if (isPillarCrumblingTile(val)) {
        const stage = val & 0x07;
        this.drawPillarCrumbling(ctx, x, yTop, stage, world.f);
      } else if (val === TILE.DOOR || isDoorRelatedTile(val)) {
        this.drawDoor(ctx, x, yTop, val, world.f);
      } else if (val === TILE.DRUM) {
        this.drawDrum(ctx, x, yTop);
      } else if (val === TILE.BOMB) {
        this.drawBomb(ctx, x, yTop, world.f);
      } else if ((val & 0x80) !== 0) {
        this.drawBreakableWall(ctx, x, yTop, val);
      }
    }

    drawFallingPillars(ctx, world) {
      if (!world.fallingPillars || world.fallingPillars.length === 0) return;
      for (const fp of world.fallingPillars) {
        const dropOffsetY = (fp.stage - 1) * 8;
        const x = fp.col * 16;
        const yTop = fp.row * 32 + dropOffsetY;
        const floorY = yTop + 32;

        // 滞空・落下する「白い床板」パーツ（原作の白い落下床表現）
        ctx.fillStyle = "#b8c8e8";
        ctx.fillRect(x, floorY, 16, 6);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, floorY, 16, 2);
        ctx.fillStyle = "#788cb8";
        ctx.fillRect(x + 2, floorY + 3, 12, 2);

        if (!fp.isFloorOnly) {
          this.drawTileAt(ctx, x, yTop, fp.origAboveTile, world);
        }
      }
    }

    drawFireball(fb) {
      if (!fb || fb.animStage < 0) return;
      const ctx = this.ctx;
      const cx = Math.round(fb.x + 8);
      const cy = Math.round(fb.y - 11);
      const isLeft = (fb.dir & LEFT) !== 0;
      const tailDir = isLeft ? 1 : -1;
      const frontDir = -tailDir;
      const stage = fb.animStage;

      if (stage === 0) {
        // 極小の火種
        ctx.fillStyle = "#d83018";
        ctx.fillRect(cx - 2, cy - 2, 4, 4);
        ctx.fillStyle = "#ffe860";
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
        return;
      }

      if (stage === 1) {
        // 小〜中くらいの火の玉
        ctx.fillStyle = "#e03818";
        ctx.fillRect(cx - 4, cy - 3, 8, 6);
        ctx.fillRect(cx - 3, cy - 4, 6, 8);
        ctx.fillStyle = "#ff8c20";
        ctx.fillRect(cx - 3, cy - 2, 6, 4);
        ctx.fillRect(cx - 2, cy - 3, 4, 6);
        ctx.fillStyle = "#fff490";
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
        return;
      }

      if (stage === 2) {
        // 大炎A
        ctx.fillStyle = "#d82818";
        ctx.fillRect(cx - 5, cy - 4, 10, 8);
        ctx.fillRect(cx - 4, cy - 5, 8, 10);
        ctx.fillRect(cx + tailDir * 5 - 1, cy - 4, 3, 2);
        ctx.fillRect(cx + tailDir * 6 - 1, cy - 1, 3, 3);
        ctx.fillRect(cx + tailDir * 5 - 1, cy + 3, 3, 2);

        ctx.fillStyle = "#ff8820";
        ctx.fillRect(cx - 4, cy - 3, 8, 6);
        ctx.fillRect(cx - 3, cy - 4, 6, 8);
        ctx.fillRect(cx + tailDir * 4 - 1, cy - 2, 2, 4);

        ctx.fillStyle = "#ffec58";
        ctx.fillRect(cx + frontDir - 2, cy - 2, 4, 4);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(cx + frontDir - 1, cy - 1, 2, 2);
        return;
      }

      // 大炎B（2Fごとに交互揺らめき）
      ctx.fillStyle = "#f04018";
      ctx.fillRect(cx - 4, cy - 5, 8, 10);
      ctx.fillRect(cx - 5, cy - 3, 10, 6);
      ctx.fillRect(cx - 1, cy - 6, 2, 1);
      ctx.fillRect(cx - 1, cy + 5, 2, 1);
      ctx.fillRect(cx + tailDir * 6 - 1, cy - 3, 3, 2);
      ctx.fillRect(cx + tailDir * 5 - 1, cy + 1, 4, 2);

      ctx.fillStyle = "#ffa028";
      ctx.fillRect(cx - 3, cy - 4, 6, 8);
      ctx.fillRect(cx - 4, cy - 2, 8, 4);
      ctx.fillRect(cx + tailDir * 4 - 1, cy - 1, 2, 2);

      ctx.fillStyle = "#fff8a8";
      ctx.fillRect(cx + frontDir - 2, cy - 1, 3, 3);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cx + frontDir - 1, cy - 1, 2, 2);
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

      // 左右端ループゾーンの目印（ごく薄いガイド線）
      ctx.fillStyle = "rgba(88, 144, 248, 0.08)";
      ctx.fillRect(0, 0, 1, world.rows * 32);
      ctx.fillRect(w - 1, 0, 1, world.rows * 32);

      // 床（穴・落下開始穴 $0C および同種連続はしごの中間以外は青い鉄骨を描画、最下段は常に足場あり）
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
            if (isHoleTile(tile) || tile === TILE.HOLE_FALLING) {
              ctx.fillStyle = "#0d1222";
              ctx.fillRect(x, floorY, 16, 6);
            }
            continue;
          }
          ctx.fillStyle = "#2858b8";
          ctx.fillRect(x, floorY, 16, 6);
          ctx.fillStyle = "#5890f8";
          ctx.fillRect(x, floorY, 16, 2);
          ctx.fillStyle = "#183070";
          ctx.fillRect(x + 2, floorY + 2, 12, 2);
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

      this.drawActor(world.spike, this.spikeSprites, w, world);
      if (world.enemies) {
        for (const enemy of world.enemies) {
          if (enemy.isBack) this.drawEnemy(enemy, w, world);
        }
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
    }

    pickFrame(slot, world) {
      const faceVal = slot.facing || slot.dir;
      const facing = (faceVal & 2) ? "L" : "R";

      if (slot.state === 15 || slot.state === 16) {
        return "idle_" + facing;
      }
      if (slot.state === 10) {
        const idx = ((world ? world.f >> 2 : 0) & 1) ? "walk1" : "walk2";
        return idx + "_" + facing;
      }
      if (slot.state === 11) {
        return "idle_" + facing;
      }
      if (slot.state === 4) {
        return "idle_" + facing;
      }
      if (slot.state === 0 && world && slot.row < world.rows - 1) {
        if (isSameLadderType(world.getTile(slot.row, slot.col), world.getTile(slot.row + 1, slot.col))) {
          return "climb1_" + facing;
        }
      }
      if (slot.state === 2) {
        const idx = ((slot.prom >> 3) & 1) ? "climb2" : "climb1";
        return idx + "_" + facing;
      }
      if (slot.state === 3) {
        if (slot.kind === "arrive" || slot.kind === "arrive_top") {
          return "idle_" + facing;
        }
        return "climb1_" + facing;
      }
      if (slot.state === 6) {
        const idx = ((slot.n >> 2) & 1) ? "climb2" : "climb1";
        return idx + "_" + facing;
      }
      if (slot.state === 5) {
        return "walk1_" + facing;
      }
      if (slot.state === 8 || slot.state === 9) {
        return "walk2_" + facing;
      }
      if (slot.state === 1) {
        const cycle = ["walk1", "idle", "walk2", "idle"];
        const idx = cycle[(slot.x >> 2) & 3];
        return idx + "_" + facing;
      }
      return "idle_" + facing;
    }

    drawHammerOverlay(slot, baseX, baseY) {
      const ctx = this.ctx;
      const faceVal = slot.facing || slot.dir;
      const isLeft = (faceVal & 2) !== 0;
      const timing = getHammerTiming(slot);
      const total = timing.totalFrames;
      const hitF = timing.hitFrame;
      const recoverStart = timing.recoverStart != null ? timing.recoverStart : total;
      const t = slot.hammerTimer;

      // 0: 後ろ振りかぶり, 1: 頭上構え, 2: 前へ振り下ろし, 3: 振り終わり戻り硬直（親方終盤）
      let phase = 0;
      if (t >= recoverStart) {
        phase = 3;
      } else if (t >= hitF) {
        phase = 2;
      } else if (t >= Math.floor(hitF * 0.55)) {
        phase = 1;
      }

      const headColor = slot.isGolden ? "#ffe848" : (slot.isMario ? "#58687c" : "#3c4252");
      const gripColor = "#c8843c";

      if (phase === 0) {
        const hx = isLeft ? baseX + 12 : baseX - 5;
        const hy = baseY + 1;
        ctx.fillStyle = gripColor;
        ctx.fillRect(isLeft ? baseX + 10 : baseX + 4, baseY + 6, 2, 7);
        ctx.fillStyle = headColor;
        ctx.fillRect(hx, hy, 9, 6);
        ctx.fillStyle = "#b0c0d4";
        ctx.fillRect(hx + 1, hy + 1, 7, 1);
      } else if (phase === 1) {
        const hx = isLeft ? baseX + 2 : baseX + 5;
        const hy = baseY - 7;
        ctx.fillStyle = gripColor;
        ctx.fillRect(isLeft ? baseX + 6 : baseX + 8, baseY - 1, 2, 10);
        ctx.fillStyle = headColor;
        ctx.fillRect(hx, hy, 9, 6);
        ctx.fillStyle = "#b0c0d4";
        ctx.fillRect(hx + 1, hy + 1, 7, 1);
      } else if (phase === 2) {
        const hx = isLeft ? baseX - 7 : baseX + 14;
        const hy = baseY + 11;
        ctx.fillStyle = gripColor;
        ctx.fillRect(isLeft ? baseX - 1 : baseX + 9, baseY + 13, 8, 2);
        ctx.fillStyle = headColor;
        ctx.fillRect(hx, hy, 9, 7);
        ctx.fillStyle = "#b0c0d4";
        ctx.fillRect(hx + 1, hy + 5, 7, 1);

        if (t <= hitF + 4 && t < total) {
          ctx.fillStyle = "#fff480";
          const sx = isLeft ? baseX - 9 : baseX + 24;
          ctx.fillRect(sx, baseY + 9, 2, 2);
          ctx.fillRect(sx, baseY + 17, 2, 2);
        }
      } else {
        const hx = isLeft ? baseX - 2 : baseX + 10;
        const hy = baseY + 14;
        ctx.fillStyle = gripColor;
        ctx.fillRect(isLeft ? baseX + 4 : baseX + 10, baseY + 11, 2, 5);
        ctx.fillStyle = headColor;
        ctx.fillRect(hx, hy, 8, 5);
        ctx.fillStyle = "#b0c0d4";
        ctx.fillRect(hx + 1, hy + 1, 6, 1);
      }
    }

    drawActorAt(slot, sprites, baseX, drawY, world) {
      const img = sprites[this.pickFrame(slot, world)];
      if (!img) return;
      const ctx = this.ctx;

      if (slot.state === 15 || slot.state === 16) {
        // ドラム缶閉じ込め状態: 天板から頭・手だけ覗かせてジタバタ点滅
        const f = world ? world.f : 0;
        const phase = (f >> 2) & 1;
        const bobY = slot.state === 15 ? 4 : (phase ? -3 : -2);
        ctx.drawImage(img, 0, 0, 16, 9, baseX, drawY + bobY, 16, 9);
        const handColor = slot.isMario ? "#f4be8c" : "#e6e6e6";
        ctx.fillStyle = handColor;
        ctx.fillRect(baseX + 1, drawY + bobY + (phase ? 5 : 7), 2, 2);
        ctx.fillRect(baseX + 13, drawY + bobY + (phase ? 7 : 5), 2, 2);
        if (slot.state === 16) {
          ctx.fillStyle = phase ? "#ffec48" : "#ffffff";
          ctx.fillRect(baseX + 7, drawY - 6, 2, 2);
        }
        return;
      }

      if (slot.state === 10) {
        ctx.save();
        ctx.translate(baseX, drawY + 26);
        ctx.scale(1, -1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
        return;
      }

      if (slot.state === 11) {
        const shakeX = ((world ? world.f >> 1 : 0) & 1) ? 1 : -1;
        ctx.drawImage(img, baseX + shakeX, drawY + 2);
        const f = world ? world.f : 0;
        const sx1 = baseX + 7 + Math.round(Math.cos(f * 0.35) * 5);
        const sx2 = baseX + 7 + Math.round(Math.cos(f * 0.35 + Math.PI) * 5);
        ctx.fillStyle = "#ffec48";
        ctx.fillRect(sx1, drawY - 3, 2, 2);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(sx2, drawY - 1, 2, 2);
        return;
      }

      ctx.drawImage(img, baseX, drawY);
      if (slot.state === 4) {
        this.drawHammerOverlay(slot, baseX, drawY);
      }
    }

    getLadderVisualOffsetY(slot) {
      if (slot.state === 3) {
        if (slot.kind === "enter_top") {
          const limit = slot.isMario ? 12 : 9;
          return Math.min(10, Math.max(2, Math.round((slot.n / limit) * 10)));
        }
        if (slot.kind === "arrive_top") {
          const remain = Math.max(0, 12 - slot.n);
          return Math.min(10, Math.round((remain / 12) * 10));
        }
        return 0;
      }
      if (slot.state === 6) {
        if (slot.kind === "enter_top_cont") {
          return Math.min(10, Math.max(2, Math.round((slot.n / 16) * 10)));
        }
        if (slot.kind === "cont" && (slot.dir & DOWN)) {
          return Math.min(10, Math.max(2, Math.round((slot.n / 12) * 10)));
        }
        return 0;
      }
      if (slot.state === 2 && slot.prom === 31 && slot.y === slot.topY) {
        return 10;
      }
      return 0;
    }

    drawActor(slot, sprites, worldWidth, world) {
      const drawY = slot.y - 26 + this.getLadderVisualOffsetY(slot);
      this.drawActorAt(slot, sprites, slot.x, drawY, world);
      if (slot.x > worldWidth - 16) {
        this.drawActorAt(slot, sprites, slot.x - worldWidth, drawY, world);
      }
      if (slot.x < 16) {
        this.drawActorAt(slot, sprites, slot.x + worldWidth, drawY, world);
      }
    }

    drawEggplantAt(enemy, baseX, drawY, world) {
      const ctx = this.ctx;
      const isBack = !!enemy.isBack;
      const col = isBack
        ? {
            outline: "#121828",
            body: "#25324e",
            highlight: "#3a4d75",
            calyx: "#264050",
            calyxLight: "#38586c",
            mask: "#465878",
            maskShade: "#32405a",
            eye: "#687898",
            eyeHole: "#1c2438",
            limb: "#2e3c5a"
          }
        : {
            outline: "#1e0a32",
            body: "#6c249c",
            highlight: "#a64ce0",
            calyx: "#2ca03e",
            calyxLight: "#6ce468",
            mask: "#f0f2ff",
            maskShade: "#b8c2dc",
            eye: "#e82838",
            eyeHole: "#180828",
            limb: "#f0b840"
          };

      if (enemy.state === 15 || enemy.state === 16) {
        const f = world ? world.f : 0;
        const phase = (f >> 2) & 1;
        const lidY = drawY - 4;
        const headY = enemy.state === 15 ? (lidY + 4) : (lidY + (phase ? -3 : -1));

        ctx.save();
        if (isBack) ctx.globalAlpha = 0.85;
        ctx.fillStyle = col.calyx;
        ctx.fillRect(baseX + 7, headY - 1, 2, 2);
        ctx.fillRect(baseX + 4, headY + 1, 8, 2);
        ctx.fillStyle = col.calyxLight;
        ctx.fillRect(baseX + 5, headY + 1, 4, 1);

        ctx.fillStyle = col.outline;
        ctx.fillRect(baseX + 3, headY + 2, 10, 6);
        ctx.fillStyle = col.body;
        ctx.fillRect(baseX + 4, headY + 3, 8, 5);
        ctx.fillStyle = col.mask;
        ctx.fillRect(baseX + 4, headY + 3, 8, 4);

        if (enemy.state === 16) {
          ctx.fillStyle = col.eyeHole;
          ctx.fillRect(baseX + 5, headY + 4, 2, 2);
          ctx.fillRect(baseX + 9, headY + 4, 2, 2);
          ctx.fillStyle = col.eye;
          ctx.fillRect(baseX + 5, headY + 5, 1, 1);
          ctx.fillRect(baseX + 10, headY + 5, 1, 1);
        }

        ctx.fillStyle = col.limb;
        ctx.fillRect(baseX + 1, lidY + (phase ? 0 : 2), 2, 3);
        ctx.fillRect(baseX + 13, lidY + (phase ? 2 : 0), 2, 3);

        if (enemy.state === 16) {
          ctx.fillStyle = isBack ? "#7084a8" : (phase ? "#ffec48" : "#ffffff");
          ctx.fillRect(baseX + 7, lidY - 7, 2, 2);
        }
        ctx.restore();
        return;
      }

      const isLeft = ((enemy.facing || enemy.dir) & 2) !== 0;
      const stepPhase = (enemy.animCount >> 2) & 1;
      const isDoorIn = enemy.state === 3 && enemy.doorStage === 1;
      const isDoorOut = enemy.state === 3 && enemy.doorStage === 2;
      const isDoorDeep = isDoorIn || isDoorOut;
      const isFrontPause =
        (enemy.state === 2 && (enemy.ladderStage === 0 || enemy.ladderStage === 9)) ||
        (enemy.state === 0 && enemy.isLadderPose);
      const isClimbMove = enemy.state === 2 && !isFrontPause;
      const climbOdd = (enemy.ladderStage & 1) !== 0;
      const f = world ? world.f : 0;
      const drawX = enemy.state === 4 ? baseX + (((f >> 1) & 1) ? 1 : -1) : baseX;

      ctx.save();
      if (isBack) {
        ctx.globalAlpha = 0.85;
      }
      if (isDoorDeep) {
        ctx.globalAlpha = isBack ? 0.72 : 0.88;
        ctx.translate(drawX + 8, drawY + 11);
        ctx.scale(0.84, 0.94);
        ctx.translate(-(drawX + 8), -(drawY + 11));
      }
      if (enemy.state === 10) {
        ctx.translate(drawX + 8, drawY + 11);
        ctx.scale(1, -1);
        ctx.translate(-(drawX + 8), -(drawY + 11));
      }

      // 茎・緑のヘタ
      ctx.fillStyle = col.calyx;
      ctx.fillRect(drawX + 7, drawY, 2, 2);
      ctx.fillRect(drawX + 4, drawY + 2, 8, 2);
      ctx.fillStyle = col.calyxLight;
      ctx.fillRect(drawX + 5, drawY + 2, 4, 1);

      // 紫のナス型ボディ（下が少しふっくらした丸み）
      ctx.fillStyle = col.outline;
      ctx.fillRect(drawX + 3, drawY + 3, 10, 12);
      ctx.fillRect(drawX + 2, drawY + 7, 12, 7);
      ctx.fillStyle = col.body;
      ctx.fillRect(drawX + 4, drawY + 4, 8, 10);
      ctx.fillRect(drawX + 3, drawY + 8, 10, 5);
      ctx.fillStyle = col.highlight;
      ctx.fillRect(drawX + 4, drawY + 5, 3, 2);

      // 白い仮面＆目（ドア入り奥向き時は背中扱い、出向き・はしご時は正面2つ目）
      if (isDoorIn) {
        // 後ろ向き表現のため仮面・目を描かない
      } else if (isDoorOut || isFrontPause || isClimbMove) {
        ctx.fillStyle = col.mask;
        ctx.fillRect(drawX + 4, drawY + 6, 8, 6);
        ctx.fillStyle = col.maskShade;
        ctx.fillRect(drawX + 4, drawY + 11, 8, 1);
        ctx.fillStyle = col.eyeHole;
        ctx.fillRect(drawX + 5, drawY + 8, 2, 2);
        ctx.fillRect(drawX + 9, drawY + 8, 2, 2);
        ctx.fillStyle = col.eye;
        ctx.fillRect(drawX + 5, drawY + 8, 1, 2);
        ctx.fillRect(drawX + 10, drawY + 8, 1, 2);
      } else {
        const maskX = isLeft ? drawX + 3 : drawX + 6;
        const eyeX = isLeft ? drawX + 4 : drawX + 10;
        ctx.fillStyle = col.mask;
        ctx.fillRect(maskX, drawY + 6, 7, 6);
        ctx.fillStyle = col.maskShade;
        ctx.fillRect(maskX, drawY + 11, 7, 1);
        ctx.fillStyle = col.eyeHole;
        ctx.fillRect(eyeX, drawY + 8, 2, 2);
        ctx.fillStyle = col.eye;
        ctx.fillRect(isLeft ? eyeX : eyeX + 1, drawY + 8, 1, 2);
      }

      // 腕
      ctx.fillStyle = col.limb;
      if (isFrontPause) {
        ctx.fillRect(drawX + 1, drawY + 6, 2, 5);
        ctx.fillRect(drawX + 13, drawY + 6, 2, 5);
      } else if (isClimbMove) {
        ctx.fillRect(drawX + 1, drawY + (climbOdd ? 4 : 9), 2, 4);
        ctx.fillRect(drawX + 13, drawY + (climbOdd ? 9 : 4), 2, 4);
      } else {
        ctx.fillRect(drawX + 1, drawY + 9, 2, 4);
        ctx.fillRect(drawX + 13, drawY + 9, 2, 4);
      }

      // 二本足
      ctx.fillStyle = col.limb;
      if (enemy.state === 5) {
        ctx.fillRect(drawX + 2, drawY + 15, 4, 6);
        ctx.fillRect(drawX + 10, drawY + 15, 4, 6);
      } else if (isFrontPause) {
        ctx.fillRect(drawX + 3, drawY + 15, 3, 7);
        ctx.fillRect(drawX + 10, drawY + 15, 3, 7);
      } else if (isClimbMove) {
        ctx.fillRect(drawX + 4, drawY + 15, 3, climbOdd ? 5 : 7);
        ctx.fillRect(drawX + 9, drawY + 15, 3, climbOdd ? 7 : 5);
      } else if (enemy.state === 1 || enemy.state === 3) {
        ctx.fillRect(drawX + 4, drawY + 15, 3, stepPhase ? 7 : 5);
        ctx.fillRect(drawX + 9, drawY + 15, 3, stepPhase ? 5 : 7);
      } else {
        ctx.fillRect(drawX + 4, drawY + 15, 3, 7);
        ctx.fillRect(drawX + 9, drawY + 15, 3, 7);
      }

      ctx.restore();

      // State 4 スタン硬直中の星エフェクト
      if (enemy.state === 4) {
        const sx1 = drawX + 7 + Math.round(Math.cos(f * 0.35) * 5);
        const sx2 = drawX + 7 + Math.round(Math.cos(f * 0.35 + Math.PI) * 5);
        ctx.fillStyle = isBack ? "#7084a8" : "#ffec48";
        ctx.fillRect(sx1, drawY - 3, 2, 2);
        ctx.fillStyle = isBack ? "#9cb0d4" : "#ffffff";
        ctx.fillRect(sx2, drawY - 1, 2, 2);
      }
    }

    drawEnemyAt(enemy, baseX, drawY, world) {
      if (enemy.enemyType === "eggplant") {
        this.drawEggplantAt(enemy, baseX, drawY, world);
        return;
      }

      const ctx = this.ctx;
      const isBack = !!enemy.isBack;
      const isFast = enemy.enemyType === "spanagonFast";
      const col = isBack
        ? {
            outline: "#121828",
            body: "#25324e",
            highlight: "#3a4d75",
            horn: "#465878",
            arm: "#1c273e",
            eyeWhite: "#687898",
            eyePupil: "#384460"
          }
        : isFast
          ? {
              outline: "#0b2a38",
              body: "#197286",
              highlight: "#3fa4ba",
              horn: "#d4982a",
              arm: "#145364",
              eyeWhite: "#dce6ee",
              eyePupil: "#cc2222"
            }
          : {
              outline: "#184c5c",
              body: "#36b8c8",
              highlight: "#7cf0f8",
              horn: "#ffe060",
              arm: "#2890a0",
              eyeWhite: "#ffffff",
              eyePupil: "#e03030"
            };

      if (enemy.state === 15 || enemy.state === 16) {
        const f = world ? world.f : 0;
        const phase = (f >> 2) & 1;
        const lidY = drawY - 4;
        const headY = enemy.state === 15 ? (lidY + 4) : (lidY + (phase ? -3 : -1));

        ctx.save();
        if (isBack) ctx.globalAlpha = 0.85;
        ctx.fillStyle = col.horn;
        ctx.fillRect(baseX + 4, headY, 2, 2);
        ctx.fillRect(baseX + 10, headY, 2, 2);
        ctx.fillStyle = col.outline;
        ctx.fillRect(baseX + 3, headY + 2, 10, 6);
        ctx.fillStyle = col.body;
        ctx.fillRect(baseX + 4, headY + 3, 8, 5);
        ctx.fillStyle = col.highlight;
        ctx.fillRect(baseX + 5, headY + 3, 6, 1);

        if (enemy.state === 16) {
          ctx.fillStyle = col.eyeWhite;
          ctx.fillRect(baseX + 5, headY + 5, 2, 2);
          ctx.fillRect(baseX + 9, headY + 5, 2, 2);
          ctx.fillStyle = col.eyePupil;
          ctx.fillRect(baseX + 5, headY + 6, 1, 1);
          ctx.fillRect(baseX + 10, headY + 6, 1, 1);
        }

        ctx.fillStyle = col.arm;
        ctx.fillRect(baseX + 1, lidY + (phase ? 0 : 2), 2, 3);
        ctx.fillRect(baseX + 13, lidY + (phase ? 2 : 0), 2, 3);

        if (enemy.state === 16) {
          ctx.fillStyle = isBack ? "#7084a8" : (phase ? "#ffec48" : "#ffffff");
          ctx.fillRect(baseX + 7, lidY - 7, 2, 2);
        }
        ctx.restore();
        return;
      }

      const isLeft = ((enemy.facing || enemy.dir) & 2) !== 0;
      const stepPhase = (enemy.animCount >> 2) & 1;
      const isDoorIn = enemy.state === 3 && enemy.doorStage === 1;
      const isDoorOut = enemy.state === 3 && enemy.doorStage === 2;
      const isDoorDeep = isDoorIn || isDoorOut;
      const isFrontPause =
        (enemy.state === 2 && (enemy.ladderStage === 0 || enemy.ladderStage === 9)) ||
        (enemy.state === 0 && enemy.isLadderPose);
      const isClimbMove = enemy.state === 2 && !isFrontPause;
      const climbOdd = (enemy.ladderStage & 1) !== 0;
      const f = world ? world.f : 0;
      const drawX = enemy.state === 4 ? baseX + (((f >> 1) & 1) ? 1 : -1) : baseX;

      ctx.save();
      if (isBack) {
        ctx.globalAlpha = 0.85;
      }
      if (isDoorDeep) {
        ctx.globalAlpha = isBack ? 0.72 : 0.88;
        ctx.translate(drawX + 8, drawY + 11);
        ctx.scale(0.84, 0.94);
        ctx.translate(-(drawX + 8), -(drawY + 11));
      }
      if (enemy.state === 10) {
        ctx.translate(drawX + 8, drawY + 11);
        ctx.scale(1, -1);
        ctx.translate(-(drawX + 8), -(drawY + 11));
      }

      // 二本足の仮ドット描画（通常スパナは明るめシアン、高速色違いはやや濃いシアン、裏は暗いシルエット）
      ctx.fillStyle = col.outline;
      ctx.fillRect(drawX + 3, drawY + 3, 10, 12);
      ctx.fillStyle = col.body;
      ctx.fillRect(drawX + 4, drawY + 4, 8, 10);
      ctx.fillStyle = col.highlight;
      ctx.fillRect(drawX + 5, drawY + 5, 6, 2);

      // 頭の角・スパナ風突起
      ctx.fillStyle = col.horn;
      ctx.fillRect(drawX + 4, drawY + 1, 2, 2);
      ctx.fillRect(drawX + 10, drawY + 1, 2, 2);

      // 目（ドア入り奥向き時は背中扱い、出向き・はしご時は正面2つ目）
      if (isDoorIn) {
        // 後ろ向き表現のため目を描かない
      } else if (isDoorOut || isFrontPause || isClimbMove) {
        ctx.fillStyle = col.eyeWhite;
        ctx.fillRect(drawX + 5, drawY + 7, 2, 3);
        ctx.fillRect(drawX + 9, drawY + 7, 2, 3);
        ctx.fillStyle = col.eyePupil;
        ctx.fillRect(drawX + 5, drawY + 8, 1, 2);
        ctx.fillRect(drawX + 10, drawY + 8, 1, 2);
      } else {
        ctx.fillStyle = col.eyeWhite;
        ctx.fillRect(isLeft ? drawX + 4 : drawX + 9, drawY + 7, 3, 3);
        ctx.fillStyle = col.eyePupil;
        ctx.fillRect(isLeft ? drawX + 4 : drawX + 11, drawY + 8, 1, 2);
      }

      // 腕
      ctx.fillStyle = col.arm;
      if (isFrontPause) {
        ctx.fillRect(drawX + 1, drawY + 6, 2, 5);
        ctx.fillRect(drawX + 13, drawY + 6, 2, 5);
      } else if (isClimbMove) {
        ctx.fillRect(drawX + 1, drawY + (climbOdd ? 4 : 9), 2, 4);
        ctx.fillRect(drawX + 13, drawY + (climbOdd ? 9 : 4), 2, 4);
      } else {
        ctx.fillRect(drawX + 2, drawY + 9, 2, 4);
        ctx.fillRect(drawX + 12, drawY + 9, 2, 4);
      }

      // 二本足
      ctx.fillStyle = col.outline;
      if (enemy.state === 5) {
        ctx.fillRect(drawX + 2, drawY + 15, 4, 6);
        ctx.fillRect(drawX + 10, drawY + 15, 4, 6);
      } else if (isFrontPause) {
        ctx.fillRect(drawX + 3, drawY + 15, 3, 7);
        ctx.fillRect(drawX + 10, drawY + 15, 3, 7);
      } else if (isClimbMove) {
        ctx.fillRect(drawX + 4, drawY + 15, 3, climbOdd ? 5 : 7);
        ctx.fillRect(drawX + 9, drawY + 15, 3, climbOdd ? 7 : 5);
      } else if (enemy.state === 1 || enemy.state === 3) {
        ctx.fillRect(drawX + 4, drawY + 15, 3, stepPhase ? 7 : 5);
        ctx.fillRect(drawX + 9, drawY + 15, 3, stepPhase ? 5 : 7);
      } else {
        ctx.fillRect(drawX + 4, drawY + 15, 3, 7);
        ctx.fillRect(drawX + 9, drawY + 15, 3, 7);
      }

      ctx.restore();

      // State 4 スタン硬直中の星エフェクト
      if (enemy.state === 4) {
        const sx1 = drawX + 7 + Math.round(Math.cos(f * 0.35) * 5);
        const sx2 = drawX + 7 + Math.round(Math.cos(f * 0.35 + Math.PI) * 5);
        ctx.fillStyle = isBack ? "#7084a8" : "#ffec48";
        ctx.fillRect(sx1, drawY - 3, 2, 2);
        ctx.fillStyle = isBack ? "#9cb0d4" : "#ffffff";
        ctx.fillRect(sx2, drawY - 1, 2, 2);
      }
    }

    drawEnemy(enemy, worldWidth, world) {
      const drawY = enemy.y - 22;
      this.drawEnemyAt(enemy, enemy.x, drawY, world);
      if (enemy.x > worldWidth - 16) {
        this.drawEnemyAt(enemy, enemy.x - worldWidth, drawY, world);
      }
      if (enemy.x < 16) {
        this.drawEnemyAt(enemy, enemy.x + worldWidth, drawY, world);
      }
    }
  }

  root.WreckRender = { Renderer };
})(typeof globalThis !== "undefined" ? globalThis : window);
