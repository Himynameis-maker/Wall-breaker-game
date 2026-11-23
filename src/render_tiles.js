(function (root) {
  "use strict";

  const G = root.WreckGame || {};
  const LEFT = G.LEFT || 2;
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
  const isPillarCrumblingTile = G.isPillarCrumblingTile || (t => t >= 0x71 && t <= 0x75);
  const isDoorRelatedTile = G.isDoorRelatedTile || (t =>
    t === TILE.DOOR_OPEN ||
    t === TILE.DOOR_CLOSING_1 ||
    t === TILE.DOOR_CLOSING_2 ||
    (t & 0x70) === 0x60);

  // 時計針の12段階ドット座標（0=12時, 1=1時, ..., 6=6時, ..., 9=9時, ..., 11=11時）
  const TIMED_BOMB_HANDS = [
    [[0, -1], [0, -2], [0, -3], [0, -4], [0, -5]],
    [[0, -1], [1, -2], [1, -3], [2, -4]],
    [[1, 0], [2, -1], [3, -1], [4, -2]],
    [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
    [[1, 0], [2, 1], [3, 1], [4, 2]],
    [[0, 1], [1, 2], [1, 3], [2, 4]],
    [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
    [[0, 1], [-1, 2], [-1, 3], [-2, 4]],
    [[-1, 0], [-2, 1], [-3, 1], [-4, 2]],
    [[-1, 0], [-2, 0], [-3, 0], [-4, 0], [-5, 0]],
    [[-1, 0], [-2, -1], [-3, -1], [-4, -2]],
    [[0, -1], [-1, -2], [-1, -3], [-2, -4]]
  ];

  const R = root.WreckRender;
  if (!R || !R.Renderer) return;

  Object.assign(R.Renderer.prototype, {
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
    },

    drawSandLadder(ctx, x, yTop, frame) {
      ctx.save();
      // 半透明の砂色ハシゴ本体
      ctx.globalAlpha = 0.52;
      ctx.fillStyle = "#b89858";
      ctx.fillRect(x + 2, yTop, 2, 32);
      ctx.fillRect(x + 12, yTop, 2, 32);
      ctx.fillStyle = "#e6ca86";
      for (let ry = 3; ry < 32; ry += 6) {
        ctx.fillRect(x + 2, yTop + ry, 12, 2);
      }

      // 横へ吹き抜ける砂嵐（風スジ＆砂粒ドット）
      const rows = [
        { y: 2, speed: 2, len: 6, off: 0, alpha: 0.72 },
        { y: 7, speed: 1, len: 4, off: 9, alpha: 0.58 },
        { y: 12, speed: 2, len: 7, off: 5, alpha: 0.76 },
        { y: 17, speed: 1, len: 5, off: 13, alpha: 0.54 },
        { y: 22, speed: 2, len: 6, off: 3, alpha: 0.74 },
        { y: 27, speed: 1, len: 4, off: 11, alpha: 0.60 }
      ];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const px = (frame * r.speed + r.off) & 15;
        ctx.globalAlpha = r.alpha;
        ctx.fillStyle = (i & 1) ? "#f8eab8" : "#d8b46c";
        for (let dx = 0; dx < r.len; dx++) {
          const sx = x + ((16 - ((px + dx) & 15)) & 15);
          ctx.fillRect(sx, yTop + r.y, 1, 1);
        }
        const gx = x + ((16 - ((px + 8) & 15)) & 15);
        ctx.fillRect(gx, yTop + r.y + 2, 1, 1);
      }
      ctx.restore();
    },

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
    },

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
    },

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
    },

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

      // 外枠・自動ドア上部センサーレール（開いた開口部は塗りつぶさず透過くり抜き）
      ctx.fillStyle = "#3c8084";
      ctx.fillRect(x + 1, yTop + 3, 14, 3);
      ctx.fillRect(x + 1, yTop + 6, 1, 26);
      ctx.fillRect(x + 14, yTop + 6, 1, 26);
      ctx.fillStyle = "#6cc8c8";
      ctx.fillRect(x + 2, yTop + 3, 12, 1);

      // センサーランプ
      ctx.fillStyle = lampColor;
      ctx.fillRect(x + 7, yTop + 4, 2, 1);

      // 全開時の枠内側の戸袋影（中央 x+3..x+12 はくり抜きで奥が見える）
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
    },

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
    },

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
    },

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
    },

    drawTimedBomb(ctx, x, yTop, tb, frame) {
      // 残り10.0秒(600F)以下から0.5秒(30F)ごとに赤点滅（10s赤 -> 9.5s通常 -> 9.0s赤...）
      const isRedBlink = !!(tb && tb.remainFrames <= 600 && (Math.floor((600 - tb.remainFrames) / 30) % 2 === 0));
      // 針の向き（5秒=300Fごとに1段階反時計回り: 60s=12時, 45s=9時, 30s=6時, 15s=3時, 0s=12時）
      const step = tb ? (Math.ceil(Math.max(1, tb.remainFrames) / 300) % 12) : 6;
      const handDots = TIMED_BOMB_HANDS[step] || TIMED_BOMB_HANDS[0];

      const bodyDark = isRedBlink ? "#6e1010" : "#1c2336";
      const bodyMid = isRedBlink ? "#d42820" : "#344262";
      const bodyLight = isRedBlink ? "#ff6850" : "#5e749c";
      const bezelColor = isRedBlink ? "#e02018" : "#2e3c54";
      const bezelHi = isRedBlink ? "#ff8870" : "#7c94bc";
      const faceBg = isRedBlink ? "#ffc4c4" : "#f4f6fc";
      const tickColor = isRedBlink ? "#901818" : "#54627c";
      const handColor = isRedBlink ? "#5a0606" : "#141a28";
      const pinColor = isRedBlink ? "#ff2020" : "#e03028";

      // 爆弾本体（下部のベース筐体）
      ctx.fillStyle = bodyDark;
      ctx.fillRect(x + 2, yTop + 20, 12, 11);
      ctx.fillRect(x + 1, yTop + 22, 14, 8);
      ctx.fillStyle = bodyMid;
      ctx.fillRect(x + 3, yTop + 21, 9, 9);
      ctx.fillStyle = bodyLight;
      ctx.fillRect(x + 3, yTop + 22, 2, 6);

      // 警告バンド＆リベット
      ctx.fillStyle = isRedBlink ? "#ffe868" : "#e89828";
      ctx.fillRect(x + 4, yTop + 26, 8, 2);
      ctx.fillStyle = isRedBlink ? "#ffffff" : "#8094b8";
      ctx.fillRect(x + 2, yTop + 23, 1, 1);
      ctx.fillRect(x + 13, yTop + 23, 1, 1);

      // 時計上部の小さなボタン・竜頭
      ctx.fillStyle = bezelHi;
      ctx.fillRect(x + 7, yTop + 3, 3, 2);

      // 大きめのアナログ時計 外枠（15×15px: 中心 cx=x+8, cy=yTop+12）
      const cx = x + 8;
      const cy = yTop + 12;
      ctx.fillStyle = bezelColor;
      ctx.fillRect(cx - 3, cy - 7, 7, 15);
      ctx.fillRect(cx - 5, cy - 6, 11, 13);
      ctx.fillRect(cx - 6, cy - 5, 13, 11);
      ctx.fillRect(cx - 7, cy - 3, 15, 7);

      // 時計ベゼル上部のハイライト
      ctx.fillStyle = bezelHi;
      ctx.fillRect(cx - 3, cy - 7, 7, 1);
      ctx.fillRect(cx - 5, cy - 6, 2, 1);
      ctx.fillRect(cx + 4, cy - 6, 2, 1);

      // 内側の文字盤（直径13pxの丸型）
      ctx.fillStyle = faceBg;
      ctx.fillRect(cx - 3, cy - 6, 7, 13);
      ctx.fillRect(cx - 4, cy - 5, 9, 11);
      ctx.fillRect(cx - 5, cy - 4, 11, 9);
      ctx.fillRect(cx - 6, cy - 3, 13, 7);

      // 12時（赤目盛）・3時・6時・9時の目盛ドット
      ctx.fillStyle = "#e02420";
      ctx.fillRect(cx, cy - 6, 1, 1);
      ctx.fillStyle = tickColor;
      ctx.fillRect(cx + 6, cy, 1, 1);
      ctx.fillRect(cx, cy + 6, 1, 1);
      ctx.fillRect(cx - 6, cy, 1, 1);

      // 時計の針（5秒ごとの12段階）
      ctx.fillStyle = handColor;
      for (let i = 0; i < handDots.length; i++) {
        ctx.fillRect(cx + handDots[i][0], cy + handDots[i][1], 1, 1);
      }

      // 針の中心ピン
      ctx.fillStyle = pinColor;
      ctx.fillRect(cx, cy, 1, 1);
    },

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
      } else if (val === TILE.SAND_LADDER) {
        this.drawSandLadder(ctx, x, yTop, world.f);
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
      } else if (val === TILE.TIMED_BOMB) {
        const row = Math.floor(yTop / 32);
        const col = Math.floor(x / 16);
        const tb = world.getTimedBombAt ? world.getTimedBombAt(row, col) : null;
        this.drawTimedBomb(ctx, x, yTop, tb, world.f);
      } else if ((val & 0x80) !== 0) {
        this.drawBreakableWall(ctx, x, yTop, val);
      }
    },

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
          if (fp.origAboveTile === TILE.TIMED_BOMB && fp.timedBomb) {
            this.drawTimedBomb(ctx, x, yTop, fp.timedBomb, world.f);
          } else {
            this.drawTileAt(ctx, x, yTop, fp.origAboveTile, world);
          }
        }
      }
    },

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
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
