import * as THREE from 'three';
import CameraControls from 'camera-controls';
import $ from 'jquery';
import * as tri from './trilateration.js';
window.jQuery = $;
import 'jquery-csv';

// ---------------------Basic setup------------------------------- //
// Set up scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

CameraControls.install({THREE: THREE});

const width = window.innerWidth;
const height = window.innerHeight;
const clock = new THREE.Clock();
const camera = new THREE.PerspectiveCamera( 60, width / height, 0.01, 5000 );
const renderer = new THREE.WebGLRenderer({ antialias: true });
const cameraControls = new CameraControls( camera, renderer.domElement );
//const pivot = new THREE.Object3D();
//scene.add(pivot);
//pivot.add(camera);  // camera rotates with pivot
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.htmlVars = {cameraControls: cameraControls, camera: camera, renderer: renderer, scene: scene}//, pivot: pivot}

// Add lights
const light = new THREE.PointLight(0xffffff, 1);
light.position.set(500, 500, 500);
scene.add(light);

// -----------------------Functions------------------------------- //

// Fetch system database and process the data
async function processAstrometrics() {
  const res= await fetch("http://192.168.1.96:3000/systems");
  const stars = await res.json();
  const dAB = stars[0].B;
  const dAC = stars[0].C;
  const dBC = stars[1].C;
  
  const anchors = tri.reconstructAnchorsFromDistances(dAB, dAC, dBC);
  const basis = tri.buildBasis(anchors.A, anchors.B, anchors.C);
  
  camera.position.set(anchors.B[0]+10, anchors.B[1]+10, anchors.B[2]+10);
  cameraControls.setTarget(anchors.B[0], anchors.B[1], anchors.B[2], true);

  const P4 = tri.trilateratePoint(stars[3].name, anchors.A, anchors.B, anchors.C, stars[3].A, stars[3].B, stars[3].C)
  // Use the loaded star data
  stars.forEach(system => {

    if (!JSON.parse(system.is_anchor) || system.color === "white") {
      // Trilaterate point (only takes first solution right now)
      const star_pos = tri.trilaterate4(system.name, anchors.A, anchors.B, anchors.C, P4, system.A, system.B, system.C, system.D);

      // Material for stars
      const starMaterial = new THREE.MeshBasicMaterial({ color: system.color});
      const geometry = new THREE.SphereGeometry(.8, 16, 16);
      const star = new THREE.Mesh(geometry, starMaterial);

      star.position.set(star_pos[0], star_pos[1], star_pos[2]);
      star.name = system.name;
      scene.add(star);

      const selector = document.getElementById("starSelector");
      const option = document.createElement("option");
      option.value = [star_pos[0], star_pos[1], star_pos[2]];
      option.textContent = star.name;
      selector.appendChild(option);
    }
  });

  console.log(`${stars.length} systems mapped!`)
}

processAstrometrics();

// -----------------------Begin render------------------------------- //
// Exclusive control for user dragging
let userDragging = false;
let disableAutoRotate = false;
const onRest = () => {
	cameraControls.removeEventListener('rest', onRest);
	userDragging = false;
	disableAutoRotate = false;
}

cameraControls.addEventListener('controlstart', () => {
	cameraControls.removeEventListener('rest', onRest);
	userDragging = true;
	disableAutoRotate = true;
});

cameraControls.addEventListener('controlend', () => {
	if (cameraControls.active) {
		cameraControls.addEventListener('rest', onRest);
	} else {
		onRest();
	}
});

cameraControls.addEventListener('transitionstart', () => {
	if (userDragging) return;

	disableAutoRotate = true;
	cameraControls.addEventListener('rest', onRest);

});

// Animation loop
function animate() {
  const delta = clock.getDelta();
	const elapsed = clock.getElapsedTime();
	const updated = cameraControls.update(delta);


  if (!disableAutoRotate) {
      //cameraControls.azimuthAngle += -10 * delta * THREE.MathUtils.DEG2RAD;
      //cameraControls.polarAngle += 10 * delta * THREE.MathUtils.DEG2RAD;
  }

  requestAnimationFrame(animate);

  if (updated) {
		renderer.render( scene, camera );
	}
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
