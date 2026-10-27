/* ═══════════════════════════════════════════════════════════
   BRICK BREAKER PRO — Game Engine (game.js)
   ═══════════════════════════════════════════════════════════ */

"use strict";

// ─── CANVAS SETUP ───────────────────────────────────────────
const canvas = document.getElementById("game-canvas");
const ctx    = canvas.getContext("2d");

const W = 480, H = 680;
canvas.width  = W;
canvas.height = H;

function scaleCanvas() {
  const maxH = window.innerHeight - 96 - 36;
  const maxW = window.innerWidth;
  const scale = Math.min(maxW / W, maxH / H, 1.6);
  canvas.style.width  = Math.floor(W * scale) + "px";
  canvas.style.height = Math.floor(H * scale) + "px";
}
scaleCanvas();
window.addEventListener("resize", scaleCanvas);

// ─── GAME CONFIG ────────────────────────────────────────────
const CFG = {
  paddleH:       12,
  paddleBaseW:   90,
  ballR:         7,
  ballBaseSpeed: 4.2,
  brickCols:     8,
  brickRows:     5,
  brickW:        52,
  brickH:        22,
  brickPadX:     4,
  brickPadY:     4,
  brickOffsetX:  8,
  brickOffsetY:  52,
  maxLives:      5,
  itemDropRate:  0.32,   // raised for more frequent drops
  itemFallSpeed: 2.2,
  laserCooldown: 300,
};

// ─── BALL TYPES ─────────────────────────────────────────────
const BALL_TYPES = [
  {
    id: "blue",   name: "파란공",  emoji: "🔵",
    color: "#4da8ff", glow: "#4da8ff",
    highlightColor: "#c0e4ff",
    speedMult: 1.0, dmgMult: 1,   scoreMult: 1.0, itemBonus: 0,  paddleBonus: 0,
    effect: "기본",
  },
  {
    id: "gold",   name: "황금공",  emoji: "⭐",
    color: "#ffd700", glow: "#ffd700",
    highlightColor: "#fffbe0",
    speedMult: 1.0, dmgMult: 2,   scoreMult: 1.0, itemBonus: 0,  paddleBonus: 0,
    effect: "2배 데미지",
  },
  {
    id: "pink",   name: "분홍공",  emoji: "💗",
    color: "#ff4dac", glow: "#ff4dac",
    highlightColor: "#ffe0f0",
    speedMult: 1.0, dmgMult: 1,   scoreMult: 1.5, itemBonus: 0,  paddleBonus: 0,
    effect: "+50% 점수",
  },
  {
    id: "green",  name: "초록공",  emoji: "🟢",
    color: "#44dd44", glow: "#44dd44",
    highlightColor: "#d0ffd0",
    speedMult: 1.0, dmgMult: 1,   scoreMult: 1.0, itemBonus: 0.10, paddleBonus: 0,
    effect: "+10% 아이템 확률",
  },
  {
    id: "orange", name: "주황공",  emoji: "🔥",
    color: "#ff6a00", glow: "#ff8833",
    highlightColor: "#ffe8d0",
    speedMult: 2.025, dmgMult: 1,  scoreMult: 1.0, itemBonus: 0,  paddleBonus: 0,
    effect: "속도 +102%",
  },
  {
    id: "purple", name: "보라공",  emoji: "💜",
    color: "#b300ff", glow: "#cc44ff",
    highlightColor: "#f0d0ff",
    speedMult: 1.0, dmgMult: 1,   scoreMult: 0.75, itemBonus: 0, paddleBonus: 20,
    effect: "-25% 점수, 패들 +20px",
  },
];

// ─── ITEM TYPES ─────────────────────────────────────────────
const ITEM_TYPES = [
  { id: "multiball", label: "멀티볼",    icon: "🔱", color: "#ffd700", duration: 10000, weight: 20 },
  { id: "split",     label: "공 분열",   icon: "✂️", color: "#ff88ff", duration: 0,     weight: 50 }, // high weight = very common
  { id: "expand",    label: "패들확장",  icon: "➡️", color: "#00d4ff", duration: 12000, weight: 25 },
  { id: "laser",     label: "레이저",    icon: "🔫", color: "#ff4444", duration: 8000,  weight: 18 },
  { id: "life",      label: "생명추가",  icon: "❤️", color: "#44ff88", duration: 0,     weight: 12 },
  { id: "slow",      label: "슬로우",    icon: "⚡",  color: "#ffaa00", duration: 8000,  weight: 20 },
  { id: "bomb",      label: "폭탄",      icon: "💣",  color: "#dd00ff", duration: 0,     weight: 12 },
  { id: "shield",    label: "방어막",    icon: "🛡️", color: "#ffff00", duration: 0,     weight: 15 },
  { id: "curse",     label: "저주",      icon: "✖️",  color: "#ff6688", duration: 6000,  weight: 10 },
  { id: "drain",     label: "생명 감소", icon: "💔", color: "#cc0033", duration: 0,     weight: 3  }, // base weight; scales up with round
];
const ITEM_TOTAL_WEIGHT = ITEM_TYPES.reduce((s, t) => s + t.weight, 0);

// ─── BLOCK COLORS BY HP ──────────────────────────────────────
function blockColorByHp(hp, maxHp) {
  const ratio = hp / maxHp;
  if (ratio > 0.75) return { fill: "#4488ff", border: "#66aaff", text: "#fff" };
  if (ratio > 0.50) return { fill: "#44cc44", border: "#66ee66", text: "#fff" };
  if (ratio > 0.25) return { fill: "#ffaa00", border: "#ffcc44", text: "#000" };
  return { fill: "#ff4444", border: "#ff6666", text: "#fff" };
}

