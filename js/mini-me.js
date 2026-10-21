// Mini-me: a rigged 3D version of Muzakkir, built from primitives and animated procedurally.
// One rig drives two stages: the big one in the hero and the small one that walks the page.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches && !/[?&]motion=1/.test(location.search);
const voice = () => window.__voice || { isTalking: () => false, level: () => 0, caption: () => '', toggle() {} };
const damp = (dt, rate) => 1 - Math.exp(-dt * rate);
const lerp = (a, b, k) => a + (b - a) * k;
function angleLerp(a, b, k) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; }

/* ---------------- the character ---------------- */
function stripes() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#f5f3ef'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#8796b8'; for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 2, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildCharacter() {
  const M = {
    suit: new THREE.MeshPhysicalMaterial({ color: 0x151d3b, roughness: .84, sheen: .6, sheenRoughness: .6, sheenColor: new THREE.Color(0x3b4a7a) }),
    lapel: new THREE.MeshStandardMaterial({ color: 0x172042, roughness: .55, side: THREE.DoubleSide }),
    shirt: new THREE.MeshStandardMaterial({ map: stripes(), roughness: .85, side: THREE.DoubleSide }),
    white: new THREE.MeshStandardMaterial({ color: 0xf5f3ef, roughness: .8, side: THREE.DoubleSide }),
    skin: new THREE.MeshStandardMaterial({ color: 0x9a6440, roughness: .55 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x100d0d, roughness: .88 }),
    beard: new THREE.MeshStandardMaterial({ color: 0x1b1512, roughness: .95 }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0x4a2c18, metalness: .25, roughness: .05, clearcoat: 1, clearcoatRoughness: .04, transparent: true, opacity: .92 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, metalness: .5, roughness: .22 }),
    shoe: new THREE.MeshStandardMaterial({ color: 0x1e2128, roughness: .3, metalness: .15 }),
    button: new THREE.MeshStandardMaterial({ color: 0x0d0e12, roughness: .25, metalness: .5 }),
    lips: new THREE.MeshStandardMaterial({ color: 0x6a3727, roughness: .55 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x1a0807, roughness: .9 }),
  };
  const G = () => new THREE.Group();
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };
  const capsule = (r, l) => new THREE.CapsuleGeometry(r, l, 8, 18);
  const shape = (pts) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => s.lineTo(p[0], p[1])); return new THREE.ShapeGeometry(s); };

  const root = G(), hips = G(); hips.position.y = .98; root.add(hips);
  const pelvis = mesh(new THREE.SphereGeometry(.145, 24, 16), M.suit, 0, -.03, 0); pelvis.scale.set(1.02, .72, .74); hips.add(pelvis);

  const legs = {};
  for (const s of [1, -1]) {
    const thigh = G(); thigh.position.set(.088 * s, -.05, 0); hips.add(thigh);
    thigh.add(mesh(new THREE.CylinderGeometry(.084, .07, .44, 20), M.suit, 0, -.215, 0));
    thigh.add(mesh(new THREE.SphereGeometry(.084, 20, 14), M.suit, 0, 0, 0));
    const knee = G(); knee.position.y = -.43; thigh.add(knee);
    knee.add(mesh(new THREE.SphereGeometry(.07, 18, 12), M.suit, 0, 0, 0));
    knee.add(mesh(new THREE.CylinderGeometry(.068, .062, .43, 20), M.suit, 0, -.21, 0));
    const ankle = G(); ankle.position.y = -.43; knee.add(ankle);
    const shoe = mesh(capsule(.052, .15), M.shoe, 0, -.022, .05); shoe.rotation.x = Math.PI / 2; shoe.scale.set(1.08, 1, .72); ankle.add(shoe);
    legs[s] = { thigh, knee, ankle };
  }

  const spine = G(); spine.position.y = .06; hips.add(spine);
  const chest = G(); chest.position.y = .2; spine.add(chest);
  // jacket: a lathed silhouette — flared hem, nipped waist, full chest, rounded shoulders
  const profile = [[.001, -.385], [.198, -.385], [.203, -.36], [.188, -.24], [.176, -.13], [.186, 0], [.205, .13], [.214, .24], [.208, .3], [.186, .345], [.15, .378], [.1, .4], [.06, .408], [.001, .41]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const jacket = mesh(new THREE.LatheGeometry(profile, 48), M.suit, 0, 0, 0); jacket.scale.set(1.04, 1, .64); chest.add(jacket);
  for (const s of [1, -1]) { const pad = mesh(new THREE.SphereGeometry(.075, 20, 14), M.suit, .19 * s, .3, 0); pad.scale.set(1, .85, .95); chest.add(pad); }
  const jacketBack = mesh(new THREE.SphereGeometry(.16, 24, 16), M.suit, 0, .08, -.02); jacketBack.scale.set(1.05, 1.9, .55); chest.add(jacketBack);
  const zf = .137; // front of the jacket
  const shirt = mesh(shape([[-.068, .4], [.068, .4], [0, .06]]), M.shirt, 0, 0, zf); chest.add(shirt);
  chest.add(mesh(shape([[-.07, .41], [-.012, .37], [-.045, .3]]), M.white, 0, 0, zf + .004));
  chest.add(mesh(shape([[.07, .41], [.012, .37], [.045, .3]]), M.white, 0, 0, zf + .004));
  chest.add(mesh(shape([[-.07, .41], [-.135, .3], [-.105, .28], [-.125, .24], [-.012, .02], [-.004, .06]]), M.lapel, 0, 0, zf + .006));
  chest.add(mesh(shape([[.07, .41], [.135, .3], [.105, .28], [.125, .24], [.012, .02], [.004, .06]]), M.lapel, 0, 0, zf + .006));
  for (const y of [-.03, -.11, -.19]) for (const x of [-.05, .05]) chest.add(mesh(new THREE.SphereGeometry(.011, 10, 8), M.button, x, y, zf - .002));
  chest.add(mesh(new THREE.CylinderGeometry(.05, .056, .1, 18), M.skin, 0, .41, 0));

  const neck = G(); neck.position.y = .44; chest.add(neck);
  const head = G(); neck.add(head);
  const skull = mesh(new THREE.SphereGeometry(.105, 40, 30), M.skin, 0, .12, 0); skull.scale.set(.93, 1.12, 1); head.add(skull);
  // full short beard wrapping the jaw, with a moustache
  const beard = mesh(new THREE.SphereGeometry(.101, 32, 20, 0, Math.PI * 2, Math.PI * .6, Math.PI * .4), M.beard, 0, .112, .006); beard.scale.set(.97, 1.08, 1.07); head.add(beard);
  const chin = mesh(new THREE.SphereGeometry(.04, 16, 12), M.beard, 0, .02, .07); chin.scale.set(1, 1, .9); head.add(chin);
  const stache = mesh(capsule(.012, .046), M.beard, 0, .074, .1); stache.rotation.z = Math.PI / 2; head.add(stache);
  const mouthHole = mesh(new THREE.SphereGeometry(.017, 16, 10), M.mouth, 0, .057, .104); mouthHole.scale.set(1.25, .2, .45); head.add(mouthHole);
  const lip = mesh(new THREE.SphereGeometry(.017, 16, 10), M.lips, 0, .049, .107); lip.scale.set(1.3, .34, .45); head.add(lip);
  const nose = mesh(new THREE.SphereGeometry(.017, 16, 12), M.skin, 0, .1, .106); nose.scale.set(.85, 1.1, 1.2); head.add(nose);
  const bridge = mesh(capsule(.011, .03), M.skin, 0, .118, .1); head.add(bridge);
  for (const s of [1, -1]) head.add(mesh(new THREE.SphereGeometry(.021, 12, 10), M.skin, .097 * s, .115, -.005));

  // hair: swept, messy, falling over the ears; forehead stays visible
  const crown = mesh(new THREE.SphereGeometry(.112, 30, 20), M.hair, 0, .185, -.024); crown.scale.set(1.13, .74, 1.1); head.add(crown);
  for (const s of [1, -1]) {
    const side = mesh(new THREE.SphereGeometry(.058, 16, 12), M.hair, .095 * s, .145, -.02); side.scale.set(.62, 1.35, 1.25); head.add(side);
    const lock = mesh(new THREE.ConeGeometry(.03, .1, 7), M.hair, .1 * s, .085, -.005); lock.rotation.set(.15, 0, -Math.PI + .25 * s); head.add(lock);
  }
  const back = mesh(new THREE.SphereGeometry(.1, 20, 14), M.hair, 0, .13, -.06); back.scale.set(1.08, 1.12, .82); head.add(back);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, el = .1 + rnd() * 1.15;
    const dir = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
    if (dir.z > .45 && dir.y < .55) continue; // keep the face clear
    const spike = mesh(new THREE.ConeGeometry(.024 + rnd() * .016, .07 + rnd() * .05, 6), M.hair);
    spike.position.set(dir.x * .1, .19 + dir.y * .07, -.02 + dir.z * .1);
    const tip = dir.clone().add(new THREE.Vector3((rnd() - .5) * .5, -.9 - rnd() * .5, -.2)).normalize();
    spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip); head.add(spike);
  }
  for (let i = 0; i < 7; i++) { // fringe swept to the sides
    const x = -.075 + i * .025, f = mesh(new THREE.ConeGeometry(.02, .08, 6), M.hair, x, .215, .07 - Math.abs(x) * .25);
    f.rotation.set(Math.PI * .7, 0, (x > 0 ? -1 : 1) * (.9 + rnd() * .3)); head.add(f);
  }

  // sunglasses: rounded-rectangle frames with tinted lenses
  const shades = G(); shades.position.set(0, .128, .1); head.add(shades);
  const rr = (w, h, r) => { const sh = new THREE.Shape(), x = -w / 2, y = -h / 2;
    sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y); return sh; };
  for (const s of [1, -1]) {
    const frame = mesh(new THREE.ExtrudeGeometry(rr(.05, .036, .012), { depth: .008, bevelEnabled: true, bevelSize: .003, bevelThickness: .002, bevelSegments: 2 }), M.frame, .044 * s, 0, 0);
    shades.add(frame);
    const lens = mesh(new THREE.ShapeGeometry(rr(.042, .028, .009)), M.lens, .044 * s, 0, .0115); shades.add(lens);
    const arm = mesh(new THREE.BoxGeometry(.006, .007, .11), M.frame, .072 * s + .02 * s, .008, -.05); shades.add(arm);
  }
  shades.add(mesh(new THREE.BoxGeometry(.02, .006, .008), M.frame, 0, .008, .004));

  // arms with hands; index finger extends when pointing
  const arms = {};
  for (const s of [1, -1]) {
    const sh = G(); sh.position.set(.215 * s, .3, 0); chest.add(sh);
    sh.add(mesh(new THREE.SphereGeometry(.064, 18, 12), M.suit, 0, 0, 0));
    sh.add(mesh(new THREE.CylinderGeometry(.062, .054, .3, 18), M.suit, 0, -.15, 0));
    const el = G(); el.position.y = -.3; sh.add(el);
    el.add(mesh(new THREE.SphereGeometry(.055, 16, 12), M.suit, 0, 0, 0));
    el.add(mesh(new THREE.CylinderGeometry(.053, .048, .25, 18), M.suit, 0, -.125, 0));
    el.add(mesh(new THREE.CylinderGeometry(.048, .048, .032, 18), M.white, 0, -.255, 0));
    const wr = G(); wr.position.y = -.27; el.add(wr);
    const palm = mesh(new THREE.SphereGeometry(.046, 18, 14), M.skin, 0, -.05, 0); palm.scale.set(.72, 1.15, .52); wr.add(palm);
    const thumb = mesh(capsule(.012, .03), M.skin, -.022 * s, -.035, .022); thumb.rotation.set(-.5, 0, .5 * s); wr.add(thumb);
    const finger = mesh(capsule(.0115, .06), M.skin, 0, -.115, .004); finger.visible = false; wr.add(finger);
    arms[s] = { sh, el, wr, finger };
  }
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, hips, spine, chest, neck, legs, arms, lip, mouthHole, shades };
}

