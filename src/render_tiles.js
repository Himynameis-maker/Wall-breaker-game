(function (root) {
  "use strict";

  // ハシゴ横棒の調整用（ここを変えるだけで全ハシゴに反映）
  const LADDER_STEP = 4;          // 横棒1本＋隙間の間隔（ズレない値: 2, 4, 8）
  const LADDER_BAR_HEIGHT = 1;    // 横棒の明るい部分の太さ
  const LADDER_SHADOW_HEIGHT = 1; // 横棒の下の影の太さ（0にすると影なし単色）

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

  // 新3回壊せる壁（黒目の硬質ステンレスパネル）用パレット・ドット絵（16×24）
  const DARK_STAINLESS_PALETTE = {
    W: "#e8f2ff",
    H: "#a6b8cf",
    L: "#74859c",
    M: "#434d5e",
    S: "#313948",
    D: "#222834",
    K: "#1b212d",
    E: "#525f73",
    B: "#090c14",
    I: "#627084",
    R: "#a86438"
  };

  const DARK_STAINLESS_FULL = [
    ".LWWWWWWWWWWWWL.",
    "EWHHHHHHHHHHHHSK",
    "EHDDDDDDDDDDDDSK",
    "EHMDMMMMLLHWDMSK",
    "EHMMMMMLLHWLMMSK",
    "EHMMMMLLHWLMMMSK",
    "EHMMMLLHWLMMMMSK",
    "EHMMLDDDDDDMMMSK",
    "EHMLHHHHHHHMMMSK",
    "EHLHLMMMMMMMMMSK",
    "EHMDMMMMMMMMDMSK",
    "EHSSSSSSSSSSSSSK",
    "EDDDLLDDDDLLDDSK",
    "EWHHHHHHHHHHHHSK",
    "EHDDDDDDDDDDDDSK",
    "EHMDMMMMLLHWDMSK",
    "EHMMMMMLLHWLMMSK",
    "EHMMMMLLHWLMMMSK",
    "EHMMMDDDDDDMMMSK",
    "EHMLHHHHHHHMMMSK",
    "EHMDMMMMMMMMDMSK",
    "EHSSSSSSSSSSSSSK",
    "ESSSSSSSSSSSSSDK",
    "KDDDDDDDDDDDDDKK"
  ];

  const DARK_STAINLESS_MID = [
    ".LWWWWWWWWWLL...",
    "EWHHHHHHHHHWWBK.",
    "EHDDDDDDWWBBIISK",
    "EHMDMMMMWBBIRWSK",
    "EHMMMMMWBBWLMMSK",
    "EHMMMMWBBWLMMMSK",
    "EHMMMWBBWMMMMMSK",
    "EHMMLBDDDDDMMMSK",
    "EHMLHBBHHHHMMMSK",
    "EHLHLWBBMMMMMMSK",
    "EHMDMMWBBMMMDMSK",
    "EHSSSSSWBSSSSSSK",
    "EDDDLLDDBDLLDDSK",
    "EWHHHHHHBBHHHHWK",
    "EHDDDDDDWBDDDDSK",
    "EHMDMMMMMWBWDMSK",
    "EHMMMMMLLHWBMMSK",
    "EHMMMMLLHWLMBBSK",
    "EHMMMDDDDDDMMMSK",
    "EHMLHHHHHHHMMMSK",
    "EHMDMMMMMMMMDMSK",
    "EHSSSSSSSSSSSSSK",
    "ESSSSSSSSSSSSSDK",
    "KDDDDDDDDDDDDDKK"
  ];

  const DARK_STAINLESS_DAMAGED = [
    ".LWWWWWWWWL.....",
    "EWHHHHHHHWBBK...",
    "EHDDDDWWBBIBBK..",
    "EHMDMWBBBRIBBWSK",
    "EHMMMWBBIIBBHLSK",
    "EHMMBBBRBBWLMMSK",
    "EHMWBBBDWWLMMMSK",
    "EHWBBWDDDDMMBWSK",
    ".EWBWLLHHHBBWMSK",
    ".BBWMMMLLBBLMMSK",
    "EDBBMDMMBBLMMDSK",
    "EHSSBBBWBBSSSSSK",
    "EDDDWBBIBBLLDDSK",
    "EWHHBBWIBBHHHHWK",
    "EHDDDBBWWBBDDDSK",
    "EHMDMWBBMWBBWDSK",
    "EHMMWBBMMMWBBWSK",
    "EHMWBBMMLLWWBBK.",
    "EHWBBDDDDDDWWBB.",
    "EHBBHHHHHHHHWBK.",
    "EHBWDMMMMMMMWB..",
    "EHSSSMMMMMMBBS..",
    "ESSSDDDDDSSBBK..",
    "KDDDDDDDDDKBK..."
  ];

  // 新2回壊せる壁（シルバーのサーバー本体）用パレット・ドット絵（16×24）
  const SERVER_PALETTE = {
    A: "#dce6f4",
    B: "#cfd9e6",
    C: "#b6c4d6",
    D: "#9aa8bc",
    E: "#8a99ad",
    F: "#7e8da2",
    G: "#6e7d92",
    H: "#606f84",
    I: "#4c586c",
    J: "#384354",
    K: "#262e3c",
    L: "#1a212d",
    M: "#141923",
    N: "#2b3444",
    O: "#707f94",
    P: "#48b0ff",
    Q: "#38d890",
    R: "#d88838",
    X: "#e04838",
    Z: "#ffffff"
  };

  const SERVER_WALL_FULL = [
    ".FAAAAAAAAAAAAF.",
    "ICCCCCCCCCCCCCGK",
    "IBENNNNNNNNNNEGK",
    "IBEHPHHHHHHKKEGK",
    "IBELLLLLLLLLLEGK",
    "IBEHJJJJJHHJJEGK",
    "IBELLLLLLLLLLEGK",
    "IBCCCCCCCCCCCCGK",
    "IBDJAJQDDNDNNDGK",
    "IBDJCJDDDGGGGDGK",
    "IBBBBBBBBBBBBBGK",
    "IBDKKKKKKKKKKDGK",
    "IBDLLLLOOLLLLDGK",
    "IBDEEEEEEEEEEEGK",
    "IBDLLLLOOLLLLDGK",
    "IBDEEEEEEEEEEEGK",
    "IBDLLLLOOLLLLDGK",
    "IBDEEEEEEEEEEEGK",
    "IBDLLLLOOLLLLDGK",
    "IBDEEEEEEEEEEEGK",
    "IBCCCCCCCCCCCCGK",
    "IEKEEEEEEEEEKEGK",
    "JHHHHHHHHHHHHHKK",
    ".LLLMMMMMMMMLLL."
  ];

  const SERVER_WALL_DAMAGED = [
    ".FAAAAAAAAAF....",
    "ICCCCCCCZZMMK...",
    "IBENNNZMMPRMMK..",
    "IBEHPZMMPMMXZZGK",
    "IBELLZMMMRMZLLGK",
    "IBEHJMZMMMZJJEGK",
    "IBELLZMMLZLLLEGK",
    "IBCCCZMMZCCCCCGK",
    "IBDJAJMZMZDNNDGK",
    ".BDJCZMMZMGGGGGK",
    ".MMBBZMZMMMBBBGK",
    ".BMMKKZMMZKKKKGK",
    "IBDLLMMMPMMMLDGK",
    "IBDEEMMMRMMZEEGK",
    "IBDLLZMMMXMMZLD.",
    "IBDEEEZMMMZMMMK.",
    "IBDLLLLZMMMZMM..",
    "IBDEEEEEZZMMZMK.",
    "IBDLLLLOOZZMMMK.",
    "IBDEEEEEEEZMMMK.",
    "IBCCCCCCCCZMMMK.",
    "IEKEEEEEEEZMMB..",
    "JHHHHHHHHHZMKK..",
    ".LLLMMMMMMLL...."
  ];

  function bakeTile16x24(rows, palette) {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 24;
    const g = c.getContext("2d");
    for (let y = 0; y < 24; y++) {
      const line = rows[y] || "";
      for (let x = 0; x < 16; x++) {
        const ch = line[x];
        const color = palette[ch];
        if (!color) continue;
        g.fillStyle = color;
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

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

    drawDarkStainlessWall(ctx, x, yTop, hp, frame) {
      if (!this.darkStainlessWallSprites) {
        this.darkStainlessWallSprites = {
          full: bakeTile16x24(DARK_STAINLESS_FULL, DARK_STAINLESS_PALETTE),
          mid: bakeTile16x24(DARK_STAINLESS_MID, DARK_STAINLESS_PALETTE),
          damaged: bakeTile16x24(DARK_STAINLESS_DAMAGED, DARK_STAINLESS_PALETTE)
        };
      }
      let img = this.darkStainlessWallSprites.full;
      let rows = DARK_STAINLESS_FULL;
      if (hp === 2) {
        img = this.darkStainlessWallSprites.mid;
        rows = DARK_STAINLESS_MID;
      } else if (hp <= 1) {
        img = this.darkStainlessWallSprites.damaged;
        rows = DARK_STAINLESS_DAMAGED;
      }
      ctx.drawImage(img, x, yTop + 8);

      // 10秒(600F)に1回、欠けや穴を避けて金属部分のみに走る地味なツヤエフェクト（新3回壁のみ）
      const cycle = ((frame || 0) >>> 0) % 600;
      const shineStart = 582;
      if (cycle >= shineStart) {
        const t = cycle - shineStart; // 0 .. 17 (0.3秒間)
        const diag = -2 + t * 2.2;
        ctx.save();
        ctx.fillStyle = "rgba(220, 236, 255, 0.22)";
        for (let ry = 1; ry <= 21; ry++) {
          const line = rows[ry];
          const cx = Math.round(diag - ry);
          for (let dx = 0; dx < 2; dx++) {
            const gx = 1 + cx + dx;
            if (gx < 1 || gx > 14) continue;
            const ch = line[gx];
            if (!ch || ch === "." || ch === "B" || ch === "K") continue;
            ctx.fillRect(x + gx, yTop + 8 + ry, 1, 1);
          }
        }
        ctx.restore();
      }
    },

    drawServerWall(ctx, x, yTop, hp) {
      if (!this.serverWallSprites) {
        this.serverWallSprites = {
          full: bakeTile16x24(SERVER_WALL_FULL, SERVER_PALETTE),
          damaged: bakeTile16x24(SERVER_WALL_DAMAGED, SERVER_PALETTE)
        };
      }
      const img = hp <= 1 ? this.serverWallSprites.damaged : this.serverWallSprites.full;
      ctx.drawImage(img, x, yTop + 8);
    },

    drawCrateRackWall(ctx, x, yTop) {
      // 横幅: マスピッタリ16px (x+0 .. x+15)
      // 高さ: 上の鉄骨下端(yTop+6)に届かない yTop+8 .. yTop+31 (高さ24px)

      // 1. 天板トップ（木箱上縁、左右角を1px面取り）
      ctx.fillStyle = "#dc9850";
      ctx.fillRect(x + 2, yTop + 8, 12, 1);
      ctx.fillStyle = "#7a481e";
      ctx.fillRect(x + 1, yTop + 8, 1, 1);
      ctx.fillRect(x + 14, yTop + 8, 1, 1);

      // 2. 上部木枠 (yTop+9 .. yTop+10)
      ctx.fillStyle = "#7a481e";
      ctx.fillRect(x, yTop + 9, 1, 1);
      ctx.fillStyle = "#b47234";
      ctx.fillRect(x + 1, yTop + 9, 14, 1);
      ctx.fillStyle = "#9c5e28";
      ctx.fillRect(x + 5, yTop + 9, 4, 1); // 木目
      ctx.fillStyle = "#42240e";
      ctx.fillRect(x + 2, yTop + 9, 1, 1); // 釘
      ctx.fillRect(x + 13, yTop + 9, 1, 1);
      ctx.fillRect(x + 15, yTop + 9, 1, 1);

      ctx.fillStyle = "#7a481e";
      ctx.fillRect(x, yTop + 10, 1, 1);
      ctx.fillStyle = "#c88440";
      ctx.fillRect(x + 1, yTop + 10, 1, 1);
      ctx.fillStyle = "#5a3314";
      ctx.fillRect(x + 2, yTop + 10, 12, 1); // 上板の裏影
      ctx.fillStyle = "#8c5424";
      ctx.fillRect(x + 14, yTop + 10, 1, 1);
      ctx.fillStyle = "#42240e";
      ctx.fillRect(x + 15, yTop + 10, 1, 1);

      // 3. 左右の木柱＋中央の剥き出しラック空間 (yTop+11 .. yTop+24)
      for (let dy = 11; dy <= 24; dy++) {
        ctx.fillStyle = "#7a481e";
        ctx.fillRect(x, yTop + dy, 1, 1);
        ctx.fillStyle = (dy === 14 || dy === 20) ? "#a4642a" : "#c88440";
        ctx.fillRect(x + 1, yTop + dy, 1, 1);
        ctx.fillStyle = "#141922";
        ctx.fillRect(x + 2, yTop + dy, 12, 1);
        ctx.fillStyle = (dy === 16 || dy === 22) ? "#7a481e" : "#8c5424";
        ctx.fillRect(x + 14, yTop + dy, 1, 1);
        ctx.fillStyle = "#42240e";
        ctx.fillRect(x + 15, yTop + dy, 1, 1);
      }

      // 木枠上隅の当て木
      ctx.fillStyle = "#8c5424";
      ctx.fillRect(x + 2, yTop + 11, 1, 1);
      ctx.fillRect(x + 13, yTop + 11, 1, 1);

      // 剥き出しラック支柱レール（左右の穴あき金属柱 x+2, x+13）
      for (let dy = 12; dy <= 24; dy++) {
        const isHole = (dy & 1) === 1;
        ctx.fillStyle = isHole ? "#252d3a" : "#8c9cb0";
        ctx.fillRect(x + 2, yTop + dy, 1, 1);
        ctx.fillRect(x + 13, yTop + dy, 1, 1);
      }

      // ラック1段目：サーバーユニット (yTop+12 .. yTop+15)
      ctx.fillStyle = "#58667a";
      ctx.fillRect(x + 3, yTop + 12, 10, 1);
      ctx.fillStyle = "#a4b4c8";
      ctx.fillRect(x + 3, yTop + 12, 1, 1);
      ctx.fillRect(x + 12, yTop + 12, 1, 1);

      ctx.fillStyle = "#2e3746";
      ctx.fillRect(x + 3, yTop + 13, 10, 1);
      ctx.fillStyle = "#141922";
      ctx.fillRect(x + 4, yTop + 13, 1, 1);
      ctx.fillRect(x + 6, yTop + 13, 1, 1);
      ctx.fillStyle = "#38d078";
      ctx.fillRect(x + 10, yTop + 13, 1, 1);
      ctx.fillStyle = "#e04838";
      ctx.fillRect(x + 11, yTop + 13, 1, 1);

      ctx.fillStyle = "#242c38";
      ctx.fillRect(x + 3, yTop + 14, 10, 1);
      ctx.fillStyle = "#3b4658";
      ctx.fillRect(x + 3, yTop + 15, 10, 1);
      ctx.fillStyle = "#3898e0";
      ctx.fillRect(x + 8, yTop + 13, 1, 3); // 剥き出し青ケーブル

      // ラック2段目：中身・基板・ヒートシンク剥き出し棚 (yTop+16 .. yTop+19)
      ctx.fillStyle = "#d88838";
      ctx.fillRect(x + 4, yTop + 16, 1, 1); // 銅配線
      ctx.fillStyle = "#3898e0";
      ctx.fillRect(x + 9, yTop + 16, 1, 1); // 青配線

      ctx.fillStyle = "#343e4f";
      ctx.fillRect(x + 3, yTop + 17, 10, 1);
      ctx.fillStyle = "#9aaac0";
      ctx.fillRect(x + 4, yTop + 17, 1, 1); // ヒートシンクフィン
      ctx.fillRect(x + 6, yTop + 17, 1, 1);
      ctx.fillStyle = "#d88838";
      ctx.fillRect(x + 8, yTop + 17, 2, 1); // 銅パーツ
      ctx.fillStyle = "#4ca8ec";
      ctx.fillRect(x + 11, yTop + 17, 1, 1); // 青端子

      ctx.fillStyle = "#68788e";
      ctx.fillRect(x + 3, yTop + 18, 10, 1);
      ctx.fillStyle = "#a4b4c8";
      ctx.fillRect(x + 3, yTop + 18, 1, 1);
      ctx.fillRect(x + 12, yTop + 18, 1, 1);

      ctx.fillStyle = "#c4742c";
      ctx.fillRect(x + 5, yTop + 19, 1, 1); // 垂れた配線

      // ラック3段目：下部サーバー電源／ストレージBOX (yTop+20 .. yTop+24)
      ctx.fillStyle = "#8494a8";
      ctx.fillRect(x + 3, yTop + 20, 10, 1);
      ctx.fillStyle = "#343e50";
      ctx.fillRect(x + 3, yTop + 21, 10, 3);
      ctx.fillStyle = "#181e28";
      ctx.fillRect(x + 4, yTop + 22, 4, 1); // 吸気口
      ctx.fillStyle = "#a4b4c8";
      ctx.fillRect(x + 9, yTop + 22, 3, 1); // 金属取っ手
      ctx.fillStyle = "#e07828";
      ctx.fillRect(x + 11, yTop + 21, 1, 1); // 電源スイッチ

      // 4. 下部木箱板 (yTop+25 .. yTop+31)
      // 木箱前板の上縁ハイライト
      ctx.fillStyle = "#7a481e";
      ctx.fillRect(x, yTop + 25, 1, 1);
      ctx.fillStyle = "#dc9850";
      ctx.fillRect(x + 1, yTop + 25, 14, 1);
      ctx.fillStyle = "#42240e";
      ctx.fillRect(x + 15, yTop + 25, 1, 1);

      // 木板1段目
      ctx.fillStyle = "#7a481e";
      ctx.fillRect(x, yTop + 26, 1, 2);
      ctx.fillStyle = "#b47234";
      ctx.fillRect(x + 1, yTop + 26, 14, 2);
      ctx.fillStyle = "#985b26";
      ctx.fillRect(x + 4, yTop + 26, 6, 1);
      ctx.fillStyle = "#42240e";
      ctx.fillRect(x + 2, yTop + 26, 1, 1);
      ctx.fillRect(x + 13, yTop + 26, 1, 1);
      ctx.fillRect(x + 15, yTop + 26, 1, 2);

      // 板の合わせ目溝
      ctx.fillStyle = "#42240e";
      ctx.fillRect(x, yTop + 28, 16, 1);

      // 木板2段目
      ctx.fillStyle = "#6e3f18";
      ctx.fillRect(x, yTop + 29, 1, 2);
      ctx.fillStyle = "#9c6028";
      ctx.fillRect(x + 1, yTop + 29, 14, 2);
      ctx.fillStyle = "#b47234";
      ctx.fillRect(x + 3, yTop + 29, 4, 1);
      ctx.fillStyle = "#42240e";
      ctx.fillRect(x + 2, yTop + 30, 1, 1);
      ctx.fillRect(x + 13, yTop + 30, 1, 1);
      ctx.fillStyle = "#381d0a";
      ctx.fillRect(x + 15, yTop + 29, 1, 2);

      // 接地下端・底枠影
      ctx.fillStyle = "#2b1708";
      ctx.fillRect(x, yTop + 31, 1, 1);
      ctx.fillRect(x + 15, yTop + 31, 1, 1);
      ctx.fillStyle = "#42240e";
      ctx.fillRect(x + 1, yTop + 31, 3, 1);
      ctx.fillRect(x + 12, yTop + 31, 3, 1);
      ctx.fillStyle = "#5e3616";
      ctx.fillRect(x + 4, yTop + 31, 8, 1);
    },

    drawSandLadder(ctx, x, yTop, frame) {
      ctx.save();
      // 半透明の砂色ハシゴ本体（左右柱 x+1 / x+13）
      ctx.globalAlpha = 0.48;
      ctx.fillStyle = "#9c7e48";
      ctx.fillRect(x + 1, yTop, 2, 32);
      ctx.fillRect(x + 13, yTop, 2, 32);
      const step = Math.max(1, LADDER_STEP);
      for (let ry = 1; ry < 32; ry += step) {
        if (LADDER_BAR_HEIGHT > 0) {
          ctx.fillStyle = "#d8bc7c";
          ctx.fillRect(x + 2, yTop + ry, 12, LADDER_BAR_HEIGHT);
        }
        if (LADDER_SHADOW_HEIGHT > 0) {
          ctx.fillStyle = "#846838";
          ctx.fillRect(x + 2, yTop + ry + LADDER_BAR_HEIGHT, 12, LADDER_SHADOW_HEIGHT);
        }
      }

      // ハシゴ幅（x+1 .. x+14）から絶対にはみ出ない控えめな砂嵐エフェクト
      ctx.beginPath();
      ctx.rect(x + 1, yTop, 14, 32);
      ctx.clip();
      const f = Math.max(0, frame | 0);
      const rows = [
        { y: 5, speed: 1, len: 3, off: 0, alpha: 0.28 },
        { y: 13, speed: 2, len: 2, off: 6, alpha: 0.24 },
        { y: 21, speed: 1, len: 3, off: 10, alpha: 0.30 },
        { y: 29, speed: 2, len: 2, off: 3, alpha: 0.24 }
      ];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const px = (f * r.speed + r.off) % 14;
        ctx.globalAlpha = r.alpha;
        ctx.fillStyle = (i & 1) ? "#dfc88e" : "#cbb074";
        for (let dx = 0; dx < r.len; dx++) {
          const sx = x + 1 + ((13 - ((px + dx) % 14) + 14) % 14);
          ctx.fillRect(sx, yTop + r.y, 1, 1);
        }
      }
      ctx.restore();
    },

    drawCrumblingLadder(ctx, x, yTop, stage, frame) {
      const blink = ((frame >> 1) & 1) === 0;
      const sideColor = stage <= 2 && blink ? "#ffd0e0" : "#b84468";
      const rungColor = stage <= 2 && blink ? "#ffffff" : "#ff88a8";
      const rungShadow = stage <= 2 && blink ? "#e0a0b8" : "#a8385c";

      if (stage >= 4) {
        ctx.fillStyle = sideColor;
        ctx.fillRect(x + 1, yTop + 1, 2, 30);
        ctx.fillRect(x + 13, yTop + 1, 2, 30);
        const step = Math.max(1, LADDER_STEP);
        for (let ry = 1; ry < 32; ry += step) {
          if (LADDER_BAR_HEIGHT > 0) {
            ctx.fillStyle = rungColor;
            ctx.fillRect(x + 2, yTop + ry, 5, LADDER_BAR_HEIGHT);
            ctx.fillRect(x + 9, yTop + ry, 5, LADDER_BAR_HEIGHT);
          }
          if (LADDER_SHADOW_HEIGHT > 0) {
            ctx.fillStyle = rungShadow;
            ctx.fillRect(x + 2, yTop + ry + LADDER_BAR_HEIGHT, 5, LADDER_SHADOW_HEIGHT);
            ctx.fillRect(x + 9, yTop + ry + LADDER_BAR_HEIGHT, 5, LADDER_SHADOW_HEIGHT);
          }
        }
      } else if (stage === 3) {
        ctx.fillStyle = sideColor;
        ctx.fillRect(x + 1, yTop + 3, 2, 11);
        ctx.fillRect(x + 1, yTop + 18, 2, 11);
        ctx.fillRect(x + 13, yTop + 5, 2, 11);
        ctx.fillRect(x + 13, yTop + 20, 2, 9);
        ctx.fillStyle = rungColor;
        for (let ry = 4; ry < 29; ry += 5) {
          ctx.fillRect(x + 2, yTop + ry, 4, 2);
          ctx.fillRect(x + 10, yTop + ry, 4, 2);
        }
      } else if (stage === 2) {
        ctx.fillStyle = sideColor;
        ctx.fillRect(x + 1, yTop + 6, 2, 7);
        ctx.fillRect(x + 13, yTop + 17, 2, 8);
        ctx.fillStyle = rungColor;
        ctx.fillRect(x + 2, yTop + 8, 4, 2);
        ctx.fillRect(x + 10, yTop + 19, 4, 2);
        ctx.fillRect(x + 6, yTop + 13, 4, 2);
      } else {
        ctx.fillStyle = rungColor;
        ctx.fillRect(x + 2, yTop + 7, 2, 3);
        ctx.fillRect(x + 12, yTop + 14, 2, 3);
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

      // 上の足場(yTop+0..5)に食い込まず1pxの隙間を空けた高さ25px設計（yTop+7..31）
      const doorTop = yTop + 7;
      const panelTop = doorTop + 3; // yTop+10
      const panelH = 32 - (panelTop - yTop); // 22px

      // 外枠・自動ドア上部センサーレール（開いた開口部は塗りつぶさず透過くり抜き）
      ctx.fillStyle = "#3c8084";
      ctx.fillRect(x + 1, doorTop, 14, 3);
      ctx.fillRect(x + 1, panelTop, 1, panelH);
      ctx.fillRect(x + 14, panelTop, 1, panelH);
      ctx.fillStyle = "#6cc8c8";
      ctx.fillRect(x + 2, doorTop, 12, 1);
      ctx.fillStyle = "#245458";
      ctx.fillRect(x + 2, doorTop + 2, 12, 1);

      // センサーランプ
      ctx.fillStyle = lampColor;
      ctx.fillRect(x + 7, doorTop + 1, 2, 1);

      // 全開時の枠内側の戸袋影（中央 x+3..x+12 はくり抜きで奥が見える）
      if (panelW === 0) {
        ctx.fillStyle = "#0e1a26";
        ctx.fillRect(x + 2, panelTop, 1, panelH);
        ctx.fillRect(x + 13, panelTop, 1, panelH);
      }

      // 開け始めのダウン判定中フラッシュ縁取り
      if ((tile & 0x80) === 0 && (tile & 0x70) === 0x60 && ((frame >> 1) & 1) === 0) {
        ctx.fillStyle = (tile & 0x08) ? "rgba(255, 110, 60, 0.35)" : "rgba(140, 245, 255, 0.35)";
        ctx.fillRect(x + 2 + panelW, panelTop, 12 - panelW * 2, panelH);
      }

      // 左右両開きの自動ドアパネル
      if (panelW > 0) {
        const lx = x + 2;
        const rx = x + 14 - panelW;

        ctx.fillStyle = "#3c8c8c";
        ctx.fillRect(lx, panelTop, panelW, panelH);
        ctx.fillRect(rx, panelTop, panelW, panelH);

        ctx.fillStyle = "#68c8c4";
        ctx.fillRect(lx, panelTop + 1, Math.max(1, panelW - 1), panelH - 2);
        ctx.fillRect(rx + 1, panelTop + 1, Math.max(1, panelW - 1), panelH - 2);

        // 扉の小窓・中央パッキン
        if (panelW >= 4) {
          const winTop = panelTop + 3;
          ctx.fillStyle = "#162d38";
          ctx.fillRect(lx + 1, winTop, panelW - 2, 6);
          ctx.fillRect(rx + 1, winTop, panelW - 2, 6);
          ctx.fillStyle = "#a8f0f0";
          ctx.fillRect(lx + 1, winTop, 1, 2);
          ctx.fillRect(rx + 1, winTop, 1, 2);
        }
        ctx.fillStyle = "#1c3c40";
        ctx.fillRect(lx + panelW - 1, panelTop, 1, panelH);
        ctx.fillRect(rx, panelTop, 1, panelH);
      }
    },

    drawBreakableWall(ctx, x, yTop, tile, frame) {
      const hp = tile & 0x07;
      const group = tile & 0x70; // 0x40=1回壁, 0x10=2回壁, 0x20=3回壁

      if (group === 0x40) {
        // 1回壊せる壁（木箱の中身剥き出しラック）
        this.drawCrateRackWall(ctx, x, yTop);
      } else if (group === 0x10) {
        // 新2回壊せる壁（シルバーのサーバー本体・ツヤなし・1回殴りで大破損）
        this.drawServerWall(ctx, x, yTop, hp);
      } else {
        // 新3回壊せる壁（黒目の硬質ステンレスパネル・10秒ツヤあり・2段階破損）
        this.drawDarkStainlessWall(ctx, x, yTop, hp, frame);
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
      // 導火線と点滅火花（形と幅を維持しつつ明るく見やすく）
      ctx.fillStyle = "#d89c48";
      ctx.fillRect(x + 7, yTop + 9, 2, 4);
      ctx.fillStyle = "#f4ca78";
      ctx.fillRect(x + 7, yTop + 9, 1, 4);

      const sparkOn = ((frame >> 2) & 1) === 0;
      ctx.fillStyle = sparkOn ? "#fff058" : "#ff5820";
      ctx.fillRect(x + 8, yTop + 6, 3, 3);
      ctx.fillStyle = sparkOn ? "#ffffff" : "#ffb838";
      ctx.fillRect(x + 9, yTop + 7, 1, 1);

      // 口金（明るい真鍮色で輪郭くっきり）
      ctx.fillStyle = "#b88230";
      ctx.fillRect(x + 5, yTop + 13, 6, 2);
      ctx.fillStyle = "#ffe084";
      ctx.fillRect(x + 5, yTop + 13, 4, 1);
      ctx.fillStyle = "#7a521c";
      ctx.fillRect(x + 9, yTop + 14, 2, 1);

      // 爆弾本体（元の丸型シルエット・幅そのまま、暗背景から浮かぶ青鉄色）
      ctx.fillStyle = "#4c5c7a";
      ctx.fillRect(x + 3, yTop + 15, 10, 15);
      ctx.fillRect(x + 2, yTop + 17, 12, 11);

      // 内側の丸い金属球体グラデーション
      ctx.fillStyle = "#627696";
      ctx.fillRect(x + 3, yTop + 16, 9, 12);
      ctx.fillRect(x + 4, yTop + 16, 7, 13);

      // 光が当たる左上〜中央の明面
      ctx.fillStyle = "#869ec4";
      ctx.fillRect(x + 4, yTop + 17, 6, 7);
      ctx.fillRect(x + 4, yTop + 16, 5, 6);

      // 左上外周の明るいリムハイライト
      ctx.fillStyle = "#9ab2d6";
      ctx.fillRect(x + 3, yTop + 15, 2, 1);
      ctx.fillRect(x + 3, yTop + 16, 1, 1);
      ctx.fillRect(x + 2, yTop + 17, 1, 8);

      // ツヤの白銀ハイライト
      ctx.fillStyle = "#e6f2ff";
      ctx.fillRect(x + 4, yTop + 17, 3, 3);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + 4, yTop + 18, 2, 1);
      ctx.fillRect(x + 5, yTop + 17, 1, 1);

      // 危険・爆発マーク（見やすい赤＋黄芯）
      ctx.fillStyle = "#ff3828";
      ctx.fillRect(x + 8, yTop + 20, 1, 1);
      ctx.fillRect(x + 7, yTop + 21, 3, 4);
      ctx.fillStyle = "#ffe458";
      ctx.fillRect(x + 8, yTop + 22, 1, 2);
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

      const step = Math.max(1, LADDER_STEP);
      if (val === TILE.LADDER) {
        ctx.fillStyle = "#d89040";
        ctx.fillRect(x + 1, yTop, 2, 32);
        ctx.fillRect(x + 13, yTop, 2, 32);
        for (let ry = 1; ry < 32; ry += step) {
          if (LADDER_BAR_HEIGHT > 0) {
            ctx.fillStyle = "#f8c068";
            ctx.fillRect(x + 2, yTop + ry, 12, LADDER_BAR_HEIGHT);
          }
          if (LADDER_SHADOW_HEIGHT > 0) {
            ctx.fillStyle = "#b87028";
            ctx.fillRect(x + 2, yTop + ry + LADDER_BAR_HEIGHT, 12, LADDER_SHADOW_HEIGHT);
          }
        }
      } else if (val === TILE.SAND_LADDER) {
        this.drawSandLadder(ctx, x, yTop, world.f);
      } else if (val === TILE.BREAK_LADDER) {
        ctx.fillStyle = "#b84468";
        ctx.fillRect(x + 1, yTop, 2, 32);
        ctx.fillRect(x + 13, yTop, 2, 32);
        for (let ry = 1; ry < 32; ry += step) {
          if (LADDER_BAR_HEIGHT > 0) {
            ctx.fillStyle = "#ff88a8";
            ctx.fillRect(x + 2, yTop + ry, 5, LADDER_BAR_HEIGHT);
            ctx.fillRect(x + 9, yTop + ry, 5, LADDER_BAR_HEIGHT);
          }
          if (LADDER_SHADOW_HEIGHT > 0) {
            ctx.fillStyle = "#a8385c";
            ctx.fillRect(x + 2, yTop + ry + LADDER_BAR_HEIGHT, 5, LADDER_SHADOW_HEIGHT);
            ctx.fillRect(x + 9, yTop + ry + LADDER_BAR_HEIGHT, 5, LADDER_SHADOW_HEIGHT);
          }
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
        this.drawBreakableWall(ctx, x, yTop, val, world.f);
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
