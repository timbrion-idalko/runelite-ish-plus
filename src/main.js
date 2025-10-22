import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { makeRenderer, makeCamera, makeControls, resize, makeTerrain, groundHeightAt, addLighting, makeMinimap } from './engine.js';
import { spawnTree, spawnRock, spawnNPC, spawnSlime, raycastInteract, biomeAt } from './world.js';
import { DB, DB as Data, addXP, save, load } from './data.js';
import { renderUI, updateXPBar, addToInventory, progressQuest, renderToolbar, statsHTML, showCenterMessage, showCrafting, bindCraftingHandlers, updateHealthBar } from './ui.js';

console.log('main.js loaded'); // sanity log on deploy

let scene, camera, renderer, controls, clock, minimap;
let keys = {};
let canJump = true;
let enemies = [];
let lastAttack = 0;

window.GAME_DATA = Data;

function init() {
  renderer = makeRenderer();
  document.body.appendChild(renderer.domElement);
  camera = makeCamera();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  controls = makeControls(camera, renderer.domElement);
  document.getElementById('startBtn').onclick = startGame;
  resize(renderer, camera);
  clock = new THREE.Clock();

  const terrain = makeTerrain(640, 3);
  scene.add(terrain);
  addLighting(scene);

  let id = 0;
  for (let i=0;i<200;i++) {
    const x = -280 + Math.random()*560;
    const z = -280 + Math.random()*560;
    const biome = biomeAt(x,z);
    if (Math.random()<0.55) spawnTree(scene, x, z, id++, biome); else spawnRock(scene, x, z, id++, biome);
  }

  spawnNPC(scene, 0, 0, 'guide', 'Guide', [
    'Welcome to RuneLite-ish PLUS!',
    'Gather, craft, and try fighting slimes.',
    'Stronger gear needs higher skills.'
  ]);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(5,5, 0.6, 20),
    new THREE.MeshStandardMaterial({ color: 0x444444, metalness:0.2, roughness:0.8 })
  );
  hub.position.set(0, groundHeightAt(scene,0,0)+0.3, 0);
  hub.receiveShadow = true;
  scene.add(hub);

  for (let i=0;i<12;i++) {
    const x = -120 + Math.random()*240;
    const z = -120 + Math.random()*240;
    enemies.push(spawnSlime(scene, x, z, 'slime-'+i, 1+Math.floor(Math.random()*3)));
  }

  minimap = makeMinimap(renderer, scene, controls.getObject());

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('click', onClick);
  load(Data);
  renderUI();
  updateStatsPanel();
  animate();

  document.addEventListener('keydown', (e)=>{
    if (e.code==='KeyC') { showCrafting(); setTimeout(()=> bindCraftingHandlers(Data.recipes, (id,q)=>addToInventory(id,q, Data.items), addXP), 0); }
  });
}

function startGame() {
  document.getElementById('title').style.display = 'none';
  controls.lock();
}

function updateStatsPanel(){
  document.getElementById('stats').innerHTML = statsHTML();
}

function onKeyDown(e) {
  keys[e.code] = true;
  if (e.code === 'KeyI') renderUI();
  if (e.code === 'Digit1') { DB.player.hotbarIndex = 0; renderToolbar(); }
  if (e.code === 'Digit2') { DB.player.hotbarIndex = 1; renderToolbar(); }
  if (e.code === 'Digit3') { DB.player.hotbarIndex = 2; renderToolbar(); }
  if (e.code === 'Digit4') { DB.player.hotbarIndex = 3; renderToolbar(); }
  if (e.code === 'Digit5') { DB.player.hotbarIndex = 4; renderToolbar(); }
  if (e.code === 'KeyQ') { document.getElementById('questlog').classList.toggle('panel'); }
  if (e.code === 'Space' && canJump) {
    controls.getObject().velocityY = 6;
    canJump = false;
  }
  if (e.code === 'KeyE') interact();
}

function onKeyUp(e) { keys[e.code] = false; }

function attack(target) {
  const now = performance.now()/1000;
  if (now - lastAttack < 0.5) return;
  lastAttack = now;
  const weapon = DB.player.equipment.weapon || DB.player.inventory[DB.player.hotbarIndex];
  const pow = weapon?.power || 1;
  const ud = target.userData;
  ud.hp -= pow;
  showCenterMessage(`Hit for ${pow}! (${Math.max(0,ud.hp)}/${ud.maxhp})`);
  if (ud.hp<=0 && ud.alive) {
    ud.alive = false;
    target.visible = false;
    addXP(DB.player, 'combat', 8);
    updateXPBar('combat');
    progressQuest('slay', 'slime', 1);
    (ud.loot||[]).forEach(l => addToInventory(l.id, l.qty, {}));
    setTimeout(()=>{
      ud.hp = ud.maxhp; ud.alive = true; target.visible = true;
      target.position.y = groundHeightAt(scene, target.position.x, target.position.z) + target.geometry.parameters.radius || 1;
    }, ud.respawn*1000);
  }
  save(DB);
}

