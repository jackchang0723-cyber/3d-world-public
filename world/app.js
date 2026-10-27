// Aurora World — one first-person explorer for both scenes in this repo: the
// Grand Aurora Hotel and the Starlight Kingdom theme park. Each world has a
// portal; stepping up to it and pressing E unloads the current world and loads
// the other one in place. Everything else (walking, collision, benches, the
// hotel lift, the park rides) works as in the two single-world viewers.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.Cache.enabled = true;   // areas share textures: download each image once

window.__worldBoot = true;
const MOBILE = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const EYE = 1.65, RADIUS = 0.3, STEP = 0.46, GRAVITY = 9.8;
const LIGHT_SCALE = 0.0003;       // exported candela (from Blender watts) -> balance against the sun

// Blender (x, y, z) -> three (x, z, -y)
const b2t = (x, y, z = 0) => new THREE.Vector3(x, z, -y);

// ---------------------------------------------------------------------------
// The two worlds
// ---------------------------------------------------------------------------
const WORLDS = {
  hotel: {
    key: 'hotel', zh: 'Grand Aurora 大飯店', short: '大飯店', en: 'Grand Aurora Hotel', sub: 'Hotel & Residences · 五星級大飯店',
    base: 'hotel/viewer/scene/', prefix: 'hotel_', has: ['lift', 'doors'],
    walk: 2.6, run: 6.0, fly: 8.0,
    sun: { phi: 52, theta: -48, power: 4.2 }, env: 0.38, hemi: 0.3, fog: null, lightRange: { Lobby_Chandelier: 30, Pool_1: 26, Pool_2: 26 }, lightDist: 20,
    map: { x0: -42, x1: 36, y0: -50, y1: 62 },
    portal: { p: [-20.5, -40.5, 0.02], yaw: -Math.PI / 2 },
    places: [
      { key: '1', zh: '正門廣場', en: 'Forecourt', p: [0, -45, 0], yaw: 0 },
      { key: '2', zh: '挑高大廳', en: 'Grand Lobby', p: [0, 2.2, 0.04], yaw: 0 },
      { key: '3', zh: '接待櫃檯', en: 'Reception', p: [11.0, 13, 0.04], yaw: -Math.PI / 2 },
      { key: '4', zh: '咖啡廳', en: 'Aurora Café', p: [21.5, 3.0, 0.04], yaw: -0.45 },
      { key: '5', zh: '自助餐廳', en: 'The Market', p: [-21.4, 18.2, 0.04], yaw: Math.PI / 2 - 0.35 },
      { key: '6', zh: '酒吧 · 精品店', en: 'Le Jardin Bar & Boutique', p: [-8.5, 31.6, 4.54], yaw: 0 },
      { key: '7', zh: '健身房', en: 'Aurora Fitness', p: [-6.5, 34.5, 0.04], yaw: 0.5 },
      { key: '8', zh: '室內泳池', en: 'AQUA Pool', p: [10, 32.2, 0.04], yaw: 0 },
      { key: '9', zh: '總統套房', en: 'Presidential Suite', p: [-17.6, 21.0, 16.55], yaw: -Math.PI / 2 - 0.4 },
      { key: '0', zh: '空中酒吧', en: 'Aurora Sky Bar', p: [-12.5, 24.2, 24.8], yaw: -Math.PI / 2 - 0.5 },
    ],
  },
  park: {
    key: 'park', zh: '星光童話王國', short: '童話王國', en: 'Starlight Kingdom', sub: 'Fairy-tale Theme Park · 星光童話王國',
    base: 'park/viewer/scene/', prefix: 'park_', has: ['rides'], walk: 2.8, run: 6.5, fly: 10.0,
    sun: { phi: 50, theta: -40, power: 4.2 }, env: 0.42, hemi: 0.34, fog: [0xc9dcef, 260, 1000], lightRange: { Carousel_1: 22, Teacups_1: 22, Wheel_Hub: 30 }, lightDist: 18,
    map: { x0: -72, x1: 72, y0: -122, y1: 148 },
    portal: { p: [-24.0, -111.5, 0.04], yaw: -Math.PI / 2, arriveYaw: 0 },
    places: [
      { key: '1', zh: '入口大門', en: 'Entrance Gate', p: [0, -110, 0.04], yaw: 0 },
      { key: '2', zh: '童話大街', en: 'Main Street', p: [0, -88, 0.05], yaw: 0 },
      { key: '3', zh: '星光廣場', en: 'Star Fountain Plaza', p: [0, -19, 0.05], yaw: 0 },
      { key: '4', zh: '星光城堡', en: 'Starlight Castle', p: [0, 23.5, 0.05], yaw: 0 },
      { key: '5', zh: '旋轉木馬', en: 'Royal Carousel', p: [-34.1, 5.7, 0.04], yaw: 1.406 },
      { key: '6', zh: '瘋狂茶杯', en: 'Tea Party', p: [-34.5, -21.6, 0.04], yaw: 2.129 },
      { key: '7', zh: '摩天輪', en: 'Starlight Wheel', p: [44.0, 10.0, 0.04], yaw: -Math.PI / 2 },
      { key: '8', zh: '雲霄飛車', en: 'Dragon Flight', p: [-20.0, 76.0, 0.04], yaw: 0 },
      { key: '9', zh: '天鵝湖', en: 'Swan Lake', p: [40.8, -40.0, 0.5], yaw: -Math.PI / 2 },
      { key: '0', zh: '城堡通道', en: 'Castle Gate Hall', p: [0, 45.5, 0.05], yaw: 0 },
    ],
  },
  airport: {
    key: 'airport', zh: '極光國際機場', short: '國際機場', en: 'Aurora International Airport', sub: 'Departures · Duty Free · Gate A1 · 極光國際機場',
    base: 'airport/viewer/scene/', prefix: 'airport_', has: ['mapdata'], walk: 2.6, run: 6.0, fly: 9.0,
    sun: { phi: 48, theta: -30, power: 4.0 }, env: 0.42, hemi: 0.34, fog: [0xd4e0ea, 280, 1000],
    lightRange: { Fids: 14, Apron: 40 }, lightDist: 20,
    map: { x0: -52, x1: 52, y0: -30, y1: 116 },
    portal: { p: [-40.0, -5.0, 0.02], yaw: -Math.PI / 2, arriveYaw: 0 },
    places: [
      { key: '1', zh: '航廈入口', en: 'Terminal Entrance', p: [0, -5, 0.02], yaw: 0 },
      { key: '2', zh: '出境大廳', en: 'Departures Hall', p: [0, 10, 0.02], yaw: 0 },
      { key: '3', zh: '報到櫃檯', en: 'Check-in', p: [-15.25, 13.5, 0.02], yaw: 0 },
      { key: '4', zh: '安全檢查', en: 'Security', p: [0, 30.0, 0.02], yaw: 0 },
      { key: '5', zh: '免稅店', en: 'Aurora Duty Free', p: [-10.5, 43, 0.02], yaw: Math.PI / 2 },
      { key: '6', zh: '咖啡廳', en: 'Sky Café', p: [-10.5, 58, 0.02], yaw: Math.PI / 2 },
      { key: '7', zh: '旅行用品', en: 'Travel & Tech', p: [10.5, 43, 0.02], yaw: -Math.PI / 2 },
      { key: '8', zh: '伴手禮', en: 'Gifts & Sweets', p: [10.5, 58, 0.02], yaw: -Math.PI / 2 },
      { key: '9', zh: '登機門 A1', en: 'Gate A1', p: [0, 70.5, 0.02], yaw: 0 },
      { key: '0', zh: '飛機客艙', en: 'Aircraft Cabin', p: [7.5, 108.0, 4.57], yaw: Math.PI / 2 },
    ],
  },
  nature: {
    key: 'nature', zh: '翠谷自然公園', short: '自然公園', en: 'Emerald Valley', sub: 'Nature Park & Glamping · 翠谷自然公園',
    base: 'nature/viewer/scene/', prefix: 'nature_', has: ['mapdata'], walk: 2.6, run: 6.5, fly: 10.0,
    sun: { phi: 48, theta: -35, power: 4.2 }, env: 0.42, hemi: 0.36, fog: [0xcddde4, 240, 950],
    lightRange: { Campfire: 16 }, lightDist: 10,
    map: { x0: -100, x1: 100, y0: -138, y1: 130 },
    portal: { p: [-25.0, -91.0, 0.15], yaw: -Math.PI / 2, arriveYaw: 0 },
    places: [
      { key: '1', zh: '入口廣場', en: 'Entrance Plaza', p: [-12, -93, 0.15], yaw: 0 },
      { key: '2', zh: '西峰觀景台', en: 'West Lookout', p: [-85.9, 20.1, 22.9], yaw: -1.707 },
      { key: '3', zh: '遊客中心', en: 'Visitor Center', p: [-23.5, 6.0, 1.82], yaw: Math.PI / 2 },
      { key: '4', zh: '翠谷吊橋', en: 'Valley Bridge', p: [-0.6, 64.0, 20.6], yaw: -1.535 },
      { key: '5', zh: '瀑布水潭', en: 'Falls Pool', p: [-7.2, 69.4, 2.55], yaw: -0.487 },
      { key: '6', zh: '豪華露營區', en: 'Glamping Meadow', p: [29.5, -4.0, 1.7], yaw: -0.97 },
      { key: '7', zh: '南峰觀景台', en: 'South Lookout', p: [-0.1, -126.8, 22.9], yaw: 0 },
      { key: '8', zh: '東峰觀景台', en: 'East Lookout', p: [87.0, 9.7, 22.45], yaw: 1.636 },
      { key: '9', zh: '營火區', en: 'Campfire', p: [47.0, 1.0, 1.7], yaw: 0 },
      { key: '0', zh: '營地服務台', en: 'Camp Office', p: [24.5, -10.5, 1.63], yaw: -Math.PI / 2 },
    ],
  },
  mall: {
    key: 'mall', zh: '極光購物中心', short: '購物中心', en: 'Aurora Galleria', sub: 'Shopping · Dining · Cinema · 購物中心',
    base: 'mall/viewer/scene/', prefix: 'mall_', has: ['lift', 'escalators'], walk: 2.6, run: 6.0, fly: 8.0,
    sun: { phi: 50, theta: -35, power: 3.8 }, env: 0.42, hemi: 0.32, fog: [0xd2dbe6, 260, 1000],
    lightRange: { Court_Orbs: 30, Galleria_W: 26, Galleria_E: 26, Market_1: 22, Market_2: 22 }, lightDist: 18,
    map: { x0: -56, x1: 56, y0: -46, y1: 64 },
    portal: { p: [-24.0, -15.0, 0.02], yaw: -Math.PI / 2, arriveYaw: 0 },
    places: [
      { key: '1', zh: '入口廣場', en: 'Entrance Plaza', p: [0, -34, 0.02], yaw: 0 },
      { key: '2', zh: '中央大廳', en: 'Central Court', p: [0, 10.5, 0.02], yaw: 0 },
      { key: '3', zh: '3C 電子', en: 'NOVA TECH', p: [-22.5, 17.8, 0.02], yaw: Math.PI },
      { key: '4', zh: '咖啡廳', en: 'Sweet Hours Café', p: [22.5, 17.8, 0.02], yaw: Math.PI },
      { key: '5', zh: '超市', en: 'FRESH MART', p: [21.5, 42.2, 0.02], yaw: 0 },
      { key: '6', zh: '服飾', en: 'LUMINA', p: [-11.5, 17.8, 5.5], yaw: Math.PI },
      { key: '7', zh: '書店', en: 'Page & Co.', p: [-22.5, 42.2, 5.5], yaw: 0 },
      { key: '8', zh: '玩具店', en: 'Kiddo Toys', p: [22.5, 42.2, 5.5], yaw: 0 },
      { key: '9', zh: '美食街', en: 'Food Court', p: [-28.0, 41.5, 11.0], yaw: 0 },
      { key: '0', zh: '電影院', en: 'Aurora Cinemas', p: [17.0, 41.5, 11.0], yaw: 0 },
    ],
  },
};
// A single-world build (hotel.html sets window.AURORA_ONLY = 'hotel') drops the
// other worlds and the portal.
const ONLY = WORLDS[window.AURORA_ONLY] ? window.AURORA_ONLY : null;
if (ONLY) for (const k of Object.keys(WORLDS)) if (k !== ONLY) delete WORLDS[k];
const WORLD_KEYS = Object.keys(WORLDS);
const SOLO = WORLD_KEYS.length === 1;
// The light build (window.AURORA_LITE) keeps only the bear, has no body for the
// visitor (first person only) and uses the small textures, to keep the download small.
const LITE = !!window.AURORA_LITE;
const othersOf = (k) => WORLD_KEYS.filter((x) => x !== k);
let W = null;                 // the world on screen
let PLACES = [];
// in front of a world's portal: arriving (facing away from it) or about to step in (facing it)
function portalPlace(w, facing = false) {
  const [x, y, z] = w.portal.p;
  const fx = -Math.sin(w.portal.yaw), fy = Math.cos(w.portal.yaw), d = facing ? 2.2 : 3.6;
  return { key: '', zh: '傳送門', en: 'Portal', p: [x + fx * d, y + fy * d, z], yaw: facing ? w.portal.yaw + Math.PI : (w.portal.arriveYaw ?? w.portal.yaw) };
}

// ---------------------------------------------------------------------------
// Renderer, scene, sky, lights
// ---------------------------------------------------------------------------
const loadText = document.getElementById('load-text');
let stage = '', stageAt = performance.now();
const diag = (m) => { try { window.__diag?.(m); } catch { } };
function setStage(msg) { if (!msg.startsWith('下載場景')) diag('stage: ' + msg); stage = msg; stageAt = performance.now(); loadText.textContent = msg; }
const watchdog = setInterval(() => {
  if (document.body.classList.contains('failed') || document.getElementById('loader').hidden) return;
  if (performance.now() - stageAt > 25000 && !stage.startsWith('停住')) { diag('stalled at: ' + stage); stage = '停住：' + stage; }
  if (performance.now() - stageAt > 25000) loadText.textContent = `「${stage}」停住超過 25 秒。請關閉頁面再開一次；若仍然如此，請把這行字告訴我。`;
}, 2000);
setStage('啟動 3D 引擎…');
// Plain timers only: requestAnimationFrame never fires while the viewer keeps the frame hidden.
await new Promise((r) => setTimeout(r, 60));
function fail(msg) {
  diag('fail: ' + msg);
  document.getElementById('loader').hidden = false;
  document.getElementById('intro').hidden = true;
  document.body.classList.add('failed');
  loadText.textContent = msg;
}
addEventListener('error', (e) => fail(`發生錯誤：${e.message || e}`));
addEventListener('unhandledrejection', (e) => fail(`發生錯誤：${e.reason?.message || e.reason}`));

const canvas = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, powerPreference: 'high-performance' });
} catch (err) {
  fail('這個瀏覽器無法啟用 WebGL，請改用最新版 Safari 或 Chrome。');
  throw err;
}
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  fail('顯示卡記憶體不足，畫面已中斷。請重新整理，並在右下角切換為「流暢」。');
});
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;   // static scenery: re-render the shadow map only when the visitor moves on

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1200);   // a near plane of 0.1 keeps depth precise on phones
camera.rotation.order = 'YXZ';
let worldRoot = new THREE.Group();       // everything that belongs to the current world
scene.add(worldRoot);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const sky = new Sky();
sky.scale.setScalar(4000);
const su = sky.material.uniforms;
su.turbidity.value = 2.1;
su.rayleigh.value = 1.15;
su.mieCoefficient.value = 0.004;
su.mieDirectionalG.value = 0.82;
scene.add(sky);
const sunDir = new THREE.Vector3();
const sun = new THREE.DirectionalLight(0xfff0d8, 4.2);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 20, far: 420 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xe4ecff, 0x847e5e, 0.32);
scene.add(hemi);
// the shadow box follows the visitor in 16 m steps
const shadowAt = new THREE.Vector3(1e9, 0, 0);
function placeSun(p, force = false) {
  const sx = Math.round(p.x / 16) * 16, sz = Math.round(p.z / 16) * 16;
  if (!force && sx === shadowAt.x && sz === shadowAt.z) return;
  shadowAt.set(sx, 0, sz);
  sun.target.position.set(sx, 0, sz);
  sun.position.copy(sunDir).multiplyScalar(220).add(sun.target.position);
  sun.target.updateMatrixWorld();
  renderer.shadowMap.needsUpdate = true;
}
// night mode: a dark sky with stars and a moon, faint blue moonlight, and every lamp in
// the world turned up (they keep their glow, the sun no longer drowns it)
let night = false;
try { night = localStorage.getItem('aurora-world-night') === '1'; } catch { }
let nightK = 1;                          // how much brighter the lamps' point lights are
const NIGHT_SKY = new THREE.Color(0x060c1e);
const skyDome = new THREE.Group();       // stars and moon, kept centred on the camera
skyDome.visible = false;
scene.add(skyDome);
{
  const n = 1400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = 0.05 + 0.95 * Math.random() ** 0.7, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * 1000, y * 1000, Math.sin(a) * r * 1000], i * 3);
    const b = 0.5 + Math.random() * 0.5, warm = Math.random() < 0.2;
    col.set([b, b * (warm ? 0.9 : 0.97), b * (warm ? 0.75 : 1.0)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  skyDome.add(new THREE.Points(g, new THREE.PointsMaterial({ size: MOBILE ? 2.2 : 1.8, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false })));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(22, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false }));
  moon.name = 'Moon';
  skyDome.add(moon);
}
function applyLook(w) {
  sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(w.sun.phi), THREE.MathUtils.degToRad(w.sun.theta));
  su.sunPosition.value.copy(sunDir);
  sky.visible = !night;
  skyDome.visible = night;
  skyDome.getObjectByName('Moon').position.copy(sunDir).multiplyScalar(950);
  scene.background = night ? NIGHT_SKY : null;
  sun.color.set(night ? 0x8fa6e8 : 0xfff0d8);
  sun.intensity = w.sun.power * (night ? 0.09 : 1);
  scene.environmentIntensity = w.env * (night ? 0.16 : 1);
  hemi.color.set(night ? 0x34457a : 0xe4ecff);
  hemi.groundColor.set(night ? 0x16140e : 0x847e5e);
  hemi.intensity = w.hemi * (night ? 0.9 : 1);
  scene.fog = w.fog ? new THREE.Fog(night ? 0x0a1326 : w.fog[0], w.fog[1], w.fog[2]) : null;
  nightK = night ? 2.0 : 1;
  if (typeof bloom !== 'undefined') bloom.strength = night ? 0.5 : 0.32;
  renderer.shadowMap.needsUpdate = true;
  const b = document.getElementById('btn-night');
  if (b) { b.textContent = night ? '夜晚' : '白天'; b.setAttribute('aria-pressed', String(night)); }
}

// ---------------------------------------------------------------------------
// Quality presets + post-processing
// ---------------------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.45, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const QUALITY = {
  high: { label: '高畫質', ratio: 1.75, shadow: 4096, bloom: true },
  low: { label: '流暢', ratio: 1.0, shadow: 0, bloom: false },
};
let quality = MOBILE ? 'low' : 'high';
try { quality = localStorage.getItem('aurora-world-quality') || quality; } catch { }
if (!QUALITY[quality]) quality = 'high';

function applyQuality() {
  const q = QUALITY[quality];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.ratio));
  bloom.enabled = q.bloom;
  const shadows = q.shadow > 0;
  if (renderer.shadowMap.enabled !== shadows) {
    renderer.shadowMap.enabled = shadows;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }
  if (shadows && sun.shadow.mapSize.x !== q.shadow) {
    sun.shadow.mapSize.set(q.shadow, q.shadow);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  renderer.shadowMap.needsUpdate = true;
  document.getElementById('btn-quality').textContent = q.label;
  resize();
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  if (!w || !h) return;   // hidden frame: wait for a real size (the resize event follows)
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
const bar = document.getElementById('load-bar');
const manager = new THREE.LoadingManager();
// phones get the half-resolution texture set
if (MOBILE || LITE) manager.setURLModifier((u) => u.replace('/tex/', '/tex_s/'));
const loader = new GLTFLoader(manager);
// A disposed DRACOLoader cannot start again, so each world load gets a fresh one.
function newDraco() {
  const d = new DRACOLoader(manager);
  d.setDecoderPath('park/viewer/lib/draco/');
  d.setDecoderConfig({ type: 'js' });   // plain-JS decoder: no WebAssembly needed
  d.setWorkerLimit(MOBILE ? 1 : 2);
  loader.setDRACOLoader(d);
  return d;
}

// Characters are Draco-compressed too (tools/compress_characters.py) and load after the
// world's decoder is gone, so they have a loader of their own that stays ready.
const charLoader = new GLTFLoader(manager);
{
  const d = new DRACOLoader(manager);
  d.setDecoderPath('park/viewer/lib/draco/');
  d.setDecoderConfig({ type: 'js' });
  d.setWorkerLimit(1);
  charLoader.setDRACOLoader(d);
}

async function fetchWithProgress(url, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  if (!res.body) { const b = await res.arrayBuffer(); onBytes(b.byteLength); return b; }
  const reader = res.body.getReader();
  const chunks = [];
  let n = 0;
  for (; ;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    n += value.length;
    onBytes(value.length);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}

// The scene files embed their geometry as a base64 data: URI. Some viewers
// (the Claude iOS app) refuse to fetch data: URIs, so decode it here and hand
// the loader an in-memory GLB instead.
function jsonToGlb(buf) {
  const json = JSON.parse(new TextDecoder().decode(buf));
  let bin = new Uint8Array(0);
  const b = json.buffers && json.buffers[0];
  if (b && b.uri && b.uri.startsWith('data:')) {
    const raw = atob(b.uri.slice(b.uri.indexOf(',') + 1));
    bin = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
    delete b.uri;
  }
  const pad = (n) => (n + 3) & ~3;
  const js = new TextEncoder().encode(JSON.stringify(json));
  const jl = pad(js.length), bl = pad(bin.length);
  const out = new Uint8Array(12 + 8 + jl + (bl ? 8 + bl : 0));
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
  dv.setUint32(12, jl, true); dv.setUint32(16, 0x4E4F534A, true);
  out.fill(0x20, 20, 20 + jl); out.set(js, 20);
  if (bl) {
    dv.setUint32(20 + jl, bl, true); dv.setUint32(24 + jl, 0x004E4942, true);
    out.set(bin, 28 + jl);
  }
  return out.buffer;
}

let LIFT_CFG = null, RIDES_CFG = null, ESCALATORS = [], DOORS_CFG = null, MAPDATA = null;
const getJson = async (url) => { try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; } };
async function loadAll(w) {
  const sizes = (await getJson(w.base + 'manifest.json')) || {};
  const parts = Object.keys(sizes).filter((k) => !k.startsWith('textures'));
  // only ask for the optional configs a world has, so the console stays free of 404s
  LIFT_CFG = w.has.includes('lift') ? await getJson(w.base + 'lift.json') : null;
  DOORS_CFG = w.has.includes('doors') ? await getJson(w.base + 'doors.json') : null;
  RIDES_CFG = w.has.includes('rides') ? await getJson(w.base + 'rides.json') : null;
  MAPDATA = w.has.includes('mapdata') ? await getJson(w.base + 'map.json') : null;
  ESCALATORS = ((w.has.includes('escalators') && await getJson(w.base + 'escalators.json')) || []).map((e) => ({ a: b2t(...e.a), b: b2t(...e.b), w: e.w, dir: e.dir }));
  SEATS = ((await getJson(w.base + 'seats.json')) || [])
    .map(([x, y, z, yaw, kind]) => ({ yaw, kind, pos: new THREE.Vector3(x, z, -y) }));
  const total = parts.reduce((s, p) => s + (sizes[p] || 6e5), 0);
  let got = 0;
  const tick = (n) => {
    got += n;
    bar.style.transform = `scaleX(${Math.min(1, got / total)})`;
    setStage(`下載場景 ${(got / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB`);
  };
  bar.style.transform = 'scaleX(0)';
  const bufs = await Promise.all(parts.map((p) => fetchWithProgress(`${w.base}${w.prefix}${p}.gltf.json`, tick)));
  const roots = [];
  const draco = newDraco();
  for (let i = 0; i < bufs.length; i++) {
    setStage(`解壓縮模型與貼圖 ${i + 1} / ${bufs.length}`);
    roots.push((await loader.parseAsync(jsonToGlb(bufs[i]), w.base)).scene);
    bufs[i] = null;
  }   // one at a time keeps peak memory low
  draco.dispose();
  setStage('建立碰撞與光影…');
  await new Promise((r) => setTimeout(r, 30));
  return roots;
}

const lightSources = [];
const matByName = {};
const sharedTex = new Map();
function shareTexture(m, key) {
  const t = m[key];
  if (!t || !t.name) return;
  const first = sharedTex.get(t.name);
  if (!first) { sharedTex.set(t.name, t); return; }
  if (first !== t) { m[key] = first; t.dispose(); }
}

// Phones: physical (clear-coat) materials -> standard, which compiles much faster.
const lightMats = new Map();
function lighten(m) {
  if (!MOBILE || !m.isMeshPhysicalMaterial) return m;
  if (lightMats.has(m)) return lightMats.get(m);
  const n = new THREE.MeshStandardMaterial();
  for (const k of ['name', 'color', 'map', 'roughness', 'metalness', 'emissive', 'emissiveMap', 'emissiveIntensity',
    'normalMap', 'roughnessMap', 'metalnessMap', 'transparent', 'opacity', 'side', 'depthWrite', 'alphaTest']) {
    const v = m[k];
    if (v === undefined) continue;
    n[k] = v && v.isColor ? v.clone() : v;
  }
  lightMats.set(m, n);
  m.dispose();
  return n;
}

const nextFrame = () => new Promise((r) => setTimeout(r, 30));   // timers, not rAF (see above)
let paused = false;
const rideMeshes = [];   // park: Rides_<part><n>_nocol meshes, hung on pivots and animated

async function prepare(roots) {
  paused = true;            // nothing draws until the shaders are ready
  setStage('整理模型…');
  await nextFrame();
  const geoms = [];
  for (const root of roots) {
    worldRoot.add(root);
    root.updateMatrixWorld(true);
    const drop = [];
    root.traverse((o) => {
      if (o.isDirectionalLight) { drop.push(o); return; }
      if (o.isPointLight || o.isSpotLight) {
        lightSources.push({
          pos: o.getWorldPosition(new THREE.Vector3()), color: o.color.clone(),
          intensity: o.intensity * LIGHT_SCALE, distance: W.lightRange[o.name] || W.lightDist,
        });
        drop.push(o);
        return;
      }
      if (!o.isMesh) return;
      o.material = lighten(o.material);
      const m = o.material;
      if (!matByName[m.name]) matByName[m.name] = m;
      shareTexture(m, 'map');
      const emissive = m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0 && (m.emissiveIntensity ?? 1) > 0;
      o.castShadow = !emissive && !m.transparent;
      o.receiveShadow = true;
      if (m.name === 'Glass') {
        Object.assign(m, { transparent: true, opacity: 0.12, depthWrite: false, roughness: 0.04, metalness: 0.0 });
        o.castShadow = false;
        o.renderOrder = 2;
      } else if (m.name === 'Water') {
        Object.assign(m, { transparent: true, opacity: W.key === 'park' ? 0.72 : W.key === 'nature' ? 0.68 : 0.62, depthWrite: false, roughness: 0.03, metalness: 0.1 });
        m.color.set(W.key === 'park' ? 0x2a8fb0 : W.key === 'nature' ? 0x3a8e9c : 0x1d97b8);
        o.renderOrder = 1;
      } else if (m.name === 'WaterJet') {
        Object.assign(m, { transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
        o.castShadow = false;
        o.renderOrder = 3;
      } else if (m.name === 'Mirror' || m.name === 'Chrome') {
        m.envMapIntensity = 2.0;
      } else if (m.name === 'GlassTower') {
        m.envMapIntensity = 2.5;
      }
      if (/^Rides_/.test(o.name)) {
        o.castShadow = false;            // moving parts: the shadow map is not re-rendered for them
        rideMeshes.push(o);
        return;
      }
      if (/nocol/i.test(o.name)) return;
      let g = o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
      g.morphAttributes = {};
      g.applyMatrix4(o.matrixWorld);
      if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
      geoms.push(g);
    });
    drop.forEach((o) => o.parent.remove(o));
  }
  setStage('建立碰撞資料…');
  await nextFrame();
  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose());
  merged.boundsTree = new MeshBVH(merged);
  const col = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  THREE.Cache.clear();

  setStage('準備材質（第一次會比較久）…');
  await nextFrame();
  camera.position.set(player.pos.x, player.eyeY, player.pos.z);
  try {
    // compile shaders without freezing the page (parallel compile where supported)
    await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 45000))]);
  } catch (e) { console.warn(e); }
  return col;
}

