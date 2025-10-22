import * as THREE from 'three';
import { makeRenderer, makeTerrain, addLighting, groundHeightAt, resize, makeSky } from './engine.js';
import { spawnTree, spawnRock, spawnNPC, spawnSlime, biomeAt } from './world.js';
import { DB, DB as Data, addXP, save, load } from './data.js';
import { initUI, renderUI, updateXPBar, addToInventory, progressQuest,
         renderToolbar, showCenterMessage, updateHealthBar } from './ui.js';

console.log('main.js loaded (stylized + tabs)');

let scene, camera, renderer, clock;
let player, moveTarget = null, moveSpeed = 8;
let raycaster, mouse = new THREE.Vector2();
let enemies = [];

function init() {
  renderer = makeRenderer();
  renderer.toneMappingExposure = 1.2;
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaad4ff);
  clock = new THREE.Clock();

  const terrain = makeTerrain(640, 3);
  scene.add(terrain);
  addLighting(scene);
  makeSky(scene);

  // Player model (visible avatar)
  const geom = new THREE.CapsuleGeometry(0.6, 1.0, 8, 12);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness:0.5, metalness:0.2 });
  player = new THREE.Mesh(geom, mat);
  player.castShadow = true;
  player.position.set(0, groundHeightAt(scene,0,0)+1, 0);
  scene.add(player);

  // Camera
  camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, 0.1, 2000);
  camera.position.set(0, 6, 10);
  resize(renderer, camera);

  // Populate world
  let id=0;
  for (let i=0;i<200;i++){
    const x=-280+Math.random()*560, z=-280+Math.random()*560, biome=biomeAt(x,z);
    (Math.random()<0.55 ? spawnTree : spawnRock)(scene,x,z,id++,biome);
  }
  spawnNPC(scene,0,0,'guide','Guide',[
    'Welcome to the stylized world!',
    'Click to move and click objects to interact.'
  ]);
  for (let i=0;i<8;i++){
    const x=-120+Math.random()*240, z=-120+Math.random()*240;
    enemies.push(spawnSlime(scene,x,z,'slime'+i,1+Math.floor(Math.random()*2)));
  }

  // Inputs
  raycaster = new THREE.Raycaster();
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('resize', ()=>resize(renderer,camera));

  // Start overlay hide
  document.getElementById('startBtn').onclick = ()=>{ document.getElementById('title').style.display='none'; };

  load(Data);
  initUI();
  renderUI();
  animate();
}

function onPointerDown(e){
  e.preventDefault();
  mouse.x = ( e.clientX / window.innerWidth ) * 2 - 1;
  mouse.y = - ( e.clientY / window.innerHeight ) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  if (!hits.length) return;
  const hit = hits.find(h=>h.object.visible); if (!hit) return;

  const obj = hit.object;
  const ud = obj.userData || {};
  if (ud.type==='tree' || ud.type==='rock' || ud.type==='npc' || ud.type==='enemy'){
    moveTarget = { point: hit.point, target: obj }; // move then interact
  } else {
    moveTarget = { point: hit.point, target: null };
  }
}

function movePlayer(dt){
  if (!moveTarget) return;
  const targetPos = moveTarget.point.clone();
  const p = player.position;
  const dx = targetPos.x - p.x, dz = targetPos.z - p.z;
  const dist = Math.hypot(dx, dz);

  if (dist < 0.8) {
    if (moveTarget.target) interact(moveTarget.target);
    moveTarget = null; return;
  }
  const step = Math.min(dist, moveSpeed * dt);
  p.x += (dx/dist) * step;
  p.z += (dz/dist) * step;
  p.y = groundHeightAt(scene, p.x, p.z) + 1;
  player.lookAt(targetPos.x, p.y, targetPos.z);
}

function updateCamera(){
  const desired = new THREE.Vector3(player.position.x, player.position.y+4, player.position.z+8);
  camera.position.lerp(desired, 0.1);
  camera.lookAt(player.position.x, player.position.y+1, player.position.z);
}

/* ---- Fixed interact: cooldown + respawn so nodes don't spam ---- */
function interact(obj){
  const ud = obj.userData||{};

  // NPC
  if(ud.type==='npc'){
    showCenterMessage('Talking to ' + (ud.name||'NPC'));
    if (!DB.player.quests.active.find(q=>q.id==='first-steps') &&
        !DB.player.quests.completed.find(q=>q.id==='first-steps')) {
      DB.player.quests.active.push({ ...Data.quests[0], goals: Data.quests[0].goals.map(g=>({...g})) });
      showCenterMessage('New Quest: First Steps');
      save(DB);
    }
    return;
  }

  // Enemy
  if(ud.type==='enemy'){ attack(obj); return; }

  // Resource
  if(!ud.resource) return;

  const now = performance.now()/1000;
  if (ud.resource.last && (now - ud.resource.last) < 1.0) return; // 1s swing cooldown
  ud.resource.last = now;

  const isTree = ud.type==='tree';
  const activeItem = DB.player.inventory[DB.player.hotbarIndex];
  const required = isTree ? 'axe' : 'pick';
  const skill = isTree ? 'woodcutting' : 'mining';
  if (!activeItem || !(activeItem.id||'').includes(required)) {
    showCenterMessage('Need a ' + (isTree?'hatchet':'pickaxe') + ' equipped.');
    return;
  }

  ud.resource.hp -= (activeItem.power || 1);

  if (ud.resource.hp <= 0){
    const drop = ud.resource.kind;
    addToInventory(drop, 1, Data.items);
    progressQuest('gather', drop, 1);
    addXP(DB.player, skill, 5);
    updateXPBar(skill);
    showCenterMessage('Collected ' + drop);

    // hide & respawn
    const respawn = ud.resource.respawn || 20;
    obj.visible = false;
    setTimeout(()=>{
      ud.resource.hp = isTree ? 3 : 4;
      obj.visible = true;
      ud.resource.last = 0;
    }, respawn*1000);
  } else {
    showCenterMessage(isTree?'Chop...':'Mine...');
  }
  save(DB);
}

function attack(enemy){
  const ud = enemy.userData;
  ud.hp -= 3;
  if (ud.hp<=0 && ud.alive){
    ud.alive=false; enemy.visible=false;
    addXP(DB.player,'combat',8); updateXPBar('combat');
    progressQuest('slay','slime',1);
    showCenterMessage('Slime defeated!');
    setTimeout(()=>{ ud.hp=ud.maxhp; ud.alive=true; enemy.visible=true; }, ud.respawn*1000);
  }
  save(DB);
}

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  movePlayer(dt);
  updateCamera();
  renderer.render(scene,camera);
}

window.addEventListener('DOMContentLoaded', init);
