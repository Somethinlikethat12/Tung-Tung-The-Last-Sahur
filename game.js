import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b20);
scene.fog = new THREE.Fog(0x090b20, 18, 58);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 15, 15);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.querySelector('#game').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0x9fa8ff, 0x20142d, 2.2));
const moon = new THREE.DirectionalLight(0xffe7b0, 3); moon.position.set(-8, 16, 8); moon.castShadow = true; scene.add(moon);
const mat = (color, emissive = 0) => new THREE.MeshStandardMaterial({ color, roughness: .8, emissive, emissiveIntensity: emissive ? 1.4 : 0 });
const floor = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, .4, 64), mat(0x15183b)); floor.position.y = -.35; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(50, 25, 0x363b70, 0x20244b); grid.position.y = -.13; scene.add(grid);
for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, r = 18 + Math.random() * 7, h = 1 + Math.random() * 3; const b = new THREE.Mesh(new THREE.BoxGeometry(2.3, h, 2.3), mat(i % 2 ? 0x252650 : 0x332442)); b.position.set(Math.cos(a) * r, h / 2 - .1, Math.sin(a) * r); scene.add(b); }

const player = new THREE.Group(); player.position.y = .5; scene.add(player);
const body = new THREE.Mesh(new THREE.CylinderGeometry(.55, .7, 1.2, 12), mat(0xd24b3e)); body.position.y = .55; body.castShadow = true; player.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(.58, 16, 12), mat(0xffc28d)); head.position.y = 1.35; head.castShadow = true; player.add(head);
const drum = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, .38, 16), mat(0xffcf57)); drum.rotation.z = Math.PI / 2; drum.position.set(.35, .8, 0); player.add(drum);
const stick = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.3, 8), mat(0xf6e0af)); stick.rotation.z = -.7; stick.position.set(.85, 1.05, .15); player.add(stick);
function enemyMesh() { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), mat(0x5b3d83)); m.position.y = .75; m.castShadow = true; g.add(m); [-.22, .22].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 8), mat(0xff477e, 0xff477e)); e.position.set(x, 1.05, -.5); g.add(e); }); return g; }
let enemies = [], bowls = [], running = false, hp = 100, power = 0, score = 0, wave = 1, spawnTimer = 0, attackTimer = 0; const keys = {};
const $ = id => document.getElementById(id);
function spawnEnemy() { const e = enemyMesh(), a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 5; e.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); e.userData = { hp: 2, speed: 1.5 + wave * .08 }; scene.add(e); enemies.push(e); }
function spawnBowl() { const b = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 8), mat(0xffd166, 0xff9f1c)); b.position.set((Math.random() - .5) * 15, .5, (Math.random() - .5) * 15); scene.add(b); bowls.push(b); }
function updateHud() { $('health').style.width = Math.max(0, hp) + '%'; $('heart').textContent = Math.ceil(hp) + ' / 100'; $('xp').style.width = power * 20 + '%'; $('power').textContent = power + ' / 5'; $('wave').textContent = 'WAVE ' + wave; $('score').textContent = 'SCORE ' + score; }
function attack() { if (!running || attackTimer > 0) return; attackTimer = .35; stick.rotation.x = -1.3; setTimeout(() => stick.rotation.x = 0, 130); const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion); enemies.slice().forEach(e => { const d = e.position.distanceTo(player.position), to = e.position.clone().sub(player.position).normalize(); if (d < 2.8 && dir.dot(to) > .05 && --e.userData.hp <= 0) { scene.remove(e); enemies = enemies.filter(x => x !== e); score += 100; if (++power >= 5) { power = 0; wave++; $('message').textContent = 'LEVEL UP! The beat gets louder.'; } } }); updateHud(); }
function finish(win) { running = false; $('hud').classList.add('hidden'); $('gameover').classList.remove('hidden'); $('result').textContent = win ? 'SAHUR SAVED!' : 'THE DRUM WENT QUIET'; $('summary').textContent = win ? `You survived ${wave} waves and earned ${score} points.` : `The swarm got through. Final score: ${score}.`; }
function reset() { enemies.forEach(e => scene.remove(e)); bowls.forEach(b => scene.remove(b)); enemies = []; bowls = []; hp = 100; power = 0; score = 0; wave = 1; spawnTimer = 0; player.position.set(0, .5, 0); running = true; $('start').classList.add('hidden'); $('gameover').classList.add('hidden'); $('hud').classList.remove('hidden'); for (let i = 0; i < 4; i++) spawnEnemy(); for (let i = 0; i < 2; i++) spawnBowl(); $('message').textContent = 'Protect the last sahur!'; updateHud(); }
function move(dt) { const v = new THREE.Vector3((keys.d ? 1 : 0) - (keys.a ? 1 : 0), 0, (keys.s ? 1 : 0) - (keys.w ? 1 : 0)); if (v.length()) { v.normalize(); player.position.addScaledVector(v, (keys.shift ? 9 : 5) * dt); player.position.x = THREE.MathUtils.clamp(player.position.x, -17, 17); player.position.z = THREE.MathUtils.clamp(player.position.z, -17, 17); player.rotation.y = Math.atan2(v.x, v.z); } }
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.code === 'Space') attack(); }); addEventListener('keyup', e => keys[e.key.toLowerCase()] = false); renderer.domElement.addEventListener('pointerdown', attack); $('startButton').onclick = reset; $('again').onclick = reset;
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
let last = performance.now(); function loop(now) { requestAnimationFrame(loop); const dt = Math.min((now - last) / 1000, .05); last = now; if (running) { move(dt); attackTimer -= dt; spawnTimer -= dt; if (spawnTimer < 0) { spawnTimer = Math.max(2.5, 6 - wave * .3); spawnEnemy(); } if (Math.random() < dt * .035) spawnBowl(); enemies.forEach(e => { const v = player.position.clone().sub(e.position); v.y = 0; if (v.length() > 1.4) e.position.addScaledVector(v.normalize(), e.userData.speed * dt); else { hp -= 12 * dt; if (hp <= 0) finish(false); } }); bowls.slice().forEach(b => { b.rotation.y += dt * 2; b.position.y = .5 + Math.sin(now / 250) * .15; if (b.position.distanceTo(player.position) < 1.3) { hp = Math.min(100, hp + 18); score += 25; scene.remove(b); bowls = bowls.filter(x => x !== b); $('message').textContent = 'Sahur acquired! +HEART'; } }); updateHud(); } camera.lookAt(player.position.x, 0, player.position.z); renderer.render(scene, camera); } requestAnimationFrame(loop);