// ---------------------------------------------------------------------------
// Light pool: a fixed number of real-time point lights follow the visitor,
// always taking the nearest/brightest fixtures.
// ---------------------------------------------------------------------------
const POOL = Array.from({ length: MOBILE ? 4 : 8 }, () => {
  const l = new THREE.PointLight(0xffffff, 0, 18, 2);
  l.userData = { src: null };
  scene.add(l);
  return l;
});
function updateLightPool(dt) {
  if (!lightSources.length) return;
  const eye = camera.position;
  const ranked = lightSources
    .map((s) => ({ s, score: s.pos.distanceTo(eye) / Math.sqrt(s.intensity + 1e-3) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, POOL.length)
    .map((r) => r.s);
  const wanted = new Set(ranked);
  for (const l of POOL) if (l.userData.src && !wanted.has(l.userData.src)) l.userData.src = null;
  const used = new Set(POOL.map((l) => l.userData.src));
  for (const src of ranked) {
    if (used.has(src)) continue;
    const l = POOL.find((x) => !x.userData.src);
    if (!l) break;
    l.userData.src = src;
    l.position.copy(src.pos);
    l.color.copy(src.color);
    l.distance = src.distance;
    l.intensity = 0;
    used.add(src);
  }
  const k = 1 - Math.exp(-dt * 6);
  for (const l of POOL) {
    const target = l.userData.src ? l.userData.src.intensity * nightK : 0;
    l.intensity += (target - l.intensity) * k;
  }
}

// ---------------------------------------------------------------------------
// Portals: a gold ring with a swirling heart, a dais, rising sparks and a sign.
// ---------------------------------------------------------------------------
const portal = { group: null, swirl: null, sparks: null, center: new THREE.Vector3() };
function signTexture(lines) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(16,22,58,0.88)';
  g.beginPath(); g.roundRect(6, 6, 500, 148, 22); g.fill();
  g.strokeStyle = '#f2c46d'; g.lineWidth = 4; g.stroke();
  g.textAlign = 'center';
  g.fillStyle = '#f2c46d';
  g.font = '600 30px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  g.fillText(lines[0], 256, 62);
  g.fillStyle = '#fff3dc';
  g.font = '600 40px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  g.fillText(lines[1], 256, 118);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function buildPortal(w) {
  if (SOLO) return;
  const grp = new THREE.Group();
  const [x, y, z] = w.portal.p;
  grp.position.copy(b2t(x, y, z));
  grp.rotation.y = w.portal.yaw;
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8c071, metalness: 1, roughness: 0.25, emissive: 0x3a2a08 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xece4f4, roughness: 0.4 });
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.05, 0.08, 48), stone);
  dais.position.y = 0.03;
  const trim = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.04, 8, 64), gold);
  trim.rotation.x = Math.PI / 2; trim.position.y = 0.08;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.11, 16, 72), gold);
  ring.position.y = 1.62;
  const inner = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.035, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0xffd9f2 }));
  inner.position.y = 1.62;
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.5, 16), gold);
    post.position.set(sx * 0.95, 0.3, 0);
    grp.add(post);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x9fd8ff : 0xffb3dc }));
    gem.position.set(Math.cos(a) * 1.35, 1.62 + Math.sin(a) * 1.35, 0.12);
    grp.add(gem);
  }
  const swirlMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { t: { value: 0 }, a: { value: new THREE.Color({ hotel: 0xff8fd0, park: 0xffd27a, mall: 0x9ff0d8, nature: 0xa6e88a, airport: 0x9fc8ff }[w.key]) }, b: { value: new THREE.Color(0x6fb8ff) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float t; uniform vec3 a; uniform vec3 b; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
        float ang = atan(p.y, p.x);
        float s = sin(ang * 5.0 + r * 9.0 - t * 2.6) * 0.5 + 0.5;
        float s2 = sin(ang * 3.0 - r * 14.0 + t * 1.7) * 0.5 + 0.5;
        vec3 col = mix(b, a, s) + vec3(1.0) * pow(1.0 - r, 4.0) * 0.45;
        float alpha = (0.3 + 0.4 * s2) * smoothstep(1.0, 0.75, r) + pow(1.0 - r, 3.0) * 0.3;
        gl_FragColor = vec4(col * alpha, alpha);
      }`,
  });
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64), swirlMat);
  swirl.position.y = 1.62;
  swirl.renderOrder = 4;
  // sparks drifting up through the ring
  const N = 70, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { seed[i] = Math.random(); pos[i * 3 + 1] = Math.random() * 3; }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparks = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xfff0c8, size: 0.07, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.userData.seed = seed;
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture(['✦ 傳送門 PORTAL ✦', othersOf(w.key).map((k) => WORLDS[k].short).join(' · ')]), transparent: true }));
  sign.scale.set(2.6, 0.81, 1);
  sign.position.y = 3.65;
  grp.add(dais, trim, ring, inner, swirl, sparks, sign);
  grp.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  worldRoot.add(grp);
  grp.updateMatrixWorld(true);
  Object.assign(portal, { group: grp, swirl, sparks });
  portal.center.copy(grp.position);
  lightSources.push({ pos: grp.position.clone().add(new THREE.Vector3(0, 1.8, 0)), color: new THREE.Color(0xd9a6ff), intensity: 0.45, distance: 10 });
}
function updatePortal(dt, t) {
  if (!portal.group) return;
  portal.swirl.material.uniforms.t.value = t;
  const p = portal.sparks.geometry.attributes.position, seed = portal.sparks.userData.seed;
  for (let i = 0; i < seed.length; i++) {
    let y = p.getY(i) + dt * (0.35 + seed[i] * 0.5);
    if (y > 3.2) y = 0.1;
    const a = seed[i] * 40 + t * (0.4 + seed[i]);
    const r = 0.25 + seed[i] * 1.0;
    p.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r * 0.35);
  }
  p.needsUpdate = true;
}
// the destination menu that opens at a portal
const portalPanel = document.getElementById('portal-panel');
let portalChoices = [];
function openPortalMenu() {
  portalChoices = othersOf(W.key);
  portalPanel.querySelector('.floors').innerHTML = portalChoices.map((k, i) =>
    `<button type="button" data-world="${k}"><kbd class="mouse-only">${i + 1}</kbd><b>${WORLDS[k].short}</b><span>${WORLDS[k].en}</span></button>`).join('');
  portalPanel.querySelectorAll('button[data-world]').forEach((b) =>
    b.addEventListener('click', (e) => { e.currentTarget.blur(); closePortalMenu(); warpTo(b.dataset.world); }));
  portalPanel.hidden = false;
}
function closePortalMenu() { portalPanel.hidden = true; }
function nearPortal() {
  if (!portal.group || player.fly || !started || switching) return false;
  const dx = player.pos.x - portal.center.x, dz = player.pos.z - portal.center.z;
  return Math.hypot(dx, dz) < 2.8 && Math.abs(player.pos.y - portal.center.y) < 1.5;
}

// ---------------------------------------------------------------------------
// Hotel lift: one car serving landing doors on 1F (three doors), 2F, 4F, 5F and
// the roof. Landings come from lift.json: door plane x, door centre y, floor z.
// ---------------------------------------------------------------------------
const CAR_DEPTH = 2.0, WALL_T = 0.4, CAR_H = 2.6;
const lift = { landings: [], floors: [], car: null, at: null, door: 0, phase: 'idle', t: 0, dest: null };
let audioCtx = null;
function ding() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    [[1318.5, 0], [1046.5, 0.28]].forEach(([f, dt]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + dt);
      g.gain.exponentialRampToValueAtTime(0.18, now + dt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dt + 1.1);
      o.connect(g).connect(audioCtx.destination);
      o.start(now + dt); o.stop(now + dt + 1.2);
    });
  } catch { }
}

function buildLift() {
  if (!LIFT_CFG) return;
  const M = (n, fallback) => matByName[n] || new THREE.MeshStandardMaterial({ color: fallback, roughness: 0.4 });
  const gold = M('BrushedGold', 0xc9a45c), wood = M('Walnut', 0x5a3a24), mirror = M('Mirror', 0xdddddd);
  const floorM = M('MarbleFloor', 0xeeeeee), lightM = M('LampShade', 0xfff1d6), stone = M('MarbleNero', 0x111111);
  const half = LIFT_CFG.half;
  const boxM = (w, h, d, m, x, y, z, solid = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    if (solid) dynColliders.push(mesh);
    return mesh;
  };
  const car = new THREE.Group();
  const back = -WALL_T - CAR_DEPTH, cx = (back - WALL_T) / 2;
  car.add(boxM(CAR_DEPTH + WALL_T, 0.06, 1.8, floorM, (back) / 2, -0.025, 0));
  car.add(boxM(CAR_DEPTH, 0.06, 1.8, wood, cx, CAR_H + 0.03, 0, false));
  car.add(boxM(CAR_DEPTH - 0.4, 0.02, 1.2, lightM, cx, CAR_H - 0.005, 0, false));
  car.add(boxM(0.06, CAR_H, 1.8, wood, back - 0.03, CAR_H / 2, 0));
  car.add(boxM(0.02, 1.5, 1.4, mirror, back + 0.01, 1.55, 0, false));
  for (const sz of [-1, 1]) {
    car.add(boxM(CAR_DEPTH, CAR_H, 0.06, wood, cx, CAR_H / 2, sz * 0.88));
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, CAR_DEPTH - 0.3, 10), gold);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(cx, 0.92, sz * 0.82);
    car.add(rail);
  }
  car.add(boxM(0.3, 0.6, 0.02, stone, -WALL_T - 0.25, 1.3, -0.84, false));
  for (let i = 0; i < 3; i++) car.add(boxM(0.05, 0.05, 0.01, lightM, -WALL_T - 0.25, 1.15 + i * 0.13, -0.825, false));
  worldRoot.add(car);
  lift.car = car;
  LIFT_CFG.floors.forEach((f, fi) => {
    lift.floors.push({ id: f.id, zh: f.zh, landings: [] });
    for (const [x, y, z] of f.landings) {
      const L = { floor: fi, pos: new THREE.Vector3(x, z, -y), leaves: [] };
      for (const sz of [-1, 1]) {
        const leaf = boxM(0.05, LIFT_CFG.height, half + 0.01, gold, x - WALL_T / 2, z + LIFT_CFG.height / 2, -y + sz * half / 2);
        leaf.userData.sz = sz;
        worldRoot.add(leaf);
        L.leaves.push(leaf);
      }
      lift.landings.push(L);
      lift.floors[fi].landings.push(L);
    }
  });
  lift.at = lift.floors[0].landings[Math.min(1, lift.floors[0].landings.length - 1)];
  placeCar();
  liftPanel.querySelector('.floors').innerHTML = lift.floors.map((f, i) =>
    `<button type="button" data-floor="${i}"><kbd class="mouse-only">${i + 1}</kbd><b>${f.id}</b><span>${f.zh}</span></button>`).join('');
  liftPanel.querySelectorAll('button[data-floor]').forEach((b) =>
    b.addEventListener('click', (e) => { chooseFloor(+b.dataset.floor); e.currentTarget.blur(); }));
}
function placeCar() {
  lift.car.position.copy(lift.at.pos);
  lift.car.updateMatrixWorld(true);
}
function inCar(p = player.pos) {
  if (!lift.at) return false;
  const dx = p.x - lift.at.pos.x, dz = p.z - lift.at.pos.z, dy = p.y - lift.at.pos.y;
  return dx < -WALL_T + 0.05 && dx > -WALL_T - CAR_DEPTH && Math.abs(dz) < 0.88 && Math.abs(dy) < 1.2;
}
function inDoorway(p = player.pos) {
  const dx = p.x - lift.at.pos.x, dz = p.z - lift.at.pos.z, dy = p.y - lift.at.pos.y;
  return dx > -WALL_T - 0.4 && dx < 0.5 && Math.abs(dz) < LIFT_CFG.half + 0.2 && Math.abs(dy) < 1.2;
}
function landingInFront() {
  if (!lift.at || player.fly) return null;
  const fx = -Math.sin(player.yaw);
  for (const L of lift.landings) {
    const dx = player.pos.x - L.pos.x, dz = player.pos.z - L.pos.z, dy = player.pos.y - L.pos.y;
    if (dx > 0.1 && dx < 2.6 && Math.abs(dz) < 1.4 && Math.abs(dy) < 1.0 && fx < -0.35) return L;
  }
  return null;
}
function callLift(L) {
  if (lift.phase === 'travel' || lift.phase === 'closing') { lift.dest = lift.dest || L; return; }
  if (lift.at === L) { lift.phase = 'opening'; return; }
  lift.dest = L;
  lift.phase = lift.door > 0 ? 'closing' : 'travel';
  lift.t = 0;
}
function chooseFloor(fi) {
  const f = lift.floors[fi];
  if (!f || lift.phase === 'travel') return;
  const cur = lift.at;
  const L = f.landings.reduce((a, b) => (Math.abs(b.pos.z - cur.pos.z) < Math.abs(a.pos.z - cur.pos.z) ? b : a));
  if (L === cur) { lift.phase = 'opening'; return; }
  lift.dest = L;
  lift.phase = lift.door > 0 ? 'closing' : 'travel';
  lift.t = 0;
}
const liftPanel = document.getElementById('lift-panel');
const liftStatus = document.getElementById('lift-status');
// ---------------------------------------------------------------------------
// Doors that open: the 5F VIP lobby's double door (keycard) and the 1F restroom stalls.
// The door leaves are built here like the lift doors; press E to open (they swing
// away from you) and they close again once you have walked off.
// ---------------------------------------------------------------------------
const doors = [];
let doorCand = null;
// A door in doors.json sits in a wall along x at y (x0..x1), or with axis 'y' in a wall
// along y at x (y0..y1). Two leaves unless 'single' (hinged at x0 / y0); 'base' lifts
// the leaves off the floor (stall doors), 'stay' keeps it as you left it instead of
// closing after you walk off, 'ajar' (0..1) opens it that far at the start, towards
// 'out' (+1 / -1 along +y for a wall along x, along +x for a wall along y).
function buildDoors() {
  if (!DOORS_CFG) return;
  const wood = matByName.Walnut || new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.4 });
  const gold = matByName.BrushedGold || new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 1, roughness: 0.35 });
  for (const c of DOORS_CFG) {
    const alongY = c.axis === 'y';
    const a0 = alongY ? c.y0 : c.x0, a1 = alongY ? c.y1 : c.x1;
    const at = (t) => (alongY ? b2t(c.x, t, c.z) : b2t(t, c.y, c.z));
    const base = c.base || 0, lh = c.h - base;
    const w = (a1 - a0) / (c.single ? 1 : 2);
    const k = c.ajar || 0;
    const d = { c, k, want: k, dir: (alongY ? 1 : -1) * (c.out || 1), away: 0, leaves: [], alongY, center: at((a0 + a1) / 2) };
    const ends = c.single ? [[a0, 1]] : [[a0, 1], [a1, -1]];
    for (const [ha, s] of ends) {                           // hinge, and the way the leaf runs from it
      const frame = new THREE.Group();                     // turns the leaf into a wall along y
      frame.position.copy(at(ha));
      frame.position.y += base;
      if (alongY) frame.rotation.y = Math.PI / 2;
      const pivot = new THREE.Group();
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(w - 0.01, lh - 0.01, 0.06), wood);
      leaf.position.set(s * w / 2, lh / 2, 0);
      leaf.receiveShadow = true;
      for (const fz of [-1, 1]) {                          // a raised panel and a brass pull on each face
        const panel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.24, lh - 0.5, 0.012), wood);
        panel.position.set(0, 0.05, fz * 0.034);
        const pull = new THREE.Mesh(new THREE.BoxGeometry(0.025, Math.min(0.55, lh * 0.25), 0.025), gold);
        pull.position.set(s * (w / 2 - 0.1), -0.15, fz * 0.06);        // by the free edge, away from the hinge
        leaf.add(panel, pull);
      }
      pivot.add(leaf);
      frame.add(pivot);
      worldRoot.add(frame);
      dynColliders.push(leaf);
      d.leaves.push({ pivot, s });
    }
    doors.push(d);
    setDoorLeaves(d);
  }
}
function setDoorLeaves(d) {
  for (const L of d.leaves) {
    L.pivot.rotation.y = -L.s * d.dir * ease(d.k) * 1.45;
    L.pivot.updateMatrixWorld(true);
  }
}
const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function findDoor() {
  if (player.fly || !started) return null;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  for (const d of doors) {
    const dist = flatDist(player.pos, d.center);
    if (dist > 2.0 || Math.abs(player.pos.y - d.center.y) > 1.5) continue;
    if (((d.center.x - player.pos.x) * fx + (d.center.z - player.pos.z) * fz) / Math.max(dist, 0.01) < 0.3) continue;   // look at it
    return d;
  }
  return null;
}
function toggleDoor(d) {
  if (d.want) { d.want = 0; noise(0.5, 0.18, 180, 0.9, 0.7); return; }
  d.want = 1; d.away = 0;
  // swing away from whoever opens it (a leaf turns towards -y, or +x along y, for dir 1)
  d.dir = d.alongY ? (player.pos.x > d.center.x ? -1 : 1) : (player.pos.z > d.center.z ? -1 : 1);
  if (d.c.card) { tone(1760, 0, 0.08, 'sine', 0.05); tone(2349, 0.09, 0.12, 'sine', 0.05); }   // the keycard reader's beep
  else noise(0.35, 0.12, 300, 0.9, 0.6);
}
function updateDoors(dt) {
  for (const d of doors) {
    const dist = flatDist(player.pos, d.center);
    if (d.want && !d.c.stay && dist > 3.5) { if ((d.away += dt) > 2.5) toggleDoor(d); } else d.away = 0;   // closes after you walk off
    if (!d.want && d.k > 0 && dist < (d.c.single ? 0.45 : 0.9) && Math.abs(player.pos.y - d.center.y) < 1.5) d.want = 1;   // never shut on you
    const k = THREE.MathUtils.clamp(d.k + Math.sign(d.want - d.k) * dt / 0.9, Math.min(d.k, d.want), Math.max(d.k, d.want));
    if (k !== d.k) { d.k = k; setDoorLeaves(d); }
  }
}
function updateLift(dt) {
  if (!lift.car) { liftPanel.hidden = true; return; }
  const inside = inCar();
  lift.t += dt;
  if (lift.phase === 'opening') {
    lift.door = Math.min(1, lift.door + dt / 0.9);
    if (lift.door >= 1) { lift.phase = 'open'; lift.t = 0; }
  } else if (lift.phase === 'open') {
    if (inside || inDoorway()) lift.t = 0;
    else if (lift.t > 6) { lift.phase = 'closing'; lift.t = 0; }
  } else if (lift.phase === 'closing') {
    if (inDoorway() && !inside) { lift.phase = 'opening'; }
    else {
      lift.door = Math.max(0, lift.door - dt / 0.9);
      if (lift.door <= 0) { lift.phase = lift.dest ? 'travel' : 'idle'; lift.t = 0; }
    }
  } else if (lift.phase === 'travel') {
    const dur = 2.2 + Math.abs(lift.dest.pos.y - lift.at.pos.y) * 0.16;
    if (lift.t >= dur) {
      const delta = lift.dest.pos.clone().sub(lift.at.pos);
      if (inside) {
        player.pos.add(delta);
        player.eyeY += delta.y;
        if (sit.seat) { sit.seat = null; sit.k = 0; }
      }
      lift.at = lift.dest;
      lift.dest = null;
      placeCar();
      lift.phase = 'opening';
      lift.t = 0;
      if (inside) ding();
      renderer.shadowMap.needsUpdate = true;
    } else if (inside) {
      player.eyeY += Math.sin(lift.t * 40) * 0.0006;     // a faint hum in the floor
    }
  }
  const half = LIFT_CFG.half;
  for (const L of lift.landings) {
    const o = L === lift.at ? ease(lift.door) : 0;
    for (const leaf of L.leaves) {
      leaf.position.z = L.pos.z + leaf.userData.sz * (half / 2 + o * (half - 0.04));
      leaf.updateMatrixWorld();
    }
  }
  liftPanel.hidden = !(inside && started);
  if (!liftPanel.hidden) {
    const cur = lift.floors[lift.at.floor].id;
    let st = `目前 ${cur}`;
    if (lift.phase === 'travel') {
      const to = lift.floors[lift.dest.floor];
      st = `${lift.dest.pos.y > lift.at.pos.y ? '▲' : '▼'} 前往 ${to.id} ${to.zh}`;
    } else if (lift.phase === 'closing') st = '門關閉中…';
    if (liftStatus.textContent !== st) liftStatus.textContent = st;
    liftPanel.querySelectorAll('button[data-floor]').forEach((b) => {
      const fi = +b.dataset.floor;
      b.classList.toggle('here', fi === lift.at.floor && lift.phase !== 'travel');
      b.classList.toggle('going', !!lift.dest && fi === lift.dest.floor);
    });
  }
}

// ---------------------------------------------------------------------------
// Park rides. Each ride hangs its meshes on pivots, runs all the time, and
// offers "anchors" riding along with a seat; a rider's camera follows one.
// ---------------------------------------------------------------------------
const rides = [];
const rideTime = { t: 0 };
function meshesOf(part, idx = '') {
  const re = new RegExp(`^Rides_${part}${idx}_nocol`);
  return rideMeshes.filter((m) => re.test(m.name));
}
function pivotAt(pos, parent = worldRoot) {
  const g = new THREE.Group();
  g.position.copy(pos);
  worldRoot.add(g);
  g.updateMatrixWorld(true);
  if (parent !== worldRoot) parent.attach(g);
  return g;
}
function anchorAt(pos, yaw, parent, quat = null) {
  const a = new THREE.Object3D();
  a.position.copy(pos);
  if (quat) a.quaternion.copy(quat); else a.rotation.set(0, yaw, 0);
  worldRoot.add(a);
  a.updateMatrixWorld(true);
  parent.attach(a);
  return a;
}
const attachAll = (pivot, list) => { for (const m of list) pivot.attach(m); };

function buildCarousel(c) {
  const rotor = pivotAt(b2t(c.c[0], c.c[1], 0));
  attachAll(rotor, meshesOf('carousel'));
  const horses = c.horses.map((h, i) => {
    const piv = pivotAt(b2t(h.p[0], h.p[1], 0));
    attachAll(piv, meshesOf('horse', i));
    rotor.attach(piv);
    const [x, y, z] = h.saddle;
    const anchor = anchorAt(b2t(x, y, z + 0.82), h.yaw, piv);
    return { piv, base: piv.position.y, phase: h.phase, outer: h.outer, anchor };
  });
  return {
    key: 'carousel', zh: c.zh, en: c.en, board: b2t(...c.board), length: 42,
    update(dt, t) {
      rotor.rotation.y += c.omega * dt;
      for (const h of horses) h.piv.position.y = h.base + c.bob * (0.5 + 0.5 * Math.sin(c.bobRate * t + h.phase));
    },
    pick(from) {
      let best = null, bd = Infinity;
      for (const h of horses) {
        if (!h.outer) continue;
        const d = h.anchor.getWorldPosition(_w).distanceTo(from);
        if (d < bd) { bd = d; best = h.anchor; }
      }
      return best;
    },
  };
}

function buildTeacups(c) {
  const plat = pivotAt(b2t(c.c[0], c.c[1], 0));
  attachAll(plat, meshesOf('teaplat'));
  const cups = c.cups.map((cup, i) => {
    const piv = pivotAt(b2t(cup.p[0], cup.p[1], 0));
    attachAll(piv, meshesOf('cup', i));
    plat.attach(piv);
    const [x, y, z] = cup.seat;
    const anchor = anchorAt(b2t(x, y, z + 0.86), cup.yaw, piv);
    return { piv, spin: cup.spin, phase: cup.phase, anchor };
  });
  return {
    key: 'teacups', zh: c.zh, en: c.en, board: b2t(...c.board), length: 36,
    update(dt, t) {
      plat.rotation.y += c.omega * dt;
      for (const cup of cups) cup.piv.rotation.y = cup.spin * (c.spin * t + 0.9 * Math.sin(t * 0.37 + cup.phase)) + cup.phase;
    },
    pick(from) {
      let best = null, bd = Infinity;
      for (const cup of cups) {
        const d = cup.anchor.getWorldPosition(_w).distanceTo(from);
        if (d < bd) { bd = d; best = cup.anchor; }
      }
      return best;
    },
  };
}

function buildWheel(c) {
  const hub = b2t(...c.hub);
  const rotor = pivotAt(hub);
  attachAll(rotor, meshesOf('wheel'));
  const omega = 2 * Math.PI / 64;
  let angle = 0;
  const gondolas = c.angles.map((th, i) => {
    const hang = b2t(c.hub[0], c.hub[1] + c.R * Math.cos(th), c.hub[2] + c.R * Math.sin(th));
    const piv = pivotAt(hang);
    attachAll(piv, meshesOf('gondola', i));
    const [dx, dy, dz] = c.seat;
    const anchor = anchorAt(hang.clone().add(new THREE.Vector3(dx, dz + 0.72, -dy)), c.seatYaw, piv);
    return { th, piv, anchor, i };
  });
  let rider = null, travelled = 0;
  return {
    key: 'wheel', zh: c.zh, en: c.en, board: b2t(...c.board), length: Infinity,
    update(dt, t) {
      angle += omega * dt;
      if (rider) travelled += omega * dt;
      rotor.rotation.x = angle;
      for (const g of gondolas) {
        const a = g.th + angle;
        g.piv.position.set(hub.x, hub.y + c.R * Math.sin(a), hub.z - c.R * Math.cos(a));
        g.piv.rotation.x = 0.025 * Math.sin(t * 1.1 + g.i);
      }
    },
    pick() {
      let best = null, low = Infinity;
      for (const g of gondolas) { const y = g.piv.position.y; if (y < low) { low = y; best = g; } }
      rider = best; travelled = 0;
      return best.anchor;
    },
    finished() { return travelled > 2 * Math.PI - 0.12; },
    exit() { rider = null; },
  };
}

function buildCoaster(c) {
  const n = c.rows.length, L = c.len, step = c.step;
  const P = [], T = [], U = [];
  for (const r of c.rows) {
    P.push(b2t(r[0], r[1], r[2]));
    T.push(new THREE.Vector3(r[3], r[5], -r[4]));
    U.push(new THREE.Vector3(r[6], r[8], -r[7]));
  }
  const _t = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3(), _f = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const wrap = (s) => ((s % L) + L) % L;
  function sample(s, outP, outQ) {
    const x = wrap(s) / step, i = Math.floor(x) % n, j = (i + 1) % n, f = x - Math.floor(x);
    outP.lerpVectors(P[i], P[j], f);
    if (outQ) {
      _t.lerpVectors(T[i], T[j], f).normalize();
      _u.lerpVectors(U[i], U[j], f);
      _u.addScaledVector(_t, -_u.dot(_t)).normalize();
      _r.crossVectors(_t, _u);
      _m.makeBasis(_r, _u, _f.copy(_t).negate());
      outQ.setFromRotationMatrix(_m);
    }
  }
  const cars = c.cars.map((car, i) => {
    const pos = new THREE.Vector3(), q = new THREE.Quaternion();
    sample(car.s, pos, q);
    const piv = pivotAt(pos);
    attachAll(piv, meshesOf('car', i));
    return { piv, s0: car.s, q0inv: q.clone().invert() };
  });
  const sp = new THREE.Vector3(), sq = new THREE.Quaternion();
  sample(c.cars[0].s, sp, sq);
  const [sx, sy, sz] = c.seat;
  _r.crossVectors(_t, _u);
  sp.addScaledVector(_r, sx).addScaledVector(_t, sy).addScaledVector(_u, sz);
  const anchor = anchorAt(sp, 0, cars[0].piv, sq);
  const train = { s: c.station, v: 0, mode: 'wait', t: 0, dist: 0, rider: false, ready: false };
  const LIFT_V = 3.6;
  const inRange = (s, a, b) => s >= a && s <= b;
  return {
    key: 'coaster', zh: c.zh, en: c.en, board: b2t(...c.board), length: Infinity, train,
    update(dt) {
      train.t += dt;
      if (train.mode === 'wait') {
        const go = train.rider ? (train.ready && train.t > 2.0) : train.t > 16;
        if (go) { train.mode = 'run'; train.t = 0; train.dist = 0; train.v = 0.6; }
      } else {
        const sub = 4, h = dt / sub;
        for (let k = 0; k < sub && train.mode === 'run'; k++) {
          const s = wrap(train.s);
          const tz = T[Math.floor(s / step) % n].y;
          if (inRange(s, c.station, c.lift[1])) {
            if (train.v < LIFT_V) train.v = Math.min(LIFT_V, train.v + 1.6 * h);   // tyres, then the chain
            else if (inRange(s, c.lift[0], c.lift[1])) train.v = Math.max(LIFT_V, train.v - 2 * h);
          } else {
            train.v += (-GRAVITY * tz - 0.002 * train.v * train.v - 0.08) * h;
          }
          const rest = L - train.dist;
          if (rest < 48) train.v = Math.min(train.v, Math.sqrt(2 * 1.5 * Math.max(0, rest)) + 0.12);   // brakes
          train.v = Math.max(train.v, rest < 0.4 ? 0 : 1.0);
          const ds = Math.min(train.v * h, rest);
          train.dist += ds;
          train.s += ds;
          if (rest - ds <= 1e-3) { train.mode = 'wait'; train.t = 0; train.v = 0; train.s = c.station; train.dist = 0; train.arrived = true; train.ready = false; }
        }
      }
      for (const car of cars) {
        sample(train.s + (car.s0 - c.station), car.piv.position, car.piv.quaternion);
        car.piv.quaternion.multiply(car.q0inv);
      }
    },
    pick() { train.rider = true; train.ready = false; train.arrived = false; return anchor; },
    seated() { train.ready = true; train.t = Math.min(train.t, 0.5); },
    available() { return train.mode === 'wait'; },
    finished() { return train.arrived && train.mode === 'wait' && train.t > 1.2; },
    exit() { train.rider = false; train.ready = false; train.arrived = false; },
    shake() { return train.mode === 'run' ? Math.min(1, train.v / 14) : 0; },
  };
}

function buildSwans(c) {
  const n = c.path.length, L = c.len, step = c.step;
  const P = c.path.map(([x, y]) => b2t(x, y, 0.22));
  const wrap = (s) => ((s % L) + L) % L;
  const _a = new THREE.Vector3();
  function at(s, out) {
    const x = wrap(s) / step, i = Math.floor(x) % n, j = (i + 1) % n;
    out.lerpVectors(P[i], P[j], x - Math.floor(x));
    _a.subVectors(P[(i + 2) % n], P[(i - 1 + n) % n]);
    return Math.atan2(-_a.x, -_a.z);        // yaw: forward is (-sin, -cos)
  }
  const boats = c.boats.map((b, i) => {
    const pos = new THREE.Vector3();
    const yaw0 = at(b.s, pos);
    const piv = pivotAt(pos);
    attachAll(piv, meshesOf('swan', i));
    const [x, y, z] = b.seat;
    const anchor = anchorAt(b2t(x, y, z + 0.72), yaw0, piv);
    return { piv, s: b.s, yaw0, anchor, i, base: pos.y };
  });
  const toDock = (b) => { const d = wrap(c.dock - b.s); return Math.min(d, L - d); };
  let rider = null, travelled = 0;
  return {
    key: 'swans', zh: c.zh, en: c.en, board: b2t(...c.board), length: Infinity, waitText: '等待天鵝船靠岸…',
    update(dt, t) {
      for (const b of boats) {
        b.s += c.speed * dt;
        const yaw = at(b.s, b.piv.position);
        b.piv.position.y = b.base + 0.03 * Math.sin(t * 1.3 + b.i * 1.7);
        b.piv.rotation.set(0.015 * Math.sin(t * 0.9 + b.i), yaw - b.yaw0, 0.02 * Math.sin(t * 1.1 + b.i), 'YXZ');
      }
      if (rider) travelled += c.speed * dt;
    },
    available() { return boats.some((b) => toDock(b) < 2.5); },
    pick() {
      rider = boats.reduce((a, b) => (toDock(b) < toDock(a) ? b : a));
      travelled = 0;
      return rider.anchor;
    },
    finished() { return travelled > L - 0.5; },
    exit() { rider = null; },
  };
}

function buildRides() {
  if (!RIDES_CFG) return;
  const make = { carousel: buildCarousel, teacups: buildTeacups, wheel: buildWheel, coaster: buildCoaster, swans: buildSwans };
  for (const [k, cfg] of Object.entries(RIDES_CFG)) if (make[k]) rides.push(make[k](cfg));
}

// riding state
const riding = { ride: null, anchor: null, k: 0, dir: 0, t: 0, standPos: new THREE.Vector3(), standEye: 0, yaw0: 0, pitch0: 0, fromQ: new THREE.Quaternion(), fromP: new THREE.Vector3() };
let rideCand = null, rideQueued = null;
const rideHud = document.getElementById('ride-hud');
const rideName = document.getElementById('ride-name');
const _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _look = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

function findRide() {
  if (player.fly || riding.ride || sit.seat || !started) return null;
  let best = null, bd = 2.6;
  for (const r of rides) {
    const d = Math.hypot(r.board.x - player.pos.x, r.board.z - player.pos.z);
    if (d < bd && Math.abs(r.board.y - player.pos.y) < 1.3) { bd = d; best = r; }
  }
  return best;
}
function board(r) {
  if (r.available && !r.available()) { rideQueued = r; return; }
  rideQueued = null;
  riding.ride = r;
  riding.anchor = r.pick(camera.position);
  riding.k = 0; riding.dir = 1; riding.t = 0;
  riding.standPos.copy(player.pos);
  riding.standEye = player.eyeY;
  riding.yaw0 = player.yaw; riding.pitch0 = player.pitch;
  riding.fromP.copy(camera.position);
  riding.fromQ.copy(camera.quaternion);
  player.yaw = 0; player.pitch = -0.05;
  keys.clear();
  diag(`board ${r.key}`);
}
function leaveRide() {
  if (!riding.ride || riding.dir < 0) return;
  riding.dir = -1;
  riding.fromP.copy(camera.position);
  riding.fromQ.copy(camera.quaternion);
  riding.k = 1;
}
function updateRiding(dt) {
  rideTime.t += dt;
  for (const r of rides) r.update(dt, rideTime.t);
  updatePortal(dt, rideTime.t);
  if (rideQueued && (!rideQueued.available || rideQueued.available())) {
    if (Math.hypot(rideQueued.board.x - player.pos.x, rideQueued.board.z - player.pos.z) < 3.5) board(rideQueued);
    else rideQueued = null;
  }
  const R = riding.ride;
  if (!R) return false;
  riding.t += dt;
  riding.anchor.updateWorldMatrix(true, false);
  riding.anchor.getWorldPosition(_w);
  riding.anchor.getWorldQuaternion(_q);
  _e.set(player.pitch, player.yaw, 0);
  _look.setFromEuler(_e);
  _q.multiply(_look);
  const shake = R.shake ? R.shake() : 0;
  if (shake) _w.y += Math.sin(rideTime.t * 41) * 0.012 * shake + Math.sin(rideTime.t * 23) * 0.008 * shake;
  if (riding.dir > 0) {
    riding.k = Math.min(1, riding.k + dt / 1.1);
    const e = ease(riding.k);
    camera.position.lerpVectors(riding.fromP, _w, e);
    camera.quaternion.slerpQuaternions(riding.fromQ, _q, e);
    if (riding.k >= 1 && R.seated && !riding.seatedSent) { riding.seatedSent = true; R.seated(); }
    const auto = R.finished ? R.finished() : riding.t > R.length;
    if (riding.k >= 1 && auto) leaveRide();
  } else {
    riding.k = Math.max(0, riding.k - dt / 1.1);
    const e = ease(1 - riding.k);
    _w.set(riding.standPos.x, riding.standEye, riding.standPos.z);
    _e.set(riding.pitch0, riding.yaw0, 0);
    _q.setFromEuler(_e);
    camera.position.lerpVectors(riding.fromP, _w, e);
    camera.quaternion.slerpQuaternions(riding.fromQ, _q, e);
    if (riding.k <= 0) {
      R.exit?.();
      player.pos.copy(riding.standPos);
      player.eyeY = riding.standEye;
      player.yaw = riding.yaw0; player.pitch = riding.pitch0;
      riding.ride = null; riding.anchor = null; riding.seatedSent = false;
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Seats: walk up to a chair, sofa, stool, bench or lounger and press E to sit; on a
// bed (its seat is at the pillow, facing the foot) you lie down and look up.
// ---------------------------------------------------------------------------
let SEATS = [];
const SEAT_EYE = { lounger: 0.48, stool: 0.7, bed: 0.2 };   // eye height above the seat (default 0.72)
const SEAT_PITCH = { lounger: 0.08, bed: 0.95 };            // where you look once seated (default -0.06)
const RECLINED = new Set(['lounger', 'bed']);
const sit = { seat: null, k: 0, dir: 0, standPos: new THREE.Vector3(), standEye: 0, yaw0: 0, pitch0: 0 };
let candidate = null, liftCall = null, portalCand = false;
const seatRing = new THREE.Mesh(
  new THREE.RingGeometry(0.2, 0.26, 40),
  new THREE.MeshBasicMaterial({ color: 0xf2c46d, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide }));
seatRing.rotation.x = -Math.PI / 2;
seatRing.renderOrder = 10;
seatRing.visible = false;
scene.add(seatRing);
const seatBtn = document.getElementById('seat-btn');
const seatLabel = seatBtn.querySelector('span');

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t) => t * t * (3 - 2 * t);

function findSeat() {
  if (!SEATS.length || player.fly || sit.seat || !collider) return null;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  let best = null, bestScore = Infinity;
  for (const st of SEATS) {
    const dx = st.pos.x - player.pos.x, dz = st.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 2.2 || Math.abs(st.pos.y - player.pos.y - 0.5) > 0.8) continue;
    const cos = d < 0.35 ? 1 : (dx * fx + dz * fz) / d;
    if (cos < 0.72) continue;
    const score = d * (2.2 - cos);
    if (score < bestScore) { bestScore = score; best = st; }
  }
  if (best) {   // no sitting through walls or glass
    _o.set(player.pos.x, player.pos.y + 1.2, player.pos.z);
    const to = new THREE.Vector3(best.pos.x, best.pos.y + 0.12, best.pos.z).sub(_o);
    const len = to.length();
    const h = castHit(_o, to.normalize(), len);
    if (h && h.distance < len - 0.5) best = null;
  }
  return best;
}
function sitDown(st) {
  sit.seat = st;
  sit.dir = 1;
  sit.k = 0;
  sit.standPos.copy(player.pos);
  sit.standEye = player.eyeY;
  sit.yaw0 = player.yaw;
  sit.pitch0 = player.pitch;
  keys.clear();
}
function standUp() { if (sit.seat && sit.dir > 0) sit.dir = -1; }

// ---------------------------------------------------------------------------
// Characters: rigged models placed in a world. They breathe, look at you when
// you come close, wave hello and do little things on their own. Press E to talk:
// a menu lets you ask about the place, be guided somewhere (walking along with
// you, or straight there with a fade), take photos together, high-five or hug.
// Look up at the head and press E to pat it. Each character can be switched on
// or off in the 角色 panel; the choice is remembered.
// Bones follow the Mixamo naming that Tripo's auto-rig uses.
// ---------------------------------------------------------------------------
// Where the hotel mascot can take you. Routes are Blender plan points from her
// post by the concierge desk, through the gaps between the lobby columns and
// their benches, around the flower table and the lounges; she stops at the last point to introduce the place.
const HOTEL_GUIDE = {
  cafe: {
    zh: '咖啡廳', route: [[0.0, 6.4], [13.0, 6.4], [17.0, 4.6], [21.6, 4.3]],
    intro: ['這裡就是 Aurora Café！手沖咖啡和現烤可頌是招牌 ☕', '靠窗的座位看得到正門廣場的噴泉，下午來坐坐最舒服了～'],
  },
  buffet: {
    zh: '自助餐廳', route: [[-3.0, 9.0], [-7.0, 15.0], [-8.0, 18.4], [-18.0, 18.4], [-21.6, 18.2]],
    intro: ['The Market 自助餐廳到了！早餐有現做蛋捲和鬆餅 🍳', '晚餐還有海鮮吧和甜點櫃，記得留點肚子給蛋糕喔 🍰'],
  },
  reception: {
    zh: '接待櫃檯', route: [[-1.5, 8.0], [8.5, 9.6], [11.5, 9.6], [13.4, 12.6]],
    intro: ['這是接待櫃檯，辦理入住、退房、寄放行李都可以找櫃檯人員喔！', '有任何需要，櫃檯 24 小時都有人在 🛎️'],
  },
  stairs: {
    zh: '大階梯', route: [[-3.0, 9.0], [-2.7, 16.0], [0.0, 17.8]],
    intro: ['這座大理石大階梯通往二樓的夾層 ✨', '上面有 Le Jardin 花園酒吧和精品店，走上去逛逛吧～'],
  },
  lift: {
    zh: '電梯', route: [[-3.0, 9.0], [-7.0, 15.0], [-7.5, 21.6], [-17.6, 21.4]],
    intro: ['電梯到了！在電梯門前按「呼叫電梯」，進去以後選樓層就可以 🛗', '可以到客房樓層和總統套房，最上面的 RF 就是空中酒吧喔！'],
  },
  gym: {
    zh: '健身房', route: [[-3.0, 9.0], [-7.0, 15.0], [-7.0, 26.5], [-9.4, 29.0], [-9.4, 32.2]],
    intro: ['Aurora Fitness 健身房，24 小時開放 💪', '運動完可以去隔壁的室內泳池放鬆一下～'],
  },
  pool: {
    zh: '室內泳池', route: [[-1.5, 8.0], [6.5, 8.5], [6.5, 26.5], [9.4, 29.0], [9.4, 31.6], [10.0, 33.2]],
    intro: ['AQUA 室內溫水泳池到了～ 🏊', '池邊有躺椅，走過去按 E 就可以躺下來休息，超療癒的！'],
  },
};
const CHARACTERS = [
  {
    id: 'bear', world: 'hotel', zh: '奧蘿拉熊', en: 'Aurora Bear', role: '飯店吉祥物', lookUp: 0.15, lookSide: 0.35,
    file: 'characters/maid_bear/maid_bear.gltf.json', p: [-3.2, 4.2, 0.04], face: [0.0, 0.0], height: 1.9,   // a little taller than the visitor's body
    hello: '啊……歡、歡迎光臨 Grand Aurora……我是飯店的吉祥物，奧蘿拉熊 🐻 那個……有什麼熊熊可以幫您的嗎？',
    again: '嗯嗯……還有什麼需要的嗎？熊熊慢慢聽您說 🍵',
    guide: HOTEL_GUIDE,
    menu: [
      {
        label: '介紹飯店', lines: [
          '這裡是 Grand Aurora 五星級大飯店……頭上那盞水晶吊燈，熊熊每天都會看它發呆一下下 ✨',
          '大廳東邊是 Aurora Café 咖啡廳，西邊是 The Market 自助餐廳……兩邊都有甜點喔，熊熊都吃過了。',
          '泳池和健身房在大廳北邊，二樓的夾層有花園酒吧和精品店。',
          '樓上是客房和總統套房……頂樓 RF 的空中酒吧可以看夜景，不過熊熊有點怕高，都站在中間看 🌃',
        ],
      },
      { label: '帶我去…', guide: true },
      {
        label: '推薦餐廳', lines: [
          '肚子餓了嗎……？大廳東邊的 Aurora Café，草莓蛋糕是熊熊心中的第一名 🍰',
          '想吃豐盛一點的話，西邊的 The Market 自助餐廳從早餐到晚餐都有……甜點區的馬卡龍塔，熊熊每次都想整座帶走。',
          '晚上的話，二樓的 Le Jardin 花園酒吧很安靜，熊熊喜歡在那裡喝熱可可，喝著喝著就睡著了 🍫',
        ], go: ['cafe', 'buffet'],
      },
      {
        label: '怎麼去空中酒吧', lines: [
          '空中酒吧在頂樓 RF……先到大廳西側的電梯，按「呼叫電梯」，進去以後選 RF 就到了。',
          '傍晚去最漂亮 🌇 ……熊熊會站在離欄杆遠一點的地方，您不要笑熊熊喔。',
        ], go: ['lift'],
      },
      {
        label: '傳送門是什麼', lines: [
          '正門廣場的西邊有一座金色的傳送門 ✨',
          '走到門前按 E，就能去別的世界……童話王國的虎寶是熊熊的好朋友，不過她好吵……啊，不是，是很有精神 😅',
        ], portal: true,
      },
      { label: '再見 👋', bye: ['好的……祝您住得舒服，晚上要好好睡喔。熊熊會在大廳等您 🐻💤'] },
    ],
    pats: ['呼啊～……好舒服，熊熊要睡著了 💤', '……嗯嗯，再、再一下下就好 ♡', '熊熊的毛今天有梳過喔……軟嗎？', '被摸頭……有點害羞，可是好開心 ☺️'],
    // little outings while idle: a stroll near the post, or a rest on the lobby bench
    outings: [
      { via: [[-1.2, 6.4]] },
      { via: [[-1.3, 2.6]] },
      { via: [[-3.5, 7.6], [-8.9, 8.0]], seat: [-10.05, 8.0], h: 0.5 },
    ],
  },
  // Starlight Kingdom's mascot: 虎寶 the tiger, just inside the gate on Main Street
  {
    id: 'tiger', world: 'park', zh: '虎寶', en: 'Kingdom Tiger', role: '童話王國吉祥物', mascot: true, lookUp: 0.15, lookSide: 0.35,
    file: 'characters/park_tiger/park_tiger.gltf.json', p: [4.0, -91.5, 0.05], face: [4.0, -112.0], height: 1.9, gap: 2.4,   // her coat and tail need room
    hello: '吼！！歡迎來到星光童話王國！我是王國最強的吉祥物——虎寶！🐯 搭檔，今天要先衝哪一個？',
    again: '還有什麼要問的？快快快，雲霄飛車不等人的啦！',
    idles: ['nod', 'look', 'yay'],
    menu: [
      {
        label: '介紹童話王國', lines: [
          '聽好囉！從大門直直衝就是童話大街，兩邊都是小店，虎寶的炸雞攤也在那裡 🍗',
          '大街到底是星光廣場，星星噴泉後面就是星光城堡！',
          '西邊有旋轉木馬和瘋狂茶杯，東邊是摩天輪和天鵝湖……然後！城堡後面就是全王國最刺激的飛龍雲霄飛車！吼～ 🎢',
        ],
      },
      { label: '帶我去…', guide: true },
      {
        label: '推薦好玩的', lines: [
          '當然是飛龍雲霄飛車！虎寶今天已經坐第十二次了，每次都坐第一排，雙手舉高高！🎢',
          '茶杯也很讚，虎寶的紀錄是轉 47 圈不頭暈……好啦，下來的時候有一點點暈。',
        ], trips: [
          { label: '去摩天輪', line: '摩天輪到了！雖然有點慢……但最上面的風景還是很讚啦 🎡', p: [44.0, 10.0, 0.04], yaw: -Math.PI / 2 },
          { label: '去雲霄飛車', line: '到啦！衝第一排！不准閉眼睛喔，搭檔！🐉', p: [-20.0, 76.0, 0.04], yaw: 0 },
          { label: '去瘋狂茶杯', line: '茶杯到了！來比賽誰轉得比較快，輸的請吃炸雞！🌀', p: [-34.5, -21.6, 0.04], yaw: 2.129 },
        ],
      },
      { label: '售票處在哪', lines: ['大門左手邊那間小屋！米雅姊姊在裡面，她講話好溫柔，跟虎寶完全相反，哈哈！', '米露在星光廣場巡邏，她是虎寶的茶杯對手，目前戰績 23 比 23！'] },
      { label: '你認識奧蘿拉熊嗎？', lines: ['熊熊？當然！她是虎寶最好的朋友 🐻🐯', '不過她動作好慢，上次約好一起坐雲霄飛車，她走到一半就在長椅上睡著了……虎寶只好一個人坐了三次！'] },
      { label: '再見 👋', bye: ['吼！下次再來要找虎寶喔！搭檔，說好了！🐯✊'] },
    ],
    pats: ['吼嚕嚕……不、不是很舒服啦！……好吧，有一點 😤', '虎寶的毛是全王國最蓬的！', '帽子！帽子不要弄歪！……好啦，再摸一下 🎩', '嘿嘿……被摸頭也是一種修行！'],
    // little strolls on Main Street, just inside the gate
    outings: [{ via: [[2.0, -89.0]] }, { via: [[6.0, -89.5]] }, { via: [[4.0, -87.0]] }],
  },
  // Aurora Galleria's mascot: 小楓 the fox, in the entrance hall
  {
    id: 'fox', world: 'mall', zh: '小楓', en: 'Galleria Fox', role: '購物中心吉祥物', mascot: true, lookUp: 0.15, lookSide: 0.35,
    file: 'characters/mall_fox/mall_fox.gltf.json', p: [-3.0, 4.5, 0.02], face: [0.0, 0.0], height: 1.9, gap: 2.4,   // her brush needs room
    hello: '哎呀，你來啦～歡迎光臨 Aurora Galleria。我是這裡的吉祥物小楓 🦊 今天想讓我陪你逛哪裡呢？',
    again: '還有什麼想問的嗎？慢慢想，我不急……反正我也想多跟你待一會兒 😌',
    idles: ['nod', 'look', 'spin'],
    menu: [
      {
        label: '介紹購物中心', lines: [
          'Aurora Galleria 有三層樓，中間是挑高的中庭迴廊，正中央那座噴泉，晚上打燈的時候特別迷人 ⛲',
          '1 樓有 3C、咖啡廳和 FRESH MART 超市；2 樓是服飾、書店和玩具店。',
          '3 樓有美食街和 Aurora Cinemas……看電影的時候，坐後排比較安靜喔，懂嗎？😏',
        ],
      },
      { label: '帶我去…', guide: true },
      {
        label: '推薦好逛的', lines: [
          '2 樓的服飾店是我的私房推薦。你穿什麼好看，我可以幫你挑……我的眼光可是很好的 👗',
          '逛累了就上 3 樓吃點東西，最後到 1 樓 Sweet Hours，點一塊蛋糕，兩支叉子 🍰',
        ], trips: [
          { label: '去服飾店', line: '到了。這件綠色洋裝跟我的很像吧？你覺得我穿哪一件比較好看？👗', p: [-11.5, 17.8, 5.5], yaw: Math.PI },
          { label: '去美食街', line: '美食街到了～餓了就別客氣，我看著你吃也很開心 🍜', p: [-28.0, 41.5, 11.0], yaw: 0 },
          { label: '去咖啡廳', line: 'Sweet Hours 到了。坐窗邊吧，光線好，你看起來也特別好看 🍰', p: [22.5, 17.8, 0.02], yaw: Math.PI },
        ],
      },
      { label: '服務台在哪', lines: ['直直往前走，中庭迴廊前面那個小櫃檯就是服務台，米雅在那裡。', '不過有什麼事，先來找我也可以喔……我比較會照顧人 😌'] },
      { label: '你認識其他吉祥物嗎？', lines: ['大飯店的奧蘿拉熊和童話王國的虎寶？當然認識，兩個都是可愛的小妹妹 🐻🐯', '她們老是吵誰的點心好吃……我嘛，比較在意今天是誰來陪我逛街 🦊'] },
      { label: '再見 👋', bye: ['要走啦？……好吧，路上小心。下次來，記得先來找我，嗯？🦊'] },
    ],
    pats: ['嗯……手很溫柔嘛 ♡', '耳朵是很敏感的地方喔，你知道嗎？😌', '再摸一下也可以……只有你可以 ♡', '帽子別弄歪了，我可是為你打扮的 🎀'],
    // little strolls in the entrance hall
    outings: [{ via: [[-1.5, 7.0]] }, { via: [[-3.5, 9.5]] }, { via: [[-2.0, 2.5]] }],
  },
  // Hotel staff: Tripo robots in uniform. They bow instead of waving.
  ...[
    {
      id: 'staff_desk', zh: '米雅', role: '接待員 · 姊姊', p: [17.15, 13.0, 0.04], face: [0.0, 13.0],
      // out from behind the desk (round its north end) to where the bear's routes start
      guide: HOTEL_GUIDE, noGuide: ['reception'], lead: [[17.15, 19.3], [12.0, 19.6], [7.0, 19.6], [4.5, 9.5]],
      // up and down behind the desk, and a rest on one of the desk chairs (facing the counter)
      outings: [{ via: [[17.15, 9.6]] }, { via: [[17.15, 16.0]] }, { via: [[17.1, 14.95]], seat: [16.65, 14.3], h: 0.58, face: [10.0, 14.3] }],
      hello: '歡迎光臨 Grand Aurora，我是接待員米雅。請問需要什麼服務呢？',
      menu: [
        {
          label: '辦理入住 🛎️', lines: ['好的，馬上為您辦理入住。', '請問要哪一種房型呢？'], trips: [
            { label: '豪華客房 4007', line: '這是您的房卡，4007 號房在 4 樓，我送您上去 🔑', p: [3.0, 11.4, 12.79], yaw: Math.PI },
            { label: '總統套房', line: '總統套房在 5 樓，電梯會先到 VIP 大廳，刷房卡打開大門就能進入套房，請享受 ✨', p: [-17.6, 21.0, 16.55], yaw: -Math.PI / 2 - 0.4 },
          ],
        },
        { label: '寄放行李', lines: ['行李交給我們就好！離開前到櫃檯出示房卡就能領回 🧳'] },
        { label: '退房', lines: ['退房時間是中午 12 點，房卡直接交給櫃檯就可以。', '感謝您的入住，期待再次為您服務！'] },
        { label: 'Wi-Fi 密碼', lines: ['網路名稱是 Aurora-Guest，密碼是 aurora2026 📶'] },
        { label: '妳們是姊妹嗎？', lines: ['對呀，在大廳巡視、穿紅色制服的米露是我妹妹 😊', '她比較活潑，常常在大廳走來走去；我比較文靜，所以負責櫃檯。'] },
        { label: '一起拍照 📸', photo: true },
        { label: '再見', bye: ['祝您住宿愉快，有需要隨時來櫃檯找我們。'] },
      ],
    },
    {
      id: 'staff_lobby', zh: '米露', role: '大廳服務員 · 妹妹', p: [7.0, 8.5, 0.04], face: [7.0, 16.0],
      guide: HOTEL_GUIDE, lead: [[4.5, 8.5]],
      file: 'characters/staff_lulu/staff_lulu.gltf.json',   // her own red uniform
      patrol: [[7.0, 8.5], [7.0, 16.0], [-7.0, 16.0], [-7.0, 8.5]],
      hello: '您好，我是大廳服務員米露～有什麼可以為您服務的嗎？',
      menu: [
        {
          label: '洗手間在哪', lines: ['洗手間在電梯廳旁邊！沿著大廳西側往北走，最裡面那面牆上有兩扇門，左邊是男廁、右邊是女廁 🚻', '走到門前按 E 就能開門喔～'], trips: [
            { label: '帶我過去', line: '到了！左邊是男廁、右邊是女廁 🚻', p: [-16.3, 27.6, 0.04], yaw: 0 },
          ],
        },
        {
          label: '推薦去哪裡', lines: ['推薦您到頂樓的空中酒吧看夜景，或是去室內泳池放鬆一下～'], trips: [
            { label: '去空中酒吧', line: '好的，祝您有個美好的夜晚 🍸', p: [-12.5, 24.2, 24.8], yaw: -Math.PI / 2 - 0.5 },
            { label: '去室內泳池', line: '泳池的水溫是 28 度，記得帶毛巾喔 🏊', p: [10, 32.2, 0.04], yaw: 0 },
          ],
        },
        { label: '妳們是姊妹嗎？', lines: ['嘿嘿，被發現了！櫃檯穿藍色制服的米雅是我姊姊 💙', '姊姊很溫柔，可是我偷偷跟你說，她坐下來看電腦的時候常常打瞌睡喔 🤫'] },
        { label: '我需要幫忙', lines: ['沒問題！不管是找路、叫客房服務還是借充電器，都可以找我們。', '櫃檯的米雅姊姊也 24 小時都在喔。'] },
        { label: '一起拍照 📸', photo: true },
        { label: '再見', bye: ['祝您在 Grand Aurora 玩得愉快！'] },
      ],
    },
    // the sisters also work at Aurora Galleria: 米雅 at the information desk, 米露 on the floor
    {
      // behind the square INFORMATION counter (2.45 x 2.05 m, 1.1 m high), talked to across it
      id: 'mall_desk', world: 'mall', en: 'Mall Staff', zh: '米雅', role: '服務台 · 姊姊', p: [0.0, 20.5, 0.02], face: [0.0, 0.0], reach: 3.6,
      // along behind the counter, and a rest on the desk chair
      outings: [{ via: [[-1.0, 20.5]] }, { via: [[0.4, 20.45]] }, { via: [[0.75, 20.2]], seat: [0.75, 20.75], h: 0.56, face: [0.75, 0.0] }],
      file: 'characters/staff_robot/staff_robot.gltf.json',
      hello: '歡迎光臨 Aurora Galleria！我是服務台的米雅，需要幫您找店嗎？',
      menu: [
        {
          label: '樓層導覽', lines: ['1 樓有超市、3C 和咖啡廳，2 樓是服飾、書店和玩具店，3 樓是美食街和電影院。', '想去哪一家，我可以直接送您過去 ✨'], trips: [
            { label: '超市 FRESH MART', line: '超市在 1 樓北側，今天蔬果區有特價喔 🥬', p: [21.5, 42.2, 0.02], yaw: 0 },
            { label: '玩具店', line: '玩具店在 2 樓，最近進了好多新的積木 🧸', p: [22.5, 42.2, 5.5], yaw: 0 },
            { label: '美食街', line: '美食街在 3 樓，祝您用餐愉快 🍜', p: [-28.0, 41.5, 11.0], yaw: 0 },
            { label: '電影院', line: '電影院在 3 樓東側，記得帶爆米花 🍿', p: [17.0, 41.5, 11.0], yaw: 0 },
          ],
        },
        { label: '寄物服務', lines: ['購物袋太多的話，可以先寄放在服務台，離開前再來領就好 🛍️'] },
        { label: '失物招領', lines: ['目前撿到一把藍色雨傘和一隻小熊吊飾，如果是您的請告訴我～'] },
        { label: '妳不是在飯店嗎？', lines: ['對呀，我和妹妹米露平常在 Grand Aurora 大飯店上班。', '購物中心這邊也是我們姊妹負責，從傳送門過來只要一下子 😊'] },
        { label: '一起拍照 📸', photo: true },
        { label: '再見', bye: ['祝您購物愉快，歡迎再度光臨！'] },
      ],
    },
    {
      id: 'mall_floor', world: 'mall', en: 'Mall Staff', zh: '米露', role: '樓層服務員 · 妹妹', p: [-6.2, 24.0, 0.02], face: [6.2, 24.0],
      file: 'characters/staff_lulu/staff_lulu.gltf.json',
      patrol: [[-6.2, 24.0], [6.2, 24.0], [6.2, 35.6], [-6.2, 35.6]],
      hello: '歡迎來到 Aurora Galleria～我是樓層服務員米露！',
      menu: [
        {
          label: '哪裡好吃？', lines: ['3 樓美食街的拉麵和韓式炸雞最多人排隊！', '想吃甜點的話，1 樓的 Sweet Hours 咖啡廳蛋糕超好吃 🍰'], trips: [
            { label: '去美食街', line: '出發～記得幫我多吃一口 😋', p: [-28.0, 41.5, 11.0], yaw: 0 },
            { label: '去咖啡廳', line: '咖啡廳到了，推薦草莓鮮奶油蛋糕！', p: [22.5, 17.8, 0.02], yaw: Math.PI },
          ],
        },
        { label: '今天有什麼活動？', lines: ['電影院這週末有新片首映，超市下午也有試吃活動喔！', '中央廣場的噴泉每到整點會亮起來，很漂亮 ✨'] },
        { label: '洗手間在哪', lines: ['每一層樓的西側電梯旁邊都有洗手間 🚻'] },
        { label: '姊姊在哪裡？', lines: ['米雅姊姊在入口附近的服務台，就是寫著 INFORMATION 的那個圓形櫃檯～', '找不到店的話問她準沒錯！'] },
        { label: '一起拍照 📸', photo: true },
        { label: '再見', bye: ['祝您逛得開心，掰掰～'] },
      ],
    },
    // ... and at Starlight Kingdom: 米雅 by the west ticket booth, 米露 round the Star Fountain
    {
      // inside the west ticket booth, at its window; its door opens on the side facing the gate
      id: 'park_desk', world: 'park', en: 'Park Staff', zh: '米雅', role: '售票處 · 姊姊', p: [-17.5, -98.2, 0.08], face: [-17.5, -112.0], reach: 3.6,
      outings: [{ via: [[-16.4, -98.2]] }, { via: [[-17.0, -97.6]] }, { via: [[-18.6, -97.8]], seat: [-18.6, -97.05], h: 0.54, face: [-18.6, -112.0] }],
      file: 'characters/staff_robot/staff_robot.gltf.json',
      hello: '歡迎來到星光童話王國！我是遊客服務的米雅，需要幫您介紹園區嗎？',
      menu: [
        {
          label: '園區導覽 🗺️', lines: ['從大門直走是童話大街，盡頭的星光廣場有噴泉，再往北就是星光城堡。', '旋轉木馬和茶杯在西邊，摩天輪和天鵝湖在東邊，雲霄飛車在城堡後面。想去哪裡，我直接送您過去 ✨'], trips: [
            { label: '旋轉木馬', line: '旋轉木馬到了，記得挑一匹喜歡的白馬 🎠', p: [-34.1, 5.7, 0.04], yaw: 1.406 },
            { label: '摩天輪', line: '摩天輪最高點可以看到整座樂園喔 🎡', p: [44.0, 10.0, 0.04], yaw: -Math.PI / 2 },
            { label: '雲霄飛車', line: '雲霄飛車在城堡後面，請抓好扶手 🐉', p: [-20.0, 76.0, 0.04], yaw: 0 },
            { label: '星光城堡', line: '星光城堡到了，通道可以一路走到後花園 🏰', p: [0, 23.5, 0.05], yaw: 0 },
          ],
        },
        { label: '購買門票 🎟️', lines: ['今天是開園紀念日，所有遊樂設施都免費暢玩！', '這是您的手環，請戴好，祝您玩得開心～'], emoji: '🎟️' },
        { label: '身高限制', lines: ['雲霄飛車建議身高 120 公分以上，其他設施大家都能搭喔！'] },
        { label: '妳也在這裡？', lines: ['是呀，週末樂園人比較多，我和米露會過來幫忙。', '米露在星光廣場的噴泉旁邊巡視，穿紅色制服的就是她 😊'] },
        { label: '一起拍照 📸', photo: true },
        { label: '再見', bye: ['祝您在童話王國玩得開心，回家路上小心！'] },
      ],
    },
    {
      id: 'park_floor', world: 'park', en: 'Park Staff', zh: '米露', role: '園區服務員 · 妹妹', p: [0.0, -9.2], face: [4.6, -7.97],
      file: 'characters/staff_lulu/staff_lulu.gltf.json',
      patrol: [[0.0, -9.2], [4.6, -7.97], [7.97, -4.6], [9.2, 0.0], [7.97, 4.6], [4.6, 7.97], [0.0, 9.2], [-4.6, 7.97], [-7.97, 4.6], [-9.2, 0.0], [-7.97, -4.6], [-4.6, -7.97]],
      hello: '嗨～歡迎來玩！我是園區服務員米露 🎈',
      menu: [
        {
          label: '最推薦哪個？', lines: ['一定要坐雲霄飛車！龍頭車廂會從城堡後面衝下來，超刺激 🐉', '怕高的話，天鵝湖的天鵝船很悠閒喔～'], trips: [
            { label: '去雲霄飛車', line: '出發！坐完記得跟我說好不好玩 😆', p: [-20.0, 76.0, 0.04], yaw: 0 },
            { label: '去天鵝湖', line: '天鵝湖到了，船上可以看到城堡的倒影喔 🦢', p: [40.8, -40.0, 0.5], yaw: -Math.PI / 2 },
          ],
        },
        { label: '哪裡有點心？', lines: ['廣場兩邊有甜點和冰淇淋小攤，我最推薦草莓冰淇淋 🍦'] },
        { label: '走失了怎麼辦', lines: ['別擔心！到入口大門找米雅姊姊，她會幫你廣播 📢'] },
        { label: '姊姊在哪裡？', lines: ['米雅姊姊在入口大門左邊的售票亭裡面～ 出園前記得跟她說再見！'] },
        { label: '一起拍照 📸', photo: true },
        { label: '再見', bye: ['掰掰～ 要再來玩喔！'] },
      ],
    },
    // ... and at Emerald Valley: 米雅 at the lodge's visitor desk, 米露 at the camp office
    {
      id: 'nature_desk', world: 'nature', en: 'Visitor Center', zh: '米雅', role: '遊客中心 · 姊姊', p: [-29.7, -1.05, 2.0], face: [-29.7, 6.0], reach: 3.6,
      // behind the visitor desk (open at both ends), a stroll to either end and a rest on her chair
      outings: [{ via: [[-27.5, -1.05]] }, { via: [[-31.7, -1.05]] }, { via: [[-29.9, -1.25]], seat: [-30.55, -1.25], h: 0.54, face: [-30.55, 6.0] }],
      file: 'characters/staff_robot/staff_robot.gltf.json',
      hello: '歡迎來到翠谷自然公園！我是遊客中心的米雅，一樓是森林咖啡廳，二樓有伴手禮店喔～',
      menu: [
        {
          label: '園區導覽 🗺️', lines: ['步道沿著溪流一路往北，走到底就是瀑布和水潭，吊橋從山谷西邊跨到東邊。', '溪的東邊是豪華露營區，帳篷、露營車、小木屋和營火區都在那裡。想去哪裡，我直接送您過去 ✨'], trips: [
            { label: '瀑布水潭', line: '瀑布到了，水氣很涼，水潭邊的石頭有點滑，小心喔 🌊', p: [-7.2, 69.4, 2.55], yaw: -0.487 },
            { label: '翠谷吊橋', line: '吊橋到了！從山谷的西邊一直連到東邊，橋中間看瀑布最漂亮 🌉', p: [-0.6, 64.0, 20.6], yaw: -1.535 },
            { label: '溪流木橋', line: '木橋到了，可以站在中間聽溪水的聲音 🌿', p: [-7.0, -21.2, 1.35], yaw: -Math.PI / 2 },
            { label: '環山步道口', line: '步道口就在傳送門旁邊，先之字形爬上西邊的山，再繞整座山谷一圈，沿路有三座觀景台 ⛰️', p: [-36.5, -94.3, 0.15], yaw: Math.PI / 2 },
            { label: '豪華露營區', line: '露營區到了，服務台的米露會幫您辦入住 🏕️', p: [24.5, -10.5, 1.63], yaw: -Math.PI / 2 },
            { label: '營火區', line: '營火區到了，晚上大家會在這裡烤棉花糖 🔥', p: [47.0, 1.0, 1.7], yaw: 0 },
          ],
        },
        {
          label: '森林咖啡廳 ☕', lines: ['一樓北邊就是森林咖啡廳，有手沖咖啡、拿鐵、熱可可和花草茶。', '玻璃櫃裡有每天現烤的可頌、草莓蛋糕和巧克力蛋糕，可以坐在窗邊慢慢吃～'], trips: [
            { label: '去點一杯', line: '櫃檯在這裡，推薦森林拿鐵配草莓蛋糕 🍰', p: [-33.2, 6.5, 2.0], yaw: 0 },
          ],
        },
        {
          label: '伴手禮 🎁', lines: ['二樓東邊是伴手禮店，有翠谷蜂蜜、森林餅乾禮盒、花草茶、馬克杯、明信片和小熊娃娃。', '樓梯在櫃檯旁邊，靠南邊的牆往上走就到了。'], trips: [
            { label: '帶我上二樓', line: '伴手禮店到了，結帳櫃檯在窗邊 🧸', p: [-31.5, 0.9, 5.8], yaw: 0 },
          ],
        },
        {
          label: '室內活動 🎲', lines: ['二樓西邊是活動室，有桌遊、手作材料和一整面書櫃，下雨天也能玩一整天。', '一樓的壁爐沙發區也很舒服，冬天會生火喔 🔥'], trips: [
            { label: '去活動室', line: '活動室到了，桌遊都放在書櫃旁邊，自己拿來玩就好 🎲', p: [-39.0, 6.0, 5.8], yaw: Math.PI / 2 },
            { label: '去壁爐旁坐坐', line: '壁爐這邊最暖和了，沙發隨便坐 🛋️', p: [-39.5, 6.0, 2.0], yaw: Math.PI / 2 },
          ],
        },
        {
          label: '我想入住露營區', lines: ['露營區的入住是米露負責的，她在溪對面的營地服務台。', '我們有鐘型帳篷、露營車和小木屋三種，米露會帶您挑喔～'], trips: [
            { label: '去營地服務台', line: '營地服務台到了，米露就在櫃檯後面 😊', p: [24.5, -10.5, 1.63], yaw: -Math.PI / 2 },
          ],
        },
        { label: '妳也在這裡？', lines: ['是呀，這座自然公園新開幕，我在遊客中心，米露在露營區。', '有任何園區的問題都可以來問我 😊'] },
        { label: '一起拍照 📸', photo: true },
        { label: '再見', bye: ['祝您在翠谷玩得開心，晚上記得看星星喔！'] },
      ],
    },
    {
      id: 'nature_floor', world: 'nature', en: 'Camp Staff', zh: '米露', role: '營地服務台 · 妹妹', p: [29.9, -10.5, 1.82], face: [20.0, -10.5], reach: 3.6,
      // behind the camp office counter (the staff door is in the north wall), and a rest on her chair
      outings: [{ via: [[29.9, -8.6]] }, { via: [[29.9, -12.6]] }, { via: [[30.3, -12.2]], seat: [30.9, -12.2], h: 0.54, face: [27.0, -12.2] }],
      file: 'characters/staff_lulu/staff_lulu.gltf.json',
      hello: '嗨～歡迎來露營！我是營地服務台的米露，今天要入住嗎？🏕️',
      menu: [
        {
          label: '我要入住 🏕️', lines: ['我們有鐘型帳篷、露營車和小木屋三種。帳篷裡有雙人床和小沙發，露營車有床、小廚房、餐桌，還有自己的衛浴。', '不想睡在野外的話，露營車後面有兩排小木屋，有實木牆和真正的床。想先看看哪一種呢？'], trips: [
            { label: '看鐘型帳篷', line: '這是 1 號帳篷，床邊有小檯燈，躺下來可以看到帳篷頂 ⛺', p: [34.6, 8.0, 1.98], yaw: Math.PI / 2 },
            { label: '看露營車', line: '這是 1 號露營車，餐桌可以收成床，冰箱裡有冰牛奶 🚐', p: [38.5, -12.4, 2.25], yaw: 2.0 },
            { label: '看小木屋', line: '這是 1 號小木屋，雙人床、床頭燈、單人沙發都有，門廊還有兩張椅子可以看星星 🛖', p: [37.3, -20.9, 2.07], yaw: 0 },
          ],
        },
        {
          label: '露營區有什麼？', lines: ['營火區在帳篷圍成的圓圈中間，晚上我們會一起烤棉花糖 🔥', '服務台旁邊有休息室，有沙發和暖爐，走累了可以進去坐坐～'], trips: [
            { label: '去營火區', line: '找個木頭椅子坐下，火很溫暖喔 🔥', p: [47.0, 1.0, 1.7], yaw: 0 },
            { label: '去休息室', line: '休息室到了，沙發隨便坐 🛋️', p: [26.6, -17.6, 1.72], yaw: -Math.PI / 2 },
            { label: '去瀑布', line: '瀑布到了！水潭好大，站在這裡就能感覺到水氣 📸', p: [-7.2, 69.4, 2.55], yaw: -0.487 },
          ],
        },
        {
          label: '洗手間與淋浴 🚿', lines: ['露營區北邊有一棟盥洗室，左邊是男生、右邊是女生，裡面有廁所、洗手台和淋浴間，24 小時都有熱水。', '旁邊還有戶外洗手槽，可以洗碗、刷牙、洗鞋子喔。'], trips: [
            { label: '帶我過去', line: '盥洗室到了，左邊男生、右邊女生 🚻', p: [64.0, 20.4, 1.7], yaw: 0 },
          ],
        },
        { label: '有登山步道嗎？', lines: ['有喔！露營車後面就有一塊 RIDGE TRAIL 的牌子，從那裡爬上東邊的山，就能接上繞整座山谷一圈的環山步道 ⛰️', '傳送門旁邊也有另一個入口。西邊、南邊、東邊各有一座觀景台，都有長椅可以坐著看風景！'], trips: [
            { label: '去步道口', line: '步道口到了，慢慢走，記得補充水分喔 💧', p: [68.0, -4.6, 1.75], yaw: -Math.PI / 2 },
          ],
        },
        { label: '露營注意事項', lines: ['營火只在營火區生，熄燈時間是晚上十點。', '溪水很乾淨但很冰，下水的時候請注意安全 🙏'] },
        { label: '森林裡有動物嗎？', lines: ['早上常常有松鼠跑來營地偷吃東西 🐿️', '溪裡還有小魚和螃蟹，不過要看仔細一點才找得到～'] },
        {
          label: '姊姊在哪裡？', lines: ['米雅姊姊在溪西邊的翠谷木屋，那裡是遊客中心，一樓有咖啡廳、二樓有伴手禮店！'], trips: [
            { label: '去遊客中心', line: '翠谷木屋到了，米雅姊姊就在門口右手邊的櫃檯 😊', p: [-23.5, 6.0, 1.82], yaw: Math.PI / 2 },
          ],
        },
        { label: '一起拍照 📸', photo: true },
        { label: '再見', bye: ['掰掰～ 晚上記得來營火區喔！'] },
      ],
    },
    // ... and at the airport: 米雅 checks you in, 米露 looks after gate A1
    {
      id: 'airport_desk', world: 'airport', en: 'Check-in', zh: '米雅', role: '報到櫃檯 · 姊姊', p: [-15.25, 17.8, 0.02], face: [-15.25, 0.0], reach: 3.6,
      // behind counter 08 (both ends of the island are open), a stroll along it and a rest on her chair
      outings: [{ via: [[-17.6, 17.8]] }, { via: [[-13.6, 17.8]] }, { via: [[-16.15, 17.72]], seat: [-16.15, 18.15], h: 0.56, face: [-16.15, 0.0] }],
      file: 'characters/staff_robot/staff_robot.gltf.json',
      hello: '歡迎搭乘極光航空！我是報到櫃檯的米雅，請出示您的護照，我來為您辦理登機手續 ✈️',
      menu: [
        {
          label: '我要報到 🛂', lines: ['好的，AU 101 飛往東京，10:40 起飛……您的座位是 12A，靠窗的位子喔。', '行李已經托運了，這是您的登機證。請先通過安全檢查，再到 A1 登機門，米露會在那裡等您 😊'], trips: [
            { label: '去安全檢查', line: '安檢在大廳正後方，請把隨身行李放進灰色的籃子裡喔 🧳', p: [0, 30.0, 0.02], yaw: 0 },
            { label: '直接去登機門', line: 'A1 登機門到了，祝您旅途愉快 ✈️', p: [0, 70.5, 0.02], yaw: 0 },
            { label: '直接登機', line: '這是客艙，您的座位 12A 在經濟艙靠窗那一側 💺', p: [7.5, 108.0, 4.57], yaw: Math.PI / 2 },
          ],
        },
        {
          label: '機場導覽 🗺️', lines: ['大廳正中央是航班看板，後面就是安全檢查。', '過了安檢是免稅商店街：左邊是免稅店和咖啡廳，右邊是旅行用品和伴手禮店，走到底就是 A1 登機門。'], trips: [
            { label: '航班看板', line: '這是出發航班看板，綠色的字代表已經開始登機了 🛫', p: [0, 22, 0.02], yaw: 0 },
            { label: '免稅店', line: '免稅店到了，香水、化妝品和名酒都在這裡 🛍️', p: [-10.5, 43, 0.02], yaw: Math.PI / 2 },
            { label: '咖啡廳', line: 'SKY CAFE 到了，登機前來杯咖啡吧 ☕', p: [-10.5, 58, 0.02], yaw: Math.PI / 2 },
            { label: '伴手禮', line: '伴手禮店到了，有巧克力禮盒和小飛機娃娃喔 🎁', p: [10.5, 58, 0.02], yaw: -Math.PI / 2 },
          ],
        },
        { label: '行李規定', lines: ['托運行李每件 23 公斤以內，隨身行李一件、7 公斤以內。', '液體要裝在 100 毫升以下的容器裡，放進透明夾鏈袋，安檢的時候拿出來就可以了 💧'] },
        { label: '妳也在這裡？', lines: ['是呀，機場新開幕，我和米露一起過來幫忙。', '我在報到櫃檯，米露在 A1 登機門，穿紅色制服的就是她 😊'] },
        { label: '一起拍照 📸', photo: true },
        { label: '再見', bye: ['祝您旅途平安，一路順風 ✈️'] },
      ],
    },
    {
      id: 'airport_floor', world: 'airport', en: 'Gate Staff', zh: '米露', role: '登機門服務員 · 妹妹', p: [-6.0, 74.0, 0.02], face: [6.0, 74.0],
      file: 'characters/staff_lulu/staff_lulu.gltf.json',
      patrol: [[-6.0, 74.0], [6.0, 74.0], [6.0, 68.6], [-6.0, 68.6]],
      hello: '嗨～這裡是 A1 登機門！我是米露，有什麼需要都可以問我 ✈️',
      menu: [
        {
          label: '我要登機 🛫', lines: ['AU 101 飛東京，現在已經開始登機囉！', '從登機櫃檯右邊的空橋走上去就是機艙，前面兩排是商務艙，後面是經濟艙，你的位子在 12A 靠窗 ✈️'], trips: [
            { label: '帶我登機', line: '歡迎登機～往左轉就是客艙，找到位子按 E 就可以坐下，記得繫好安全帶喔 💺', p: [7.5, 108.0, 4.57], yaw: Math.PI / 2 },
          ],
        },
        {
          label: '免稅店推薦', lines: ['免稅店的香水和巧克力最受歡迎！', '伴手禮店有一種小飛機娃娃，我已經買了三隻了……噓，不要跟姊姊說 🤫'], trips: [
            { label: '去免稅店', line: '免稅店到了～香水試用品可以噴噴看喔 🛍️', p: [-10.5, 43, 0.02], yaw: Math.PI / 2 },
            { label: '去伴手禮店', line: '伴手禮店到了！小飛機娃娃在最裡面那一排 ✈️', p: [10.5, 58, 0.02], yaw: -Math.PI / 2 },
          ],
        },
        { label: '窗外那架飛機', lines: ['那就是你要搭的 AU 101！極光航空的藍色塗裝超好看的對吧？', '左邊遠遠那架正在滑行，等一下就要從跑道起飛囉 🛫'] },
        {
          label: '姊姊在哪裡？', lines: ['米雅姊姊在出境大廳的報到櫃檯，08 號櫃檯就是她！'], trips: [
            { label: '去報到櫃檯', line: '報到櫃檯到了，米雅姊姊就在 08 號 😊', p: [-15.25, 13.5, 0.02], yaw: 0 },
          ],
        },
        { label: '一起拍照 📸', photo: true },
        { label: '再見', bye: ['一路順風～玩得開心，回來再跟我說旅行的故事喔！✈️'] },
      ],
    },
  ].map((c) => ({
    world: 'hotel', en: 'Hotel Staff', file: 'characters/staff_robot/staff_robot.gltf.json', height: 1.75, greet: 'bow',
    idles: ['nod', 'look'], arms: { down: 1.0, out: 0.22, foreDown: 1.0, foreOut: 0.12 }, again: '還有其他需要嗎？', group: 'staff', ...c,
  })),
];
const charOn = {};
try { Object.assign(charOn, JSON.parse(localStorage.getItem('aurora-world-characters') || '{}')); } catch { }
const isOn = (c) => charOn[c.id] !== false;
const npcs = [];                       // characters loaded in the current world
let npcCand = null, patCand = false;
const dialog = { npc: null, lines: [''], i: 0, shown: 0, t: 0, opts: null, end: null, mini: false, drawn: null, turn: 0 };
const photo = { npc: null, k: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), center: new THREE.Vector3(), spot: null, spotYaw: 0, count: 0, view: false, url: null, last: null };
const dialogEl = document.getElementById('dialog');
const dialogName = document.getElementById('dialog-name');
const dialogText = document.getElementById('dialog-text');
const dialogOpts = document.getElementById('dialog-opts');
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion();
const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _vd = new THREE.Vector3(), _vs = new THREE.Vector3();
const _vg = new THREE.Vector3(), _vh = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const NPC_SPEED = 1.25;                // m/s while guiding
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// rotate a bone by a rotation given in world space, keeping its parent where it is
function turnBone(bone, qWorld) {
  bone.parent.getWorldQuaternion(_qa);
  bone.getWorldQuaternion(_qb);
  _qb.premultiply(qWorld);
  bone.quaternion.copy(_qa.invert().multiply(_qb));
  bone.updateMatrixWorld(true);
}
function pointBone(bone, child, dir, k = 1) {
  bone.getWorldPosition(_va);
  child.getWorldPosition(_vb);
  _vb.sub(_va).normalize();
  _qc.setFromUnitVectors(_vb, dir);
  if (k < 1) _qc.slerp(new THREE.Quaternion(), 1 - k);
  turnBone(bone, _qc);
}

function nameSprite(c) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(16,22,58,0.85)';
  g.beginPath(); g.roundRect(8, 16, 496, 96, 48); g.fill();
  g.strokeStyle = '#f2c46d'; g.lineWidth = 4; g.stroke();
  g.textAlign = 'center';
  g.fillStyle = '#fff3dc';
  g.font = '600 44px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  g.fillText(`${c.zh}`, 256, 72);
  g.fillStyle = '#f2c46d';
  g.font = '500 24px "PingFang TC","Noto Sans TC",sans-serif';
  g.fillText(c.role, 256, 102);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(1.1, 0.275, 1);
  return s;
}

const charFiles = {};
async function loadCharacter(c) {
  const buf = await (charFiles[c.file] ||= fetchWithProgress(c.file, () => { }));
  const gltf = await charLoader.parseAsync(jsonToGlb(buf), c.file.slice(0, c.file.lastIndexOf('/') + 1));
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const s = c.height / Math.max(0.01, box.max.y - box.min.y);
  model.scale.setScalar(s);
  const root = new THREE.Group();
  root.add(model);
  const [x, y, z] = c.p;
  root.position.copy(b2t(x, y, z));
  // face towards a point in Blender plan coordinates
  const yaw0 = Math.atan2(c.face[0] - x, -(c.face[1] - y));
  root.rotation.y = yaw0;
  model.traverse((o) => {
    if (o.isMesh) {
      o.material = lighten(o.material);
      if (o.material.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();   // sharp at a slant too
      o.castShadow = false;
      o.receiveShadow = true;
      o.frustumCulled = false;
    }
  });
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name.replace(/^mixamorig:?/, '')] = o; });
  // a soft round shadow under the feet
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.32 * c.height, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.012;
  root.add(blob);
  const tag = nameSprite(c);
  tag.position.y = c.height + 0.28;
  root.add(tag);
  // an invisible pillar so the visitor cannot walk through the character
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * c.height, 0.26 * c.height, c.height, 12), new THREE.MeshBasicMaterial({ visible: false }));
  pillar.position.y = c.height / 2;
  root.add(pillar);
  worldRoot.add(root);
  root.updateMatrixWorld(true);
  // rest pose with the arms lowered from the T-pose
  const rest = {};
  for (const [n, b] of Object.entries(bones)) rest[n] = b.quaternion.clone();
  const npc = {
    c, root, model, bones, rest, base: {}, yaw0, yaw: yaw0, tag, pillar, look: 0, wave: 0, greeted: false, t: Math.random() * 10, leftSign: 1,
    post: root.position.clone(), mode: 'post', path: [], trail: [], speed: 0, phase: 0, msg: '', dest: null, intro: false,
    act: null, pose: null, poseFrom: null, poseK: 1, idle: 4 + Math.random() * 4, heartT: 0, pats: 0,
  };
  // which way is the character's left? (rigs differ) - measured from the left hand
  if (bones.LeftHand) npc.leftSign = Math.sign(root.worldToLocal(bones.LeftHand.getWorldPosition(new THREE.Vector3())).x) || 1;
  armsDown(npc);
  for (const [n, b] of Object.entries(bones)) npc.base[n] = b.quaternion.clone();
  if (c.patrol) { npc.mode = 'patrol'; npc.pi = 0; npc.pause = Math.random() * 3; }
  npc.sitK = 0; npc.sitWant = 0; npc.outingT = 12 + Math.random() * 12;
  if (bones.Hips) npc.hipH = root.worldToLocal(bones.Hips.getWorldPosition(new THREE.Vector3())).y;
  if (bones.LeftUpLeg && bones.LeftLeg) npc.thighLen = bones.LeftUpLeg.getWorldPosition(new THREE.Vector3()).distanceTo(bones.LeftLeg.getWorldPosition(new THREE.Vector3()));
  dynColliders.push(pillar);
  npcs.push(npc);
  return npc;
}

function sideDir(npc, side, down, out, fwd = 0.08) {
  // side = +1 for the character's left; directions in world space
  const q = npc.root.getWorldQuaternion(_qa);
  return new THREE.Vector3(side * npc.leftSign * out, -down, fwd).applyQuaternion(q).normalize();
}
// How far the arms come down from the T-pose (1 = straight down). Tripo's skin
// weights tear the shoulders and the dress if the arms move too far.
const POSE = { down: 1.0, out: 0.6, foreDown: 1.0, foreOut: 0.45, wave: 1 };
function armsDown(npc) {
  const B = npc.bones;
  npc.root.updateMatrixWorld(true);
  for (const [s, side] of [['Left', 1], ['Right', -1]]) {
    if (!B[s + 'Arm'] || !B[s + 'ForeArm'] || !B[s + 'Hand']) continue;
    const P = npc.c.arms || POSE;
    pointBone(B[s + 'Arm'], B[s + 'ForeArm'], sideDir(npc, side, P.down, P.out));
    pointBone(B[s + 'ForeArm'], B[s + 'Hand'], sideDir(npc, side, P.foreDown, P.foreOut, 0.3));
  }
}
function reposeNpcs() {
  for (const n of npcs) {
    for (const [k, b] of Object.entries(n.bones)) b.quaternion.copy(n.rest[k]);
    armsDown(n);
    for (const [k, b] of Object.entries(n.bones)) n.base[k] = b.quaternion.clone();
  }
}

// ---- poses and little actions ------------------------------------------------------------
// Arm targets are [upper arm, forearm] directions in the character's own frame:
// [outwards, up, forwards], so one table works for both sides.
const armsBase = (n) => { const P = n?.c.arms || POSE; return [[P.out, -P.down, 0.08], [P.foreOut, -P.foreDown, 0.3]]; };
const POSES = {
  peace: { zh: 'YA ✌️', L: [[0.75, -0.65, 0.15], [-0.3, -0.5, 0.8]], R: [[0.5, 0.05, 0.75], [-0.35, 0.95, 0.3]] },
  cheer: { zh: '歡呼 🙌', L: [[0.5, 0.85, 0.2], [0.25, 1, 0.1]], R: [[0.5, 0.85, 0.2], [0.25, 1, 0.1]] },
  heart: { zh: '比心 ❤️', L: [[0.25, -0.15, 0.9], [-0.9, 0.4, 0.3]], R: [[0.25, -0.15, 0.9], [-0.9, 0.4, 0.3]] },   // paws together at the chest
};
const PHOTO_POSES = ['peace', 'cheer', 'heart'];
const ACTS = {
  highfive: { dur: 1.7, R: [[0.35, 0.3, 0.88], [0.1, 0.8, 0.6]], at: 0.6 },
  hug: { dur: 2.6, at: 0.75 },
  pat: { dur: 2.2, L: [[0.45, -0.45, 0.6], [-0.55, 0.75, 0.45]], R: [[0.45, -0.45, 0.6], [-0.55, 0.75, 0.45]] },
  tidy: { dur: 2.4, L: [[0.3, -1, 0.3], [0.15, -0.55, 0.85]], R: [[0.3, -1, 0.3], [0.15, -0.55, 0.85]] },
  nod: { dur: 1.5 },
  bow: { dur: 2.0, L: [[0.2, -1, 0.3], [-0.45, -0.55, 0.7]], R: [[0.2, -1, 0.3], [-0.45, -0.55, 0.7]] },
  look: { dur: 3.2 },
  spin: { dur: 1.4, L: [[0.9, 0.25, 0.2], [0.9, 0.3, 0.1]], R: [[0.9, 0.25, 0.2], [0.9, 0.3, 0.1]] },
  yay: { dur: 1.8, R: [[0.35, 0.85, 0.35], [0.1, 1, 0.1]], at: 0.4 },
  shake: { dur: 2.0, R: [[0.15, -0.45, 0.85], [0.05, -0.1, 1]], at: 0.5 },
  roar: { dur: 1.8, L: [[0.55, 0.55, 0.6], [0.25, 0.75, 0.6]], R: [[0.55, 0.55, 0.6], [0.25, 0.75, 0.6]], at: 0.5 },
};
// 互動: every character can high-five and hug; each also has a few of her own.
// The sisters only play while keeping you company (at work they stay formal).
const PLAY = {
  base: (who) => [
    { label: '擊掌 ✋', act: 'highfive', lines: { fox: '擊掌？好呀～……手感不錯嘛，再來一次也可以 ✋😌', tiger: '吼！擊掌！✋ ……手會痛嗎？虎寶已經放輕了喔！', bear: '擊、擊掌……✋ 嘿嘿，有對準嗎？熊熊常常拍歪 😅', mia: '擊掌……這樣嗎？✋ 呵呵，有點不好意思呢。', milu: '耶～！✋ 再一次再一次！' }[who] },
    { label: '抱抱 🤗', act: 'hug', lines: { fox: '……抱這麼緊，是捨不得我嗎？沒關係，我也是 💕', tiger: '來！虎寶熊抱……不對，虎抱！用力一點！💪💕', bear: '……抱抱。呼啊～好溫暖……熊熊可以靠一下下嗎 💕💤', mia: '……被抱住了。謝謝您，感覺很溫暖。', milu: '抱抱！嘿嘿，你是今天第一個抱我的人 💕' }[who] },
    { label: '握手 🤝', act: 'shake', lines: { fox: '握手呀……你的手好暖。要不要多握一下？🦊', tiger: '握手！好，從今天起你就是虎寶的搭檔了！🤝', bear: '握、握手……熊掌的肉球很軟對不對？……您不要捏啦 🐾', mia: '請多指教。能陪您走這一趟，是我的榮幸。', milu: '握手握手～ 我們是好朋友了！🤝' }[who] },
  ],
  bear: [{ label: '摸摸頭 🐻', pat: true }, { label: '一起發呆 💤', act: 'nod', lines: '……（熊熊靠在您旁邊，眼睛慢慢閉起來）……呼啊～這樣好舒服喔……' }],
  fox: [{ label: '摸摸頭 🦊', pat: true }, { label: '轉圈圈 💫', act: 'spin', lines: '看好囉～……我的尾巴，只轉給你看的 💫' }],
  tiger: [{ label: '摸摸頭 🐯', pat: true }, { label: '虎虎吼 🐾', act: 'roar', lines: '吼～～～！！聽到了嗎？全王國最大聲的吼！……咳咳，喉嚨有點痛 🐯' }],
  mia: [
    { label: '鞠躬回禮 🙇', act: 'bow', lines: '承蒙照顧了。今後也請多多關照。' },
  ],
  milu: [
    { label: '轉圈圈 💫', act: 'spin', lines: '看我轉～！好暈好暈……嘿嘿 💫' },
  ],
};
const playItems = (n) => (n.c.person === 'bear' || n.c.mascot || n.follow ? [...PLAY.base(n.c.person), ...(PLAY[n.c.person] || [])] : [])
  .filter((m) => !(sit.seat && (m.act === 'spin' || m.act === 'hug')));   // seated: no spinning or hugging
const LAP_ARMS = [[0.12, -0.8, 0.55], [0.05, -0.55, 0.85]];   // seated: relaxed, hands resting on the knees
const HUG_OPEN = [[0.95, 0.1, 0.55], [0.6, 0.1, 0.9]], HUG_CLOSE = [[0.45, 0.0, 1.0], [-0.9, 0.05, 0.5]];
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const lerpArm = (a, b, k) => [lerp3(a[0], b[0], k), lerp3(a[1], b[1], k)];
function poseArms(n, name, side) { return (name && POSES[name]?.[side]) || armsBase(n); }
function actArms(n, side) {
  const a = n.act, A = ACTS[a.type];
  if (a.type === 'hug') return lerpArm(HUG_OPEN, HUG_CLOSE, ease(THREE.MathUtils.clamp((a.t - 0.45) / 0.35, 0, 1)));
  if (a.type === 'shake' && A[side]) {    // shaking hands: the forearm bobs up and down
    const w = Math.sin(a.t * 12) * 0.15 * Math.min(1, a.t * 2);
    return [A[side][0], [A[side][1][0], A[side][1][1] + w, A[side][1][2]]];
  }
  if (a.type === 'tidy' && A[side]) {   // smoothing the skirt: the paws brush sideways
    const w = Math.sin(a.t * 7) * 0.25;
    return [A[side][0], [A[side][1][0] + w, A[side][1][1], A[side][1][2]]];
  }
  return A[side] || null;
}
// ---- idle outings: a short stroll, or walk to a seat, sit a while and come back ----------
function startOuting(n, o) {
  n.outing = { o, phase: 'go', t: 0 };
  n.mode = 'outing';
  n.act = null;
  const z = o.z ?? n.c.p[2];
  n.path = o.via.map(([x, y]) => ({ v: b2t(x, y, z), push: false }));
}
function updateOuting(n, dt) {
  const O = n.outing, o = O.o, z = o.z ?? n.c.p[2];
  if (O.phase === 'go' && !n.path.length) {
    if (o.seat) {
      // turn round with the seat behind (or to face what the seat faces), then sit onto it
      const [ax, ay] = o.via[o.via.length - 1];
      O.from = b2t(ax, ay, z); O.to = b2t(o.seat[0], o.seat[1], z);
      const f = o.face ? b2t(o.face[0], o.face[1], z) : O.from;
      n.sitYaw = Math.atan2(f.x - O.to.x, f.z - O.to.z);
      const fx = Math.sin(n.sitYaw), fz = Math.cos(n.sitYaw);
      const sh = kneeShift(cushionEdge(new THREE.Vector3(O.to.x, z + o.h, O.to.z), fx, fz), n.thighLen || 0.4);
      O.to.x += fx * sh; O.to.z += fz * sh;
      // the ground right there (a bench on a raised pavement sits a little higher than where you stood)
      const g = castHit(new THREE.Vector3(O.to.x, z + 0.3, O.to.z), _down, 0.5);
      if (g && Math.abs(g.point.y - z) < 0.2) n.post.y = g.point.y;
      n.sitH = o.h; n.sitWant = 1;
      O.phase = 'sit'; O.t = 12 + Math.random() * 10;
    } else { O.phase = 'look'; O.t = 2.5 + Math.random() * 2.5; doAct(n, 'look'); }
  } else if (O.phase === 'sit') {
    if (n.sitK > 0) {
      n.root.position.x = O.from.x + (O.to.x - O.from.x) * ease(n.sitK);
      n.root.position.z = O.from.z + (O.to.z - O.from.z) * ease(n.sitK);
    }
    if ((O.t -= dt) <= 0) { n.sitWant = 0; O.phase = 'stand'; }
  } else if (O.phase === 'stand') {
    n.root.position.x = O.from.x + (O.to.x - O.from.x) * ease(n.sitK);
    n.root.position.z = O.from.z + (O.to.z - O.from.z) * ease(n.sitK);
    if (n.sitK <= 0) { O.phase = 'back'; n.post.y = z; }
  } else if (O.phase === 'look' && (O.t -= dt) <= 0) O.phase = 'back';
  if (O.phase === 'back' && n.follow) { n.outing = null; n.mode = 'follow'; n.post.copy(n.root.position); return; }
  if (O.phase === 'back' && !O.home) {
    O.home = true;
    n.path = [...o.via].reverse().slice(1).map(([x, y]) => ({ v: b2t(x, y, z), push: false })).concat({ v: n.post, push: false });
  } else if (O.phase === 'back' && !n.path.length) { n.mode = 'post'; n.outing = null; n.outingT = 18 + Math.random() * 20; }
}
// ---- companion mode: a character walks with you, through any world ----------------------
// She follows the trail of steps you walked (so she goes round walls and up the stairs),
// pops up beside you after a lift, a teleport or a flight, sits on a free seat next to
// yours, and talks differently. One companion at a time; her own post stays empty
// while she is out with you, and the choice survives a reload.
const PERSON_OF = { bear: 'bear', tiger: 'tiger', fox: 'fox', staff_desk: 'mia', mall_desk: 'mia', park_desk: 'mia', nature_desk: 'mia', airport_desk: 'mia', staff_lobby: 'milu', airport_floor: 'milu', mall_floor: 'milu', park_floor: 'milu', nature_floor: 'milu' };
const COMPANION = {
  bear: {
    start: '咦，要熊熊陪您嗎……？好、好的！熊熊會努力跟上的 🐻 ……請不要走太快喔。', hello: '那個……接下來要去哪裡呢？熊熊跟著您～', again: '嗯嗯……還想聊什麼呢？',
    bye: '呼啊～今天走了好多路……熊熊先回大廳休息了。謝謝您陪熊熊，下次見 🐻💤', where: '這裡是{place}……嗯，熊熊有來過，好像。',
    chat: [
      ['熊熊最近在學烤餅乾……', '第一次烤成黑色的，第二次也是黑色的……第三次！是咖啡色的了 🍪'],
      ['您知道嗎……熊熊每天下午三點都會午睡。', '米雅說吉祥物不可以在大廳睡覺……所以熊熊都假裝在發呆 💤'],
      ['米雅和米露是一對姊妹……', '米露每次都偷吃熊熊的布丁，可是熊熊吃太慢了，好像也不能怪她 🍮'],
      ['走累了的話……', '熊熊知道每一張椅子坐起來的感覺喔。大廳那張長椅，最適合打瞌睡 💺'],
      ['這套女僕裝，是米雅幫熊熊挑的……', '圍裙上的愛心是熊熊自己縫的……縫歪了一個，您有發現嗎？🎀'],
      ['跟您說一個秘密……', '熊熊很怕打雷……上次躲在櫃檯下面，結果在那裡睡著了，米雅找了一個小時 ⛈️'],
      ['虎寶是熊熊的好朋友……', '可是她每次都拉熊熊去坐雲霄飛車……熊熊都說「好」，然後在排隊的時候睡著 🎢😅'],
      ['熊熊的夢想……', '是開一家很小很小的茶館。只有三張椅子，大家都可以慢慢喝茶，不用趕時間 🍵'],
      ['您喜歡甜的東西嗎……？', '熊熊覺得，難過的時候吃一口蛋糕，就會好一點點……所以熊熊口袋裡都有糖果，要一顆嗎？🍬'],
      ['……今天跟您一起走走，熊熊很開心。', '平常大家都走好快……您願意慢慢走，熊熊覺得好幸福 ☺️'],
    ],
    world: {
      airport: [['機場好大……廣播好多……', '熊熊有點緊張……您可以走慢一點，不要讓熊熊走丟嗎？✈️'], ['咖啡廳的可頌看起來好好吃……', '我們坐一下下，好不好？']],
      hotel: [['飯店的地毯好軟……', '軟到熊熊有時候走著走著就想躺下來……啊，熊熊沒有真的躺喔 ☁️'], ['總統套房的床超大……', '熊熊偷偷躺過一次……三秒鐘就睡著了，是米露把熊熊叫醒的 🛏️💤']],
      park: [['童話王國好熱鬧……', '虎寶一看到熊熊，就會大喊「熊熊！衝啊！」……熊熊的耳朵都會嚇一跳 🐯'], ['旋轉木馬是熊熊最喜歡的……', '因為它轉得慢慢的，跟熊熊一樣 🎠']],
      mall: [['購物中心的冰淇淋店有蜂蜜口味……', '熊熊每次經過都要停下來看三分鐘……然後買一支 🍦'], ['小楓姊姊好成熟喔……', '熊熊也想像她那樣說話……可是一開口就變成「那個……」☺️']],
      nature: [['森林裡好安靜……', '熊熊覺得這裡最適合睡午覺了……可以找一棵樹靠一下嗎？🌲'], ['營火可以烤棉花糖……', '熊熊烤的每一顆都會燒焦……因為熊熊烤到一半就發呆了 🔥']],
    },
    spots: [
      [/泳池/, ['水看起來好涼……熊熊的毛弄濕會變很重，在旁邊泡腳就好 🏊']], [/健身房/, ['健身房……熊熊舉過一次啞鈴，然後就……坐在地上休息了一個小時 🏋️']],
      [/咖啡/, ['咖啡廳……有蛋糕的香味……我們可以坐一下下嗎？☕🍰']], [/自助餐/, ['自助餐……熊熊可以先去甜點區嗎？只拿一點點……真的 🍽️']],
      [/酒吧/, ['好安靜的地方……熊熊點一杯熱可可就好 🍫']], [/套房/, ['哇……這張床好大……熊熊只是看看，不會躺上去的……大概 🛏️']],
      [/旋轉木馬/, ['旋轉木馬……熊熊最喜歡了，慢慢轉的那種 🎠']], [/茶杯/, ['茶杯……可以轉慢一點嗎……熊熊會暈 ☕🌀']],
      [/摩天輪/, ['摩天輪……到最上面的時候，可以抓著您的手嗎？😣']], [/雲霄飛車/, ['雲、雲霄飛車……熊熊在下面幫您拿包包，好不好……😣']],
      [/冰淇淋/, ['蜂蜜口味……在呼喚熊熊 🍦']], [/玩具/, ['那個熊娃娃……有點像熊熊……可是熊熊比較圓 🧸']],
      [/營火/, ['營火暖暖的……熊熊要睡著了……💤']], [/瀑布/, ['瀑布好大聲……熊熊的耳朵都在抖 🌊']],
      [/吊橋/, ['吊、吊橋在晃……您走前面，熊熊抓著您的衣服 🌉']], [/觀景台/, ['好高喔……熊熊站後面一點看就好 ⛰️']],
      [/伴手禮/, ['伴手禮……熊熊想買蜂蜜給米雅和米露 🍯']], [/客艙/, ['飛機的椅子……坐起來軟軟的，熊熊可能會一路睡到目的地 💺💤']],
    ],
    thoughts: ['（呼啊～……好想睡……）', '（{place}好像有甜甜的味道……是蛋糕嗎……）', '（口袋裡的糖果還有幾顆呢……）',
      '（跟您一起慢慢走……好幸福 ☺️）', '（剛剛是不是走太慢了……要加油……）', '（那個……剛剛那邊好像有一隻貓……）',
      '（尾巴……又在搖了……好害羞 🙈）', '（肚子咕嚕咕嚕叫……被聽到了嗎……）', '（{place}……下次也想跟您來）'],
  },
  fox: {
    start: '想要我陪你？……好呀，今天我就是你的了 🦊 走吧，別讓我等太久喔。', hello: '接下來想去哪裡？你帶路，我跟著你……還是要我牽著你走？😏', again: '還想聊什麼？我今天時間都是你的 😌',
    bye: '要我回去了？……好吧。今天很開心，真的。下次別讓我等太久，嗯？🦊', where: '這裡是{place}。跟你一起來，感覺都不一樣了呢 ✨',
    chat: [
      ['這頂帽子是服飾店店長送的。', '她說綠色最襯我的毛色……你覺得呢？好看嗎？說實話喔 🎀'],
      ['我喜歡抹茶冰淇淋。', '微苦的味道，最後才甜起來……跟某些人很像呢，你說是吧？🍦'],
      ['奧蘿拉熊和虎寶啊，都是很可愛的孩子。', '她們會跟你撒嬌，我不太會……不過，我會用我的方式對你好 🦊'],
      ['累了就說。', '中庭的噴泉旁邊有長椅，我們可以坐著，什麼都不做也很好……只要是跟你 ⛲'],
      ['告訴你一個秘密，只告訴你喔。', '我其實很怕恐怖電影。所以如果哪天一起看……你要坐我旁邊 🙈'],
      ['你在看我的尾巴嗎？', '每天早上梳一百下才這麼蓬的。……喜歡的話，可以摸摸看，只有你可以 🦊'],
      ['我想開一家帽子店。', '到時候第一頂帽子，我親手幫你挑。別人想買，我還不賣呢 ✨'],
      ['米露老是想贏我，找新開的店。', '小孩子嘛……我比較喜歡慢慢逛，像現在這樣，跟你 😌'],
      ['書店裡有一本狐狸的繪本。', '故事裡的狐狸說：「因為你花了時間陪我，所以你對我來說是特別的。」……我很喜歡這句話 📚'],
      ['今天能陪你逛，我很開心。', '……嗯？這算不算約會？你自己想想吧 😏'],
    ],
    world: {
      airport: [['機場啊……每個人都在出發或是回來的路上。', '如果哪天你要遠行，我會在這裡送你。……然後等你回來 ✈️']],
      mall: [['這裡每一家店我都熟。', '不過今天，我比較想好好看看你喜歡什麼 🛍️']],
      hotel: [['大飯店真漂亮，吊燈像一頂皇冠。', '……要是能跟你在頂樓的空中酒吧看夜景，就更完美了 🌃'], ['奧蘿拉熊在這裡上班。', '要去打招呼嗎？……不過別被她搶走喔 🐻']],
      park: [['童話王國啊……虎寶說要帶我坐雲霄飛車。', '我才不怕呢。……好吧，有一點。到時候你要坐我旁邊 🎢'], ['晚上的城堡會亮起來。', '在城堡前面看煙火……很浪漫吧？我只是說說而已 🏰']],
      nature: [['森林的空氣真好，尾巴都蓬起來了。', '晚上在營火旁邊坐著，靠近一點也沒關係……天氣涼嘛 🔥']],
    },
    spots: [
      [/入口|大廳/, ['這是我平常站的地方。每天跟那麼多人說歡迎光臨……可是今天只想對你說 🦊']], [/中庭|噴泉/, ['許個願吧。我的願望？……不告訴你，說出來就不靈了 ✨']],
      [/服飾/, ['服飾店。讓我幫你挑一件吧……你穿什麼，我都想第一個看到 👗']], [/冰淇淋/, ['抹茶口味。要分你一口嗎？……同一支湯匙也沒關係 🍦']],
      [/咖啡/, ['Sweet Hours 的草莓蛋糕很好吃。一人一半，好不好？🍰']], [/超市/, ['超市啊……兩個人一起推推車，感覺像在過日子呢 🛒']],
      [/書店/, ['那本狐狸繪本就在童書區。我唸給你聽，好嗎？📚']], [/玩具/, ['玩具店裡有狐狸娃娃……買一隻回去，就當作是我陪著你 🧸']],
      [/美食街/, ['美食街。想吃什麼都可以，今天我請客 🍜']], [/電影院/, ['電影院……坐後排吧，比較安靜。……別想歪喔 😏']],
      [/電梯/, ['電梯裡只有我們兩個呢……開玩笑的 🛗']], [/香水/, ['香水店。我身上的味道是楓葉調的……你聞得到嗎？🍁']],
      [/城堡/, ['城堡好漂亮。……如果我是公主，你會來救我嗎？👑']], [/營火/, ['營火暖暖的。坐近一點吧，我的尾巴可以借你蓋 🔥']],
      [/空中酒吧/, ['夜景真美。……我說的不只是夜景喔 🌃']],
    ],
    thoughts: ['（……你今天也很好看呢。）', '（{place}的燈光很柔，氣氛不錯。）', '（帽子有沒有歪……今天特別想看起來漂亮一點。）',
      '（跟你一起走，連平常的路都變得有意思了。）', '（尾巴收好……不過碰到你一下，也不是不行。）', '（下次要不要約在噴泉前面見面呢……）',
      '（{place}……下次也想跟你來。）', '（想吃抹茶冰淇淋……分你一半。）', '（今天的我，你有好好看著嗎？🎀）'],
  },
  tiger: {
    start: '吼！！搭檔，虎寶陪你衝到天黑！🐯 跟緊喔，虎寶走很快的！', hello: '下一站去哪？快說快說！虎寶已經在熱身了！', again: '還要聊什麼？說快一點，虎寶的腳停不下來！',
    bye: '好啦，虎寶回大門口站崗了！今天超讚的，下次再一起冒險，搭檔！🐯✊', where: '這裡是{place}！看虎寶衝一圈，三秒鐘！',
    chat: [
      ['虎寶的帽子是城堡的公主親手戴上的！', '她說「妳是王國最勇敢的吉祥物」……虎寶到現在每天都會想起來，嘿嘿 🎩'],
      ['搭檔，來比賽！', '從這裡衝到下一個路燈，輸的請吃炸雞！預備——好吧，等你準備好再說 🏃'],
      ['熊熊是虎寶最好的朋友！', '她什麼都慢慢的……可是虎寶跌倒的時候，第一個跑過來的是她。……雖然跑得很慢 🐻'],
      ['虎寶最愛的食物是炸雞！', '一次可以吃十塊！米露說吉祥物不能吃那麼多……可是虎寶要長大當最強的吉祥物啊！🍗'],
      ['跟你說一個……不是秘密的事。', '虎寶不會游泳。……但是不是怕水喔！只是還沒有開始練而已！絕對不是怕！😤'],
      ['你有看到虎寶的尾巴嗎？', '它是全王國最長的尾巴！虎寶每天都用它跟小朋友拔河，從來沒輸過 🐾'],
      ['虎寶的夢想是當雲霄飛車的領隊！', '每一班都坐第一排，然後大喊「全員——衝啊！」🎢'],
      ['米露是虎寶的茶杯宿敵！', '目前戰績 23 比 23！下一場決勝負的時候，搭檔你要來當裁判！🌀'],
      ['大家常常以為虎寶是男生……', '虎寶是女生啦！帽子上有蝴蝶結、睫毛很長！……而且女生也可以是最強的！💪🎀'],
      ['今天有你當搭檔，虎寶超開心！', '平常只能在門口揮手……今天可以一起衝，感覺像真的冒險一樣！吼～ 💕'],
    ],
    world: {
      airport: [['飛機！！虎寶好想坐駕駛座！', '搭檔，等一下我們去客艙，虎寶要坐第一排！✈️'], ['安檢的門可以穿過去耶！', '虎寶要以最快速度通過——吼！……咦，嗶嗶叫了，是帽子上的金屬嗎？']],
      park: [['這裡是虎寶的地盤！', '每一個遊樂設施虎寶都坐過一百次以上，問虎寶就對了！🏰']],
      hotel: [['大飯店好安靜……虎寶要小聲一點……', '……（三秒後）吼！不行，虎寶忍不住了！🐯'], ['熊熊就在這裡上班！', '走，去大廳嚇她一跳！……啊，她應該在睡午覺，那我們小聲一點 🐻']],
      mall: [['購物中心好大！', '虎寶想去運動用品店，買一雙跑最快的鞋子 👟'], ['小楓姊姊說話好成熟……', '虎寶學不來啦！虎寶說話只有一種音量——最大聲！']],
      nature: [['森林！虎寶的祖先就住在這種地方！', '吼～～～！（回音：吼～～）……有回音耶！再一次！🌲'], ['環山步道！來比賽誰先爬到觀景台！', '輸的人揹對方下山！……好啦，虎寶揹你就好 ⛰️']],
    },
    spots: [
      [/入口大門|城門/, ['這是虎寶站崗的大門！每天都在這裡大喊「歡迎光臨」，聲音傳到城堡都聽得到！🐯']], [/童話大街/, ['炸雞攤就在這附近！聞到了嗎？虎寶的鼻子不會錯！🍗']],
      [/星光廣場|噴泉/, ['星星噴泉！虎寶每天都許願：成為最強的吉祥物！✨']], [/城堡/, ['星光城堡！公主就是在這裡把帽子戴到虎寶頭上的 🏰🎩']],
      [/旋轉木馬/, ['旋轉木馬太慢了啦……好吧，坐一次，給熊熊面子 🎠']], [/茶杯/, ['茶杯！來挑戰虎寶的紀錄——47 圈！🌀']],
      [/摩天輪/, ['摩天輪……慢慢的……虎寶最上面的時候要大喊一次！🎡']], [/雲霄飛車/, ['飛龍雲霄飛車！第一排！雙手舉高！吼～～！🎢']],
      [/天鵝湖/, ['天鵝湖……虎寶只是不想弄濕帽子，不是怕水喔！🦢']], [/飛龍森林/, ['飛龍森林！搭檔，跟緊虎寶，有龍出來虎寶保護你！🐉']],
      [/大廳/, ['好大的吊燈！虎寶可以跳起來摸到嗎？……不行嗎？好吧 ✨']], [/營火/, ['營火！虎寶要烤十支棉花糖！🔥']],
      [/吊橋/, ['吊橋在晃！好刺激！來跳一下——開玩笑的啦！🌉']], [/客艙/, ['客艙！虎寶要坐靠窗，起飛的時候要大喊！✈️']],
    ],
    thoughts: ['（炸雞……好想吃炸雞……）', '（{place}好熱鬧！吼～）', '（下一個要找搭檔比什麼呢……）',
      '（跟搭檔一起冒險，比站崗好玩一百倍！）', '（尾巴！尾巴不要掃到小朋友……）', '（等一下要不要再坐一次雲霄飛車……）',
      '（{place}……下次要拉熊熊一起來）', '（肚子在吼了……不是虎寶在吼！）', '（今天的虎寶，也是最強的！✊）'],
  },
  mia: {
    start: '好呀，櫃檯先交給同事。今天我就不當櫃檯小姐了，當您的嚮導兼朋友 😊', hello: '接下來想去哪裡呢？我陪您。今天什麼都可以問我，連員工八卦也可以喔。', again: '還想聊什麼呢？我今天心情很好，什麼都可以說 😊',
    bye: '那我回崗位了……說真的，今天是我最近最開心的一天。謝謝您陪我，下次也要點名我喔 💐', where: '這裡是{place}。偷偷說，這裡是我私心推薦的地方之一喔。',
    chat: [
      ['其實我很少離開櫃檯，能這樣走走覺得好新鮮。', '您知道嗎，站在櫃檯的時候，我都在想客人們要去哪裡玩。今天終於換我跟著去了 ✨'],
      ['米露常說我太認真了……', '可是如果我不認真，她就會更不認真呀！總要有一個人顧著嘛 😮‍💨', '……不過今天，我也想偷懶一下下。'],
      ['我最喜歡空中酒吧的夜景，下班後常常和米露一起去看。', '我會點一杯無酒精的莫希多，米露每次都點最甜的那一杯，然後喝到一半就說太甜了 🍹'],
      ['偷偷告訴您，奧蘿拉熊其實很怕打雷喔。', '上次打雷的時候，她躲在我的櫃檯底下，尾巴還露在外面 🐻'],
      ['您覺得我說話會不會太正式？', '同事都說我講話像在念說明書……我今天努力放輕鬆一點，有沒有比較好？😅'],
      ['我有一個小小的夢想。', '想要有一天，在飯店的咖啡廳當一天咖啡師。拉花我偷偷練過了，畫愛心已經畫得很漂亮了喔 ☕💗'],
      ['您知道米露比我晚一年被做出來嗎？', '她剛來的時候連門都不會開，每次都撞到玻璃門。現在跑得比我還快，時間過好快呢。'],
      ['工作的時候我要記住每一位客人的名字和喜好。', '不過今天不用記筆記，我只想好好記住和您一起逛的這一天 😊'],
      ['您累了嗎？要不要坐一下？', '我知道每個世界最舒服的椅子在哪裡，這是櫃檯人員的秘密情報 🤫'],
      ['如果我也能去旅行，我想去看真正的海。', '飯店泳池的水雖然很藍，但聽說真正的海會有浪的聲音……好想聽聽看。'],
    ],
    world: {
      airport: [['這裡的報到櫃檯是我的另一個工作崗位。', '每天看著大家帶著行李出發，總覺得自己也去了好多地方 ✈️']],
      hotel: [['這間飯店的每一盞燈我都知道開關在哪裡。', '有一次停電，我閉著眼睛帶客人從 12 樓走下來，大家都嚇了一跳 💡'], ['大廳的鋼琴其實是我晚上偷偷練習的地方。', '我只會彈一首曲子，但是我彈得很好喔！🎹']],
      park: [['童話王國是我們姊妹最喜歡的地方。', '每次換班到這裡，米露都會先跑去坐一圈旋轉木馬才肯上工 🎠'], ['城堡的晚上會打燈，非常浪漫。', '……不、不是在暗示什麼啦，只是推薦而已 🏰']],
      mall: [['購物中心的香水店，我每次經過都會偷偷試一下。', '今天身上是不是有一點點花香？您聞得到嗎？🌸'], ['我其實很不會購物。', '每次都會站在兩件衣服前面想很久，最後米露幫我決定 😅']],
      nature: [['在城市裡待久了，來森林真的很放鬆。', '聽，那是溪水的聲音，還有鳥叫……工作時都聽不到這些呢 🌿'], ['翠谷木屋的咖啡很好喝喔。', '我偷偷跟店員學了手沖，下次泡給您喝 ☕']],
    },
    spots: [
      [/接待櫃檯/, ['這是我平常站的地方！從這邊看出去的大廳，是我每天的風景。今天換個角度看，感覺不一樣呢。']], [/挑高大廳/, ['我最喜歡大廳的水晶吊燈，晚上點起來的時候真的好美 ✨']],
      [/咖啡/, ['咖啡廳的可頌很好吃，外酥內軟。要不要坐下來吃一個？我請客 ☕']], [/自助餐/, ['自助餐我推薦甜點區的馬卡龍塔！我都先拿甜點，這是我的小任性 🍰']],
      [/泳池/, ['我其實不會游泳……機器人泡水會壞掉嘛。不過我很喜歡坐在池邊看水光 💧']], [/健身房/, ['米露最近說要練腹肌……機器人要怎麼練腹肌呢？😂']],
      [/空中酒吧/, ['就是這裡！我最喜歡的夜景。我們在這邊站一下好嗎？']], [/套房/, ['總統套房平常不對外開放喔，今天是特別招待 🤫']],
      [/城堡/, ['這座城堡我小時候……我是說剛被做出來的時候，以為真的住著公主 🏰']], [/摩天輪/, ['坐摩天輪的時候不要往下看，這是我的血淚教訓 🎡']],
      [/香水/, ['這家香水店！我剛剛說的就是這裡。您要不要也試試看？🌸']], [/書店/, ['我喜歡看推理小說，最喜歡猜錯兇手的那一刻 📚']],
      [/遊客中心|翠谷木屋/, ['這裡是我在翠谷的工作地點！一樓的咖啡廳很香對吧～']], [/營火/, ['營火的聲音劈哩啪啦的，好療癒 🔥']],
      [/吊橋/, ['吊橋上看瀑布最漂亮了……不過，可以讓我扶著欄杆嗎？有一點點高 😅']], [/觀景台/, ['風好舒服……工作時從來沒機會這樣吹風 🍃']],
    ],
    thoughts: ['（櫃檯現在不知道忙不忙……米露應該應付得來吧。）', '（{place}的燈光很柔和，下次可以推薦給客人。）', '（能這樣慢慢走，好像在放假一樣。）',
      '（領巾有沒有歪掉呢……）', '（客人看起來很開心，太好了。）', '（今天的晚霞應該會很漂亮。）',
      '（剛剛那句話會不會太多嘴了……算了，今天就放輕鬆吧。）', '（{place}……下次休假一定要再來。）', '（好想把今天的事情寫進日記裡 📔）'],
  },
  milu: {
    start: '耶！可以光明正大偷懶……我是說，陪你逛逛 ✨ 出發出發！', hello: '下一站去哪裡？快說快說，我超興奮的！', again: '還要聊什麼？我話很多喔，你確定嗎 😆',
    bye: '蛤～這麼快……好啦，我回去工作了。下次一定還要找我喔，不准找姊姊！開玩笑的啦 😜 掰掰～', where: '這裡是{place}！我超熟的，哪裡好玩哪裡好吃問我準沒錯 😎',
    chat: [
      ['你知道嗎？姊姊在櫃檯常常偷看我巡邏 👀', '她以為我不知道，可是她的天線會跟著我轉，超明顯的啦！'],
      ['我最喜歡購物中心的玩具店，每次經過都想進去！', '上次我偷偷買了一個扭蛋，扭到跟我長得一模一樣的公仔，超級驚喜 ✨'],
      ['走累了要說喔～', '不過我是機器人不會累，我可以揹你！……好啦，開玩笑的，我們找椅子坐 😆'],
      ['奧蘿拉熊抱起來超級軟的，你抱過了嗎？🧸', '沒有的話一定要試試看！她會害羞，但是會偷偷很開心'],
      ['跟你講一個姊姊的秘密……', '她每天晚上都會對著鏡子練習微笑，練習「歡迎光臨」要說得多溫柔 🤭', '不要說是我說的喔！'],
      ['我的夢想是當雲霄飛車的駕駛！', '可是園區說雲霄飛車不需要駕駛……太過分了吧 🎢'],
      ['你覺得我跟姊姊誰比較可愛？', '……不要回答得太快喔，我會記仇的 😤', '開玩笑的啦，一定是我嘛 ✌️'],
      ['我最喜歡的食物是棉花糖！', '機器人吃棉花糖？當然是假裝吃啦，但是假裝也很開心呀 🍡'],
      ['如果我們今天逛得很開心……', '那你下次來就要直接找我喔，我會在門口等你！'],
      ['你有沒有發現我走路會有一點點彈跳？', '那是因為我的腳底彈簧比姊姊多兩個！我自己加的，噓 🤫'],
    ],
    world: {
      airport: [['機場的玻璃窗看飛機最棒了！', '我最喜歡看飛機起飛的那一瞬間，咻～的一聲 🛫']],
      hotel: [['飯店的電梯我最喜歡了，可以一直上上下下！', '上次玩太久被姊姊抓到，她罰我擦了一整天的大廳玻璃 😭'], ['空中酒吧的夜景很漂亮對吧？', '可是我比較喜歡自助餐廳，因為有巧克力噴泉！🍫']],
      park: [['童話王國是我的地盤！', '每一個遊樂設施我都坐過一百次以上，最喜歡茶杯，轉到最快超爽的 🌀'], ['晚上的城堡會發光喔！', '我每次都站在噴泉前面看，看到姊姊來叫我才回去 ✨']],
      mall: [['購物中心的冰淇淋我每一種口味都試過了！', '……我是說，看過了。機器人不能吃啦，可是看起來都好好吃 🍦'], ['玩具店的老闆認識我！', '因為我每天都去看那個會跳舞的機器人玩具，牠是我的偶像 🤖']],
      nature: [['森林裡好安靜喔，我都不習慣了！', '大喊一聲看看會不會有回音……喂～～～！……啊，被瞪了 😅'], ['晚上一定要來營火區！', '我烤棉花糖超厲害的，熊熊烤的都焦掉，所以都是我幫她烤 🔥']],
    },
    spots: [
      [/泳池/, ['泳池！要比賽誰先游到對面嗎？……我不能下水，你游我幫你計時 ⏱️']], [/健身房/, ['我最近在練腹肌！你看你看～……好啦機器人沒有腹肌 💪']],
      [/咖啡/, ['咖啡廳！姊姊最喜歡這裡，我比較喜歡隔壁的甜點 🍰']], [/自助餐/, ['巧克力噴泉！！我們去看巧克力噴泉！🍫']],
      [/電梯/, ['電梯電梯！我可以按樓層嗎？讓我按讓我按！']], [/大廳/, ['姊姊平常就站在那邊～要不要一起去嚇她一下？😈']],
      [/茶杯/, ['茶杯！要轉最快的那種！轉到頭暈才好玩 🌀']], [/雲霄飛車/, ['雲霄飛車！走走走，坐最前面那排！🎢']],
      [/旋轉木馬/, ['我每次都搶粉紅色那隻馬，今天讓給你坐～']], [/噴泉/, ['許願池！快丟一個硬幣許願～我已經許了一百個願望了 ✨']],
      [/玩具/, ['我的偶像就在裡面！那個會跳舞的機器人！🤖']], [/冰淇淋/, ['這家的草莓口味是粉紅色的，跟我的天線一樣 🍓']],
      [/美食街/, ['美食街好香～可惜我吃不到，你幫我多吃一點！']], [/營地服務台/, ['這是我在翠谷的櫃檯！看，我把小盆栽擺得很可愛吧 🌱']],
      [/營火/, ['我的地盤！晚上這裡最熱鬧了 🔥']], [/吊橋/, ['來來來，我們在吊橋中間跳一下！……開玩笑的，不要打我 😆']],
      [/小木屋|帳篷|露營車/, ['今晚要住這裡嗎？我可以幫你蓋被子喔～']],
    ],
    thoughts: ['（嘿嘿，偷懶成功 ✌️ 姊姊應該沒發現吧？）', '（{place}好像很好玩，下次休假再來！）', '（肚子有點餓了……機器人會餓嗎？好像會欸。）',
      '（要是能一直這樣逛下去就好了～）', '（剛剛那家店的櫥窗好可愛！）', '（走路的時候哼歌，會不會被聽到啊……♪）',
      '（等一下要拍照的話，我要擺什麼姿勢呢……）', '（{place}適合跟姊姊一起來！）', '（今天的我是不是特別可愛？一定是吧 ✨）'],
  },
};
for (const c of CHARACTERS) { c.person = PERSON_OF[c.id] || c.id; c.with = COMPANION[c.person]; }
// with one world there is no portal and nothing elsewhere to talk about
if (SOLO) {
  const elsewhere = LITE ? /傳送門|購物中心|童話王國|Galleria|米雅|米露/ : /傳送門|購物中心|童話王國|Galleria/;
  for (let i = CHARACTERS.length - 1; i >= 0; i--) if (!WORLDS[CHARACTERS[i].world] || (LITE && CHARACTERS[i].id !== 'bear')) CHARACTERS.splice(i, 1);
  for (const c of CHARACTERS) if (c.menu) c.menu = c.menu.filter((m) => !m.portal);
  for (const t of Object.values(COMPANION)) {
    if (t.chat) t.chat = t.chat.filter((l) => !elsewhere.test(l.join('')));
    if (t.thoughts) t.thoughts = t.thoughts.filter((l) => !elsewhere.test(l));
    for (const k of Object.keys(t.world || {})) t.world[k] = t.world[k].filter((l) => !elsewhere.test(l.join('')));
    if (t.spots) t.spots = t.spots.map(([re, ls]) => [re, ls.filter((l) => !elsewhere.test(l))]).filter(([, ls]) => ls.length);
  }
}
// pick something to say she hasn't said lately: her general talk plus what she has to say about this world
const said = new Map();
function fresh(n, key, pool) {
  const recent = said.get(n.c.id + key) || [];
  const left = pool.filter((x) => !recent.includes(x));
  const x = pick(left.length ? left : pool);
  said.set(n.c.id + key, [...recent, x].slice(-Math.max(1, Math.floor(pool.length * 0.6))));
  return x;
}
const freshChat = (n) => fresh(n, 'chat', [...n.c.with.chat, ...(n.c.with.world?.[W.key] || [])]);
let companion = null;                   // id of the character walking with the visitor
try { companion = localStorage.getItem('aurora-world-companion'); } catch { }
if (!CHARACTERS.some((c) => c.id === companion && c.with)) companion = null;
const saveCompanion = () => { try { if (companion) localStorage.setItem('aurora-world-companion', companion); else localStorage.removeItem('aurora-world-companion'); } catch { } };
const companionChar = () => CHARACTERS.find((c) => c.id === companion) || null;
const steps = [];                       // where the visitor walked, for the companion to follow
let stepsWorld = null, thinkT = 30;
const isFollower = (n) => !!n.follow;

function makeFollower(n) {
  n.follow = true; n.mode = 'follow'; n.path = []; n.outing = null; n.sitWant = 0; n.sitK = 0; n.act = null; n.greeted = true;
  n.post = n.root.position.clone();
  const i = dynColliders.indexOf(n.pillar);
  if (i >= 0) dynColliders.splice(i, 1);          // she walks at your heels: no bumping into her
}
// put her just behind the visitor (or beside, or in front, wherever there is floor and no wall)
function placeBeside(n, poof = true) {
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  const eye = new THREE.Vector3(player.pos.x, player.pos.y + 1.0, player.pos.z);
  let spot = null;
  const g = (n.c.gap || 1.9) / 1.9;                    // a roomier companion stands further off
  for (const [b, r] of [[1.6 * g, 0.7], [1.6 * g, -0.7], [0, 1.4 * g], [0, -1.4 * g], [-1.5 * g, 0.6]]) {
    const p = new THREE.Vector3(player.pos.x - fx * b + rx * r, player.pos.y, player.pos.z - fz * b + rz * r);
    const to = new THREE.Vector3(p.x - eye.x, 0, p.z - eye.z);
    const len = to.length();
    if (castHit(eye, to.normalize(), len + 0.4)) continue;
    const g = groundHeight(p);
    if (g === -Infinity || Math.abs(g - player.pos.y) > 0.6) continue;
    spot = p.setY(g);
    break;
  }
  spot ||= player.pos.clone();
  n.root.position.copy(spot); n.post.copy(spot);
  n.path = []; n.speed = 0; n.mode = 'follow'; n.outing = null; n.sitWant = 0; n.sitK = 0;
  n.yaw = n.root.rotation.y = Math.atan2(player.pos.x - spot.x, player.pos.z - spot.z);
  steps.length = 0;
  if (poof) { burst(headPos(n, 0.75), 'star', 8, 0.6); }
}
function startCompanion(n) {
  const old = npcs.find((m) => m !== n && isFollower(m));
  if (old) dismissCompanion(old, true);
  companion = n.c.id;
  saveCompanion();
  endOuting(n);
  makeFollower(n);
  steps.length = 0; stepsWorld = W.key;
  burst(headPos(n, 1.0), 'heart', 6, 0.5);
}
function dismissCompanion(n, quiet = false) {
  companion = null;
  saveCompanion();
  burst(headPos(n, 0.75), 'star', 8, 0.6);
  if (!quiet) toast(`${n.c.zh}：${n.c.with.bye}`);
  removeNpc(n);
  // back to work: whichever of her posts is in this world gets her back
  for (const c of CHARACTERS) {
    if (c.world === W.key && c.person === n.c.person && isOn(c) && !npcs.some((m) => m.c === c)) loadCharacter(c).catch((e) => console.warn(e));
  }
}
// you sat down: take a free seat close to yours (reusing the outing's way of sitting).
// The floor is the one you stood on, measured from below table height, so chairs tucked
// under a table count too; she can come at a seat from the front or either side.
// She gets there along your footsteps to where you stood before sitting down, and only
// takes a seat whose front she can reach from there in a straight line; else she stands.
const SHARE_R = 1.9;            // a seat this close to yours is at the same sofa, table or bench
function sitNear(n) {
  const floor = sit.standPos.y, mine = sit.seat.pos, from = sit.standPos;
  const clearWay = (a, b) => {
    const to = new THREE.Vector3(b.x - a.x, 0, b.z - a.z), len = to.length();
    if (len < 0.05) return true;
    to.normalize();
    return [0.35, 1.0].every((h) => !castHit(new THREE.Vector3(a.x, floor + h, a.z), to, len + RADIUS));
  };
  // the same table or sofa: the spots in front of the two seats are no further apart
  // than the seats themselves (back to back at neighbouring tables, they drift apart)
  const front = (st, d) => new THREE.Vector3(st.pos.x - Math.sin(st.yaw) * d, 0, st.pos.z - Math.cos(st.yaw) * d);
  const together = (st) => front(st, 0.6).distanceTo(front(sit.seat, 0.6)) <= Math.hypot(st.pos.x - mine.x, st.pos.z - mine.z) + 0.05;
  const cands = SEATS.filter((st) => {
    if (st === sit.seat || !together(st)) return false;
    const d = st.pos.distanceTo(mine), h = st.pos.y - floor;
    return st.kind !== 'bed' && d >= 0.45 && d < SHARE_R && h > 0.2 && h < 1.0;
  }).sort((a, b) => a.pos.distanceTo(mine) - b.pos.distanceTo(mine)).slice(0, 12);
  for (const st of cands) {
    const th = st.yaw + Math.PI, fx = Math.sin(th), fz = Math.cos(th);     // the way someone sitting there faces
    for (const [f, sd] of [[0.7, 0], [0.45, 0.6], [0.45, -0.6], [0, 0.75], [0, -0.75], [1.1, 0]]) {
      const p = new THREE.Vector3(st.pos.x + fx * f + fz * sd, floor, st.pos.z + fz * f - fx * sd);
      // floor there? look down from just above it, so a low coffee table is not mistaken for floor
      const down = castHit(new THREE.Vector3(p.x, floor + 0.2, p.z), new THREE.Vector3(0, -1, 0), 0.5);
      if (!down || Math.abs(down.point.y - floor) > 0.12) continue;
      if (castHit(new THREE.Vector3(p.x, floor + 0.2, p.z), new THREE.Vector3(0, 1, 0), 1.2)) continue;   // under a table
      const to = new THREE.Vector3(st.pos.x - p.x, 0, st.pos.z - p.z), len = to.length();
      const hit = castHit(new THREE.Vector3(p.x, floor + 0.25, p.z), to.normalize(), len);
      // something in the way of sitting down (the seat's own frame, close to it, does not count)
      if (hit && Math.hypot(hit.point.x - st.pos.x, hit.point.z - st.pos.z) > 0.9) continue;
      // straight there, or round the furniture by one turning point (a coffee table, say)
      const via = clearWay(from, p) ? [] : findPath(from.clone().setY(floor), p)?.slice(0, -1);
      if (!via) continue;
      n.mode = 'outing';
      n.outing = {
        o: { via: [[p.x, -p.z]], seat: [st.pos.x, -st.pos.z], h: st.pos.y - floor, z: floor, face: [st.pos.x + fx * 2, -(st.pos.z + fz * 2)] },
        phase: 'go', t: 0,
      };
      const way = steps.splice(0).map((v) => ({ v, push: false }));      // your footsteps, up to the seat
      n.path = [...way, ...[from.clone().setY(floor), ...via, p].map((v) => ({ v, push: false }))];
      n.post.y = floor;
      return true;
    }
  }
  return false;
}
// ---- finding a way round furniture -------------------------------------------------------
// A grid of 0.3 m cells around the two spots (up to 9 m beyond them): a cell is floor when
// looking down from 1.7 m up meets the floor there (not a table, a counter or a wall top),
// and a step to a neighbour must not run into anything at knee height. Cells next to an
// obstacle are avoided so she does not brush along it. A* over that, then the corners are
// pulled straight wherever the way is clear.
const PATH_CELL = 0.3;
function findPath(a, b) {
  const y = a.y, pad = 6;
  const x0 = Math.min(a.x, b.x) - pad, z0 = Math.min(a.z, b.z) - pad;
  const nx = Math.min(90, Math.ceil((Math.abs(a.x - b.x) + 2 * pad) / PATH_CELL) + 1);
  const nz = Math.min(90, Math.ceil((Math.abs(a.z - b.z) + 2 * pad) / PATH_CELL) + 1);
  const at = (i, j) => new THREE.Vector3(x0 + i * PATH_CELL, y, z0 + j * PATH_CELL);
  const cell = (v) => [Math.round((v.x - x0) / PATH_CELL), Math.round((v.z - z0) / PATH_CELL)];
  const floorAt = new Map(), down = new THREE.Vector3(0, -1, 0), side = new THREE.Vector3();
  const isFloor = (i, j) => {
    if (i < 0 || j < 0 || i >= nx || j >= nz) return false;
    const k = i * nz + j;
    if (!floorAt.has(k)) {
      const p = at(i, j);
      ray.set(_eo.set(p.x, y + 1.7, p.z), down); ray.far = 2.1;     // from above counter height
      const h = ray.intersectObject(collider, false)[0];
      floorAt.set(k, !!h && h.point.y < y + 0.3 && h.point.y > y - 0.3);
    }
    return floorAt.get(k);
  };
  const open = (i, j) => isFloor(i, j) && isFloor(i + 1, j) && isFloor(i - 1, j) && isFloor(i, j + 1) && isFloor(i, j - 1);
  const edges = new Map();
  const edgeClear = (i, j, axis) => {            // from (i, j) one cell along +x (axis 0) or +z (axis 1)
    const k = (i * nz + j) * 2 + axis;
    if (!edges.has(k)) {
      const p = at(i, j); side.set(axis ? 0 : 1, 0, axis ? 1 : 0);
      ray.set(_eo.set(p.x, y + 0.4, p.z), side); ray.far = PATH_CELL + 0.1;
      edges.set(k, !ray.intersectObject(collider, false)[0]);
    }
    return edges.get(k);
  };
  const card = (i, j, di, dj) => (di ? edgeClear(Math.min(i, i + di), j, 0) : edgeClear(i, Math.min(j, j + dj), 1));
  // diagonal steps only where both ways round the corner are clear
  const stepClear = (i, j, di, dj) => (!di || !dj ? card(i, j, di, dj)
    : card(i, j, di, 0) && card(i + di, j, 0, dj) && card(i, j, 0, dj) && card(i, j + dj, di, 0));
  const [si, sj] = cell(a), [gi, gj] = cell(b);
  const key = (i, j) => i * nz + j, H = (i, j) => Math.hypot(i - gi, j - gj);
  const g = new Map([[key(si, sj), 0]]), from = new Map(), heap = [], done = new Set();
  const push = (e) => { heap.push(e); for (let c = heap.length - 1; c > 0;) { const p2 = (c - 1) >> 1; if (heap[p2][0] <= heap[c][0]) break; [heap[p2], heap[c]] = [heap[c], heap[p2]]; c = p2; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let c = 0; ;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; }
    }
    return top;
  };
  push([H(si, sj), si, sj]);
  let found = false, n = 0;
  while (heap.length && n++ < 4000) {
    const [, i, j] = pop();
    const k = key(i, j);
    if (done.has(k)) continue;
    done.add(k);
    if (Math.abs(i - gi) <= 1 && Math.abs(j - gj) <= 1) { from.set(key(gi, gj), k); found = true; break; }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ii = i + di, jj = j + dj, kk = key(ii, jj);
      if (done.has(kk)) continue;
      // the start and the goal may sit right by furniture; everything between keeps clear of it
      const near = Math.hypot(ii - si, jj - sj) < 2 || Math.hypot(ii - gi, jj - gj) < 2;
      if (!(near ? isFloor(ii, jj) : open(ii, jj)) || !stepClear(i, j, di, dj)) continue;
      const ng = g.get(k) + Math.hypot(di, dj);
      if (ng < (g.get(kk) ?? Infinity)) { g.set(kk, ng); from.set(kk, k); push([ng + H(ii, jj), ii, jj]); }
    }
  }
  if (!found) return null;
  const pts = [];
  for (let k = key(gi, gj); k !== undefined && k !== key(si, sj); k = from.get(k)) pts.push(at(Math.floor(k / nz), k % nz));
  pts.reverse();
  pts[pts.length - 1] = b.clone().setY(y);
  // pull the corners straight
  const out = []; let cur = a;
  for (let q = 0; q < pts.length;) {
    let far = q;
    while (far + 1 < pts.length && !blockedWide(cur, pts[far + 1])) far++;
    out.push(pts[far]); cur = pts[far]; q = far + 1;
  }
  return out;
}
// the same, for a body 0.5 m wide
function blockedWide(a, b) {
  const sx = -(b.z - a.z), sz = b.x - a.x, l = Math.hypot(sx, sz) || 1, o = 0.25 / l;
  return [-1, 0, 1].some((k) => blockedBetween(new THREE.Vector3(a.x + sx * o * k, a.y, a.z + sz * o * k), new THREE.Vector3(b.x + sx * o * k, b.y, b.z + sz * o * k)));
}
// is there furniture (a counter, say) between two spots on the same floor?
function blockedBetween(a, b) {
  const d = new THREE.Vector3(b.x - a.x, 0, b.z - a.z), len = d.length();
  if (len < 0.05) return false;
  d.normalize();
  return [0.5, 1.0].some((h) => { const hit = castHit(new THREE.Vector3(a.x, a.y + h, a.z), d, len); return hit && hit.distance < len - 0.35 && !npcs.some((m) => m.pillar === hit.object); });
}
function updateCompanion(n, dt, dist) {
  // now and then, a thought of her own (not a tour guide's announcement)
  thinkT -= dt;
  if (thinkT <= 0 && !dialog.npc && !photo.npc && !portalCand && !riding.ride && dist < 8) {
    const t = fresh(n, 'think', n.c.with.thoughts);
    toast(`💭 ${n.c.zh}：${t.includes('{place}') ? t.replace('{place}', locate()[0]) : t}`);
    thinkT = 28 + Math.random() * 30;
  }
  // arriving somewhere she likes: a word about it (once per place, not too often)
  const place = locateHere()[0];
  if (place !== n.spotAt && !dialog.npc && !photo.npc && !riding.ride && dist < 8) {   // (she has caught up with you)
    n.spotAt = place;
    const spot = n.c.with.spots?.find(([re]) => re.test(place));
    n.spotSaid ||= new Set();
    if (spot && !n.spotSaid.has(place)) {
      n.spotSaid.add(place);
      n.spotDue = { line: pick(spot[1]), t: 1.2 };      // let her catch up with you first
    }
  }
  if (n.spotDue && (n.spotDue.t -= dt) <= 0) {
    if (!dialog.npc && !photo.npc) { toast(`${n.c.zh}：${n.spotDue.line}`); thinkT = Math.max(thinkT, 15); }
    n.spotDue = null;
  }
  if (n.mode === 'outing') {                  // sitting with you: stand up when you do
    if (n.outing.phase === 'sit') n.outing.t = sit.seat ? 99 : 0;
    return;
  }
  n.greeted = true;
  if (dialog.npc === n || photo.npc === n || riding.ride || player.fly || (lift.car && inCar())) { n.path = []; return; }
  const dy = player.pos.y - n.root.position.y;
  if (n.jump || dist > 20 || Math.abs(dy) > 2.5) { n.jump = false; placeBeside(n); return; }
  if (!sit.seat) n.sitTried = false;
  if (sit.seat && sit.dir > 0 && sit.k >= 1 && dist < 8 && !n.sitTried) {
    n.sitTried = true;                         // look once per sit, not every frame
    if (sitNear(n)) return;
    // a seat for one (a lobby bench, an armchair): she just waits beside you
    if (SEATS.some((st) => st !== sit.seat && st.kind !== 'bed' && st.pos.distanceTo(sit.seat.pos) < SHARE_R)) toast(`${n.c.zh}：位子有點擠，我站在旁邊陪你～`);
  }
  while (steps.length && Math.hypot(steps[0].x - n.root.position.x, steps[0].z - n.root.position.z) < 0.45) steps.shift();
  const t = steps[0] || player.pos;
  if (dist < (n.c.gap || 1.9) && !blockedBetween(n.root.position, player.pos)) { n.path = []; n.detour = null; return; }   // beside you (not across a counter)
  const h = Math.hypot(t.x - n.root.position.x, t.z - n.root.position.z), v = Math.abs(t.y - n.root.position.y);
  if (v > 0.6 && h < v * 1.2) { placeBeside(n); return; }      // a drop or a lift on the trail: catch up instead
  n.followSpeed = dist > 6 ? 4.2 : dist > 3.5 ? 2.8 : 1.5;
  // something in the way (a counter, a table): find her own way round it
  if (blockedWide(n.root.position, t)) {
    n.detourT = (n.detourT || 0) - dt;
    if ((!n.detour?.length || n.detourTo.distanceTo(t) > 2.5) && n.detourT <= 0) {   // a plan costs a few ms: not every frame
      n.detour = findPath(n.root.position, t) || []; n.detourTo = t.clone(); n.detourT = 1.0;
    }
    n.detour ||= [];
    while (n.detour.length > 1 && Math.hypot(n.detour[0].x - n.root.position.x, n.detour[0].z - n.root.position.z) < 0.3) n.detour.shift();
    if (n.detour.length) { n.path = n.detour.map((v) => ({ v, push: false })); return; }
  }
  n.detour = null;
  n.path = steps.length ? steps.slice(0, 8).map((p) => ({ v: p, push: false })) : [{ v: player.pos, push: false }];
}
function recordSteps() {
  if (!companion || !W) return;
  if (stepsWorld !== W.key) { steps.length = 0; stepsWorld = W.key; }
  if (player.fly || riding.ride || sit.seat || !player.grounded) return;
  const last = steps[steps.length - 1];
  if (!last || last.distanceTo(player.pos) > 0.4) { steps.push(player.pos.clone()); if (steps.length > 300) steps.shift(); }
}
// called before anything that sends the character elsewhere
function endOuting(n) { n.outing = null; n.sitWant = 0; n.sitK = 0; n.root.position.y = n.post.y; }
function greet(n) { if (n.c.greet === 'bow') doAct(n, 'bow'); else n.wave = 2.6; }
function doAct(n, type) { n.act = { type, t: 0, dur: ACTS[type].dur, fired: false }; n.wave = 0; }
function setPose(n, name) {
  if (n.pose === name) return;
  n.poseFrom = n.pose; n.pose = name; n.poseK = 0;
  if (photo.npc === n) document.querySelectorAll('#photo-bar [data-pose]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pose === name)));
}
function ldir(n, side, v) { return _vd.set(side * n.leftSign * v[0], v[1], v[2]).applyQuaternion(n.root.quaternion).normalize(); }
function aimArm(n, s, side, t) {
  const B = n.bones;
  if (!t || !B[s + 'Arm'] || !B[s + 'ForeArm'] || !B[s + 'Hand']) return;
  pointBone(B[s + 'Arm'], B[s + 'ForeArm'], ldir(n, side, t[0]));
  pointBone(B[s + 'ForeArm'], B[s + 'Hand'], ldir(n, side, t[1]));
}

// ---- hearts, stars and sounds ------------------------------------------------------------
const fxList = [];
const fxTex = {};
function fxTexture(kind) {
  if (fxTex[kind]) return fxTex[kind];
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.translate(64, 64);
  g.beginPath();
  if (kind === 'heart') {
    g.moveTo(0, 40);
    g.bezierCurveTo(-70, -5, -38, -62, 0, -26);
    g.bezierCurveTo(38, -62, 70, -5, 0, 40);
    g.fillStyle = '#ff6f9f';
  } else {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 22 : 52, a = -Math.PI / 2 + i * Math.PI / 5;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = '#ffd45c';
  }
  g.shadowColor = 'rgba(255,255,255,0.9)'; g.shadowBlur = 10;
  g.fill();
  g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return (fxTex[kind] = t);
}
function burst(pos, kind, count = 8, spread = 0.35) {
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fxTexture(kind), transparent: true, depthWrite: false }));
    s.position.copy(pos).add(_va.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread * 0.6, (Math.random() - 0.5) * spread));
    s.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.5 + Math.random() * 0.7, (Math.random() - 0.5) * 0.9), life: 0, max: 1.2 + Math.random() * 0.6, size: 0.14 + Math.random() * 0.12 };
    s.renderOrder = 5;
    scene.add(s);
    fxList.push(s);
  }
}
function updateFx(dt) {
  for (let i = fxList.length - 1; i >= 0; i--) {
    const s = fxList[i], u = s.userData;
    u.life += dt;
    u.v.multiplyScalar(1 - dt * 1.2);
    s.position.addScaledVector(u.v, dt);
    s.scale.setScalar(u.size * (0.4 + Math.min(1, u.life * 5) * 0.6));
    s.material.opacity = 1 - (u.life / u.max) ** 2;
    if (u.life >= u.max) { scene.remove(s); s.material.dispose(); fxList.splice(i, 1); }
  }
}
function clearFx() { for (const s of fxList) { scene.remove(s); s.material.dispose(); } fxList.length = 0; }
const headPos = (n, k = 0.95) => _vg.set(n.root.position.x, n.root.position.y + n.c.height * k, n.root.position.z);

let actx = null;
function ac() {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { actx = null; }
  return actx;
}
function tone(f, at, dur, type = 'sine', vol = 0.1, f2 = 0) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(at, dur, freq, vol = 0.3, q = 1) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + at;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t0);
}
const sfx = {
  pop: () => tone(880, 0, 0.09, 'triangle', 0.05, 1320),
  clap: () => { noise(0, 0.14, 1800, 0.9, 0.7); tone(1046, 0.03, 0.25, 'triangle', 0.07); tone(1568, 0.1, 0.4, 'sine', 0.06); },
  hug: () => { tone(523, 0, 0.6, 'sine', 0.09); tone(659, 0.16, 0.6, 'sine', 0.08); tone(784, 0.32, 0.9, 'sine', 0.07); },
  pat: () => { tone(1318, 0, 0.18, 'sine', 0.06); tone(1760, 0.1, 0.3, 'sine', 0.05); },
  tick: () => tone(1200, 0, 0.06, 'square', 0.025),
  shutter: () => { noise(0, 0.05, 3200, 0.8, 0.6); noise(0.08, 0.07, 2200, 0.7, 0.6); },
};
const popEl = document.getElementById('pop');
const toastEl = document.getElementById('npc-toast');
const flashEl = document.getElementById('flash');
function restartAnim(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function popEmoji(txt) {
  popEl.textContent = txt; popEl.hidden = false; restartAnim(popEl, 'go');
  clearTimeout(popEmoji.t); popEmoji.t = setTimeout(() => { popEl.hidden = true; }, 1000);
}
function toast(txt) {
  const ms = Math.min(7000, 2200 + 80 * Math.max(0, txt.length - 14));   // longer lines stay up longer
  toastEl.textContent = txt; toastEl.hidden = false; toastEl.style.animationDuration = `${ms}ms`; restartAnim(toastEl, 'go');
  clearTimeout(toast.t); toast.t = setTimeout(() => { toastEl.hidden = true; }, ms);
}
function flash(kind) {
  flashEl.className = kind; flashEl.hidden = false; restartAnim(flashEl, 'go');
  clearTimeout(flash.t); flash.t = setTimeout(() => { flashEl.hidden = true; }, kind === 'love' ? 1200 : 500);
}

// ---- walking ------------------------------------------------------------------------------
function homePath(n) {
  const p = [...n.trail].reverse().map((v) => ({ v, push: false }));
  n.trail = [];
  if (Math.hypot(n.root.position.x - n.post.x, n.root.position.z - n.post.z) > 0.05 || p.length) p.push({ v: n.post, push: false });
  return p;
}
function goHome(n) {
  n.path = homePath(n);
  n.mode = n.path.length ? 'home' : n.c.patrol ? 'patrol' : 'post';
  n.pause = 2;
  n.intro = false;
}
function walkNpc(n, dt, dist) {
  const moving = n.path.length && n.sitK < 0.05 && (n.mode === 'guide' || (['home', 'patrol', 'outing', 'follow'].includes(n.mode) && dialog.npc !== n && photo.npc !== n));
  let want = 0;
  if (moving) {
    want = n.mode === 'follow' ? n.followSpeed : NPC_SPEED;
    if (n.mode === 'guide' && dist > 6) want = 0;       // wait for the visitor to catch up
    const p = n.path[0].v;
    const ax = p.x - n.root.position.x, az = p.z - n.root.position.z, al = Math.hypot(ax, az) || 1;
    const px = player.pos.x - n.root.position.x, pz = player.pos.z - n.root.position.z;
    if (dist < 1.3 && !sit.seat && (px * ax + pz * az) / al > 0.2) want = 0;   // the visitor is in the way (unless seated)
  }
  n.speed += (want - n.speed) * (1 - Math.exp(-dt * 6));
  if (!moving || n.speed < 0.02) return;
  let len = n.speed * dt;
  n.phase += len * 5.2;
  while (len > 0 && n.path.length) {
    const p = n.path[0];
    const ax = p.v.x - n.root.position.x, az = p.v.z - n.root.position.z, d = Math.hypot(ax, az);
    if (d > 0.02) n.walkYaw = Math.atan2(ax, az);
    if (d <= len) {
      n.root.position.x = p.v.x; n.root.position.z = p.v.z; n.root.position.y = p.v.y;
      len -= d;
      n.path.shift();
      if (p.push) n.trail.push(p.v);
    } else {
      n.root.position.x += ax / d * len; n.root.position.z += az / d * len;
      n.root.position.y += (p.v.y - n.root.position.y) * (len / d);    // stairs and ramps on a follower's trail
      len = 0;
    }
  }
  if (!n.path.length && n.mode !== 'follow') {
    n.speed = 0;
    if (n.mode === 'guide') { n.mode = 'arrived'; n.intro = true; }
    else if (n.mode !== 'patrol' && n.mode !== 'outing') { n.mode = n.c.patrol ? 'patrol' : 'post'; n.pause = 2; }   // back on her round
    else { n.pause = 2 + Math.random() * 4; n.yawStop = n.walkYaw; }
  }
}
// While guiding, a small box keeps you posted; '關閉對話框' hides it until you arrive
// (talk to the guide to bring it back).
function guideSay(n, text) {
  if (n.quiet || n.msg === text) return;     // only when there is news: fell behind, caught up, arrived
  if ((dialog.npc && dialog.npc !== n) || photo.npc) return;        // busy with someone else: tell later
  n.msg = text;
  say(n, text, [
    { label: '關閉對話框', go: () => { n.quiet = true; closeDialog(); } },
    { label: '不用帶路了', go: () => { n.mode = 'post'; n.quiet = false; closeDialog(); goHome(n); } }], null, true);
}
function startGuide(n, k) {
  const g = n.c.guide[k], z = n.c.p[2], lead = n.c.lead || [];
  const step = ([x, y]) => ({ v: b2t(x, y, z), push: true });
  if (n.mode === 'arrived' && n.trail.length > (n.leadN || 0)) {
    // straight on from the last stop: back along that route only to where it left the
    // lobby, then the new route (her trail keeps the lead-in, to find her post later)
    const back = n.trail.splice(n.leadN || 0).reverse().map((v) => ({ v, push: false }));
    n.path = back.concat(g.route.map(step));
  } else {
    // mid-outing: retrace the outing's own path (round the furniture) before heading out
    const back = n.outing ? [...n.outing.o.via].reverse().map(([x, y]) => ({ v: b2t(x, y, z), push: false })) : [];
    const home = n.mode === 'home' ? n.path.map((p) => ({ v: p.v, push: false })) : homePath(n);   // already on her way back
    n.path = back.concat(home, [...lead, ...g.route].map(step));
    n.leadN = lead.length;
  }
  n.mode = 'guide'; n.dest = k; n.act = null; n.quiet = false;
  n.outing = null; n.sitWant = 0;
  n.msg = '這邊請，跟我來～ 🐾';         // said before setting off, so no box until there is news
}
let fading = false;             // E does nothing while a trip fades out and in
function fadeOut() {
  fading = true;
  clearTimeout(fadeIn.t);
  warp.classList.add('fade'); warp.classList.remove('out'); warp.hidden = false;
  return new Promise((r) => setTimeout(r, 600));
}
function fadeIn() {
  fading = false;
  warp.classList.add('out');
  fadeIn.t = setTimeout(() => { warp.hidden = true; warp.classList.remove('fade'); }, 700);
}
// 直接過去: fade out, arrive together, fade back in
// where a route ends, as a place to stand: a little short of its end, facing along it
function guideSpot(n, k) {
  const r = n.c.guide[k].route;
  const [ex, ey] = r[r.length - 1], [qx, qy] = r.length > 1 ? r[r.length - 2] : n.c.p;
  const dl = Math.hypot(ex - qx, ey - qy) || 1;
  const sx = ex - (ex - qx) / dl * 1.2, sy = ey - (ey - qy) / dl * 1.2;
  return { p: [sx, sy, n.c.p[2]], yaw: Math.atan2(-(ex - sx), ey - sy) };
}
async function directTrip(n, k) {
  const g = n.c.guide[k], r = g.route;
  n.mode = 'trip';
  closeDialog();
  keys.clear();
  await fadeOut();
  if (!npcs.includes(n)) { fadeIn(); return; }
  const [ex, ey] = r[r.length - 1], [qx, qy] = r.length > 1 ? r[r.length - 2] : n.c.p;
  const dl = Math.hypot(ex - qx, ey - qy) || 1;
  const sx = ex - (ex - qx) / dl * 2.4, sy = ey - (ey - qy) / dl * 2.4;
  n.root.position.copy(b2t(ex, ey, n.c.p[2]));
  n.trail = [...(n.c.lead || []), ...r].map(([x, y]) => b2t(x, y, n.c.p[2]));   // the way back to her post
  n.leadN = (n.c.lead || []).length;
  endOuting(n);
  n.path = []; n.speed = 0; n.mode = 'arrived'; n.intro = true; n.dest = k;
  n.yaw = n.root.rotation.y = Math.atan2(sx - ex, -(sy - ey));
  teleport({ p: [sx, sy, n.c.p[2]], yaw: Math.atan2(-(ex - sx), ey - sy) });
  await new Promise((res) => setTimeout(res, 150));
  fadeIn();
}
async function placeTrip(t) {
  closeDialog();
  keys.clear();
  await fadeOut();
  teleport({ p: t.p, yaw: t.yaw });
  fadeIn();
}
async function portalTrip() {
  closeDialog();
  keys.clear();
  await fadeOut();
  teleport(portalPlace(W, true));
  fadeIn();
}

// ---- photos -------------------------------------------------------------------------------
const photoBar = document.getElementById('photo-bar');
const photoFrame = document.getElementById('photo-frame');
const photoCount = document.getElementById('photo-count');
const photoView = document.getElementById('photo-view');
const photoWrap = photoView.querySelector('.polaroid');
const photoSave = document.getElementById('photo-save');
function startPhoto(n) {
  photo.npc = n;
  closeDialog();
  const bp = n.root.position;
  const dir = new THREE.Vector3(player.pos.x - bp.x, 0, player.pos.z - bp.z);
  if (dir.lengthSq() < 0.01) dir.set(Math.sin(n.yaw), 0, Math.cos(n.yaw));
  dir.normalize();
  // step back so the whole character is in the frame, unless a wall is in the way
  // the visitor's robot stands beside the character, on whichever side is free
  photo.spot = null;
  photo.center.set(bp.x, bp.y, bp.z);
  if (avatar) {
    for (const sgn of [1, -1]) {
      const pd = new THREE.Vector3(dir.z * sgn, 0, -dir.x * sgn);
      if (castHit(new THREE.Vector3(bp.x, bp.y + 1.0, bp.z), pd, 1.9)) continue;
      photo.spot = new THREE.Vector3(bp.x + pd.x * 1.25, bp.y, bp.z + pd.z * 1.25);
      const g = groundHeight(photo.spot);
      if (g > -Infinity) photo.spot.y = g;
      photo.center.lerp(photo.spot, 0.5);
      break;
    }
  }
  let d = photo.spot ? 3.9 : 3.4;
  const c = photo.center;
  const h = castHit(new THREE.Vector3(c.x, bp.y + 1.2, c.z), dir, d + 0.5);
  if (h) d = Math.max(1.8, Math.min(d, h.distance - 0.5));
  photo.from.copy(player.pos);
  photo.to.set(c.x + dir.x * d, player.pos.y, c.z + dir.z * d);
  if (photo.spot) {
    photo.spotYaw = Math.atan2(photo.to.x - photo.spot.x, photo.to.z - photo.spot.z);
    avatar.yaw = photo.spotYaw;
    avatar.cur = null; avatar.mixer.stopAllAction();
  }
  photo.k = 0; photo.count = 0; photo.view = false;
  n.act = null;
  setPose(n, 'peace');
  document.querySelectorAll('#photo-bar [data-pose]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pose === 'peace')));
  keys.clear(); touchMove.set(0, 0);
  photoBar.hidden = false; photoFrame.hidden = false; photoView.hidden = true;
  if (document.pointerLockElement) document.exitPointerLock();
}
function updatePhoto(dt) {
  const n = photo.npc;
  if (photo.k < 1) {
    photo.k = Math.min(1, photo.k + dt / 0.8);
    player.pos.lerpVectors(photo.from, photo.to, ease(photo.k));
    player.eyeY = player.pos.y + EYE;
    const bp = photo.center, kk = 1 - Math.exp(-dt * 8);
    const want = Math.atan2(-(bp.x - player.pos.x), -(bp.z - player.pos.z));
    player.yaw += wrapAngle(want - player.yaw) * kk;
    const dd = Math.max(0.8, Math.hypot(bp.x - player.pos.x, bp.z - player.pos.z));
    player.pitch += (Math.atan2(bp.y + n.c.height * 0.5 - player.eyeY, dd) - player.pitch) * kk;
  }
  if (photo.count > 0) {
    const before = Math.ceil(photo.count);
    photo.count -= dt;
    if (photo.count <= 0) { photoCount.hidden = true; snap(); }
    else if (Math.ceil(photo.count) !== before) { photoCount.textContent = Math.ceil(photo.count); restartAnim(photoCount, 'go'); sfx.tick(); }
  }
}
function shoot() {
  if (!photo.npc || photo.count > 0 || photo.view || photo.k < 1) return;
  photo.count = 3;
  photoCount.textContent = '3'; photoCount.hidden = false; restartAnim(photoCount, 'go');
  photoBar.classList.add('busy');
  sfx.tick();
}
function snap() {
  const n = photo.npc;
  photoBar.classList.remove('busy');
  if (!n) return;
  sfx.shutter();
  composer.render();                          // draw now and copy before the browser clears the canvas
  const src = renderer.domElement, W0 = src.width, H0 = src.height;
  const cw = Math.min(W0, H0 * 0.8), ch = cw / 0.8;
  const P = 36, IW = 720, IH = 900;
  const out = document.createElement('canvas');
  out.width = IW + P * 2; out.height = IH + P + 150;
  const g = out.getContext('2d');
  g.fillStyle = '#fbf7ef'; g.fillRect(0, 0, out.width, out.height);
  g.drawImage(src, (W0 - cw) / 2, (H0 - ch) / 2, cw, ch, P, P, IW, IH);
  g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 2; g.strokeRect(P, P, IW, IH);
  g.textAlign = 'center';
  g.fillStyle = '#2a2f55';
  g.font = '600 38px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  g.fillText(`Grand Aurora × ${n.c.zh}`, out.width / 2, IH + P + 66);
  const now = new Date();
  g.fillStyle = '#b08a3e';
  g.font = '500 24px "PingFang TC","Noto Sans TC",sans-serif';
  g.fillText(`${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}  ·  ${POSES[n.pose]?.zh || ''}`, out.width / 2, IH + P + 110);
  photo.last = out;
  flash('white');
  photo.view = true;
  photoBar.hidden = true; photoFrame.hidden = true;
  photoWrap.replaceChildren(out);
  photoView.hidden = false;
  out.toBlob((blob) => {
    if (!blob || photo.last !== out) return;
    if (photo.url) URL.revokeObjectURL(photo.url);
    photo.url = URL.createObjectURL(blob);
    const img = new Image();
    img.alt = `和${n.c.zh}的合照`;
    img.onload = () => { if (photo.last === out) photoWrap.replaceChildren(img); };
    img.src = photo.url;
    photoSave.href = photo.url;
    photo.blob = blob;
  }, 'image/jpeg', 0.92);
}
function againPhoto() {
  if (!photo.npc) return;
  photo.view = false;
  photoView.hidden = true; photoBar.hidden = false; photoFrame.hidden = false;
}
function endPhoto(silent = false) {
  const n = photo.npc;
  photo.npc = null; photo.count = 0; photo.view = false; photo.spot = null;
  photoBar.hidden = true; photoFrame.hidden = true; photoView.hidden = true; photoCount.hidden = true;
  photoBar.classList.remove('busy');
  if (!n) return;
  setPose(n, null);
  if (silent) return;
  if (npcs.includes(n)) { dialog.turn = 0; say(n, '照片拍得好可愛！' + n.c.again, menuOpts(n)); }
}
photoBar.querySelectorAll('[data-pose]').forEach((b) => b.addEventListener('click', (e) => { e.currentTarget.blur(); if (photo.npc && photo.count <= 0) setPose(photo.npc, b.dataset.pose); }));
document.getElementById('photo-shoot').addEventListener('click', (e) => { e.currentTarget.blur(); shoot(); });
document.getElementById('photo-end').addEventListener('click', (e) => { e.currentTarget.blur(); endPhoto(); });
// In the Claude viewer a page can't start downloads itself: ask the viewer's save prompt
// instead. Opened from a plain web server, the link downloads as usual.
let saver = null;
if (window.claude?.use) {
  window.claude.use('downloads').then((d) => { saver = d; if (!d) photoSave.hidden = true; }).catch(() => { photoSave.hidden = true; });
}
photoSave.addEventListener('click', async (e) => {
  e.currentTarget.blur();
  if (!saver || !photo.blob) return;
  e.preventDefault();
  try { await saver.save({ filename: 'grand-aurora-bear.jpg', data: photo.blob }); } catch (err) {
    if (!['declined', 'rate_limited'].includes(err?.code)) photoSave.hidden = true;
  }
});
document.getElementById('photo-again').addEventListener('click', (e) => { e.currentTarget.blur(); againPhoto(); });
document.getElementById('photo-close').addEventListener('click', (e) => { e.currentTarget.blur(); endPhoto(); });

// ---- the head pat ------------------------------------------------------------------------
function looksAtHead(n) {
  const d = Math.hypot(player.pos.x - n.root.position.x, player.pos.z - n.root.position.z);
  if (d > 2.6 || player.pitch < 0.06) return false;
  _vh.copy(headPos(n, 0.93)).sub(camera.position).normalize();
  camera.getWorldDirection(_va);
  return _vh.dot(_va) > Math.cos(0.26);
}
function patHead(n) {
  if (n.act?.type === 'pat' && n.act.t < 1.0) return;
  doAct(n, 'pat');
  avatarEmote('yes');
  sfx.pat();
  burst(headPos(n, 1.0), 'heart', 6, 0.5);
  toast(`${n.c.zh}：${n.c.pats[n.pats++ % n.c.pats.length]}`);
}

function updateNpcs(dt) {
  for (const n of npcs) {
    n.t += dt;
    const B = n.bones;
    const talking = dialog.npc === n && !dialog.mini;
    // where is the visitor, relative to the character?
    const dx = player.pos.x - n.root.position.x, dz = player.pos.z - n.root.position.z;
    const dist = Math.hypot(dx, dz);
    const toYaw = Math.atan2(dx, dz);
    if (n.follow) updateCompanion(n, dt, dist);
    walkNpc(n, dt, dist);
    if (n.mode === 'follow') n.post.copy(n.root.position);
    // patrol: walk the loop, pausing at each corner
    if (n.mode === 'patrol' && !n.path.length && dialog.npc !== n && photo.npc !== n && (n.pause -= dt) <= 0) {
      n.pi = (n.pi + 1) % n.c.patrol.length;
      const [x, y] = n.c.patrol[n.pi];
      n.path = [{ v: b2t(x, y, n.c.p[2]), push: false }];
    }
    if (n.mode === 'outing' && dialog.npc !== n && photo.npc !== n) updateOuting(n, dt);
    n.sitK = THREE.MathUtils.clamp(n.sitK + (n.sitWant ? dt : -dt) / 1.1, 0, 1);
    // guiding: keep the visitor posted, give up when they wander off
    if (n.mode === 'guide') {
      if (dist > 35) { n.mode = 'post'; if (dialog.npc === n) closeDialog(); goHome(n); }
      else if (dist > 6) guideSay(n, '快跟上來喔～ 我在這裡等你 🐾');
      else if (dist < 4.5) guideSay(n, '這邊請，跟我來～ 🐾');
    } else if (n.mode === 'arrived' && n.intro) {
      if (dist < 3.8) {
        n.intro = false; n.quiet = false;
        const g = n.c.guide[n.dest];
        dialog.turn = 0.9;
        say(n, g.intro, [{ label: `謝謝${n.c.zh}！`, go: () => { n.wave = 2.6; say(n, '不客氣～有需要再來大廳找我喔！', null, closeDialog); } }, { label: '再帶我去別的地方', go: () => runTopic(n, { guide: true }) }]);
      } else if (dist > 35) { if (dialog.npc === n) closeDialog(); else goHome(n); }
      else guideSay(n, '到囉～ 快過來這邊！');
    }
    // face the way she walks, the visitor while busy with them, her post otherwise
    let wantYaw = n.mode === 'patrol' ? n.yawStop ?? n.yaw0 : n.yaw0;
    if (n.speed > 0.15) wantYaw = n.walkYaw;
    else if (n.sitK > 0.01) wantYaw = n.sitYaw;
    else if (talking || photo.npc === n || !['post', 'patrol', 'outing'].includes(n.mode) || n.act?.type === 'pat' || (n.act?.type === 'bow' && dist < 6)) wantYaw = toYaw;
    else if (n.mode === 'outing') wantYaw = n.yaw;
    // the bear can't turn her head far (no neck to speak of): past that she turns round
    // to face a visitor who is close by, and stays facing them until they leave
    if (n.c.lookSide && n.speed <= 0.15 && n.sitK <= 0.01 && n.mode !== 'outing') {
      const off = Math.abs(wrapAngle(toYaw - n.yaw));
      if (dist > 7) n.facing = false;
      else if (off > n.c.lookSide) n.facing = true;
      if (n.facing) wantYaw = toYaw;
    }
    n.yaw += wrapAngle(wantYaw - n.yaw) * (1 - Math.exp(-dt * (n.speed > 0.15 ? 5 : 3)));
    n.root.rotation.y = n.yaw + (n.act?.type === 'spin' ? ease(Math.min(1, n.act.t / ACTS.spin.dur)) * Math.PI * 2 : 0);
    // greet once each time the visitor walks up to her post
    const standing = n.mode === 'post' || ((n.mode === 'patrol' || n.mode === 'follow') && n.speed < 0.1);
    if (standing && dist < 4.5 && !n.greeted && started && !n.act && !dialog.npc) { n.greeted = true; greet(n); }
    if (dist > 8) n.greeted = false;
    n.wave = Math.max(0, n.wave - dt);
    // something to do while nobody is talking to her
    if (n.mode === 'post' && n.c.outings && !dialog.npc && photo.npc !== n && !n.act && n.wave <= 0 && (n.outingT -= dt) <= 0) startOuting(n, pick(n.c.outings));
    if (standing && !n.path.length && !dialog.npc && photo.npc !== n && !n.act && n.wave <= 0 && dist < 22) {
      n.idle -= dt;
      if (n.idle <= 0) { doAct(n, pick(n.c.idles || ['tidy', 'nod', 'look'])); n.act.idle = true; n.idle = 7 + Math.random() * 8; }   // (no emoji or sound: nobody asked)
    }
    if (n.act) {
      n.act.t += dt;
      const a = n.act;
      if (a.type === 'highfive' && !a.fired && a.t > ACTS.highfive.at) {
        a.fired = true; sfx.clap(); popEmoji('✋');
        burst(B.RightHand ? B.RightHand.getWorldPosition(new THREE.Vector3()) : headPos(n, 0.8), 'star', 10, 0.4);
      }
      if (a.type === 'yay' && !a.fired && a.t > ACTS.yay.at) { a.fired = true; if (!a.idle) { popEmoji('✌️'); sfx.pop(); } burst(headPos(n, 1.05), 'star', 8, 0.4); }
      if (a.type === 'shake' && !a.fired && a.t > ACTS.shake.at) { a.fired = true; popEmoji('🤝'); }
      if (a.type === 'roar' && !a.fired && a.t > ACTS.roar.at) { a.fired = true; if (!a.idle) { popEmoji('🐯'); sfx.pop(); } burst(headPos(n, 1.05), 'star', 10, 0.5); }
      if (a.type === 'hug' && !a.fired && a.t > ACTS.hug.at) {
        a.fired = true; sfx.hug(); popEmoji('💕'); flash('love');
        burst(headPos(n, 0.7).add(_vb.set(dx, 0, dz).normalize().multiplyScalar(0.5)), 'heart', 12, 0.8);
      }
      if (a.t >= a.dur) n.act = null;
    }
    n.poseK = Math.min(1, n.poseK + dt / 0.35);
    if (n.pose === 'heart' && (n.heartT -= dt) <= 0) { n.heartT = 0.45; burst(headPos(n, 1.08), 'heart', 1, 0.3); }
    let lookWant = dist < 7 ? 1 : 0;
    if (n.sitK > 0.5 && !talking) {          // seated: mostly ahead, now and then a glance at you
      if ((n.glanceT = (n.glanceT ?? 2) - dt) <= 0) { n.glancing = !n.glancing; n.glanceT = n.glancing ? 2 + Math.random() * 1.5 : 4 + Math.random() * 5; }
      if (!n.glancing) lookWant = 0;
    }
    n.look += (lookWant - n.look) * (1 - Math.exp(-dt * 3));
    // start from the arms-down pose every frame, then layer the motions on top
    for (const [k, b] of Object.entries(B)) b.quaternion.copy(n.base[k]);
    n.root.updateMatrixWorld(true);
    const side = _vs.set(-1, 0, 0).applyQuaternion(n.root.quaternion);   // rotating about this swings limbs forwards
    // the bear's tail: a wag now and then, a quick happy wag (high five, hug, a pat on the
    // head, posing for a photo), a sway in step while walking
    if (B.Tail) {
      const happy = ['highfive', 'hug', 'pat', 'roar', 'spin'].includes(n.act?.type) || (photo.npc === n && n.pose);
      if ((n.wagT = (n.wagT ?? 4) - dt) <= 0) { n.wag = 1.6; n.wagT = 6 + Math.random() * 7; }
      n.wag = Math.max(0, (n.wag || 0) - dt);
      const amp = happy ? 0.9 : n.wag > 0 ? 0.7 * Math.min(1, n.wag / 0.4) : n.speed > 0.15 ? 0.25 : 0;
      const fq = happy ? 13 : n.wag > 0 ? 8 : 9;
      if (amp > 0.001) turnBone(B.Tail, _qc.setFromAxisAngle(WORLD_UP, Math.sin(n.t * fq) * amp));
      if (n.speed > 0.15) turnBone(B.Tail, _qc.setFromAxisAngle(side, Math.abs(Math.sin(n.t * 9)) * 0.15));
    }
    const w = Math.min(1, n.speed / NPC_SPEED);
    const breath = Math.sin(n.t * 2.0);
    const ak = n.act ? ease(Math.min(1, n.act.t / 0.3, (n.act.dur - n.act.t) / 0.35)) : 0;
    let bob = breath * 0.004 * (talking ? 2.5 : 1) + Math.abs(Math.cos(n.phase)) * 0.03 * w;
    if (n.act?.type === 'pat') bob += Math.abs(Math.sin(n.act.t * 9)) * 0.025 * ak;
    if (n.pose === 'cheer') bob += Math.abs(Math.sin(n.t * 6)) * 0.02 * n.poseK;
    if (B.Hips) { B.Hips.position.y = (B.Hips.userData.y0 ??= B.Hips.position.y) + bob / n.model.scale.y; }
    if (B.Spine1) turnBone(B.Spine1, _qc.setFromAxisAngle(_vb.set(1, 0, 0).applyQuaternion(n.root.quaternion), breath * 0.02));
    if (B.Spine) turnBone(B.Spine, _qc.setFromAxisAngle(WORLD_UP, Math.sin(n.t * 0.7) * 0.05 + Math.sin(n.phase) * 0.07 * w));
    // walking: legs swing and knees bend, the arms swing the other way
    if (w > 0.02) {
      const s = Math.sin(n.phase), c = Math.cos(n.phase);
      const legs = [['LeftUpLeg', s * 0.42], ['RightUpLeg', -s * 0.42], ['LeftLeg', -Math.max(0, c) * 0.65], ['RightLeg', -Math.max(0, -c) * 0.65], ['LeftArm', -s * 0.3], ['RightArm', s * 0.3]];
      for (const [b, ang] of legs) if (B[b]) turnBone(B[b], _qc.setFromAxisAngle(side, ang * w));
    }
    // body language of the actions
    if (n.act && B.Spine) {
      const t = n.act.t;
      // (a positive turn about 'side' tips the upper body back, so leaning in is negative)
      if (n.act.type === 'hug') turnBone(B.Spine, _qc.setFromAxisAngle(side, -0.14 * ak));
      if (n.act.type === 'tidy') turnBone(B.Spine, _qc.setFromAxisAngle(side, -0.12 * ak));
      if (n.act.type === 'bow') { turnBone(B.Spine, _qc.setFromAxisAngle(side, -0.22 * ak)); if (B.Spine1) turnBone(B.Spine1, _qc.setFromAxisAngle(side, -0.18 * ak)); }
      if (n.act.type === 'pat') turnBone(B.Spine, _qc.setFromAxisAngle(_vb.set(0, 0, 1).applyQuaternion(n.root.quaternion), Math.sin(t * 9) * 0.1 * ak));
    }
    // head: look at the visitor's eyes (limited), with a little tilt and nodding while talking
    if (B.Head && n.look > 0.01) {
      const rel = wrapAngle(toYaw - n.yaw);
      const lim = n.c.lookSide ?? (n.sitK > 0.5 ? 1.35 : 1.0);    // beside you on a sofa she has to turn further
      const yawH = THREE.MathUtils.clamp(rel, -lim, lim) * n.look;
      B.Head.getWorldPosition(_va);
      // (the bear's head sits straight on the collar: lifting the chin or turning far
      // stretches the throat and pulls the cheeks onto the shoulders)
      const pitch = THREE.MathUtils.clamp(Math.atan2(player.eyeY - _va.y, Math.max(0.5, dist)), -0.5, n.c.lookUp ?? 0.5) * n.look;
      if (B.Neck) turnBone(B.Neck, _qc.setFromAxisAngle(WORLD_UP, yawH * 0.4));
      turnBone(B.Head, _qc.setFromAxisAngle(WORLD_UP, yawH * 0.6));
      const right = _vb.set(1, 0, 0).applyQuaternion(n.root.quaternion).applyAxisAngle(WORLD_UP, yawH);
      turnBone(B.Head, _qc.setFromAxisAngle(right, -pitch * 0.8 + (talking ? Math.sin(n.t * 7) * 0.05 : 0)));
      const fwd = _va.set(0, 0, 1).applyQuaternion(n.root.quaternion).applyAxisAngle(WORLD_UP, yawH);
      turnBone(B.Head, _qc.setFromAxisAngle(fwd, Math.sin(n.t * 1.3) * 0.06 + (n.pose === 'peace' ? 0.14 * n.poseK : 0)));
    }
    if (n.act && B.Head) {
      const t = n.act.t;
      if (n.act.type === 'nod') turnBone(B.Head, _qc.setFromAxisAngle(side, -Math.max(0, Math.sin(t * 6.5)) * 0.22 * ak));
      if (n.act.type === 'look') turnBone(B.Head, _qc.setFromAxisAngle(WORLD_UP, Math.sin(t * 1.9) * 0.65 * ak));
      if (n.act.type === 'tidy' || n.act.type === 'bow') turnBone(B.Head, _qc.setFromAxisAngle(side, -0.3 * ak));
      if (n.act.type === 'pat') turnBone(B.Head, _qc.setFromAxisAngle(_vb.set(0, 0, 1).applyQuaternion(n.root.quaternion), 0.22 * ak));
    }
    // arms: a held pose (photos), then an action on top; otherwise waving or talking
    const sk = ease(n.sitK);
    if (sk > 0.001) {
      for (const [s, sd] of [['Left', 1], ['Right', -1]]) {
        if (!B[s + 'UpLeg'] || !B[s + 'Leg'] || !B[s + 'Foot']) continue;
        pointBone(B[s + 'UpLeg'], B[s + 'Leg'], ldir(n, sd, [0.12, -0.12, 1]), sk);
        pointBone(B[s + 'Leg'], B[s + 'Foot'], ldir(n, sd, [0.04, -1, 0.12]), sk);
      }
      // the hips stay where they are when the legs fold, so the whole body comes down
      n.root.position.y = n.post.y - Math.max(0, (n.hipH || 1) - (n.sitH + 0.1)) * sk;
    } else if (n.root.position.y !== n.post.y && !n.sitWant) n.root.position.y = n.post.y;
    const held = n.pose || (n.poseFrom && n.poseK < 1);
    if (held || n.act || sk > 0.001) {
      for (const [s, sd] of [['Left', 1], ['Right', -1]]) {
        const S = s[0];
        let t = held ? lerpArm(poseArms(n, n.poseFrom, S), poseArms(n, n.pose, S), ease(n.poseK)) : armsBase(n);
        if (sk > 0.001 && !held) t = lerpArm(t, LAP_ARMS, sk);
        if (n.pose === 'cheer') t = [t[0], lerp3(t[1], [0.55, 0.85, 0.1], (Math.sin(n.t * 6 + sd) * 0.5 + 0.5) * n.poseK)];
        const at = n.act && actArms(n, S);
        if (at) t = lerpArm(t, at, ak);
        if (held || at || sk > 0.001) aimArm(n, s, sd, t);
      }
    } else if (n.wave > 0 && POSE.wave && B.RightArm && B.RightForeArm && B.RightHand) {
      const k = Math.min(1, n.wave / 0.4, (2.6 - n.wave) / 0.4);
      pointBone(B.RightArm, B.RightForeArm, sideDir(n, -1, -0.55, 0.85, 0.15), k);
      pointBone(B.RightForeArm, B.RightHand, sideDir(n, -1 + Math.sin(n.t * 12) * 0.7, -1.0, 0.3, 0.25).normalize(), k);
    } else if (talking) {
      for (const [s, sd] of [['Left', 1], ['Right', -1]]) {
        if (!B[s + 'ForeArm'] || !B[s + 'Hand']) continue;
        const sw = Math.sin(n.t * 3.1 + sd) * 0.5 + 0.5;
        pointBone(B[s + 'ForeArm'], B[s + 'Hand'], sideDir(n, sd, 0.1 + sw * 0.4, 0.4, 1.0), 0.8);
      }
    }
    if (!n.pose && n.poseK >= 1) n.poseFrom = null;
    // 比心: a big heart held between the paws in front of the chest
    if (n.pose === 'heart' || n.heart?.visible) {
      if (!n.heart) {
        n.heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(fxTexture('heart').image), transparent: true, depthWrite: false }));
        n.heart.material.map.colorSpace = THREE.SRGBColorSpace;
        n.heart.renderOrder = 5;
        n.root.add(n.heart);
      }
      const k = n.pose === 'heart' ? ease(n.poseK) : 0;
      n.heart.visible = k > 0.02;
      if (n.heart.visible && B.LeftHand && B.RightHand) {
        B.LeftHand.getWorldPosition(_va); B.RightHand.getWorldPosition(_vb);
        _va.add(_vb).multiplyScalar(0.5).addScaledVector(_vb.set(0, 0, 1).applyQuaternion(n.root.quaternion), 0.32);
        _va.y += 0.06;
        n.root.worldToLocal(n.heart.position.copy(_va));
        n.heart.scale.setScalar((0.46 + Math.sin(n.t * 5) * 0.04) * k);
      }
    }
    n.tag.visible = dist > 3 && dist < 14 && photo.npc !== n;
  }
  updateDialog(dt);
}

function findNpc() {
  if (player.fly || !started || switching) return null;
  let best = null, bd = Infinity;
  for (const n of npcs) {
    const d = Math.hypot(player.pos.x - n.root.position.x, player.pos.z - n.root.position.z);
    if (n.follow && (d > 2.6 || ((n.root.position.x - player.pos.x) * -Math.sin(player.yaw) + (n.root.position.z - player.pos.z) * -Math.cos(player.yaw)) / Math.max(d, 0.01) < 0.75)) continue;
    if (d < (n.c.reach || 3.0) && d < bd && Math.abs(player.pos.y - n.root.position.y) < 1.5) { bd = d; best = n; }
  }
  return best;
}

// ---- conversation ------------------------------------------------------------------------
const NO_THANKS = '沒事，謝謝';
function say(n, lines, opts = null, end = null, mini = false) {
  if (opts && !mini) opts = [...opts, { label: NO_THANKS, go: closeDialog }];   // every choice can simply end the chat
  Object.assign(dialog, { npc: n, lines: [].concat(lines), i: 0, shown: 0, t: 0, opts, end, mini, drawn: null });
  dialogName.textContent = `${n.c.zh} · ${n.c.role}`;
  dialogEl.classList.toggle('mini', mini);
  dialogEl.classList.remove('choose');
  dialogOpts.hidden = true;
  dialogOpts.replaceChildren();
  dialogEl.hidden = false;
}
// Every conversation starts with the same choices: 詢問 (all the questions, explanations
// and 請帶我去…), 互動 (see PLAY), 拍照, 陪我逛逛 (回去工作吧 while she is with you)
// and 沒事，謝謝. Anything that sends her off waits until her last line is clicked away.
function menuItems(n) {
  const play = playItems(n);
  return [{ label: n.follow ? '聊天 💬' : '詢問 💬', ask: true }, play.length && { label: '互動 🎈', lines: '要做什麼呢？', sub: play },
    !sit.seat && { label: '拍照 📸', photo: true },
    n.follow ? { label: '回去工作吧', dismiss: true } : n.c.with && { label: '陪我逛逛 💞', company: true }].filter(Boolean);
}
function askItems(n) {
  if (n.follow) return [{ label: '聊聊天', chat: true }, { label: '這裡是哪裡？', where: true }];
  const items = [{ label: '請帶我去…', guide: true }];
  for (const m of n.c.menu) {
    if (m.bye || m.photo || m.guide) continue;    // goodbyes and photos have their own places
    items.push(m);
  }
  return items;
}
const menuOpts = (n) => menuItems(n).map((m) => ({ label: m.label, go: () => runTopic(n, m) }));
function mainMenu(n, first = false) {
  const w = n.follow ? n.c.with : n.c;
  say(n, first ? w.hello : w.again, menuOpts(n));
}
function runTopic(n, m) {
  const back = { label: '返回', go: () => mainMenu(n) };
  // pick a place and you are sent straight there, as everywhere else
  const guideTo = (k, label) => ({ label, go: () => say(n, `${n.c.guide[k].zh}，這就送你過去 ✨`, null, () => placeTrip(guideSpot(n, k))) });
  if (m.ask) say(n, n.follow ? '想聊什麼呢？' : '想問什麼呢？', [...askItems(n).map((x) => ({ label: x.label, go: () => runTopic(n, x) })), back]);
  else if (m.sub) say(n, m.lines, [...m.sub.map((x) => ({ label: x.label, go: () => runTopic(n, x) })), back]);
  else if (m.company) say(n, n.c.with.start, null, () => { startCompanion(n); closeDialog(); });   // she sets off once the line is gone
  else if (m.dismiss) say(n, n.c.with.bye, null, () => dismissCompanion(n, true));
  else if (m.chat) say(n, freshChat(n), null, () => mainMenu(n));
  else if (m.where) say(n, n.c.with.where.replace('{place}', locateHere()[0]), null, () => mainMenu(n));
  else if (m.guide && n.c.guide) {
    say(n, '想去哪裡呢？我送你過去～', [...Object.entries(n.c.guide).filter(([k]) => !n.c.noGuide?.includes(k)).map(([k, g]) => guideTo(k, g.zh)), back]);
  } else if (m.guide) {   // no walking routes here: take you there in a blink
    const here = PLACES.find((p) => Math.hypot(b2t(...p.p).x - player.pos.x, b2t(...p.p).z - player.pos.z) < 6);
    const places = PLACES.filter((p) => p !== here).slice(0, 9);         // with 沒事，謝謝 that is ten, one per number key
    say(n, '想去哪裡呢？我送你過去～', [...places.map((p) => ({ label: p.zh, go: () => say(n, `${p.zh}，這就送你過去 ✨`, null, () => placeTrip(p)) })), ...(places.length < 9 ? [back] : [])]);
  }
  else if (m.photo) startPhoto(n);
  else if (m.pat) { patHead(n); say(n, '嘿嘿～好舒服 ♡', null, () => mainMenu(n)); }
  else if (m.act) { doAct(n, m.act); avatarEmote(m.act === 'hug' ? 'yes' : 'wave'); say(n, m.lines, null, () => mainMenu(n)); }
  else if (m.bye) { n.act = null; greet(n); avatarEmote('wave'); say(n, m.bye, null, closeDialog); }
  else if (m.trips) say(n, m.lines, [...m.trips.map((t) => ({ label: t.label, go: () => say(n, t.line, null, () => placeTrip(t)) })), back]);
  else if (m.emoji) { popEmoji(m.emoji); sfx.pop(); avatarEmote('yes'); say(n, m.lines, null, () => mainMenu(n)); }
  else if (m.portal) say(n, m.lines, [{ label: '直接帶我到傳送門 ✨', go: () => portalTrip() }, back]);
  else if (m.go) say(n, m.lines, [...m.go.map((k) => guideTo(k, `帶我去${n.c.guide[k].zh}`)), back]);
  else say(n, m.lines, null, () => mainMenu(n));
}
function talkTo(n) {
  if (dialog.npc === n) { nextLine(); return; }
  if (n.mode === 'guide') { n.quiet = false; n.msg = ''; guideSay(n, '這邊請，跟我來～ 🐾'); return; }   // bring the walking box back
  dialog.turn = 0.9;
  n.act = null;
  mainMenu(n, ['post', 'patrol', 'outing', 'follow'].includes(n.mode));
}
const optsReady = () => !!(dialog.npc && dialog.opts && dialog.i === dialog.lines.length - 1 && dialog.shown >= dialog.lines[dialog.i].length);
function chooseOpt(i) {
  if (!optsReady()) { nextLine(); return; }
  const o = dialog.opts[i];
  if (!o) return;
  sfx.pop();
  o.go();
}
function nextLine() {
  if (!dialog.npc) return;
  const line = dialog.lines[dialog.i];
  if (dialog.shown < line.length) { dialog.shown = line.length; return; }   // finish the typing first
  if (dialog.i < dialog.lines.length - 1) { dialog.i += 1; dialog.shown = 0; dialog.t = 0; return; }
  if (dialog.opts) return;                                               // pick one of the options
  if (dialog.end) dialog.end(); else closeDialog();
}
function closeDialog() {
  const n = dialog.npc;
  dialog.npc = null; dialog.opts = null; dialog.end = null;
  dialogEl.hidden = true;
  if (n && npcs.includes(n) && n.mode === 'arrived' && !n.intro && photo.npc !== n) goHome(n);   // done here: walk back to the post
}
function updateDialog(dt) {
  const n = dialog.npc;
  if (!n) return;
  const far = Math.hypot(player.pos.x - n.root.position.x, player.pos.z - n.root.position.z) > (n.c.reach || 3.0) + 1.5
    || Math.abs(player.pos.y - n.post.y) > 2.5;                       // rode the lift or flew off to another floor
  if (!npcs.includes(n) || (!dialog.mini && far)) { closeDialog(); return; }
  // at the start of a conversation, turn the view to the character's face
  if (dialog.turn > 0 && !riding.ride && !sit.seat && !dialog.mini) {
    dialog.turn -= dt;
    const want = Math.atan2(-(n.root.position.x - player.pos.x), -(n.root.position.z - player.pos.z));
    const k = 1 - Math.exp(-dt * 6);
    player.yaw += wrapAngle(want - player.yaw) * k;
    const d = Math.max(0.8, Math.hypot(n.root.position.x - player.pos.x, n.root.position.z - player.pos.z));
    const look = THREE.MathUtils.clamp(Math.atan2(n.root.position.y + n.c.height * (innerWidth < 640 ? 0.35 : 0.55) - player.eyeY, d), -0.5, 0.3);
    player.pitch += (look - player.pitch) * k;      // the face, and a bit of the body above the dialogue box
  }
  const line = dialog.lines[dialog.i];
  dialog.t += dt;
  dialog.shown = Math.min(line.length, Math.max(dialog.shown, Math.floor(dialog.t * 28)));
  const txt = line.slice(0, dialog.shown);
  if (dialogText.textContent !== txt) dialogText.textContent = txt;
  dialogEl.classList.toggle('more', dialog.shown >= line.length);
  const step = dialogEl.querySelector('.dialog-step');
  const stepTxt = dialog.lines.length > 1 ? `${dialog.i + 1} / ${dialog.lines.length}` : '';
  if (step.textContent !== stepTxt) step.textContent = stepTxt;
  if (optsReady() && dialog.drawn !== dialog.opts) {
    dialog.drawn = dialog.opts;
    dialogOpts.replaceChildren(...dialog.opts.map((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<kbd>${(i + 1) % 10}</kbd><span></span>`;
      if (o.label === NO_THANKS) b.classList.add('quiet');
      b.lastChild.textContent = o.label;
      b.addEventListener('click', (e) => { e.stopPropagation(); e.currentTarget.blur(); chooseOpt(i); });
      return b;
    }));
    dialogOpts.hidden = false;
    dialogEl.classList.add('choose');
  }
}
dialogEl.addEventListener('click', (e) => { e.stopPropagation(); nextLine(); });

