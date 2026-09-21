import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b20);
scene.fog = new THREE.Fog(0x090b20, 18, 58);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 1.7, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.getElementById('game').appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x9fa8ff, 0x20142d, 2.2));

const moon = new THREE.DirectionalLight(0xffe7b0, 3);
moon.position.set(-8, 16, 8);
moon.castShadow = true;
scene.add(moon);

const mat = (color, emissive = 0) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    emissive,
    emissiveIntensity: emissive ? 1.4 : 0
  });

const floor = new THREE.Mesh(
  new THREE.CylinderGeometry(25, 25, 0.4, 64),
  mat(0x15183b)
);
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
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, h, 2.3),
    mat(i % 2 ? 0x252650 : 0x332442)
  );
  b.position.set(Math.cos(a) * r, h / 2 - 0.1, Math.sin(a) * r);
  scene.add(b);
}

const player = new THREE.Group();
player.position.set(0, 0.5, 0);
scene.add(player);

const body = new THREE.Mesh(
  new THREE.CylinderGeometry(0.55, 0.7, 1.2, 12),
  mat(0xd24b3e)
);
body.position.y = 0.55;
body.castShadow = true;
player.add(body);

const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.58, 16, 12),
  mat(0xffc28d)
);
head.position.y = 1.35;
head.castShadow = true;
player.add(head);

const drum = new THREE.Mesh(
  new THREE.CylinderGeometry(0.7, 0.7, 0.38, 16),
  mat(0xffcf57)
);
drum.rotation.z = Math.PI / 2;
drum.position.set(0.35, 0.8, 0);
player.add(drum);

const stick = new THREE.Mesh(
  new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8),
  mat(0xf6e0af)
);
stick.rotation.z = -0.7;
stick.position.set(0.85, 1.05, 0.15);
player.add(stick);

function enemyMesh() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1.5, 1),
    mat(0x5b3d83)
  );
  m.position.y = 0.75;
  m.castShadow = true;
  g.add(m);

  [-0.22, 0.22].forEach((x) => {
    const e = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      mat(0xff477e, 0xff477e)
    );
    e.position.set(x, 1.05, -0.5);
    g.add(e);
  });

  return g;
}

let enemies = [];
let bowls = [];
let running = false;
let hp = 100;
let power = 0;
let score = 0;
let wave = 1;
let spawnTimer = 0;
let attackTimer = 0;
const keys = {};

const $ = (id) => document.getElementById(id);

let yaw = 0;
let pitch = 0;
let mouseLocked = false;

function setPointerLock() {
  renderer.domElement.requestPointerLock();
}

document.addEventListener('pointerlockchange', () => {
  mouseLocked = document.pointerLockElement === renderer.domElement;
});

document.addEventListener('mousemove', (e) => {
  if (!mouseLocked) return;
  yaw -= e.movementX * 0.0022;
  pitch -= e.movementY * 0.0018;
  pitch = THREE.MathUtils.clamp(pitch, -1.2, 1.2);
});

renderer.domElement.addEventListener('click', () => {
  if (!mouseLocked) setPointerLock();
  if (running) attack();
});

function spawnEnemy() {
  const e = enemyMesh();
  const a = Math.random() * Math.PI * 2;
  const r = 12 + Math.random() * 5;
  e.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  e.userData = { hp: 2, speed: 1.5 + wave * 0.08 };
  scene.add(e);
  enemies.push(e);
}

function spawnBowl() {
  const b = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 8),
    mat(0xffd166, 0xff9f1c)
  );
  b.position.set((Math.random() - 0.5) * 15, 0.5, (Math.random() - 0.5) * 15);
  scene.add(b);
  bowls.push(b);
}

function updateHud() {
  $('health').style.width = Math.max(0, hp) + '%';
  $('heart').textContent = Math.ceil(hp) + ' / 100';
  $('xp').style.width = power * 20 + '%';
  $('power').textContent = power + ' / 5';
  $('wave').textContent = 'WAVE ' + wave;
  $('score').textContent = 'SCORE ' + score;
}

