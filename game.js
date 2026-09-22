import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b20);
scene.fog = new THREE.Fog(0x090b20, 18, 58);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0x9fa8ff, 0x20142d, 2.2);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xffe7b0, 3);
moon.position.set(-8, 16, 8);
moon.castShadow = true;
scene.add(moon);

const mat = (color, emissive = 0) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.8,
  metalness: 0.12,
  emissive,
  emissiveIntensity: emissive ? 1.4 : 0,
});

const floor = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 0.4, 64), mat(0x15183b));
floor.position.y = -0.35;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(50, 25, 0x363b70, 0x20244b);
grid.position.y = -0.13;
scene.add(grid);

for (let i = 0; i < 18; i++) {
  const a = (i / 18) * Math.PI * 2;
  const r = 18 + Math.random() * 7;
  const h = 1 + Math.random() * 3;
  const rock = new THREE.Mesh(new THREE.BoxGeometry(2.3, h, 2.3), mat(i % 2 ? 0x252650 : 0x332442));
  rock.position.set(Math.cos(a) * r, h / 2 - 0.1, Math.sin(a) * r);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
}

const player = new THREE.Group();
player.position.set(0, 0.5, 0);
scene.add(player);

const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.2, 12), mat(0xd24b3e));
body.position.y = 0.55;
body.castShadow = true;
player.add(body);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 12), mat(0xffc28d));
head.position.y = 1.35;
head.castShadow = true;
player.add(head);

const playerDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.38, 16), mat(0xffcf57));
playerDrum.rotation.z = Math.PI / 2;
playerDrum.position.set(0.35, 0.8, 0);
player.add(playerDrum);

const playerStick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8), mat(0xf6e0af));
playerStick.rotation.z = -0.7;
playerStick.position.set(0.85, 1.05, 0.15);
player.add(playerStick);

const weapon = new THREE.Group();
const weaponDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.2, 16), mat(0xffcf57));
weaponDrum.rotation.z = Math.PI / 2;
weaponDrum.position.set(0.42, -0.28, -0.7);
weapon.add(weaponDrum);

const weaponStick = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.95, 8), mat(0xf6e0af));
weaponStick.position.set(0.62, -0.05, -0.72);
weaponStick.rotation.z = -0.65;
weapon.add(weaponStick);

camera.add(weapon);
scene.add(camera);

function enemyMesh() {
  const g = new THREE.Group();
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), mat(0x5b3d83));
  bodyMesh.position.y = 0.75;
  bodyMesh.castShadow = true;
  g.add(bodyMesh);

  [-0.22, 0.22].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mat(0xff477e, 0xff477e));
    eye.position.set(x, 1.05, -0.5);
    g.add(eye);
  });

  return g;
}

let enemies = [];
let bowls = [];
let bullets = [];
let running = false;
let choosing = false;
let hp = 100;
let maxHp = 100;
let damage = 1;
let moveSpeed = 5;
let xp = 0;
let level = 1;
let score = 0;
let wave = 1;
let spawnTimer = 0;
let attackTimer = 0;
let swingTime = 0;
let rangedCooldown = 0;
let dashCooldown = 0;
let shake = 0;
const keys = {};
let yaw = 0;
let pitch = 0;
let mouseLocked = false;

const savedMeta = JSON.parse(localStorage.getItem('tungTungMeta') || '{"damage":0,"speed":0,"health":0,"dash":0}');
const upgrades = [
  { name: 'IRON DRUM', text: '+1 permanent bonk damage', apply: () => { savedMeta.damage += 1; damage += 1; } },
  { name: 'QUICK FEET', text: '+8% permanent movement speed', apply: () => { savedMeta.speed += 1; moveSpeed *= 1.08; } },
  { name: 'BIG HEART', text: '+15 permanent maximum heart', apply: () => { savedMeta.health += 1; maxHp += 15; hp += 15; } },
  { name: 'SECOND WIND', text: 'Unlock a stronger dash', apply: () => { savedMeta.dash += 7; } },
];

function applyMeta() {
  damage = 1 + savedMeta.damage;
  moveSpeed = 5 * (1 + savedMeta.speed * 0.08);
  maxHp = 100 + savedMeta.health * 15;
  hp = maxHp;
}

function saveMeta() {
  localStorage.setItem('tungTungMeta', JSON.stringify(savedMeta));
}

function updateHud() {
  $('health').style.width = Math.max(0, (hp / maxHp) * 100) + '%';
  $('heart').textContent = `${Math.ceil(hp)} / ${maxHp}`;
  $('xp').style.width = `${Math.min(100, xp)}%`;
  $('power').textContent = `${xp} / 100`;
  $('level').textContent = `LEVEL ${level}`;
  $('wave').textContent = `WAVE ${wave}`;
  $('score').textContent = `SCORE ${score}`;
}

function destroyEnemy(enemy) {
  const index = enemies.indexOf(enemy);
  if (index >= 0) enemies.splice(index, 1);
  scene.remove(enemy);
  score += 110 + wave * 12;
  gainXp(22);
  $('message').textContent = 'Enemy dropped! Keep the rhythm.';
}

