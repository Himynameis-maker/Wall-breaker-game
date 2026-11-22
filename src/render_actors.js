(function (root) {
  "use strict";

  const G = root.WreckGame || {};
  const R = root.WreckRender || {};
  if (!R.Renderer || !R.Renderer.prototype) return;

  const DOWN = G.DOWN || 4;
  const TILE = G.TILE || {
    EMPTY: 0x00,
    LADDER: 0x01,
    SAND_LADDER: 0x02,
    BREAK_LADDER: 0xd1
  };
  const isSameLadderType = G.isSameLadderType || ((a, b) =>
    (a === TILE.LADDER && b === TILE.LADDER) ||
    (a === TILE.BREAK_LADDER && b === TILE.BREAK_LADDER) ||
    (a === TILE.SAND_LADDER && b === TILE.SAND_LADDER));
  const getHammerTiming = G.getHammerTiming || (slot => {
    if (slot.isMario) {
      return slot.isGolden
        ? { totalFrames: 7, hitFrame: 5, recoverStart: 7 }
        : { totalFrames: 21, hitFrame: 17, recoverStart: 21 };
    }
    return { totalFrames: 27, hitFrame: 14, recoverStart: 23 };
  });

  Object.assign(R.Renderer.prototype, {
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
      const drawY = slot.y - 26 + this.getLadderVisualOffsetY(slot);
      this.drawActorAt(slot, sprites, slot.x, drawY, world);
      if (slot.x > worldWidth - 16) {
        this.drawActorAt(slot, sprites, slot.x - worldWidth, drawY, world);
      }
      if (slot.x < 16) {
        this.drawActorAt(slot, sprites, slot.x + worldWidth, drawY, world);
      }
    },

    drawEggplantAt(enemy, baseX, drawY, world) {
      const ctx = this.ctx;
      const isBack = !!enemy.isBack;
      const col = isBack
        ? {
            outline: "#121828",
            body: "#25324e",
            highlight: "#3a4d75",
            calyx: "#264050",
            calyxLight: "#38586c",
            mask: "#465878",
            maskShade: "#32405a",
            eye: "#687898",
            eyeHole: "#1c2438",
            limb: "#2e3c5a"
          }
        : {
            outline: "#1e0a32",
            body: "#6c249c",
            highlight: "#a64ce0",
            calyx: "#2ca03e",
            calyxLight: "#6ce468",
            mask: "#f0f2ff",
            maskShade: "#b8c2dc",
            eye: "#e82838",
            eyeHole: "#180828",
            limb: "#f0b840"
          };

      if (enemy.state === 15 || enemy.state === 16) {
        const f = world ? world.f : 0;
        const phase = (f >> 2) & 1;
        const lidY = drawY - 4;
        const headY = enemy.state === 15 ? (lidY + 4) : (lidY + (phase ? -3 : -1));

        ctx.save();
        if (isBack) ctx.globalAlpha = 0.85;
        ctx.fillStyle = col.calyx;
        ctx.fillRect(baseX + 7, headY - 1, 2, 2);
        ctx.fillRect(baseX + 4, headY + 1, 8, 2);
        ctx.fillStyle = col.calyxLight;
        ctx.fillRect(baseX + 5, headY + 1, 4, 1);

        ctx.fillStyle = col.outline;
        ctx.fillRect(baseX + 3, headY + 2, 10, 6);
        ctx.fillStyle = col.body;
        ctx.fillRect(baseX + 4, headY + 3, 8, 5);
        ctx.fillStyle = col.mask;
        ctx.fillRect(baseX + 4, headY + 3, 8, 4);

        if (enemy.state === 16) {
          ctx.fillStyle = col.eyeHole;
          ctx.fillRect(baseX + 5, headY + 4, 2, 2);
          ctx.fillRect(baseX + 9, headY + 4, 2, 2);
          ctx.fillStyle = col.eye;
          ctx.fillRect(baseX + 5, headY + 5, 1, 1);
          ctx.fillRect(baseX + 10, headY + 5, 1, 1);
        }

        ctx.fillStyle = col.limb;
        ctx.fillRect(baseX + 1, lidY + (phase ? 0 : 2), 2, 3);
        ctx.fillRect(baseX + 13, lidY + (phase ? 2 : 0), 2, 3);

        if (enemy.state === 16) {
          ctx.fillStyle = isBack ? "#7084a8" : (phase ? "#ffec48" : "#ffffff");
          ctx.fillRect(baseX + 7, lidY - 7, 2, 2);
        }
        ctx.restore();
        return;
      }

      const isLeft = ((enemy.facing || enemy.dir) & 2) !== 0;
      const stepPhase = (enemy.animCount >> 2) & 1;
      const isDoorIn = enemy.state === 3 && enemy.doorStage === 1;
      const isDoorOut = enemy.state === 3 && enemy.doorStage === 2;
      const isDoorDeep = isDoorIn || isDoorOut;
      const isFrontPause =
        (enemy.state === 2 && (enemy.ladderStage === 0 || enemy.ladderStage === 9)) ||
        (enemy.state === 0 && enemy.isLadderPose);
      const isClimbMove = enemy.state === 2 && !isFrontPause;
      const climbOdd = (enemy.ladderStage & 1) !== 0;
      const f = world ? world.f : 0;
      const drawX = enemy.state === 4 ? baseX + (((f >> 1) & 1) ? 1 : -1) : baseX;

      ctx.save();
      if (isBack) {
        ctx.globalAlpha = 0.85;
      }
      if (isDoorDeep) {
        ctx.globalAlpha = isBack ? 0.72 : 0.88;
        ctx.translate(drawX + 8, drawY + 11);
        ctx.scale(0.84, 0.94);
        ctx.translate(-(drawX + 8), -(drawY + 11));
      }
      if (enemy.state === 10) {
        ctx.translate(drawX + 8, drawY + 11);
        ctx.scale(1, -1);
        ctx.translate(-(drawX + 8), -(drawY + 11));
      }

      ctx.fillStyle = col.calyx;
      ctx.fillRect(drawX + 7, drawY, 2, 2);
      ctx.fillRect(drawX + 4, drawY + 2, 8, 2);
      ctx.fillStyle = col.calyxLight;
      ctx.fillRect(drawX + 5, drawY + 2, 4, 1);

      ctx.fillStyle = col.outline;
      ctx.fillRect(drawX + 3, drawY + 3, 10, 12);
      ctx.fillRect(drawX + 2, drawY + 7, 12, 7);
      ctx.fillStyle = col.body;
      ctx.fillRect(drawX + 4, drawY + 4, 8, 10);
      ctx.fillRect(drawX + 3, drawY + 8, 10, 5);
      ctx.fillStyle = col.highlight;
      ctx.fillRect(drawX + 4, drawY + 5, 3, 2);

      if (isDoorIn) {
        // 後ろ向き表現のため仮面・目を描かない
      } else if (isDoorOut || isFrontPause || isClimbMove) {
        ctx.fillStyle = col.mask;
        ctx.fillRect(drawX + 4, drawY + 6, 8, 6);
        ctx.fillStyle = col.maskShade;
        ctx.fillRect(drawX + 4, drawY + 11, 8, 1);
        ctx.fillStyle = col.eyeHole;
        ctx.fillRect(drawX + 5, drawY + 8, 2, 2);
        ctx.fillRect(drawX + 9, drawY + 8, 2, 2);
        ctx.fillStyle = col.eye;
        ctx.fillRect(drawX + 5, drawY + 8, 1, 2);
        ctx.fillRect(drawX + 10, drawY + 8, 1, 2);
      } else {
        const maskX = isLeft ? drawX + 3 : drawX + 6;
        const eyeX = isLeft ? drawX + 4 : drawX + 10;
        ctx.fillStyle = col.mask;
        ctx.fillRect(maskX, drawY + 6, 7, 6);
        ctx.fillStyle = col.maskShade;
        ctx.fillRect(maskX, drawY + 11, 7, 1);
        ctx.fillStyle = col.eyeHole;
        ctx.fillRect(eyeX, drawY + 8, 2, 2);
        ctx.fillStyle = col.eye;
        ctx.fillRect(isLeft ? eyeX : eyeX + 1, drawY + 8, 1, 2);
      }

      ctx.fillStyle = col.limb;
      if (isFrontPause) {
        ctx.fillRect(drawX + 1, drawY + 6, 2, 5);
        ctx.fillRect(drawX + 13, drawY + 6, 2, 5);
      } else if (isClimbMove) {
        ctx.fillRect(drawX + 1, drawY + (climbOdd ? 4 : 9), 2, 4);
        ctx.fillRect(drawX + 13, drawY + (climbOdd ? 9 : 4), 2, 4);
      } else {
        ctx.fillRect(drawX + 1, drawY + 9, 2, 4);
        ctx.fillRect(drawX + 13, drawY + 9, 2, 4);
      }

      ctx.fillStyle = col.limb;
      if (enemy.state === 5) {
        ctx.fillRect(drawX + 2, drawY + 15, 4, 6);
        ctx.fillRect(drawX + 10, drawY + 15, 4, 6);
      } else if (isFrontPause) {
        ctx.fillRect(drawX + 3, drawY + 15, 3, 7);
        ctx.fillRect(drawX + 10, drawY + 15, 3, 7);
      } else if (isClimbMove) {
        ctx.fillRect(drawX + 4, drawY + 15, 3, climbOdd ? 5 : 7);
        ctx.fillRect(drawX + 9, drawY + 15, 3, climbOdd ? 7 : 5);
      } else if (enemy.state === 1 || enemy.state === 3) {
        ctx.fillRect(drawX + 4, drawY + 15, 3, stepPhase ? 7 : 5);
        ctx.fillRect(drawX + 9, drawY + 15, 3, stepPhase ? 5 : 7);
      } else {
        ctx.fillRect(drawX + 4, drawY + 15, 3, 7);
        ctx.fillRect(drawX + 9, drawY + 15, 3, 7);
      }

      ctx.restore();

      if (enemy.state === 4) {
        const sx1 = drawX + 7 + Math.round(Math.cos(f * 0.35) * 5);
        const sx2 = drawX + 7 + Math.round(Math.cos(f * 0.35 + Math.PI) * 5);
        ctx.fillStyle = isBack ? "#7084a8" : "#ffec48";
        ctx.fillRect(sx1, drawY - 3, 2, 2);
        ctx.fillStyle = isBack ? "#9cb0d4" : "#ffffff";
        ctx.fillRect(sx2, drawY - 1, 2, 2);
      }
    },

    drawEnemyAt(enemy, baseX, drawY, world) {
      if (enemy.enemyType === "eggplant") {
        this.drawEggplantAt(enemy, baseX, drawY, world);
        return;
      }

      const ctx = this.ctx;
      const isBack = !!enemy.isBack;
      const isFast = enemy.enemyType === "spanagonFast";
      const col = isBack
        ? {
            outline: "#121828",
            body: "#25324e",
            highlight: "#3a4d75",
            horn: "#465878",
            arm: "#1c273e",
            eyeWhite: "#68
