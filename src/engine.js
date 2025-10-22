import * as THREE from 'https://cdn.skypack.dev/three@0.158.0/build/three.module.js';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.158.0/examples/jsm/controls/PointerLockControls.js';

export function makeRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  return renderer;
}

export function makeCamera() {
  const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 2000);
  camera.position.set(0, 2, 10);
  return camera;
}

export function makeControls(camera, dom) {
  const controls = new PointerLockControls(camera, dom);
  controls.getObject().position.y = 2;
  return controls;
}

export function resize(renderer, camera) {
  window.addEventListener('resize',()=>{
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

export function simpleHeights(x, z) {
  const f = (n)=>Math.sin(n*0.09)+Math.sin(n*0.021);
  return (f(x)+f(z)+Math.sin((x+z)*0.035))*1.2;
}

export function makeTerrain(size=640, step=3) {
  const geo = new THREE.PlaneGeometry(size, size, size/step, size/step);
  geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  for (let i=0;i<pos.count;i++){
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, simpleHeights(x, z));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x445b3a, roughness: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

export function groundHeightAt(scene, x, z) {
  const terrain = scene.getObjectByName('terrain');
  if (!terrain) return 0;
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 200, z), new THREE.Vector3(0,-1,0), 0, 500);
  const hits = ray.intersectObject(terrain);
  return hits[0]?.point.y ?? 0;
}

export function addLighting(scene){
  const hemi = new THREE.HemisphereLight(0xcbd5e1, 0x0a0a0a, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.05);
  sun.position.set(100, 120, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  scene.add(sun);
  return { hemi, sun };
}

export function makeMinimap(renderer, scene, player) {
  const mapCam = new THREE.OrthographicCamera(-90,90,90,-90, 0.1, 400);
  mapCam.position.set(0,200,0);
  mapCam.lookAt(0,0,0);
  const rt = new THREE.WebGLRenderTarget(256,256);
  const el = document.getElementById('minimap');
  const cvs = document.createElement('canvas');
  cvs.width = 160; cvs.height = 160; el.appendChild(cvs);
  const ctx = cvs.getContext('2d');

  function render() {
    const p = player.position;
    mapCam.position.set(p.x, 200, p.z);
    mapCam.lookAt(p.x, 0, p.z);

    renderer.setRenderTarget(rt);
    renderer.render(scene, mapCam);
    renderer.setRenderTarget(null);

    const pixels = new Uint8Array(256*256*4);
    renderer.readRenderTargetPixels(rt, 0,0,256,256, pixels);

    const imgData = new ImageData(new Uint8ClampedArray(pixels), 256, 256);
    const off = document.createElement('canvas');
    off.width=256; off.height=256;
    const octx = off.getContext('2d');
    octx.putImageData(imgData,0,0);

    ctx.clearRect(0,0,160,160);
    ctx.save();
    ctx.beginPath(); ctx.arc(80,80,80,0,Math.PI*2); ctx.clip();
    ctx.drawImage(off, 0,0,256,256, 0,0,160,160);
    ctx.restore();
    ctx.fillStyle = '#00ffff';
    ctx.beginPath(); ctx.arc(80,80,4,0,Math.PI*2); ctx.fill();
  }
  return { render };
}