function attack() {
  if (!running || attackTimer > 0) return;

  attackTimer = 0.35;
  stick.rotation.x = -1.3;
  setTimeout(() => (stick.rotation.x = 0), 130);

  enemies.slice().forEach((e) => {
    const dist = e.position.distanceTo(player.position);
    const dirToEnemy = e.position.clone().sub(player.position).normalize();
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();

    if (dist < 2.8 && forward.dot(dirToEnemy) > 0.15) {
      e.userData.hp -= 1;
      if (e.userData.hp <= 0) {
        scene.remove(e);
        enemies = enemies.filter((x) => x !== e);
        score += 100;
        if (++power >= 5) {
          power = 0;
          wave++;
          $('message').textContent = 'LEVEL UP! The beat gets louder.';
        }
      }
    }
  });

  updateHud();
}

function finish(win) {
  running = false;
  $('hud').classList.add('hidden');
  $('gameover').classList.remove('hidden');
  $('result').textContent = win ? 'SAHUR SAVED!' : 'THE DRUM WENT QUIET';
  $('summary').textContent = win
    ? `You survived ${wave} waves and earned ${score} points.`
    : `The swarm got through. Final score: ${score}.`;
}

function reset() {
  enemies.forEach((e) => scene.remove(e));
  bowls.forEach((b) => scene.remove(b));

  enemies = [];
  bowls = [];
  hp = 100;
  power = 0;
  score = 0;
  wave = 1;
  spawnTimer = 0;
  player.position.set(0, 0.5, 0);
  yaw = 0;
  pitch = 0;
  running = true;

  $('start').classList.add('hidden');
  $('gameover').classList.add('hidden');
  $('hud').classList.remove('hidden');

  for (let i = 0; i < 4; i++) spawnEnemy();
  for (let i = 0; i < 2; i++) spawnBowl();

  $('message').textContent = 'Protect the last sahur!';
  updateHud();
}

function move(dt) {
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);

  const moveDir = new THREE.Vector3();

  if (keys['w']) moveDir.add(forward);
  if (keys['s']) moveDir.sub(forward);
  if (keys['a']) moveDir.sub(right);
  if (keys['d']) moveDir.add(right);

  if (moveDir.lengthSq() > 0) {
    moveDir.normalize();
    const speed = keys.shift ? 9 : 5;
    player.position.addScaledVector(moveDir, speed * dt);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -17, 17);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -17, 17);
  }
}

addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  keys[key] = true;
  if (e.code === 'Space') attack();
});

addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  keys[key] = false;
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

  if (running) {
    move(dt);
    attackTimer -= dt;
    spawnTimer -= dt;

    if (spawnTimer < 0) {
      spawnTimer = Math.max(2.5, 6 - wave * 0.3);
      spawnEnemy();
    }

    if (Math.random() < dt * 0.035) spawnBowl();

    enemies.forEach((e) => {
      const v = player.position.clone().sub(e.position);
      v.y = 0;
      if (v.length() > 1.4) {
        e.position.addScaledVector(v.normalize(), e.userData.speed * dt);
      } else {
        hp -= 12 * dt;
        if (hp <= 0) finish(false);
      }
    });

    bowls.slice().forEach((b) => {
      b.rotation.y += dt * 2;
      b.position.y = 0.5 + Math.sin(now / 250) * 0.15;

      if (b.position.distanceTo(player.position) < 1.3) {
        hp = Math.min(100, hp + 18);
        score += 25;
        scene.remove(b);
        bowls = bowls.filter((x) => x !== b);
        $('message').textContent = 'Sahur acquired! +HEART';
      }
    });

    updateHud();
  }

  const cameraTarget = new THREE.Vector3(
    player.position.x + Math.sin(yaw) * 2,
    player.position.y + 1.7 + Math.sin(pitch) * 2,
    player.position.z + Math.cos(yaw) * 2
  );

  const cameraPos = new THREE.Vector3(
    player.position.x,
    player.position.y + 1.7,
    player.position.z
  );

  camera.position.copy(cameraPos);
  camera.lookAt(cameraTarget);

  renderer.render(scene, camera);
}

requestAnimationFrame(loop);
