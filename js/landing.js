/* ============================================================
   KREW — Landing Page: Three.js Physics Scene + GSAP Scroll
   ============================================================ */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { getSiteStats } from './db.js';

/* ========================
   THREE.JS SCENE
   ======================== */
const canvas  = document.getElementById('bg-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 32);

/* ---- Lights ---- */
const ambientLight = new THREE.AmbientLight(0x4B0082, 0.6);
scene.add(ambientLight);

const mouseLight = new THREE.PointLight(0x7C3AED, 4, 60);
mouseLight.position.set(0, 0, 15);
scene.add(mouseLight);

const cyanLight = new THREE.PointLight(0x06B6D4, 2, 50);
cyanLight.position.set(-18, 12, 5);
scene.add(cyanLight);

const pinkLight = new THREE.PointLight(0xEC4899, 1.5, 40);
pinkLight.position.set(18, -10, 3);
scene.add(pinkLight);

/* ---- Particle Field ---- */
const PARTICLE_COUNT = 8000;

const particleGeo = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors    = new Float32Array(PARTICLE_COUNT * 3);
const sizes     = new Float32Array(PARTICLE_COUNT);

const palette = [
  new THREE.Color(0x7C3AED),
  new THREE.Color(0xA855F7),
  new THREE.Color(0x06B6D4),
  new THREE.Color(0x22D3EE),
  new THREE.Color(0xEC4899),
  new THREE.Color(0xF472B6),
];

for (let i = 0; i < PARTICLE_COUNT; i++) {
  // Spherical distribution
  const r     = 40 + Math.random() * 60;
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);

  positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
  positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  positions[i * 3 + 2] = r * Math.cos(phi);

  const c = palette[Math.floor(Math.random() * palette.length)];
  colors[i * 3]     = c.r;
  colors[i * 3 + 1] = c.g;
  colors[i * 3 + 2] = c.b;

  sizes[i] = Math.random() * 2.5 + 0.5;
}

particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particleGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
particleGeo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

const particleMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime:         { value: 0 },
    uPixelRatio:   { value: renderer.getPixelRatio() },
  },
  vertexShader: `
    attribute float size;
    attribute vec3 color;
    varying vec3 vColor;
    uniform float uTime;
    uniform float uPixelRatio;

    void main() {
      vColor = color;
      vec3 pos = position;
      // Gentle drift
      pos.y += sin(uTime * 0.3 + position.x * 0.05) * 0.8;
      pos.x += cos(uTime * 0.25 + position.z * 0.04) * 0.6;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = size * uPixelRatio * (200.0 / -mvPosition.z);
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    void main() {
      float dist = length(gl_PointCoord - 0.5);
      if (dist > 0.5) discard;
      float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
      gl_FragColor = vec4(vColor, alpha * 0.7);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexColors: true,
});

const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

/* ---- Floating Objects ---- */
const objects = [];

function createFloatingObject(type, index) {
  let geo, mat;

  const hue   = [0x7C3AED, 0xA855F7, 0x06B6D4, 0xEC4899, 0x22D3EE, 0xF472B6];
  const color = new THREE.Color(hue[index % hue.length]);

  if (type === 'card') {
    geo = new THREE.BoxGeometry(3.8 + Math.random(), 2.4 + Math.random() * 0.4, 0.15);
    mat = new THREE.MeshPhysicalMaterial({
      color: color,
      metalness: 0.3,
      roughness: 0.1,
      transmission: 0.4,
      opacity: 0.85,
      transparent: true,
      emissive: color,
      emissiveIntensity: 0.08,
      side: THREE.DoubleSide,
    });
  } else if (type === 'orb') {
    geo = new THREE.IcosahedronGeometry(1.0 + Math.random() * 0.4, 1);
    mat = new THREE.MeshPhysicalMaterial({
      color: color,
      wireframe: true,
      emissive: color,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.8,
    });
  } else {
    // chip
    geo = new THREE.BoxGeometry(2.2 + Math.random(), 0.7, 0.08);
    mat = new THREE.MeshPhysicalMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.7,
      metalness: 0.5,
      roughness: 0.2,
    });
  }

  const mesh = new THREE.Mesh(geo, mat);

  // Random position in a toroidal spread around hero
  const angle  = (index / 30) * Math.PI * 2 + Math.random() * 0.5;
  const radius = 12 + Math.random() * 10;
  const z      = (Math.random() - 0.5) * 10;

  mesh.position.set(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius * 0.6 + (Math.random() - 0.5) * 5,
    z
  );

  mesh.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  );

  scene.add(mesh);

  return {
    mesh,
    velocity:  new THREE.Vector3((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.015, 0),
    rotSpeed:  new THREE.Vector3((Math.random() - 0.5) * 0.005, (Math.random() - 0.5) * 0.006, 0),
    origin:    mesh.position.clone(),
    mass:      0.8 + Math.random() * 0.8,
  };
}

// Create 10 cards, 8 orbs, 12 chips
for (let i = 0; i < 10; i++) objects.push(createFloatingObject('card', i));
for (let i = 0; i < 8;  i++) objects.push(createFloatingObject('orb',  i + 10));
for (let i = 0; i < 12; i++) objects.push(createFloatingObject('chip', i + 18));

/* ---- Mouse Tracking ---- */
const mouse3D = new THREE.Vector3(0, 0, 5);
const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -5);
const raycaster = new THREE.Raycaster();
const mouseNDC  = new THREE.Vector2();

canvas.addEventListener('mousemove', (e) => {
  mouseNDC.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouseNDC, camera);
  raycaster.ray.intersectPlane(mousePlane, mouse3D);

  // Animate mouse light
  mouseLight.position.lerp(new THREE.Vector3(mouse3D.x, mouse3D.y, 12), 0.08);
});

/* ---- Click Burst ---- */
canvas.addEventListener('click', () => {
  objects.forEach(obj => {
    const dir = obj.mesh.position.clone().sub(mouse3D).normalize();
    const dist = obj.mesh.position.distanceTo(mouse3D);
    const force = Math.max(0, 8 - dist) * 0.12;
    obj.velocity.addScaledVector(dir, force / obj.mass);
  });
});

/* ========================
   ANIMATION LOOP
   ======================== */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  const delta   = clock.getDelta();

  particleMat.uniforms.uTime.value = elapsed;
  particles.rotation.y = elapsed * 0.008;
  particles.rotation.x = elapsed * 0.004;

  // Physics update
  objects.forEach(obj => {
    const { mesh, velocity, rotSpeed, origin, mass } = obj;

    // Mouse repulsion
    const toMouse = mesh.position.clone().sub(mouse3D);
    const dist    = toMouse.length();
    if (dist < 14) {
      const repulsion = (14 - dist) / 14;
      const force     = repulsion * repulsion * 0.04;
      velocity.addScaledVector(toMouse.normalize(), force / mass);
    }

    // Soft boundary: pull back toward origin zone (not exact position)
    const fromOrigin = mesh.position.distanceTo(origin);
    if (fromOrigin > 9) {
      const pullDir = origin.clone().sub(mesh.position).normalize();
      velocity.addScaledVector(pullDir, 0.003 * fromOrigin / mass);
    }

    // Micro-random drift
    velocity.x += (Math.random() - 0.5) * 0.001;
    velocity.y += (Math.random() - 0.5) * 0.001;

    // Damping
    velocity.multiplyScalar(0.978);

    // Integrate
    mesh.position.addScaledVector(velocity, 1);

    // Rotation
    mesh.rotation.x += rotSpeed.x;
    mesh.rotation.y += rotSpeed.y;

    // Gentle Y bob
    mesh.position.y += Math.sin(elapsed * 0.5 + mesh.position.x) * 0.003;
  });

  // Gentle camera sway (follows mouse subtly)
  camera.position.x += (mouseNDC.x * 1.5 - camera.position.x) * 0.02;
  camera.position.y += (mouseNDC.y * 0.8 - camera.position.y) * 0.02;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}
animate();

/* ========================
   RESIZE
   ======================== */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  particleMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
});

/* ========================
   TOUCH SUPPORT
   ======================== */
canvas.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  mouseNDC.x =  (t.clientX / window.innerWidth)  * 2 - 1;
  mouseNDC.y = -(t.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);
  raycaster.ray.intersectPlane(mousePlane, mouse3D);
}, { passive: true });

/* ========================
   GSAP SCROLL ANIMATIONS
   ======================== */
if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);

  // Fade in demo squad cards
  gsap.utils.toArray('.demo-squad-card').forEach((el, i) => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: '#section-squads',
        start: 'top 70%',
        toggleActions: 'play none none reverse',
      },
      x: i % 2 === 0 ? -60 : 60,
      opacity: 0,
      duration: 0.7,
      delay: i * 0.12,
      ease: 'back.out(1.4)',
    });
  });

  // Fade in demo product cards
  gsap.utils.toArray('.demo-product-card').forEach((el, i) => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: '#section-marketplace',
        start: 'top 70%',
        toggleActions: 'play none none reverse',
      },
      scale: 0.8,
      opacity: 0,
      duration: 0.5,
      delay: i * 0.08,
      ease: 'back.out(1.6)',
    });
  });

  // Feature cards
  gsap.utils.toArray('.feature-card').forEach((el, i) => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: '#section-how',
        start: 'top 70%',
        toggleActions: 'play none none reverse',
      },
      y: 40,
      opacity: 0,
      duration: 0.6,
      delay: i * 0.15,
      ease: 'power3.out',
    });
  });

  // CTA button dramatic entrance
  gsap.from('#cta-btn', {
    scrollTrigger: {
      trigger: '#section-cta',
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
    scale: 0.7,
    opacity: 0,
    duration: 0.8,
    ease: 'elastic.out(1, 0.6)',
  });

  // Stats section fade
  gsap.from('#stats-row', {
    scrollTrigger: {
      trigger: '#stats-row',
      start: 'top 85%',
      toggleActions: 'play none none none',
    },
    y: 30,
    opacity: 0,
    duration: 0.6,
    ease: 'power2.out',
  });

  // Parallax on hero
  gsap.to('.hero-floating-chips', {
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: true,
    },
    y: 100,
    opacity: 0,
  });
}

/* ========================
   STAT COUNTERS (from Supabase)
   ======================== */
async function loadStats() {
  try {
    const stats = await getSiteStats();
    animateCounter('stat-squads',   stats.squads   || 0);
    animateCounter('stat-products', stats.products || 0);
    animateCounter('stat-builders', stats.users    || 0);
  } catch (_) {
    // Fallback to demo numbers
    animateCounter('stat-squads',   127);
    animateCounter('stat-products', 89);
    animateCounter('stat-builders', 342);
  }
}

function animateCounter(id, target) {
  const el       = document.getElementById(id);
  if (!el) return;
  const duration = 2000;
  const start    = performance.now();

  function update(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(ease * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// Trigger stat counters when stats row is visible
const statsObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    loadStats();
    statsObserver.disconnect();
  }
}, { threshold: 0.3 });

const statsRow = document.getElementById('stats-row');
if (statsRow) statsObserver.observe(statsRow);
