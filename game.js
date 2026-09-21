import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b20);
scene.fog = new THREE.Fog(0x090b20, 18, 58);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; $('game').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0x9fa8ff, 0x20142d, 2.2));
const moon = new THREE.DirectionalLight(0xffe7b0, 3); moon.position.set(-8, 16, 8); moon.castShadow = true; scene.add(moon);
const mat = (color, emissive = 0) => new THREE.MeshStandardMaterial({ color, roughness: .8, emissive, emissiveIntensity: emissive ? 1.4 : 0 });
const floor = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, .4, 64), mat(0x15183b)); floor.position.y = -.35; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(50, 25, 0x363b70, 0x20244b); grid.position.y = -.13; scene.add(grid);
for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, r = 18 + Math.random() * 7, h = 1 + Math.random() * 3; const b = new THREE.Mesh(new THREE.BoxGeometry(2.3, h, 2.3), mat(i % 2 ? 0x252650 : 0x332442)); b.position.set(Math.cos(a) * r, h / 2 - .1, Math.sin(a) * r); scene.add(b); }

const player = new THREE.Group(); player.position.set(0, .5, 0); scene.add(player);
const body = new THREE.Mesh(new THREE.CylinderGeometry(.55, .7, 1.2, 12), mat(0xd24b3e)); body.position.y = .55; body.castShadow = true; player.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(.58, 16, 12), mat(0xffc28d)); head.position.y = 1.35; head.castShadow = true; player.add(head);
const playerDrum = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, .38, 16), mat(0xffcf57)); playerDrum.rotation.z = Math.PI / 2; playerDrum.position.set(.35, .8, 0); player.add(playerDrum);
const playerStick = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.3, 8), mat(0xf6e0af)); playerStick.rotation.z = -.7; playerStick.position.set(.85, 1.05, .15); player.add(playerStick);

// The weapon is parented to the camera, so its attack is visible in first person.
const weapon = new THREE.Group();
const weaponDrum = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .2, 16), mat(0xffcf57)); weaponDrum.rotation.z = Math.PI / 2; weaponDrum.position.set(.42, -.28, -.7); weapon.add(weaponDrum);
const weaponStick = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .95, 8), mat(0xf6e0af)); weaponStick.position.set(.62, -.05, -.72); weaponStick.rotation.z = -.65; weapon.add(weaponStick);
camera.add(weapon); scene.add(camera);
const bullet = new THREE.mesh(new THREE.SphereGeometry(.5,12,12)
function enemyMesh() { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), mat(0x5b3d83)); m.position.y = .75; m.castShadow = true; g.add(m); [-.22, .22].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 8), mat(0xff477e, 0xff477e)); e.position.set(x, 1.05, -.5); g.add(e); }); return g; }

let enemies = [], bowls = [], bullets = [], running = false, choosing = false;
let hp = 100, maxHp = 100, damage = 1, moveSpeed = 5, xp = 0, level = 1, score = 0, wave = 1;
let spawnTimer = 0, attackTimer = 0, swingTime = 1, rangedcooldown = 0, dashCooldown = 0;
const keys = {};
let yaw = 0, pitch = 0, mouseLocked = false;

const savedMeta = JSON.parse(localStorage.getItem('tungTungMeta') || '{"damage":0,"speed":0,"health":0,"dash":0}');
const upgrades = [
  { name: 'IRON DRUM', text: '+1 permanent bonk damage', key: 'damage', apply: () => { savedMeta.damage++; damage++; } },
  { name: 'QUICK FEET', text: '+8% permanent movement speed', key: 'speed', apply: () => { savedMeta.speed++; moveSpeed *= 1.1; } },
  { name: 'BIG HEART', text: '+15 permanent maximum heart', key: 'health', apply: () => { savedMeta.health++; maxHp += 15; hp += 15; } },
  { name: 'SECOND WIND', text: 'Unlock a stronger dash', key: 'dash', apply: () => { savedMeta.dash+=7; } }
];
function applyMeta() { damage = 1 + savedMeta.damage; moveSpeed = 5 * (1 + savedMeta.speed * .08); maxHp = 100 + savedMeta.health * 15; hp = maxHp; }
function saveMeta() { localStorage.setItem('tungTungMeta', JSON.stringify(savedMeta)); }
function updateHud() { $('health').style.width = Math.max(0, hp / maxHp * 100) + '%'; $('heart').textContent = Math.ceil(hp) + ' / ' + maxHp; $('xp').style.width = xp + '%'; $('power').textContent = xp + ' / 100'; $('level').textContent = 'LEVEL ' + level; $('wave').textContent = 'WAVE ' + wave; $('score').textContent = 'SCORE ' + score; }
function spawnEnemy() { const e = enemyMesh(), a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 5; e.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); e.userData = { hp: 2 + Math.floor(wave / 3), speed: 1.5 + wave * .08 }; scene.add(e); enemies.push(e); }
function spawnBowl() { const b = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 8), mat(0xffd166, 0xff9f1c)); b.position.set((Math.random() - .5) * 15, .5, (Math.random() - .5) * 15); scene.add(b); bowls.push(b); }
function showUpgrade() { choosing = true; $('upgrade').classList.remove('hidden'); const box = $('upgradeChoices'); box.replaceChildren(); [...upgrades].sort(() => Math.random() - .5).slice(0, 3).forEach(upgrade => { const button = document.createElement('button'); button.className = 'choice'; button.innerHTML = `<strong>${upgrade.name}</strong><span>${upgrade.text}</span>`; button.onclick = () => { upgrade.apply(); saveMeta(); choosing = false; $('upgrade').classList.add('hidden'); $('message').textContent = upgrade.name + ' unlocked forever!'; updateHud(); }; box.appendChild(button); }); }
function gainXp(amount) { xp += amount; if (xp >= 100) { xp -= 100; level++; showUpgrade(); } }