// ─── STATE ──────────────────────────────────────────────────
let state = {};

function initState(round = 1) {
  const paddleW = CFG.paddleBaseW;
  state = {
    round,
    score:    0,
    lives:    3,
    combo:    0,
    maxCombo: 0,
    phase:    "ready",   // ready | playing | paused | gameover | clear

    paddle: {
      x: W / 2 - paddleW / 2,
      y: H - 40,
      w: paddleW,
      h: CFG.paddleH,
    },

    balls:  [],
    bricks: [],
    items:  [],
    lasers: [],
    particles: [],

    effects: {
      expand:    { active: false, timer: 0 },
      laser:     { active: false, timer: 0, lastShot: 0 },
      slow:      { active: false, timer: 0 },
      curse:     { active: false, timer: 0 },
      shield:    { active: false },
    },

    shieldY: H - 14,

    waitingBalls: round,    // total balls to launch this round
    launchedBalls: 0,       // how many we've launched so far
    pendingBalls: 0,        // queue for multi-launch

    mouseX: W / 2,
  };

  spawnBricks(round);
  spawnInitialBall();
  updateHUD();
}

// ─── BRICK SPAWNING ─────────────────────────────────────────
function spawnBricks(round) {
  const cols = CFG.brickCols;
  // rows increase by 1 every 2 rounds, capped at 9
  const rows = Math.min(CFG.brickRows + Math.floor((round - 1) / 2), 9);
  const maxHpBase = 1 + Math.floor(round * 0.6);

  state.bricks = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // skip some bricks randomly for variety (less gaps in later rounds)
      const skipChance = Math.max(0, 0.12 - round * 0.01);
      if (Math.random() < skipChance) continue;

      const rand = Math.random();
      let type = "normal";
      if (round >= 3 && rand < 0.08) type = "ghost";
      if (round >= 2 && rand < 0.06) type = "item";

      const hpVariance = Math.floor(Math.random() * 3);
      let maxHp = maxHpBase + hpVariance + r; // deeper rows are harder
      if (type === "ghost") maxHp = 1;

      state.bricks.push({
        c, r,
        x: CFG.brickOffsetX + c * (CFG.brickW + CFG.brickPadX),
        y: CFG.brickOffsetY + r * (CFG.brickH + CFG.brickPadY),
        w: CFG.brickW,
        h: CFG.brickH,
        hp: maxHp, maxHp,
        type,               // normal | ghost | item
        ghostVisible: true,
        ghostTimer:   0,
        ghostInterval: 2500 + Math.random() * 1500,
        alive: true,
      });
    }
  }
}

// ─── BALL SPAWNING ──────────────────────────────────────────
/**
 * 라운드에 따라 주황공 등장 확률이 점진적으로 증가하는 가중치 선택 함수.
 * 라운드 1: 주황공 기본 비중(1배), 라운드마다 +0.15씩 추가 가중치 부여.
 * 예) 라운드 1 → 주황공 weight 1.0 / 라운드 10 → weight 2.35
 */
function randomBallType(round) {
  const r = round != null ? round : (state.round || 1);
  // 주황공 추가 가중치: 라운드마다 0.15씩 증가 (최대 +3.0, 즉 라운드 20 이상에서 포화)
  const orangeBonus = Math.min((r - 1) * 0.15, 3.0);
  const weights = BALL_TYPES.map(bt =>
    bt.id === "orange" ? (1 + orangeBonus) : 1
  );
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < BALL_TYPES.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return BALL_TYPES[i];
  }
  return BALL_TYPES[BALL_TYPES.length - 1];
}

function createBall(x, y, vx, vy, ballType) {
  const bt = ballType || randomBallType();
  const spd = CFG.ballBaseSpeed * bt.speedMult * (state.effects.slow.active ? 0.6 : 1);
  return {
    x, y, vx, vy,
    r: CFG.ballR,
    type: bt,
    speed: spd,
    stuck: false,
  };
}

function spawnInitialBall() {
  const bt = randomBallType(state.round);
  state.balls.push(createBall(
    W / 2, state.paddle.y - CFG.ballR - 2,
    0, 0, bt
  ));
  state.balls[0].stuck = true;
}

// ─── LAUNCH ─────────────────────────────────────────────────
function launchBalls() {
  if (state.phase !== "ready") return;

  // Launch first ball (already exists, stuck)
  const first = state.balls.find(b => b.stuck);
  if (!first) return;

  first.stuck = false;
  first.vx = (Math.random() * 2 - 1) * 0.5;
  first.vy = -1;
  normalizeSpeed(first);

  state.phase = "playing";
  state.launchedBalls = 1;

  // Hide launch hint
  document.getElementById("launch-hint").classList.add("hidden");

  // Schedule extra balls at 250ms intervals
  const extra = state.waitingBalls - 1;
  for (let i = 0; i < extra; i++) {
    const delay = (i + 1) * 280;
    setTimeout(() => {
      if (state.phase !== "playing") return;
      const bt = randomBallType(state.round);
      const angle = -Math.PI / 2 + (Math.random() * 0.6 - 0.3);
      const ball = createBall(
        state.paddle.x + state.paddle.w / 2,
        state.paddle.y - CFG.ballR - 2,
        Math.cos(angle), Math.sin(angle), bt
      );
      normalizeSpeed(ball);
      state.balls.push(ball);
      state.launchedBalls++;
    }, delay);
  }
}