/* ---------------- procedural animation ---------------- */
const STRIDE = .74;   // metres per step
const DOWN = new THREE.Vector3(0, -1, 0);
class Rig {
  constructor(c) { Object.assign(this, { c, phase: 0, t: 0, walk: 0, wave: 0, point: 0, talk: 0, open: 0, pointSide: -1, aim: new THREE.Vector3(0, -1, 0) }); this.q = new THREE.Quaternion(); this.qc = new THREE.Quaternion(); }
  advance(dist) { this.phase += dist / STRIDE * Math.PI; }
  shuffle(turn) { this.phase += Math.min(.25, Math.abs(turn) * 1.6); this.walk = Math.max(this.walk, Math.min(.45, Math.abs(turn) * 6)); }
  // aim at a world-space point with the arm on `side`
  aimAt(world, side) {
    this.pointSide = side;
    const sh = this.c.arms[side].sh, p = new THREE.Vector3();
    sh.getWorldPosition(p);
    const d = world.clone().sub(p).normalize();
    this.c.chest.getWorldQuaternion(this.qc);
    this.aim.copy(d.applyQuaternion(this.qc.invert())).normalize();
  }
  update(dt, s) {
    const c = this.c; this.t += dt; const t = this.t;
    this.walk = lerp(this.walk, s.walking ? 1 : 0, damp(dt, 7));
    this.wave = lerp(this.wave, s.waving ? 1 : 0, damp(dt, 7));
    this.point = lerp(this.point, s.pointing ? 1 : 0, damp(dt, 6));
    this.talk = lerp(this.talk, s.talking ? 1 : 0, damp(dt, 5));
    this.open = lerp(this.open, s.open || 0, damp(dt, 28));
    const w = this.walk, p = this.phase;

    // legs: thigh swing, knee flex in the swing phase, ankle keeps the sole level, toe-off at push
    for (const side of [1, -1]) {
      const L = c.legs[side], ph = p + (side > 0 ? 0 : Math.PI), sw = Math.sin(ph);
      const flex = Math.max(0, Math.cos(ph + .2));
      L.thigh.rotation.set(-.41 * sw * w - .02 * (1 - w), 0, .015 * side);
      L.knee.rotation.x = (.07 + .88 * flex * flex) * w + .05 * (1 - w);
      const push = Math.max(0, Math.sin(ph - .25) - .55) * 1.4;   // heel lifts as the leg trails (toe-off)
      const strike = Math.max(0, Math.sin(ph + .15) - .7) * 1.6;  // toes up as the heel lands
      const idleBend = (1 - w) * Math.max(0, Math.sin(t * .45 + (side > 0 ? 0 : Math.PI))) * .12; // weight shift
      L.knee.rotation.x += idleBend; L.thigh.rotation.x -= idleBend * .5;
      L.ankle.rotation.x = -(L.thigh.rotation.x + L.knee.rotation.x) * w - idleBend * .5 * (1 - w) + push * w * .9 - strike * w * .45;
    }
    // pelvis bobs twice per stride, rolls and twists; spine counter-rotates; head stays level
    const breathe = Math.sin(t * 1.6), shift = Math.sin(t * .45);
    const accel = this.accel || 0; // lean into starts, settle on stops
    c.hips.position.y = .98 - .03 * (1 - Math.cos(2 * p)) * .5 * w - .012 * (1 - w) + breathe * .002 * (1 - w);
    c.hips.position.x = shift * .022 * (1 - w);
    c.hips.rotation.set(0, -.13 * Math.sin(p) * w, .05 * Math.sin(p) * w + shift * .03 * (1 - w));
    c.spine.rotation.set(.045 * w + breathe * .012 + .015 + accel * .06, .2 * Math.sin(p - .15) * w, -.05 * Math.sin(p) * w - shift * .025 * (1 - w));
    c.chest.rotation.set(breathe * .008, .04 * Math.sin(p - .3) * w, -.02 * Math.sin(p - .2) * w);
    c.chest.scale.set(1 + breathe * .006 * (1 - w), 1, 1 + breathe * .01 * (1 - w));
    c.neck.rotation.set(-.05 * w + .012 * Math.cos(2 * p) * w - c.spine.rotation.x * .5 + (Math.sin(t * 3.1) * .05 + this.open * .1) * this.talk, -(c.hips.rotation.y + c.spine.rotation.y) * .9 + Math.sin(t * .9) * .05 * this.talk, Math.sin(t * 1.6) * .035 * this.talk);

    // arms: swing against the legs, relaxed elbows; then layer talk / wave / point on top
    for (const side of [1, -1]) {
      // arms trail the legs a little (follow-through), elbows bend more on the forward swing
      const A = c.arms[side], sp = Math.sin(p - .35), swing = .34 * side * sp * w;
      const lag = Math.sin(p - .9) * side;
      A.sh.rotation.set(swing + .03 + Math.sin(t * .8 + side) * .015 * (1 - w), side * .05 * w, .12 * side + shift * .02 * side * (1 - w));
      A.el.rotation.set(-(.22 + .32 * Math.max(0, -lag)) * w - .16 * (1 - w) - breathe * .01, 0, 0);
      A.wr.rotation.set(-.12 + lag * .08 * w, 0, -side * .1);
      A.finger.visible = false;
    }
    if (this.talk > .01) { // talking: right hand gestures, left hand relaxed forward
      const R = c.arms[-1], k = this.talk;
      R.sh.rotation.x = lerp(R.sh.rotation.x, -.42 + Math.sin(t * 2.3) * .14, k);
      R.sh.rotation.z = lerp(R.sh.rotation.z, -.22, k);
      R.el.rotation.x = lerp(R.el.rotation.x, -1.25 + Math.sin(t * 3.4) * .22 - this.open * .2, k);
      R.wr.rotation.z = lerp(0, Math.sin(t * 2.9) * .4, k);
      const Lf = c.arms[1];
      Lf.el.rotation.x = lerp(Lf.el.rotation.x, -.55 + Math.sin(t * 1.9 + 1) * .12, k * .7);
    }
    if (this.wave > .01) { // wave with the right hand
      const R = c.arms[-1], k = this.wave;
      R.sh.rotation.x = lerp(R.sh.rotation.x, -.25, k);
      R.sh.rotation.z = lerp(R.sh.rotation.z, -2.55, k);
      R.el.rotation.x = lerp(R.el.rotation.x, 0, k);
      R.el.rotation.z = lerp(0, -.55 + Math.sin(t * 11) * .5, k);
      R.wr.rotation.x = lerp(R.wr.rotation.x, 0, k);
      c.neck.rotation.z += .06 * k;
    }
    if (this.point > .01) { // straight arm aimed at the target, index finger out
      const A = c.arms[this.pointSide], k = this.point;
      this.q.setFromUnitVectors(DOWN, this.aim);
      A.sh.quaternion.slerp(this.q, k);
      A.el.rotation.x = lerp(A.el.rotation.x, -.06, k); A.el.rotation.z = 0;
      A.wr.rotation.x = lerp(A.wr.rotation.x, 0, k);
      A.finger.visible = k > .55;
      c.neck.rotation.y += this.pointSide * -.25 * k;
    }
    c.mouthHole.scale.y = .2 + this.open * 1.25;
    c.lip.position.y = .049 - this.open * .012;
  }
}

