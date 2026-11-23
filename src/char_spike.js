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

  // エンドスケルトン親方パレット（細身・濃いめシルバー金属骨格＋赤く光る目・ヘルメットなし）
  const PALETTE_ENDO = {
    H: "#bccae0",
    M: "#7b889c",
    S: "#4c576b",
    D: "#282f3c",
    K: "#121620",
    E: "#ff2424",
    G: "#ffa490"
  };

  // 待機・通過コマ用の上半身（高い位置 16行：自然な立ち姿＋軽く曲げた腕）
  const UPPER_IDLE = [
    "................",
    ".....MMMMM......",
    "....MMHHHHM.....",
    "....MMKKKKK.....",
    "....MMKKEGK.....",
    "....MSSDDMM.....",
    ".....MMKKK......",
    ".....SDDDD......",
    "......DDD.......",
    ".....MMMMM......",
    "....SMHHHMM.....",
    "....SKHMMMS.....",
    "....SSKHMMS.....",
    ".....SDKMHS.....",
    ".....SDKMHH.....",
    ".....SMMMMS....."
  ];

  // 歩行0コマ目（1px沈み 17行）：手前腕を前へ「くの字」に振り上げ、奥腕を後ろへ引く
  const UPPER_WALK_0 = [
    "................",
    "................",
    ".....MMMMM......",
    "....MMHHHHM.....",
    "....MMKKKKK.....",
    "....MMKKEGK.....",
    "....MSSDDMM.....",
    ".....MMKKK......",
    ".....SDDDD......",
    "......DDD.......",
    ".....MMMMM......",
    "....SMHHHMM.....",
    "....SKHMMMS.HH..",
    "...DSKKMHHMMHH..",
    "..DDSSDDDDDDD...",
    ".....SDMMHS.....",
    ".....SMMMMS....."
  ];

  // 歩行1・3コマ目（高い位置 16行）：通過中は腕を自然位置へ
  const UPPER_WALK_1 = UPPER_IDLE;

  // 歩行2コマ目（1px沈み 17行）：手前腕を後ろへ「くの字」に引き、奥腕を前へ振り上げる
  const UPPER_WALK_2 = [
    "................",
    "................",
    ".....MMMMM......",
    "....MMHHHHM.....",
    "....MMKKKKK.....",
    "....MMKKEGK.....",
    "....MSSDDMM.....",
    ".....MMKKK......",
    ".....SDDDD......",
    "......DDD.......",
    ".....MMMMM......",
    "....SMHHHMM.....",
    "....SMKMMMS..DD.",
    ".HH.SMKMMMSDDDD.",
    ".HHMMMKDDMMDS...",
    "..DDDDDMMHS.....",
    ".....SMMMMS....."
  ];

  const UPPER_WALK_3 = UPPER_IDLE;

  const LOWER_IDLE = [
    ".....SMMMMS.....",
    ".....MS..SM.....",
    ".....MH..HM.....",
    ".....DD..DD.....",
    ".....MH..HM.....",
    ".....MS..SM.....",
    ".....SD..DS.....",
    ".....MM..MM.....",
    "....HMM..HMM....",
    "....DDD..DDD...."
  ];

  // 足運び4コマ（手前足＝明銀H/M、奥足＝暗鉄S/D 固定。0/2は9行=沈み踏み込み、1/3は10行=軸足立ち＋膝高く上げ）
  const LOWER_WALK_0 = [
    ".....SMMMMS.....",
    "....MMS..SDD....",
    "...MMH....SDD...",
    "...MS......SD...",
    "..MH.......SD...",
    "..MS.......DD...",
    ".HMM.......DD...",
    ".DDD.......SDD..",
    "...........DDD.."
  ];
  const LOWER_WALK_1 = [
    ".....SMMMMS.....",
    ".....SS..MMM....",
    ".....SD..MHHHH..",
    ".....SD...SMMH..",
    ".....DD...MHS...",
    ".....DD...HMM...",
    ".....SD...DDD...",
    ".....SS.........",
    ".....SDD........",
    "....DDDD........"
  ];
  const LOWER_WALK_2 = [
    ".....SMMMMS.....",
    "....SDD..MMM....",
    "...SDD....MMH...",
    "...SD......MS...",
    "..SD.......MH...",
    "..DD.......MS...",
    ".SDD.......HMM..",
    ".DDD.......HMM..",
    "...........DDD.."
  ];
  const LOWER_WALK_3 = [
    ".....SMMMMS.....",
    ".....MM..SDD....",
    ".....MH..SDDDD..",
    ".....MS...SDDD..",
    ".....MH...SDD...",
    ".....MS...SDD...",
    ".....DD...DDD...",
    ".....MM.........",
    ".....HMM........",
    "....DDDD........"
  ];

  // 着地スタン（State 11：19F）用：尻もち ＋ 2段階起き上がり
  const ENDO_SIT = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "....MMMMM.......",
    "...MMHHHHM......",
    "...MMKKKKK......",
    "...MMKKEGK......",
    "...MSSDDMM......",
    "....MMKKK.......",
    "....SDDDD.......",
    ".....DDD........",
    "....MMMMM.......",
    "...SMHHHMM......",
    "...SMKDDDM......",
    "...SKHMMMS......",
    "...SDMMHS.MM....",
    "....SMMMMSHH....",
    "....MMMMMMMHH...",
    "....SDDDDDDDMM..",
    ".....DDDDDDDHHH."
  ];

  const ENDO_RECOVER_0 = [
    "................",
    "................",
    "................",
    "................",
    "................",
    ".....MMMMM......",
    "....MMHHHHM.....",
    "....MMKKKKK.....",
    "....MMKKEGK.....",
    "....MSSDDMM.....",
    ".....MMKKK......",
    ".....SDDDD......",
    "......DDD.......",
    ".....MMMMM......",
    "....SMHHHMM.....",
    "....SMKDDDM.....",
    "....SKHMMMS.....",
    ".....SDMMHHH....",
    ".....SMMMMSHH...",
    ".....SMMMMS.....",
    "...MMS....SMM...",
    "...MH......HM...",
    "...DD......DD...",
    "...MS......SM...",
    "..HMM......HMM..",
    "..DDD......DDD.."
  ];

  const ENDO_RECOVER_1 = [
    "................",
    "................",
    "................",
    ".....MMMMM......",
    "....MMHHHHM.....",
    "....MMKKKKK.....",
    "....MMKKEGK.....",
    "....MSSDDMM.....",
    ".....MMKKK......",
    ".....SDDDD......",
    "......DDD.......",
    ".....MMMMM......",
    "....SMHHHMM.....",
    "....SMKDDDM.....",
    "....SKHMMMS.....",
    ".....SDKMHH.....",
    ".....SMMMMS.....",
    ".....SMMMMS.....",
    "....MMS..SMM....",
    "....MH....HM....",
    "....DD....DD....",
    "....MH....HM....",
    "....MS....SM....",
    "....SD....DS....",
    "...HMM....HMM...",
    "...DDD....DDD..."
  ];

  // はしご（裏側にいるため腹側＝正面向き・肋骨フレームと赤い両目が見える）
  const ENDO_CLIMB_HOLD = [
    "................",
    ".....MMMMMM.....",
    "....MMHHHHMM....",
    "....MKKMMKKM....",
    "....MKEGGEKM....",
    "....MMKKKKMM....",
    ".....MKDKDM.....",
    "..HH.SDDDDS.HH..",
    "..MM..DDDD..MM..",
    "..SS.MMMMMM.SS..",
    "..DDMMKHHKMMDD..",
    "....MMKDDKMM....",
    "....SMKHHKMS....",
    ".....SDDDDS.....",
    "......DDDD......",
    ".....SMMMMS.....",
    ".....SMMMMS.....",
    ".....MS..SM.....",
    ".....MH..HM.....",
    ".....DD..DD.....",
    ".....MH..HM.....",
    ".....MS..SM.....",
    ".....SD..DS.....",
    ".....MM..MM.....",
    "....HMM..HMM....",
    "....DDD..DDD...."
  ];

  const ENDO_CLIMB_L = [
    "................",
    ".....MMMMMM.....",
    "....MMHHHHMM....",
    "....MKKMMKKM....",
    ".HH.MKEGGEKM....",
    ".MM.MMKKKKMM....",
    ".SS..MKDKDM.....",
    "..DD.SDDDDS.....",
    "...SS.DDDD......",
    "....SMMMMMMS....",
    "....MMKHHKMMSS..",
    "....MMKDDKMMSS..",
    "....SMKHHKMS.MM.",
    ".....SDDDDS..HH.",
    "......DDDD......",
    ".....SMMMMS.....",
    ".....SMMMMS.....",
    ".....MS..SMM....",
    ".....MH...HM....",
    ".....DD...DD....",
    ".....MH...HM....",
    ".....MS...SM....",
    ".....SD...HMM...",
    ".....MM...DDD...",
    "....HMM.........",
    "....DDD........."
  ];
  const ENDO_CLIMB_R = ENDO_CLIMB_L.map(row => row.split("").reverse().join(""));

  // 穴落ち落下ポーズ
  const ENDO_FALL = [
    "................",
    ".....MMMMM......",
    "....MMHHHHM.....",
    "....MMKKKKK.....",
    "....MMKKEGK.....",
    "....MSSDDMM.....",
    ".....MMKKK......",
    ".....SDDDD......",
    "......DDD.......",
    "..HH.MMMMM..HH..",
    "..MM.MHHHMM.MM..",
    "...SSMKDDDMSS...",
    "...DDSSHMMMS....",
    ".....SDMMDS.....",
    "......DDDD......",
    ".....SMMMMS.....",
    "....MMS..SMM....",
    "...MMH....HMM...",
    "...DD......DD...",
    "..MH........HM..",
    "..MS........SM..",
    "..SD........DS..",
    ".HMM........HMM.",
    ".DDD........DDD.",
    "................",
    "................"
  ];

  // ハンマー：背中から抜く（手前を向きかけの半身）
  const ENDO_HAMMER_PULL = [
    "................",
    ".....MMMMM......",
    "....MMHHHHM.....",
    "....MMKKKKKK....",
    "....MMKKEGKEK...",
    "....MSSDDMMM....",
    ".....MMKKKMM....",
    ".....SDDDDD.....",
    "......DDDD......",
    "...SSMMMMMM.....",
    "..SSMMKHHKMM....",
    "..HHMMKDDKMM....",
    "...SSMKHHKMS....",
    "....SDDDDDDS....",
    "......DDDD......",
    ".....SMMMMS.....",
    ".....SMMMMS.....",
    ".....MS..SM.....",
    ".....MH..HM.....",
    ".....DD..DD.....",
    ".....MH..HM.....",
    ".....MS..SM.....",
    ".....SD..DS.....",
    ".....MM..MM.....",
    "....HMM..HMM....",
    "....DDD..DDD...."
  ];

  // ハンマー：頭上振りかぶり（正面向きで両腕上げ）
  const ENDO_HAMMER_UP = [
    "..HH........HH..",
    "..MM..MMMM..MM..",
    "..SS.MMHHMM.SS..",
    "...DDMKKKKMDD...",
    "....MKEGGEKM....",
    "....MMKKKKMM....",
    ".....MKDKDM.....",
    ".....SDDDDS.....",
    "......DDDD......",
    ".....MMMMMM.....",
    "....MMKHHKMM....",
    "....MMKDDKMM....",
    "....SMKHHKMS....",
    ".....SDDDDS.....",
    "......DDDD......",
    ".....SMMMMS.....",
    ".....SMMMMS.....",
    ".....MS..SM.....",
    ".....MH..HM.....",
    ".....DD..DD.....",
    ".....MH..HM.....",
    ".....MS..SM.....",
    ".....SD..DS.....",
    ".....MM..MM.....",
    "....HMM..HMM....",
    "....DDD..DDD...."
  ];

  // ハンマー：こちら側（画面手前）へ振り下ろし途中（正面向き）
  const ENDO_HAMMER_SWING = [
    "................",
    ".....MMMMMM.....",
    "....MMHHHHMM....",
    "....MKKMMKKM....",
    "....MKEGGEKM....",
    "....MMKKKKMM....",
    ".....MKDKDM.....",
    ".....SDDDDS.....",
    "......DDDD......",
    "....SMMMMMMS....",
    "...SSMKHHKMSS...",
    "...DDMKDDKMDD...",
    "....MMKHHKMM....",
    "....HHSDDDSHH...",
    "......DDDD......",
    ".....SMMMMS.....",
    ".....SMMMMS.....",
    ".....MS..SM.....",
    ".....MH..HM.....",
    ".....DD..DD.....",
    ".....MH..HM.....",
    ".....MS..SM.....",
    ".....SD..DS.....",
    ".....MM..MM.....",
    "....HMM..HMM....",
    "....DDD..DDD...."
  ];

  // ハンマー：こちら側（画面手前）へ叩きつけ！（腰を落とした踏ん張り正面）
  const ENDO_HAMMER_HIT = [
    "................",
    "................",
    ".....MMMMMM.....",
    "....MMHHHHMM....",
    "....MKKMMKKM....",
    "....MKEGGEKM....",
    "....MMKKKKMM....",
    ".....MKDKDM.....",
    ".....SDDDDS.....",
    "....SMMMMMMS....",
    "...SSMKHHKMSS...",
    "...DDMKDDKMDD...",
    "....HHKHHKHH....",
    ".....SDDDDS.....",
    ".....SMMMMS.....",
    "....MMS..SMM....",
    "....MH....HM....",
    "...DD......DD...",
    "...MH......HM...",
    "...MS......SM...",
    "...SD......DS...",
    "...MM......MM...",
    "...MM......MM...",
    "...MM......MM...",
    "..HMM......HMM..",
    "..DDD......DDD.."
  ];

  const WALK_STEP_FRAMES = 5; // 歩行コマ切替間隔（5Fごと）

  Object.assign(R.Renderer.prototype, {
    initSpikeSprites() {
      if (typeof makeSpriteSet !== "function") return;
      this.endoSpikeSprites = makeSpriteSet(
        {
          idle: UPPER_IDLE.concat(LOWER_IDLE),
          walk0: UPPER_WALK_0.concat(LOWER_WALK_0),
          walk1: UPPER_WALK_1.concat(LOWER_WALK_1),
          walk2: UPPER_WALK_2.concat(LOWER_WALK_2),
          walk3: UPPER_WALK_3.concat(LOWER_WALK_3),
          sit: ENDO_SIT,
          recover0: ENDO_RECOVER_0,
          recover1: ENDO_RECOVER_1,
          climbHold: ENDO_CLIMB_HOLD,
          climbL: ENDO_CLIMB_L,
          climbR: ENDO_CLIMB_R,
          fall: ENDO_FALL,
          hammerPull: ENDO_HAMMER_PULL,
          hammerUp: ENDO_HAMMER_UP,
          hammerSwing: ENDO_HAMMER_SWING,
          hammerHit: ENDO_HAMMER_HIT
        },
        PALETTE_ENDO
      );
    },

    // 親方ロジック（enter_top 9F 等）に厳密準拠した上での均等間隔ステップ補正
    getSpikeLadderVisual(slot) {
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
          // 親方の enter_top は全9F（n=1..8 + prom=31 1F）のため 3F-3F-3F で均等割り
          if (n <= 3) {
            vy = topY;
            isHold = true;
          } else if (n <= 6) {
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

    drawSpikeBackHammer(baseX, drawY, facingDir, mode) {
      const ctx = this.ctx;
      const isLeft = (facingDir & LEFT) !== 0;

      if (mode === "front") {
        // 腹側（正面向き・はしご昇降中）：背中の奥に斜めマウントされたハンマーが肩と腰から覗く
        const headX = isLeft ? baseX + 10 : baseX + 1;
        const headY = drawY + 5;
        ctx.fillStyle = "#222936";
        for (let i = 0; i < 10; i++) {
          const px = isLeft ? (baseX + 11 - i * 0.7) : (baseX + 4 + i * 0.7);
          ctx.fillRect(Math.round(px), drawY + 8 + i, 2, 2);
        }
        ctx.fillStyle = "#8a9ab4";
        for (let i = 0; i < 9; i++) {
          const px = isLeft ? (baseX + 11 - i * 0.7) : (baseX + 4 + i * 0.7);
          ctx.fillRect(Math.round(px), drawY + 8 + i, 1, 1);
        }
        ctx.fillStyle = "#28303e";
        ctx.fillRect(headX, headY, 5, 4);
        ctx.fillStyle = "#8a9ab4";
        ctx.fillRect(headX + 1, headY + 1, 3, 2);
        ctx.fillStyle = "#dce8fa";
        ctx.fillRect(headX + 1, headY + 1, 2, 1);
        return;
      }

      // 横向き（待機・歩行・落下など）：細身の背中に斜めに背負っている
      const headX = isLeft ? baseX + 11 : baseX;
      const headY = drawY + 4;
      const gripStartX = isLeft ? baseX + 12 : baseX + 3;
      const gripDir = isLeft ? -1 : 1;

      ctx.fillStyle = "#222936";
      ctx.fillRect(gripStartX, drawY + 8, 2, 3);
      ctx.fillRect(gripStartX + gripDir, drawY + 11, 2, 4);
      ctx.fillStyle = "#8a9ab4";
      ctx.fillRect(gripStartX, drawY + 8, 1, 3);
      ctx.fillRect(gripStartX + gripDir, drawY + 11, 1, 3);

      ctx.fillStyle = "#28303e";
      ctx.fillRect(headX, headY, 5, 4);
      ctx.fillStyle = "#8a9ab4";
      ctx.fillRect(headX + (isLeft ? 1 : 0), headY + 1, 4, 2);
      ctx.fillStyle = "#dce8fa";
      ctx.fillRect(headX + (isLeft ? 2 : 1), headY + 1, 2, 1);
      ctx.fillStyle = "#e03030";
      ctx.fillRect(headX + (isLeft ? 3 : 1), headY + 2, 1, 1);
    },

    // 親方ハンマー（全27F / 14F目叩き / 23F目終盤硬直戻し）に厳密合わせ
    getSpikeHammerPhaseInfo(slot) {
      const t = slot.hammerTimer || 0;
      if (t <= 4) return { phase: "pull", pose: "hammerPull", behind: false };
      if (t <= 10) return { phase: "up", pose: "hammerUp", behind: true };
      if (t <= 13) return { phase: "swing", pose: "hammerSwing", behind: false };
      if (t <= 22) return { phase: "hit", pose: "hammerHit", behind: false };
      return { phase: "return", pose: "hammerPull", behind: false };
    },

    drawSpikeActiveHammer(slot, baseX, drawY, phase) {
      const ctx = this.ctx;
      const faceVal = slot.facing || slot.dir;
      const isLeft = (faceVal & LEFT) !== 0;
      const headDark = "#1c222c";
      const headMid = "#5a667c";
      const headMain = "#8897b0";
      const headHi = "#d4e2f6";
      const gripDark = "#222834";
      const grip = "#8a9ab4";

      if (phase === "pull" || phase === "return") {
        const hx = isLeft ? baseX + 11 : baseX - 2;
        const hy = drawY + 2;
        ctx.fillStyle = gripDark;
        ctx.fillRect(isLeft ? baseX + 11 : baseX + 3, drawY + 6, 2, 7);
        ctx.fillStyle = grip;
        ctx.fillRect(isLeft ? baseX + 11 : baseX + 3, drawY + 6, 1, 6);
        ctx.fillStyle = headDark;
        ctx.fillRect(hx, hy, 7, 5);
        ctx.fillStyle = headMain;
        ctx.fillRect(hx + 1, hy + 1, 5, 3);
        ctx.fillStyle = headHi;
        ctx.fillRect(hx + 1, hy + 1, 4, 1);
        return;
      }

      if (phase === "up") {
        // 頭上に重厚メカハンマーを高く振りかぶる
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
        ctx.fillStyle = "#e03030";
        ctx.fillRect(hx + 4, hy + 3, 2, 1);
        return;
      }

      if (phase === "swing") {
        // こちら側（画面手前・キャラ前面）へ振り下ろし途中（手前寄り大きめ）
        const hx = baseX + 3;
        const hy = drawY + 4;
        ctx.fillStyle = "rgba(255, 110, 90, 0.55)";
        ctx.fillRect(baseX + 5, drawY - 4, 6, 2);
        ctx.fillRect(baseX + 4, drawY - 1, 8, 3);
        ctx.fillStyle = gripDark;
        ctx.fillRect(baseX + 7, drawY + 9, 2, 5);
        ctx.fillStyle = grip;
        ctx.fillRect(baseX + 7, drawY + 9, 1, 4);
        ctx.fillStyle = headDark;
        ctx.fillRect(hx, hy, 10, 6);
        ctx.fillStyle = headMain;
        ctx.fillRect(hx + 1, hy + 1, 8, 4);
        ctx.fillStyle = headHi;
        ctx.fillRect(hx + 2, hy + 1, 6, 2);
        return;
      }

      // hit: 14F目の叩き判定に同期！こちら側へドカンと突き出し叩きつけ
      const hx = baseX + 2;
      const hy = drawY + 9;
      ctx.fillStyle = gripDark;
      ctx.fillRect(baseX + 7, drawY + 14, 2, 6);
      ctx.fillStyle = grip;
      ctx.fillRect(baseX + 7, drawY + 14, 1, 5);
      ctx.fillStyle = headDark;
      ctx.fillRect(hx, hy, 12, 7);
      ctx.fillStyle = headMid;
      ctx.fillRect(hx + 1, hy + 1, 10, 5);
      ctx.fillStyle = headMain;
      ctx.fillRect(hx + 2, hy + 1, 8, 4);
      ctx.fillStyle = headHi;
      ctx.fillRect(hx + 3, hy + 2, 6, 2);
      ctx.fillStyle = "#e03030";
      ctx.fillRect(hx + 5, hy + 4, 2, 1);

      if (slot.hammerTimer >= 14 && slot.hammerTimer <= 17) {
        ctx.fillStyle = "#ff4030";
        ctx.fillRect(baseX, drawY + 8, 2, 2);
        ctx.fillRect(baseX + 14, drawY + 8, 2, 2);
        ctx.fillStyle = "#fff480";
        ctx.fillRect(baseX + 1, drawY + 15, 2, 2);
        ctx.fillRect(baseX + 13, drawY + 15, 2, 2);
        ctx.fillRect(baseX + 7, drawY + 6, 2, 2);
      }
    },

    drawSpikeAt(slot, baseX, baseDrawY, world) {
      if (!this.endoSpikeSprites) return;
      const sprites = this.endoSpikeSprites;
      const ctx = this.ctx;
      const faceVal = slot.facing || slot.dir;
      const facing = (faceVal & LEFT) ? "L" : "R";

     if (slot.state === 15 || slot.state === 16) {
        return;
      }

      if (slot.state === 10) {
        const img = sprites["fall_" + facing] || sprites["idle_" + facing];
        if (!img) return;
        ctx.save();
        ctx.translate(baseX, baseDrawY + 26);
        ctx.scale(1, -1);
        ctx.drawImage(img, 0, 0);
        this.drawSpikeBackHammer(0, 0, faceVal, "side");
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
        this.drawSpikeBackHammer(baseX + hammerOffsetX, baseDrawY + hammerOffsetY, faceVal, "side");

        // 尻もち直後の着地衝撃エフェクト（最初の6F間）
        if (st >= 14) {
          const isBurst = st >= 17;
          ctx.fillStyle = "#ffffff";
          if (isBurst) {
            ctx.fillRect(baseX - 2, baseDrawY + 23, 2, 1);
            ctx.fillRect(baseX - 1, baseDrawY + 24, 2, 1);
            ctx.fillRect(baseX + 16, baseDrawY + 23, 2, 1);
            ctx.fillRect(baseX + 15, baseDrawY + 24, 2, 1);
            ctx.fillStyle = "#ff6848";
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
        const hInfo = this.getSpikeHammerPhaseInfo(slot);
        const img = sprites[hInfo.pose + "_" + facing];
        if (!img) return;
        if (hInfo.behind) {
          this.drawSpikeActiveHammer(slot, baseX, baseDrawY, hInfo.phase);
        }
        ctx.drawImage(img, baseX, baseDrawY);
        if (!hInfo.behind) {
          this.drawSpikeActiveHammer(slot, baseX, baseDrawY, hInfo.phase);
        }
        return;
      }

      if (slot.state === 2 || slot.state === 3 || slot.state === 6) {
        const lad = this.getSpikeLadderVisual(slot);
        const drawY = lad.vy - 26;
        const img = sprites[lad.pose + "_R"];
        if (!img) return;
        this.drawSpikeBackHammer(baseX, drawY, faceVal, "front");
        ctx.drawImage(img, baseX, drawY);
        return;
      }

      if (slot.state === 0 && world && slot.row < world.rows - 1) {
        const curT = world.getTile(slot.row, slot.col);
        if (isSameLadderType(curT, world.getTile(slot.row + 1, slot.col))) {
          const img = sprites.climbHold_R;
          if (!img) return;
          this.drawSpikeBackHammer(baseX, baseDrawY, faceVal, "front");
          ctx.drawImage(img, baseX, baseDrawY);
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
      this.drawSpikeBackHammer(baseX, baseDrawY + stepOffsetY, faceVal, "side");
    },

    drawSpike(slot, worldWidth, world) {
      const baseDrawY = slot.y - 26;
      this.drawSpikeAt(slot, slot.x, baseDrawY, world);
      if (slot.x > worldWidth - 16) {
        this.drawSpikeAt(slot, slot.x - worldWidth, baseDrawY, world);
      }
      if (slot.x < 16) {
        this.drawSpikeAt(slot, slot.x + worldWidth, baseDrawY, world);
      }
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
