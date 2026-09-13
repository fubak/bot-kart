import * as THREE from 'three';

// Minimal initialization shell: proves WebGL renders. No game content yet.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e1a);
scene.fog = new THREE.Fog(0x0b0e1a, 20, 60);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
camera.position.set(0, 4, 10);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
keyLight.position.set(5, 10, 6);
scene.add(keyLight);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(30, 48),
  new THREE.MeshStandardMaterial({ color: 0x1b2340 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const body = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.2, 0),
  new THREE.MeshStandardMaterial({ color: 0x46c8ff, flatShading: true }),
);
body.position.y = 1.6;
scene.add(body);

const kart = new THREE.Mesh(
  new THREE.BoxGeometry(2.4, 0.5, 3.2),
  new THREE.MeshStandardMaterial({ color: 0xff7847, flatShading: true }),
);
kart.position.y = 0.45;
scene.add(kart);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop((timeMs) => {
  const t = timeMs / 1000;
  body.rotation.y = t;
  body.position.y = 1.6 + Math.sin(t * 2) * 0.15;
  kart.rotation.y = t * 0.4;
  camera.lookAt(0, 1, 0);
  renderer.render(scene, camera);
});
