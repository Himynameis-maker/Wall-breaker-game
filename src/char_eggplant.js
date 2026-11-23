(function (root) {
  "use strict";

  const G = root.WreckGame || {};
  const LEFT = G.LEFT || 2;

  const R = root.WreckRender;
  if (!R || !R.Renderer) return;
  const makeSpriteSet = R.makeSpriteSet;

  // 通常（表側）パレット：黄緑寄りマイコンボディ ＋ 白い四つ足 ＋ 顔なしLED
  const PALETTE_EGGPLANT_FRONT = {
    K: "#102010", // 濃暗緑輪郭
    H: "#d6ff58", // 天板・明るい黄緑ハイライト
    G: "#88d828", // メイン黄緑
    D: "#4a8e18", // 深い黄緑影
    P: "#18261e", // ドライブ口・放熱スリット・基板暗部
    L: "#ff4828", // 赤橙LED・アンテナ先端ランプ
    Y: "#ffda38", // 極小アクセス黄ランプ
    M: "#98acc0", // 金属アンテナ・リア端子・底面放熱板
    W: "#ffffff", // 手前2本足（白）
    S: "#c8d6e8", // 奥2本足メイン・足影（淡白灰）
    A: "#6b7d98"  // 足裏接地パッド・奥足影（青鉄骨との境界分離用）
  };

  // 裏側（建物の奥）用シルエットパレット
  const PALETTE_EGGPLANT_BACK = {
    K: "#0e1420",
    H: "#3a526e",
    G: "#263850",
    D: "#182438",
    P: "#101824",
    L: "#5e465c",
    Y: "#5a667c",
    M: "#32445c",
    W: "#4c5e7a",
    S: "#34445c",
    A: "#222e42"
  };

  // はしご昇降ポーズ生成（厚み8pxの横長マイコンのまま白い4本足で左右柱を掴んで登る）
  function buildClimbPose(isFront, mode) {
    const antX = isFront ? 5 : 10;
    const body = isFront
      ? [
          "..KKKKKKKKKKKK..",
          "..KHHHHHHHHHHK..",
          "..KGGGGGGGGGGK..",
          "..KGPPPPPPGGGK..",
          "..KGGGGGGGGGYK..",
          "..KDDDDDPPPDLK..",
          "..KDDDDDDDDDDK..",
          "..KKKKKKKKKKKK.."
        ]
      : [
          "..KKKKKKKKKKKK..",
          "..KHHHHHHHHHHK..",
          "..KDPDPDPDPDPK..",
          "..KDPDPDPDPDPK..",
          "..KDDMMMMMMDDK..",
          "..KDDPPDDPPDDK..",
          "..KDDDDDDDDDDK..",
          "..KKKKKKKKKKKK.."
        ];

    const grid = Array.from({ length: 26 }, () => new Array(16).fill("."));
    grid[3][antX - 1] = "K";
    grid[3][antX] = "L";
    grid[3][antX + 1] = "K";
    for (let y = 4; y < 8; y++) {
      grid[y][antX] = "M";
    }
    for (let idx = 0; idx < body.length; idx++) {
      const brow = body[idx];
      for (let x = 0; x < 16; x++) {
        grid[8 + idx][x] = brow[x];
      }
    }

    function put(x, y, ch) {
      if (x >= 0 && x < 16 && y >= 0 && y < 26) {
        grid[y][x] = ch;
      }
    }

    if (mode === "hold") {
      put(1, 5, "W"); put(1, 6, "W"); put(1, 7, "W"); put(1, 8, "W"); put(1, 9, "S");
      put(14, 5, "W"); put(14, 6, "W"); put(14, 7, "W"); put(14, 8, "W"); put(14, 9, "S");
      put(3, 16, "W"); put(2, 17, "W"); put(1, 18, "W"); put(1, 19, "W"); put(1, 20, "S"); put(1, 21, "W");
      put(12, 16, "W"); put(13, 17, "W"); put(14, 18, "W"); put(14, 19, "W"); put(14, 20, "S"); put(14, 21, "W");
      put(5, 16, "S"); put(5, 17, "A"); put(5, 18, "S");
      put(10, 16, "S"); put(10, 17, "A"); put(10, 18, "S");
    } else if (mode === "L") {
      put(1, 3, "W"); put(1, 4, "W"); put(1, 5, "W"); put(1, 6, "S"); put(1, 7, "W"); put(1, 8, "W"); put(1, 9, "S");
      put(14, 11, "W"); put(14, 12, "W"); put(14, 13, "S"); put(14, 14, "S");
      put(3, 16, "W"); put(2, 17, "W"); put(1, 18, "W"); put(1, 19, "W"); put(1, 20, "S"); put(1, 21, "W"); put(1, 22, "W");
      put(12, 16, "W"); put(13, 16, "W"); put(14, 16, "W"); put(15, 17, "S");
      put(5, 16, "S"); put(5, 17, "S"); put(5, 18, "A"); put(5, 19, "S");
      put(10, 16, "S"); put(10, 17, "A");
    } else {
      put(14, 3, "W"); put(14, 4, "W"); put(14, 5, "W"); put(14, 6, "S"); put(14, 7, "W"); put(14, 8, "W"); put(14, 9, "S");
      put(1, 11, "W"); put(1, 12, "W"); put(1, 13, "S"); put(1, 14, "S");
      put(12, 16, "W"); put(13, 17, "W"); put(14, 18, "W"); put(14, 19, "W"); put(14, 20, "S"); put(14, 21, "W"); put(14, 22, "W");
      put(3, 16, "W"); put(2, 16, "W"); put(1, 16, "W"); put(0, 17, "S");
      put(10, 16, "S"); put(10, 17, "S"); put(10, 18, "A"); put(10, 19, "S");
      put(5, 16, "S"); put(5, 17, "A");
    }

    return grid.map(row => row.join(""));
  }

  // 気絶状態前半の仰向けひっくり返りポーズ生成（3コマ：足バタバタ＋折れアンテナ＋LEDエラー点滅）
  function buildFlippedPose(phase) {
    const grid = Array.from({ length: 26 }, () => new Array(16).fill("."));
    const body = [
      "...KKKKKKKKKKKK.",
      "...KMMMPPPPMMMK.",
      "...KDDDDDDDDDDK.",
      "...KDDGGGGGGDDK.",
      "...KGPPPPGGPPPK.",
      "...KGGGGGGGGGGK.",
      "...KHHHHHHHHHHK.",
      "...KKKKKKKKKKKK."
    ];
    for (let idx = 0; idx < body.length; idx++) {
      const brow = body[idx];
      for (let x = 0; x < 16; x++) {
        grid[18 + idx][x] = brow[x];
      }
    }

    // 地面に沿って折れ曲がったアンテナ（底面26行目に揃える）
    grid[24][2] = "M";
    grid[25][2] = "M";
    grid[25][1] = phase === 1 ? "K" : "L";
    grid[25][0] = "K";
    grid[24][1] = "K";

    if (phase === 0) {
      grid[22][13] = "L";
      grid[21][13] = "Y";
    } else if (phase === 1) {
      grid[22][13] = "P";
      grid[21][13] = "L";
    } else {
      grid[22][13] = "L";
      grid[21][13] = "P";
    }

    function put(x, y, ch) {
      if (x >= 0 && x < 16 && y >= 0 && y < 26) {
        grid[y][x] = ch;
      }
    }

    if (phase === 0) {
      put(4, 17, "W"); put(3, 16, "W"); put(2, 15, "W"); put(2, 14, "W"); put(1, 13, "W");
      put(7, 17, "S"); put(7, 16, "A"); put(6, 15, "S"); put(6, 14, "S");
      put(10, 17, "S"); put(10, 16, "A"); put(11, 15, "S"); put(11, 14, "S");
      put(13, 17, "W"); put(13, 16, "W"); put(14, 15, "W"); put(14, 14, "W"); put(14, 13, "W");
    } else if (phase === 1) {
      put(4, 17, "W"); put(4, 16, "W"); put(5, 15, "W"); put(5, 14, "W");
      put(7, 17, "S"); put(6, 16, "A"); put(6, 15, "S"); put(5, 14, "S"); put(5, 13, "S");
      put(10, 17, "S"); put(11, 16, "A"); put(11, 15, "S"); put(12, 14, "S"); put(12, 13, "S");
      put(13, 17, "W"); put(14, 16, "W"); put(14, 15, "W"); put(15, 14, "W");
    } else {
      put(4, 17, "W"); put(4, 16, "W"); put(3, 15, "W"); put(3, 14, "W"); put(3, 13, "W"); put(2, 12, "W");
      put(7, 17, "S"); put(7, 16, "S"); put(7, 15, "A"); put(7, 14, "S"); put(8, 13, "S");
      put(10, 17, "S"); put(10, 16, "S"); put(10, 15, "A"); put(9, 14, "S"); put(9, 13, "S");
      put(13, 17, "W"); put(13, 16, "W"); put(13, 15, "W"); put(14, 14, "W"); put(14, 13, "W"); put(15, 12, "W");
    }

    return grid.map(row => row.join(""));
  }

  const EGGPLANT_PATTERNS = {
    idle: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "...KLK..........",
      "....M...........",
      "....M...........",
      "....M...........",
      "....M...........",
      "..KKKKKKKKKKKK..",
      "..KHHHHHHHHHHK..",
      "..KGGGGGGGGGGK..",
      "..KGPPPPGGPPPK..",
      "..KGGGGGGGGDDK..",
      "..KDPPDPDDLYDK..",
      "..KDDDDDDDDDDK..",
      "..KKKKKKKKKKKK..",
      "...WW.SS..WW.SS.",
      "..WS...S..WS..S.",
      "..W....S...W..S.",
      "..W....S...W..S.",
      "...W...S...W..S.",
      "...W...S...W..S.",
      "...WWW.SS..WWWSS",
      "...AAA.AA..AAAAA"
    ],
    // 前足2本を前方高くガッツリ跳ね上げ＋後ろ足が平らなL字足先でしっかり地面蹴り
    walk0: [
      "................",
      "................",
      "................",
      "................",
      "..KLK...........",
      "...KM...........",
      "....M...........",
      "....M...........",
      "....M...........",
      "..KKKKKKKKKKKK..",
      "..KHHHHHHHHHHK..",
      "..KGGGGGGGGGGK..",
      "..KGPPPPGGPPPK..",
      "..KGGGGGGGGDDK..",
      "..KDPPDPDDLYDK..",
      "..KDDDDDDDDDDK.W",
      "..KKKKKKKKKKKKWW",
      "..WS..S..SSWWWS.",
      ".WS...S..A..SS..",
      ".W....S.........",
      ".W....S.........",
      ".W....S.........",
      "..W...S.........",
      "..W...S.........",
      "..WWW.SS........",
      "..AAA.AA........"
    ],
    // 空中飛翔（後ろ足を高く蹴り上げ、前足は前方へ着地構え）
    walk1: [
      "................",
      "................",
      "................",
      "................",
      "..KLK...........",
      "...KM...........",
      "....M...........",
      "....M...........",
      "....M...........",
      "..KKKKKKKKKKKK..",
      "..KHHHHHHHHHHK..",
      "..KGGGGGGGGGGK..",
      "..KGPPPPGGPPPK..",
      "..KGGGGGGGGDDK..",
      "..KDPPDPDDLYDK..",
      "W.KDDDDDDDDDDK..",
      "WWKKKKKKKKKKKK..",
      ".SWW.SS....WW.S.",
      "..SS..A.....WWSS",
      ".............W.S",
      ".............WWS",
      ".............AAA",
      "................",
      "................",
      "................",
      "................"
    ],
    // 前足着地踏ん張り＋後ろ足2本を後ろ上方へガッツリ蹴り上げ
    walk2: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "...KLK..........",
      "....M...........",
      "....M...........",
      "....M...........",
      "....M...........",
      "..KKKKKKKKKKKK..",
      "..KHHHHHHHHHHK..",
      "..KGGGGGGGGGGK..",
      "..KGPPPPGGPPPK..",
      "..KGGGGGGGGDDK..",
      "..KDPPDPDDLYDK..",
      "W.KDDDDDDDDDDK..",
      "WWKKKKKKKKKKKK..",
      ".SWW.SS...WW..S.",
      "..SS..A....W..S.",
      "...........W..S.",
      "...........W..S.",
      "...........W..S.",
      "...........W..S.",
      "..........WWW.SS",
      "..........AAA.AA"
    ],
    // 抱え込み（前足を膝高く引き上げ＋後ろ足体中央下に平らに接地）
    walk3: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "...KLK..........",
      "....M...........",
      "....M...........",
      "....M...........",
      "....M...........",
      "..KKKKKKKKKKKK..",
      "..KHHHHHHHHHHK..",
      "..KGGGGGGGGGGK..",
      "..KGPPPPGGPPPK..",
      "..KGGGGGGGGDDK..",
      "..KDPPDPDDLYDK..",
      "..KDDDDDDDDDDK..",
      "..KKKKKKKKKKKK..",
      "....WW.SS.WWWS..",
      "....WS..S.WW.SS.",
      ".....W..S.......",
      ".....W..S.......",
      ".....W..S.......",
      ".....W..S.......",
      ".....WWWSS......",
      ".....AAAAA......"
    ],
    frontStand: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "....KLK.........",
      ".....M..........",
      ".....M..........",
      ".....M..........",
      ".....M..........",
      "..KKKKKKKKKKKK..",
      "..KHHHHHHHHHHK..",
      "..KGGGGGGGGGGK..",
      "..KGPPPPPPGGGK..",
      "..KGGGGGGGGGYK..",
      "..KDDDDDPPPDLK..",
      "..KDDDDDDDDDDK..",
      "..KKKKKKKKKKKK..",
      "..WW.SS..SS.WW..",
      "..WS.S....S.SW..",
      "..W..S....S..W..",
      "..W..S....S..W..",
      "..W..S....S..W..",
      "..W..S....S..W..",
      "..WW.SS..SS.WW..",
      "..AA.AA..AA.AA.."
    ],
    backStand: [
      "................",
      "................",
      "................",
      "................",
      "................",
      ".........KLK....",
      "..........M.....",
      "..........M.....",
      "..........M.....",
      "..........M.....",
      "..KKKKKKKKKKKK..",
      "..KHHHHHHHHHHK..",
      "..KDPDPDPDPDPK..",
      "..KDPDPDPDPDPK..",
      "..KDDMMMMMMDDK..",
      "..KDDPPDDPPDDK..",
      "..KDDDDDDDDDDK..",
      "..KKKKKKKKKKKK..",
      "..WW.SS..SS.WW..",
      "..WS.S....S.SW..",
      "..W..S....S..W..",
      "..W..S....S..W..",
      "..W..S....S..W..",
      "..W..S....S..W..",
      "..WW.SS..SS.WW..",
      "..AA.AA..AA.AA.."
    ],
    frontHold: buildClimbPose(true, "hold"),
    frontClimbL: buildClimbPose(true, "L"),
    frontClimbR: buildClimbPose(true, "R"),
    backHold: buildClimbPose(false, "hold"),
    backClimbL: buildClimbPose(false, "L"),
    backClimbR: buildClimbPose(false, "R"),
    fall: [
      "................",
      "................",
      "..KLK...........",
      "...KM...........",
      "....M...........",
      "....M...........",
      "....M...........",
      "..KKKKKKKKKKKK..",
      "..KHHHHHHHHHHK..",
      "..KGGGGGGGGGGK..",
      "..KGPPPPGGPPPK..",
      "..KGGGGGGGGDDK..",
      "..KDPPDPDDLYDK..",
      "..KDDDDDDDDDDK..",
      ".WKKKKKKKKKKKKW.",
      "WW.SS......SS.WW",
      "W...S......S...W",
      "....A......A....",
      "....S......S....",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................"
    ],
    fallen0: buildFlippedPose(0),
    fallen1: buildFlippedPose(1),
    fallen2: buildFlippedPose(2),
    // 立て直し前半：斜めに体を起こしかけ
    recover0: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".......KLK......",
      ".......KM.......",
      "......KM........",
      "....KKKKKK......",
      "...KHHHHHHKK....",
      "..KHGGGGGGGGKK..",
      "..KGGPPPPGGGGKK.",
      "..KGGGGGGGGGGYK.",
      "..KGDDPPDDDDDLK.",
      "...KDDDDDDDDDK..",
      "....KKKDDDDKK...",
      "....WW.KKKKK..W.",
      "...WS...S..WWW..",
      "..WW....S.......",
      "..W.....S.......",
      "..W.....S.......",
      "..W.....S.......",
      "..WWW...SS......",
      "..AAA...AA......"
    ],
    // 立て直し後半：4本足を大きく開いて低い踏ん張り着地
    recover1: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "...KLK..........",
      "....M...........",
      "....M...........",
      "....M...........",
      "....M...........",
      "..KKKKKKKKKKKK..",
      "..KHHHHHHHHHHK..",
      "..KGGGGGGGGGGK..",
      "..KGPPPPGGPPPK..",
      "..KGGGGGGGGDDK..",
      "..KDPPDPDDLYDK..",
      "..KDDDDDDDDDDK..",
      "..KKKKKKKKKKKK..",
      "..WW.SS..SS.WW..",
      ".WS...S..S...SW.",
      ".W....S..S....W.",
      ".W....S..S....W.",
      ".WWW..SS.SS..WWW",
      ".AAA..AA.AA..AAA"
    ]
  };

  Object.assign(R.Renderer.prototype, {
    initEggplantSprites() {
      if (typeof makeSpriteSet !== "function") return;
      this.eggplantSprites = {
        front: makeSpriteSet(EGGPLANT_PATTERNS, PALETTE_EGGPLANT_FRONT),
        back: makeSpriteSet(EGGPLANT_PATTERNS, PALETTE_EGGPLANT_BACK)
      };
    },

    drawEggplantAt(enemy, baseX, baseDrawY, world) {
      if (!this.eggplantSprites) return;
      const ctx = this.ctx;
      const isBack = !!enemy.isBack;
      const sprites = isBack ? this.eggplantSprites.back : this.eggplantSprites.front;
      if (!sprites) return;

      const f = world ? world.f : 0;

     if (enemy.state === 15 || enemy.state === 16) {
        return;
      }

      const faceVal = enemy.facing || enemy.dir || LEFT;
      const facing = (faceVal & LEFT) ? "L" : "R";
      const stepPhase = (enemy.animCount >> 2) & 3;

      // State 10: 被弾跳ね落下状態（上下反転で落下）
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

      // State 4: 気絶硬直状態（96F: 前半72Fはひっくり返って足バタバタ＋星、後半24Fは星消し＋2段階立て直し）
      if (enemy.state === 4) {
        const st = enemy.stopTimer != null ? enemy.stopTimer : 0;
        let poseKey = "recover1";
        let showStars = false;

        if (st > 24) {
          const flailIdx = Math.floor(st / 3) % 3;
          poseKey = "fallen" + flailIdx;
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
          const starCenterX = baseX + (facing === "L" ? 6 : 8);
          const sx1 = starCenterX + Math.round(Math.cos(f * 0.35) * 4);
          const sx2 = starCenterX + Math.round(Math.cos(f * 0.35 + Math.PI) * 4);
          ctx.fillStyle = isBack ? "#7084a8" : "#ffec48";
          ctx.fillRect(sx1, baseDrawY + 7, 2, 2);
          ctx.fillStyle = isBack ? "#9cb0d4" : "#ffffff";
          ctx.fillRect(sx2, baseDrawY + 9, 2, 2);
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
        // 表→裏入り・奥抜けは背面パネル、逆は正面パネル
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

    drawEggplant(enemy, worldWidth, world) {
      const baseDrawY = enemy.y - 26;
      this.drawEggplantAt(enemy, enemy.x, baseDrawY, world);
      if (enemy.x > worldWidth - 16) {
        this.drawEggplantAt(enemy, enemy.x - worldWidth, baseDrawY, world);
      }
      if (enemy.x < 16) {
        this.drawEggplantAt(enemy, enemy.x + worldWidth, baseDrawY, world);
      }
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
