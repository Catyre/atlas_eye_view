// viewer.js
import * as THREE from 'three';
import CameraControls from 'camera-controls';

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
