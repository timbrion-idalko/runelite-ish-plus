import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { groundHeightAt } from './engine.js';

export function biomeAt(x, z) {
  const v = Math.sin(x*0.004) + Math.cos(z*0.004);
  if (v > 0.6) return 'snow';
  if (v < -0.6) return 'desert';
  return 'grass';
}

export function spawnTree(scene, x, z, id, biome) {
  const h = 6 + Math.random()*4;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.5, h, 6),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness:0.9 })
  );
  const crownCol = biome==='snow' ? 0xbfeaf5 : 0x2f855a;
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 4.5, 8),
    new THREE.MeshStandardMaterial({ color: crownCol, roughness:0.8 })
  );
  trunk.castShadow = trunk.receiveShadow = true;
  crown.castShadow = true;
  crown.position.y = h/2 + 2.2;
  const g = new THREE.Group();
  g.add(trunk); g.add(crown);
  g.position.set(x, groundHeightAt(scene, x, z), z);
  g.userData = { type:'tree', id, resource:{ kind: biome==='desert' ? 'fiber' : 'log', level:1, hp:3, respawn: 20, last:0 }};
  scene.add(g);
  return g;
}

export function spawnRock(scene, x, z, id, biome) {
  const s = 1.5 + Math.random()*1.5;
  const rockCol = biome==='snow' ? 0xd1d5db : 0x6b7280;
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(s, 0),
    new THREE.MeshStandardMaterial({ color: rockCol, roughness:0.95, metalness:0.05 })
  );
  rock.position.set(x, groundHeightAt(scene, x, z)+s*0.5, z);
  rock.castShadow = rock.receiveShadow = true;
  rock.userData = { type:'rock', id, resource:{ kind: 'ore', level:1, hp:4, respawn: 25, last:0 }};
  scene.add(rock);
  return rock;
}

export function spawnNPC(scene, x, z, id, name, dialog) {
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1.2, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness:0.7 })
  );
  body.castShadow = true;
  body.position.set(x, groundHeightAt(scene, x, z)+1.2, z);
  body.userData = { type:'npc', id, name, dialog };
  scene.add(body);
  return body;
}

export function spawnSlime(scene, x, z, id, level=1) {
  const s = 0.7 + level*0.15;
  const slime = new THREE.Mesh(
    new THREE.SphereGeometry(s, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness:0.4, metalness:0.1 })
  );
  slime.castShadow = true;
  slime.position.set(x, groundHeightAt(scene, x, z)+s, z);
  slime.userData = {
    type:'enemy', enemyType:'slime', id, level,
    hp: 6 + level*3, maxhp: 6 + level*3, dmg: 2 + level,
    speed: 3.0,
    aggro: 14 + level*2,
    alive: true, respawn: 18, lastHit: 0,
    loot: [{id:'slime-goo', qty:1}]
  };
  scene.add(slime);
  return slime;
}

export function raycastInteract(camera, scene) {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0,0), camera);
  const pickables = [];
  scene.traverse(o => { if (o.userData && (o.userData.type==='tree' || o.userData.type==='rock' || o.userData.type==='npc' || o.userData.type==='enemy')) pickables.push(o); });
  const hits = ray.intersectObjects(pickables, false);
  return hits[0]?.object?.parent ?? hits[0]?.object ?? null;
}