function removeNpc(n) {
  worldRoot.remove(n.root);
  n.root.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material || [])) {
      for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap']) m[k]?.dispose?.();
      m.dispose();
    }
  });
  const i = dynColliders.indexOf(n.pillar);
  if (i >= 0) dynColliders.splice(i, 1);
  npcs.splice(npcs.indexOf(n), 1);
  if (dialog.npc === n) closeDialog();
  if (photo.npc === n) endPhoto(true);
}
async function buildCharacters(w) {
  const comp = companionChar();
  for (const c of CHARACTERS) {
    if (c.world !== w.key || !isOn(c)) continue;
    if (comp && c.person === comp.person) continue;  // she is out with you
    try {
      const n = await loadCharacter(c);
      if (!isOn(c)) removeNpc(n);                    // hidden in the panel while it loaded
    } catch (e) { console.warn(e); diag(`character ${c.id} failed: ${e.message}`); }
  }
  if (comp && isOn(comp)) {
    try { const n = await loadCharacter(comp); makeFollower(n); placeBeside(n, false); } catch (e) { console.warn(e); }
  } else if (comp) { companion = null; saveCompanion(); }
}
async function setCharacter(c, on) {
  charOn[c.id] = on;
  try { localStorage.setItem('aurora-world-characters', JSON.stringify(charOn)); } catch { }
  renderCharPanel();
  if (!on && companion === c.id) {                 // hiding your companion ends the walk
    const f = npcs.find((n) => n.c === c && n.follow);
    if (f) dismissCompanion(f, true); else { companion = null; saveCompanion(); }
    return;
  }
  if (on && companionChar()?.person === c.person) return;   // she is out with you: the post stays empty
  if (!W || c.world !== W.key || switching) return;
  const have = npcs.find((n) => n.c === c);
  if (!on && have) removeNpc(have);
  if (on && !have) {
    const n = await loadCharacter(c);
    // switched off again, another world, or a second click loaded it twice
    if (W.key !== c.world || !isOn(c) || npcs.some((m) => m !== n && m.c === c)) removeNpc(n);
  }
}
const charPanel = document.getElementById('char-panel');
function renderCharPanel() {
  charPanel.querySelector('.floors').innerHTML = CHARACTERS.map((c) =>
    `<button type="button" data-char="${c.id}" aria-pressed="${isOn(c)}"><b>${c.zh}</b><span>${WORLDS[c.world].short} · ${c.role}</span><i>${isOn(c) ? '顯示' : '隱藏'}</i></button>`).join('');
  charPanel.querySelectorAll('button[data-char]').forEach((b) => b.addEventListener('click', (e) => {
    e.currentTarget.blur();
    const c = CHARACTERS.find((x) => x.id === b.dataset.char);
    setCharacter(c, !isOn(c));
  }));
}
renderCharPanel();
document.getElementById('btn-chars').addEventListener('click', (e) => { charPanel.hidden = !charPanel.hidden; e.currentTarget.blur(); });
charPanel.querySelector('.close').addEventListener('click', () => { charPanel.hidden = true; });