function spawnEnemy() {
  const enemy = enemyMesh();
  const angle = Math.random() * Math.PI * 2;
  const radius = 12 + Math.random() * 6;
  enemy.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  enemy.userData = {
    hp: 2 + Math.floor((wave + level) / 2),
    maxHp: 2 + Math.floor((wave + level) / 2),
    speed: 1.4 + wave * 0.11 + level * 0.04,
  };
  scene.add(enemy);
  enemies.push(enemy);
}

function spawnBowl() {
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), mat(0xffd166, 0xff9f1c));
  bowl.position.set((Math.random() - 0.5) * 15, 0.5, (Math.random() - 0.5) * 15);
  bowl.userData = { bob: Math.random() * Math.PI * 2 };
  scene.add(bowl);
  bowls.push(bowl);
}

function showUpgrade() {
  choosing = true;
  $('upgrade').classList.remove('hidden');
  const box = $('upgradeChoices');
  box.replaceChildren();

  [...upgrades]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .forEach((upgrade) => {
      const button = document.createElement('button');
      button.className = 'choice';
      button.innerHTML = `<strong>${upgrade.name}</strong><span>${upgrade.text}</span>`;
      button.onclick = () => {
        upgrade.apply();
        saveMeta();
        choosing = false;
        $('upgrade').classList.add('hidden');
        $('message').textContent = `${upgrade.name} unlocked forever!`;
        updateHud();
      };
      box.appendChild(button);
    });
}

function gainXp(amount) {
  xp += amount;
  while (xp >= 100) {
    xp -= 100;
    level += 1;
    wave = Math.max(wave, 1 + Math.floor(level / 2));
    $('message').textContent = `Level ${level}! The beat grows louder.`;
    showUpgrade();
  }
}

function createProjectile(origin, direction, damageValue, speed = 19) {
  const projectile = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xff9f1c,
      emissiveIntensity: 1.8,
    }),
  );
  projectile.position.copy(origin);
  projectile.userData = {
    velocity: direction.clone().normalize().multiplyScalar(speed),
    life: 1.6,
    damage: damageValue,
  };
  scene.add(projectile);
  bullets.push(projectile);
}

function attack() {
  if (!running || choosing || attackTimer > 0) return;

  attackTimer = 0.42;
  swingTime = 0;
  weapon.visible = true;

  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  let hit = false;

  enemies.slice().forEach((enemy) => {
    const offset = enemy.position.clone().sub(player.position);
    const dist = offset.length();
    if (dist < 3.4 && forward.dot(offset.normalize()) > 0.05) {
      enemy.userData.hp -= damage;
      hit = true;
      shake = 0.12;
      if (enemy.userData.hp <= 0) {
        destroyEnemy(enemy);
      }
    }
  });

  if (hit) {
    $('message').textContent = 'BONK!';
  }

  updateHud();
}

function ranged() {
  if (!running || choosing || rangedCooldown > 0) return;

  rangedCooldown = 0.38;
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  const origin = player.position.clone().add(new THREE.Vector3(0, 1.3, 0)).add(forward.clone().multiplyScalar(1.2));
  const shotCount = 1 + (savedMeta.dash > 0 ? 1 : 0);

  for (let i = 0; i < shotCount; i++) {
    const spread = shotCount === 1 ? 0 : (i - 0.5) * 0.12;
    const shotDir = new THREE.Vector3(-Math.sin(yaw + spread), 0, -Math.cos(yaw + spread));
    createProjectile(origin, shotDir, 1 + Math.floor(level / 3), 18 + savedMeta.damage * 2);
  }

  $('message').textContent = 'Drum shot!';
}

function finish(win) {
  running = false;
  document.exitPointerLock?.();
  $('hud').classList.add('hidden');
  $('gameover').classList.remove('hidden');
  $('result').textContent = win ? 'SAHUR SAVED!' : 'THE DRUM WENT QUIET';
  $('summary').textContent = win
    ? `You reached level ${level}, wave ${wave}, and scored ${score}. Permanent unlocks are safe.`
    : `The swarm got through at level ${level}. Your permanent unlocks are safe. Score: ${score}.`;
}

function reset() {
  enemies.forEach((enemy) => scene.remove(enemy));
  bowls.forEach((bowl) => scene.remove(bowl));
  bullets.forEach((bullet) => scene.remove(bullet));
  enemies = [];
  bowls = [];
  bullets = [];

  hp = 100;
  xp = 0;
  level = 1;
  score = 0;
  wave = 1;
  spawnTimer = 0.8;
  attackTimer = 0;
  rangedCooldown = 0;
  dashCooldown = 0;
  shake = 0;
  player.position.set(0, 0.5, 0);
  yaw = 0;
  pitch = 0;

  applyMeta();
  running = true;
  choosing = false;
  $('start').classList.add('hidden');
  $('gameover').classList.add('hidden');
  $('upgrade').classList.add('hidden');
  $('hud').classList.remove('hidden');
  weapon.visible = true;

  for (let i = 0; i < 4; i++) spawnEnemy();
  for (let i = 0; i < 2; i++) spawnBowl();

  $('message').textContent = 'Protect the last sahur!';
  updateHud();
  renderer.domElement.requestPointerLock();
}

