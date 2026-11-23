(function (root) {
  "use strict";

  const G = root.WreckGame || {};
  const LEFT = G.LEFT || 2;
  const DOWN = G.DOWN || 4;
  const UP = G.UP || 8;
  const TILE = G.TILE || {
    LADDER: 0x01,
    SAND_LADDER: 0x02,
    BREAK_LADDER: 0xd1
  };
  const isSameLadderType = G.isSameLadderType || ((a, b) =>
    (a === TILE.LADDER && b === TILE.LADDER) ||
    (a === TILE.BREAK_LADDER && b === TILE.BREAK_LADDER) ||
    (a === TILE.SAND_LADDER && b === TILE.SAND_LADDER));

  const R = root.WreckRender;
  if (!R || !R.Renderer) return;
  const makeSpriteSet = R.makeSpriteSet;

  // 宇宙服パレット（顔が見えない黒バイザー＋白ボディ＋オレンジライン/グローブ）
  const PALETTE_ASTRO = {
    W: "#f2f6fc",
    L: "#bcc9de",
    D: "#637494",
    V: "#0d1526",
    R: "#7cd0ff",
    O: "#ea7224",
    P: "#a84410",
    C: "#32a4d8",
    B: "#435068"
  };

  // 待機用・通過コマ用の上半身（高い位置 16行：腕は体に沿って自然に少し曲げ）
  const UPPER_IDLE = [
    "................",
    ".....WWWWWW.....",
    "....WWWWWWWW....",
    "...WWWWVVVVVV...",
    "...WWWVVVVVRRV..",
    "...WWWVVVVVVVV..",
    "...LLLWWVVVVVV..",
    "....LLWWWWWW....",
    ".....OOOOOO.....",
    "...BBWWWWWW.....",
    "..BBBWDWWWCW....",
    "..BBBWDWWDWW....",
    "..BBBWDWWDDWW...",
    "..BBBLDWWDWWW...",
    "...BBLWDOOWWW...",
    "...BBLWWWWWW...."
  ];

  // 歩行0コマ目（1px沈み 17行）：手前腕を前上へ「くの字」に振り上げ、奥腕を後ろへ引く
  const UPPER_WALK_0 = [
    "................",
    "................",
    ".....WWWWWW.....",
    "....WWWWWWWW....",
    "...WWWWVVVVVV...",
    "...WWWVVVVVRRV..",
    "...WWWVVVVVVVV..",
    "...LLLWWVVVVVV..",
    "....LLWWWWWW....",
    ".....OOOOOO.....",
    "...BBWWWWWW.....",
    "..BBBWDWWWCW....",
    "..BBBWDWWDWW.OO.",
    "..BBBLDWWWWWDOO.",
    "...PPLWDDDDDD...",
    "...BBLWWWWWW....",
    "....WWWWWWWW...."
  ];

  // 歩行1・3コマ目（高い位置 16行）：通過中は腕を自然に下ろしつつ肘を軽く曲げる
  const UPPER_WALK_1 = UPPER_IDLE;

  // 歩行2コマ目（1px沈み 17行）：手前腕を後ろへ「くの字」に引き、奥腕を前へ振り上げる
  const UPPER_WALK_2 = [
    "................",
    "................",
    ".....WWWWWW.....",
    "....WWWWWWWW....",
    "...WWWWVVVVVV...",
    "...WWWVVVVVRRV..",
    "...WWWVVVVVVVV..",
    "...LLLWWVVVVVV..",
    "....LLWWWWWW....",
    ".....OOOOOO.....",
    "...BBWWWWWW.....",
    "..BBBWDWWWCW.PP.",
    "..BBBDWWWDWWLPP.",
    ".OODDWWWDWWLL...",
    ".OOWWWDDDDWWW...",
    "...DWWWWWWWW....",
    "....WWWWWWWW...."
  ];

  const UPPER_WALK_3 = UPPER_IDLE;

  const LOWER_IDLE = [
    "....WWWWWWWW....",
    "....WWWWWWWW....",
    "....WWW..WWW....",
    "....LLL..LLL....",
    "....LLL..LLL....",
    "....DDD..DDD....",
    "....BBB..BBB....",
    "....BBB..BBB....",
    "....BBBB.BBBB...",
    "....BBBB.BBBB..."
  ];

  // 足運び4コマ（手前足＝白W、奥足＝暗L/D 固定。0/2は9行=沈み踏み込み、1/3は10行=軸足立ち＋膝高く上げ）
  const LOWER_WALK_0 = [
    "....WWWWWWWW....",
    "....WWWWLLLL....",
    "...WWWW..LLLL...",
    "...LLL....DDD...",
    "..LLLL....DDD...",
    "..DDD.....DDD...",
    "..BBB.....BBB...",
    ".BBBB.....BBBB..",
    "..........BBBB.."
  ];
  const LOWER_WALK_1 = [
    "....WWWWWWWW....",
    "....LLLLWWWW....",
    ".....LLLWWWWWW..",
    ".....DDD.LLLLL..",
    ".....DDD..DDDD..",
    ".....DDD..BBBB..",
    ".....BBB..BBBB..",
    ".....BBB........",
    ".....BBBB.......",
    ".....BBBB......."
  ];
  const LOWER_WALK_2 = [
    "....WWWWWWWW....",
    "....LLLLWWWW....",
    "...LLLL..WWWW...",
    "...DDD....LLL...",
    "...DDD....LLL...",
    "..DDD.....DDD...",
    "..BBB.....BBB...",
    "..BBBB....BBBB..",
    "..........BBBB.."
  ];
  const LOWER_WALK_3 = [
    "....WWWWWWWW....",
    "....WWWWLLLL....",
    ".....WWWLLLLLL..",
    ".....LLL.DDDDD..",
    ".....DDD..DDDD..",
    ".....DDD..BBBB..",
    ".....BBB..BBBB..",
    ".....BBB........",
    ".....BBBB.......",
    ".....BBBB......."
  ];

  // 着地スタン（State 11：19F）用：尻もち ＋ 2段階起き上がり
  const ASTRO_SIT = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "....WWWWWW......",
    "...WWWWWWWW.....",
    "..WWWWVVVVVV....",
    "..WWWVVVVVRRV...",
    "..WWWVVVVVVVV...",
    "..LLLWWVVVVVV...",
    "...LLWWWWWW.....",
    "....OOOOOO......",
    ".BBBWWWWWWW.....",
    "BBBBWWWCWWWW....",
    "BBBBWDDWWWWWW...",
    "BBBLLWDWWWOO....",
    ".BBLWWWWWWWWWW..",
    "..DDWWWWWWWLLL..",
    "...WWWWWWLLLDDD.",
    "...DDDDDDDBBBBB.",
    "....BBBBBBBBBBB."
  ];

  const ASTRO_RECOVER_0 = [
    "................",
    "................",
    "................",
    "................",
    "................",
    ".....WWWWWW.....",
    "....WWWWWWWW....",
    "...WWWWVVVVVV...",
    "...WWWVVVVVRRV..",
    "...WWWVVVVVVVV..",
    "...LLLWWVVVVVV..",
    "....LLWWWWWW....",
    ".....OOOOOO.....",
    "..BBBWWWWWWW....",
    ".BBBBWWWCWWWW...",
    ".BBBBWDDWWWWW...",
    ".BBBLLWDWWWW....",
    "..BBLWWDDWWWW...",
    "...BBLDWWWOO....",
    "....WWWWWWWW....",
    "...WWWW..WWWW...",
    "...LLL....LLL...",
    "...DDD....DDD...",
    "...BBB....BBB...",
    "..BBBB....BBBB..",
    "..BBBB....BBBB.."
  ];

  const ASTRO_RECOVER_1 = [
    "................",
    "................",
    "................",
    ".....WWWWWW.....",
    "....WWWWWWWW....",
    "...WWWWVVVVVV...",
    "...WWWVVVVVRRV..",
    "...WWWVVVVVVVV..",
    "...LLLWWVVVVVV..",
    "....LLWWWWWW....",
    ".....OOOOOO.....",
    "..BBBWWWWWWW....",
    ".BBBBWWWCWWWW...",
    ".BBBBWDDWWWWW...",
    ".BBBLLWDWWWWW...",
    "..BBLWWDOOWWW...",
    "...BBLDWWWWWW...",
    "....WWWWWWWW....",
    "....WWW..WWW....",
    "...LLLL..LLLL...",
    "...DDD....DDD...",
    "...DDD....DDD...",
    "...BBB....BBB...",
    "...BBB....BBB...",
    "..BBBB....BBBB..",
    "..BBBB....BBBB.."
  ];

  // はしご（後ろ姿）
  const ASTRO_CLIMB_HOLD = [
    "................",
    ".....WWWWWW.....",
    "....WWWWWWWW....",
    "...WWWWWWWWWW...",
    "...WWWWWWWWWW...",
    "...LLLLLLLLLL...",
    "...LLLLLLLLLL...",
    "....DDLLLLDD....",
    "..OO.OOOOOO.OO..",
    ".OOWBBBBBBBBWOO.",
    ".WW.BBBBBBBB.WW.",
    "....BBCBBBBB....",
    "....BBBBBBBB....",
    "....BBBBBBBB....",
    ".....DDDDDD.....",
    "....WWWWWWWW....",
    "....WWWWWWWW....",
    "....WWWWWWWW....",
    "....WWW..WWW....",
    "....LLL..LLL....",
    "....LLL..LLL....",
    "....DDD..DDD....",
    "....BBB..BBB....",
    "....BBB..BBB....",
    "....BBBB.BBBB...",
    "....BBBB.BBBB..."
  ];

  const ASTRO_CLIMB_L = [
    "................",
    ".....WWWWWW.....",
    "....WWWWWWWW....",
    "...WWWWWWWWWW...",
    ".OO.WWWWWWWW....",
    ".WW.WWWWWWWW....",
    ".WW.LLLLLLLL....",
    "..W.DDLLLLDD....",
    "..WW.OOOOOO.....",
    "...WBBBBBBBBW...",
    "....BBBBBBBBWW..",
    "....BBCBBBBBWW..",
    "....BBBBBBBB.OO.",
    "....BBBBBBBB.OO.",
    ".....DDDDDD.....",
    "....WWWWWWWW....",
    "....WWWWWWWW....",
    "....WWW..WWWW...",
    "....LLL...LLL...",
    "....LLL...DDD...",
    "....DDD...BBB...",
    "....BBB...BBBB..",
    "....BBB...BBBB..",
    "....BBBB........",
    "....BBBB........",
    "....BBBB........"
  ];
  const ASTRO_CLIMB_R = ASTRO_CLIMB_L.map(row => row.split("").reverse().join(""));

  // 穴落ち落下ポーズ
  const ASTRO_FALL = [
    "................",
    ".....WWWWWW.....",
    "....WWWWWWWW....",
    "...WWWWVVVVVV...",
    "...WWWVVVVVRRV..",
    "...WWWVVVVVVVV..",
    "...LLLWWVVVVVV..",
    "....LLWWWWWW....",
    ".....OOOOOO.....",
    "..BBBWWWWWWW.OO.",
    ".BBBBWWWCWWWWWW.",
    "OOBBBWWWCWWWW...",
    "WWBBBWWLLWWW....",
    "..BBBLWWWWWW....",
    "...BBLWWWWWW....",
    "....DDWWWWWW....",
    "....WWWWWWWW....",
    "...WWWW..WWWW...",
    "..WWWW....WWWW..",
    "..LLL......LLL..",
    "..DDD......DDD..",
    "..BBB......BBB..",
    ".BBBB......BBBB.",
    ".BBBB......BBBB.",
    "................",
    "................"
  ];

  // ハンマー：背中から抜く（半身後ろ向き）
  const ASTRO_HAMMER_PULL = [
    "................",
    ".....WWWWWW.....",
    "....WWWWWWWW....",
    "...WWWWWWVVVV...",
    "...WWWWWWVVVRR..",
    "...LLLWWWVVVVV..",
    "...LLLLWWVVVV...",
    "....LLWWWWWW....",
    ".....OOOOOO.....",
    "..OOBBWWWWWW....",
    ".OOBBBWWWCWW....",
    ".WWBBBWWWWWW....",
    "..BBBBWWWWWW....",
    "..BBBBWWWWWW....",
    "...BBBLLWWWW....",
    "....DDDDWWWW....",
    "....WWWWWWWW....",
    "....WWWWWWWW....",
    "....WWW..WWW....",
    "....LLL..LLL....",
    "....LLL..LLL....",
    "....DDD..DDD....",
    "....BBB..BBB....",
    "....BBB..BBB....",
    "....BBBB.BBBB...",
    "....BBBB.BBBB..."
  ];

  // ハンマー：頭上振りかぶり（両腕上げ奥向き）
  const ASTRO_HAMMER_UP = [
    "....OO....OO....",
    "...WWWWWWWWWW...",
    "...WW.WWWW.WW...",
    "...WWWWWWWWWW...",
    "...WWWWWWWWWW...",
    "...LLLLLLLLLL...",
    "...LLLLLLLLLL...",
    "....DDLLLLDD....",
    ".....OOOOOO.....",
    "....BBBBBBBB....",
    "....BBBBBBBB....",
    "....BBCBBBBB....",
    "....BBBBBBBB....",
    "....BBBBBBBB....",
    ".....DDDDDD.....",
    "....WWWWWWWW....",
    "....WWWWWWWW....",
    "....WWWWWWWW....",
    "....WWW..WWW....",
    "....LLL..LLL....",
    "....LLL..LLL....",
    "....DDD..DDD....",
    "....BBB..BBB....",
    "....BBB..BBB....",
    "....BBBB.BBBB...",
    "....BBBB.BBBB..."
  ];

  // ハンマー：画面奥へ振り下ろし途中（完全後ろ姿）
  const ASTRO_HAMMER_SWING = [
    "................",
    ".....WWWWWW.....",
    "....WWWWWWWW....",
    "...WWWWWWWWWW...",
    "...WWWWWWWWWW...",
    "...LLLLLLLLLL...",
    "...LLLLLLLLLL...",
    "....DDLLLLDD....",
    "...OO.OOOO.OO...",
    "..WWBBBBBBBBWW..",
    "....BBBBBBBB....",
    "....BBCBBBBB....",
    "....BBBBBBBB....",
    "....BBBBBBBB....",
    ".....DDDDDD.....",
    "....WWWWWWWW....",
    "....WWWWWWWW....",
    "....WWWWWWWW....",
    "....WWW..WWW....",
    "....LLL..LLL....",
    "....LLL..LLL....",
    "....DDD..DDD....",
    "....BBB..BBB....",
    "....BBB..BBB....",
    "....BBBB.BBBB...",
    "....BBBB.BBBB..."
  ];

  // ハンマー：画面奥へ叩きつけ！（腰を落とした後ろ姿）
  const ASTRO_HAMMER_HIT = [
    "................",
    "................",
    ".....WWWWWW.....",
    "....WWWWWWWW....",
    "...WWWWWWWWWW...",
    "...WWWWWWWWWW...",
    "...LLLLLLLLLL...",
    "...LLLLLLLLLL...",
    "....DDLLLLDD....",
    "....OOOOOOOO....",
    "....BBBBBBBB....",
    "....BBBBBBBB....",
    "....BBCBBBBB....",
    "....BBBBBBBB....",
    "....BBBBBBBB....",
    ".....DDDDDD.....",
    "....WWWWWWWW....",
    "....WWWWWWWW....",
    "...WWWW..WWWW...",
    "...LLL....LLL...",
    "...LLL....LLL...",
    "...DDD....DDD...",
    "...BBB....BBB...",
    "...BBB....BBB...",
    "..BBBB....BBBB..",
    "..BBBB....BBBB.."
  ];

  // 死亡演出フェーズ1：当たった瞬間のコチラ向き正面静止（黒バイザー＋反射光のみ）
  const ASTRO_DEAD_LOOK = [
    "................",
    ".....WWWWWW.....",
    "....WWWWWWWW....",
    "...WWVVVVVVWW...",
    "...WVVVVVRRVW...",
    "...WVVVVVVVVW...",
    "...LLWWVVWWLL...",
    "....LLWWWWLL....",
    ".....OOOOOO.....",
    "...BWWWWWWWWB...",
    "..BWWWWCCWWWWB..",
    "..WW.WWDDWW.WW..",
    ".OO..WWCCWW..OO.",
    ".PP..WWDDWW..PP.",
    ".....WWWWWW.....",
    ".....DDDDDD.....",
    "....WWWWWWWW....",
    "....WWWWWWWW....",
    "....WWW..WWW....",
    "....LLL..LLL....",
    "....LLL..LLL....",
    "....DDD..DDD....",
    "....BBB..BBB....",
    "....BBB..BBB....",
    "...BBBB..BBBB...",
    "...BBBB..BBBB..."
  ];

  // 死亡演出フェーズ2：コチラ向きのまま両腕バンザイ＆両足を大きく抱え上げて高速落下
  const ASTRO_DEAD_FALL = [
    "OO............OO",
    "OO...WWWWWW...OO",
    "PP..WWWWWWWW..PP",
    "WW.WWVVVVVVWW.WW",
    "WW.WVVVVVRRVW.WW",
    ".W.WVVVVVVVVW.W.",
    ".W.LLWWVVWWLL.W.",
    ".WW.LLWWWWLL.WW.",
    "..WW.OOOOOO.WW..",
    "...WWWWCCWWWW...",
    "....WWWDDWWW....",
    "....WWWCCWWW....",
    ".....DDDDDD.....",
    "...WWWWWWWWWW...",
    "..WWWWW..WWWWW..",
    ".WWWWW....WWWWW.",
    ".LLLL......LLLL.",
    ".DDDD......DDDD.",
    ".BBBB......BBBB.",
    "BBBB........BBBB",
    ".BBBB......BBBB.",
    "................",
    "................",
    "................",
    "................",
    "................"
  ];

  const WALK_STEP_FRAMES = 5; // 歩行コマ切替間隔（5Fごと）

  Object.assign(R.Renderer.prototype, {
    initPlayerSprites() {
      if (typeof makeSpriteSet !== "function") return;
      this.playerSprites = makeSpriteSet(
        {
          idle: UPPER_IDLE.concat(LOWER_IDLE),
          walk0: UPPER_WALK_0.concat(LOWER_WALK_0),
          walk1: UPPER_WALK_1.concat(LOWER_WALK_1),
          walk2: UPPER_WALK_2.concat(LOWER_WALK_2),
          walk3: UPPER_WALK_3.concat(LOWER_WALK_3),
          sit: ASTRO_SIT,
          recover0: ASTRO_RECOVER_0,
          recover1: ASTRO_RECOVER_1,
          climbHold: ASTRO_CLIMB_HOLD,
          climbL: ASTRO_CLIMB_L,
          climbR: ASTRO_CLIMB_R,
          fall: ASTRO_FALL,
          hammerPull: ASTRO_HAMMER_PULL,
          hammerUp: ASTRO_HAMMER_UP,
          hammerSwing: ASTRO_HAMMER_SWING,
          hammerHit: ASTRO_HAMMER_HIT,
          deadLook: ASTRO_DEAD_LOOK,
          deadFall: ASTRO_DEAD_FALL
        },
        PALETTE_ASTRO
      );
    },

    getPlayerLadderVisual(slot) {
      const s = slot.state;
      const y = slot.y;
      const topY = slot.topY;
      const prom = slot.prom;
      const n = slot.n;
      const kind = slot.kind;
      const d = slot.dir;

      let vy = y;
      let isHold = false;

      if (s === 3) {
        if (kind === "enter") {
          if (n <= 4) {
            vy = y;
            isHold = true;
          } else {
            vy = topY + 31;
          }
        } else if (kind === "arrive") {
          vy = y;
          isHold = true;
        } else if (kind === "enter_top") {
          if (n <= 3) {
            vy = topY;
            isHold = true;
          } else if (n <= 7) {
            vy = topY + 3;
          } else {
            vy = topY + 7;
          }
        } else if (kind === "arrive_top") {
          if (n <= 3) {
            vy = topY + 7;
          } else if (n <= 8) {
            vy = topY + 3;
          } else {
            vy = topY;
            isHold = true;
          }
        }
      } else if (s === 6) {
        if (kind === "enter_top_cont") {
          if (n <= 5) {
            vy = topY;
            isHold = true;
          } else if (n <= 10) {
            vy = topY + 3;
          } else {
            vy = topY + 7;
          }
        } else if (kind === "cont") {
          if (d & DOWN) {
            if (n <= 1) vy = y - 1;
            else if (n <= 6) vy = y + 3;
            else vy = y + 7;
          } else {
            if (n <= 3) vy = y + 7;
            else if (n <= 9) vy = y + 3;
            else vy = y - 1;
          }
        }
      } else if (s === 2) {
        if (prom === 31 && y === topY) {
          vy = topY + 7;
        } else if (prom === 1 && y === topY + 32) {
          vy = topY + 31;
        } else if ((d & UP) && prom >= 30) {
          vy = topY + 7;
        } else {
          vy = y;
        }
      }

      if (isHold) {
        return { vy, pose: "climbHold" };
      }
      const stepIndex = Math.round((vy - 3) / 4);
      return { vy, pose: (stepIndex & 1) ? "climbR" : "climbL" };
    },

    drawPlayerBackHammer(baseX, drawY, facingDir, mode) {
      const ctx = this.ctx;
      const isLeft = (facingDir & LEFT) !== 0;

      if (mode === "back") {
        // 後ろ姿（はしご中）：背中のバックパックに斜めに刺さっている
        const hx = isLeft ? baseX + 1 : baseX + 10;
        const hy = drawY + 4;
        ctx.fillStyle = "#8c5420";
        for (let i = 0; i < 9; i++) {
          const px = isLeft ? (baseX + 4 + i * 0.7) : (baseX + 11 - i * 0.7);
          ctx.fillRect(Math.round(px), drawY + 7 + i, 1, 2);
        }
        ctx.fillStyle = "#d48e44";
        for (let i = 0; i < 7; i++) {
          const px = isLeft ? (baseX + 4 + i * 0.7) : (baseX + 11 - i * 0.7);
          ctx.fillRect(Math.round(px), drawY + 7 + i, 1, 1);
        }
        ctx.fillStyle = "#48546a";
        ctx.fillRect(hx, hy, 5, 4);
        ctx.fillStyle = "#aebcd0";
        ctx.fillRect(hx + 1, hy + 1, 3, 2);
        return;
      }

      // 横向き（待機・歩行・落下など）：背中バックパックの上後ろに刺さっている
      const headX = isLeft ? baseX + 12 : baseX - 1;
      const headY = drawY + 3;
      const gripStartX = isLeft ? baseX + 13 : baseX + 2;
      const gripDir = isLeft ? -1 : 1;

      ctx.fillStyle = "#8c5420";
      ctx.fillRect(gripStartX, drawY + 7, 2, 3);
      ctx.fillRect(gripStartX + gripDir, drawY + 10, 2, 4);
      ctx.fillStyle = "#d48e44";
      ctx.fillRect(gripStartX, drawY + 7, 1, 3);
      ctx.fillRect(gripStartX + gripDir, drawY + 10, 1, 3);

      ctx.fillStyle = "#48546a";
      ctx.fillRect(headX, headY, 5, 4);
      ctx.fillStyle = "#c2d0e4";
      ctx.fillRect(headX + (isLeft ? 1 : 0), headY + 1, 4, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(headX + (isLeft ? 2 : 1), headY + 1, 2, 1);
    },

    getPlayerHammerPhaseInfo(slot) {
      const t = slot.hammerTimer;
      if (slot.isGolden) {
        if (t <= 1) return { phase: "pull", pose: "hammerPull", behind: false };
        if (t <= 2) return { phase: "up", pose: "hammerUp", behind: false };
        if (t <= 4) return { phase: "swing", pose: "hammerSwing", behind: true };
        if (t <= 5) return { phase: "hit", pose: "hammerHit", behind: true };
        return { phase: "return", pose: "hammerPull", behind: false };
      }
      if (t <= 3) return { phase: "pull", pose: "hammerPull", behind: false };
      if (t <= 10) return { phase: "up", pose: "hammerUp", behind: false };
      if (t <= 15) return { phase: "swing", pose: "hammerSwing", behind: true };
      if (t <= 18) return { phase: "hit", pose: "hammerHit", behind: true };
      return { phase: "return", pose: "hammerPull", behind: false };
    },

    drawPlayerActiveHammer(slot, baseX, drawY, phase) {
      const ctx = this.ctx;
      const faceVal = slot.facing || slot.dir;
      const isLeft = (faceVal & LEFT) !== 0;
      const headMain = slot.isGolden ? "#ffe042" : "#aebcd0";
      const headDark = slot.isGolden ? "#a87010" : "#48546a";
      const headHi = slot.isGolden ? "#ffffff" : "#e8f2ff";
      const grip = "#d48e44";
      const gripDark = "#8c5420";

      if (phase === "pull" || phase === "return") {
        const hx = isLeft ? baseX + 12 : baseX - 3;
        const hy = drawY + 1;
        ctx.fillStyle = gripDark;
        ctx.fillRect(isLeft ? baseX + 12 : baseX + 2, drawY + 5, 2, 7);
        ctx.fillStyle = grip;
        ctx.fillRect(isLeft ? baseX + 12 : baseX + 2, drawY + 5, 1, 6);
        ctx.fillStyle = headDark;
        ctx.fillRect(hx, hy, 7, 5);
        ctx.fillStyle = headMain;
        ctx.fillRect(hx + 1, hy + 1, 5, 3);
        return;
      }

      if (phase === "up") {
        const hx = baseX + 3;
        const hy = drawY - 8;
        ctx.fillStyle = gripDark;
        ctx.fillRect(baseX + 7, drawY - 3, 2, 7);
        ctx.fillStyle = grip;
        ctx.fillRect(baseX + 7, drawY - 3, 1, 6);
        ctx.fillStyle = headDark;
        ctx.fillRect(hx, hy, 10, 6);
        ctx.fillStyle = headMain;
        ctx.fillRect(hx + 1, hy + 1, 8, 4);
        ctx.fillStyle = headHi;
        ctx.fillRect(hx + 2, hy + 1, 6, 1);
        return;
      }

      if (phase === "swing") {
        const hx = baseX + 4;
        const hy = drawY - 4;
        ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
        ctx.fillRect(baseX + 6, drawY - 10, 4, 2);
        ctx.fillRect(baseX + 5, drawY - 7, 6, 3);
        ctx.fillStyle = gripDark;
        ctx.fillRect(baseX + 7, drawY, 2, 8);
        ctx.fillStyle = headDark;
        ctx.fillRect(hx, hy, 8, 5);
        ctx.fillStyle = headMain;
        ctx.fillRect(hx + 1, hy + 1, 6, 3);
        return;
      }

      const hx = baseX + 4;
      const hy = drawY - 1;
      ctx.fillStyle = gripDark;
      ctx.fillRect(baseX + 7, drawY + 2, 2, 9);
      ctx.fillStyle = headDark;
      ctx.fillRect(hx, hy, 8, 5);
      ctx.fillStyle = headMain;
      ctx.fillRect(hx + 1, hy + 1, 6, 3);
      ctx.fillStyle = headHi;
      ctx.fillRect(hx + 2, hy + 2, 4, 1);

      if (slot.hammerTimer >= (slot.isGolden ? 5 : 17)) {
        ctx.fillStyle = "#fff480";
        ctx.fillRect(baseX + 2, drawY - 3, 2, 2);
        ctx.fillRect(baseX + 12, drawY - 3, 2, 2);
        ctx.fillRect(baseX + 7, drawY - 4, 2, 2);
      }
    },

    drawPlayerAt(slot, baseX, baseDrawY, world) {
      if (!this.playerSprites) return;
      const sprites = this.playerSprites;
      const ctx = this.ctx;
      const faceVal = slot.facing || slot.dir;
      const facing = (faceVal & LEFT) ? "L" : "R";

      if (world && world.marioDead) {
       const img = sprites.deadFall_R || sprites["idle_" + facing];
        if (!img) return;
        ctx.drawImage(img, baseX, baseDrawY);
        return;
      }

      if (slot.state === 15 || slot.state === 16) {
        const img = sprites["idle_" + facing];
        if (!img) return;
        const f = world ? world.f : 0;
        const phase = (f >> 2) & 1;
        const bobY = slot.state === 15 ? 4 : (phase ? -3 : -2);
        ctx.drawImage(img, 0, 0, 16, 9, baseX, baseDrawY + bobY, 16, 9);
        ctx.fillStyle = "#ea7224";
        ctx.fillRect(baseX + 1, baseDrawY + bobY + (phase ? 5 : 7), 2, 2);
        ctx.fillRect(baseX + 13, baseDrawY + bobY + (phase ? 7 : 5), 2, 2);
        if (slot.state === 16) {
          ctx.fillStyle = phase ? "#ffec48" : "#ffffff";
          ctx.fillRect(baseX + 7, baseDrawY - 6, 2, 2);
        }
        return;
      }

      if (slot.state === 10) {
        const img = sprites["fall_" + facing] || sprites["idle_" + facing];
        if (!img) return;
        ctx.save();
        ctx.translate(baseX, baseDrawY + 26);
        ctx.scale(1, -1);
        ctx.drawImage(img, 0, 0);
        this.drawPlayerBackHammer(0, 0, faceVal, "side");
        ctx.restore();
        return;
      }

      if (slot.state === 11) {
        const st = slot.stunTimer != null ? slot.stunTimer : 0;
        let poseKey = "recover1";
        let hammerOffsetX = 0;
        let hammerOffsetY = 2;

        if (st >= 10) {
          poseKey = "sit";
          hammerOffsetX = (faceVal & LEFT) ? 1 : -1;
          hammerOffsetY = 8;
        } else if (st >= 5) {
          poseKey = "recover0";
          hammerOffsetY = 4;
        } else {
          poseKey = "recover1";
          hammerOffsetY = 2;
        }

        const img = sprites[poseKey + "_" + facing] || sprites["idle_" + facing];
        if (!img) return;
        ctx.drawImage(img, baseX, baseDrawY);
        this.drawPlayerBackHammer(baseX + hammerOffsetX, baseDrawY + hammerOffsetY, faceVal, "side");

        // 尻もち直後の着地衝撃エフェクト（最初の6F間）
        if (st >= 14) {
          const isBurst = st >= 17;
          ctx.fillStyle = "#ffffff";
          if (isBurst) {
            ctx.fillRect(baseX - 2, baseDrawY + 23, 2, 1);
            ctx.fillRect(baseX - 1, baseDrawY + 24, 2, 1);
            ctx.fillRect(baseX + 16, baseDrawY + 23, 2, 1);
            ctx.fillRect(baseX + 15, baseDrawY + 24, 2, 1);
            ctx.fillStyle = "#9ad8ff";
            ctx.fillRect(baseX - 3, baseDrawY + 22, 1, 1);
            ctx.fillRect(baseX + 18, baseDrawY + 22, 1, 1);
          } else {
            ctx.fillRect(baseX - 3, baseDrawY + 22, 1, 1);
            ctx.fillRect(baseX - 2, baseDrawY + 25, 1, 1);
            ctx.fillRect(baseX + 18, baseDrawY + 22, 1, 1);
            ctx.fillRect(baseX + 17, baseDrawY + 25, 1, 1);
          }
        }
        return;
      }

      if (slot.state === 4) {
        const hInfo = this.getPlayerHammerPhaseInfo(slot);
        const img = sprites[hInfo.pose + "_" + facing];
        if (!img) return;
        if (hInfo.behind) {
          this.drawPlayerActiveHammer(slot, baseX, baseDrawY, hInfo.phase);
        }
        ctx.drawImage(img, baseX, baseDrawY);
        if (!hInfo.behind) {
          this.drawPlayerActiveHammer(slot, baseX, baseDrawY, hInfo.phase);
        }
        return;
      }

      if (slot.state === 2 || slot.state === 3 || slot.state === 6) {
        const lad = this.getPlayerLadderVisual(slot);
        const drawY = lad.vy - 26;
        const img = sprites[lad.pose + "_R"];
        if (!img) return;
        ctx.drawImage(img, baseX, drawY);
        this.drawPlayerBackHammer(baseX, drawY, faceVal, "back");
        return;
      }

      if (slot.state === 0 && world && slot.row < world.rows - 1) {
        const curT = world.getTile(slot.row, slot.col);
        if (curT !== TILE.SAND_LADDER &&
            isSameLadderType(curT, world.getTile(slot.row + 1, slot.col))) {
          const img = sprites.climbHold_R;
          if (!img) return;
          ctx.drawImage(img, baseX, baseDrawY);
          this.drawPlayerBackHammer(baseX, baseDrawY, faceVal, "back");
          return;
        }
      }

      let poseKey = "idle";
      let stepOffsetY = 0;
      if (slot.state === 5) {
        poseKey = "fall";
      } else if (slot.state === 8 || slot.state === 9) {
        poseKey = "walk2";
        stepOffsetY = 1;
      } else if (slot.state === 1) {
        const wf = slot.walkFrames || 0;
        const step = Math.floor(wf / WALK_STEP_FRAMES) & 3;
        poseKey = "walk" + step;
        if (step === 0 || step === 2) {
          stepOffsetY = 1;
        }
      }

      const img = sprites[poseKey + "_" + facing] || sprites["idle_" + facing];
      if (!img) return;
      ctx.drawImage(img, baseX, baseDrawY);
      this.drawPlayerBackHammer(baseX, baseDrawY + stepOffsetY, faceVal, "side");
    },

    drawPlayer(slot, worldWidth, world) {
      const baseDrawY = Math.round(slot.y) - 26;
      this.drawPlayerAt(slot, slot.x, baseDrawY, world);
      if (slot.x > worldWidth - 16) {
        this.drawPlayerAt(slot, slot.x - worldWidth, baseDrawY, world);
      }
      if (slot.x < 16) {
        this.drawPlayerAt(slot, slot.x + worldWidth, baseDrawY, world);
      }
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