// ---------------------------------------------------------------------------
// The visitor's own body, picked in the 角色 panel: a little robot
// (RobotExpressive by Tomás Laulhé, CC0) or a person (Ultimate Animated
// Character Pack by Quaternius, CC0), each with walk, run, jump and sit
// animations. V (or the view button) switches between first and third person.
// In third person the camera follows from behind and pulls in when a wall is
// in the way; the mouse wheel zooms. The body also stands next to a character
// in photos.
// ---------------------------------------------------------------------------
const PERSON = {
  h: 1.75, main: 'Shirt', skin: 'Skin', eyes: 'Face', walk: 1.9, run: 5.2, matte: true, once: ['Jump', 'SitDown', 'StandUp', 'Victory', 'PickUp'],
  clips: { idle: 'Idle', walk: 'Walk', run: 'Run', jump: 'Jump', sit: 'SitDown', stand: 'StandUp', wave: 'Victory', yes: 'Victory', peace: 'Victory', cheer: 'Victory', heart: 'Idle' },
  hold: { peace: 0.55 }, loopPose: { cheer: true, heart: true },
  arms: { upper: 'UpperArm', lower: 'LowerArm', hand: 'Fist' },   // bones for the hand-made 比心
};
const AVATARS = [
  {
    id: 'robot', zh: '機器人', sub: '小機器人', file: 'characters/player/robot.gltf.json', h: 1.8, main: 'Main', walk: 2.4, run: 6,
    once: ['Jump', 'Sitting', 'Standing', 'ThumbsUp', 'Yes', 'No', 'Wave', 'Punch', 'Death'],
    clips: { idle: 'Idle', walk: 'Walking', run: 'Running', jump: 'Jump', sit: 'Sitting', stand: 'Standing', wave: 'Wave', yes: 'Yes', peace: 'ThumbsUp', cheer: 'Wave', heart: 'Dance' },
    hold: { peace: 0.8 }, loopPose: { cheer: true, heart: true },
  },
  { ...PERSON, id: 'man', zh: '男生', sub: '休閒服', file: 'characters/player/casual_male.gltf.json' },
  { ...PERSON, id: 'woman', zh: '女生', sub: '休閒服', file: 'characters/player/casual_female.gltf.json' },
  { ...PERSON, id: 'suitman', zh: '男生', sub: '西裝', file: 'characters/player/suit_male.gltf.json' },
  { ...PERSON, id: 'suitwoman', zh: '女生', sub: '套裝', file: 'characters/player/suit_female.gltf.json' },
];
const AVATAR_COLORS = [['橘', 0xd9662a], ['藍', 0x3a78d8], ['粉', 0xe8739f], ['薄荷', 0x35b590], ['紫', 0x8a63d8], ['白', 0xdedad2]];
// the pack's skin comes out near black and the eyes white, so both are set here
const SKIN_TONES = [['淺', 0xf2cfb0], ['中', 0xd6a27a], ['深', 0x8f5c3c]];
const HEART_ARMS = [[0.3, -0.2, 0.9], [-0.9, 0.35, 0.3]];   // upper arm, forearm: paws together at the chest
const view = { third: false, dist: 3.2, cur: 3.2, color: 0, skin: 0, avatar: 'robot' };
try {
  const v = JSON.parse(localStorage.getItem('aurora-world-view') || '{}');
  Object.assign(view, {
    third: !!v.third, dist: THREE.MathUtils.clamp(+v.dist || 3.2, 1.6, 7), color: +v.color || 0, skin: +v.skin || 0,
    avatar: AVATARS.some((a) => a.id === v.avatar) ? v.avatar : 'robot',
  });
} catch { }
const saveView = () => { try { localStorage.setItem('aurora-world-view', JSON.stringify({ third: view.third, dist: view.dist, color: view.color, skin: view.skin, avatar: view.avatar })); } catch { } };
let avatar = null;
const avatarCache = {};
const _eye = new THREE.Vector3(), _back = new THREE.Vector3(), _tp = new THREE.Vector3(), _ap = new THREE.Vector3();