function move(dt) {
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const left = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
  const dir = new THREE.Vector3();

  if (keys.w) dir.add(forward);
  if (keys.s) dir.sub(forward);
  if (keys.a) dir.add(left);
  if (keys.d) dir.sub(left);

  if (dir.lengthSq() > 0) {
    dir.normalize();
    player.position.addScaledVector(dir, moveSpeed * dt);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -17, 17);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -17, 17);
  }

  if (keys.shift && !keys.shiftUsed && dashCooldown <= 0 && dir.lengthSq() > 0) {
    keys.shiftUsed = true;
    const burst = dir.clone().normalize().multiplyScalar(4.5 + savedMeta.dash * 1.1);
    player.position.add(burst);
    dashCooldown = Math.max(0.65, 1.2 - savedMeta.dash * 0.06);
    shake = 0.18;
  }

  if (!keys.shift) keys.shiftUsed = false;
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.position.addScaledVector(bullet.userData.velocity, dt);
    bullet.userData.life -= dt;
    bullet.rotation.x += dt * 18;

    let hit = false;

    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (bullet.position.distanceTo(enemy.position) < 1.1) {
        enemy.userData.hp -= bullet.userData.damage;
        if (enemy.userData.hp <= 0) {
          destroyEnemy(enemy);
        }
        hit = true;
        break;
      }
    }

    if (hit || bullet.userData.life <= 0 || bullet.position.length() > 30) {
      scene.remove(bullet);
      bullets.splice(i, 1);
    }
  }
}

document.addEventListener('pointerlockchange', () => {
  mouseLocked = document.pointerLockElement === renderer.domElement;
});

document.addEventListener('mousemove', (event) => {
  if (!mouseLocked) return;
  yaw -= event.movementX * 0.0022;
  pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.0018, -1.2, 1.2);
});

renderer.domElement.addEventListener('click', () => {
  if (!mouseLocked) {
    renderer.domElement.requestPointerLock();
    return;
  }
  if (running && !choosing) attack();
});

addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;

  if (event.code === 'Space') attack();
  if (key === 'f' || key === 'q' || key === 'e') ranged();
});

addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = false;
  if (key === 'shift') keys.shiftUsed = false;
});

addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (running && !choosing) ranged();
});

$('startButton').onclick = reset;
$('again').onclick = reset;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let last = performance.now();

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  dashCooldown -= dt;
  rangedCooldown -= dt;
  if (shake > 0) shake = Math.max(0, shake - dt * 1.8);

  if (running && !choosing) {
    move(dt);
    attackTimer -= dt;
    spawnTimer -= dt;
    wave = Math.max(1, 1 + Math.floor(score / 450) + Math.floor(level / 2));

    if (spawnTimer <= 0) {
      spawnTimer = Math.max(1.4, 4.8 - wave * 0.28);
      spawnEnemy();
    }

    if (Math.random() < dt * 0.05) spawnBowl();

    enemies.forEach((enemy) => {
      const v = player.position.clone().sub(enemy.position);
      v.y = 0;
      const distance = v.length();

      if (distance > 1.3) {
        enemy.position.addScaledVector(v.normalize(), enemy.userData.speed * dt);
        enemy.rotation.y = Math.atan2(-v.x, -v.z);
      } else {
        hp -= 12 * dt;
        if (hp <= 0) {
          finish(false);
        }
      }
    });

    bowls.slice().forEach((bowl) => {
      bowl.rotation.y += dt * 2;
      bowl.position.y = 0.5 + Math.sin((now + bowl.userData.bob * 1000) / 260) * 0.15;

      if (bowl.position.distanceTo(player.position) < 1.2) {
        hp = Math.min(maxHp, hp + 18);
        score += 25;
        scene.remove(bowl);
        bowls = bowls.filter((item) => item !== bowl);
        $('message').textContent = 'Sahur acquired! +HEART';
      }
    });

    updateBullets(dt);
  }

  if (attackTimer > 0) {
    swingTime += dt;
    const t = Math.min(swingTime / 0.42, 1);
    const swing = Math.sin(t * Math.PI);
    weaponStick.rotation.x = -0.65 - swing * 2.3;
    weaponStick.rotation.z = -0.65 + swing * 0.55;
    weapon.position.z = -0.7 + swing * 0.18;

    if (t >= 1) {
      weaponStick.rotation.x = -0.65;
      attackTimer = 0;
      weapon.position.z = -0.7;
    }
  }

  player.rotation.y = yaw + Math.PI;
  const shakeOffset = shake > 0 ? (Math.random() - 0.5) * shake * 0.7 : 0;
  camera.position.set(
    player.position.x + shakeOffset,
    player.position.y + 1.65 + shakeOffset * 0.5,
    player.position.z + shakeOffset,
  );
  camera.rotation.set(pitch, yaw, 0, 'YXZ');

  updateHud();
  renderer.render(scene, camera);
}

requestAnimationFrame(loop);