function normalizeSpeed(ball) {
  // Round-based speed scaling: +5% per round (capped at +80%)
  const roundMult = 1 + Math.min((state.round - 1) * 0.05, 0.8);
  const spd = CFG.ballBaseSpeed * ball.type.speedMult * roundMult * (state.effects.slow.active ? 0.6 : 1);
  const len = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  if (len === 0) { ball.vx = 0; ball.vy = -spd; return; }
  ball.vx = (ball.vx / len) * spd;
  ball.vy = (ball.vy / len) * spd;
  ball.speed = spd;
}

// ─── ITEM SPAWNING ──────────────────────────────────────────
function spawnItem(x, y, ballType) {
  let dropRate = CFG.itemDropRate;
  if (ballType && ballType.itemBonus) dropRate += ballType.itemBonus;
  // Early-round bonus: +15% drop chance for rounds 1-5, tapering off
  if (state.round <= 5) dropRate += 0.15 * (1 - (state.round - 1) / 5);

  if (Math.random() > dropRate) return;

  // Split item weight decreases as rounds progress (more base balls = less need to split)
  // Round 1 → weight 50, Round 13+ → weight 2 (floor)
  const splitWeight = Math.max(2, 50 - (state.round - 1) * 4);

  // Drain item weight INCREASES as rounds progress — makes later rounds harder
  // Round 1 → weight 3, Round 10 → ~10, Round 16+ → capped at 18
  const drainWeight = Math.min(3 + (state.round - 1) * 1.0, 18);

  // Build a dynamic total weight using the adjusted weights
  const dynamicTotal = ITEM_TYPES.reduce((sum, it) => {
    if (it.id === "split") return sum + splitWeight;
    if (it.id === "drain") return sum + drainWeight;
    return sum + it.weight;
  }, 0);

  let roll = Math.random() * dynamicTotal;
  let chosen = ITEM_TYPES[0];
  for (const it of ITEM_TYPES) {
    let w = it.weight;
    if (it.id === "split") w = splitWeight;
    if (it.id === "drain") w = drainWeight;
    roll -= w;
    if (roll <= 0) { chosen = it; break; }
  }

  state.items.push({
    x: x - 16, y,
    w: 32, h: 32,
    vy: CFG.itemFallSpeed,
    type: chosen,
  });
}

// ─── APPLY ITEM ─────────────────────────────────────────────
function applyItem(item) {
  const type = item.type;
  switch (type.id) {
    case "multiball": {
      const existing = state.balls.filter(b => !b.stuck);
      const src = existing[0] || state.balls[0];
      for (let i = 0; i < 2; i++) {
        const angle = (Math.random() * Math.PI * 0.6) - Math.PI * 0.3;
        const b = createBall(src.x, src.y,
          Math.cos(angle) * src.speed, Math.sin(angle) * src.speed,
          randomBallType(state.round)
        );
        state.balls.push(b);
      }
      startEffect("expand", type.duration); // reuse timer slot
      startEffect("multiball_visual", type.duration);
      break;
    }
    case "split": {
      // Clone every active ball — doubles the current ball count
      const activeBalls = state.balls.filter(b => !b.stuck);
      const clones = [];
      for (const src of activeBalls) {
        // Mirror the velocity slightly offset so clones diverge
        const spreadAngle = (Math.random() * 0.5 + 0.15) * (Math.random() < 0.5 ? 1 : -1);
        const cos = Math.cos(spreadAngle), sin = Math.sin(spreadAngle);
        const nvx = src.vx * cos - src.vy * sin;
        const nvy = src.vx * sin + src.vy * cos;
        const clone = createBall(src.x, src.y, nvx, nvy, randomBallType(state.round));
        normalizeSpeed(clone);
        clones.push(clone);
      }
      state.balls.push(...clones);
      // Also give a small score bonus for each cloned ball
      state.score += clones.length * 50;
      updateHUD();
      break;
    }
    case "expand":
      startEffect("expand", type.duration);
      break;
    case "laser":
      startEffect("laser", type.duration);
      break;
    case "life":
      state.lives = Math.min(state.lives + 1, CFG.maxLives);
      updateHUD();
      break;
    case "slow":
      startEffect("slow", type.duration);
      // recompute ball speeds
      for (const b of state.balls) normalizeSpeed(b);
      break;
    case "bomb":
      triggerBomb(item.x + item.w / 2, item.y + item.h / 2);
      break;
    case "shield":
      state.effects.shield.active = true;
      break;
    case "curse":
      startEffect("curse", type.duration);
      break;
    case "drain":
      state.lives = Math.max(0, state.lives - 1);
      updateHUD();
      if (state.lives <= 0) {
        triggerGameOver();
      }
      break;
  }
  updateEffectsBar();
}

function startEffect(id, duration) {
  if (!state.effects[id]) state.effects[id] = { active: false, timer: 0 };
  state.effects[id].active = true;
  state.effects[id].timer  = duration;
}

