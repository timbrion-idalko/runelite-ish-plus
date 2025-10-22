import * as THREE from 'three';
import { makeRenderer, makeTerrain, addLighting, groundHeightAt, resize } from './engine.js';
renderer.toneMappingExposure = 1.2;
import { spawnTree, spawnRock, spawnNPC, spawnSlime, biomeAt, raycastInteract } from './world.js';
import { DB, DB as Data, addXP, save, load } from './data.js';
import { renderUI, updateXPBar, addToInventory, progressQuest,
         renderToolbar, showCenterMessage, updateHealthBar } from './ui.js';

console.log('main.js loaded (3rd-person)');

let scene, camera, renderer, clock;
let player, moveTarget = null, moveSpeed = 8;
let raycaster, mouse = new THREE.Vector2();
let enemies = [];

function init() {
  // --- basics ---
  renderer = makeRenderer();
  document.body.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  clock = new THREE.Clock();

  const terrain = makeTerrain(640, 3);
  scene.add(terrain);
  import { addLighting, makeSky } from './engine.js';
  ...
  addLighting(scene);
  makeSky(scene);


  // --- player ---
  const geom = new THREE.CapsuleGeometry(0.6, 1.0, 8, 12);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2563eb });
  player = new THREE.Mesh(geom, mat);
  player.castShadow = true;
  player.position.set(0, groundHeightAt(scene,0,0)+1, 0);
  scene.add(player);

  // --- camera ---
  camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, 0.1, 2000);
  camera.position.set(0, 6, 10);
  resize(renderer, camera);

  // --- world objects ---
  let id=0;
  for (let i=0;i<200;i++){
    const x=-280+Math.random()*560;
    const z=-280+Math.random()*560;
    const biome=biomeAt(x,z);
    if(Math.random()<0.55) spawnTree(scene,x,z,id++,biome);
    else spawnRock(scene,x,z,id++,biome);
  }
  spawnNPC(scene, 0,0,'guide','Guide',[
    'Welcome adventurer!',
    'Click to move, click trees or rocks to interact.'
  ]);
  for(let i=0;i<8;i++){
    const x=-120+Math.random()*240;
    const z=-120+Math.random()*240;
    enemies.push(spawnSlime(scene,x,z,'slime'+i,1+Math.floor(Math.random()*2)));
  }

  // --- input ---
  raycaster = new THREE.Raycaster();
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('resize', ()=>resize(renderer,camera));
         
  // --- start screen button ---
  document.getElementById('startBtn').onclick = () => {
  document.getElementById('title').style.display = 'none';
};

  load(Data);
  renderUI();
  animate();
}

function onPointerDown(e){
  e.preventDefault();
  mouse.x = ( e.clientX / window.innerWidth ) * 2 - 1;
  mouse.y = - ( e.clientY / window.innerHeight ) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(scene.children, true);
  if (!intersects.length) return;

  // find first visible mesh hit that has userData or terrain
  let hit = intersects.find(i => i.object.visible);
  if (!hit) return;

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
  const dx = targetPos.x - p.x;
  const dz = targetPos.z - p.z;
  const dist = Math.hypot(dx, dz);

  if (dist < 0.8) {
    // reached target
    if (moveTarget.target) interact(moveTarget.target);
    moveTarget = null;
    return;
  }

  const step = Math.min(dist, moveSpeed * dt);
  p.x += (dx/dist) * step;
  p.z += (dz/dist) * step;
  p.y = groundHeightAt(scene, p.x, p.z) + 1;
  player.lookAt(targetPos.x, p.y, targetPos.z);
}

function updateCamera(){
  // smooth follow from behind
  const desired = new THREE.Vector3(player.position.x, player.position.y+4, player.position.z+8);
  camera.position.lerp(desired, 0.1);
  camera.lookAt(player.position.x, player.position.y+1, player.position.z);
}

function interact(obj){
  const ud = obj.userData||{};
  if(ud.type==='npc'){
    showCenterMessage('Talking to ' + (ud.name||'NPC'));
    // give first quest if not yet taken
    if (!DB.player.quests.active.find(q=>q.id==='first-steps') && !DB.player.quests.completed.find(q=>q.id==='first-steps')) {
      DB.player.quests.active.push({ ...Data.quests[0], goals: Data.quests[0].goals.map(g=>({...g})) });
      showCenterMessage('New Quest: First Steps');
      save(DB);
    }
    return;
  }

  if(ud.type==='enemy'){
    showCenterMessage('Attacking slime!');
    attack(obj);
    return;
  }

  if(!ud.resource) return;
  const activeItem = DB.player.inventory[DB.player.hotbarIndex];
  const isTree = ud.type==='tree';
  const required = isTree?'axe':'pick';
  const skill = isTree?'woodcutting':'mining';
  if (!activeItem || !(activeItem.id||'').includes(required)) {
    showCenterMessage('Need a ' + (isTree?'hatchet':'pickaxe') + ' equipped.');
    return;
  }
  ud.resource.hp -= activeItem.power;
  if (ud.resource.hp<=0){
    addToInventory(ud.resource.kind,1,Data.items);
    progressQuest('gather', ud.resource.kind,1);
    addXP(DB.player, skill,5);
    updateXPBar(skill);
    ud.resource.hp = isTree?3:4;
    showCenterMessage('Collected ' + ud.resource.kind);
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
