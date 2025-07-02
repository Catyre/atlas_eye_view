// viewer.js
import * as THREE from 'three';
import CameraControls from 'camera-controls';

export let camera, cameraControls
export function initViewer() {
  // ---------------------Basic setup------------------------------- //
  // Set up scene, camera, and renderer
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  CameraControls.install({THREE: THREE});

  const width = window.innerWidth;
  const height = window.innerHeight;
  const clock = new THREE.Clock();
  const camera = new THREE.PerspectiveCamera( 60, width / height, 0.01, 1000 );
  camera.position.set( 0, 0, 500);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const cameraControls = new CameraControls( camera, renderer.domElement );
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  window.htmlVars = {cameraControls: cameraControls, camera: camera}

  // Add lights
  const light = new THREE.PointLight(0xffffff, 1);
  light.position.set(500, 500, 500);
  scene.add(light);
}

export function rotateCamera45() {
  const angle = Math.PI / 4; // 45 degrees in radians

  const radius = Math.sqrt(camera.position.x**2 + camera.position.z**2);
  const theta = Math.atan2(camera.position.z, camera.position.x) + angle;

  camera.position.x = radius * Math.cos(theta);
  camera.position.z = radius * Math.sin(theta);
  camera.lookAt(0, 0, 0); // Or wherever your scene's center is

  if (controls) controls.update();
}

const selector = document.getElementById("starSelector");
document.getElementById("snapButton").addEventListener("click", () => {
  const pos = [];

  selector.value.split(",").forEach(coord => {
    pos.push(parseFloat(coord));
  });

  const [x, y, z] = pos;

  // Move camera to orbit around the star
  const offset = 10; // how far away the camera should orbit
  window.htmlVars.pivot.position.set(x, y, z);
  window.htmlVars.camera.position.set(x + offset, y + offset, z + offset);
  window.htmlVars.cameraControls.setTarget(x, y, z, true);
  //window.htmlVars.cameraControls.update();
  window.htmlVars.renderer.render(window.htmlVars.scene, window.htmlVars.camera)
});