/* ---------------- shared renderer setup ---------------- */
function makeStage(canvas, opts) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, opts.maxDpr || 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(renderer), .04).texture;
  scene.add(new THREE.HemisphereLight(0xd8fbff, 0x0a1426, .55));
  const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(2.5, 5, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 2.5, bottom: -.5, near: .5, far: 15 }); key.shadow.bias = -.0005;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x5eead4, 1.5); rim.position.set(-3, 3, -3); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xa78bfa, .8); rim2.position.set(3, 2, -3); scene.add(rim2);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: opts.shadow ?? .35 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const camera = new THREE.PerspectiveCamera(opts.fov, 1, .1, 100);
  camera.position.copy(opts.cam); camera.lookAt(opts.look);
  const c = buildCharacter(); scene.add(c.root);
  const rig = new Rig(c);
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);
  return { renderer, scene, camera, key, c, rig, resize };
}

function webglOK() { try { const x = document.createElement('canvas'); return !!(x.getContext('webgl2') || x.getContext('webgl')); } catch (e) { return false; } }

/* ---------------- hero: big version walking on the runway ---------------- */
const heroCanvas = document.getElementById('hero3d');
const hero = document.getElementById('hero');
if (!heroCanvas) {
  // imported by a test page
} else if (!webglOK()) {
  document.documentElement.classList.add('no3d');
} else {
  document.documentElement.classList.add('has3d');
  const H = makeStage(heroCanvas, { fov: 26, cam: new THREE.Vector3(.35, 1.2, 5.2), look: new THREE.Vector3(0, .98, 0), shadow: .4 });
  H.c.root.rotation.y = -.5;
  let heroVisible = true, waveUntil = 0, last = performance.now(), booted = false;
  const startWave = () => { waveUntil = performance.now() + 2600; };
  const boot = document.getElementById('boot');
  const waitBoot = () => { if (!boot || boot.style.display === 'none' || boot.classList.contains('done')) { booted = true; setTimeout(startWave, 300); } else setTimeout(waitBoot, 200); };
  waitBoot();
  heroCanvas.addEventListener('click', () => voice().toggle());
  heroCanvas.addEventListener('pointerenter', () => { if (!voice().isTalking()) startWave(); });

  /* ---------------- walker: small version along the bottom of the screen ---------------- */
  const wCanvas = document.getElementById('walk3d'), hit = document.getElementById('w-hit'), bubble = document.getElementById('w-bubble');
  const walkway = document.getElementById('walkway'), beam = document.getElementById('beam'), bLine = document.getElementById('beam-line'), bDot = document.getElementById('beam-dot');
  const Wl = makeStage(wCanvas, { fov: 20, cam: new THREE.Vector3(0, 1.95, 12), look: new THREE.Vector3(0, 1.6, 0), shadow: .45, maxDpr: 1.5 });
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), ndc = new THREE.Vector2(), tmp = new THREE.Vector3();
  function screenToWorld(sx, sy) { // a page point (CSS px) -> the character's z=0 plane
    const r = wCanvas.getBoundingClientRect();
    ndc.set((sx - r.left) / r.width * 2 - 1, -((sy - r.top) / r.height * 2 - 1));
    ray.setFromCamera(ndc, Wl.camera); const out = new THREE.Vector3(); ray.ray.intersectPlane(plane, out); return out;
  }
  function worldToScreen(v) { const r = wCanvas.getBoundingClientRect(); tmp.copy(v).project(Wl.camera); return { x: r.left + (tmp.x + 1) / 2 * r.width, y: r.top + (1 - tmp.y) / 2 * r.height }; }
  function edgeX() { const r = wCanvas.getBoundingClientRect(); return [screenToWorld(r.left + 40, r.bottom - 10).x, screenToWorld(r.right - 40, r.bottom - 10).x]; }

  const TARGETS = [
    ['.flow', "This pipeline? I broke it 8 times on purpose."],
    ['.incident', "A bug that never crashed. The scariest kind."],
    ['.decisions', "Idempotent loads: re-run anything, safely."],
    ['#work ul:first-of-type li:first-child .figs', "20 hours down to under 2. Proud of that one."],
    ['#work ul:first-of-type li:nth-child(2)', "I built an OCR tool so nobody types receipts again."],
    ['#work ul:last-of-type li:nth-child(1)', "13 microservices on EKS, shipped with GitOps."],
    ['#work ul:last-of-type li:nth-child(3)', "Quality gates: 40% less tech debt."],
    ['#work ul:last-of-type li:nth-child(4)', "My MSc: an LSTM that sees a fight coming."],
    ['#work ul:last-of-type li:nth-child(5)', "AI with 4 fallbacks. It never goes dark."],
    ['.wrap > section:nth-of-type(3) .tools', "My everyday toolkit: data, cloud, DevOps, AI."],
    ['.wrap > section:nth-of-type(4) .tools', "Google Cloud certified. AWS is next."],
    ['.contact .links', "Go on, say hi 👋"]
  ].map(([sel, text]) => ({ el: document.querySelector(sel), text })).filter(t => t.el);

  const S = { x: -9, yaw: Math.PI / 2, state: 'enter', goal: 0, wait: 0, target: null, recent: [], shown: false, greeted: false, waveUntil: 0 };
  let heroShown = true, sayTimer = 0, pointedEl = null;
  const inView = el => { const r = el.getBoundingClientRect(); return r.height > 0 && r.bottom > innerHeight * .08 && r.top < innerHeight - wCanvas.clientHeight * .6; };
  function say(text, ms) { bubble.textContent = text; bubble.classList.add('on'); clearTimeout(sayTimer); if (ms) sayTimer = setTimeout(() => bubble.classList.remove('on'), ms); }
  function beamOff() { beam.classList.remove('on'); if (pointedEl) { pointedEl.classList.remove('pointed'); pointedEl = null; } }
  function pick() {
    const c = TARGETS.filter(t => inView(t.el) && !S.recent.includes(t.el));
    if (!c.length) { S.recent = S.recent.slice(-1); return null; }
    return c[0];
  }
  hit.addEventListener('click', () => voice().toggle());

  const fingerTip = new THREE.Vector3(), headTop = new THREE.Vector3(), feet = new THREE.Vector3();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (document.hidden) return;
    const v = voice(), talking = v.isTalking(), open = v.level();
    const hr = hero.getBoundingClientRect(), cr = heroCanvas.getBoundingClientRect();
    heroShown = hr.bottom > innerHeight * .4; heroVisible = cr.bottom > 0 && cr.top < innerHeight;

    // ----- hero stage -----
    if (heroVisible) {
      const waving = now < waveUntil && !talking;
      const walking = !waving && !talking && !reduced;
      if (walking) H.rig.advance(1.25 * dt); // walking in place on the runway
      H.c.root.rotation.y = angleLerp(H.c.root.rotation.y, talking || waving ? -.12 : -.5, damp(dt, 3));
      H.rig.update(dt, { walking, waving, talking, open });
      H.renderer.render(H.scene, H.camera);
    }

    // ----- walker -----
    const show = !heroShown;
    if (show !== S.shown) {
      S.shown = show; wCanvas.classList.toggle('on', show); walkway.classList.toggle('on', show); hit.classList.toggle('on', show);
      if (!show) { beamOff(); bubble.classList.remove('on'); S.state = 'enter'; }
      else if (!S.greeted) { S.greeted = true; S.x = edgeX()[0] - 1.2; S.state = 'enter'; }
    }
    if (!show) return;
    const [minX, maxX] = edgeX();
    let walking = false, pointing = false, waving = now < S.waveUntil;
    if (talking) {
      beamOff(); S.state = 'idle'; S.wait = 1.2;
      const cap = v.caption(); if (bubble.textContent !== cap) bubble.textContent = cap; bubble.classList.toggle('on', !!cap);
      S.yaw = angleLerp(S.yaw, 0, damp(dt, 4));
    } else if (S.state === 'enter') {
      S.goal = Math.min(maxX, minX + 1.4); S.state = 'walk'; S.target = null; S.greet = true;
    } else if (S.state === 'idle') {
      S.wait -= dt; S.yaw = angleLerp(S.yaw, 0, damp(dt, 3));
      if (S.wait <= 0) {
        const t = pick();
        if (t) {
          const r = t.el.getBoundingClientRect(), cx = r.left + r.width / 2;
          const right = cx > innerWidth / 2, standX = cx + (right ? -1 : 1) * Math.min(150, r.width / 2 + 30);
          S.goal = Math.max(minX, Math.min(maxX, screenToWorld(standX, innerHeight - 20).x)); S.target = t;
        } else { S.goal = lerp(minX, maxX, Math.random()); S.target = null; }
        S.state = 'walk';
      }
    } else if (S.state === 'walk') {
      if (S.target && !inView(S.target.el)) { S.target = null; S.state = 'idle'; S.wait = .3; }
      const d = S.goal - S.x, dir = Math.sign(d);
      S.yaw = angleLerp(S.yaw, dir * Math.PI / 2, damp(dt, 9));
      const facing = Math.abs(Math.abs(S.yaw) - Math.PI / 2) < .5;
      if (Math.abs(d) < .03 || reduced) {
        S.x = S.goal; S.spd = 0; Wl.rig.accel = 0;
        if (S.greet) { S.greet = false; S.waveUntil = now + 2400; say("Hey! I'm mini Muzakkir. Let me show you around 👋", 3200); S.state = 'idle'; S.wait = 2.6; }
        else if (S.target) { S.state = 'point'; S.wait = 3.8; S.recent.push(S.target.el); if (S.recent.length > 6) S.recent.shift(); say(S.target.text, 3800); }
        else { S.state = 'idle'; S.wait = 1.4 + Math.random() * 2.4; }
      } else if (facing) {
        const want = Math.min(1.4, Math.abs(d) * 1.5 + .2);           // slow down as he arrives
        const prev = S.spd || 0; S.spd = lerp(prev, want, damp(dt, 2.5)); // and ease in when he sets off
        Wl.rig.accel = Math.max(-1, Math.min(1, (S.spd - prev) / Math.max(dt, .001) * .35));
        const step = Math.min(Math.abs(d), S.spd * dt); S.x += dir * step; Wl.rig.advance(step); walking = true;
      }
    } else if (S.state === 'point') {
      const r = S.target.el.getBoundingClientRect();
      const me = worldToScreen(new THREE.Vector3(S.x, 1.5, 0));
      let tx = Math.max(r.left + 16, Math.min(r.right - 16, me.x)), ty = Math.max(r.top + 16, Math.min(r.bottom - 16, me.y - 140));
      if (Math.abs(tx - me.x) < 60) { tx = r.left + r.width * (me.x > innerWidth / 2 ? .35 : .65); ty = r.top + Math.min(40, r.height / 4); }
      const side = tx < me.x ? -1 : 1;           // screen side of the target
      S.yaw = angleLerp(S.yaw, side * .55, damp(dt, 5));
      const armSide = side < 0 ? -1 : 1;         // character's right arm is on screen-left when facing us
      Wl.rig.aimAt(screenToWorld(tx, ty).setZ(2.5), armSide);
      pointing = true;
      // beam from the fingertip
      Wl.c.arms[armSide].finger.getWorldPosition(fingerTip);
      const f = worldToScreen(fingerTip);
      bLine.setAttribute('x1', f.x.toFixed(1)); bLine.setAttribute('y1', f.y.toFixed(1));
      bLine.setAttribute('x2', tx.toFixed(1)); bLine.setAttribute('y2', ty.toFixed(1));
      bDot.setAttribute('cx', tx.toFixed(1)); bDot.setAttribute('cy', ty.toFixed(1));
      if (Wl.rig.point > .8) beam.classList.add('on');
      if (pointedEl !== S.target.el) { if (pointedEl) pointedEl.classList.remove('pointed'); pointedEl = S.target.el; pointedEl.classList.add('pointed'); }
      S.wait -= dt;
      if (S.wait <= 0 || !inView(S.target.el)) { beamOff(); bubble.classList.remove('on'); S.target = null; S.state = 'idle'; S.wait = .7 + Math.random() * .9; }
    }
    if (S.state !== 'point') beamOff();

    const turn = S.yaw - (S.lastYaw ?? S.yaw); S.lastYaw = S.yaw;
    if (!walking && Math.abs(turn) > .002 && !reduced) Wl.rig.shuffle(turn);
    if (!walking) Wl.rig.accel = lerp(Wl.rig.accel || 0, 0, damp(dt, 4));
    Wl.c.root.position.x = S.x; Wl.c.root.rotation.y = S.yaw;
    Wl.key.position.set(S.x + 2.5, 5, 4); Wl.key.target.position.set(S.x, 1, 0);
    Wl.rig.update(dt, { walking, waving, pointing, talking, open });
    Wl.renderer.render(Wl.scene, Wl.camera);

    // place the speech bubble above his head and the tap target over his body
    Wl.c.neck.getWorldPosition(headTop); headTop.y += .42;
    const hp = worldToScreen(headTop); feet.set(S.x, 0, 0); const fp = worldToScreen(feet);
    const bw = bubble.offsetWidth, bx = Math.max(8, Math.min(innerWidth - bw - 8, hp.x - bw / 2));
    bubble.style.transform = `translate(${bx.toFixed(1)}px, ${(hp.y - bubble.offsetHeight - 6).toFixed(1)}px)`;
    const hh = fp.y - hp.y + 30;
    hit.style.transform = `translate(${(fp.x - hh * .2).toFixed(1)}px, ${(hp.y - 10).toFixed(1)}px)`; hit.style.width = (hh * .4).toFixed(0) + 'px'; hit.style.height = hh.toFixed(0) + 'px';
  }
  requestAnimationFrame(tick);
}

export { buildCharacter, Rig, makeStage };
