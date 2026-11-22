(function (root) {
  "use strict";

  const G = (typeof module !== "undefined" && module.exports && !root.WreckGame)
    ? Object.assign(
        {},
        require("./constants.js"),
        require("./actor_stepper.js"),
        require("./spike_ai.js"),
        require("./enemy_ai.js")
      )
    : (root.WreckGame || {});

  const {
    RIGHT,
    LEFT,
    DOWN,
    UP,
    HAMMER,
    COLLAPSE_STAGE_FRAMES,
    COLLAPSE_TOTAL_FRAMES,
    TILE,
    isBreakableTile,
    isClearTargetTile,
    isCrumblingLadderTile,
    isDoorRelatedTile,
    isSameLadderType,
    getPillarFallPayload,
    Actor,
    ActorStepper,
    SpikeAI,
    EnemyActor,
    EnemyAI
  } = G;

  class GameWorld {
    constructor(config = {}) {
      this.cols = config.cols || 16;
      this.rows = config.rows || 8;
      this.worldWidth = this.cols * 16;
      this.f = 0;
      this.tiles = new Uint8Array(this.cols * this.rows);
      this.waves = [];
      this.explosions = [];
      this.breakEffects = [];
      this.crumblingLadders = new Map();
      this.pillarBreaks = new Map();
      this.fallingPillars = [];
      this.doors = [];
      this.doorMap = new Map();
      this.spikeAggressive = !!config.spikeAggressive;
      this.marioHitEnemy = false;
      this.allBackStop = false;
      this.allBackTimer = 0;
      this.allBackDone = false;

      const stepper = new ActorStepper();
      this.stepper = stepper;
      this.mario = new Actor(true);
      this.spike = new Actor(false);
      this.spikeAI = new SpikeAI();
      this.enemies = [];
      this.enemyAI = typeof EnemyAI === "function" ? new EnemyAI() : null;

      if (config.tiles) {
        this.loadTiles(config.tiles);
      }
      if (config.mario) {
        Object.assign(this.mario, config.mario);
        if ((this.mario.dir & (LEFT | RIGHT)) !== 0) {
          this.mario.facing = this.mario.dir & (LEFT | RIGHT);
        }
      }
      if (config.spike) {
        Object.assign(this.spike, config.spike);
        if ((this.spike.dir & (LEFT | RIGHT)) !== 0) {
          this.spike.facing = this.spike.dir & (LEFT | RIGHT);
        }
      }
      if (config.spikeAI) {
        Object.assign(this.spikeAI, config.spikeAI);
      }

      this.stepper.updateCR(this.mario, this);
      this.stepper.updateCR(this.spike, this);
      if (Array.isArray(config.enemies) && typeof EnemyActor === "function") {
        for (let i = 0; i < config.enemies.length; i++) {
          const e = new EnemyActor(config.enemies[i]);
          if (this.enemyAI) this.enemyAI.updateCR(e, this);
          this.enemies.push(e);
        }
      }
    }

    wrapX(x) {
      const w = this.worldWidth;
      return ((x % w) + w) % w;
    }

    wrapCol(col) {
      const c = this.cols;
      return ((col % c) + c) % c;
    }

    cellKey(row, col) {
      return row + "," + this.wrapCol(col);
    }

    getCrumblingInfo(row, col) {
      return this.crumblingLadders.get(this.cellKey(row, col)) || null;
    }

    hasCrumblingBelowSame(row, col) {
      const info = this.getCrumblingInfo(row, col);
      return info ? info.hasBelowSame : false;
    }

    getPillarBreakInfo(row, col) {
      return this.pillarBreaks.get(this.cellKey(row, col)) || null;
    }

    ensureDoorSlot(row, col) {
      const wc = this.wrapCol(col);
      const key = this.cellKey(row, wc);
      let door = this.doorMap.get(key);
      if (!door) {
        door = {
          row,
          col: wc,
          state: 1,
          stepTimer: 0,
          openTimer: 0,
          byMario: true
        };
        this.doors.push(door);
        this.doorMap.set(key, door);
      }
      return door;
    }

    removeDoorSlot(row, col) {
      const wc = this.wrapCol(col);
      const key = this.cellKey(row, wc);
      const door = this.doorMap.get(key);
      if (!door) return;
      this.doorMap.delete(key);
      const idx = this.doors.indexOf(door);
      if (idx >= 0) {
        this.doors.splice(idx, 1);
      }
    }

    loadTiles(src) {
      if (Array.isArray(src)) {
        for (const item of src) {
          this.setTile(item[0], item[1], item[2]);
        }
      } else {
        for (const [k, v] of Object.entries(src)) {
          if (k.includes(",")) {
            const [r, c] = k.split(",").map(Number);
            this.setTile(r, c, v);
          } else {
            const addr = Number(k);
            const pos = addr >= 0x500 ? addr - 0x500 : addr;
            const r = (pos >> 4) & 0x0f;
            const c = pos & 0x0f;
            this.setTile(r, c, v);
          }
        }
      }
    }

    setTile(row, col, val) {
      if (row < 0 || row >= this.rows) return;
      const wc = this.wrapCol(col);
      this.tiles[row * this.cols + wc] = val;
      if (val === TILE.DOOR) {
        this.ensureDoorSlot(row, wc);
      } else if (!isDoorRelatedTile(val)) {
        this.removeDoorSlot(row, wc);
      }
    }

    getTile(row, col) {
      if (row < 0 || row >= this.rows) return TILE.EMPTY;
      const wc = this.wrapCol(col);
      return this.tiles[row * this.cols + wc];
    }

    countBreakables() {
      let count = 0;
      for (let i = 0; i < this.tiles.length; i++) {
        if (isClearTargetTile(this.tiles[i])) {
          count += 1;
        }
      }
      for (let i = 0; i < this.fallingPillars.length; i++) {
        if (isClearTargetTile(this.fallingPillars[i].payloadTile)) {
          count += 1;
        }
      }
      return count;
    }

    openDoor(row, col, byMario = true, openDuration = 0x50) {
      if (row < 0 || row >= this.rows) return false;
      const c = this.wrapCol(col);
      const door = this.ensureDoorSlot(row, c);
      door.state = 2;
      door.stepTimer = 4;
      door.openTimer = openDuration;
      door.byMario = !!byMario;
      this.setTile(row, c, byMario ? TILE.DOOR_OPENING_1 : (TILE.DOOR_OPENING_1 | 0x08));
      return true;
    }

    openAllDoors(byMario = true, openDuration = 0x20) {
      for (let i = 0; i < this.doors.length; i++) {
        const door = this.doors[i];
        if (door.state === 0) continue;
        door.state = 2;
        door.stepTimer = 4;
        door.openTimer = openDuration;
        door.byMario = !!byMario;
        this.setTile(door.row, door.col, byMario ? TILE.DOOR_OPENING_1 : (TILE.DOOR_OPENING_1 | 0x08));
      }
    }

    holdDoorsOpen() {
      for (let i = 0; i < this.doors.length; i++) {
        if (this.doors[i].state !== 0) {
          this.doors[i].openTimer = 0x40;
        }
      }
    }

    updateDoors() {
      if (this.doors.length === 0) return;
      for (let i = 0; i < this.doors.length; i++) {
        const door = this.doors[i];
        if (door.state <= 1) continue;
        if (door.stepTimer > 0) {
          door.stepTimer -= 1;
          continue;
        }
        door.stepTimer = 4;
        if (door.state === 2) {
          const bit3 = this.getTile(door.row, door.col) & 0x08;
          this.setTile(door.row, door.col, TILE.DOOR_OPENING_2 | bit3);
          door.state = 3;
        } else if (door.state === 3) {
          this.setTile(door.row, door.col, TILE.DOOR_OPEN);
          door.state = 4;
        } else if (door.state === 4) {
          door.openTimer -= 1;
          if (door.openTimer <= 0) {
            this.setTile(door.row, door.col, TILE.DOOR_CLOSING_1);
            door.state = 5;
          }
        } else if (door.state === 5) {
          this.setTile(door.row, door.col, TILE.DOOR_CLOSING_2);
          door.state = 6;
        } else if (door.state === 6) {
          this.setTile(door.row, door.col, TILE.DOOR);
          door.state = 1;
          door.stepTimer = 0;
        }
      }
    }

    startCrumblingLadder(row, col, byMario, spreadUp = true, spreadDown = true) {
      if (row < 0 || row >= this.rows) return false;
      const c = this.wrapCol(col);
      if (this.getTile(row, c) !== TILE.BREAK_LADDER) return false;

      const belowTile = row < this.rows - 1 ? this.getTile(row + 1, c) : TILE.EMPTY;
      const hasBelowSame = row < this.rows - 1 &&
        (belowTile === TILE.BREAK_LADDER || isCrumblingLadderTile(belowTile));

      this.setTile(row, c, TILE.CRUMBLING_4);
      this.crumblingLadders.set(this.cellKey(row, c), {
        row,
        col: c,
        stage: 4,
        timer: COLLAPSE_STAGE_FRAMES,
        spreadTimer: COLLAPSE_STAGE_FRAMES,
        spreadUp,
        spreadDown,
        hasBelowSame,
        byMario: !!byMario
      });
      return true;
    }

    updateCrumblingLadders() {
      if (this.crumblingLadders.size === 0) return;
      const entries = Array.from(this.crumblingLadders.values());
      const toSpread = [];

      for (const e of entries) {
        if (e.spreadUp || e.spreadDown) {
          e.spreadTimer -= 1;
          if (e.spreadTimer <= 0) {
            if (e.spreadUp && e.row > 0 && this.getTile(e.row - 1, e.col) === TILE.BREAK_LADDER) {
              toSpread.push({ row: e.row - 1, col: e.col, byMario: e.byMario, up: true, down: false });
            }
            if (e.spreadDown && e.row < this.rows - 1 && this.getTile(e.row + 1, e.col) === TILE.BREAK_LADDER) {
              toSpread.push({ row: e.row + 1, col: e.col, byMario: e.byMario, up: false, down: true });
            }
            e.spreadUp = false;
            e.spreadDown = false;
          }
        }

        e.timer -= 1;
        if (e.timer <= 0) {
          e.stage -= 1;
          e.timer = COLLAPSE_STAGE_FRAMES;
          if (e.stage <= 0) {
            this.crumblingLadders.delete(this.cellKey(e.row, e.col));
            this.setTile(e.row, e.col, e.hasBelowSame ? TILE.HOLE_CRUMBLED : TILE.EMPTY);
            this.breakEffects.push({ row: e.row, col: e.col, tile: TILE.BREAK_LADDER, timer: 16, maxTimer: 16 });
          } else {
            this.setTile(e.row, e.col, 0x50 + e.stage);
          }
        }
      }

      for (const s of toSpread) {
        this.startCrumblingLadder(s.row, s.col, s.byMario, s.up, s.down);
      }
    }

    triggerPillar(row, col, byMario) {
      if (row < 0 || row >= this.rows) return false;
      const c = this.wrapCol(col);

      // 支柱自身の崩壊開始 ($75 -> $74 -> $73 -> $72 -> $71 -> $00, 1+8*4=33F)
      this.setTile(row, c, 0x75);
      this.pillarBreaks.set(this.cellKey(row, c), {
        row,
        col: c,
        stage: 5,
        timer: 1,
        byMario: !!byMario
      });

      if (row >= 1 && this.fallingPillars.length < 12) {
        const aboveRow = row - 1;
        const aboveTile = this.getTile(aboveRow, c);
        const payload = getPillarFallPayload(aboveTile);
        if (payload !== null) {
          this.crumblingLadders.delete(this.cellKey(aboveRow, c));
          const isContLadder = (aboveTile === TILE.LADDER || aboveTile === TILE.BREAK_LADDER) &&
            aboveRow >= 1 &&
            isSameLadderType(aboveTile, this.getTile(aboveRow - 1, c));

          // 0F目から1行上は即座に $0C (穴落下判定) になり、オブジェクトは 30F 滞空する
          this.setTile(aboveRow, c, TILE.HOLE_FALLING);
          this.fallingPillars.push({
            row: aboveRow,
            targetRow: row,
            col: c,
            payloadTile: payload,
            origAboveTile: aboveTile,
            isDrum: aboveTile === TILE.DRUM,
            isFloorOnly: payload === TILE.EMPTY,
            aboveDoneHole: isContLadder ? TILE.HOLE_PILLAR_LAD : TILE.HOLE,
            stage: 1,
            timer: 30
          });
        }
      }
      return true;
    }

    updatePillarBreakTiles() {
      if (this.pillarBreaks.size === 0) return;
      const entries = Array.from(this.pillarBreaks.values());
      for (const e of entries) {
        e.timer -= 1;
        if (e.timer <= 0) {
          e.stage -= 1;
          if (e.stage <= 0) {
            this.pillarBreaks.delete(this.cellKey(e.row, e.col));
            this.setTile(e.row, e.col, TILE.EMPTY);
            this.breakEffects.push({ row: e.row, col: e.col, tile: TILE.PILLAR, timer: 14, maxTimer: 14 });
          } else {
            e.timer = COLLAPSE_STAGE_FRAMES;
            this.setTile(e.row, e.col, 0x70 + e.stage);
          }
        }
      }
    }

    updateFallingPillars() {
      if (this.fallingPillars.length === 0) return;
      for (let i = this.fallingPillars.length - 1; i >= 0; i--) {
        const fp = this.fallingPillars[i];
        fp.timer -= 1;
        if (fp.timer > 0) continue;

        fp.timer = 4;
        if (fp.stage === 1 && fp.isDrum) {
          // 30F目: ドラム缶落下中は下の鉄柱マスを $0D へ (閉じ込め捕獲開始)
          this.pillarBreaks.delete(this.cellKey(fp.targetRow, fp.col));
          this.setTile(fp.targetRow, fp.col, TILE.DRUM_FALLING);
        }

        fp.stage += 1;
        if (fp.stage >= 5) {
          // 42F目 (30 + 4*3): 着地完了
          this.fallingPillars.splice(i, 1);
          this.pillarBreaks.delete(this.cellKey(fp.targetRow, fp.col));
          this.setTile(fp.targetRow, fp.col, fp.payloadTile);
          this.setTile(fp.row, fp.col, fp.aboveDoneHole);
        }
      }
    }

    hitCell(row, col, byMario) {
      const c = this.wrapCol(col);
      if (row < 0 || row >= this.rows) return false;
      const tile = this.getTile(row, c);
      if (!isBreakableTile(tile)) return false;

      if (tile === TILE.BOMB) {
        this.triggerBomb(row, c, byMario);
        return true;
      }

      if (tile === TILE.BREAK_LADDER) {
        return this.startCrumblingLadder(row, c, byMario, true, true);
      }

      if (tile === TILE.DOOR) {
        return this.openDoor(row, c, byMario, 0x50);
      }

      if (tile === TILE.PILLAR) {
        return this.triggerPillar(row, c, byMario);
      }

      const hp = tile & 0x07;
      if (hp > 1) {
        this.setTile(row, c, tile - 1);
      } else {
        this.setTile(row, c, TILE.EMPTY);
        this.breakEffects.push({ row, col: c, tile, timer: 16, maxTimer: 16 });
        this.explosions.push({
          row,
          col: c,
          timer: COLLAPSE_TOTAL_FRAMES,
          maxTimer: COLLAPSE_TOTAL_FRAMES,
          age: 0,
          kind: "wall",
          byMario: !!byMario
        });
      }
      return true;
    }

    triggerBomb(row, col, byMario = true) {
      const c = this.wrapCol(col);
      this.setTile(row, c, TILE.EMPTY);
      this.openAllDoors(byMario, 0x20);
      this.explosions.push({
        row,
        col: c,
        timer: 26,
        maxTimer: 26,
        age: 0,
        kind: "bomb",
        byMario: !!byMario
      });
      this.waves.push({ row, col: this.wrapCol(c - 1), dir: -1, timer: 10, stepsLeft: this.cols - 1, byMario: !!byMario });
      this.waves.push({ row, col: this.wrapCol(c + 1), dir: 1, timer: 10, stepsLeft: this.cols - 1, byMario: !!byMario });
    }

    updateEffectsAndWaves() {
      this.updateDoors();
      this.updateCrumblingLadders();
      this.updatePillarBreakTiles();
      this.updateFallingPillars();

      for (let i = this.explosions.length - 1; i >= 0; i--) {
        const ex = this.explosions[i];
        ex.age = (ex.age || 0) + 1;
        ex.timer -= 1;
        if (ex.timer <= 0) {
          this.explosions.splice(i, 1);
        }
      }
      for (let i = this.breakEffects.length - 1; i >= 0; i--) {
        this.breakEffects[i].timer -= 1;
        if (this.breakEffects[i].timer <= 0) {
          this.breakEffects.splice(i, 1);
        }
      }

      if (this.waves.length === 0) return;
      const prevWaves = this.waves;
      this.waves = [];
      const nextWaves = [];

      for (const w of prevWaves) {
        w.timer -= 1;
        if (w.timer > 0) {
          nextWaves.push(w);
          continue;
        }

        const t = this.getTile(w.row, w.col);
        if (isDoorRelatedTile(t)) {
          if (w.stepsLeft > 1) {
            nextWaves.push({
              row: w.row,
              col: this.wrapCol(w.col + w.dir),
              dir: w.dir,
              timer: 10,
              stepsLeft: w.stepsLeft - 1,
              byMario: true
            });
          }
          continue;
        }
        if (!isBreakableTile(t)) continue;

        this.hitCell(w.row, w.col, true);

        if (t !== TILE.BOMB) {
          const afterTile = this.getTile(w.row, w.col);
          if (t === TILE.BREAK_LADDER || afterTile !== TILE.EMPTY) {
            this.explosions.push({ row: w.row, col: w.col, timer: 10, maxTimer: 10, age: 0, kind: "spark", byMario: true });
          }
        }
        if (w.stepsLeft > 1) {
          nextWaves.push({
            row: w.row,
            col: this.wrapCol(w.col + w.dir),
            dir: w.dir,
            timer: 10,
            stepsLeft: w.stepsLeft - 1,
            byMario: true
          });
        }
      }
      this.waves = nextWaves.concat(this.waves);
    }

    updateSpikeHammer() {
      const sp = this.spike;
      const ma = this.mario;
      sp.bits &= ~HAMMER;
      if (sp.state === 4 || sp.state === 10 || sp.state === 11 || sp.state === 15 || sp.state === 16) {
        return;
      }

      const tile = this.getTile(sp.row, sp.col);
      if (tile === TILE.BOMB || !isBreakableTile(tile)) return;

      const sameCell = sp.row === ma.row && sp.col === ma.col;
      if (tile === TILE.DOOR || sameCell || this.spikeAggressive) {
        sp.bits |= HAMMER;
      }
    }

    // ROM $D4A1 + $D58A 準拠: マリオと有効な表側ザコ敵の接触判定
    isMarioEnemyHit(mario, enemy) {
      if (this.allBackStop) return false;
      if (mario.flag & 0x08) return false;
      if (mario.state === 7 || mario.state === 10 || mario.state === 11 ||
          mario.state === 15 || mario.state === 16) {
        return false;
      }
      if (enemy.isBack) return false;
      if (enemy.state === 4 || enemy.state === 10 || enemy.state === 13 ||
          enemy.state === 15 || enemy.state === 16) {
        return false;
      }

      let dx = mario.x - enemy.x;
      const halfW = this.worldWidth / 2;
      if (dx >= halfW) dx -= this.worldWidth;
      if (dx < -halfW) dx += this.worldWidth;
      const absDx = dx >= 0 ? dx : (-dx - 1);
      if (absDx >= 6) return false;

      const dy = mario.y - enemy.y;
      const absDy = dy >= 0 ? dy : (-dy - 1);
      if (absDy >= 8) return false;

      return true;
    }

    updateMarioEnemyHit() {
      this.marioHitEnemy = false;
      if (!this.enemies || this.enemies.length === 0) return;
      for (let i = 0; i < this.enemies.length; i++) {
        if (this.isMarioEnemyHit(this.mario, this.enemies[i])) {
          this.marioHitEnemy = true;
          break;
        }
      }
    }

    // ROM $D50B〜$D57E + $D58A 準拠: 同陣営ザコ敵同士（表同士・裏同士）の接触判定
    updateEnemyCollisions() {
      if (!this.enemies || this.enemies.length < 2) return;
      const halfW = this.worldWidth / 2;
      for (let i = 0; i < this.enemies.length; i++) {
        const a = this.enemies[i];
        if (a.state === 2 || a.state === 4 || a.state === 10 ||
            a.state === 13 || a.state === 15 || a.state === 16) {
          continue;
        }
        for (let j = i + 1; j < this.enemies.length; j++) {
          const b = this.enemies[j];
          if (!!a.isBack !== !!b.isBack) continue;
          if (b.state === 2 || b.state === 4 || b.state === 10 ||
              b.state === 13 || b.state === 15 || b.state === 16) {
            continue;
          }

          let dx = a.x - b.x;
          if (dx >= halfW) dx -= this.worldWidth;
          if (dx < -halfW) dx += this.worldWidth;
          const absDx = dx >= 0 ? dx : (-dx - 1);
          if (absDx >= 8) continue;

          const dy = a.y - b.y;
          const absDy = dy >= 0 ? dy : (-dy - 1);
          if (absDy >= 8) continue;

          a.bumpTrigger = true;
          b.bumpTrigger = true;
        }
      }
    }

    // ROM $DBCB 〜 $DC2A 準拠: 敵全員が裏側かつドア出入り中でない時、512F停止演出
    updateAllBackStop() {
      if (this.allBackStop) {
        this.holdDoorsOpen();
        if ((this.f & 0x03) === 0) {
          this.allBackTimer -= 1;
          if (this.allBackTimer <= 0) {
            this.allBackStop = false;
            this.allBackTimer = 0;
            this.allBackDone = true;
          }
        }
        return;
      }

      if (!this.enemies || this.enemies.length < 2) {
        this.allBackStop = false;
        this.allBackTimer = 0;
        this.allBackDone = false;
        return;
      }

      let allInBackAndNotDoor = true;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (!e.isBack || e.state === 3) {
          allInBackAndNotDoor = false;
          break;
        }
      }

      if (!allInBackAndNotDoor) {
        this.allBackStop = false;
        this.allBackTimer = 0;
        this.allBackDone = false;
        return;
      }

      if (this.allBackDone) {
        return;
      }

      this.allBackStop = true;
      this.allBackTimer = 0x80;
      this.openAllDoors(true, 0x20);
    }

    step(inputBits = 0) {
      let b = inputBits;
      if ((b & (LEFT | RIGHT)) === (LEFT | RIGHT)) {
        b &= ~(LEFT | RIGHT);
      }
      if ((b & (UP | DOWN)) === (UP | DOWN)) {
        b &= ~(UP | DOWN);
      }

      const hammerNow = (b & HAMMER) !== 0;
      const hammerEdge = hammerNow && !this.mario.prevHammer;
      this.mario.prevHammer = hammerNow;
      this.mario.bits = (b & ~HAMMER) | (hammerEdge ? HAMMER : 0);

      this.updateAllBackStop();
      this.stepper.step(this.mario, this);

      if (!this.allBackStop) {
        this.updateEnemyCollisions();
        if (this.f % 2 === 1) {
          this.spikeAI.update(this);
        }
        this.updateSpikeHammer();
        this.stepper.step(this.spike, this);
        if (this.enemyAI && this.enemies.length > 0) {
          this.enemyAI.updateAll(this);
        }
      }

      this.updateEffectsAndWaves();
      this.updateMarioEnemyHit();
      this.f += 1;
    }
  }

  const api = {
    GameWorld
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.WreckGame = Object.assign(root.WreckGame || {}, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
