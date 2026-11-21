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
    COLLAPSE_STAGE_FRAMES,
    COLLAPSE_HIT_FRAMES,
    TILE,
    isLadderTile,
    isCrumblingLadderTile,
    isDoorOpeningTile,
    isHoleTile,
    isFallHoleTile,
    isSolidDrum,
    FALL_TABLE,
    KNOCKDOWN_DY
  } = G;

  // スパナゴン統一初期速度（0xAA = 8Fのうち4回移動 = 0.5px/F）
  const SPANAGON_DEFAULT_SPEED = 0xaa;

  // State 2 昇降用テーブル（ROM $CE51, $CE83 準拠）
  const ENEMY_LADDER_THRESH = [48, 46, 39, 34, 28, 23, 18, 12, 7, 2];
  const ENEMY_LADDER_RELY = [0, 3, 7, 11, 15, 19, 23, 27, 31, 32];

  // State 4 加速テーブル（ROM $D10A 準拠: speedMask の 1bit数 1..8 に対応）
  const ENEMY_ACCEL_TABLE = [0x11, 0x25, 0x55, 0xb5, 0xee, 0xfe, 0xff, 0xff];

  class EnemyActor {
    constructor(cfg = {}) {
      this.isMario = false;
      this.isEnemy = true;
      this.enemyType = cfg.enemyType || "spanagon";
      this.isBack = !!cfg.isBack;
      this.state = 0; // 0:思考/待機, 1:歩行, 2:はしご昇降, 4:ダウン後硬直/加速, 5:穴落ち, 10:ダウン落下
      this.x = cfg.x != null ? cfg.x : 0;
      this.y = cfg.y != null ? cfg.y : 64;
      this.dir = cfg.dir != null ? cfg.dir : LEFT;
      this.facing = (this.dir & (LEFT | RIGHT)) || LEFT;
      this.cmd = cfg.cmd != null ? cfg.cmd : this.facing;
      this.prevCmd = this.cmd;
      this.speedMask = cfg.speedMask != null ? (cfg.speedMask & 0xff) : SPANAGON_DEFAULT_SPEED;
      this.topY = this.y;
      this.avail = 0;
      this.row = 1;
      this.col = 0;
      this.flag = 0; // bit1 = ドラム缶頭上
      this.prom = 0;
      this.n = 0;
      this.stopTimer = 0;
      this.ladderStage = 0;
      this.isLadderPose = false;
      this.animCount = 0;
    }
  }

  class EnemyAI {
    updateCR(slot, world) {
      const wx = world.wrapX(slot.x + 8);
      slot.col = Math.floor(wx / 16);
      const rawRow = Math.floor((slot.y - 32) / 32);
      slot.row = Math.max(0, Math.min(world.rows - 1, rawRow));
    }

    snapX(slot, world) {
      slot.x = world.wrapCol(Math.floor(world.wrapX(slot.x + 8) / 16)) * 16;
    }

    snapY(slot) {
      slot.y = Math.floor((slot.y + 8) / 32) * 32;
      slot.flag &= ~0x02;
    }

    rotateSpeedMask(slot) {
      const moveNow = (slot.speedMask & 0x80) !== 0;
      slot.speedMask = ((slot.speedMask << 1) & 0xff) | (moveNow ? 1 : 0);
      return moveNow;
    }

    reverseHoriz(slot) {
      slot.cmd ^= (RIGHT | LEFT);
      const h = slot.cmd & (RIGHT | LEFT);
      if (h !== 0) {
        slot.dir = h;
        slot.facing = h;
      }
    }

    countBits8(val) {
      let bits = 0;
      let v = val & 0xff;
      while (v !== 0) {
        bits += v & 1;
        v >>>= 1;
      }
      return bits;
    }

    calcLadderStage(prom) {
      let idx = 9;
      while (idx > 0 && prom >= ENEMY_LADDER_THRESH[idx]) {
        idx -= 1;
      }
      return idx;
    }

    enterKnockdown(slot) {
      slot.state = 10;
      slot.n = 0;
      slot.prom = 0;
      slot.stopTimer = 0;
      slot.flag &= ~0x02;
      slot.isLadderPose = false;
      slot.ladderStage = 0;
    }

    // ROM $C316 + $C7F4 準拠: State 1 / State 2 用の足元・崩壊・爆風被弾判定
    checkEnemyHazardHit(slot, world) {
      if (slot.state !== 1 && slot.state !== 2) {
        return false;
      }

      // $C316 相当: State 2 で下半分 (y が topY+16..31) または $0B なら下の段を見る
      let checkRow = slot.row;
      if (slot.state === 2) {
        const curT = world.getTile(slot.row, slot.col);
        if (curT === TILE.HOLE_PILLAR_LAD || ((slot.y & 0x0f) !== 0 && (slot.y & 0x10) !== 0)) {
          checkRow = Math.min(world.rows - 1, slot.row + 1);
        }
      }

      const enemySide = slot.isBack ? 1 : 0;

      if (world.explosions && world.explosions.length > 0) {
        for (let i = 0; i < world.explosions.length; i++) {
          const ex = world.explosions[i];
          if (ex.col !== slot.col || ex.row !== checkRow) continue;
          if (ex.kind === "bomb") {
            const attackerSide = ex.byMario ? 0 : 1;
            if (ex.age >= 21 || enemySide !== attackerSide) {
              this.enterKnockdown(slot);
              return true;
            }
          } else if (ex.kind === "wall") {
            const attackerSide = ex.byMario ? 0 : 1;
            if (ex.age < COLLAPSE_HIT_FRAMES) {
              if (ex.age >= COLLAPSE_HIT_FRAMES - COLLAPSE_STAGE_FRAMES || enemySide !== attackerSide) {
                this.enterKnockdown(slot);
                return true;
              }
            }
          }
        }
      }

      const tile = world.getTile(checkRow, slot.col);

      const isDangerLadder = (r, c) => {
        const t = world.getTile(r, c);
        if (!isCrumblingLadderTile(t)) return false;
        const info = world.getCrumblingInfo ? world.getCrumblingInfo(r, c) : null;
        const stage = info ? info.stage : (t & 0x07);
        return stage <= 2;
      };

      // $C811〜$C822: 自分と1つ下の両方が壊れかけ最終段階 ($51/$52) なら無差別落下
      if (isDangerLadder(checkRow, slot.col)) {
        if (checkRow < world.rows - 1 && isDangerLadder(checkRow + 1, slot.col)) {
          this.enterKnockdown(slot);
          return true;
        }
      }

      // $C824〜$C834: 穴 ($09..$0B) かつ 1つ下が $51/$52 なら無差別落下
      if (isHoleTile(tile) && checkRow < world.rows - 1) {
        if (isDangerLadder(checkRow + 1, slot.col)) {
          this.enterKnockdown(slot);
          return true;
        }
      }

      if (!(slot.flag & 2)) {
        if (isDoorOpeningTile(tile)) {
          const attackerSide = (tile & 0x08) !== 0 ? 1 : 0;
          if (enemySide !== attackerSide) {
            this.enterKnockdown(slot);
            return true;
          }
        }

        if (world.pillarBreaks && world.pillarBreaks.size > 0) {
          const pInfo = world.getPillarBreakInfo ? world.getPillarBreakInfo(checkRow, slot.col) : null;
          if (pInfo && pInfo.stage >= 2) {
            const attackerSide = pInfo.byMario ? 0 : 1;
            if (enemySide !== attackerSide) {
              this.enterKnockdown(slot);
              return true;
            }
          }
        }

        if (isCrumblingLadderTile(tile)) {
          const info = world.getCrumblingInfo ? world.getCrumblingInfo(checkRow, slot.col) : null;
          const stage = info ? info.stage : (tile & 0x07);
          const byMario = info ? info.byMario : true;
          const attackerSide = byMario ? 0 : 1;
          if (stage >= 2 && enemySide !== attackerSide) {
            this.enterKnockdown(slot);
            return true;
          }
        }
      }

      return false;
    }

    // $CBAE 相当: マリオとの段差・最寄りはしご・ドラム缶挟みから進行方向を決定
    thinkDirection(slot, world) {
      const myRow = slot.row;
      const myCol = slot.col;
      const marioRow = world.mario.row;
      const marioCol = world.mario.col;

      let targetCol = -1;

      if (myRow === marioRow) {
        slot.cmd = marioCol < myCol ? LEFT : RIGHT;
        targetCol = marioCol;
      } else {
        const goingUp = myRow > marioRow;
        const vertBits = goingUp ? UP : DOWN;
        const scanRow = goingUp ? myRow : (myRow + 1);

        let bestDist = world.cols + 1;
        let bestCol = -1;
        if (scanRow >= 0 && scanRow < world.rows) {
          for (let c = 0; c < world.cols; c++) {
            const t = world.getTile(scanRow, c);
            if (t === TILE.LADDER || t === TILE.BREAK_LADDER) {
              const dist = Math.abs(c - myCol);
              if (dist < bestDist) {
                bestDist = dist;
                bestCol = c;
              }
            }
          }
        }

        let horizBits = 0;
        if (bestCol < 0) {
          horizBits = (myCol === 0 && (slot.x & 0x0f) === 0) ? (slot.facing || LEFT) : LEFT;
          targetCol = 0;
        } else {
          targetCol = bestCol;
          if (bestCol < myCol) {
            horizBits = LEFT;
          } else if (bestCol > myCol) {
            horizBits = RIGHT;
          } else {
            const xMod = slot.x & 0x0f;
            if (xMod === 0) {
              horizBits = 0;
            } else if (xMod < 8) {
              horizBits = LEFT;
            } else {
              horizBits = RIGHT;
            }
          }
        }
        slot.cmd = horizBits | vertBits;
      }

      // $CC50 相当: 進行先にドラム缶があり、目標との間に挟まっているなら反対向きへ回り込む
      const horiz = slot.cmd & (RIGHT | LEFT);
      if (horiz === 0) return;

      if (horiz === RIGHT) {
        for (let c = myCol + 1; c < world.cols; c++) {
          if (world.getTile(myRow, c) === TILE.DRUM) {
            if (c < targetCol) {
              this.reverseHoriz(slot);
            }
            break;
          }
        }
      } else {
        for (let c = myCol - 1; c >= 0; c--) {
          if (world.getTile(myRow, c) === TILE.DRUM) {
            if (c >= targetCol) {
              this.reverseHoriz(slot);
            }
            break;
          }
        }
      }
    }

    // $CB53 相当: 進行方向隣セルがドラム缶（または頭上歩行不可）なら反転
    checkDrumBlock(slot, world) {
      const horiz = slot.cmd & (RIGHT | LEFT);
      if (horiz === 0) return;

      const xMod = slot.x & 0x0f;
      let nextCol = slot.col;
      if (horiz & RIGHT) {
        if (xMod >= 5) return;
        nextCol = world.wrapCol(slot.col + 1);
      } else {
        if (xMod < 11) return;
        nextCol = world.wrapCol(slot.col - 1);
      }

      if ((slot.flag & 2) === 0) {
        if (world.getTile(slot.row, nextCol) === TILE.DRUM) {
          this.reverseHoriz(slot);
        }
        return;
      }

      // ドラム缶頭上歩行時 ($CB8F〜$CBAD): 隣が穴($09..$0B)か「下の段が空($00)のはしご」以外は反転
      slot.prom = 0x2e;
      const nextTile = world.getTile(slot.row, nextCol);
      if (nextTile === TILE.LADDER || nextTile === TILE.BREAK_LADDER) {
        const nextBelow = slot.row < world.rows - 1 ? world.getTile(slot.row + 1, nextCol) : TILE.EMPTY;
        if (nextBelow === TILE.EMPTY) return;
        this.reverseHoriz(slot);
        return;
      }
      if (!isHoleTile(nextTile)) {
        this.reverseHoriz(slot);
      }
    }

    // $CEB6 相当: はしごマス中央踏破時の進入判定
    tryEnemyLadder(slot, world) {
      const curTile = world.getTile(slot.row, slot.col);
      const canUp = curTile === TILE.LADDER || curTile === TILE.BREAK_LADDER;
      const belowTile = slot.row < world.rows - 1 ? world.getTile(slot.row + 1, slot.col) : TILE.EMPTY;
      const canDown = slot.row < world.rows - 1 && (belowTile === TILE.LADDER || belowTile === TILE.BREAK_LADDER);
      const avail = (canUp ? 2 : 0) | (canDown ? 1 : 0);

      if (avail === 0 || (slot.x & 0x0f) !== 0) {
        slot.avail = 0;
        return false;
      }

      slot.avail = avail;
      this.thinkDirection(slot, world);

      if (avail !== 3) {
        const wantVert = slot.cmd & (UP | DOWN);
        const availVert = avail << 2;
        if (wantVert !== availVert) {
          slot.avail = 0;
          return false;
        }
        slot.cmd = (slot.cmd & ~(UP | DOWN)) | availVert;
      }

      let vert = slot.cmd & (UP | DOWN);
      if (vert === 0) {
        slot.avail = 0;
        return false;
      }

      if (vert !== DOWN && slot.row === 0) {
        if (avail === 3) {
          slot.cmd = (slot.cmd & ~(UP | DOWN)) | DOWN;
          vert = DOWN;
        } else {
          slot.avail = 0;
          return false;
        }
      }

      if (vert === DOWN) {
        slot.topY = slot.y;
        slot.prom = 0x2f; // 47
      } else {
        slot.topY = slot.y - 32;
        slot.prom = 1;
      }
      slot.state = 2;
      slot.dir = vert;
      slot.ladderStage = 0;
      slot.isLadderPose = true;
      return true;
    }

    // $C4C8 相当: 穴への落下開始
    tryEnterHole(slot, world) {
      if (slot.row >= world.rows - 1) return false;
      if (slot.flag & 2) {
        if (isSolidDrum(world.getTile(slot.row + 1, slot.col))) return false;
      } else {
        if (!isFallHoleTile(world.getTile(slot.row, slot.col))) return false;
      }
      if (((slot.x + 3) & 0x0f) >= 6) return false;

      slot.prom = 0x12;
      slot.topY = slot.y;
      slot.state = 5;
      slot.isLadderPose = false;
      return true;
    }

    resumeWalkFromIdle(slot, world, runThink) {
      if (runThink) {
        this.thinkDirection(slot, world);
      }
      let horiz = slot.cmd & (RIGHT | LEFT);
      if (horiz === 0) {
        if (slot.state === 0) {
          horiz = slot.facing || LEFT;
          slot.cmd = (slot.cmd & ~(RIGHT | LEFT)) | horiz;
        } else {
          return false;
        }
      }
      slot.dir = horiz;
      slot.facing = horiz;
      if ((slot.flag & 2) === 0) {
        this.snapY(slot);
      }
      this.checkDrumBlock(slot, world);
      const afterHoriz = slot.cmd & (RIGHT | LEFT);
      slot.dir = afterHoriz;
      slot.facing = afterHoriz;
      slot.x = world.wrapX(slot.x + (afterHoriz === LEFT ? -1 : 1));
      slot.prevCmd = slot.cmd;
      slot.state = 1;
      slot.isLadderPose = false;
      slot.animCount = (slot.animCount + 1) & 0xff;
      this.updateCR(slot, world);
      return true;
    }

    stepState0(slot, world) {
      this.thinkDirection(slot, world);
      if ((slot.cmd & (RIGHT | LEFT)) === 0) {
        if (this.tryEnemyLadder(slot, world)) return;
      }
      this.resumeWalkFromIdle(slot, world, false);
    }

    stepState1(slot, world) {
      if (this.checkEnemyHazardHit(slot, world)) return;
      if (!this.rotateSpeedMask(slot)) return;
      slot.isLadderPose = false;
      slot.prevCmd = slot.cmd;
      this.checkDrumBlock(slot, world);
      if (this.tryEnemyLadder(slot, world)) return;
      if (this.tryEnterHole(slot, world)) return;

      const prevDir = slot.prevCmd & (RIGHT | LEFT);
      const curDir = slot.cmd & (RIGHT | LEFT);
      if (curDir === 0) {
        slot.cmd = (slot.cmd & ~(RIGHT | LEFT)) | (slot.facing || LEFT);
      }
      if (prevDir !== (slot.cmd & (RIGHT | LEFT))) {
        this.resumeWalkFromIdle(slot, world, false);
        return;
      }

      const stepX = (slot.cmd & LEFT) ? -1 : 1;
      slot.dir = stepX < 0 ? LEFT : RIGHT;
      slot.facing = slot.dir;
      slot.x = world.wrapX(slot.x + stepX);
      slot.animCount = (slot.animCount + 1) & 0xff;
      this.updateCR(slot, world);
    }

    stepState2(slot, world) {
      if (this.checkEnemyHazardHit(slot, world)) return;
      if (!this.rotateSpeedMask(slot)) return;

      // $CE8D 相当: 下り中に昇降中のはしごが壊れかけ/消滅したら上へ引き返す
      if ((slot.cmd & UP) === 0 && slot.prom >= 4) {
        const ladderRow = Math.max(0, Math.min(world.rows - 1, Math.floor(slot.topY / 32)));
        const ladderTile = world.getTile(ladderRow, slot.col);
        if (!isLadderTile(ladderTile) && ladderTile !== TILE.HOLE_PILLAR_LAD) {
          slot.cmd = (slot.cmd & ~(UP | DOWN)) | 0x80; // bit2=0 なので上り扱い
          slot.dir = UP;
        }
      }

      const isDown = (slot.cmd & DOWN) !== 0;
      slot.prom += isDown ? -1 : 1;

      // $CDB9 相当: 上り途中 (prom == 0x22) で上段がドラム缶か穴なら下へ引き返す
      if (slot.prom === 0x22) {
        this.updateCR(slot, world);
        const upTile = world.getTile(slot.row, slot.col);
        if (upTile === TILE.DRUM || isHoleTile(upTile)) {
          slot.cmd ^= (UP | DOWN);
          if (slot.cmd & DOWN) {
            slot.dir = DOWN;
          } else if (slot.cmd & UP) {
            slot.dir = UP;
          }
        }
      }

      if (slot.prom <= 0) {
        slot.y = slot.topY + 32;
        slot.prom = 0;
        slot.state = 0;
        slot.avail = 0;
        slot.ladderStage = 9;
        slot.isLadderPose = true;
        this.updateCR(slot, world);
        return;
      }
      if (slot.prom >= 48) {
        slot.y = slot.topY;
        slot.prom = 0;
        slot.state = 0;
        slot.avail = 0;
        slot.ladderStage = 0;
        slot.isLadderPose = true;
        this.updateCR(slot, world);
        return;
      }

      const idx = this.calcLadderStage(slot.prom);
      slot.ladderStage = idx;
      slot.isLadderPose = true;
      slot.y = slot.topY + ENEMY_LADDER_RELY[idx];
      slot.animCount = (slot.animCount + 1) & 0xff;
      this.updateCR(slot, world);
    }

    // $D0D5 相当: ダウン着地後 96F 硬直 → speedMask を1段階加速して歩行再開
    stepState4(slot, world) {
      slot.stopTimer -= 1;
      if (slot.stopTimer > 0) return;

      slot.stopTimer = 0;
      const bitCount = this.countBits8(slot.speedMask);
      const tblIdx = Math.max(0, Math.min(7, bitCount - 1));
      slot.speedMask = ENEMY_ACCEL_TABLE[tblIdx];
      slot.state = 0;
      this.resumeWalkFromIdle(slot, world, true);
    }

    stepState5(slot, world) {
      this.snapX(slot, world);
      slot.isLadderPose = false;
      slot.prom += 1;
      let spd = FALL_TABLE[slot.prom];
      if (spd < 0) {
        slot.prom -= 1;
        spd = FALL_TABLE[slot.prom];
      }
      slot.y = slot.topY + spd;
      slot.topY = slot.y;

      const maxFloorY = world.rows * 32;
      if (slot.y >= maxFloorY) {
        slot.y = maxFloorY;
        slot.topY = maxFloorY;
        slot.flag &= ~0x02;
        slot.state = 0;
        slot.prom = 0;
        this.updateCR(slot, world);
        return;
      }

      if (((slot.y + 2) & 0x1f) < 4) {
        this.snapY(slot);
        this.updateCR(slot, world);
        const t = world.getTile(slot.row, slot.col);
        const isHole = isFallHoleTile(t) && (slot.row < world.rows - 1);
        const isContLad = slot.row < world.rows - 1 &&
          isLadderTile(t) &&
          t === world.getTile(slot.row + 1, slot.col);
        if (!isHole && !isContLad) {
          slot.state = 0;
          slot.prom = 0;
          return;
        }
      }

      const yMod = slot.y & 0x1f;
      if (yMod >= 0x0b &&
          yMod < 0x0f &&
          slot.row < world.rows - 1 &&
          isSolidDrum(world.getTile(slot.row + 1, slot.col))) {
        slot.flag |= 2;
        slot.y = Math.floor(slot.y / 32) * 32 + 0x0b;
        slot.topY = Math.floor(slot.y / 16) * 16;
        slot.state = 0;
        slot.prom = 0;
        this.updateCR(slot, world);
        return;
      }
    }

    // $C0F6 相当: ダウン落下 → 最下段（または最下段ドラム缶天板）で State 4 (96F硬直) へ
    stepState10(slot, world) {
      const dy = slot.n < KNOCKDOWN_DY.length ? KNOCKDOWN_DY[slot.n] : 2;
      slot.n += 1;
      slot.y += dy;

      const maxFloorY = world.rows * 32;
      const bottomRow = world.rows - 1;
      const bottomDrumY = bottomRow * 32 + 0x0b;
      const canCheckLanding = slot.n >= KNOCKDOWN_DY.length || dy > 0;

      if (canCheckLanding &&
          slot.y >= bottomDrumY &&
          isSolidDrum(world.getTile(bottomRow, slot.col))) {
        slot.y = bottomDrumY;
        slot.topY = bottomDrumY;
        slot.flag |= 2;
        slot.prom = 0;
        slot.n = 0;
        slot.state = 4;
        slot.stopTimer = 0x60;
        this.updateCR(slot, world);
        return;
      }

      if (canCheckLanding && slot.y >= maxFloorY) {
        slot.y = maxFloorY;
        slot.topY = maxFloorY;
        slot.flag &= ~0x02;
        slot.prom = 0;
        slot.n = 0;
        slot.state = 4;
        slot.stopTimer = 0x60;
        this.updateCR(slot, world);
        return;
      }

      slot.topY = slot.y;
    }

    stepEnemy(slot, world) {
      this.updateCR(slot, world);
      if (slot.state === 0) {
        this.stepState0(slot, world);
      } else if (slot.state === 1) {
        this.stepState1(slot, world);
      } else if (slot.state === 2) {
        this.stepState2(slot, world);
      } else if (slot.state === 4) {
        this.stepState4(slot, world);
      } else if (slot.state === 5) {
        this.stepState5(slot, world);
      } else if (slot.state === 10) {
        this.stepState10(slot, world);
      }
    }

    updateAll(world) {
      if (!world.enemies || world.enemies.length === 0) return;
      for (let i = 0; i < world.enemies.length; i++) {
        this.stepEnemy(world.enemies[i], world);
      }
    }
  }

  const api = {
    SPANAGON_DEFAULT_SPEED,
    EnemyActor,
    EnemyAI
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.WreckGame = Object.assign(root.WreckGame || {}, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