function triggerBomb(bx, by) {
  const range = 3;
  const cCol = Math.round((bx - CFG.brickOffsetX) / (CFG.brickW + CFG.brickPadX));
  const cRow = Math.round((by - CFG.brickOffsetY) / (CFG.brickH + CFG.brickPadY));
  for (const br of state.bricks) {
    if (!br.alive) continue;
    if (Math.abs(br.c - cCol) <= Math.floor(range/2) && Math.abs(br.r - cRow) <= Math.floor(range/2)) {
      addScore(br, null, true);
      destroyBrick(br);
    }
  }
}

// ─── SCORE ──────────────────────────────────────────────────
function addScore(brick, ball, isBomb = false) {
  const basePts = brick.maxHp * state.round * 2; // x2 multiplier
  let pts = basePts;
  if (ball) pts *= ball.type.scoreMult;
  if (isBomb) pts = Math.floor(pts * 0.5);

  state.combo++;
  state.maxCombo = Math.max(state.maxCombo, state.combo);

  const comboBonus = state.combo >= 5 ? Math.floor(pts * (state.combo * 0.1)) : 0;
  pts = Math.floor(pts + comboBonus);

  state.score += pts;
  updateHUD();

  // Floating score popup
  showScorePopup(brick.x + brick.w / 2, brick.y, `+${pts}`, state.combo >= 5 ? "#ffd700" : "#ffffff");

  if (state.combo >= 5 && state.combo % 5 === 0) {
    showComboPopup(`${state.combo} COMBO!`);
  }
}

function showScorePopup(x, y, text, color) {
  const wrapper = document.querySelector(".canvas-container");
  const canvasRect = canvas.getBoundingClientRect();
  const containerRect = wrapper.getBoundingClientRect();

  const scaleX = canvasRect.width / W;
  const scaleY = canvasRect.height / H;

  const el = document.createElement("div");
  el.className = "score-popup";
  el.textContent = text;
  el.style.color = color;
  el.style.left = (canvasRect.left - containerRect.left + x * scaleX) + "px";
  el.style.top  = (canvasRect.top  - containerRect.top  + y * scaleY - 10) + "px";
  wrapper.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function showComboPopup(text) {
  const wrapper = document.querySelector(".canvas-container");
  const el = document.createElement("div");
  el.className = "combo-popup";
  el.textContent = text;
  wrapper.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

// ─── DESTROY BRICK ──────────────────────────────────────────
function destroyBrick(brick) {
  brick.alive = false;
  spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick);
}

// ─── PARTICLES ──────────────────────────────────────────────
function spawnParticles(x, y, brick) {
  const col = blockColorByHp(1, brick.maxHp); // use destroyed color
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 / 8) * i + Math.random() * 0.4;
    const spd   = 1 + Math.random() * 2.5;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1, decay: 0.04 + Math.random() * 0.03,
      r:    2 + Math.random() * 2,
      color: col.fill,
    });
  }
}

// ─── HUD ────────────────────────────────────────────────────
function updateHUD() {
  document.getElementById("score-display").textContent = state.score.toLocaleString();
  document.getElementById("combo-display").textContent = `x${state.combo + 1}`;
  document.getElementById("round-display").textContent = state.round;
  document.getElementById("lives-display").textContent = "❤️".repeat(Math.max(0, state.lives));
  document.getElementById("balls-display").textContent = state.balls.filter(b => !b.stuck).length || state.waitingBalls;
}

function updateEffectsBar() {
  const bar = document.getElementById("effects-bar");
  bar.innerHTML = "";
  const activeItems = [];

  if (state.effects.expand?.active)  activeItems.push({ icon:"➡️", label:"패들확장", timer: state.effects.expand.timer });
  if (state.effects.laser?.active)   activeItems.push({ icon:"🔫", label:"레이저",   timer: state.effects.laser.timer });
  if (state.effects.slow?.active)    activeItems.push({ icon:"⚡",  label:"슬로우",   timer: state.effects.slow.timer });
  if (state.effects.curse?.active)   activeItems.push({ icon:"✖️",  label:"저주",     timer: state.effects.curse.timer });
  if (state.effects.shield?.active)  activeItems.push({ icon:"🛡️", label:"방어막",   timer: null });

  for (const eff of activeItems) {
    const badge = document.createElement("div");
    badge.className = "effect-badge";
    const secs = eff.timer !== null ? Math.ceil(eff.timer / 1000) : "∞";
    badge.innerHTML = `<span>${eff.icon} ${eff.label}</span><span class="effect-timer">${secs}s</span>`;
    bar.appendChild(badge);
  }

  bar.classList.toggle("has-effects", activeItems.length > 0);
}

// ─── PADDLE WIDTH ────────────────────────────────────────────
function getPaddleW() {
  let w = CFG.paddleBaseW;

  // Purple ball bonus
  const purpleBalls = state.balls.filter(b => b.type.id === "purple");
  if (purpleBalls.length > 0) w += 20;

  if (state.effects.expand?.active) w = Math.floor(w * 1.6);
  if (state.effects.curse?.active)  w = Math.floor(w * 0.5);
  return Math.max(30, w);
}

// ─── LASER ──────────────────────────────────────────────────
function fireLaser() {
  if (!state.effects.laser?.active) return;
  const now = performance.now();
  if (now - state.effects.laser.lastShot < CFG.laserCooldown) return;
  state.effects.laser.lastShot = now;

  const cx = state.paddle.x + state.paddle.w / 2;
  state.lasers.push({ x: cx, y: state.paddle.y, vy: -12, w: 4, h: 14 });
}

// ─── UPDATE LOOP ────────────────────────────────────────────
let lastTime = 0;
let animId   = null;

