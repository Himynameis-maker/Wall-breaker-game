(function (root) {
  "use strict";

  const G = (typeof module !== "undefined" && module.exports && !root.WreckGame)
    ? require("../src/constants.js")
    : (root.WreckGame || {});
  const TILE = G.TILE;
  const RIGHT = G.RIGHT || 1;
  const LEFT = G.LEFT || 2;

  const L = TILE.LADDER;
  const D = TILE.DRUM;
  const H = TILE.HOLE;
  const W1 = TILE.WALL_1;
  const W2 = TILE.WALL_2;
  const W3 = TILE.WALL_3;
  const B = TILE.BOMB;
  const BL = TILE.BREAK_LADDER;
  const DR = TILE.DOOR;
  const P = TILE.PILLAR;

  const STAGES = {
    enemyDemo: {
      cols: 16,
      rows: 8,
      tiles: [
        [4, 2, BL], [4, 6, D], [4, 10, BL], [4, 13, BL],
        [5, 2, BL], [5, 5, H], [5, 6, P], [5, 8, DR], [5, 10, BL], [5, 13, BL], [5, 14, D],
        [6, 2, BL], [6, 4, D], [6, 7, BL], [6, 12, BL],
        [7, 0, D], [7, 4, DR], [7, 7, W1], [7, 8, B], [7, 10, L], [7, 12, DR], [7, 15, D]
      ],
      mario: { x: 192, y: 192 },
      spike: { x: 192, y: 64 },
      enemies: [
        { enemyType: "spanagon", x: 240, y: 192, dir: LEFT },
        { enemyType: "spanagonFast", x: 160, y: 224, dir: LEFT },
        { enemyType: "eggplant", x: 16, y: 192, dir: RIGHT }
      ]
    },
    doorDemo: {
      cols: 16,
      rows: 8,
      tiles: [
        [1, 10, L],
        [2, 2, L], [2, 4, DR], [2, 6, H], [2, 10, L],
        [3, 2, L], [3, 6, DR], [3, 10, L], [3, 13, B], [3, 14, DR], [3, 15, W1],
        [4, 2, L], [4, 5, DR], [4, 10, L],
        [5, 2, L], [5, 10, L], [5, 13, H],
        [6, 2, L], [6, 4, DR], [6, 6, B], [6, 7, DR], [6, 8, W1], [6, 9, W2], [6, 10, L], [6, 13, DR],
        [7, 0, D], [7, 15, D]
      ],
      mario: { x: 32, y: 224 },
      spike: { x: 160, y: 224 }
    },
    pillarDemo: {
      cols: 16,
      rows: 8,
      tiles: [
        // 最上段鉄柱（落ちない）＆上段テスト：壁・ドラム缶・2段連続壊せるはしご
        [0, 1, P], [0, 10, L],
        [1, 3, W1], [1, 5, D], [1, 7, BL], [1, 10, L],
        [2, 3, P], [2, 5, P], [2, 7, BL], [2, 10, L],
        [3, 2, L], [3, 7, P], [3, 10, L],
        [4, 2, L], [4, 10, L],
        // 下段（row 6）：col4=空床落とし, col6=ドラム缶落とし(閉じ込め), col8=爆弾落とし, col12=2回壁落とし
        [5, 2, L], [5, 6, D], [5, 8, B], [5, 10, L], [5, 12, W2],
        [6, 2, L], [6, 4, P], [6, 6, P], [6, 8, P], [6, 10, L], [6, 12, P],
        [7, 0, D], [7, 15, D]
      ],
      mario: { x: 48, y: 224 },
      spike: { x: 112, y: 224 }
    },
    hammerDemo: {
      cols: 16,
      rows: 8,
      tiles: [
        // 上段：壁・爆弾・ドラム缶テスト
        [2, 3, W2], [2, 4, W1], [2, 5, B], [2, 6, W3], [2, 8, L], [2, 11, D],
        [3, 8, L], [3, 11, H],
        // 中段：異種はしご(col3) と 同種連続壊せるはしご(col6)＋横の爆弾(col5)
        [4, 3, L], [4, 5, B], [4, 6, BL], [4, 8, L], [4, 12, H], [4, 14, W1],
        [5, 3, BL], [5, 6, BL], [5, 8, L], [5, 12, D], [5, 14, W2],
        // 下段（行6）：1/2/3回壁 と 爆弾連鎖（ヒビ経由含む）テスト
        [6, 4, W1], [6, 5, W2], [6, 6, W3], [6, 8, L],
        [6, 10, B], [6, 11, W1], [6, 12, W2], [6, 13, W1], [6, 14, B], [6, 15, W3],
        [7, 0, D], [7, 15, D]
      ],
      mario: { x: 32, y: 224 },
      spike: { x: 160, y: 192 }
    },
    standard8: {
      cols: 16,
      rows: 8,
      tiles: [
        [0, 5, H], [0, 6, H], [0, 10, L],
        [1, 3, L], [1, 5, D], [1, 6, L], [1, 10, L], [1, 13, D],
        [2, 3, L], [2, 6, L], [2, 8, H], [2, 10, L],
        [3, 2, D], [3, 6, L], [3, 8, D], [3, 12, L],
        [4, 4, L], [4, 7, H], [4, 12, L], [4, 14, D],
        [5, 4, L], [5, 7, L], [5, 9, D], [5, 11, H],
        [6, 2, L], [6, 7, L], [6, 11, D], [6, 14, L],
        [7, 0, D], [7, 15, D]
      ],
      mario: { x: 48, y: 224 },
      spike: { x: 208, y: 64 }
    },
    wide10: {
      cols: 20,
      rows: 10,
      tiles: [
        [0, 4, L], [0, 9, H], [0, 15, L],
        [1, 4, L], [1, 9, D], [1, 12, H], [1, 15, L], [1, 18, D],
        [2, 2, D], [2, 4, L], [2, 7, L], [2, 12, L], [2, 15, L],
        [3, 7, L], [3, 10, D], [3, 12, L], [3, 17, H],
        [4, 3, H], [4, 7, L], [4, 14, L], [4, 17, D],
        [5, 3, L], [5, 5, D], [5, 10, H], [5, 14, L],
        [6, 3, L], [6, 8, L], [6, 10, D], [6, 16, L],
        [7, 1, D], [7, 8, L], [7, 12, H], [7, 16, L],
        [8, 5, L], [8, 8, L], [8, 12, L], [8, 18, D],
        [9, 5, L], [9, 12, L]
      ],
      mario: { x: 64, y: 320 },
      spike: { x: 256, y: 64 }
    },
    compact6: {
      cols: 12,
      rows: 6,
      tiles: [
        [0, 3, H], [0, 8, L],
        [1, 3, D], [1, 5, L], [1, 8, L],
        [2, 2, L], [2, 5, L], [2, 9, D],
        [3, 2, L], [3, 7, H], [3, 10, L],
        [4, 4, D], [4, 7, L], [4, 10, L]
      ],
      mario: { x: 32, y: 192 },
      spike: { x: 144, y: 64 }
    },
    u6: {
      cols: 16,
      rows: 6,
      tiles: [[1, 5, L]],
      mario: { x: 80, y: 64 },
      spike: { x: 80, y: 64 }
    }
  };

  const api = {
    STAGES
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.WreckStages = Object.assign(root.WreckStages || {}, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