async function loadAvatar(def) {
  const buf = await fetchWithProgress(def.file, () => { });
  const gltf = await charLoader.parseAsync(jsonToGlb(buf), '');
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const s = def.h / Math.max(0.01, box.max.y - box.min.y);
  model.scale.setScalar(s);
  model.position.y = -box.min.y * s;
  let main = null, skin = null;
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.material = lighten(o.material);
    if (o.material.name === def.skin) skin = o.material;
    if (o.material.name === def.eyes) o.material.color.setHex(0x2a1d18);
    // the pack leaves glTF's default metalness of 1, which renders skin and clothes black
    if (def.matte) { o.material.metalness = 0; o.material.roughness = 0.75; }
    o.frustumCulled = false;
    o.receiveShadow = true;
    if (o.material.name === def.main) main = o.material;
  });
  const root = new THREE.Group();
  root.add(model);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.36, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.012;
  root.add(blob);
  root.visible = false;
  scene.add(root);
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const clip of gltf.animations) actions[clip.name.replace(/^.*\|/, '')] = mixer.clipAction(clip);
  const bones = {};
  model.traverse((o) => { if (o.isBone && !bones[o.name]) bones[o.name] = o; });
  const A = {
    def, root, model, mixer, actions, main, skin, bones, hips: bones.Hips, blob, cur: null, yaw: 0, prev: new THREE.Vector3(), speed: 0, air: 0,
    emote: null, emoteT: 0, sitOff: new THREE.Vector3(), once: new Set(def.once), leftSign: 1,
  };
  // where the hips end up when seated, so the seat can be put under them
  const sitA = actions[def.clips.sit];
  if (A.hips && sitA) {
    sitA.reset().play();
    mixer.setTime(sitA.getClip().duration - 0.001);
    root.updateMatrixWorld(true);
    root.worldToLocal(A.hips.getWorldPosition(A.sitOff));
    const kb = bones.LowerLegL || bones['LowerLeg.L'];               // the knee, as the clip ends
    if (kb) A.kneeFwd = root.worldToLocal(kb.getWorldPosition(new THREE.Vector3())).z - A.sitOff.z;
    sitA.stop();
  }
  const handL = def.arms && bones[def.arms.hand + 'L'];
  if (handL) { root.updateMatrixWorld(true); A.leftSign = Math.sign(root.worldToLocal(handL.getWorldPosition(new THREE.Vector3())).x) || 1; }
  return A;
}
let avatarWant = null;
async function useAvatar(id) {
  const def = AVATARS.find((a) => a.id === id) || AVATARS[0];
  view.avatar = def.id;
  avatarWant = def.id;
  saveView();
  renderAvatarPanel();
  document.getElementById('avatar-skin-row').hidden = !def.skin;
  try { avatarCache[def.id] ||= loadAvatar(def); } catch (e) { console.warn(e); return; }
  let A;
  try { A = await avatarCache[def.id]; } catch (e) { console.warn(e); diag(`avatar ${def.id} failed: ${e.message}`); delete avatarCache[def.id]; return; }
  if (avatarWant !== def.id) return;           // picked another one while this was loading
  if (avatar && avatar !== A) { avatar.root.visible = false; A.yaw = avatar.yaw; }
  avatar = A;
  A.prev.copy(player.pos);
  A.cur = null; A.mixer.stopAllAction();
  setAvatarColor(view.color);
  setSkin(view.skin);
  playClip('idle', 0);
}
function setSkin(i) {
  view.skin = i;
  if (avatar?.skin) avatar.skin.color.setHex(SKIN_TONES[i]?.[1] ?? SKIN_TONES[0][1]);
  document.querySelectorAll('#avatar-skin button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  document.getElementById('avatar-skin-row').hidden = LITE || !AVATARS.find((a) => a.id === view.avatar)?.skin;
}
function setAvatarColor(i) {
  view.color = i;
  if (avatar?.main) avatar.main.color.setHex(AVATAR_COLORS[i]?.[1] ?? AVATAR_COLORS[0][1]);
  document.querySelectorAll('#avatar-colors button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
}
// play a clip by its role (idle, walk, sit...), as the current body names it
function playClip(role, fade = 0.25, loop, force = false) {
  const A = avatar, name = A?.def.clips[role] || role, a = A?.actions[name];
  if (!a || (A.cur === a && !force)) return;
  const once = loop === undefined ? A.once.has(name) : !loop;
  a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  a.clampWhenFinished = once;
  a.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
  if (A.cur && A.cur !== a) A.cur.fadeOut(fade);
  A.cur = a;
}
function avatarEmote(role) {
  const a = avatar?.actions[avatar.def.clips[role]];
  if (!a) return;
  avatar.emote = role;
  avatar.emoteT = a.getClip().duration;
  avatar.force = true;        // restart even if the same clip is already showing
}
const thirdActive = () => !!(view.third && avatar && started && !riding.ride && !photo.npc && !switching);

function updateAvatar(dt) {
  const A = avatar;
  if (!A) return;
  const inPhoto = !!(photo.npc && photo.spot);
  if (!inPhoto && !thirdActive()) { A.root.visible = false; A.prev.copy(player.pos); return; }
  A.root.visible = true;
  let want = 'idle', wantYaw = A.yaw, loop, lying = false;
  const pose = inPhoto ? photo.npc.pose : null;
  if (inPhoto) {
    A.root.position.copy(photo.spot);
    wantYaw = photo.spotYaw;
    if (pose) { want = pose; loop = !!A.def.loopPose[pose]; }
    A.speed = 0;
  } else if (sit.seat) {
    const st = sit.seat;
    wantYaw = st.yaw + Math.PI;
    A.yaw = wantYaw;
    A.speed = 0;
    if (st.kind === 'bed') {
      // on the back, head on the pillow (the seat), feet toward the foot of the bed
      lying = true;
      want = 'idle';
      const fx = Math.sin(wantYaw), fz = Math.cos(wantYaw);
      A.root.position.set(st.pos.x + fx * A.def.h * 0.95, st.pos.y + 0.14, st.pos.z + fz * A.def.h * 0.95);
    } else {
      want = sit.dir < 0 ? 'stand' : 'sit';
      // seat surface under the hips, from the measured end of the sitting clip, moved so
      // the knees come just past the front of the cushion
      const fx = Math.sin(wantYaw), fz = Math.cos(wantYaw);
      st.edge ??= cushionEdge(st.pos, fx, fz);
      const sh = RECLINED.has(st.kind) ? 0 : kneeShift(st.edge, A.kneeFwd ?? 0.35);
      _ap.copy(A.sitOff).applyAxisAngle(WORLD_UP, wantYaw);
      A.root.position.set(st.pos.x + fx * sh - _ap.x, st.pos.y + 0.06 - _ap.y, st.pos.z + fz * sh - _ap.z);
    }
  } else {
    A.root.position.copy(player.pos);
    const dx = player.pos.x - A.prev.x, dz = player.pos.z - A.prev.z;
    const hv = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
    A.speed += (Math.min(hv, 12) - A.speed) * (1 - Math.exp(-dt * 10));
    if (hv > 0.3 && hv < 20) wantYaw = Math.atan2(dx, dz);
    else if (dialog.npc && !dialog.mini) wantYaw = Math.atan2(dialog.npc.root.position.x - player.pos.x, dialog.npc.root.position.z - player.pos.z);
    A.air = player.grounded || player.fly ? 0 : A.air + dt;
    if (A.air > 0.18 || player.vy > 1) want = 'jump';
    else if (A.speed > 3.8) want = 'run';
    else if (A.speed > 0.3) want = 'walk';
  }
  if (A.emote && A.emoteT > 0 && want === 'idle') { A.emoteT -= dt; want = A.emote; }
  else A.emote = null;
  A.prev.copy(player.pos);
  A.yaw += wrapAngle(wantYaw - A.yaw) * (1 - Math.exp(-dt * 10));
  A.root.rotation.order = 'YXZ';                  // lie down first, then turn
  A.root.rotation.set(lying ? -Math.PI / 2 : 0, A.yaw, 0);
  playClip(want, 0.25, loop, A.force && want === A.emote);
  A.force = false;
  if (want === 'walk') A.cur.setEffectiveTimeScale(THREE.MathUtils.clamp(A.speed / A.def.walk, 0.6, 1.6));
  if (want === 'run') A.cur.setEffectiveTimeScale(THREE.MathUtils.clamp(A.speed / A.def.run, 0.8, 1.5));
  A.blob.visible = !sit.seat;
  A.mixer.update(dt);
  const hold = pose && A.def.hold[pose];
  if (hold && A.cur.time >= hold) A.cur.paused = true;
  // seated (not lying): elbows relaxed, hands resting on the knees
  if (sit.seat && !lying && A.def.arms && sit.k > 0) {
    const { upper, lower, hand } = A.def.arms, B = A.bones, k = ease(sit.k);
    A.root.updateMatrixWorld(true);
    for (const [s, side] of [['L', 1], ['R', -1]]) {
      if (!B[upper + s] || !B[lower + s] || !B[hand + s]) continue;
      for (const [b, c, v] of [[upper, lower, LAP_ARMS[0]], [lower, hand, LAP_ARMS[1]]]) {
        _vd.set(side * A.leftSign * v[0], v[1], v[2]).applyQuaternion(A.root.quaternion).normalize();
        pointBone(B[b + s], B[c + s], _vd, k);
      }
    }
  }
  // people have no heart clip: put the hands together at the chest by hand
  if (pose === 'heart' && A.def.arms) {
    const { upper, lower, hand } = A.def.arms, B = A.bones;
    A.root.updateMatrixWorld(true);
    for (const [s, side] of [['L', 1], ['R', -1]]) {
      if (!B[upper + s] || !B[lower + s] || !B[hand + s]) continue;
      for (const [b, c, v] of [[upper, lower, HEART_ARMS[0]], [lower, hand, HEART_ARMS[1]]]) {
        _vd.set(side * A.leftSign * v[0], v[1], v[2]).applyQuaternion(A.root.quaternion).normalize();
        pointBone(B[b + s], B[c + s], _vd);
      }
    }
  }
}

// Third person: pull the camera back from the eye for this frame's render only,
// so everything else keeps working from the visitor's eyes.
function applyThirdPerson(dt) {
  if (!thirdActive()) return false;
  _eye.copy(camera.position);
  _back.set(0, 0, 1).applyQuaternion(camera.quaternion);
  _tp.copy(_eye); _tp.y += 0.3;
  const h = collider ? castHit(_tp, _back, view.dist + 0.3) : null;
  let d = h ? Math.max(0.15, h.distance - 0.3) : view.dist;
  // characters are wider than their collision pillars: stop in front of them too
  for (const n of npcs) {
    if (n.follow) continue;                      // the companion walks right behind you
    const R = n.c.height * 0.42, ox = _tp.x - n.root.position.x, oz = _tp.z - n.root.position.z;
    const a = _back.x * _back.x + _back.z * _back.z, b = ox * _back.x + oz * _back.z, c = ox * ox + oz * oz - R * R;
    if (a < 1e-6 || c < 0) continue;            // looking straight down, or already inside
    const disc = b * b - a * c;
    if (disc < 0) continue;
    const t = (-b - Math.sqrt(disc)) / a;
    const y = _tp.y + _back.y * t - n.root.position.y;
    if (t > 0 && t < d && y > -0.2 && y < n.c.height) d = Math.max(0.15, t - 0.15);
  }
  view.cur = d < view.cur ? d : view.cur + (d - view.cur) * (1 - Math.exp(-dt * 4));
  camera.position.copy(_tp).addScaledVector(_back, view.cur);
  camera.updateMatrixWorld();
  avatar.root.visible = view.cur > 0.9;       // too close: the body would fill the screen
  return true;
}
const viewBtn = document.getElementById('btn-view');
function updateViewBtn() {
  viewBtn.setAttribute('aria-pressed', String(view.third));
  const short = innerWidth < 640;
  viewBtn.textContent = view.third ? (short ? '3人稱' : '第三人稱') : (short ? '1人稱' : '第一人稱');
}
function toggleView() {
  if (LITE) return;           // no body to look at
  view.third = !view.third;
  view.cur = 0.5;             // swing out from the eyes
  saveView();
  updateViewBtn();
}
if (LITE) viewBtn.hidden = true;
viewBtn.addEventListener('click', (e) => { toggleView(); e.currentTarget.blur(); });
addEventListener('resize', updateViewBtn);
updateViewBtn();
addEventListener('wheel', (e) => {
  if (!view.third || !started || e.target !== canvas) return;
  view.dist = THREE.MathUtils.clamp(view.dist + e.deltaY * 0.003, 1.6, 7);
  saveView();
}, { passive: true });
const avatarPick = document.getElementById('avatar-pick');
function renderAvatarPanel() {
  avatarPick.innerHTML = AVATARS.map((a) =>
    `<button type="button" data-avatar="${a.id}" aria-pressed="${view.avatar === a.id}"><b>${a.zh}</b><span>${a.sub}</span><i>${view.avatar === a.id ? '使用中' : '選擇'}</i></button>`).join('');
  avatarPick.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.currentTarget.blur(); useAvatar(b.dataset.avatar); }));
}
renderAvatarPanel();
document.getElementById('avatar-colors').append(...AVATAR_COLORS.map(([zh, hex], i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.title = zh;
  b.setAttribute('aria-label', `衣服顏色：${zh}`);
  b.style.setProperty('--sw', `#${hex.toString(16).padStart(6, '0')}`);
  b.addEventListener('click', (e) => { setAvatarColor(i); saveView(); e.currentTarget.blur(); });
  return b;
}));
setAvatarColor(view.color);
document.getElementById('avatar-skin').append(...SKIN_TONES.map(([zh, hex], i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.title = zh;
  b.setAttribute('aria-label', `膚色：${zh}`);
  b.style.setProperty('--sw', `#${hex.toString(16).padStart(6, '0')}`);
  b.addEventListener('click', (e) => { setSkin(i); saveView(); e.currentTarget.blur(); });
  return b;
}));
setSkin(view.skin);

