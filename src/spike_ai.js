(function (root) {
  "use strict";

  const G = (typeof module !== "undefined" && module.exports && !root.WreckGame)
    ? require("./constants.js")
    : (root.WreckGame || {});

  const {
    RIGHT,
    LEFT,
    DOWN,
    UP,
    isLadderTile,
    isSolidDrum
  } = G;

  class SpikeAI {
    constructor() {
      this.mem39 = 4;
      this.timer = 0;
    }

    update(world) {
      const sp = world.spike;
      const ma = world.mario;
      if (sp.state === 15 || sp.state === 16) {
        sp.bits = 0;
        return;
      }

      if (ma.row === sp.row && sp.y === ma.y) {
        let v = (this.timer - 1) & 0xff;
        if (v >= 0x80) {
          v = 0x20;
          if (ma.dir === this.mem39) {
            v = 0;
            sp.bits = this.horizontalVsMario(ma, sp);
          }
        }
        this.timer = v;
        this.mem39 = ma.dir;
        this.wallAvoid(world, 0, 0);
        return;
      }

      const vert = (ma.row !== sp.row)
        ? (sp.row > ma.row ? UP : DOWN)
        : (sp.y > ma.y ? UP : DOWN);
      const { horiz, bestRow, bestCol } = this.horizontalVsLadder(world, vert);
      sp.bits = vert | horiz;
      this.wallAvoid(world, bestRow, bestCol);
    }

    wallAvoid(world, bestRow, bestCol) {
      const sp = world.spike;
      const ma = world.mario;
      const horiz = sp.bits & 0x03;
      if (horiz === 0) return;

      const isRight = (horiz & RIGHT) !== 0;
      let wallCol = null;

      if (isRight) {
        for (let c = sp.col + 1; c < world.cols; c++) {
          if (isSolidDrum(world.getTile(sp.row, c))) {
            wallCol = c;
            break;
          }
        }
      } else {
        for (let c = sp.col - 1; c >= 0; c--) {
          if (isSolidDrum(world.getTile(sp.row, c))) {
            wallCol = c;
            break;
          }
        }
      }

      if (wallCol === null) return;

      const sameRow = ma.row === sp.row;
      const wallPos = sp.row * world.cols + wallCol;
      const maPos = ma.row * world.cols + ma.col;

      if (isRight) {
        if (!sameRow && wallCol >= bestCol) return;
        if (wallPos >= maPos) return;
      } else {
        if (!sameRow && wallCol < bestCol) return;
        if (wallPos < maPos) return;
      }
      sp.bits ^= 0x03;
    }

    horizontalVsLadder(world, vert) {
      const sp = world.spike;
      const searchRow = vert === UP ? sp.row : Math.min(world.rows - 1, sp.row + 1);
      let bestCol = 0;
      let bestRow = 0;
      let minDist = world.cols + 1;
      let found = false;

      for (let c = 0; c < world.cols; c++) {
        if (isLadderTile(world.getTile(searchRow, c))) {
          const dist = Math.abs(c - sp.col);
          if (dist < minDist) {
            minDist = dist;
            bestCol = c;
            bestRow = searchRow;
            found = true;
          }
        }
      }

      if (!found) {
        bestRow = 0;
        bestCol = 0;
      }

      const bestPos = bestRow * world.cols + bestCol;
      const spPos = searchRow * world.cols + sp.col;

      if (bestPos === spPos) {
        return { horiz: sp.dir & 0x03, bestRow, bestCol };
      }
      return { horiz: bestPos < spPos ? LEFT : RIGHT, bestRow, bestCol };
    }

    horizontalVsMario(ma, sp) {
      if (ma.col === sp.col) return 0;
      return ma.col < sp.col ? LEFT : RIGHT;
    }
  }

  const api = {
    SpikeAI
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.WreckGame = Object.assign(root.WreckGame || {}, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
