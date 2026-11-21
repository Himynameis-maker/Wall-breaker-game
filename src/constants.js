(function (root) {
  "use strict";

  const RIGHT = 1;
  const LEFT = 2;
  const DOWN = 4;
  const UP = 8;
  const HAMMER = 16;

  // 通常壁・鉄柱の共通崩壊フレーム基準 ($B0F1 + $AB6F: stage 5->4->3->2->1->0)
  const COLLAPSE_STAGE_FRAMES = 8;
  const COLLAPSE_TOTAL_FRAMES = 1 + COLLAPSE_STAGE_FRAMES * 4; // 33F
  const COLLAPSE_HIT_FRAMES = 1 + COLLAPSE_STAGE_FRAMES * 3;   // 25F (stage >= 2)

  const TILE = {
    EMPTY: 0x00,
    LADDER: 0x01,
    DOOR_OPEN: 0x04,       // ドア全開（敵入出可・ダウン判定なし）
    DOOR_CLOSING_1: 0x05,  // ドア閉じかけ1
    DOOR_CLOSING_2: 0x07,  // ドア閉じかけ2
    WALL: 0x08,            // 互換エイリアス（ドラム缶）
    DRUM: 0x08,            // ドラム缶（横通行不可・上乗れる・壊せない）
    HOLE: 0x09,
    HOLE_CRUMBLED: 0x0a,   // 壊せるはしご崩落穴
    HOLE_PILLAR_LAD: 0x0b, // 連続はしご落下後の穴
    HOLE_FALLING: 0x0c,    // 鉄柱で上段が落ち始めた瞬間の滞空穴（0〜41F）
    DRUM_FALLING: 0x0d,    // ドラム缶落下中の下段（30〜41F）
    CRUMBLING_1: 0x51,     // 壊れかけはしご（残1）
    CRUMBLING_2: 0x52,     // 壊れかけはしご（残2）
    CRUMBLING_3: 0x53,     // 壊れかけはしご（残3）
    CRUMBLING_4: 0x54,     // 壊れかけはしご（残4）
    DOOR_OPENING_2: 0x62,  // ドア開き始め2（マリオ叩き、ダウン判定あり）
    DOOR_OPENING_1: 0x63,  // ドア開き始め1（マリオ叩き、ダウン判定あり）
    WALL_1: 0xc1,          // 1回壊せる壁
    WALL_2: 0x92,          // 2回壊せる壁
    WALL_3: 0xa3,          // 3回壊せる壁
    BOMB: 0xb1,            // 爆弾
    BREAK_LADDER: 0xd1,    // 壊せるはしご
    DOOR: 0xe1,            // ドア（閉：叩ける・素通り可・破壊ターゲット外）
    PILLAR: 0xf1           // 支柱（鉄柱）
  };

  function isBreakableTile(t) {
    return (t & 0x80) !== 0;
  }

  function isClearTargetTile(t) {
    if ((t & 0x80) === 0) return false;
    if (t === TILE.BOMB || t === TILE.PILLAR) return false;
    if ((t & 0xf0) === 0xe0) return false;
    return true;
  }

  function isLadderTile(t) {
    return t === TILE.LADDER || t === TILE.BREAK_LADDER;
  }

  function isCrumblingLadderTile(t) {
    return t >= 0x51 && t <= 0x55;
  }

  function isPillarCrumblingTile(t) {
    return t >= 0x71 && t <= 0x75;
  }

  function isDoorOpeningTile(t) {
    return (t & 0x80) === 0 && (t & 0x70) === 0x60 && (t & 0x07) >= 2;
  }

  function isDoorRelatedTile(t) {
    return t === TILE.DOOR_OPEN ||
      t === TILE.DOOR_CLOSING_1 ||
      t === TILE.DOOR_CLOSING_2 ||
      (t & 0x70) === 0x60;
  }

  function isSameLadderType(t1, t2) {
    return (t1 === TILE.LADDER && t2 === TILE.LADDER) ||
      (t1 === TILE.BREAK_LADDER && t2 === TILE.BREAK_LADDER);
  }

  function isHoleTile(t) {
    return t >= 0x09 && t <= 0x0b;
  }

  function isFallHoleTile(t) {
    return t >= 0x09 && t <= 0x0c;
  }

  function isSolidDrum(t) {
    return t === TILE.DRUM;
  }

  function getPillarFallPayload(aboveTile) {
    if (aboveTile === TILE.EMPTY) return TILE.EMPTY;
    if (aboveTile === TILE.LADDER || aboveTile === TILE.BREAK_LADDER || aboveTile === TILE.DRUM) {
      return aboveTile;
    }
    if (aboveTile === TILE.BOMB ||
        aboveTile === TILE.WALL_1 ||
        aboveTile === TILE.WALL_2 || aboveTile === 0x91 ||
        aboveTile === TILE.WALL_3 || aboveTile === 0xa2 || aboveTile === 0xa1) {
      return aboveTile;
    }
    if (aboveTile >= 0x10 && aboveTile <= 0x5f) {
      return TILE.EMPTY;
    }
    return null;
  }

  function getHammerTiming(slot) {
    if (slot.isMario) {
      return slot.isGolden
        ? { totalFrames: 7, hitFrame: 5, recoverStart: 7 }
        : { totalFrames: 21, hitFrame: 17, recoverStart: 21 };
    }
    return { totalFrames: 27, hitFrame: 14, recoverStart: 23 };
  }

  // State 5 落下速度テーブル（前半=Mario用, 後半$12〜=Spike用）
  const FALL_TABLE = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 2, 1, 2, 2, 3, -1,
    0, 1, 0, 1, 1, 2, 1, 2, 2, 2, 3, 2, 3, -1
  ];

  // State 10 被弾跳ねY差分テーブル（上へ-10px跳ねて戻り、以降は毎F+2落下）
  const KNOCKDOWN_DY = [
    -2, -2, -1, -2, -1, -1, 0, -1, 0, 0,
     0,  0,  1,  0,  1,  2, 1,  1, 2, 1, 1
  ];

  function relYOfProm(prom) {
    if (prom <= 4) return 31;
    if (prom <= 9) return 27;
    if (prom <= 14) return 23;
    if (prom <= 19) return 19;
    if (prom <= 24) return 15;
    return 11;
  }

  const api = {
    RIGHT,
    LEFT,
    DOWN,
    UP,
    HAMMER,
    COLLAPSE_STAGE_FRAMES,
    COLLAPSE_TOTAL_FRAMES,
    COLLAPSE_HIT_FRAMES,
    TILE,
    isBreakableTile,
    isClearTargetTile,
    isLadderTile,
    isCrumblingLadderTile,
    isPillarCrumblingTile,
    isDoorOpeningTile,
    isDoorRelatedTile,
    isSameLadderType,
    isHoleTile,
    isFallHoleTile,
    isSolidDrum,
    getPillarFallPayload,
    getHammerTiming,
    FALL_TABLE,
    KNOCKDOWN_DY,
    relYOfProm
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.WreckGame = Object.assign(root.WreckGame || {}, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
