(function (root) {
  "use strict";

  const G = root.WreckGame || {};
  const LEFT = G.LEFT || 2;

  const R = root.WreckRender;
  if (!R || !R.Renderer) return;

  // 派手さを抑えた落ち着いた電磁ピンクのパレット
  const PALETTE_ARMILLARY = {
    D: "#7a2258", // 奥側へ回った輪（深ローズピンク）
    M: "#cc4696", // 標準リング（電磁ピンク）
    L: "#ff82c8", // 手前側ハイライトリング
    W: "#ffd6ee"  // 中心電磁コア芯（淡い白ピンク）
  };

  function buildArmillaryGrid(frameIdx, buildStage) {
    const sz = 15;
    const c = 7;
    const grid = Array.from({ length: sz }, () => new Array(sz).fill("."));
    const zbuf = Array.from({ length: sz }, () => new Array(sz).fill(-999));

    function drawRingAxis(rMajor, rMinor, tiltDeg, phaseShift, isOuter) {
      const radTilt = (tiltDeg * Math.PI) / 180;
      const ctA = Math.cos(radTilt);
      const stA = Math.sin(radTilt);
      const steps = 200;

      for (let i = 0; i < steps; i++) {
        const t = (2 * Math.PI * i) / steps;
        const u = rMajor * Math.cos(t);
        const v = rMinor * Math.sin(t);
        let z = Math.sqrt(Math.max(0, rMajor * rMajor - rMinor * rMinor)) * Math.sin(t);
        if (rMinor < 0) z = -z;
        if (isOuter) z = -0.6;

        const px = u * ctA - v * stA;
        const py = u * stA + v * ctA;

        let ch;
        if (isOuter) {
          const glow = Math.sin(t * 2 - phaseShift);
          ch = glow > -0.2 ? "M" : "D";
          if (glow > 0.88) ch = "L";
        } else {
          if (z > rMajor * 0.25) ch = "L";
          else if (z > -rMajor * 0.25) ch = "M";
          else ch = "D";
        }

        const ix = Math.round(c + px);
        const iy = Math.round(c + py);
        if (ix >= 0 && ix < sz && iy >= 0 && iy < sz) {
          if (z > zbuf[iy][ix]) {
            zbuf[iy][ix] = z;
            grid[iy][ix] = ch;
          }
        }
      }
    }

    const spin = frameIdx * (Math.PI / 4);

    // 中心の極小電磁コア（発生初期 buildStage === 0）
    zbuf[c][c] = 0.25;
    grid[c][c] = "W";
    if (buildStage === 0) {
      grid[c][c - 1] = "M";
      grid[c][c + 1] = "M";
      grid[c - 1][c] = "M";
      grid[c + 1][c] = "M";
      return grid;
    }

    const coreHalo = (frameIdx & 1) === 0 ? "L" : "M";
    zbuf[c][c - 1] = 0.05; grid[c][c - 1] = coreHalo;
    zbuf[c][c + 1] = 0.05; grid[c][c + 1] = coreHalo;
    zbuf[c - 1][c] = 0.05; grid[c - 1][c] = coreHalo;
    zbuf[c + 1][c] = 0.05; grid[c + 1][c] = coreHalo;

    if (buildStage >= 1) {
      // 段階1: 内側の回転縦リング
      const rMin1 = 2.4 * Math.cos(spin + 0.35);
      drawRingAxis(4.4, rMin1, 90, spin, false);
    }

    if (buildStage >= 2) {
      // 段階2: 交差する斜めリング2本
      const rMin2 = 2.0 * Math.sin(spin * 0.5 + 0.85);
      drawRingAxis(4.9, rMin2, 40, spin, false);
      const rMin3 = -2.0 * Math.cos(spin * 0.5 + 0.45);
      drawRingAxis(4.9, rMin3, -40, -spin, false);
    }

    if (buildStage >= 3) {
      // 段階3(完成): 横赤道リング＋最外周フレーム輪
      let rMin4 = 1.6 * Math.sin(spin + 1.0);
      if (Math.abs(rMin4) < 1.1) {
        rMin4 = rMin4 >= 0 ? 1.1 : -1.1;
      }
      drawRingAxis(6.8, rMin4, 0, spin, false);
      drawRingAxis(7.0, 7.0, 0, spin, true);
    }

    return grid;
  }

  function bakeArmillary15x15(grid) {
    const c = document.createElement("canvas");
    c.width = 15;
    c.height = 15;
    const g = c.getContext("2d");
    for (let y = 0; y < 15; y++) {
      const row = grid[y];
      for (let x = 0; x < 15; x++) {
        const color = PALETTE_ARMILLARY[row[x]];
        if (!color) continue;
        g.fillStyle = color;
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  Object.assign(R.Renderer.prototype, {
    initFireballSprites() {
      const stage0 = bakeArmillary15x15(buildArmillaryGrid(0, 0));
      const stage1 = [];
      const stage2 = [];
      const stage3 = [];
      for (let i = 0; i < 8; i++) {
        stage1.push(bakeArmillary15x15(buildArmillaryGrid(i, 1)));
        stage2.push(bakeArmillary15x15(buildArmillaryGrid(i, 2)));
        stage3.push(bakeArmillary15x15(buildArmillaryGrid(i, 3)));
      }
      this.fireballSprites = { stage0, stage1, stage2, stage3 };
    },

    drawFireball(fb) {
      if (!fb || fb.animStage < 0) return;
      if (!this.fireballSprites) {
        this.initFireballSprites();
      }

      const cx = Math.round(fb.x + 8);
      const cy = Math.round(fb.y - 13); // 通路とプレイヤー体の中央（ど真ん中）
      const isLeft = (fb.dir & LEFT) !== 0;

      let stage = 3;
      if (fb.state === 1) {
        // 生成時（64F）：コア → 縦輪 → 斜め輪 → 完成の順で地味に組み上がる
        const rem = fb.spawnTimer != null ? fb.spawnTimer : 0;
        if (rem > 48) stage = 0;
        else if (rem > 32) stage = 1;
        else if (rem > 16) stage = 2;
        else stage = 3;
      } else if (fb.state === 3) {
        // 消滅時：完成 → 分解して消える
        stage = Math.max(0, Math.min(3, fb.animStage | 0));
      }

      const rotStep = Math.floor((fb.animCount || 0) / 5) & 7;
      const rotIdx = isLeft ? ((7 - rotStep) & 7) : rotStep;

      let img = null;
      if (stage === 0) {
        img = this.fireballSprites.stage0;
      } else if (stage === 1) {
        img = this.fireballSprites.stage1[rotIdx];
      } else if (stage === 2) {
        img = this.fireballSprites.stage2[rotIdx];
      } else {
        img = this.fireballSprites.stage3[rotIdx];
      }

      if (!img) return;
      this.ctx.drawImage(img, cx - 7, cy - 7);
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