function gameLoop(ts) {
  const dt = Math.min(ts - lastTime, 50);
  lastTime = ts;

  if (state.phase === "playing") {
    update(dt);
  }
  draw();
  animId = requestAnimationFrame(gameLoop);
}

function update(dt) {
  // Apply held arrow-key movement every frame (smooth, no OS repeat delay)
  if (keysHeld.left)  state.mouseX = Math.max(0, state.mouseX - PADDLE_KEY_SPEED);
  if (keysHeld.right) state.mouseX = Math.min(W, state.mouseX + PADDLE_KEY_SPEED);

  // Paddle position from mouse / arrow keys
  const pw = getPaddleW();
  state.paddle.w = pw;
  state.paddle.x = Math.max(0, Math.min(W - pw, state.mouseX - pw / 2));

  // Update effects timers
  for (const [key, eff] of Object.entries(state.effects)) {
    if (eff.active && eff.timer > 0) {
      eff.timer -= dt;
      if (eff.timer <= 0) {
        eff.active = false;
        eff.timer  = 0;
        if (key === "slow") {
          // restore speeds
          for (const b of state.balls) normalizeSpeed(b);
        }
        updateEffectsBar();
      }
    }
  }

  // Update ghost bricks
  for (const br of state.bricks) {
    if (!br.alive || br.type !== "ghost") continue;
    br.ghostTimer += dt;
    if (br.ghostTimer >= br.ghostInterval) {
      br.ghostTimer = 0;
      br.ghostVisible = !br.ghostVisible;
    }
  }

  // Update balls
  for (const ball of state.balls) {
    if (ball.stuck) {
      ball.x = state.paddle.x + state.paddle.w / 2;
      ball.y = state.paddle.y - ball.r - 2;
      continue;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall collisions
    if (ball.x - ball.r < 0)   { ball.x = ball.r;   ball.vx = Math.abs(ball.vx); }
    if (ball.x + ball.r > W)   { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.r < 0)   { ball.y = ball.r;   ball.vy = Math.abs(ball.vy); }

    // Paddle collision
    if (
      ball.vy > 0 &&
      ball.x > state.paddle.x &&
      ball.x < state.paddle.x + state.paddle.w &&
      ball.y + ball.r >= state.paddle.y &&
      ball.y + ball.r <= state.paddle.y + state.paddle.h + Math.abs(ball.vy) + 2
    ) {
      const hitPos = (ball.x - state.paddle.x) / state.paddle.w; // 0..1
      const angle  = (hitPos - 0.5) * 2.2; // -1.1 to 1.1 radians
      const spd    = ball.speed;
      ball.vx = Math.sin(angle) * spd;
      ball.vy = -Math.cos(angle) * spd;
      ball.y  = state.paddle.y - ball.r - 1;
      state.combo = 0;
      updateHUD();
    }

    // Shield
    if (
      state.effects.shield.active &&
      ball.vy > 0 &&
      ball.y + ball.r >= state.shieldY &&
      ball.y + ball.r <= state.shieldY + 6
    ) {
      ball.vy = -Math.abs(ball.vy);
      ball.y  = state.shieldY - ball.r - 1;
      state.effects.shield.active = false;
      updateEffectsBar();
    }

    // Bottom — ball lost
    if (ball.y - ball.r > H) {
      ball.alive = false;
    }
  }

  // Remove lost balls
  const alive = state.balls.filter(b => b.alive !== false);
  state.balls = alive;

  // Check if all active balls lost
  const activeBalls = state.balls.filter(b => !b.stuck);
  if (activeBalls.length === 0 && state.phase === "playing") {
    if (state.launchedBalls >= state.waitingBalls) {
      // All balls launched and all lost
      loseLife();
    }
  }

  // Brick collisions
  for (const ball of state.balls) {
    if (ball.stuck) continue;
    for (const br of state.bricks) {
      if (!br.alive) continue;
      if (br.type === "ghost" && !br.ghostVisible) continue;

      const hit = rectBallCollide(ball, br);
      if (!hit) continue;

      const dmg = ball.type.dmgMult;
      br.hp -= dmg;

      if (br.hp <= 0) {
        addScore(br, ball);
        if (br.type === "item") {
          spawnItem(br.x + br.w / 2, br.y + br.h, ball.type);
          // guaranteed item for item bricks
          const it = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
          state.items.push({
            x: br.x + (br.w - 32) / 2, y: br.y,
            w: 32, h: 32, vy: CFG.itemFallSpeed,
            type: it,
          });
        } else {
          spawnItem(br.x + br.w / 2, br.y + br.h, ball.type);
        }
        destroyBrick(br);
      } else {
        addScore({ maxHp: 1, x: br.x + br.w/2, y: br.y }, ball); // partial hit score
      }

      applyHitReflect(ball, hit);
    }
  }

  // Update lasers
  for (const laser of state.lasers) {
    laser.y += laser.vy;
    for (const br of state.bricks) {
      if (!br.alive) continue;
      if (
        laser.x > br.x && laser.x < br.x + br.w &&
        laser.y < br.y + br.h && laser.y + laser.h > br.y
      ) {
        addScore(br, null);
        destroyBrick(br);
        laser.dead = true;
      }
    }
    if (laser.y + laser.h < 0) laser.dead = true;
  }
  state.lasers = state.lasers.filter(l => !l.dead);

  // Update falling items
  for (const item of state.items) {
    item.y += item.vy;
    // Check paddle catch
    if (
      item.y + item.h >= state.paddle.y &&
      item.y <= state.paddle.y + state.paddle.h &&
      item.x + item.w >= state.paddle.x &&
      item.x <= state.paddle.x + state.paddle.w
    ) {
      applyItem(item);
      item.caught = true;
      spawnItemCatchParticles(item.x + item.w / 2, item.y + item.h / 2, item.type.color);
    }
    if (item.y > H) item.caught = true;
  }
  state.items = state.items.filter(i => !i.caught);

  // Update particles
  for (const p of state.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.life -= p.decay;
  }
  state.particles = state.particles.filter(p => p.life > 0);

  // Check round clear
  const aliveNormal = state.bricks.filter(b => b.alive && b.type !== "ghost");
  if (aliveNormal.length === 0) {
    triggerRoundClear();
  }

  updateHUD();
  updateEffectsBar();
}

function spawnItemCatchParticles(x, y, color) {
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = 1 + Math.random() * 3;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1, decay: 0.05,
      r: 3,
      color,
    });
  }
}

