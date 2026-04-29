/* ============================================================
   KREW — Landing Page: Three.js Bloom Scene (antigravity-level)
   UnrealBloomPass + holographic card shaders + particle web
   ============================================================ */

import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';
import { getSiteStats }    from './db.js';

/* ========================
   MOBILE DETECTION
   ======================== */
const isMobile = window.innerWidth < 768;
const isTablet = window.innerWidth < 1024;

/* ========================
   RENDERER
   ======================== */
const canvas   = document.getElementById('bg-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping      = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 32);

/* ========================
   BLOOM POST-PROCESSING
   ======================== */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  isMobile ? 1.2 : 1.8,   // strength
  0.6,                      // radius
  0.0                       // threshold — bloom everything bright
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

/* ========================
   NEBULA BACKGROUND SHADER
   ======================== */
const nebulaMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime:       { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec2  uResolution;
    varying vec2  vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1,0)), f.x),
        mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
        f.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for(int i = 0; i < 5; i++) {
        v += a * noise(p);
        p  = p * 2.1 + vec2(1.7, 9.2);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = vUv;
      float t = uTime * 0.04;

      // Nebula clouds
      float n1 = fbm(uv * 2.5 + vec2(t, t * 0.7));
      float n2 = fbm(uv * 3.0 - vec2(t * 0.8, t));
      float n3 = fbm(uv * 1.8 + vec2(0.5, t * 0.5));

      // Purple/violet nebula
      vec3 purple = vec3(0.28, 0.05, 0.55) * pow(n1, 1.8) * 0.7;
      // Cyan nebula
      vec3 cyan   = vec3(0.0,  0.35, 0.6)  * pow(n2, 2.2) * 0.5;
      // Pink accent
      vec3 pink   = vec3(0.5,  0.05, 0.28) * pow(n3, 2.5) * 0.4;

      vec3 col = purple + cyan + pink;

      // Vignette
      float vignette = 1.0 - length(uv - 0.5) * 1.4;
      vignette = clamp(vignette, 0.0, 1.0);
      col *= vignette;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
  depthWrite: false,
  depthTest:  false,
});

const nebulaPlane = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), nebulaMat);
nebulaPlane.position.z = -50;
scene.add(nebulaPlane);

/* ========================
   LIGHTS
   ======================== */
scene.add(new THREE.AmbientLight(0x1a0040, 1.5));

const mouseLight = new THREE.PointLight(0x9D4EDD, 6, 80);
mouseLight.position.set(0, 0, 15);
scene.add(mouseLight);

const cyanLight = new THREE.PointLight(0x00D5FF, 3, 60);
cyanLight.position.set(-20, 12, 5);
scene.add(cyanLight);

const pinkLight = new THREE.PointLight(0xFF2D78, 2, 50);
pinkLight.position.set(20, -10, 3);
scene.add(pinkLight);

/* ========================
   HOLOGRAPHIC CARD SHADER
   ======================== */
function makeHoloMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:  { value: 0 },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = viewPos.xyz;
        gl_Position = projectionMatrix * viewPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3  uColor;
      varying vec2  vUv;
      varying vec3  vNormal;
      varying vec3  vViewPos;

      void main() {
        // Edge glow
        float ex = min(vUv.x, 1.0 - vUv.x);
        float ey = min(vUv.y, 1.0 - vUv.y);
        float edge = 1.0 - smoothstep(0.0, 0.055, min(ex, ey));

        // Corner hotspots
        float cx = step(0.88, max(vUv.x, 1.0 - vUv.x));
        float cy = step(0.88, max(vUv.y, 1.0 - vUv.y));
        float corner = cx * cy;

        // Moving scan line
        float scan = pow(sin((vUv.y + uTime * 0.07) * 55.0) * 0.5 + 0.5, 12.0) * 0.45;

        // Subtle interior grid
        float gx = 1.0 - smoothstep(0.9, 1.0, abs(sin(vUv.x * 12.0)));
        float gy = 1.0 - smoothstep(0.9, 1.0, abs(sin(vUv.y *  7.0)));
        float grid = gx * gy * 0.06;

        // Fresnel
        vec3 viewDir  = normalize(-vViewPos);
        float fresnel = 1.0 - abs(dot(vNormal, viewDir));
        fresnel = pow(fresnel, 1.8) * 0.4;

        // Breathing pulse
        float pulse = sin(uTime * 1.4) * 0.5 + 0.5;

        float alpha = edge * 0.95 + corner * 0.9 + scan + grid + fresnel + 0.025;
        alpha = clamp(alpha, 0.0, 0.98);

        // Whiter on edges/corners
        vec3 col = mix(uColor, vec3(1.0), (edge * 0.5 + corner * 0.4) * (0.7 + pulse * 0.3));

        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite:  false,
    side:        THREE.DoubleSide,
    blending:    THREE.AdditiveBlending,
  });
}

