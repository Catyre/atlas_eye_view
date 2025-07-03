// viewer.js
import * as THREE from 'three';
import CameraControls from 'camera-controls';

export let camera, cameraControls

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
  //window.htmlVars.pivot.position.set(x, y, z);
  window.htmlVars.camera.position.set(x + offset, y + offset, z + offset);
  window.htmlVars.cameraControls.setTarget(x, y, z, true);
  //window.htmlVars.cameraControls.update();
  window.htmlVars.renderer.render(window.htmlVars.scene, window.htmlVars.camera)
});