function updateSeating(dt) {
  if (sit.seat) {
    sit.k = THREE.MathUtils.clamp(sit.k + sit.dir * dt / 0.6, 0, 1);
    const st = sit.seat, e = ease(sit.k);
    if (sit.dir > 0 && sit.k < 1) {          // turn to face the way the seat faces
      player.yaw = sit.yaw0 + wrapAngle(st.yaw - sit.yaw0) * e;
      player.pitch = sit.pitch0 + ((SEAT_PITCH[st.kind] ?? -0.06) - sit.pitch0) * e;
    } else if (sit.dir > 0 && !RECLINED.has(st.kind)) {
      const off = wrapAngle(player.yaw - st.yaw);   // look around, but not over your shoulder
      if (Math.abs(off) > 1.9) player.yaw = st.yaw + Math.sign(off) * 1.9;
    }
    const eye = st.pos.y + (SEAT_EYE[st.kind] ?? 0.72);
    camera.position.set(
      sit.standPos.x + (st.pos.x - sit.standPos.x) * e,
      sit.standEye + (eye - sit.standEye) * e,
      sit.standPos.z + (st.pos.z - sit.standPos.z) * e);
    if (sit.dir < 0 && sit.k === 0) { sit.seat = null; player.eyeY = sit.standEye; }
    candidate = null; rideCand = null; liftCall = null; portalCand = false; npcCand = null; doorCand = null;
  } else if (riding.ride) {
    candidate = null; rideCand = null; liftCall = null; portalCand = false; npcCand = null; doorCand = null;
  } else {
    liftCall = started && lift.car && !inCar() ? landingInFront() : null;
    if (liftCall && lift.at === liftCall && lift.door > 0.5) liftCall = null;   // already open: just walk in
    portalCand = !liftCall && nearPortal();
    doorCand = !liftCall && !portalCand && !dialog.npc ? findDoor() : null;
    npcCand = !liftCall && !portalCand && !doorCand && !photo.npc ? (dialog.npc || findNpc()) : null;
    patCand = !!(npcCand && npcCand.c.pats && !dialog.npc && looksAtHead(npcCand));
    rideCand = !liftCall && !portalCand && !npcCand ? findRide() : null;
    candidate = started && !liftCall && !portalCand && !npcCand && !rideCand && !inCar() ? findSeat() : null;
  }
  if (!portalCand && !portalPanel.hidden) closePortalMenu();
  seatRing.visible = !!candidate;
  if (candidate) {
    seatRing.position.set(candidate.pos.x, candidate.pos.y + 0.02, candidate.pos.z);
    seatRing.material.opacity = 0.6 + 0.3 * Math.sin(performance.now() / 250);
  }
  const ridingNow = !!(riding.ride && riding.dir > 0);
  const show = !!(started && !switching && !dialog.npc && !photo.npc && (candidate || rideCand || liftCall || portalCand || doorCand || npcCand || ridingNow || (sit.seat && sit.dir > 0)));
  if (seatBtn.hidden === show) seatBtn.hidden = !show;
  let text = '坐下';
  if (sit.seat) text = '起身';
  else if (ridingNow) text = '下車';
  else if (liftCall) text = '呼叫電梯';
  else if (portalCand) text = portalPanel.hidden ? '傳送門 · 選擇目的地' : '關閉傳送選單';
  else if (doorCand) text = doorCand.want ? '關門' : `${doorCand.c.card ? '刷卡開門' : '開門'} · ${doorCand.c.zh}`;
  else if (npcCand) text = dialog.npc ? '繼續' : patCand ? '摸摸頭' : `和${npcCand.c.zh}說話`;
  else if (rideCand) text = rideQueued === rideCand ? (rideCand.waitText || '等待列車回站…') : (rideCand.available && !rideCand.available() ? `排隊搭乘${rideCand.zh}` : `搭乘${rideCand.zh}`);
  else if (RECLINED.has(candidate?.kind)) text = '躺下';
  if (show && seatLabel.textContent !== text) seatLabel.textContent = text;
  seatBtn.classList.toggle('ride', !!(rideCand || ridingNow || portalCand || npcCand));
  const sc = started && !switching && seatedCompanion();
  talkBtn.hidden = !sc;
  if (sc) { const t = `和${sc.c.zh}聊天`; if (talkBtn.lastChild.textContent !== t) talkBtn.lastChild.textContent = t; }
  rideHud.hidden = !ridingNow;
  if (ridingNow && rideName.textContent !== riding.ride.zh) rideName.textContent = riding.ride.zh;
}
// sitting together: the companion on the next seat can still be talked to (T or the button)
const seatedCompanion = () => (sit.seat && sit.dir > 0 && sit.k >= 1 && !dialog.npc && !photo.npc
  ? npcs.find((n) => n.follow && n.outing?.phase === 'sit' && n.root.position.distanceTo(sit.seat.pos) < 3) : null);
