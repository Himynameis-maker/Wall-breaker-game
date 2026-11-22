(function (root) {
  "use strict";

  const G = root.WreckGame || {};
  const DOWN = G.DOWN || 4;
  const TILE = G.TILE || {
    SAND_LADDER: 0x02
  };
  const isSameLadderType = G.isSameLadderType || ((a, b) =>
    (a === 0x01 && b === 0x01) ||
    (a === 0xd1 && b === 0xd1) ||
    (a === 0x02 && b === 0x02));
  const getHammerTiming = G.getHammerTiming || (slot => {
    if (slot.isMario) {
      return slot.isGolden
        ? { totalFrames: 7, hitFrame: 5, recoverStart: 7 }
        : { totalFrames: 21, hitFrame: 17, recoverStart: 21 };
    }
    return { totalFrames: 27, hitFrame: 14, recoverStart: 23 };
  });

  const S = root.WreckSprites || {};
  const R = root.WreckRender;
  if (!R || !R.Renderer) return;

  const makeSpriteSet = R.makeSpriteSet;

  Object.assign(R.Renderer.prototype, {
    initActorSprites() {
      if (typeof this.initPlayerSprites === "function") {
        this.initPlayerSprites();
      }
      if (S.PALETTE_WORKER && S.PLAYER_IDLE && typeof makeSpriteSet === "function") {
        this.marioSprites = makeSpriteSet(
          {
            idle: S.PLAYER_IDLE,
            walk1: S.PLAYER_WALK1,
            walk2: S.PLAYER_WALK2,
            climb1: S.PLAYER_CLIMB1,
            climb2: S.PLAYER_CLIMB2
          },
          S.PALETTE_WORKER
        );
      }
      if (S.PALETTE_SPIKE && S.SPIKE_IDLE && typeof makeSpriteSet === "function") {
        this.spikeSprites = makeSpriteSet(
          {
            idle: S.SPIKE_IDLE,
            walk1: S.SPIKE_WALK1,
            walk2: S.SPIKE_WALK2,
            climb1: S.SPIKE_CLIMB1,
            climb2: S.SPIKE_CLIMB2
          },
          S.PALETTE_SPIKE
        );
      }
    },

    pickFrame(slot, world) {
      const faceVal = slot.facing || slot.dir;
      const facing = (faceVal & 2) ? "L" : "R";

      if (slot.state === 15 || slot.state === 16) {
        return "idle_" + facing;
      }
      if (slot.state === 10) {
        const idx = ((world ? world.f >> 2 : 0) & 1) ? "walk1" : "walk2";
        return idx + "_" + facing;
      }
      if (slot.state === 11) {
        return "idle_" + facing;
      }
      if (slot.state === 4) {
        return "idle_" + facing;
      }
      if (slot.state === 0 && world && slot.row < world.rows - 1) {
        const curT = world.getTile(slot.row, slot.col);
        if ((!slot.isMario || curT !== TILE.SAND_LADDER) &&
            isSameLadderType(curT, world.getTile(slot.row + 1, slot.col))) {
          return "climb1_" + facing;
        }
      }
      if (slot.state === 2) {
        const idx = ((slot.prom >> 3) & 1) ? "climb2" : "climb1";
        return idx + "_" + facing;
      }
      if (slot.state === 3) {
        if (slot.kind === "arrive" || slot.kind === "arrive_top") {
          return "idle_" + facing;
        }
        return "climb1_" + facing;
      }
      if (slot.state === 6) {
        const idx = ((slot.n >> 2) & 1) ? "climb2" : "climb1";
        return idx + "_" + facing;
      }
      if (slot.state === 5) {
        return "walk1_" + facing;
      }
      if (slot.state === 8 || slot.state === 9) {
        return "walk2_" + facing;
      }
      if (slot.state === 1) {
        const cycle = ["walk1", "idle", "walk2", "idle"];
        const idx = cycle[(slot.x >> 2) & 3];
        return idx + "_" + facing;
      }
      return "idle_" + facing;
    },

    drawHammerOverlay(slot, baseX, baseY) {
      const ctx = this.ctx;
      const faceVal = slot.facing || slot.dir;
      const isLeft = (faceVal & 2) !== 0;
      const timing = getHammerTiming(slot);
      const total = timing.totalFrames;
      const hitF = timing.hitFrame;
      const recoverStart = timing.recoverStart != null ? timing.recoverStart : total;
      const t = slot.hammerTimer;

      // 0: 後ろ振りかぶり, 1: 頭上構え, 2: 前へ振り下ろし, 3: 振り終わり戻り硬直（親方終盤）
      let phase = 0;
      if (t >= recoverStart) {
        phase = 3;
      } else if (t >= hitF) {
        phase = 2;
      } else if (t >= Math.floor(hitF * 0.55)) {
        phase = 1;
      }

      const headColor = slot.isGolden ? "#ffe848" : (slot.isMario ? "#58687c" : "#3c4252");
      const gripColor = "#c8843c";

      if (phase === 0) {
        const hx = isLeft ? baseX + 12 : baseX - 5;
        const hy = baseY + 1;
        ctx.fillStyle = gripColor;
        ctx.fillRect(isLeft ? baseX + 10 : baseX + 4, baseY + 6, 2, 7);
        ctx.fillStyle = headColor;
        ctx.fillRect(hx, hy, 9, 6);
        ctx.fillStyle = "#b0c0d4";
        ctx.fillRect(hx + 1, hy + 1, 7, 1);
      } else if (phase === 1) {
        const hx = isLeft ? baseX + 2 : baseX + 5;
        const hy = baseY - 7;
        ctx.fillStyle = gripColor;
        ctx.fillRect(isLeft ? baseX + 6 : baseX + 8, baseY - 1, 2, 10);
        ctx.fillStyle = headColor;
        ctx.fillRect(hx, hy, 9, 6);
        ctx.fillStyle = "#b0c0d4";
        ctx.fillRect(hx + 1, hy + 1, 7, 1);
      } else if (phase === 2) {
        const hx = isLeft ? baseX - 7 : baseX + 14;
        const hy = baseY + 11;
        ctx.fillStyle = gripColor;
        ctx.fillRect(isLeft ? baseX - 1 : baseX + 9, baseY + 13, 8, 2);
        ctx.fillStyle = headColor;
        ctx.fillRect(hx, hy, 9, 7);
        ctx.fillStyle = "#b0c0d4";
        ctx.fillRect(hx + 1, hy + 5, 7, 1);

        if (t <= hitF + 4 && t < total) {
          ctx.fillStyle = "#fff480";
          const sx = isLeft ? baseX - 9 : baseX + 24;
          ctx.fillRect(sx, baseY + 9, 2, 2);
          ctx.fillRect(sx, baseY + 17, 2, 2);
        }
      } else {
        const hx = isLeft ? baseX - 2 : baseX + 10;
        const hy = baseY + 14;
        ctx.fillStyle = gripColor;
        ctx.fillRect(isLeft ? baseX + 4 : baseX + 10, baseY + 11, 2, 5);
        ctx.fillStyle = headColor;
        ctx.fillRect(hx, hy, 8, 5);
        ctx.fillStyle = "#b0c0d4";
        ctx.fillRect(hx + 1, hy + 1, 6, 1);
      }
    },

    drawActorAt(slot, sprites, baseX, drawY, world) {
      const img = sprites[this.pickFrame(slot, world)];
      if (!img) return;
      const ctx = this.ctx;

      if (slot.state === 15 || slot.state === 16) {
        // ドラム缶閉じ込め状態: 天板から頭・手だけ覗かせてジタバタ点滅
        const f = world ? world.f : 0;
        const phase = (f >> 2) & 1;
        const bobY = slot.state === 15 ? 4 : (phase ? -3 : -2);
        ctx.drawImage(img, 0, 0, 16, 9, baseX, drawY + bobY, 16, 9);
        const handColor = slot.isMario ? "#f4be8c" : "#e6e6e6";
        ctx.fillStyle = handColor;
        ctx.fillRect(baseX + 1, drawY + bobY + (phase ? 5 : 7), 2, 2);
        ctx.fillRect(baseX + 13, drawY + bobY + (phase ? 7 : 5), 2, 2);
        if (slot.state === 16) {
          ctx.fillStyle = phase ? "#ffec48" : "#ffffff";
          ctx.fillRect(baseX + 7, drawY - 6, 2, 2);
        }
        return;
      }

      if (slot.state === 10) {
        ctx.save();
        ctx.translate(baseX, drawY + 26);
        ctx.scale(1, -1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
        return;
      }

      if (slot.state === 11) {
        const shakeX = ((world ? world.f >> 1 : 0) & 1) ? 1 : -1;
        ctx.drawImage(img, baseX + shakeX, drawY + 2);
        const f = world ? world.f : 0;
        const sx1 = baseX + 7 + Math.round(Math.cos(f * 0.35) * 5);
        const sx2 = baseX + 7 + Math.round(Math.cos(f * 0.35 + Math.PI) * 5);
        ctx.fillStyle = "#ffec48";
        ctx.fillRect(sx1, drawY - 3, 2, 2);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(sx2, drawY - 1, 2, 2);
        return;
      }

      ctx.drawImage(img, baseX, drawY);
      if (slot.state === 4) {
        this.drawHammerOverlay(slot, baseX, drawY);
      }
    },

    getLadderVisualOffsetY(slot) {
      if (slot.state === 3) {
        if (slot.kind === "enter_top") {
          const limit = slot.isMario ? 12 : 9;
          return Math.min(10, Math.max(2, Math.round((slot.n / limit) * 10)));
        }
        if (slot.kind === "arrive_top") {
          const remain = Math.max(0, 12 - slot.n);
          return Math.min(10, Math.round((remain / 12) * 10));
        }
        return 0;
      }
      if (slot.state === 6) {
        if (slot.kind === "enter_top_cont") {
          return Math.min(10, Math.max(2, Math.round((slot.n / 16) * 10)));
        }
        if (slot.kind === "cont" && (slot.dir & DOWN)) {
          return Math.min(10, Math.max(2, Math.round((slot.n / 12) * 10)));
        }
        return 0;
      }
      if (slot.state === 2 && slot.prom === 31 && slot.y === slot.topY) {
        return 10;
      }
      return 0;
    },

    drawActor(slot, sprites, worldWidth, world) {
      if (slot.isMario && typeof this.drawPlayer === "function") {
        this.drawPlayer(slot, worldWidth, world);
        return;
      }
      const drawY = slot.y - 26 + this.getLadderVisualOffsetY(slot);
      this.drawActorAt(slot, sprites, slot.x, drawY, world);
      if (slot.x > worldWidth - 16) {
        this.drawActorAt(slot, sprites, slot.x - worldWidth, drawY, world);
      }
      if (slot.x < 16) {
        this.drawActorAt(slot, sprites, slot.x + worldWidth, drawY, world);
      }
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