// ─── BALL-RECT COLLISION ────────────────────────────────────
function rectBallCollide(ball, rect) {
  const closestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.h));
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  const dist2 = dx * dx + dy * dy;
  if (dist2 >= ball.r * ball.r) return null;

  const dist = Math.sqrt(dist2);
  const nx = dist > 0 ? dx / dist : 0;
  const ny = dist > 0 ? dy / dist : -1;

  // Determine which face
  const overlapX = (ball.r - Math.abs(ball.x - (ball.x < rect.x + rect.w / 2 ? rect.x : rect.x + rect.w)));
  const overlapY = (ball.r - Math.abs(ball.y - (ball.y < rect.y + rect.h / 2 ? rect.y : rect.y + rect.h)));
  return overlapX < overlapY ? "x" : "y";
}

function applyHitReflect(ball, face) {
  if (face === "x") ball.vx = -ball.vx;
  else              ball.vy = -ball.vy;
}

// ─── LOSE LIFE ──────────────────────────────────────────────
function loseLife() {
  state.lives--;
  state.combo = 0;
  updateHUD();

  if (state.lives <= 0) {
    triggerGameOver();
    return;
  }

  // Reset for next serve
  state.phase = "ready";
  state.launchedBalls = 0;
  state.balls = [];
  spawnInitialBall();
  document.getElementById("launch-hint").classList.remove("hidden");
}

// ─── ROUND CLEAR ────────────────────────────────────────────
function triggerRoundClear() {
  state.phase = "clear";
  const bonus = state.round * 500;
  state.score += bonus;

  document.getElementById("round-clear-title").textContent = `라운드 ${state.round} 클리어!`;
  document.getElementById("clear-bonus-pts").textContent = `+${bonus.toLocaleString()}`;

  showOverlay("roundclear-overlay");
}

// ─── GAME OVER ───────────────────────────────────────────────
function triggerGameOver() {
  state.phase = "gameover";
  document.getElementById("final-score").textContent = state.score.toLocaleString();
  document.getElementById("final-round").textContent = state.round;
  document.getElementById("final-combo").textContent = state.maxCombo;
  showOverlay("gameover-overlay");
}

// ─── DRAW ────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0d0f1e");
  bg.addColorStop(1, "#080a14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  drawBricks();
  drawItems();
  drawShield();
  drawPaddle();
  drawBalls();
  drawLasers();
  drawParticles();

  // Overlay for ready state
  if (state.phase === "ready") {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    // Don't fill, just hint is shown via HTML
  }
}

function drawBricks() {
  for (const br of state.bricks) {
    if (!br.alive) continue;
    if (br.type === "ghost" && !br.ghostVisible) continue;

    const opacity = br.type === "ghost" ? (br.ghostVisible ? 0.6 : 0) : 1;
    const { fill, border, text } = blockColorByHp(br.hp, br.maxHp);

    ctx.save();
    ctx.globalAlpha = opacity;

    // Shadow
    ctx.shadowColor = fill;
    ctx.shadowBlur  = 6;

    // Fill
    const grad = ctx.createLinearGradient(br.x, br.y, br.x, br.y + br.h);
    grad.addColorStop(0, lighten(fill, 0.25));
    grad.addColorStop(1, fill);
    roundRect(ctx, br.x, br.y, br.w, br.h, 5, grad);

    // Border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = border;
    ctx.lineWidth   = 1.5;
    roundRect(ctx, br.x, br.y, br.w, br.h, 5, null, true);

    // HP Number
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = "rgba(0,0,0,0.55)";
    ctx.font        = "bold 11px 'JetBrains Mono', monospace";
    ctx.textAlign   = "center";
    ctx.textBaseline= "middle";
    ctx.fillText(br.hp, br.x + br.w / 2 + 1, br.y + br.h / 2 + 1);
    ctx.fillStyle   = text === "#fff" ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.9)";
    ctx.fillText(br.hp, br.x + br.w / 2, br.y + br.h / 2);

    // Item/Ghost icons
    if (br.type === "item") {
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "rgba(255,200,255,0.9)";
      ctx.fillText("🎁", br.x + br.w - 13, br.y + 10);
    }
    if (br.type === "ghost") {
      ctx.font = "9px sans-serif";
      ctx.fillText("👻", br.x + br.w - 13, br.y + 10);
    }

    ctx.restore();
  }
}