const talkBtn = document.getElementById('talk-btn');
talkBtn.addEventListener('click', (e) => { const n = seatedCompanion(); if (n) talkTo(n); e.currentTarget.blur(); });
function doAction() {
  if (switching || fading) return;
  if (sit.seat) standUp();
  else if (riding.ride) leaveRide();
  else if (liftCall) callLift(liftCall);
  else if (portalCand) { if (portalPanel.hidden) openPortalMenu(); else closePortalMenu(); }
  else if (doorCand) toggleDoor(doorCand);
  else if (npcCand) { if (patCand && !dialog.npc) patHead(npcCand); else talkTo(npcCand); }
  else if (rideCand) board(rideCand);
  else if (candidate) sitDown(candidate);
}
seatBtn.addEventListener('click', (e) => { doAction(); e.currentTarget.blur(); });

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
const player = { pos: new THREE.Vector3(), vy: 0, yaw: 0, pitch: -0.02, grounded: false, fly: false, eyeY: 0 };
const keys = new Set();
const touchMove = new THREE.Vector2();
let collider = null;
const ray = new THREE.Raycaster();
ray.firstHitOnly = true;
const _v = new THREE.Vector3(), _o = new THREE.Vector3(), _n = new THREE.Vector3();

const dynColliders = [];   // hotel lift car and landing doors (they move, so no BVH)
// Sitting: the hips go where the knees come just past the front of the cushion, so the
// shins hang in front of the seat instead of through it. The cushion's front is found by
// looking down a little ahead of the seat point, step by step, until it drops away.
const _eo = new THREE.Vector3(), _down = new THREE.Vector3(0, -1, 0);
function cushionEdge(p, fx, fz) {
  let gap = 0;                                              // a slatted bench has small gaps: need 10 cm of nothing
  for (let d = 0.1; d <= 1.3; d += 0.05) {
    ray.set(_eo.set(p.x + fx * d, p.y + 0.2, p.z + fz * d), _down);
    ray.far = 0.35;
    const h = ray.intersectObject(collider, false)[0];      // the furniture only, not the characters
    if (!h || h.point.y < p.y - 0.1) { if (++gap === 3) return d - 0.1; } else gap = 0;
  }
  return 0.45;
}
const kneeShift = (edge, knee) => THREE.MathUtils.clamp(edge - knee + 0.06, -0.3, 0.35);
function castHit(origin, dir, far) {
  ray.set(origin, dir);
  ray.far = far;
  let h = ray.intersectObject(collider, false)[0] || null;
  if (dynColliders.length) {
    const d = ray.intersectObjects(dynColliders, false)[0];
    if (d && (!h || d.distance < h.distance)) h = d;
  }
  return h;
}
function groundHeight(p) {
  _o.set(p.x, p.y + STEP, p.z);
  const h = castHit(_o, _v.set(0, -1, 0), 80);
  return h ? h.point.y : -Infinity;
}
const HEIGHTS = [STEP + 0.06, 1.05, 1.6];
function moveHorizontal(delta) {
  let len = delta.length();
  if (len < 1e-6) return;
  const dir = _n.copy(delta).divideScalar(len);
  for (let pass = 0; pass < 2 && len > 1e-6; pass++) {
    let block = null;
    for (const hgt of HEIGHTS) {
      _o.set(player.pos.x, player.pos.y + hgt, player.pos.z);
      const h = castHit(_o, dir, len + RADIUS);
      if (h && (!block || h.distance < block.distance)) block = h;
    }
    if (!block) { player.pos.addScaledVector(dir, len); return; }
    const allowed = Math.max(0, block.distance - RADIUS);
    player.pos.addScaledVector(dir, allowed);
    const n = block.face.normal.clone(); n.y = 0;
    if (n.lengthSq() < 1e-6) return;
    n.normalize();
    const rest = dir.clone().multiplyScalar(len - allowed);
    rest.addScaledVector(n, -rest.dot(n));
    len = rest.length();
    if (len < 1e-5) return;
    dir.copy(rest).divideScalar(len);
  }
}
const PUSH_DIRS = Array.from({ length: 10 }, (_, i) => new THREE.Vector3(Math.cos(i / 10 * Math.PI * 2), 0, Math.sin(i / 10 * Math.PI * 2)));
function depenetrate() {
  for (const hgt of [STEP + 0.06, 1.2]) {
    for (const d of PUSH_DIRS) {
      _o.set(player.pos.x, player.pos.y + hgt, player.pos.z);
      const h = castHit(_o, d, RADIUS);
      if (h) player.pos.addScaledVector(d, h.distance - RADIUS);
    }
  }
}

// Escalators carry whoever stands on them at 0.55 m/s along their direction.
const ESC_SPEED = 0.55;
const _esc = new THREE.Vector3();
function onEscalator(p = player.pos) {
  for (const e of ESCALATORS) {
    const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z, len2 = dx * dx + dz * dz;
    const t = ((p.x - e.a.x) * dx + (p.z - e.a.z) * dz) / len2;
    if (t < -0.02 || t > 1.02) continue;
    const lat = Math.abs((p.x - e.a.x) * dz - (p.z - e.a.z) * dx) / Math.sqrt(len2);
    if (lat > e.w / 2 + 0.1) continue;
    const y = e.a.y + THREE.MathUtils.clamp(t, 0, 1) * (e.b.y - e.a.y);
    if (Math.abs(p.y - y) > 0.8) continue;
    return e;
  }
  return null;
}
function ridEscalator(dt) {
  const e = onEscalator();
  if (!e) return;
  _esc.set(e.b.x - e.a.x, 0, e.b.z - e.a.z).normalize().multiplyScalar(e.dir * ESC_SPEED * dt);
  moveHorizontal(_esc);
}

function teleport(place) {
  if (photo.npc) endPhoto(true);         // a place chip or the portal button ends a photo session
  steps.length = 0;
  for (const n of npcs) if (n.follow) n.jump = true;
  sit.seat = null;
  sit.k = 0;
  if (riding.ride) { riding.ride.exit?.(); riding.ride = null; riding.anchor = null; riding.seatedSent = false; }
  rideQueued = null;
  const [x, y, z] = place.p;
  player.pos.copy(b2t(x, y, z + 0.05));
  player.yaw = place.yaw;
  player.pitch = -0.04;
  if (avatar) { avatar.yaw = place.yaw + Math.PI; avatar.prev.copy(player.pos); }
  player.vy = 0;
  player.eyeY = player.pos.y + EYE;
  if (collider && !player.fly) {
    const g = groundHeight(player.pos);
    if (g > -Infinity) player.pos.y = g;
    player.eyeY = player.pos.y + EYE;
  }
  placeSun(player.pos, true);
}

function update(dt) {
  if (photo.npc) { updatePhoto(dt); return; }      // the camera stands still for photos
  if (sit.seat) {
    const moving = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((k) => keys.has(k));
    if ((moving || touchMove.lengthSq() > 0.2) && sit.k >= 1) standUp();
    return;
  }
  if (riding.ride) return;
  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  let mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  let mz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  mx += touchMove.x; mz += touchMove.y;
  const wish = new THREE.Vector3().addScaledVector(fwd, mz).addScaledVector(right, mx);
  if (wish.lengthSq() > 1) wish.normalize();
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchMove.length() > 0.92;

  if (player.fly) {
    const speed = run ? W.fly * 2.5 : W.fly;
    const up = (keys.has('KeyE') || keys.has('Space') ? 1 : 0) - (keys.has('KeyQ') || keys.has('KeyC') ? 1 : 0);
    const look = new THREE.Vector3(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));
    player.pos.addScaledVector(look, mz * speed * dt).addScaledVector(right, mx * speed * dt);
    player.pos.y += up * speed * dt;
    player.eyeY = player.pos.y + EYE;
    return;
  }
  const speed = run ? W.run : W.walk;
  const delta = wish.multiplyScalar(speed * dt);
  const steps = Math.max(1, Math.ceil(delta.length() / 0.2));
  delta.divideScalar(steps);
  for (let i = 0; i < steps; i++) moveHorizontal(delta);
  depenetrate();
  const g = groundHeight(player.pos);
  const gap = player.pos.y - g;
  if (player.vy > 0 || gap > 0.05) {
    player.vy -= GRAVITY * dt;
    player.pos.y += player.vy * dt;
    if (player.pos.y <= g) { player.pos.y = g; player.vy = 0; player.grounded = true; }
    else player.grounded = false;
  } else {
    player.pos.y = g; player.vy = 0; player.grounded = true;
  }
  if (player.grounded) ridEscalator(dt);
  if (player.pos.y < -30) teleport(PLACES[0]);
  const target = player.pos.y + EYE;
  player.eyeY += (target - player.eyeY) * (1 - Math.exp(-dt * 14));
  if (Math.abs(target - player.eyeY) > 1.2) player.eyeY = target;
}

// ---------------------------------------------------------------------------
// Where am I?
// ---------------------------------------------------------------------------
function locateHotel() {
  const bx = player.pos.x, by = -player.pos.z, z = player.pos.y;
  if (inCar()) return ['電梯', 'Elevator'];
  if (z > 20) return ['空中酒吧', 'Aurora Sky Bar'];
  if (z > 16.2 && z < 21 && bx > -20 && bx < 20 && by > 0 && by < 30) {
    const room = by < 15 ? (bx < -13.6 ? ['書房', 'Study'] : bx < 4.4 ? ['客廳', 'Grand Living Room'] : ['主臥室', 'Master Bedroom'])
      : by < 18 ? ['藝廊走道', 'Gallery'] : bx < -13 ? ['VIP 大廳', 'VIP Lobby'] : bx < 1 ? ['餐廳', 'Dining Room']
        : bx < 6 ? ['廚房', 'Kitchen'] : bx < 14 ? ['主浴室', 'Master Bath'] : ['更衣室', 'Walk-in Closet'];
    return [`總統套房 · ${room[0]}`, `Presidential Suite · ${room[1]}`];
  }
  if (z > 9.2 && z < 16.2 && bx > -20 && bx < 20 && by > 0 && by < 30) {      // 3F and 4F guest floors
    const fl = z > 12.4 ? '4' : '3';
    if (bx > -1.6 && bx < 4.4 && by < 13.5) return [`${fl}007 豪華客房`, `Deluxe King · ${fl}007`];
    if (bx > 4 && bx < 10 && by > 16.5) return [`${fl}008 雙床客房`, `Twin Room · ${fl}008`];
    return [`${fl}F 客房樓層`, 'Guest Floor'];
  }
  if (bx >= 20 && bx < 34.2 && by > 0.4 && by < 22.2) return ['咖啡廳', 'Aurora Café'];
  if (bx >= 20.5 && bx < 34 && by > -5.5 && by <= 0.4) return ['咖啡廳露台', 'Café Terrace'];
  if (bx <= -20 && bx > -40.2 && by > 9.4 && by < 30.2) return ['自助餐廳', 'The Market · Buffet'];
  const inside = bx > -20 && bx < 20 && by > 0 && by < 60;
  if (!inside) return by < 0 && Math.abs(bx) < 30 && by > -48 ? ['正門廣場', 'Forecourt'] : ['花園', 'Gardens'];
  if (by < 30) {
    if (z > 3.5 && by > 25.9) return ['夾層藝廊', 'Mezzanine Gallery'];
    if (Math.abs(bx) < 4.2 && by > 18.8 && by < 26) return ['大階梯', 'Grand Staircase'];
    if (bx > 13) return ['接待櫃檯', 'Reception'];
    if (bx < -11) return by > 19 ? ['電梯廳', 'Elevator Hall'] : ['大廳酒廊', 'Lobby Lounge'];
    return ['挑高大廳', 'Grand Lobby'];
  }
  if (bx > 0 && bx < 4.4 && by < 34.45 && z < 3.5) return ['更衣淋浴室', 'Changing Room'];
  if (bx > 0) return ['室內泳池', 'AQUA Pool & Spa'];
  if (z > 3.5) {
    if (by < 33.5) return ['2F 設施走廊', 'Le Jardin Bar & Boutique'];
    return bx < -10 ? ['精品店', 'Aurora Boutique'] : ['花園酒吧', 'Le Jardin Bar'];
  }
  if (by < 34.1 && bx < -12.55) return bx < -16.4 ? ['男廁', 'Gentlemen'] : ['女廁', 'Ladies'];
  return ['健身房', 'Aurora Fitness'];
}
const CARO = [-48, 8], TEA = [-48, -30], LAKE = [54, -40];
function locatePark() {
  const bx = player.pos.x, by = -player.pos.z, z = player.pos.y;
  if (z > 4 && player.fly) return ['王國上空', 'Above the Kingdom'];
  if (by < -96) return ['入口廣場', 'Entrance Plaza'];
  if (by < -92.5 && Math.abs(bx) < 13) return ['入口大門', 'Entrance Gate'];
  // the three shops you can walk into on Main Street
  if (bx < -10.6 && bx > -20.4 && by > -88 && by < -79.05) return ['童話大街 · 麵包店', 'Main Street · Bakery'];
  if (bx < -10.6 && bx > -20.4 && by > -78.95 && by < -70.55) return ['童話大街 · 玩具店', 'Main Street · Toy Shop'];
  if (bx > 10.6 && bx < 20.4 && by > -88 && by < -78.05) return ['童話大街 · 冰淇淋店', 'Main Street · Ice Cream'];
  if (Math.abs(bx) < 10.5 && by < -22) return ['童話大街', 'Main Street'];
  if (Math.hypot(bx, by) < 23.5) return ['星光廣場', 'Star Fountain Plaza'];
  if (Math.abs(bx) < 4.6 && by >= 21 && by < 36) return ['護城河橋', 'Moat Bridge'];
  if (Math.abs(bx) < 3.6 && by >= 36 && by < 38.5) return ['城門', 'Castle Gate'];
  if (Math.abs(bx) < 3.6 && by >= 44 && by < 62) return ['城堡通道', 'Castle Gate Hall'];
  if (Math.abs(bx) < 16.5 && by >= 38 && by < 62) return ['城堡中庭', 'Castle Courtyard'];
  if (Math.hypot(bx - CARO[0], by - CARO[1]) < 16) return ['皇家旋轉木馬', 'Royal Carousel'];
  if (Math.hypot(bx - TEA[0], by - TEA[1]) < 17) return ['瘋狂茶杯', 'Tea Party Teacups'];
  if (bx > 43 && bx < 63 && by > -2 && by < 22) return ['星光摩天輪', 'Starlight Wheel'];
  if (bx > -32 && bx < -8 && by > 74 && by < 88) return ['飛龍雲霄飛車 · 車站', 'Dragon Flight Station'];
  if (((bx - LAKE[0]) / 25) ** 2 + ((by - LAKE[1]) / 18) ** 2 < 1) return ['天鵝湖', 'Swan Lake'];
  if (by > 62) return ['飛龍森林', 'Dragon Woods'];
  return ['童話花園', 'Storybook Gardens'];
}
const MALL_SHOPS = {
  '0S': ['TICKTOCK 鐘錶', 'GLEAM 珠寶', 'NOVA TECH 3C 電子', 'PETAL 花店', '入口大廳', 'AROMA TEA 茶葉', 'SWEET HOURS 咖啡廳', 'OPTIKA 眼鏡', 'LUXE BAGS 精品包'],
  '0N': ['MAISON 香水', 'BLOOM 服飾', 'GLOW BEAUTY 美妝', 'PIXEL PLAY 遊戲', 'HOME & LOOM 家居', 'SCOOP 冰淇淋', 'FRESH MART 超市', 'FRESH MART 超市', 'FRESH MART 超市'],
  '1S': ['URBAN 服飾', 'DENIM CO. 服飾', 'SOLE 鞋店', 'LUMINA 服飾', 'VELVET 服飾', 'RIBBON 包包', 'STRIDE SPORTS 運動用品', 'TREK 鞋店', 'LITTLE STAR 童裝'],
  '1N': ['CASA 家居', 'STUDIO 9 服飾', 'PAGE & CO. 書店', 'INK & PAPER 文具', 'MELODY 音樂', 'SNAP 手機', 'KIDDO TOYS 玩具店', 'BRICKS 積木', 'PAWS 寵物'],
  '2S': ['ZEN 家居', 'FIT LAB 運動', 'GADGET 手機', 'SKETCH 畫材', 'SUGAR 冰淇淋', 'GLEE 玩具', 'NAIL BAR 美甲', 'TRAVEL+ 旅行箱', 'POP STORE 公仔'],
  '2N': ['美食街', '美食街', '美食街', '美食街', 'ARCADE 遊樂場', '電影院大廳', '電影院大廳', '電影院 · 1 廳', '電影院 · 1 廳'],
};
const MALL_UNITS = [-50, -39, -28, -17, -6, 6, 17, 28, 39, 50];
function locateMall() {
  const bx = player.pos.x, by = -player.pos.z, z = player.pos.y;
  if (inCar()) return ['電梯', 'Lift'];
  if (by < -44) return ['停車場', 'Parking'];
  if (by < 0 || bx < -50 || bx > 50 || by > 60) return ['入口廣場', 'Entrance Plaza'];
  const lv = z > 9 ? 2 : z > 3.6 ? 1 : 0, F = `${lv + 1}F`;
  if (onEscalator()) return ['手扶梯', 'Escalator'];
  if (by < 16 || by > 44) {
    const i = Math.max(0, MALL_UNITS.findIndex((x, j) => bx >= x && bx < MALL_UNITS[j + 1]));
    const name = MALL_SHOPS[`${lv}${by < 16 ? 'S' : 'N'}`][i];
    return [`${F} ${name}`, `${F} · shop`];
  }
  if (bx < -40 || bx > 40) return [`${F} ${bx < 0 ? '西' : '東'}側大廳`, `${F} ${bx < 0 ? 'West' : 'East'} Court`];
  if (lv > 0 && by > 22 && by < 38 && Math.abs(Math.abs(bx) - 28) < 2) return [`${F} 空橋`, `${F} Bridge`];
  if (lv === 0 && Math.hypot(bx, by - 30) < 9) return ['中央噴泉', 'Central Court'];
  return [`${F} 中庭迴廊`, `${F} Galleria`];
}
function locateNature() {
  const bx = player.pos.x, by = -player.pos.z, z = player.pos.y;
  if (z > 8 && player.fly) return ['翠谷上空', 'Above the Valley'];
  const look = MAPDATA?.looks?.findIndex(([x, y]) => Math.hypot(bx - x, by - y) < 5) ?? -1;
  if (look >= 0) return [['西峰觀景台', '南峰觀景台', '東峰觀景台'][look], ['West Lookout', 'South Lookout', 'East Lookout'][look]];
  if (by < -80 && bx > -31 && bx < 5 && z < 3) return ['入口廣場', 'Entrance Plaza'];
  const van = MAPDATA?.vans.findIndex(([x, y]) => Math.abs(bx - x) < MAPDATA.van[0] / 2 && Math.abs(by - y) < MAPDATA.van[1] / 2) ?? -1;
  if (van >= 0) return [`露營車 · ${van + 1} 號`, `Camper Van ${van + 1}`];
  const tent = MAPDATA?.tents.findIndex(([x, y]) => Math.hypot(bx - x, by - y) < 3.6) ?? -1;
  if (tent >= 0) return [`鐘型帳篷 · ${tent + 1} 號`, `Bell Tent ${tent + 1}`];
  if (bx > 27.5 && bx < 32.6 && by > -14.2 && by < -6.8) return ['營地服務台', 'Camp Office'];
  if (MAPDATA?.lounge) { const [x0, x1, y0, y1] = MAPDATA.lounge; if (bx > x0 && bx < x1 && by > y0 && by < y1) return ['露營休息室', 'Guest Lounge']; }
  const cabin = MAPDATA?.cabins?.findIndex(([x, y]) => Math.abs(bx - x) < 2.7 && Math.abs(by - y) < 2.4) ?? -1;
  if (cabin >= 0) return [`小木屋 · ${cabin + 1} 號`, `Cabin ${cabin + 1}`];
  if (MAPDATA?.lodge) { const [x0, x1, y0, y1] = MAPDATA.lodge; if (bx > x0 && bx < x1 + 5 && by > y0 && by < y1) {
    if (bx > x1) return ['翠谷木屋', 'Emerald Lodge'];
    if (z > (MAPDATA.lodge_f2 ?? 5.8) - 1.3) return bx > -37.5 ? ['翠谷木屋 2F · 伴手禮店', 'Lodge 2F · Gift Shop'] : ['翠谷木屋 2F · 活動室', 'Lodge 2F · Activity Room'];
    if (bx < -39.5 && by > 0) return ['翠谷木屋 1F · 壁爐沙發區', 'Lodge 1F · Fireside'];
    return by > 5.5 ? ['翠谷木屋 1F · 森林咖啡廳', 'Lodge 1F · Forest Café'] : ['翠谷木屋 1F · 遊客中心', 'Lodge 1F · Visitor Center'];
  } }
  if (bx > 60 && bx < 68 && by > 23 && by < 29) return [bx < 64 ? '盥洗室 · 男' : '盥洗室 · 女', bx < 64 ? 'Wash House · Men' : 'Wash House · Women'];
  if (Math.hypot(bx - 47, by - 8) < 5) return ['營火區', 'Campfire'];
  if (bx > 22 && bx < 72 && by > -36 && by < 32) { const c = by < -16 && bx > 34; return [c ? '小木屋區' : '豪華露營區', c ? 'Cabins' : 'Glamping Meadow']; }
  if (MAPDATA?.suspension && z > 12) {
    const [[x0, y0], [x1, y1]] = MAPDATA.suspension, dx = x1 - x0, dy = y1 - y0;
    const t = ((bx - x0) * dx + (by - y0) * dy) / (dx * dx + dy * dy);
    if (t > -0.02 && t < 1.02 && Math.abs((bx - x0) * dy - (by - y0) * dx) / Math.hypot(dx, dy) < 2) return ['翠谷吊橋', 'Valley Bridge'];
  }
  if (by > 92 && z > 6) return ['瀑布頂端', 'Above the Falls'];
  if (MAPDATA?.ring?.some((t) => MAPDATA.trails[t].some(([x, y]) => Math.hypot(bx - x, by - y) < 3))) return ['環山步道', 'Ridge Trail'];
  if (Math.hypot(bx, by - 83) < 16 && z < 8) return ['瀑布水潭', 'Falls Pool'];
  for (const [[x0, y0], [x1, y1]] of MAPDATA?.bridges || []) {
    const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((bx - x0) * dx + (by - y0) * dy) / (dx * dx + dy * dy)));
    if (Math.hypot(bx - x0 - t * dx, by - y0 - t * dy) < 1.4) return ['溪流木橋', 'Creek Bridge'];
  }
  if (MAPDATA && MAPDATA.creek.some(([x, y]) => Math.hypot(bx - x, by - y) < 5)) return ['翠谷溪畔', 'Creekside'];
  if (z > 7) return ['山坡', 'Mountainside'];
  return ['森林步道', 'Forest Trail'];
}
function locateAirport() {
  const bx = player.pos.x, by = -player.pos.z, z = player.pos.y;
  const D = MAPDATA || {};
  if (z > 14 && player.fly) return ['機場上空', 'Above the Airport'];
  if (by < -10.3) return ['出境車道', 'Departures Kerb'];
  if (by < 0) return ['航廈入口', 'Terminal Entrance'];
  if (D.cabin) {
    const [x0, x1, y0, y1, fl] = D.cabin;
    if (bx > x0 && bx < x1 && by > y0 && by < y1 && z > fl - 0.6) {
      if (bx > D.galley) return ['客艙 · 前艙廚房', 'Cabin · Galley'];
      if (bx > D.biz) return ['客艙 · 商務艙', 'Cabin · Business'];
      if (bx < x0 + 2.5) return ['客艙 · 洗手間', 'Cabin · Lavatories'];
      return ['客艙 · 經濟艙', 'Cabin · Economy'];
    }
    const [b0, b1, c0, c1] = D.bridge;
    if (bx > b0 && bx < b1 && by > c0 && by < c1 + 0.6) return ['空橋', 'Jet Bridge'];
  }
  if (by > 84.5) return ['停機坪', 'Apron'];
  if (by < (D.sec_y ?? 34) - 0.4) {
    for (const [x0, x1, y0, y1] of D.islands || []) if (bx > x0 - 0.3 && bx < x1 + 0.3 && by > y0 - 4 && by < y1) return bx < 0 ? ['報到櫃檯 · 極光航空', 'Check-in · Aurora Air'] : ['報到櫃檯 · SKYLINK', 'Check-in · Skylink'];
    if (by > (D.sec_y ?? 34) - 5.5 && Math.abs(bx) < 9.5) return ['安全檢查', 'Security'];
    if (by > 20 && Math.abs(bx) < 10) return ['航班看板', 'Flight Board'];
    return ['出境大廳', 'Departures Hall'];
  }
  if (by < (D.sec_y ?? 34) + 3.2 && Math.abs(bx) < 9.5) return ['安全檢查', 'Security'];
  for (const [x0, x1, y0, y1, name] of D.shops || []) if (bx > x0 && bx < x1 && by > y0 && by < y1) return [name, 'Shop'];
  if (by > (D.gate_y ?? 66)) return ['登機門 A1', 'Gate A1'];
  return ['免稅商店街', 'Duty-free Street'];
}
const locateHere = () => (W.key === 'hotel' ? locateHotel() : W.key === 'park' ? locatePark() : W.key === 'nature' ? locateNature() : W.key === 'airport' ? locateAirport() : locateMall());
function locate() {
  if (riding.ride && riding.dir > 0) return [`${riding.ride.zh} · 搭乘中`, `${riding.ride.en} · riding`];
  if (portalCand) return ['傳送門', 'Portal'];
  if (dialog.npc) return [`${dialog.npc.c.zh} · 對話中`, `${dialog.npc.c.en} · talking`];
  return locateHere();
}

