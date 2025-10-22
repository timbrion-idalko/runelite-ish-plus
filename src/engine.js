import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ======= Stylized Fantasy Engine =======

export function makeRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;
  return renderer;
}

export function makeCamera() {
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth/window.innerHeight, 0.1, 2000);
  camera.position.set(0, 5, 10);
  return camera;
}

export function makeControls(camera, dom) {
  const controls = new PointerLockControls(camera, dom);
  controls.getObject().position.y = 2;
  return controls;
}

export function resize(renderer, camera) {
  window.addEventListener('resize',()=>{
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ====== Terrain ======
export function makeTerrain(size=640, step=3) {
  const geo = new THREE.PlaneGeometry(size, size, size/step, size/step);
  geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  for (let i=0;i<pos.count;i++){
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = Math.sin(x*0.02)*2 + Math.cos(z*0.015)*3 + Math.sin((x+z)*0.01)*2;
    pos.setY(i, h);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // Textured material
  const texLoader = new THREE.TextureLoader();
  const texGrass = texLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/terrain/grasslight-big.jpg');
  const texRock = texLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/terrain/grasslight-big-nm.jpg');
  texGrass.wrapS = texGrass.wrapT = THREE.RepeatWrapping;
  texRock.wrapS = texRock.wrapT = THREE.RepeatWrapping;
  texGrass.repeat.set(64,64);
  texRock.repeat.set(64,64);

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texGrass,
    normalMap: texRock,
    roughness: 0.8,
    metalness: 0.1
  });

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

// ===== Lighting + Atmosphere =====
export function addLighting(scene){
  const hemi = new THREE.HemisphereLight(0xfff6e5, 0x202040, 1.2);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff5cc, 1.3);
  sun.position.set(200, 300, 100);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambient);

  // soft fog for dreamy look
  scene.fog = new THREE.FogExp2(0x9ac4f8, 0.0022);

  return { hemi, sun, ambient };
}

export function makeSky(scene) {
  const skyGeo = new THREE.SphereGeometry(1000, 32, 32);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x91c9f7) },
      bottomColor: { value: new THREE.Color(0xe0b8ff) },
      offset: { value: 0 },
      exponent: { value: 0.6 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize( vWorldPosition + offset ).y;
        gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max(h, 0.0), exponent ), 0.0 ) ), 1.0 );
      }`,
    side: THREE.BackSide,
    depthWrite: false
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
}