function drawPaddle() {
  const { x, y, w, h } = state.paddle;

  ctx.save();
  // Glow
  ctx.shadowColor = "#5865f2";
  ctx.shadowBlur  = 18;

  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, "#818cf8");
  grad.addColorStop(1, "#4338ca");
  roundRect(ctx, x, y, w, h, 6, grad);

  // Highlight strip
  ctx.shadowBlur = 0;
  ctx.fillStyle  = "rgba(255,255,255,0.35)";
  roundRect(ctx, x + 4, y + 2, w - 8, 3, 2, "rgba(255,255,255,0.35)");

  // Laser indicator
  if (state.effects.laser?.active) {
    ctx.fillStyle = "rgba(255,80,80,0.9)";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBalls() {
  for (const ball of state.balls) {
    ctx.save();
    ctx.shadowColor = ball.type.glow;
    ctx.shadowBlur  = 16;

    // Body
    const grad = ctx.createRadialGradient(
      ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, 1,
      ball.x, ball.y, ball.r
    );
    grad.addColorStop(0, ball.type.highlightColor);
    grad.addColorStop(0.5, ball.type.color);
    grad.addColorStop(1, darken(ball.type.color, 0.4));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    // Shine
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(ball.x - ball.r * 0.28, ball.y - ball.r * 0.28, ball.r * 0.38, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawLasers() {
  for (const laser of state.lasers) {
    ctx.save();
    ctx.shadowColor = "#ff4444";
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = "#ff4444";
    roundRect(ctx, laser.x - laser.w / 2, laser.y, laser.w, laser.h, 2, "#ff4444");
    ctx.restore();
  }
}

function drawItems() {
  for (const item of state.items) {
    ctx.save();
    ctx.shadowColor = item.type.color;
    ctx.shadowBlur  = 12;

    // Background circle
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.arc(item.x + item.w / 2, item.y + item.h / 2, 16, 0, Math.PI * 2);
    ctx.fill();

    // Colored ring
    ctx.strokeStyle = item.type.color;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(item.x + item.w / 2, item.y + item.h / 2, 15, 0, Math.PI * 2);
    ctx.stroke();

    // Icon
    ctx.font        = "18px sans-serif";
    ctx.textAlign   = "center";
    ctx.textBaseline= "middle";
    ctx.fillText(item.type.icon, item.x + item.w / 2, item.y + item.h / 2 + 1);

    ctx.restore();
  }
}

function drawShield() {
  if (!state.effects.shield?.active) return;
  ctx.save();
  ctx.shadowColor = "#ffff44";
  ctx.shadowBlur  = 16;
  ctx.strokeStyle = "#ffff44";
  ctx.lineWidth   = 4;
  ctx.beginPath();
  ctx.moveTo(0, state.shieldY);
  ctx.lineTo(W, state.shieldY);
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── UTILS ──────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r, fillStyle, stroke = false) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
  if (stroke)    { ctx.stroke(); }
}

function lighten(hex, amount) {
  let [r,g,b] = hexToRgb(hex);
  r = Math.min(255, r + 255 * amount);
  g = Math.min(255, g + 255 * amount);
  b = Math.min(255, b + 255 * amount);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}
function darken(hex, amount) {
  let [r,g,b] = hexToRgb(hex);
  r = Math.max(0, r - 255 * amount);
  g = Math.max(0, g - 255 * amount);
  b = Math.max(0, b - 255 * amount);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}
function hexToRgb(hex) {
  const h = hex.replace("#","");
  if (h.length === 3) {
    return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
  }
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

// ─── OVERLAY HELPERS ─────────────────────────────────────────
function showOverlay(id) {
  document.querySelectorAll(".overlay").forEach(o => {
    o.classList.remove("active");
  });
  document.getElementById(id).classList.add("active");
}
function hideOverlay(id) {
  document.getElementById(id).classList.remove("active");
}
function hideAllOverlays() {
  document.querySelectorAll(".overlay").forEach(o => o.classList.remove("active"));
}

// ─── INPUT ──────────────────────────────────────────────────

// Tracks which keys are currently held down for smooth per-frame movement
const keysHeld = { left: false, right: false };
const PADDLE_KEY_SPEED = 7; // pixels per frame at 60fps

canvas.addEventListener("mousemove", (e) => {
  const rect  = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  state.mouseX = (e.clientX - rect.left) * scaleX;
});

canvas.addEventListener("click", () => {
  if (state.phase === "ready")   { launchBalls(); return; }
  if (state.effects.laser?.active) fireLaser();
});

document.addEventListener("keydown", (e) => {
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    if (state.phase === "ready")   { launchBalls(); return; }
    if (state.effects.laser?.active) fireLaser();
  }
  if (e.key === "p" || e.key === "P" || e.key === "Escape") {
    togglePause();
  }
  // Track held state — movement applied in update() every frame
  if (e.key === "ArrowLeft")  { e.preventDefault(); keysHeld.left  = true; }
  if (e.key === "ArrowRight") { e.preventDefault(); keysHeld.right = true; }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft")  keysHeld.left  = false;
  if (e.key === "ArrowRight") keysHeld.right = false;
});

document.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const rect  = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  state.mouseX = (e.touches[0].clientX - rect.left) * scaleX;
}, { passive: false });

document.addEventListener("touchstart", (e) => {
  if (state.phase === "ready") launchBalls();
}, { passive: true });

// ─── PAUSE ──────────────────────────────────────────────────
function togglePause() {
  if (state.phase === "playing") {
    state.phase = "paused";
    showOverlay("pause-overlay");
  } else if (state.phase === "paused") {
    state.phase = "playing";
    hideOverlay("pause-overlay");
  }
}

// ─── UI BUTTON WIRING ────────────────────────────────────────
// Tutorial tabs — 탭 전환 시 모달 맨 위로 스크롤
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-content-${tab}`).classList.add("active");
    // 탭 전환 시 모달 스크롤을 맨 위로 → 탭 바가 항상 보이게
    document.querySelector(".tutorial-modal").scrollTo({ top: 0, behavior: "smooth" });
  });
});

document.getElementById("btn-start-game").addEventListener("click", () => {
  hideAllOverlays();
  if (!animId) {
    lastTime = performance.now();
    animId = requestAnimationFrame(gameLoop);
  }
});

document.getElementById("btn-resume").addEventListener("click", () => {
  state.phase = "playing";
  hideOverlay("pause-overlay");
});

document.getElementById("btn-restart-pause").addEventListener("click", () => {
  hideAllOverlays();
  restartGame();
});

// ─── HOME (처음으로) ──────────────────────────────────────────
function goHome() {
  // 게임 루프 정지
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
  // 버튼/탭 상태 초기화 (openTutorial이 숨긴 경우 복원)
  const startBtn = document.getElementById("btn-start-game");
  const backBtn  = document.getElementById("btn-back-to-game");
  startBtn.classList.remove("hidden");
  backBtn.classList.add("hidden");

  // 탭 원복 (공의 종류 탭)
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
  document.getElementById("tab-balls").classList.add("active");
  document.getElementById("tab-content-balls").classList.add("active");

  // 상태 초기화 후 튜토리얼 화면 표시
  initState(1);
  showOverlay("tutorial-overlay");
  document.getElementById("launch-hint").classList.add("hidden");
}

document.getElementById("btn-home-pause").addEventListener("click", goHome);
document.getElementById("btn-home-gameover").addEventListener("click", goHome);
document.getElementById("btn-home-clear").addEventListener("click", goHome);
document.getElementById("btn-home-header").addEventListener("click", () => {
  if (confirm("처음 화면으로 돌아가면 현재 게임 진행 상황이 초기화됩니다. 계속할까요?")) {
    goHome();
  }
});

document.getElementById("btn-pause").addEventListener("click", () => togglePause());


document.getElementById("btn-play-again").addEventListener("click", () => {
  hideAllOverlays();
  restartGame();
});

document.getElementById("btn-next-round").addEventListener("click", () => {
  hideAllOverlays();
  const nextRound = state.round + 1;
  const savedScore = state.score;
  const savedLives = state.lives;
  const savedMaxCombo = state.maxCombo;

  initState(nextRound);
  state.score    = savedScore;
  state.lives    = savedLives;
  state.maxCombo = savedMaxCombo;
  state.phase    = "ready";
  document.getElementById("launch-hint").classList.remove("hidden");
  updateHUD();
});

// ─── GUIDE / TUTORIAL 공통 헬퍼 ─────────────────────────────
// 튜토리얼을 열 때 "어떤 화면으로 돌아갈지"를 지정하는 함수.
// returnOverlayId: 돌아갈 오버레이 ID (null이면 게임 재개)
function openTutorial(returnOverlayId, returnPhase) {
  showOverlay("tutorial-overlay");

  const startBtn   = document.getElementById("btn-start-game");
  const backBtn    = document.getElementById("btn-back-to-game");

  // 시작 버튼 숨기고, 돌아가기 버튼 표시
  startBtn.classList.add("hidden");
  backBtn.classList.remove("hidden");

  // 아이템 탭으로 자동 이동
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
  document.getElementById("tab-items").classList.add("active");
  document.getElementById("tab-content-items").classList.add("active");

  function onBack() {
    // 버튼 상태 원복
    backBtn.classList.add("hidden");
    startBtn.classList.remove("hidden");

    // 탭 원복 (공의 종류)
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    document.getElementById("tab-balls").classList.add("active");
    document.getElementById("tab-content-balls").classList.add("active");

    hideAllOverlays();
    if (returnOverlayId) {
      showOverlay(returnOverlayId);
    } else if (returnPhase === "playing") {
      state.phase = "playing";
    }
    backBtn.removeEventListener("click", onBack);
  }

  backBtn.addEventListener("click", onBack);
}

// 일시정지 → 가이드 버튼
document.getElementById("btn-guide").addEventListener("click", () => {
  hideOverlay("pause-overlay");
  state.phase = "paused";
  openTutorial("pause-overlay", "paused");
});

// 라운드 클리어 → 아이템 설명 버튼
document.getElementById("btn-guide-clear").addEventListener("click", () => {
  hideOverlay("roundclear-overlay");
  openTutorial("roundclear-overlay", null);
});


function restartGame() {
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
  initState(1);
  document.getElementById("launch-hint").classList.remove("hidden");
  lastTime = performance.now();
  animId = requestAnimationFrame(gameLoop);
}

// ─── BOOT ────────────────────────────────────────────────────
initState(1);
// Game loop starts only when user clicks "Start Game" from the tutorial
// Draw initial frame
requestAnimationFrame(() => {
  lastTime = performance.now();
  draw(); // single static frame while tutorial is open
});