// ---------------------------------------------------------------------------
// Minimap (drawn in Blender plan coordinates, north up)
// ---------------------------------------------------------------------------
const map = document.getElementById('minimap');
const mctx = map.getContext('2d');
let MAP = WORLDS.hotel.map;
const MAP_PATHS = [[[0, 22], [0, 28], 8], [[-22, 4], [-37.5, 7.4], 6], [[-18, -12], [-36, -22.5], 6], [[20, 3], [46, 9.6], 6],
  [[17, -15], [36, -30], 6], [[-16, 17], [-36, 30], 5], [[-36, 30], [-36, 79], 5], [[-36, 79], [-16, 79], 5],
  [[0, 62], [0, 79], 6], [[0, 79], [-16, 79], 5], [[36, -30], [31.2, -40], 4]];
let trackLine = null;
function mapPt(bx, by) {
  const w = map.width, h = map.height;
  return [(bx - MAP.x0) / (MAP.x1 - MAP.x0) * w, h - (by - MAP.y0) / (MAP.y1 - MAP.y0) * h];
}
function rect(x0, y0, x1, y1, fill, stroke) {
  const [a, b] = mapPt(x0, y1), [c, d] = mapPt(x1, y0);
  if (fill) { mctx.fillStyle = fill; mctx.fillRect(a, b, c - a, d - b); }
  if (stroke) { mctx.strokeStyle = stroke; mctx.strokeRect(a + 0.5, b + 0.5, c - a - 1, d - b - 1); }
}
function circle(bx, by, r, fill, stroke, sx = 1, sy = 1) {
  const [x, y] = mapPt(bx, by);
  const s = map.width / (MAP.x1 - MAP.x0);
  mctx.beginPath();
  mctx.ellipse(x, y, Math.max(1, r * s * sx), Math.max(1, r * s * sy), 0, 0, Math.PI * 2);
  if (fill) { mctx.fillStyle = fill; mctx.fill(); }
  if (stroke) { mctx.strokeStyle = stroke; mctx.stroke(); }
}
function drawHotelMap(dpr) {
  const upper = player.pos.y > 3.5;
  const guest = player.pos.y > 11 && player.pos.y < 16.2;
  const pres = player.pos.y >= 16.2 && player.pos.y < 21;
  rect(-30, -48, 30, -0.2, 'rgba(225,215,195,0.16)');
  const [fx, fy] = mapPt(0, -24);
  const s = map.width / (MAP.x1 - MAP.x0);
  mctx.strokeStyle = 'rgba(90,90,96,0.7)'; mctx.lineWidth = 5 * s;
  mctx.beginPath(); mctx.arc(fx, fy, 11 * s, 0, Math.PI * 2); mctx.stroke();
  mctx.lineWidth = dpr;
  mctx.fillStyle = 'rgba(80,190,220,0.55)';
  mctx.beginPath(); mctx.arc(fx, fy, 6.4 * s, 0, Math.PI * 2); mctx.fill();
  rect(-20, 0, 20, 60, 'rgba(18,26,44,0.85)', 'rgba(214,180,110,0.9)');
  rect(-20, 0, 20, 30, upper ? 'rgba(214,180,110,0.06)' : 'rgba(214,180,110,0.16)', 'rgba(214,180,110,0.5)');
  if (upper) rect(-20, 26, 20, 30, 'rgba(214,180,110,0.3)');
  else rect(-4, 19, 4, 26, 'rgba(160,40,50,0.6)');
  rect(-20, 30, 0, 60, upper ? 'rgba(214,180,110,0.22)' : 'rgba(40,110,80,0.35)', 'rgba(214,180,110,0.5)');
  if (upper) rect(-20, 44.9, 0, 45.1, 'rgba(214,180,110,0.8)');
  rect(0, 30, 20, 60, 'rgba(214,180,110,0.08)', 'rgba(214,180,110,0.5)');
  rect(20.2, 0.5, 34, 22, 'rgba(140,165,130,0.4)', 'rgba(214,180,110,0.5)');
  rect(21, -5, 33.6, 0.4, 'rgba(160,120,80,0.35)');
  rect(-40, 9.5, -20.2, 30, 'rgba(200,170,120,0.25)', 'rgba(214,180,110,0.5)');
  rect(5, 36, 15, 54, 'rgba(70,180,215,0.75)');
  if (pres) {
    rect(-20, 0, 20, 30, 'rgba(18,26,44,0.95)', 'rgba(214,180,110,0.9)');
    rect(-20, 15, 20, 18, 'rgba(214,180,110,0.3)');
    for (const [x0, x1, y0, y1] of [[-20, -13.6, 0, 15], [-13.6, 4.4, 0, 15], [4.4, 20, 0, 15], [-20, -13, 18, 30], [-13, 1, 18, 30], [1, 6, 18, 30], [6, 14, 18, 30], [14, 20, 18, 30]])
      rect(x0, y0, x1, y1, 'rgba(214,180,110,0.12)', 'rgba(214,180,110,0.45)');
  }
  if (guest) {
    rect(-20, 0, 20, 30, 'rgba(18,26,44,0.95)', 'rgba(214,180,110,0.9)');
    rect(-20, 13.5, 20, 16.5, 'rgba(150,40,50,0.6)');
    rect(-20, 16.5, -14, 30, 'rgba(150,40,50,0.35)');
    rect(-1.6, 0, 4.4, 13.5, 'rgba(214,180,110,0.35)');
    rect(4, 16.5, 10, 30, 'rgba(214,180,110,0.35)');
  }
}
function drawNatureMap(dpr) {
  const D = MAPDATA;
  if (!D) return;
  const s = map.width / (MAP.x1 - MAP.x0);
  const line = (pts, w, col) => {
    mctx.strokeStyle = col; mctx.lineWidth = w; mctx.lineCap = 'round'; mctx.lineJoin = 'round';
    mctx.beginPath();
    pts.forEach(([x, y], i) => { const [a, b] = mapPt(x, y); if (i) mctx.lineTo(a, b); else mctx.moveTo(a, b); });
    mctx.stroke();
  };
  rect(...[D.meadow[0], D.meadow[2], D.meadow[1], D.meadow[3]], 'rgba(150,200,110,0.22)');
  rect(D.plaza[0], D.plaza[2], D.plaza[1], D.plaza[3], 'rgba(222,196,150,0.35)');
  for (const t of D.trails) line(t, 2 * s, 'rgba(222,196,150,0.6)');
  line(D.creek, 4.5 * s, 'rgba(80,170,200,0.8)');
  circle(D.pool[0], D.pool[1], D.pool[2], 'rgba(80,170,200,0.85)');
  for (const [a, b] of D.bridges) line([a, b], 2.2 * s, 'rgba(170,120,70,0.95)');
  if (D.suspension) line(D.suspension, 2.4 * s, 'rgba(170,120,70,0.95)');
  rect(D.office[0], D.office[2], D.office[1], D.office[3], 'rgba(60,120,110,0.85)', 'rgba(242,196,109,0.8)');
  if (D.lounge) rect(D.lounge[0], D.lounge[2], D.lounge[1], D.lounge[3], 'rgba(60,120,110,0.85)', 'rgba(242,196,109,0.8)');
  if (D.lodge) rect(D.lodge[0], D.lodge[2], D.lodge[1], D.lodge[3], 'rgba(150,100,60,0.9)', 'rgba(242,196,109,0.8)');
  for (const [x, y] of D.cabins || []) rect(x - 2.6, y - 2.3, x + 2.6, y + 2.3, 'rgba(150,100,60,0.9)', 'rgba(242,196,109,0.8)');
  if (D.wash) rect(D.wash[0], D.wash[2], D.wash[1], D.wash[3], 'rgba(60,120,110,0.85)', 'rgba(242,196,109,0.8)');
  for (const [x, y] of D.tents) circle(x, y, 3.9, 'rgba(240,232,214,0.9)', 'rgba(242,196,109,0.8)');
  for (const [x, y] of D.vans) rect(x - D.van[0] / 2, y - D.van[1] / 2, x + D.van[0] / 2, y + D.van[1] / 2, 'rgba(210,214,222,0.9)', 'rgba(242,196,109,0.8)');
  circle(D.fire[0], D.fire[1], 1.4, 'rgba(255,140,60,0.95)');
  for (const [x, y] of D.looks || []) circle(x, y, 3.4, 'rgba(170,120,70,0.95)', 'rgba(242,196,109,0.9)');
  mctx.lineWidth = dpr;
}
function drawParkMap(dpr) {
  const s = map.width / (MAP.x1 - MAP.x0);
  mctx.lineCap = 'round';
  mctx.strokeStyle = 'rgba(232,214,180,0.35)';
  for (const [[x0, y0], [x1, y1], w] of MAP_PATHS) {
    mctx.lineWidth = w * s;
    const [a, b] = mapPt(x0, y0), [c, d] = mapPt(x1, y1);
    mctx.beginPath(); mctx.moveTo(a, b); mctx.lineTo(c, d); mctx.stroke();
  }
  mctx.lineWidth = dpr;
  rect(-32, -118, 32, -96, 'rgba(232,214,180,0.3)');
  rect(-7, -96, 7, -22, 'rgba(232,214,180,0.35)');
  rect(-20.4, -88, -10.4, -32, 'rgba(244,166,192,0.55)', 'rgba(242,196,109,0.6)');
  rect(10.4, -88, 20.4, -32, 'rgba(244,166,192,0.55)', 'rgba(242,196,109,0.6)');
  rect(-32, -95.6, 32, -94.4, 'rgba(242,196,109,0.85)');
  circle(0, 0, 25, 'rgba(232,214,180,0.32)');
  circle(0, 0, 7, 'rgba(80,190,220,0.7)');
  rect(-30, 28.2, 30, 33.8, 'rgba(70,170,210,0.7)');
  rect(-4.4, 26, 4.4, 36, 'rgba(232,214,180,0.6)');
  rect(-16.5, 36, 16.5, 62, 'rgba(110,140,220,0.35)', 'rgba(242,196,109,0.85)');
  rect(-11, 44, 11, 62, 'rgba(110,140,220,0.55)');
  rect(-3.5, 38, 3.5, 62, 'rgba(232,214,180,0.55)');
  circle(0, 53, 4.4, 'rgba(242,196,109,0.85)');
  circle(CARO[0], CARO[1], 10.6, 'rgba(230,80,90,0.45)', 'rgba(242,196,109,0.9)');
  circle(TEA[0], TEA[1], 12.2, 'rgba(244,166,192,0.45)', 'rgba(242,196,109,0.9)');
  rect(49, 5.5, 60.5, 14.5, 'rgba(232,214,180,0.4)');
  rect(54.6, -6, 57.4, 26, 'rgba(255,255,255,0.75)');
  circle(LAKE[0], LAKE[1], 1, 'rgba(70,170,210,0.75)', null, 20, 13);
  rect(-31, 81.6, -9, 86.6, 'rgba(70,150,140,0.6)', 'rgba(242,196,109,0.8)');
  const co = RIDES_CFG?.coaster;
  if (co) {
    if (!trackLine) trackLine = co.rows.filter((_, i) => i % 6 === 0).map((r) => [r[0], r[1]]);
    mctx.strokeStyle = 'rgba(230,60,70,0.95)'; mctx.lineWidth = 1.6 * dpr;
    mctx.beginPath();
    trackLine.forEach(([x, y], i) => { const [a, b] = mapPt(x, y); if (i) mctx.lineTo(a, b); else mctx.moveTo(a, b); });
    mctx.closePath(); mctx.stroke();
    const tr = rides.find((r) => r.key === 'coaster');
    if (tr) {
      const p = tr.train;
      const i = Math.floor((((p.s % co.len) + co.len) % co.len) / co.step) % co.rows.length;
      const [a, b] = mapPt(co.rows[i][0], co.rows[i][1]);
      mctx.fillStyle = '#7fe0a0'; mctx.beginPath(); mctx.arc(a, b, 2.6 * dpr, 0, Math.PI * 2); mctx.fill();
    }
    mctx.lineWidth = dpr;
  }
}
function drawAirportMap(dpr) {
  const D = MAPDATA;
  if (!D) return;
  const line = 'rgba(214,180,110,0.55)';
  rect(D.kerb[0], D.kerb[2], D.kerb[1], -10.3, 'rgba(90,96,110,0.55)');
  rect(D.kerb[0], -10.3, D.kerb[1], D.kerb[3], 'rgba(225,215,195,0.22)');
  rect(-60, 84.4, 60, 96, 'rgba(150,155,165,0.35)');
  rect(D.hall[0], D.hall[2], D.hall[1], D.hall[3], 'rgba(18,26,44,0.85)', 'rgba(214,180,110,0.9)');
  rect(D.air[0], D.air[2], D.air[1], D.air[3], 'rgba(18,26,44,0.85)', 'rgba(214,180,110,0.9)');
  for (const [x0, x1, y0, y1] of D.islands) rect(x0, y0, x1, y1, 'rgba(70,130,220,0.55)', line);
  rect(D.board[0], D.board[2] - 0.4, D.board[1], D.board[2] + 0.4, 'rgba(255,190,80,0.85)');
  for (const c of D.lanes) rect(c - 0.6, D.sec_y - 0.4, c + 0.6, D.sec_y + 0.4, 'rgba(120,230,150,0.9)');
  rect(D.hall[0], D.sec_y - 0.2, -9, D.sec_y + 0.2, line); rect(9, D.sec_y - 0.2, D.hall[1], D.sec_y + 0.2, line);
  const tint = ['rgba(70,130,220,0.35)', 'rgba(230,140,60,0.35)', 'rgba(60,170,170,0.35)', 'rgba(230,120,170,0.35)'];
  D.shops.forEach(([x0, x1, y0, y1], i) => rect(x0, y0, x1, y1, tint[i], line));
  rect(D.desk[0], D.desk[2], D.desk[1], D.desk[3], 'rgba(214,180,110,0.9)');
  if (D.cabin) {
    rect(D.bridge[0], D.bridge[2], D.bridge[1], D.bridge[3], 'rgba(170,175,185,0.9)');
    rect(D.cabin[0] - 6, D.cabin[2], D.cabin[1] + 6, D.cabin[3], 'rgba(240,244,250,0.9)', 'rgba(70,130,220,0.9)');
  } else circle(D.plane[0], Math.min(D.plane[1], 92), 3.2, 'rgba(240,244,250,0.9)', 'rgba(70,130,220,0.9)');
  mctx.lineWidth = dpr;
}
function drawMallMap(dpr) {
  const lv = player.pos.y > 9 ? 2 : player.pos.y > 3.6 ? 1 : 0;
  rect(-62, -44, 62, -0.2, 'rgba(225,215,195,0.14)');
  rect(-50, 0, 50, 60, 'rgba(18,26,44,0.85)', 'rgba(214,180,110,0.9)');
  const shop = 'rgba(214,180,110,0.16)', line = 'rgba(214,180,110,0.45)';
  for (let i = 0; i < MALL_UNITS.length - 1; i++) {
    const x0 = MALL_UNITS[i], x1 = MALL_UNITS[i + 1];
    if (!(lv === 0 && x0 === -6)) rect(x0, 0, x1, 16, shop, line);
    rect(x0, 44, x1, 60, shop, line);
  }
  if (lv === 0) rect(17, 44, 50, 60, 'rgba(60,170,90,0.45)', line);
  if (lv === 2) { rect(-50, 44, -6, 60, 'rgba(230,140,60,0.45)', line); rect(6, 44, 28, 60, 'rgba(200,50,60,0.35)', line); rect(28, 44, 50, 60, 'rgba(200,50,60,0.6)', line); }
  if (lv > 0) {
    rect(-40, 22, 40, 38, 'rgba(120,170,220,0.25)');
    rect(-30, 22, -26, 38, 'rgba(214,180,110,0.3)'); rect(26, 22, 30, 38, 'rgba(214,180,110,0.3)');
  } else {
    circle(0, 30, 4.2, 'rgba(80,190,220,0.6)');
  }
  mctx.strokeStyle = 'rgba(255,255,255,0.85)'; mctx.lineWidth = 2 * dpr;
  for (const e of ESCALATORS) {
    const [a, b] = mapPt(e.a.x, -e.a.z), [c, d] = mapPt(e.b.x, -e.b.z);
    mctx.beginPath(); mctx.moveTo(a, b); mctx.lineTo(c, d); mctx.stroke();
  }
  mctx.lineWidth = dpr;
  rect(-52.8, 28.6, -50.2, 31.4, 'rgba(214,180,110,0.8)');
  mctx.fillStyle = 'rgba(242,196,109,0.95)';
  mctx.font = `${10 * dpr}px sans-serif`;
  mctx.fillText(`${lv + 1}F`, 4 * dpr, 12 * dpr);
}
const camDir = new THREE.Vector3();
function drawMap() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = map.clientWidth * dpr, ch = map.clientHeight * dpr;
  if (map.width !== cw || map.height !== ch) { map.width = cw; map.height = ch; }
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.clearRect(0, 0, map.width, map.height);
  mctx.lineWidth = dpr;
  if (W.key === 'hotel') drawHotelMap(dpr); else if (W.key === 'park') drawParkMap(dpr); else if (W.key === 'nature') drawNatureMap(dpr); else if (W.key === 'airport') drawAirportMap(dpr); else drawMallMap(dpr);
  // characters: pink dots
  mctx.fillStyle = 'rgba(255,150,200,0.95)';
  for (const n of npcs) { const [a, b] = mapPt(n.root.position.x, -n.root.position.z); mctx.beginPath(); mctx.arc(a, b, 2.6 * dpr, 0, Math.PI * 2); mctx.fill(); }
  // the portal: a pulsing violet star
  if (!SOLO) {
    const [qx, qy] = mapPt(W.portal.p[0], W.portal.p[1]);
    mctx.fillStyle = `rgba(214,150,255,${0.6 + 0.4 * Math.sin(performance.now() / 300)})`;
    mctx.beginPath(); mctx.arc(qx, qy, 3.4 * dpr, 0, Math.PI * 2); mctx.fill();
  }
  // player
  const [px, py] = mapPt(player.pos.x, -player.pos.z);
  const yaw = riding.ride ? Math.atan2(-camDir.x, -camDir.z) : player.yaw;
  mctx.save();
  mctx.translate(px, py);
  mctx.rotate(-yaw);
  mctx.fillStyle = '#fff3d6';
  mctx.strokeStyle = 'rgba(10,14,40,0.9)';
  mctx.lineWidth = 1.5 * dpr;
  mctx.beginPath();
  mctx.moveTo(0, -7 * dpr); mctx.lineTo(5 * dpr, 5 * dpr); mctx.lineTo(0, 2.5 * dpr); mctx.lineTo(-5 * dpr, 5 * dpr); mctx.closePath();
  mctx.stroke(); mctx.fill();
  mctx.restore();
}

// ---------------------------------------------------------------------------
// Switching worlds
// ---------------------------------------------------------------------------
let switching = false;
const warp = document.getElementById('warp');
const loaderEl = document.getElementById('loader');
function disposeWorld() {
  worldRoot.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      for (const m of [].concat(o.material)) {
        for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap']) m[k]?.dispose?.();
        m.dispose();
      }
    }
  });
  scene.remove(worldRoot);
  worldRoot = new THREE.Group();
  scene.add(worldRoot);
  if (collider) { collider.geometry.boundsTree = undefined; collider.geometry.dispose(); }
  collider = null;
  lightSources.length = 0;
  for (const l of POOL) { l.userData.src = null; l.intensity = 0; }
  for (const k of Object.keys(matByName)) delete matByName[k];
  sharedTex.clear(); lightMats.clear();
  rideMeshes.length = 0; rides.length = 0; rideQueued = null;
  Object.assign(riding, { ride: null, anchor: null, seatedSent: false });
  Object.assign(lift, { landings: [], floors: [], car: null, at: null, door: 0, phase: 'idle', t: 0, dest: null });
  dynColliders.length = 0;
  SEATS = []; sit.seat = null; candidate = null; rideCand = null; liftCall = null; portalCand = false;
  LIFT_CFG = null; RIDES_CFG = null; ESCALATORS = []; trackLine = null;
  DOORS_CFG = null; doors.length = 0; doorCand = null;
  closePortalMenu();
  endPhoto(true); clearFx();
  npcs.length = 0; npcCand = null; closeDialog();
  portal.group = null;
}
function setChips() {
  chips.innerHTML = '';
  for (const p of PLACES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.innerHTML = `<kbd>${p.key}</kbd><span>${p.zh}</span>`;
    b.title = `${p.en} (${p.key})`;
    b.addEventListener('click', (e) => { teleport(p); e.currentTarget.blur(); if (started) lock(); });
    chips.appendChild(b);
  }
  document.getElementById('btn-portal').title = `走到傳送門（通往${othersOf(W.key).map((k) => WORLDS[k].zh).join('、')}）`;
}
async function enterWorld(key, arriveAtPortal) {
  switching = true;
  paused = true;
  const w = WORLDS[key];
  document.getElementById('brand').textContent = w.en;
  document.getElementById('brand-sub').textContent = w.sub;
  loaderEl.hidden = false;
  disposeWorld();
  W = w;
  PLACES = w.places;
  MAP = w.map;
  applyLook(w);
  player.fly = false; updateFlyBtn();
  const arrive = arriveAtPortal ? portalPlace(w) : PLACES[0];
  teleport(arrive);
  const roots = await loadAll(w);
  collider = await prepare(roots);
  buildLift();
  buildDoors();
  buildRides();
  buildPortal(w);
  await buildCharacters(w);
  if (!avatar && !LITE) await useAvatar(view.avatar);
  setChips();
  teleport(arrive);
  renderer.shadowMap.needsUpdate = true;
  paused = false;
  loaderEl.hidden = true;
  switching = false;
  try { localStorage.setItem('aurora-world-last', key); } catch { }
  diag(`entered ${key}; programs ${renderer.info.programs.length}; textures ${renderer.info.memory.textures}; geometries ${renderer.info.memory.geometries}`);
}
async function warpTo(key) {
  if (switching) return;
  switching = true;
  keys.clear();
  warp.hidden = false;
  warp.classList.remove('out');
  await new Promise((r) => setTimeout(r, 650));       // fade to light
  clearTimeout(fadeIn.t);
  try {
    await enterWorld(key, true);
  } catch (e) {
    console.error(e);
    fail(`載入失敗：${e.message}。請檢查網路後重新整理頁面。`);
  } finally {
    warp.classList.add('out');
    setTimeout(() => { warp.hidden = true; }, 700);
  }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const intro = document.getElementById('intro');
const help = document.getElementById('help');
let started = false;
const LOOK = 0.0022;
function look(dx, dy, k = LOOK) {
  player.yaw -= dx * k;
  player.pitch = THREE.MathUtils.clamp(player.pitch - dy * k, -1.45, 1.45);
}
function lock() {
  if (matchMedia('(pointer: coarse)').matches) return;
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch { }
}
function start() {
  intro.hidden = true;
  started = true;
  lock();
}
const enterBtn = document.getElementById('btn-enter');
enterBtn.addEventListener('click', () => { if (!started) start(); });
enterBtn.addEventListener('touchend', (e) => { if (!started) { e.preventDefault(); start(); } });

addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  keys.add(e.code);
  if (!started || switching) return;
  if (photo.npc) {
    if (photo.view) { if (e.code === 'KeyE' || e.code === 'Enter') againPhoto(); else if (e.code === 'KeyQ') endPhoto(); }
    else if (/^Digit[1-3]$/.test(e.code) && photo.count <= 0) setPose(photo.npc, PHOTO_POSES[+e.code.slice(5) - 1]);
    else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') shoot();
    else if (e.code === 'KeyQ') endPhoto();
    if (!['KeyH', 'KeyM'].includes(e.code)) { e.preventDefault(); return; }
  }
  if (dialog.opts && !dialog.mini && /^Digit[0-9]$/.test(e.code)) { chooseOpt((+e.code.slice(5) + 9) % 10); e.preventDefault(); return; }
  if (e.code === 'KeyF' && !sit.seat && !riding.ride) { player.fly = !player.fly; player.vy = 0; updateFlyBtn(); }
  if (e.code === 'KeyV') toggleView();
  if (e.code === 'KeyN') document.getElementById('btn-night').click();
  if (e.code === 'KeyT') { const n = seatedCompanion(); if (n) talkTo(n); }
  if (e.code === 'KeyH') help.hidden = !help.hidden;
  if (e.code === 'KeyM') map.parentElement.hidden = !map.parentElement.hidden;
  if (e.code === 'KeyP' && !SOLO) teleport(portalPlace(W, true));
  if (!portalPanel.hidden && /^Digit[1-9]$/.test(e.code)) {
    const k = portalChoices[+e.code.slice(5) - 1];
    if (k) { closePortalMenu(); warpTo(k); }
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyE' && !player.fly) doAction();
  if (e.code === 'Space' && sit.seat) standUp();
  else if (e.code === 'Space' && !player.fly && player.grounded && !riding.ride) { player.vy = 3.6; player.grounded = false; }
  if (inCar() && !liftPanel.hidden && /^Digit[1-9]$/.test(e.code)) {
    chooseFloor(+e.code.slice(5) - 1);
    e.preventDefault();
    return;
  }
  const pl = PLACES.find((p) => 'Digit' + p.key === e.code);
  if (pl) teleport(pl);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

let drag = null;
canvas.addEventListener('mousedown', (e) => {
  if (!started) return;
  if (document.pointerLockElement !== canvas) lock();
  drag = { x: e.clientX, y: e.clientY };
});
addEventListener('mouseup', () => { drag = null; });
addEventListener('mousemove', (e) => {
  if (!started) return;
  if (document.pointerLockElement === canvas) look(e.movementX, e.movementY);
  else if (drag) { look(e.clientX - drag.x, e.clientY - drag.y, 0.004); drag.x = e.clientX; drag.y = e.clientY; }
});

// touch: left half = joystick, right half = look
const stick = document.getElementById('stick');
const knob = stick.querySelector('span');
const touches = new Map();
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' || !started) return;
  canvas.setPointerCapture(e.pointerId);
  const left = e.clientX < window.innerWidth * 0.45 && !riding.ride;
  touches.set(e.pointerId, { left, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY });
  if (left) {
    stick.style.left = `${e.clientX}px`; stick.style.top = `${e.clientY}px`;
    stick.hidden = false;
  }
});
canvas.addEventListener('pointermove', (e) => {
  const t = touches.get(e.pointerId);
  if (!t) return;
  if (t.left) {
    const dx = e.clientX - t.x0, dy = e.clientY - t.y0, R = 55;
    const l = Math.min(R, Math.hypot(dx, dy)) / (Math.hypot(dx, dy) || 1);
    knob.style.transform = `translate(${dx * l}px, ${dy * l}px)`;
    touchMove.set(dx * l / R, -dy * l / R);
  } else {
    look(e.clientX - t.x, e.clientY - t.y, 0.005);
    t.x = e.clientX; t.y = e.clientY;
  }
});
const endTouch = (e) => {
  const t = touches.get(e.pointerId);
  if (!t) return;
  if (t.left) { touchMove.set(0, 0); stick.hidden = true; knob.style.transform = ''; }
  touches.delete(e.pointerId);
};
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);

// HUD buttons
const chips = document.getElementById('places');
document.getElementById('btn-night').addEventListener('click', (e) => {
  night = !night;
  try { localStorage.setItem('aurora-world-night', night ? '1' : '0'); } catch { }
  if (W) applyLook(W);
  e.currentTarget.blur();
});
document.getElementById('btn-quality').addEventListener('click', (e) => {
  quality = quality === 'high' ? 'low' : 'high';
  try { localStorage.setItem('aurora-world-quality', quality); } catch { }
  applyQuality();
  e.currentTarget.blur();
});
const flyBtn = document.getElementById('btn-fly');
function updateFlyBtn() { flyBtn.setAttribute('aria-pressed', String(player.fly)); flyBtn.textContent = player.fly ? '飛行中' : '步行'; }
flyBtn.addEventListener('click', (e) => { if (riding.ride || switching || photo.npc) return; player.fly = !player.fly; player.vy = 0; updateFlyBtn(); e.currentTarget.blur(); });
document.getElementById('btn-help').addEventListener('click', (e) => { help.hidden = !help.hidden; e.currentTarget.blur(); });
// the bottom bar: 快速傳送 and 設定 each open a panel; one at a time
const menuPanels = { places: document.getElementById('places-panel'), settings: document.getElementById('settings-panel') };
function closeMenus(except) {
  for (const [k, el] of Object.entries(menuPanels)) {
    if (k === except) continue;
    el.hidden = true;
    document.getElementById('btn-' + k).setAttribute('aria-expanded', 'false');
  }
}
for (const k of Object.keys(menuPanels)) {
  document.getElementById('btn-' + k).addEventListener('click', (e) => {
    const open = menuPanels[k].hidden;
    closeMenus(k);
    menuPanels[k].hidden = !open;
    e.currentTarget.setAttribute('aria-expanded', String(open));
    e.currentTarget.blur();
  });
}
// a choice that opens something else, or a place, closes the panel; the toggles keep it open
for (const id of ['btn-chars', 'btn-map', 'btn-help', 'btn-portal']) document.getElementById(id).addEventListener('click', () => closeMenus());
chips.addEventListener('click', () => closeMenus());
canvas.addEventListener('pointerdown', () => closeMenus());
addEventListener('keydown', (e) => { if (e.code === 'Escape') closeMenus(); });
document.getElementById('btn-map').addEventListener('click', (e) => { map.parentElement.hidden = !map.parentElement.hidden; e.currentTarget.blur(); });
if (SOLO) document.getElementById('btn-portal').hidden = true;
document.getElementById('btn-portal').addEventListener('click', (e) => { if (!switching && W) teleport(portalPlace(W, true)); e.currentTarget.blur(); });
help.addEventListener('click', () => { help.hidden = true; });

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const placeZh = document.getElementById('place-zh');
const placeEn = document.getElementById('place-en');
const underwater = document.getElementById('underwater');
let lastPlace = '';
const clock = new THREE.Clock();
let hudAt = 0;

function step(dt) {
  if (collider && started && !switching) update(dt);
  const onRide = collider ? updateRiding(dt) : false;
  if (!onRide) {
    camera.position.set(player.pos.x, player.eyeY, player.pos.z);
    if (collider) { updateLift(dt); updateDoors(dt); updateSeating(dt); }
    camera.rotation.set(player.pitch, player.yaw, 0);
  } else {
    updateSeating(dt);
    placeSun(camera.position);
  }
  if (!onRide && !sit.seat) placeSun(player.pos);
  if (collider && started && !switching) recordSteps();
  if (collider && !switching) updateNpcs(dt);
  updateAvatar(dt);
  updateFx(dt);
  updateLightPool(collider ? dt : 1);
  if (night) skyDome.position.copy(camera.position);
  // underwater tint in the hotel pool basin (Blender x 5..15, y 36..54, water top z -0.12)
  const bx = camera.position.x, by = -camera.position.z;
  underwater.hidden = !(W?.key === 'hotel' && camera.position.y < -0.12 && bx > 5 && bx < 15 && by > 36 && by < 54);
}
function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  step(dt);
  const tp = applyThirdPerson(dt);
  if (!paused) composer.render();
  if (tp) { camera.position.copy(_eye); camera.updateMatrixWorld(); }
  const now = performance.now();
  if (collider && !switching && now - hudAt > 150) {
    hudAt = now;
    camera.getWorldDirection(camDir);
    const [zh, en] = locate();
    if (zh !== lastPlace) { placeZh.textContent = zh; placeEn.textContent = en; lastPlace = zh; }
    if (!map.parentElement.hidden) drawMap();
  }
  requestAnimationFrame(loop);
}

applyQuality();
let first = 'hotel';
try { first = localStorage.getItem('aurora-world-last') || first; } catch { }
if (WORLDS[location.hash.slice(1)]) first = location.hash.slice(1);
if (!WORLDS[first]) first = 'hotel';
loop();

if (renderer) enterWorld(first, false).then(() => {
  clearInterval(watchdog);
  intro.hidden = false;
  document.getElementById('intro-where').textContent = W.zh;
  // test hooks: advance the simulation without waiting for real frames
  const simulate = (code, seconds) => { keys.add(code); for (let t = 0; t < seconds; t += 1 / 60) update(1 / 60); keys.delete(code); return player.pos.clone(); };
  const advance = (seconds, fps = 30) => { for (let t = 0; t < seconds; t += 1 / fps) step(1 / fps); };
  window.__world = { findPath, blockedBetween, doors, toggleDoor, findDoor, sitNear, placeBeside, startCompanion, dismissCompanion, steps, get companion() { return companion; }, startOuting, useAvatar, AVATARS, POSES, view, get avatar() { return avatar; }, toggleView, applyThirdPerson, sit, SEATS: () => SEATS, sitDown, POSE, reposeNpcs, npcs, dialog, talkTo, chooseOpt, photo, startPhoto, shoot, endPhoto, setPose, doAct, patHead, looksAtHead, startGuide, directTrip, HOTEL_GUIDE, castHit, b2t, setCharacter, findNpc, onEscalator, openPortalMenu, worlds: WORLD_KEYS, scene, camera, player, teleport, get PLACES() { return PLACES; }, get W() { return W; }, renderer, simulate, advance, locate, rides, riding, lift, doAction, nearPortal: () => portalCand, warpTo, portalPlace, isSwitching: () => switching };
}).catch((err) => {
  console.error(err);
  fail(`載入失敗：${err.message}。若是直接開啟檔案，請改用本機伺服器（python3 -m http.server）。`);
});
