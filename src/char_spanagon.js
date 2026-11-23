(function (root) {
  "use strict";

  const G = root.WreckGame || {};
  const LEFT = G.LEFT || 2;

  const R = root.WreckRender;
  if (!R || !R.Renderer) return;
  const makeSpriteSet = R.makeSpriteSet;

  // 通常スパナゴン枠パレット（アンテナなし四角モニター・黄色ボディ＋シアン目）
  const PALETTE_SPANAGON_NORMAL = {
    K: "#181e2c", // 輪郭・モニター枠
    G: "#47536a", // メカ関節・底面暗
    M: "#8a9ab6", // メカ金属パーツ
    H: "#fff27a", // 黄色ハイライト
    Y: "#f0bc1e", // メインイエロー
    S: "#b2780c", // イエロー影
    B: "#0e242a", // モニター液晶背景
    E: "#4af5e8", // 発光目（シアン）
    W: "#ffffff"  // 目の芯
  };

  // 高速色違いパレット（暗めで危険な濃赤橙〜焦げレッド＋警告レッド目）
  const PALETTE_SPANAGON_FAST = {
    K: "#180c14", // 黒鉄輪郭
    G: "#3a2a36", // 暗ガンメタ関節
    M: "#786674", // メカ銀暗
    H: "#e86b24", // 濃い危険オレンジハイライト
    Y: "#a62c14", // 濃い暗赤橙メイン
    S: "#5e1308", // 焦げ暗赤影
    B: "#18080e", // 黒赤液晶背景
    E: "#ff2a24", // 警告レッド目
    W: "#ffe08a"  // 鋭い黄白ハイライト
  };

  // 裏側（建物の奥）用シルエットパレット（通常版）
  const PALETTE_SPANAGON_NORMAL_BACK = {
    K: "#0e1320",
    G: "#1a2338",
    M: "#2c3a58",
    H: "#3c4e74",
    Y: "#283654",
    S: "#182238",
    B: "#101624",
    E: "#52708a",
    W: "#7898b4"
  };

  // 裏側（建物の奥）用シルエットパレット（高速版）
  const PALETTE_SPANAGON_FAST_BACK = {
    K: "#0e101c",
    G: "#1c1d30",
    M: "#2e2d48",
    H: "#423656",
    Y: "#2a223c",
    S: "#1a1428",
    B: "#100e1c",
    E: "#6e3c4c",
    W: "#945868"
  };

  function buildPose(offsetY, headRows, bodyRows) {
    const out = new Array(26).fill("................");
    const merged = headRows.concat(bodyRows);
    for (let i = 0; i < merged.length; i++) {
      const y = offsetY + i;
      if (y >= 0 && y < 26) {
        out[y] = merged[i];
      }
    }
    return out;
  }

  // 頭部（3/4右向き・四角モニター・アンテナなし・9行）
  const HEAD_SIDE = [
    "..KKKKKKKKKKKK..",
    "..KHHYYKKKKKKK..",
    "..KHYKBBBBBBBK..",
    "..KHYKBEWBEWBK..",
    "..KHYKBEEBEEBK..",
    "..KYSKBBBBBBBK..",
    "..KSSKKKKKKKKK..",
    "..KKKKKKKKKKKK..",
    "......KGGK......"
  ];

  // 頭部（正面＝腹側：左右対称モニター顔）
  const HEAD_FRONT = [
    "..KKKKKKKKKKKK..",
    "..KHHYYYYYYHHK..",
    "..KKBBBBBBBBKK..",
    "..KKBEWBBEWBKK..",
    "..KKBEEBBEEBKK..",
    "..KKBBBBBBBBKK..",
    "..KSSYYYYYYSSK..",
    "..KKKKKKKKKKKK..",
    "......KGGK......"
  ];

  // 頭部（背面＝背中側：背面放熱スリット）
  const HEAD_BACK = [
    "..KKKKKKKKKKKK..",
    "..KHHYYYYYYHHK..",
    "..KYYYYYYYYYYK..",
    "..KYMMGGGGMMYK..",
    "..KYYGGGGGGYYK..",
    "..KYMMGGGGMMYK..",
    "..KSSYYYYYYSSK..",
    "..KKKKKKKKKKKK..",
    "......KGGK......"
  ];

  // 胴体（横向き中立：肩〜足なし腰底面）
  const BODY_SIDE_NEUTRAL = [
    "....KKHHHHKK....",
    "...KHHYYYYYYK...",
    "...KYYKMMKYSSK..",
    "...KYYKGGKYSSK..",
    "...KSSKMMKYSSK..",
    "...KKYYKKYYSSK..",
    "....KSSSSSSSK...",
    ".....KGGGGGK....",
    "......KKKKK....."
  ];

  // 歩行踏み込みA（手前腕後ろ引き＋奥腕前出し）
  const BODY_SIDE_STEP_A = [
    "....KKHHHHKK....",
    "...KHHYYYYYYKK..",
    "..KMMKYYYYYYGMK.",
    "..KGGKYYYYYSSKK.",
    "...KKKYYYYYSSK..",
    "....KYYYYYYSSK..",
    "....KSSSSSSSK...",
    ".....KGGGGGK....",
    "......KKKKK....."
  ];

  // 歩行踏み込みB（手前腕を前へ振り出し）
  const BODY_SIDE_STEP_B = [
    "....KKHHHHKK....",
    "...KHHYYYYYYK...",
    "...KYYKKGGYSSK..",
    "...KYYKMMMMMMK..",
    "...KSSKKGGGGKK..",
    "....KKYYYYYSSK..",
    "....KSSSSSSSK...",
    ".....KGGGGGK....",
    "......KKKKK....."
  ];

  // 正面・背面 ドア移動用（腕を自然に下ろした左右対称体）
  const BODY_SYM_STAND = [
    "....KKHHHHKK....",
    "...KHHYYYYHHK...",
    "..KKYYMGGMYYKK..",
    "..KMKYYGGYYKMK..",
    "..KGKYYYYYYKGK..",
    "...KKYYYYYYKK...",
    "....KSSSSSSK....",
    ".....KGGGGK.....",
    "......KKKK......"
  ];

  // 正面・背面 はしご掴み待機（両手横掴み）
  const BODY_SYM_HOLD = [
    "....KKHHHHKK....",
    ".KKKHHYYYYHHKKK.",
    "KMMKYYMGGMYYKMMK",
    "KGGKYYGGGGYYKGGK",
    ".KK.KYYYYYYK.KK.",
    "....KYYYYYYK....",
    "....KSSSSSSK....",
    ".....KGGGGK.....",
    "......KKKK......"
  ];

  function buildClimbL(headRows) {
    const rows = buildPose(4, headRows, [
      "....KKHHHHKK....",
      "...KHHYYYYHHKK..",
      "...KYYMGGMYYKMMK",
      "...KYYGGGGYYKGGK",
      "...KYYYYYYYYK.KK",
      "....KYYYYYYK....",
      "....KSSSSSSK....",
      ".....KGGGGK.....",
      "......KKKK......"
    ]);
    rows[8] = "KM" + rows[8].slice(2);
    rows[9] = "KG" + rows[9].slice(2);
    rows[10] = "KM" + rows[10].slice(2);
    rows[11] = "KG" + rows[11].slice(2);
    rows[12] = "KG" + rows[12].slice(2);
    rows[13] = ".KK" + rows[13].slice(3);
    rows[14] = ".KK" + rows[14].slice(3);
    return rows;
  }

  function mirrorRows(rows) {
    return rows.map(r => r.split("").reverse().join(""));
  }

  // 穴落ち落下ポーズ
  const SPANAGON_FALL = [
    "................",
    "................",
    "..KKKKKKKKKKKK..",
    "..KHHYYKKKKKKK..",
    "..KHYKBBBBBBBK..",
    "..KHYKBEWBEWBK..",
    "..KHYKBEEBEEBK..",
    "..KYSKBBBBBBBK..",
    "..KSSKKKKKKKKK..",
    "KMKKKKKKKKKKKKMK",
    "KG....KGGK....GK",
    ".KK.KKHHHHKK.KK.",
    "..KKHHYYYYYYKK..",
    "...KYMGGGGYSSK..",
    "...KYMMGGMYSSK..",
    "...KSSYYYYSSSK..",
    "....KSSSSSSSK...",
    ".....KGGGGGK....",
    "......KKKKK.....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................"
  ];

  // スタン倒れポーズ生成（液晶内 6x4 の砂嵐ノイズ差分用）
  function buildFallen(noiseRows) {
    return [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".KKKKKKKKKK.....",
      "KHHKKKKKKKK.....",
      "KHYK" + noiseRows[0] + "K.....",
      "KHYK" + noiseRows[1] + "K.KK..",
      "KYSK" + noiseRows[2] + "KKMMK.",
      "KSSK" + noiseRows[3] + "KKGGK.",
      "KSSKKKKKKKKYYK..",
      ".KKKKKKKKKHHYYK.",
      ".......KKKYYYYGK",
      ".......KSSSSSSGK",
      "........KKKKKKKK",
      "................"
    ];
  }

  // 立て直し前半（倒れた姿勢から腕を地面について斜めに起き上がり＋再起動バー目）
  const SPANAGON_RECOVER_0 = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "..KKKKKKKKKK....",
    ".KHHYKKKKKKKK...",
    ".KHYKBBBBBBBBK..",
    ".KHYKBBBBBBBBK..",
    ".KYSKBEEEEEEBK..",
    ".KSSKBBBBBBBBK..",
    "..KKKKKKKKKKK...",
    ".....KGGK.......",
    "...KKHHHHKK.....",
    "..KHHYYYYYYK....",
    "..KYMYYYYYSSK...",
    ".KGGKYYYYYSSK...",
    ".KMMKKSSSSSK....",
    ".KKK..KGGGGK....",
    ".......KKKKK....",
    "................"
  ];

  const SPANAGON_PATTERNS = {
    idle: buildPose(4, HEAD_SIDE, BODY_SIDE_NEUTRAL),
    walk0: buildPose(5, HEAD_SIDE, BODY_SIDE_STEP_A),
    walk1: buildPose(3, HEAD_SIDE, BODY_SIDE_NEUTRAL),
    walk2: buildPose(5, HEAD_SIDE, BODY_SIDE_STEP_B),
    walk3: buildPose(3, HEAD_SIDE, BODY_SIDE_NEUTRAL),
    frontStand: buildPose(4, HEAD_FRONT, BODY_SYM_STAND),
    backStand: buildPose(4, HEAD_BACK, BODY_SYM_STAND),
    frontHold: buildPose(4, HEAD_FRONT, BODY_SYM_HOLD),
    frontClimbL: buildClimbL(HEAD_FRONT),
    frontClimbR: mirrorRows(buildClimbL(HEAD_FRONT)),
    backHold: buildPose(4, HEAD_BACK, BODY_SYM_HOLD),
    backClimbL: buildClimbL(HEAD_BACK),
    backClimbR: mirrorRows(buildClimbL(HEAD_BACK)),
    fall: SPANAGON_FALL,
    fallen0: buildFallen(["WEBWKB", "BWEBWB", "EBWBWB", "BBKWEB"]),
    fallen1: buildFallen(["BWEBWB", "KBBKWE", "WEBKBW", "EBWBKB"]),
    fallen2: buildFallen(["BEWBBW", "WBBEWB", "BWKBEB", "WEWBKB"]),
    recover0: SPANAGON_RECOVER_0,
    recover1: buildPose(6, HEAD_SIDE, BODY_SIDE_NEUTRAL)
  };

  Object.assign(R.Renderer.prototype, {
    initSpanagonSprites() {
      if (typeof makeSpriteSet !== "function") return;
      this.spanagonSprites = {
        normalFront: makeSpriteSet(SPANAGON_PATTERNS, PALETTE_SPANAGON_NORMAL),
        fastFront: makeSpriteSet(SPANAGON_PATTERNS, PALETTE_SPANAGON_FAST),
        normalBack: makeSpriteSet(SPANAGON_PATTERNS, PALETTE_SPANAGON_NORMAL_BACK),
        fastBack: makeSpriteSet(SPANAGON_PATTERNS, PALETTE_SPANAGON_FAST_BACK)
      };
    },

    drawSpanagonAt(enemy, baseX, baseDrawY, world) {
      if (!this.spanagonSprites) return;
      const ctx = this.ctx;
      const isBack = !!enemy.isBack;
      const isFast = enemy.enemyType === "spanagonFast";
      const setKey = (isFast ? "fast" : "normal") + (isBack ? "Back" : "Front");
      const sprites = this.spanagonSprites[setKey];
      if (!sprites) return;

      const f = world ? world.f : 0;

      // State 15/16: ドラム缶捕獲待機・閉じ込め状態（蓋上端 baseDrawY の上にモニター上部と両手を出す）
      if (enemy.state === 15 || enemy.state === 16) {
        const phase = (f >> 2) & 1;
        const headImg = sprites.frontStand_R;
        if (!headImg) return;
        ctx.save();
        if (isBack) ctx.globalAlpha = 0.85;

        if (enemy.state === 15) {
          const headY = baseDrawY - 3;
          ctx.drawImage(headImg, 0, 4, 16, 3, baseX, headY, 16, 3);
        } else {
          const headY = baseDrawY - 7 + (phase ? -1 : 0);
          ctx.drawImage(headImg, 0, 4, 16, 7, baseX, headY, 16, 7);
        }

        const armColor = isBack ? (isFast ? "#2e2d48" : "#2c3a58") : (isFast ? "#786674" : "#8a9ab6");
        const armDark = isBack ? (isFast ? "#1c1d30" : "#1a2338") : (isFast ? "#3a2a36" : "#47536a");
        const h1 = enemy.state === 15 ? (baseDrawY - 3) : (baseDrawY - (phase ? 5 : 3));
        const h2 = enemy.state === 15 ? (baseDrawY - 3) : (baseDrawY - (phase ? 3 : 5));
        ctx.fillStyle = armColor;
        ctx.fillRect(baseX, h1, 2, 3);
        ctx.fillRect(baseX + 14, h2, 2, 3);
        ctx.fillStyle = armDark;
        ctx.fillRect(baseX, h1 + 2, 2, 1);
        ctx.fillRect(baseX + 14, h2 + 2, 2, 1);

        if (enemy.state === 16) {
          ctx.fillStyle = isBack
            ? "#7084a8"
            : (isFast ? (phase ? "#ff2a24" : "#ffe08a") : (phase ? "#ffec48" : "#ffffff"));
          ctx.fillRect(baseX + 7, baseDrawY - 10, 2, 2);
        }
        ctx.restore();
        return;
      }

      const faceVal = enemy.facing || enemy.dir || LEFT;
      const facing = (faceVal & LEFT) ? "L" : "R";
      const stepPhase = (enemy.animCount >> 2) & 3;

      // State 10: ダウン落下状態（上下反転で落下）
      if (enemy.state === 10) {
        const img = sprites["fall_" + facing] || sprites["idle_" + facing];
        if (!img) return;
        ctx.save();
        if (isBack) ctx.globalAlpha = 0.85;
        ctx.translate(baseX, baseDrawY + 26);
        ctx.scale(1, -1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
        return;
      }

      // State 4: ダウン後気絶硬直状態（96F: 前半72Fは倒れ＋ノイズ＋星、後半24Fは星消し＋立て直し2段階）
      if (enemy.state === 4) {
        const st = enemy.stopTimer != null ? enemy.stopTimer : 0;
        let poseKey = "recover1";
        let showStars = false;

        if (st > 24) {
          const noiseIdx = Math.floor(st / 3) % 3;
          poseKey = "fallen" + noiseIdx;
          showStars = true;
        } else if (st > 12) {
          poseKey = "recover0";
        } else {
          poseKey = "recover1";
        }

        const img = sprites[poseKey + "_" + facing] || sprites["idle_" + facing];
        if (!img) return;
        ctx.save();
        if (isBack) ctx.globalAlpha = 0.85;
        ctx.drawImage(img, baseX, baseDrawY);

        if (showStars) {
          const starCenterX = baseX + (facing === "L" ? 10 : 5);
          const sx1 = starCenterX + Math.round(Math.cos(f * 0.35) * 4);
          const sx2 = starCenterX + Math.round(Math.cos(f * 0.35 + Math.PI) * 4);
          ctx.fillStyle = isBack ? "#7084a8" : (isFast ? "#ff6038" : "#ffec48");
          ctx.fillRect(sx1, baseDrawY + 9, 2, 2);
          ctx.fillStyle = isBack ? "#9cb0d4" : "#ffffff";
          ctx.fillRect(sx2, baseDrawY + 11, 2, 2);
        }
        ctx.restore();
        return;
      }

      const isDoorIn = enemy.state === 3 && enemy.doorStage === 1;
      const isDoorOut = enemy.state === 3 && enemy.doorStage === 2;
      const isDoorDeep = isDoorIn || isDoorOut;
      const isFrontPause =
        (enemy.state === 2 && (enemy.ladderStage === 0 || enemy.ladderStage === 9)) ||
        (enemy.state === 0 && enemy.isLadderPose);
      const isClimbMove = enemy.state === 2 && !isFrontPause;
      const climbOdd = (enemy.ladderStage & 1) !== 0;

      let poseKey = "idle_" + facing;

      if (isDoorDeep) {
        // 表→裏入り(isDoorInかつ!isBack)および奥抜け(isDoorOutかつisBack)は後ろ姿、逆は正面向き
        const showBackFace = (!isBack && isDoorIn) || (isBack && isDoorOut);
        poseKey = (showBackFace ? "backStand" : "frontStand") + "_R";
      } else if (isFrontPause) {
        poseKey = (isBack ? "frontHold" : "backHold") + "_R";
      } else if (isClimbMove) {
        const prefix = isBack ? "front" : "back";
        poseKey = prefix + (climbOdd ? "ClimbL" : "ClimbR") + "_R";
      } else if (enemy.state === 5) {
        poseKey = "fall_" + facing;
      } else if (enemy.state === 1 || enemy.state === 3) {
        poseKey = "walk" + stepPhase + "_" + facing;
      }

      const img = sprites[poseKey] || sprites["idle_" + facing];
      if (!img) return;

      ctx.save();
      if (isBack) {
        ctx.globalAlpha = 0.85;
      }
      if (isDoorDeep) {
        ctx.globalAlpha = isBack ? 0.72 : 0.88;
        ctx.translate(baseX + 8, baseDrawY + 13);
        ctx.scale(0.84, 0.94);
        ctx.translate(-(baseX + 8), -(baseDrawY + 13));
      }
      ctx.drawImage(img, baseX, baseDrawY);
      ctx.restore();
    },

    drawSpanagon(enemy, worldWidth, world) {
      const baseDrawY = enemy.y - 26;
      this.drawSpanagonAt(enemy, enemy.x, baseDrawY, world);
      if (enemy.x > worldWidth - 16) {
        this.drawSpanagonAt(enemy, enemy.x - worldWidth, baseDrawY, world);
      }
      if (enemy.x < 16) {
        this.drawSpanagonAt(enemy, enemy.x + worldWidth, baseDrawY, world);
      }
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
