const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAYER_Y = HEIGHT - 110;

const ui = {
  sector: document.getElementById("sector"),
  distance: document.getElementById("distance"),
  kills: document.getElementById("kills"),
  weapon: document.getElementById("weapon"),
  squad: document.getElementById("squad"),
  titlePanel: document.getElementById("titlePanel"),
  choicePanel: document.getElementById("choicePanel"),
  gameOverPanel: document.getElementById("gameOverPanel"),
  summary: document.getElementById("summary"),
  leaderboardList: document.getElementById("leaderboardList"),
  playerName: document.getElementById("playerName"),
  startBtn: document.getElementById("startBtn"),
  restartBtn: document.getElementById("restartBtn"),
  saveScoreBtn: document.getElementById("saveScoreBtn"),
  weaponChoice: document.getElementById("weaponChoice"),
  squadChoice: document.getElementById("squadChoice"),
};

const input = { left: false, right: false };

const state = {
  mode: "title",
  x: WIDTH / 2,
  speed: 4,
  distance: 0,
  kills: 0,
  sector: 1,
  nextChoiceAt: 300,
  weaponLevel: 1,
  squadSize: 1,
  hp: 100,
  enemyHPBoost: 0,
  bulletPower: 16,
  fireInterval: 170,
  lastShotAt: 0,
  enemies: [],
  bullets: [],
  particles: [],
  flash: 0,
  cameraShake: 0,
  gridOffset: 0,
  savedOnce: false,
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function setMode(mode) {
  state.mode = mode;
  ui.titlePanel.classList.toggle("hidden", mode !== "title");
  ui.choicePanel.classList.toggle("hidden", mode !== "choice");
  ui.gameOverPanel.classList.toggle("hidden", mode !== "gameover");
}

function resetGame() {
  state.x = WIDTH / 2;
  state.speed = 4;
  state.distance = 0;
  state.kills = 0;
  state.sector = 1;
  state.nextChoiceAt = 300;
  state.weaponLevel = 1;
  state.squadSize = 1;
  state.hp = 100;
  state.enemyHPBoost = 0;
  state.bulletPower = 16;
  state.fireInterval = 170;
  state.lastShotAt = 0;
  state.enemies = [];
  state.bullets = [];
  state.particles = [];
  state.flash = 0;
  state.cameraShake = 0;
  state.gridOffset = 0;
  state.savedOnce = false;
  setMode("running");
}

function getDifficulty() {
  return Math.min(1, state.distance / 3500);
}

function chooseUpgrade(type) {
  if (type === "weapon") {
    state.weaponLevel += 1;
    state.bulletPower += 5;
    state.fireInterval = Math.max(72, state.fireInterval - 14);
  } else {
    state.squadSize = Math.min(8, state.squadSize + 1);
  }
  state.enemyHPBoost += 6;
  state.speed = Math.min(9.2, state.speed + 0.34);
  state.sector += 1;
  state.nextChoiceAt += 270 + state.sector * 42;
  setMode("running");
}

function spawnEnemy() {
  const d = getDifficulty();
  const typeRoll = Math.random();
  const x = rand(70, WIDTH - 70);

  if (typeRoll < 0.18 + d * 0.3) {
    state.enemies.push({
      type: "brute",
      x,
      y: -40,
      r: 24,
      hp: 65 + state.enemyHPBoost,
      speed: 1.6 + d * 1.6,
      zigzag: rand(0.02, 0.04),
      phase: rand(0, Math.PI * 2),
      tint: "#7af5cc",
    });
    return;
  }

  state.enemies.push({
    type: "walker",
    x,
    y: -20,
    r: 17,
    hp: 30 + state.enemyHPBoost,
    speed: 2.2 + d * 2.2,
    zigzag: rand(0.025, 0.055),
    phase: rand(0, Math.PI * 2),
    tint: "#ff7e6d",
  });
}

function shotBurst(time) {
  const shooters = [];
  for (let i = 0; i < state.squadSize; i += 1) {
    const spread = (i - (state.squadSize - 1) / 2) * 24;
    shooters.push({ x: state.x + spread, y: PLAYER_Y + rand(-4, 4) });
  }

  const levelSpread = Math.min(5, Math.floor((state.weaponLevel - 1) / 2));
  for (const s of shooters) {
    for (let i = -levelSpread; i <= levelSpread; i += 1) {
      state.bullets.push({
        x: s.x,
        y: s.y,
        vx: i * 0.75,
        vy: -8.5 - state.weaponLevel * 0.32,
        damage: state.bulletPower,
        life: 130,
      });
    }
  }
  state.lastShotAt = time;
}

function spawnHitParticles(x, y, tint) {
  for (let i = 0; i < 12; i += 1) {
    state.particles.push({
      x,
      y,
      vx: rand(-2.8, 2.8),
      vy: rand(-2.8, 2.8),
      life: rand(20, 44),
      tint,
      size: rand(1.4, 3.6),
    });
  }
}

function update(time) {
  if (state.mode !== "running") return;

  const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  state.x = clamp(state.x + move * 6.2, 60, WIDTH - 60);
  state.distance += state.speed;
  state.gridOffset += state.speed * 0.6;
  state.flash = Math.max(0, state.flash - 0.025);
  state.cameraShake *= 0.92;

  const d = getDifficulty();
  if (Math.random() < 0.03 + d * 0.025) spawnEnemy();

  if (time - state.lastShotAt >= state.fireInterval) shotBurst(time);

  for (const b of state.bullets) {
    b.x += b.vx;
    b.y += b.vy;
    b.life -= 1;
  }
  state.bullets = state.bullets.filter((b) => b.y > -40 && b.life > 0);

  for (const e of state.enemies) {
    e.phase += e.zigzag;
    e.x += Math.sin(e.phase) * (e.type === "brute" ? 1.4 : 2.2);
    e.y += e.speed;
  }

  for (const b of state.bullets) {
    for (const e of state.enemies) {
      if (Math.abs(b.x - e.x) < e.r && Math.abs(b.y - e.y) < e.r) {
        e.hp -= b.damage;
        b.life = 0;
        spawnHitParticles(b.x, b.y, e.tint);
        state.flash = 0.18;
        if (e.hp <= 0) {
          e.dead = true;
          state.kills += e.type === "brute" ? 3 : 1;
          state.cameraShake = 6;
          spawnHitParticles(e.x, e.y, "#ffe69c");
        }
      }
    }
  }

  state.enemies = state.enemies.filter((e) => !e.dead && e.y < HEIGHT + 80);

  for (const e of state.enemies) {
    const dx = e.x - state.x;
    const dy = e.y - PLAYER_Y;
    if (Math.hypot(dx, dy) < e.r + 28) {
      state.hp -= e.type === "brute" ? 28 : 18;
      e.dead = true;
      state.cameraShake = 9;
      state.flash = 0.35;
      spawnHitParticles(state.x, PLAYER_Y, "#ff9b97");
    }
  }

  for (const p of state.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= 1;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  if (state.hp <= 0) {
    setMode("gameover");
    ui.summary.textContent = `SECTOR ${String(state.sector).padStart(2, "0")} / DIST ${Math.floor(state.distance)}m / KILLS ${state.kills}`;
    refreshLeaderboard();
    return;
  }

  if (state.distance >= state.nextChoiceAt) {
    state.enemies = [];
    setMode("choice");
  }
}

function drawBackground() {
  const shakeX = rand(-state.cameraShake, state.cameraShake);
  const shakeY = rand(-state.cameraShake, state.cameraShake);
  ctx.save();
  ctx.translate(shakeX, shakeY);

  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#121a35");
  sky.addColorStop(0.55, "#11172f");
  sky.addColorStop(1, "#1c1022");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let i = 0; i < 70; i += 1) {
    const y = ((i * 60 + state.gridOffset) % (HEIGHT + 120)) - 60;
    const alpha = 0.03 + (i % 7) * 0.007;
    ctx.strokeStyle = `rgba(120, 180, 255, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  for (let x = 0; x <= WIDTH; x += 80) {
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.beginPath();
    ctx.moveTo(x, HEIGHT);
    ctx.lineTo(WIDTH / 2 + (x - WIDTH / 2) * 0.18, HEIGHT * 0.42);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPlayer() {
  const px = state.x;
  const py = PLAYER_Y;

  const aura = ctx.createRadialGradient(px, py + 12, 14, px, py + 12, 55);
  aura.addColorStop(0, "rgba(43,226,184,0.32)");
  aura.addColorStop(1, "rgba(43,226,184,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(px - 80, py - 70, 160, 160);

  for (let i = 0; i < state.squadSize; i += 1) {
    const x = px + (i - (state.squadSize - 1) / 2) * 24;
    ctx.fillStyle = "#d7ebff";
    ctx.fillRect(x - 7, py - 18, 14, 19);
    ctx.fillStyle = "#62f7cc";
    ctx.fillRect(x - 5, py - 22, 10, 4);
    ctx.fillStyle = "#ffad6e";
    ctx.fillRect(x - 2, py - 12, 4, 11);
  }

  const hpW = 170;
  const hpX = px - hpW / 2;
  const hpY = py + 36;
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(hpX, hpY, hpW, 10);
  const hpPct = clamp(state.hp / 100, 0, 1);
  ctx.fillStyle = hpPct > 0.3 ? "#2be2b8" : "#ff7a66";
  ctx.fillRect(hpX, hpY, hpW * hpPct, 10);
}

function drawEnemies() {
  for (const e of state.enemies) {
    ctx.fillStyle = e.type === "brute" ? "#4be5be" : "#ff866f";
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1e2438";
    ctx.fillRect(e.x - e.r * 0.7, e.y - 3, e.r * 1.4, 6);
    ctx.fillRect(e.x - 3, e.y - e.r * 0.55, 6, e.r * 1.1);

    const hpRatio = clamp(e.hp / (e.type === "brute" ? 65 + state.enemyHPBoost : 30 + state.enemyHPBoost), 0, 1);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 4);
    ctx.fillStyle = "#ffe08c";
    ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2 * hpRatio, 4);
  }
}

function drawBullets() {
  for (const b of state.bullets) {
    ctx.fillStyle = "#ffe7a2";
    ctx.fillRect(b.x - 2, b.y - 8, 4, 12);
    ctx.fillStyle = "rgba(255, 198, 112, 0.45)";
    ctx.fillRect(b.x - 4, b.y - 16, 8, 10);
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.fillStyle = p.tint;
    ctx.globalAlpha = Math.max(0, p.life / 44);
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.globalAlpha = 1;
  }
}

function drawFlash() {
  if (state.flash <= 0) return;
  ctx.fillStyle = `rgba(255, 241, 205, ${state.flash})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function draw() {
  drawBackground();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawFlash();
}

function syncHUD() {
  ui.sector.textContent = String(state.sector).padStart(2, "0");
  ui.distance.textContent = `${String(Math.floor(state.distance)).padStart(4, "0")} m`;
  ui.kills.textContent = String(state.kills).padStart(3, "0");
  ui.weapon.textContent = `Lv.${state.weaponLevel}`;
  ui.squad.textContent = `x${state.squadSize}`;
}

async function refreshLeaderboard() {
  try {
    const res = await fetch("/api/leaderboard");
    if (!res.ok) throw new Error("fail");
    const rows = await res.json();
    ui.leaderboardList.innerHTML = rows
      .map(
        (r) =>
          `<li><strong>${r.name}</strong> - ${r.distance}m / ${r.kills} kills / W${r.weaponLevel} / S${r.squadSize}</li>`,
      )
      .join("");
  } catch {
    ui.leaderboardList.innerHTML = "<li>서버 연결 실패</li>";
  }
}

async function saveScore() {
  if (state.savedOnce) return;
  const payload = {
    name: ui.playerName.value.trim() || "Runner",
    distance: Math.floor(state.distance),
    kills: state.kills,
    weaponLevel: state.weaponLevel,
    squadSize: state.squadSize,
    sector: state.sector,
  };

  try {
    const res = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("save fail");
    state.savedOnce = true;
    await refreshLeaderboard();
  } catch {
    ui.leaderboardList.innerHTML = "<li>점수 저장 실패</li>";
  }
}

function loop(time) {
  update(time);
  draw();
  syncHUD();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
  if (e.code === "Space") {
    e.preventDefault();
    if (state.mode === "title" || state.mode === "gameover") resetGame();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
});

ui.startBtn.addEventListener("click", resetGame);
ui.restartBtn.addEventListener("click", resetGame);
ui.weaponChoice.addEventListener("click", () => chooseUpgrade("weapon"));
ui.squadChoice.addEventListener("click", () => chooseUpgrade("squad"));
ui.saveScoreBtn.addEventListener("click", saveScore);

refreshLeaderboard();
requestAnimationFrame(loop);