function interact() {
  const target = raycastInteract(camera, scene);
  if (!target) return;
  const ud = target.userData||{};
  if (ud.type === 'npc') {
    if (!DB.player.quests.active.find(q=>q.id==='first-steps') && !DB.player.quests.completed.find(q=>q.id==='first-steps')) {
      DB.player.quests.active.push({ ...Data.quests[0], goals: Data.quests[0].goals.map(g=>({...g})) });
      showCenterMessage('New Quest: First Steps');
    } else if (!DB.player.quests.active.find(q=>q.id==='apprentice-smith') && DB.player.quests.completed.find(q=>q.id==='first-steps')) {
      DB.player.quests.active.push({ ...Data.quests[1], goals: Data.quests[1].goals.map(g=>({...g})) });
      showCenterMessage('New Quest: Apprentice Smith');
    } else if (!DB.player.quests.active.find(q=>q.id==='slime-buster')) {
      DB.player.quests.active.push({ ...Data.quests[2], goals: Data.quests[2].goals.map(g=>({...g})) });
      showCenterMessage('New Quest: Slime Buster');
    } else {
      showCenterMessage('Good luck, adventurer!');
    }
    save(DB);
    return;
  }
  if (ud.type==='enemy') {
    attack(target);
    return;
  }
  if (!ud.resource) return;
  const now = performance.now()/1000;
  if (ud.resource.last && now - ud.resource.last < 1.0) return;
  ud.resource.last = now;

  const activeItem = DB.player.inventory[DB.player.hotbarIndex];
  const isTree = ud.type==='tree';
  const required = isTree ? 'axe' : 'pick';
  const skill = isTree ? 'woodcutting' : 'mining';
  if (!activeItem || !activeItem.id.includes(required)) {
    showCenterMessage(`You need a ${isTree?'hatchet':'pickaxe'} equipped.`);
    return;
  }
  ud.resource.hp -= activeItem.power;
  if (ud.resource.hp <= 0) {
    const drop = ud.resource.kind;
    addToInventory(drop, 1, Data.items);
    progressQuest('gather', drop, 1);
    addXP(DB.player, skill, 5);
    updateXPBar(skill);
    target.visible = false;
    setTimeout(()=>{ ud.resource.hp = isTree?3:4; target.visible = true; }, ud.resource.respawn*1000);
  } else {
    showCenterMessage(isTree? 'Chop...' : 'Mine...');
  }
  save(DB);
}

function onClick(e) {
  if (!controls.isLocked) return controls.lock();
  const target = raycastInteract(camera, scene);
  if (!target) return;
  const ud = target.userData||{};
  if (ud.type==='enemy') return attack(target);
  // otherwise treat as interact
  interact();
}

function physics(dt) {
  const speed = (keys.ShiftLeft||keys.ShiftRight) ? 10 : 6;
  const dir = new THREE.Vector3();
  const vel = new THREE.Vector3();

  const fw = Number(keys.KeyW) - Number(keys.KeyS);
  const rt = Number(keys.KeyD) - Number(keys.KeyA);
  dir.set(rt, 0, fw).normalize();
  if (fw||rt) {
    const vec = new THREE.Vector3();
    camera.getWorldDirection(vec);
    const angle = Math.atan2(vec.x, vec.z);
    vel.x = Math.sin(angle) * dir.z + Math.sin(angle+Math.PI/2)*dir.x;
    vel.z = Math.cos(angle) * dir.z + Math.cos(angle+Math.PI/2)*dir.x;
    controls.getObject().position.x += vel.x * speed * dt;
    controls.getObject().position.z += vel.z * speed * dt;
  }

  // gravity
  const obj = controls.getObject();
  obj.velocityY = (obj.velocityY || 0) - 20*dt;
  obj.position.y += obj.velocityY * dt;

  const ground = groundHeightAt(scene, obj.position.x, obj.position.z) + 1.7;
  if (obj.position.y < ground) {
    obj.position.y = ground;
    obj.velocityY = 0;
    canJump = true;
  }

  // stamina regen
  const p = DB.player;
  p.stamina = Math.min(100, p.stamina + ( (keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD) ? 4*dt : 8*dt));

  // enemy AI
  const playerPos = obj.position;
  enemies.forEach(en => {
    const ud = en.userData;
    if (!ud.alive) return;
    const dx = playerPos.x - en.position.x;
    const dz = playerPos.z - en.position.z;
    const d = Math.hypot(dx, dz);
    if (d < ud.aggro) {
      const nx = dx / (d||1);
      const nz = dz / (d||1);
      en.position.x += nx * ud.speed * dt;
      en.position.z += nz * ud.speed * dt;
      en.position.y = groundHeightAt(scene, en.position.x, en.position.z) + 0.8;
      // damage player if close
      if (d < 1.6) {
        const now = performance.now()/1000;
        if (!ud.lastHit || now - ud.lastHit > 1.0) {
          ud.lastHit = now;
          const dmg = Math.max(1, ud.dmg - (DB.player.equipment.head?.armor||0));
          DB.player.hp -= dmg;
          updateHealthBar();
          showCenterMessage(`Slime hit you for ${dmg}! (${DB.player.hp}/${DB.player.maxhp})`);
          if (DB.player.hp <= 0) {
            respawnPlayer();
          }
        }
      }
    } else {
      // idle bob
      en.position.y = groundHeightAt(scene, en.position.x, en.position.z) + 0.8 + Math.sin(performance.now()/400 + ud.id.length)*0.05;
    }
  });
}

function respawnPlayer(){
  DB.player.hp = DB.player.maxhp;
  controls.getObject().position.set(0, groundHeightAt(scene,0,0)+2, 0);
  showCenterMessage('You died. Respawning at hub.');
  save(DB);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  physics(dt);
  minimap.render();
  renderer.render(scene, camera);
  updateStatsPanel();
}

init();
