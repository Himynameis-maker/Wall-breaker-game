(function (root) {
  "use strict";

  const R = root.WreckRender;
  if (!R || !R.Renderer) return;

  Object.assign(R.Renderer.prototype, {
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
        const headY = enemy.state === 15 ? (lidY - 2) : (lidY - 7 + (phase ? -1 : 0));

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
        if (enemy.state === 15) {
          ctx.fillRect(baseX + 1, lidY - 4, 2, 3);
          ctx.fillRect(baseX + 13, lidY - 4, 2, 3);
        } else {
          ctx.fillRect(baseX + 1, lidY - (phase ? 5 : 3), 2, 3);
          ctx.fillRect(baseX + 13, lidY - (phase ? 3 : 5), 2, 3);
        }

        if (enemy.state === 16) {
          ctx.fillStyle = isBack ? "#7084a8" : (phase ? "#ffec48" : "#ffffff");
          ctx.fillRect(baseX + 7, lidY - 10, 2, 2);
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

      // 茎・緑のヘタ
      ctx.fillStyle = col.calyx;
      ctx.fillRect(drawX + 7, drawY, 2, 2);
      ctx.fillRect(drawX + 4, drawY + 2, 8, 2);
      ctx.fillStyle = col.calyxLight;
      ctx.fillRect(drawX + 5, drawY + 2, 4, 1);

      // 紫のナス型ボディ（下が少しふっくらした丸み）
      ctx.fillStyle = col.outline;
      ctx.fillRect(drawX + 3, drawY + 3, 10, 12);
      ctx.fillRect(drawX + 2, drawY + 7, 12, 7);
      ctx.fillStyle = col.body;
      ctx.fillRect(drawX + 4, drawY + 4, 8, 10);
      ctx.fillRect(drawX + 3, drawY + 8, 10, 5);
      ctx.fillStyle = col.highlight;
      ctx.fillRect(drawX + 4, drawY + 5, 3, 2);

      // 白い仮面＆目（ドア入り奥向き時は背中扱い、出向き・はしご時は正面2つ目）
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

      // 腕
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

      // 二本足
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

      // State 4 スタン硬直中の星エフェクト
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
            eyeWhite: "#687898",
            eyePupil: "#384460"
          }
        : isFast
          ? {
              outline: "#0b2a38",
              body: "#197286",
              highlight: "#3fa4ba",
              horn: "#d4982a",
              arm: "#145364",
              eyeWhite: "#dce6ee",
              eyePupil: "#cc2222"
            }
          : {
              outline: "#184c5c",
              body: "#36b8c8",
              highlight: "#7cf0f8",
              horn: "#ffe060",
              arm: "#2890a0",
              eyeWhite: "#ffffff",
              eyePupil: "#e03030"
            };

      if (enemy.state === 15 || enemy.state === 16) {
        const f = world ? world.f : 0;
        const phase = (f >> 2) & 1;
        const lidY = drawY - 4;
        const headY = enemy.state === 15 ? (lidY - 2) : (lidY - 7 + (phase ? -1 : 0));

        ctx.save();
        if (isBack) ctx.globalAlpha = 0.85;
        ctx.fillStyle = col.horn;
        ctx.fillRect(baseX + 4, headY, 2, 2);
        ctx.fillRect(baseX + 10, headY, 2, 2);
        ctx.fillStyle = col.outline;
        ctx.fillRect(baseX + 3, headY + 2, 10, 6);
        ctx.fillStyle = col.body;
        ctx.fillRect(baseX + 4, headY + 3, 8, 5);
        ctx.fillStyle = col.highlight;
        ctx.fillRect(baseX + 5, headY + 3, 6, 1);

        if (enemy.state === 16) {
          ctx.fillStyle = col.eyeWhite;
          ctx.fillRect(baseX + 5, headY + 5, 2, 2);
          ctx.fillRect(baseX + 9, headY + 5, 2, 2);
          ctx.fillStyle = col.eyePupil;
          ctx.fillRect(baseX + 5, headY + 6, 1, 1);
          ctx.fillRect(baseX + 10, headY + 6, 1, 1);
        }

        ctx.fillStyle = col.arm;
        if (enemy.state === 15) {
          ctx.fillRect(baseX + 1, lidY - 4, 2, 3);
          ctx.fillRect(baseX + 13, lidY - 4, 2, 3);
        } else {
          ctx.fillRect(baseX + 1, lidY - (phase ? 5 : 3), 2, 3);
          ctx.fillRect(baseX + 13, lidY - (phase ? 3 : 5), 2, 3);
        }

        if (enemy.state === 16) {
          ctx.fillStyle = isBack ? "#7084a8" : (phase ? "#ffec48" : "#ffffff");
          ctx.fillRect(baseX + 7, lidY - 10, 2, 2);
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

      // 二本足の仮ドット描画（通常スパナは明るめシアン、高速色違いはやや濃いシアン、裏は暗いシルエット）
      ctx.fillStyle = col.outline;
      ctx.fillRect(drawX + 3, drawY + 3, 10, 12);
      ctx.fillStyle = col.body;
      ctx.fillRect(drawX + 4, drawY + 4, 8, 10);
      ctx.fillStyle = col.highlight;
      ctx.fillRect(drawX + 5, drawY + 5, 6, 2);

      // 頭の角・スパナ風突起
      ctx.fillStyle = col.horn;
      ctx.fillRect(drawX + 4, drawY + 1, 2, 2);
      ctx.fillRect(drawX + 10, drawY + 1, 2, 2);

      // 目（ドア入り奥向き時は背中扱い、出向き・はしご時は正面2つ目）
      if (isDoorIn) {
        // 後ろ向き表現のため目を描かない
      } else if (isDoorOut || isFrontPause || isClimbMove) {
        ctx.fillStyle = col.eyeWhite;
        ctx.fillRect(drawX + 5, drawY + 7, 2, 3);
        ctx.fillRect(drawX + 9, drawY + 7, 2, 3);
        ctx.fillStyle = col.eyePupil;
        ctx.fillRect(drawX + 5, drawY + 8, 1, 2);
        ctx.fillRect(drawX + 10, drawY + 8, 1, 2);
      } else {
        ctx.fillStyle = col.eyeWhite;
        ctx.fillRect(isLeft ? drawX + 4 : drawX + 9, drawY + 7, 3, 3);
        ctx.fillStyle = col.eyePupil;
        ctx.fillRect(isLeft ? drawX + 4 : drawX + 11, drawY + 8, 1, 2);
      }

      // 腕
      ctx.fillStyle = col.arm;
      if (isFrontPause) {
        ctx.fillRect(drawX + 1, drawY + 6, 2, 5);
        ctx.fillRect(drawX + 13, drawY + 6, 2, 5);
      } else if (isClimbMove) {
        ctx.fillRect(drawX + 1, drawY + (climbOdd ? 4 : 9), 2, 4);
        ctx.fillRect(drawX + 13, drawY + (climbOdd ? 9 : 4), 2, 4);
      } else {
        ctx.fillRect(drawX + 2, drawY + 9, 2, 4);
        ctx.fillRect(drawX + 12, drawY + 9, 2, 4);
      }

      // 二本足
      ctx.fillStyle = col.outline;
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

      // State 4 スタン硬直中の星エフェクト
      if (enemy.state === 4) {
        const sx1 = drawX + 7 + Math.round(Math.cos(f * 0.35) * 5);
        const sx2 = drawX + 7 + Math.round(Math.cos(f * 0.35 + Math.PI) * 5);
        ctx.fillStyle = isBack ? "#7084a8" : "#ffec48";
        ctx.fillRect(sx1, drawY - 3, 2, 2);
        ctx.fillStyle = isBack ? "#9cb0d4" : "#ffffff";
        ctx.fillRect(sx2, drawY - 1, 2, 2);
      }
    },

    drawEnemy(enemy, worldWidth, world) {
      if (enemy.enemyType !== "eggplant" && typeof this.drawSpanagon === "function") {
        this.drawSpanagon(enemy, worldWidth, world);
        return;
      }
      if (enemy.enemyType === "eggplant" && typeof this.drawEggplant === "function") {
        this.drawEggplant(enemy, worldWidth, world);
        return;
      }
      const drawY = enemy.y - 22;
      this.drawEnemyAt(enemy, enemy.x, drawY, world);
      if (enemy.x > worldWidth - 16) {
        this.drawEnemyAt(enemy, enemy.x - worldWidth, drawY, world);
      }
      if (enemy.x < 16) {
        this.drawEnemyAt(enemy, enemy.x + worldWidth, drawY, world);
      }
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