/* ========================
   GLOW ORBS SHADER
   ======================== */
function makeOrbMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    wireframe:  true,
    transparent: true,
    opacity:    0.9,
    blending:   THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/* ========================
   FLOATING OBJECTS
   ======================== */
const objects = [];
const objCount = isMobile ? 14 : 30;

const holoColors = [0x9D4EDD, 0xC77DFF, 0x00B4D8, 0x48CAE4, 0xFF006E, 0xFB5607, 0x8338EC, 0x3A86FF];

function createObject(type, index) {
  let geo, mat;
  const color = holoColors[index % holoColors.length];
  const scale = isMobile ? 0.6 : 1.0;

  if (type === 'card') {
    const w = (2.8 + Math.random() * 1.6) * scale;
    const h = (1.8 + Math.random() * 0.8) * scale;
    geo = new THREE.BoxGeometry(w, h, 0.05);
    mat = makeHoloMaterial(color);
  } else if (type === 'orb') {
    geo = new THREE.IcosahedronGeometry((0.7 + Math.random() * 0.5) * scale, 1);
    mat = makeOrbMaterial(new THREE.Color(color));
  } else if (type === 'ring') {
    geo = new THREE.TorusGeometry((0.8 + Math.random() * 0.4) * scale, 0.04 * scale, 8, 32);
    mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  } else {
    // Torus knot
    geo = new THREE.TorusKnotGeometry(0.5 * scale, 0.1 * scale, 60, 8);
    mat = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  const mesh = new THREE.Mesh(geo, mat);

  // Distribute in a toroid around the hero
  const angle  = (index / objCount) * Math.PI * 2 + Math.random() * 0.4;
  const radius = (isMobile ? 9 : 13) + Math.random() * (isMobile ? 7 : 10);
  const spread = isMobile ? 0.5 : 0.65;

  mesh.position.set(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius * spread + (Math.random() - 0.5) * 4,
    (Math.random() - 0.5) * (isMobile ? 8 : 14)
  );
  mesh.rotation.set(
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2
  );

  scene.add(mesh);

  return {
    mesh,
    velocity:  new THREE.Vector3((Math.random() - 0.5) * 0.018, (Math.random() - 0.5) * 0.014, 0),
    rotSpeed:  new THREE.Vector3((Math.random() - 0.5) * 0.008, (Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.005),
    origin:    mesh.position.clone(),
    mass:      0.7 + Math.random() * 0.8,
    type,
  };
}

// Spawn types in proportion
const typeList = [];
for (let i = 0; i < objCount; i++) {
  if (i < objCount * 0.4)      typeList.push('card');
  else if (i < objCount * 0.65) typeList.push('orb');
  else if (i < objCount * 0.85) typeList.push('ring');
  else                           typeList.push('knot');
}
typeList.forEach((t, i) => objects.push(createObject(t, i)));

/* ========================
   PARTICLE WEB (dots + lines)
   ======================== */
const PARTICLE_COUNT = isMobile ? 2500 : 7000;
const LINE_THRESHOLD  = isMobile ? 6 : 8;
const MAX_LINES       = isMobile ? 200 : 600;

// Particle positions
const pPositions = new Float32Array(PARTICLE_COUNT * 3);
const pColors    = new Float32Array(PARTICLE_COUNT * 3);
const pSizes     = new Float32Array(PARTICLE_COUNT);

const pPalette = [
  new THREE.Color(0x9D4EDD),
  new THREE.Color(0xC77DFF),
  new THREE.Color(0x00B4D8),
  new THREE.Color(0xFF006E),
  new THREE.Color(0x48CAE4),
];

for (let i = 0; i < PARTICLE_COUNT; i++) {
  const r    = 35 + Math.random() * 55;
  const th   = Math.random() * Math.PI * 2;
  const ph   = Math.acos(2 * Math.random() - 1);
  pPositions[i * 3]     = r * Math.sin(ph) * Math.cos(th);
  pPositions[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
  pPositions[i * 3 + 2] = r * Math.cos(ph);
  const c = pPalette[Math.floor(Math.random() * pPalette.length)];
  pColors[i * 3]     = c.r;
  pColors[i * 3 + 1] = c.g;
  pColors[i * 3 + 2] = c.b;
  pSizes[i] = Math.random() * 2.4 + 0.4;
}

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
particleGeo.setAttribute('color',    new THREE.BufferAttribute(pColors, 3));
particleGeo.setAttribute('pSize',    new THREE.BufferAttribute(pSizes,  1));

const particleMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
  vertexShader: `
    attribute float pSize;
    attribute vec3  color;
    varying vec3    vColor;
    uniform float   uTime;
    uniform float   uPixelRatio;

    void main() {
      vColor = color;
      vec3 pos = position;
      pos.y += sin(uTime * 0.25 + position.x * 0.04) * 1.0;
      pos.x += cos(uTime * 0.20 + position.z * 0.03) * 0.8;
      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      gl_Position  = projectionMatrix * mv;
      gl_PointSize = pSize * uPixelRatio * (180.0 / -mv.z);
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = 1.0 - smoothstep(0.15, 0.5, d);
      gl_FragColor = vec4(vColor, a * 0.85);
    }
  `,
  transparent: true,
  depthWrite:  false,
  blending:    THREE.AdditiveBlending,
  vertexColors: true,
});

const particleMesh = new THREE.Points(particleGeo, particleMat);
scene.add(particleMesh);

// Line web between nearby particles (sample subset for performance)
const lineSampleCount = isMobile ? 300 : 800;
const linePositions   = new Float32Array(MAX_LINES * 6);
const lineColors      = new Float32Array(MAX_LINES * 6);

const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
lineGeo.setAttribute('color',    new THREE.BufferAttribute(lineColors,    3).setUsage(THREE.DynamicDrawUsage));

const lineMat = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.25,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
scene.add(lineSegments);

let lineCount = 0;

function updateLines() {
  lineCount = 0;
  const pos = particleGeo.attributes.position.array;

  for (let i = 0; i < lineSampleCount && lineCount < MAX_LINES; i++) {
    const ai = Math.floor(Math.random() * PARTICLE_COUNT);
    const ax = pos[ai * 3], ay = pos[ai * 3 + 1], az = pos[ai * 3 + 2];

    for (let j = i + 1; j < lineSampleCount && lineCount < MAX_LINES; j++) {
      const bi = Math.floor(Math.random() * PARTICLE_COUNT);
      const dx = ax - pos[bi * 3], dy = ay - pos[bi * 3 + 1], dz = az - pos[bi * 3 + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < LINE_THRESHOLD) {
        const lf = lineCount * 6;
        const alpha = (1 - dist / LINE_THRESHOLD);
        const c = pPalette[Math.floor(Math.random() * pPalette.length)];

        linePositions[lf]     = ax; linePositions[lf + 1] = ay; linePositions[lf + 2] = az;
        linePositions[lf + 3] = pos[bi * 3]; linePositions[lf + 4] = pos[bi * 3 + 1]; linePositions[lf + 5] = pos[bi * 3 + 2];

        lineColors[lf]     = c.r * alpha; lineColors[lf + 1] = c.g * alpha; lineColors[lf + 2] = c.b * alpha;
        lineColors[lf + 3] = c.r * alpha; lineColors[lf + 4] = c.g * alpha; lineColors[lf + 5] = c.b * alpha;

        lineCount++;
        break;
      }
    }
  }

  lineGeo.attributes.position.needsUpdate = true;
  lineGeo.attributes.color.needsUpdate    = true;
  lineGeo.setDrawRange(0, lineCount * 2);
}

/* ========================
   CURSOR TRAIL
   ======================== */
const TRAIL_COUNT   = isMobile ? 0 : 30;
const trailParticles = [];

if (!isMobile) {
  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array(TRAIL_COUNT * 3);
  const trailAlpha = new Float32Array(TRAIL_COUNT);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeo.setAttribute('opacity',  new THREE.BufferAttribute(trailAlpha, 1).setUsage(THREE.DynamicDrawUsage));

  const trailMat = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: `
      attribute float opacity;
      varying float vOpacity;
      void main() {
        vOpacity = opacity;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position  = projectionMatrix * mv;
        gl_PointSize = 4.0 * (100.0 / -mv.z);
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = (1.0 - smoothstep(0.0, 0.5, d)) * vOpacity;
        gl_FragColor = vec4(0.7, 0.3, 1.0, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const trailPoints = new THREE.Points(trailGeo, trailMat);
  scene.add(trailPoints);

  for (let i = 0; i < TRAIL_COUNT; i++) {
    trailParticles.push({
      pos:   new THREE.Vector3(0, 0, 10),
      alpha: 0,
      targetAlpha: 0,
    });
  }

  // Update trail function
  let trailHead = 0;
  window._updateTrail = (mx3, my3) => {
    trailHead = (trailHead + 1) % TRAIL_COUNT;
    trailParticles[trailHead].pos.set(mx3, my3, 10);
    trailParticles[trailHead].alpha = 1.0;

    for (let i = 0; i < TRAIL_COUNT; i++) {
      const p = trailParticles[i];
      p.alpha *= 0.88;
      trailPos[i * 3]     = p.pos.x;
      trailPos[i * 3 + 1] = p.pos.y;
      trailPos[i * 3 + 2] = p.pos.z;
      trailAlpha[i] = p.alpha;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.opacity.needsUpdate  = true;
  };
}

/* ========================
   MOUSE TRACKING
   ======================== */
const mouse3D     = new THREE.Vector3();
const mouseNDC    = new THREE.Vector2(0, 0);
const mousePlane  = new THREE.Plane(new THREE.Vector3(0, 0, 1), -8);
const raycaster   = new THREE.Raycaster();

canvas.addEventListener('mousemove', (e) => {
  mouseNDC.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);
  raycaster.ray.intersectPlane(mousePlane, mouse3D);
  if (window._updateTrail) window._updateTrail(mouse3D.x, mouse3D.y);
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  mouseNDC.x =  (t.clientX / window.innerWidth)  * 2 - 1;
  mouseNDC.y = -(t.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);
  raycaster.ray.intersectPlane(mousePlane, mouse3D);
}, { passive: true });

/* Click / tap burst */
function burst() {
  objects.forEach(obj => {
    const dir  = obj.mesh.position.clone().sub(mouse3D).normalize();
    const dist = obj.mesh.position.distanceTo(mouse3D);
    const f    = Math.max(0, 10 - dist) * 0.18;
    obj.velocity.addScaledVector(dir, f / obj.mass);
  });
}
canvas.addEventListener('click',      burst);
canvas.addEventListener('touchstart', burst, { passive: true });

/* ========================
   ANIMATION LOOP
   ======================== */
const clock = new THREE.Clock();
let lineUpdateTimer = 0;

function animate() {
  requestAnimationFrame(animate);

  const time  = clock.getElapsedTime();
  const delta = Math.min(clock.getDelta(), 0.05);

  // Update nebula
  nebulaMat.uniforms.uTime.value = time;

  // Update particles
  particleMat.uniforms.uTime.value = time;
  particleMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  particleMesh.rotation.y = time * 0.006;
  particleMesh.rotation.x = time * 0.003;

  // Update line web every N frames
  lineUpdateTimer += delta;
  if (lineUpdateTimer > 0.08) {
    updateLines();
    lineUpdateTimer = 0;
  }

  // Update holo card uniforms
  objects.forEach(obj => {
    if (obj.mesh.material.uniforms?.uTime) {
      obj.mesh.material.uniforms.uTime.value = time;
    }
  });

  // Physics
  objects.forEach(obj => {
    const { mesh, velocity, rotSpeed, origin, mass } = obj;

    // Mouse repulsion (strong!)
    const toMouse = mesh.position.clone().sub(mouse3D);
    const dist    = toMouse.length();
    if (dist < 16) {
      const rep = (16 - dist) / 16;
      velocity.addScaledVector(toMouse.normalize(), rep * rep * 0.06 / mass);
    }

    // Return to home zone
    const fromOrigin = mesh.position.distanceTo(origin);
    if (fromOrigin > 10) {
      const pullDir = origin.clone().sub(mesh.position).normalize();
      velocity.addScaledVector(pullDir, 0.004 * fromOrigin / mass);
    }

    // Micro drift
    velocity.x += (Math.random() - 0.5) * 0.0008;
    velocity.y += (Math.random() - 0.5) * 0.0008;

    // Damping
    velocity.multiplyScalar(0.975);

    // Integrate
    mesh.position.addScaledVector(velocity, 1);

    // Rotation
    mesh.rotation.x += rotSpeed.x;
    mesh.rotation.y += rotSpeed.y;
    mesh.rotation.z += rotSpeed.z;

    // Gentle bob
    mesh.position.y += Math.sin(time * 0.4 + mesh.position.x * 0.1) * 0.004;
  });

  // Camera parallax (subtle)
  camera.position.x += (mouseNDC.x * 1.8 - camera.position.x) * 0.025;
  camera.position.y += (mouseNDC.y * 1.0 - camera.position.y) * 0.025;
  camera.lookAt(0, 0, 0);

  // Mouse light follows cursor
  mouseLight.position.lerp(new THREE.Vector3(mouse3D.x, mouse3D.y, 14), 0.1);

  // Render via composer (bloom)
  composer.render();
}
animate();

/* ========================
   RESIZE
   ======================== */
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  composer.setSize(w, h);
  bloomPass.resolution.set(w, h);
  nebulaMat.uniforms.uResolution.value.set(w, h);
  particleMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
});

/* ========================
   GSAP SCROLL ANIMATIONS
   ======================== */
if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);

  gsap.utils.toArray('.demo-squad-card').forEach((el, i) => {
    gsap.from(el, {
      scrollTrigger: { trigger: '#section-squads', start: 'top 75%', toggleActions: 'play none none reverse' },
      x: i % 2 === 0 ? -80 : 80, opacity: 0, duration: 0.8, delay: i * 0.15, ease: 'back.out(1.5)',
    });
  });

  gsap.utils.toArray('.demo-product-card').forEach((el, i) => {
    gsap.from(el, {
      scrollTrigger: { trigger: '#section-marketplace', start: 'top 75%', toggleActions: 'play none none reverse' },
      scale: 0.7, opacity: 0, duration: 0.6, delay: i * 0.1, ease: 'back.out(1.8)',
    });
  });

  gsap.utils.toArray('.feature-card').forEach((el, i) => {
    gsap.from(el, {
      scrollTrigger: { trigger: '#section-how', start: 'top 75%', toggleActions: 'play none none reverse' },
      y: 50, opacity: 0, duration: 0.7, delay: i * 0.18, ease: 'power3.out',
    });
  });

  gsap.from('#cta-btn', {
    scrollTrigger: { trigger: '#section-cta', start: 'top 80%', toggleActions: 'play none none reverse' },
    scale: 0.6, opacity: 0, duration: 1.0, ease: 'elastic.out(1, 0.5)',
  });

  gsap.from('#stats-row', {
    scrollTrigger: { trigger: '#stats-row', start: 'top 90%', toggleActions: 'play none none none' },
    y: 40, opacity: 0, duration: 0.7, ease: 'power2.out',
  });
}

/* ========================
   LIVE STAT COUNTERS
   ======================== */
function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const dur = 2200, start = performance.now();
  const tick = now => {
    const p   = Math.min((now - start) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(ease * target).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const statsObs = new IntersectionObserver(entries => {
  if (!entries[0].isIntersecting) return;
  statsObs.disconnect();
  getSiteStats().then(s => {
    animateCounter('stat-squads',   s.squads   || 0);
    animateCounter('stat-products', s.products || 0);
    animateCounter('stat-builders', s.users    || 0);
  }).catch(() => {
    animateCounter('stat-squads',   127);
    animateCounter('stat-products', 89);
    animateCounter('stat-builders', 312);
  });
}, { threshold: 0.3 });

const statsRow = document.getElementById('stats-row');
if (statsRow) statsObs.observe(statsRow);
