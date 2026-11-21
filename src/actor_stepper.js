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
    HAMMER,
    COLLAPSE_HIT_FRAMES,
    TILE,
    isLadderTile,
    isCrumblingLadderTile,
    isDoorOpeningTile,
    isSameLadderType,
    isHoleTile,
    isFallHoleTile,
    isSolidDrum,
    getHammerTiming,
    FALL_TABLE,
    KNOCKDOWN_DY,
    relYOfProm
  } = G;

  class Actor {
    constructor(isMario) {
      this.isMario = isMario;
      this.state = 0;
      this.aux = 0;      // State 8 カウンタ / State 9 目標列
      this.auxRow = 0;   // State 9 目標行
      this.bits = 0;
      this.x = 80;
      this.y = 64;
      this.dir = 4;
      this.facing = RIGHT;
      this.topY = 32;    // State 2/3/6:上端Y, State 5:前Y
      this.avail = 0;
      this.row = 1;
      this.col = 5;
      this.flag = 0;     // bit1 = ドラム缶頭上
      this.n = 0;        // 境界ステート経過F / State 10 カウンタ
      this.kind = null;
      this.prom = 0;
      this.hammerTimer = 0;
      this.hammerHitDone = false;
      this.isGolden = false;
      this.prevHammer = false;
      this.stunTimer = 0;
    }
  }

  class ActorStepper {
    getActorSide(slot) {
      if (slot.isMario) return 0;
      if (!slot.isEnemy) return 1;
      return slot.isBack ? 1 : 0;
    }

    updateCR(slot, world) {
      const wx = world.wrapX(slot.x + 8);
      slot.col = Math.floor(wx / 16);
      const rawRow = Math.floor((slot.y - 32) / 32);
      slot.row = Math.max(0, Math.min(world.rows - 1, rawRow));
    }

    snapY(slot) {
      slot.y = Math.floor((slot.y + 8) / 32) * 32;
      slot.flag &= ~0x02;
    }

    snapX(slot, world) {
      slot.x = world.wrapCol(Math.floor(world.wrapX(slot.x + 8) / 16)) * 16;
    }

    isContinuousLadder(row, col, world) {
      return row >= 0 &&
        row < world.rows - 1 &&
        isSameLadderType(world.getTile(row, col), world.getTile(row + 1, col));
    }

    isContinuousLadderSegment(row, col, world) {
      if (row < 0 || row >= world.rows - 1) return false;
      const t = world.getTile(row, col);
      const b = world.getTile(row + 1, col);
      if (isSameLadderType(t, b)) return true;
      if (t === TILE.BREAK_LADDER && isCrumblingLadderTile(b)) return true;
      if (isCrumblingLadderTile(t) && world.hasCrumblingBelowSame(row, col)) return true;
      return false;
    }

    snapIfContLadderIdle(slot, world) {
      if (this.isContinuousLadder(slot.row, slot.col, world)) {
        this.snapX(slot, world);
      }
    }

    enterKnockdown(slot) {
      slot.state = 10;
      slot.n = 0;
      slot.kind = null;
      slot.prom = 0;
      slot.aux = 0;
      slot.auxRow = 0;
      slot.flag &= ~0x02;
      slot.hammerTimer = 0;
      slot.hammerHitDone = false;
      slot.stunTimer = 0;
    }

    // $C8BB 相当: 落下中ドラム缶 ($0D) による閉じ込め捕獲＆隣セルはみ出し押し戻し
    checkDrumTrap(slot, world) {
      if (slot.state !== 0 && slot.state !== 1 && slot.state !== 2 && slot.state !== 4) {
        return false;
      }
      const curTile = world.getTile(slot.row, slot.col);
      if (curTile === TILE.DRUM_FALLING) {
        if (slot.state === 2) {
          slot.prom = 0x10;
          return false;
        }
        slot.state = 15;
        slot.n = 0;
        slot.kind = null;
        slot.prom = 0;
        slot.aux = 0;
        slot.auxRow = 0;
        slot.hammerTimer = 0;
        slot.hammerHitDone = false;
        slot.stunTimer = 0;
        this.snapX(slot, world);
        this.snapY(slot);
        this.updateCR(slot, world);
        return true;
      }
      if ((slot.x & 0x0f) !== 0) {
        const sideCol = world.wrapCol(slot.col + ((slot.x & 0x0f) < 8 ? 1 : -1));
        if (world.getTile(slot.row, sideCol) === TILE.DRUM_FALLING) {
          this.snapX(slot, world);
          this.updateCR(slot, world);
        }
      }
      return false;
    }

    checkLadderHoldHazard(slot, world, ladderRow) {
      const t = world.getTile(ladderRow, slot.col);
      if (isLadderTile(t)) return false;
      if (isCrumblingLadderTile(t)) {
        const info = world.getCrumblingInfo(ladderRow, slot.col);
        const stage = info ? info.stage : (t & 0x07);
        const sameSide = (info ? info.byMario : true) === slot.isMario;
        if (!sameSide || stage <= 2) {
          this.enterKnockdown(slot);
          return true;
        }
        return false;
      }
      this.enterKnockdown(slot);
      return true;
    }

    checkHazardHit(slot, world) {
      if (slot.state === 10 || slot.state === 11 || slot.state === 15 || slot.state === 16) {
        return false;
      }

      const isHoldingLadder = slot.state === 2 ||
        slot.state === 6 ||
        (slot.state === 3 && slot.kind !== "arrive" && slot.kind !== "arrive_top");
      const checkRow = isHoldingLadder
        ? Math.max(0, Math.min(world.rows - 1, Math.floor(slot.topY / 32)))
        : (slot.state === 5
          ? Math.max(0, Math.min(world.rows - 1, Math.floor((slot.y - 16) / 32)))
          : slot.row);

      if (world.explosions.length > 0) {
        for (let i = 0; i < world.explosions.length; i++) {
          const ex = world.explosions[i];
          if (ex.col !== slot.col || ex.row !== checkRow) continue;
          if (ex.kind === "bomb") {
            if (ex.age >= 21 || ex.byMario !== slot.isMario) {
              this.enterKnockdown(slot);
              return true;
            }
          } else if (ex.kind === "wall") {
            if (ex.age < COLLAPSE_HIT_FRAMES && ex.byMario !== slot.isMario) {
              this.enterKnockdown(slot);
              return true;
            }
          }
        }
      }

      if (!(slot.flag & 2)) {
        const checkTile = world.getTile(checkRow, slot.col);
        if (isDoorOpeningTile(checkTile)) {
          const attackerSide = (checkTile & 0x08) !== 0 ? 1 : 0;
          if (this.getActorSide(slot) !== attackerSide) {
            this.enterKnockdown(slot);
            return true;
          }
        }
      }

      if (world.pillarBreaks.size > 0 && !(slot.flag & 2)) {
        const pInfo = world.getPillarBreakInfo(checkRow, slot.col);
        if (pInfo && pInfo.stage >= 2 && pInfo.byMario !== slot.isMario) {
          this.enterKnockdown(slot);
          return true;
        }
      }

      if (world.crumblingLadders.size > 0 && !(slot.flag & 2)) {
        const onFloorState = slot.state === 0 ||
          slot.state === 1 ||
          slot.state === 4 ||
          slot.state === 8 ||
          slot.state === 9 ||
          (slot.state === 3 && (slot.kind === "arrive" || slot.kind === "arrive_top"));

        if (onFloorState) {
          const t = world.getTile(slot.row, slot.col);
          if (isCrumblingLadderTile(t)) {
            const info = world.getCrumblingInfo(slot.row, slot.col);
            const stage = info ? info.stage : (t & 0x07);
            const sameSide = (info ? info.byMario : true) === slot.isMario;
            if (!sameSide) {
              if (stage >= 2) {
                this.enterKnockdown(slot);
                return true;
              }
            } else if (stage <= 2 && slot.row < world.rows - 1 && info && info.hasBelowSame) {
              const belowTile = world.getTile(slot.row + 1, slot.col);
              const belowInfo = world.getCrumblingInfo(slot.row + 1, slot.col);
              const belowFalling = isHoleTile(belowTile) ||
                (belowInfo ? belowInfo.stage <= 2 : (isCrumblingLadderTile(belowTile) && (belowTile & 0x07) <= 2));
              if (belowFalling) {
                this.enterKnockdown(slot);
                return true;
              }
            }
          }
        }
      }

      return false;
    }

    canPassWall(slot, b, world) {
      if ((slot.x & 0x0f) !== 0) return true;
      const targetCol = world.wrapCol(slot.col + ((b & RIGHT) ? 1 : -1));
      const tile = world.getTile(slot.row, targetCol);
      if (slot.flag & 2) {
        if (isLadderTile(tile)) {
          return slot.row < world.rows - 1 &&
            isSameLadderType(tile, world.getTile(slot.row + 1, targetCol));
        }
        return isHoleTile(tile);
      }
      return !isSolidDrum(tile);
    }

    tryStartHammer(slot, b, world) {
      if ((b & HAMMER) === 0) return false;
      const curTile = world.getTile(slot.row, slot.col);
      if (isLadderTile(curTile) && slot.row < world.rows - 1) {
        const belowTile = world.getTile(slot.row + 1, slot.col);
        if (isSameLadderType(curTile, belowTile)) {
          return false;
        }
      }
      slot.state = 4;
      slot.hammerTimer = 0;
      slot.hammerHitDone = false;
      return true;
    }

    tryEnterHole(slot, world) {
      if (slot.row >= world.rows - 1) return false;
      if (slot.flag & 2) {
        if (isSolidDrum(world.getTile(slot.row + 1, slot.col))) return false;
      } else {
        if (!isFallHoleTile(world.getTile(slot.row, slot.col))) return false;
      }
      if (((slot.x + 3) & 0x0f) >= 6) return false;

      if (slot.isMario) {
        this.snapX(slot, world);
      }
      slot.prom = slot.isMario ? 0 : 0x12;
      slot.topY = slot.y;
      slot.state = 5;
      return true;
    }

    // 横飛び遷移 (State 8 / State 9)
    trySideTransition(slot, b, world) {
      this.updateCR(slot, world);
      const horiz = b & (LEFT | RIGHT);
      if (horiz === 0) return false;

      if (slot.state !== 1) {
        const curTile = world.getTile(slot.row, slot.col);
        if (!isLadderTile(curTile) && !isHoleTile(curTile)) return false;
        if (slot.row >= world.rows - 1) return false;
        const belowTile = world.getTile(slot.row + 1, slot.col);
        if (!isLadderTile(belowTile)) return false;
      }

      const dirStep = (horiz === RIGHT) ? 1 : -1;
      const nextCol = world.wrapCol(slot.col + dirStep);
      const nextTile = world.getTile(slot.row, nextCol);
      let goDirectlyToApply = false;

      if (slot.state !== 1 && isHoleTile(nextTile)) {
        if ((slot.y & 0x1f) >= 0x0b &&
            slot.row < world.rows - 1 &&
            isSolidDrum(world.getTile(slot.row + 1, nextCol))) {
          if (slot.prom < 0x0f) return false;
          slot.y = Math.floor(slot.y / 32) * 32 + 0x0b;
        }
        if (slot.row < world.rows - 1) {
          const nextBelow = world.getTile(slot.row + 1, nextCol);
          if (isLadderTile(nextBelow) && (slot.y & 0x0f) !== 0 && slot.prom < 0x1f) {
            goDirectlyToApply = true;
          }
        }
        if (!goDirectlyToApply) {
          const prevState = slot.state;
          slot.state = 8;
          if (prevState === 2) {
            slot.aux = 0x0c;
          }
          slot.dir = horiz;
          slot.facing = horiz;
          return true;
        }
      }

      if (!goDirectlyToApply) {
        if (!isLadderTile(nextTile)) return false;
        if (slot.row >= world.rows - 1) return false;
        const nextBelow = world.getTile(slot.row + 1, nextCol);
        if (!isSameLadderType(nextTile, nextBelow)) return false;

        const onContCur = this.isContinuousLadder(slot.row, slot.col, world);
        if (!onContCur && slot.state === 1) {
          const xMod = slot.x & 0x0f;
          if (horiz & RIGHT) {
            if (xMod !== 7) return false;
          } else {
            if (xMod !== 9) return false;
          }
        }

        if (slot.state === 1) {
          slot.prom = 0;
          slot.topY = slot.y - 32;
        }
      }

      slot.aux = nextCol;
      slot.auxRow = slot.row;
      if (slot.state === 2 && slot.topY === slot.y) {
        slot.y += 8;
      }
      slot.state = 9;
      slot.dir = horiz;
      slot.facing = horiz;
      return true;
    }

    tryEnterLadder(slot, b, world) {
      const curTile = world.getTile(slot.row, slot.col);
      if (isHoleTile(curTile)) return false;

      const canUp = isLadderTile(curTile);
      const canDown = slot.row < world.rows - 1 && isLadderTile(world.getTile(slot.row + 1, slot.col));
      let avail = (canUp ? 2 : 0) | (canDown ? 1 : 0);
      if (avail !== 0 && ((slot.x + 6) & 0x0f) >= 12) {
        avail = 0;
      }
      slot.avail = avail;

      if (avail === 0) return false;
      if ((b & (UP | DOWN)) === 0) return false;
      const matched = ((b & (UP | DOWN)) >> 2) & avail;
      if (matched === 0) return false;
      if (matched !== 1 && slot.row === 0) return false;

      slot.dir = b & (UP | DOWN);
      this.snapX(slot, world);
      if (matched === 1) {
        slot.topY = slot.y;
        slot.prom = 31;
        slot.state = 3;
        slot.kind = "enter_top";
        slot.n = 1;
      } else {
        slot.topY = slot.y - 32;
        slot.prom = 1;
        slot.state = 3;
        slot.kind = "enter";
        slot.n = 1;
      }

      if (this.isContinuousLadder(slot.row, slot.col, world)) {
        if (slot.dir === UP) {
          slot.state = 2;
          slot.kind = null;
          slot.n = 0;
        } else {
          slot.state = 6;
          slot.kind = "enter_top_cont";
          slot.n = 1;
        }
      }
      return true;
    }

    finishLadderSegment(slot, world, arriveKind) {
      this.updateCR(slot, world);
      if (this.isContinuousLadderSegment(slot.row, slot.col, world)) {
        if (slot.row === 0) {
          slot.state = 0;
          slot.kind = null;
          slot.n = 0;
          slot.avail = 0;
          return;
        }
        if (slot.dir & DOWN) {
          slot.topY = slot.y;
          slot.prom = 31;
        } else {
          slot.topY = slot.y - 32;
          slot.prom = 1;
        }
        slot.state = 6;
        slot.kind = "cont";
        slot.n = 1;
        slot.avail = (slot.row !== 0 ? 1 : 0) | (slot.row < world.rows - 1 ? 2 : 0);
        return;
      }
      if (slot.row < world.rows - 1 && isHoleTile(world.getTile(slot.row, slot.col))) {
        this.enterKnockdown(slot);
        return;
      }
      slot.state = 3;
      slot.kind = arriveKind;
      slot.n = 1;
      slot.avail = 0;
    }

    step(slot, world) {
      this.updateCR(slot, world);

      // State 15 ($0F): 落下中ドラム缶に捕獲され待機 → 着地($08)で State 16 へ
      if (slot.state === 15) {
        if (world.getTile(slot.row, slot.col) === TILE.DRUM) {
          slot.state = 16;
        }
        return;
      }

      // State 16 ($10): ドラム缶閉じ込めジタバタ状態（行動不能）
      if (slot.state === 16) {
        return;
      }

      if (slot.state === 10) {
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
          slot.state = 11;
          slot.stunTimer = 19;
          this.updateCR(slot, world);
          return;
        }

        if (canCheckLanding && slot.y >= maxFloorY) {
          slot.y = maxFloorY;
          slot.topY = maxFloorY;
          slot.flag &= ~0x02;
          slot.prom = 0;
          slot.n = 0;
          slot.state = 11;
          slot.stunTimer = 19;
          this.updateCR(slot, world);
          return;
        }
        slot.topY = slot.y;
        return;
      }

      if (slot.state === 11) {
        slot.stunTimer -= 1;
        if (slot.stunTimer <= 0) {
          slot.stunTimer = 0;
          slot.state = 0;
        }
        return;
      }

      if (this.checkHazardHit(slot, world)) return;
      if (this.checkDrumTrap(slot, world)) return;

      const b = slot.bits;

      if (slot.state === 0) {
        if (this.tryStartHammer(slot, b, world)) return;
        if (this.tryEnterLadder(slot, b, world)) return;
        if (b & (LEFT | RIGHT)) {
          slot.dir = b & (LEFT | RIGHT);
          slot.facing = slot.dir;
          if ((slot.flag & 2) === 0) {
            this.snapY(slot);
          }
          if (!this.canPassWall(slot, b, world)) {
            this.snapIfContLadderIdle(slot, world);
            return;
          }
          slot.prom = 0;
          slot.state = 1;
          return;
        }
        this.snapIfContLadderIdle(slot, world);
      } else if (slot.state === 1) {
        if (this.tryStartHammer(slot, b, world)) return;
        if (this.tryEnterLadder(slot, b, world)) return;
        if (this.tryEnterHole(slot, world)) return;
        if (this.trySideTransition(slot, b, world)) return;
        if (!this.canPassWall(slot, b, world)) {
          slot.state = 0;
          slot.dir = (slot.dir + 1) & 0xff;
          return;
        }
        if ((b & (LEFT | RIGHT)) && (b & (LEFT | RIGHT)) === (slot.dir & (LEFT | RIGHT))) {
          const stepX = (slot.dir & LEFT) ? -1 : 1;
          slot.x = world.wrapX(slot.x + stepX);
        } else {
          slot.state = 0;
          slot.dir = (slot.dir + 1) & 0xff;
        }
      } else if (slot.state === 4) {
        const { totalFrames, hitFrame } = getHammerTiming(slot);
        slot.hammerTimer += 1;
        if (!slot.hammerHitDone && slot.hammerTimer >= hitFrame) {
          slot.hammerHitDone = true;
          world.hitCell(slot.row, slot.col, slot.isMario);
        }
        if (slot.hammerTimer >= totalFrames) {
          slot.state = 0;
          slot.hammerTimer = 0;
          slot.hammerHitDone = false;
        }
      } else if (slot.state === 3) {
        if (slot.kind !== "arrive" && slot.kind !== "arrive_top") {
          const ladderRow = Math.max(0, Math.min(world.rows - 1, Math.floor(slot.topY / 32)));
          if (this.checkLadderHoldHazard(slot, world, ladderRow)) return;
        }
        slot.n += 1;
        let limit = 6;
        if (slot.kind === "arrive_top") {
          limit = 12;
        } else if (slot.kind === "enter_top") {
          limit = slot.isMario ? 12 : 9;
        }
        if (slot.n >= limit) {
          slot.state = (slot.kind === "enter" || slot.kind === "enter_top") ? 2 : 0;
          slot.kind = null;
          slot.n = 0;
        }
      } else if (slot.state === 5) {
        this.snapX(slot, world);
        slot.prom += 1;
        let spd = FALL_TABLE[slot.prom];
        if (spd < 0) {
          slot.prom -= 1;
          spd = FALL_TABLE[slot.prom];
        }
        slot.y = slot.topY + spd;
        slot.topY = slot.y;

        // 最下段の床ガード
        const maxFloorY = world.rows * 32;
        if (slot.y >= maxFloorY) {
          slot.y = maxFloorY;
          slot.topY = maxFloorY;
          slot.flag &= ~0x02;
          slot.state = 0;
          slot.prom = 0;
          return;
        }

        if (((slot.y + 2) & 0x1f) < 4) {
          this.snapY(slot);
          this.updateCR(slot, world);
          const t = world.getTile(slot.row, slot.col);
          const isHole = isFallHoleTile(t) && (slot.row < world.rows - 1);
          const isContLad = this.isContinuousLadderSegment(slot.row, slot.col, world);
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
          return;
        }

        slot.y = slot.topY;
      } else if (slot.state === 6) {
        const ladderRow = Math.max(0, Math.min(world.rows - 1, Math.floor(slot.topY / 32)));
        if (this.checkLadderHoldHazard(slot, world, ladderRow)) return;
        if (b & (LEFT | RIGHT)) {
          slot.dir = b & (LEFT | RIGHT);
          slot.facing = slot.dir;
          if (slot.prom < 10) {
            if ((slot.flag & 2) === 0) {
              this.snapY(slot);
            }
            if (this.canPassWall(slot, b, world)) {
              slot.prom = 0;
              slot.state = 1;
              slot.kind = null;
              slot.n = 0;
              return;
            }
          }
        }
        slot.n += 1;
        const limit = slot.kind === "enter_top_cont" ? 16 : 12;
        if (slot.n >= limit) {
          slot.state = 2;
          slot.kind = null;
          slot.n = 0;
        }
      } else if (slot.state === 8) {
        slot.x = world.wrapX(slot.x + (slot.dir === RIGHT ? 1 : -1));
        slot.aux -= 1;
        if (slot.aux === 0) {
          slot.aux = 1;
          this.tryEnterHole(slot, world);
        }
      } else if (slot.state === 9) {
        slot.x = world.wrapX(slot.x + (slot.dir === RIGHT ? 1 : -1));
        this.updateCR(slot, world);
        if (slot.row === slot.auxRow && slot.col === slot.aux && (slot.x & 0x0f) === 0) {
          if (slot.flag & 2) {
            slot.flag &= ~0x02;
            slot.prom = 0x1d;
            slot.topY = Math.floor(slot.y / 32) * 32;
          }
          slot.state = (slot.prom !== 0) ? 2 : 0;
        }
      } else if (slot.state === 2) {
        slot.flag &= ~0x02;
        const ladderRow = Math.max(0, Math.min(world.rows - 1, Math.floor(slot.topY / 32)));
        if (this.checkLadderHoldHazard(slot, world, ladderRow)) return;
        const curTile = world.getTile(slot.row, slot.col);
        if (this.trySideTransition(slot, b, world)) return;
        if (b & (UP | DOWN)) {
          slot.dir = b & (UP | DOWN);
          const d = (slot.dir & DOWN) ? -1 : 1;
          const nextProm = slot.prom + d;
          if (nextProm === 0x1f && (isSolidDrum(curTile) || isHoleTile(curTile))) {
            return;
          }
          slot.prom = nextProm;
          if (slot.prom >= 32) {
            slot.y = slot.topY;
            slot.prom = 0;
            this.finishLadderSegment(slot, world, "arrive_top");
          } else if (slot.prom <= 0) {
            slot.y = slot.topY + 32;
            slot.prom = 0;
            this.finishLadderSegment(slot, world, "arrive");
          } else {
            slot.y = slot.topY + relYOfProm(slot.prom);
          }
          return;
        }
        if (b & (LEFT | RIGHT)) {
          slot.dir = b & (LEFT | RIGHT);
          slot.facing = slot.dir;
          const canExit = slot.prom < 10 ||
            (slot.prom >= 31 && this.isContinuousLadderSegment(slot.row, slot.col, world));
          if (canExit) {
            if ((slot.flag & 2) === 0) {
              this.snapY(slot);
            }
            if (!this.canPassWall(slot, b, world)) return;
            slot.prom = 0;
            slot.state = 1;
          }
        }
      }
    }
  }

  const api = {
    Actor,
    ActorStepper
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.WreckGame = Object.assign(root.WreckGame || {}, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