function attack() {
  if (!running || choosing || attackTimer > 0) return;
  attackTimer = .42; swingTime = 0; weapon.visible = true;
  // Camera forward is local -Z. At yaw 0, forward is world -Z.
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  enemies.slice().forEach(e => { const offset = e.position.clone().sub(player.position); const dist = offset.length(); if (dist < 3.5 && forward.dot(offset.normalize()) > .05) { e.userData.hp -= damage; if (e.userData.hp <= 0) { scene.remove(e); enemies = enemies.filter(x => x !== e); score += 100 + wave * 10; gainXp(22); } } });
  updateHud();
}
function ranged(){
  if (!running || choosing || attackTimer > 0) return;
  rangedcooldown = .5; 
  


}
function finish(win) { running = false; document.exitPointerLock?.(); $('hud').classList.add('hidden'); $('gameover').classList.remove('hidden'); $('result').textContent = win ? 'SAHUR SAVED!' : 'THE DRUM WENT QUIET'; $('summary').textContent = win ? `You reached level ${level}, wave ${wave}, and scored ${score}. Permanent unlocks are safe.` : `The swarm got through at level ${level}. Your permanent unlocks are safe. Score: ${score}.`; }
function reset() { enemies.forEach(e => scene.remove(e)); bowls.forEach(b => scene.remove(b)); enemies = []; bowls = []; hp = 100; xp = 0; level = 1; score = 0; wave = 1; spawnTimer = 0; attackTimer = 0; dashCooldown = 0; player.position.set(0, .5, 0); yaw = 0; pitch = 0; applyMeta(); running = true; choosing = false; $('start').classList.add('hidden'); $('gameover').classList.add('hidden'); $('upgrade').classList.add('hidden'); $('hud').classList.remove('hidden'); weapon.visible = true; for (let i = 0; i < 4; i++) spawnEnemy(); for (let i = 0; i < 2; i++) spawnBowl(); $('message').textContent = 'Protect the last sahur!'; updateHud(); renderer.domElement.requestPointerLock(); }

function move(dt) {
  // Correct FPS basis: W is camera forward (-Z at yaw 0), A is camera left.
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const left = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
  const dir = new THREE.Vector3();
  if (keys.w) dir.add(forward); if (keys.s) dir.sub(forward); if (keys.a) dir.add(left); if (keys.d) dir.sub(left);
  if (dir.lengthSq()) { dir.normalize(); player.position.addScaledVector(dir, moveSpeed * dt); player.position.x = THREE.MathUtils.clamp(player.position.x, -17, 17); player.position.z = THREE.MathUtils.clamp(player.position.z, -17, 17); }
  // Dash is a burst on key press, not a faster sustained sprint.
  if (keys.shift && !keys.shiftUsed && dashCooldown <= 0 && dir.lengthSq()) { keys.shiftUsed = true; const burst = dir.clone().normalize().multiplyScalar(4.5 + savedMeta.dash * 1.5); player.position.add(burst); dashCooldown = Math.max(.07, .08 - savedMeta.dash * .05); }
  if (!keys.shift) keys.shiftUsed = false;
}

document.addEventListener('pointerlockchange', () => { mouseLocked = document.pointerLockElement === renderer.domElement; });
document.addEventListener('mousemove', e => { if (!mouseLocked) return; yaw -= e.movementX * .0022; pitch = THREE.MathUtils.clamp(pitch - e.movementY * .0018, -1.2, 1.2); });
renderer.domElement.addEventListener('click', () => { if (!mouseLocked) renderer.domElement.requestPointerLock(); else attack(); });
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.code === 'Space') attack(); });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; if (e.key.toLowerCase() === 'shift') keys.shiftUsed = false; });
$('startButton').onclick = reset; $('again').onclick = reset;
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop); const dt = Math.min((now - last) / 1000, .05); last = now; dashCooldown -= dt;
  if (running && !choosing) {
    move(dt); attackTimer -= dt; spawnTimer -= dt;
    if (spawnTimer < 0) { spawnTimer = Math.max(2.5, 6 - wave * .3); spawnEnemy(); }
    if (Math.random() < dt * .035) spawnBowl();
    enemies.forEach(e => { const v = player.position.clone().sub(e.position); v.y = 0; if (v.length() > 1.4) { e.position.addScaledVector(v.normalize(), e.userData.speed * dt); e.rotation.y = Math.atan2(-v.x, -v.z); } else { hp -= 12 * dt; if (hp <= 0) finish(false); } });
    bowls.slice().forEach(b => { b.rotation.y += dt * 2; b.position.y = .5 + Math.sin(now / 250) * .15; if (b.position.distanceTo(player.position) < 1.3) { hp = Math.min(maxHp, hp + 18); score += 25; scene.remove(b); bowls = bowls.filter(x => x !== b); $('message').textContent = 'Sahur acquired! +HEART'; } });
  }
  if (attackTimer > 0) { swingTime += dt; const t = Math.min(swingTime / .42, 1), swing = Math.sin(t * Math.PI); weaponStick.rotation.x = -.65 - swing * 2.3; weaponStick.rotation.z = -.65 + swing * .55; weapon.position.z = -.7 + swing * .18; if (t >= 1) { weaponStick.rotation.x = -.65; attackTimer = 0; } }
  // The visible world model faces the same direction as the camera.
  player.rotation.y = yaw + Math.PI;
  camera.position.set(player.position.x, player.position.y + 1.65, player.position.z); camera.rotation.set(pitch, yaw, 0, 'YXZ');
  updateHud(); renderer.render(scene, camera);
}
requestAnimationFrame(loop);
