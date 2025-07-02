import * as THREE from 'three';
import CameraControls from 'camera-controls';
import * as numeric from 'numeric';
import * as math from 'mathjs';
import $ from 'jquery';
window.jQuery = $;
window.astrometrics = {}; // Global variable for star data
import 'jquery-csv';

// ---------------------Basic setup------------------------------- //
// Set up scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

CameraControls.install({THREE: THREE});

const width = window.innerWidth;
const height = window.innerHeight;
const clock = new THREE.Clock();
const camera = new THREE.PerspectiveCamera( 90, width / height, 0.01, 1000 );
camera.position.set( 0, 0, 300);
const renderer = new THREE.WebGLRenderer({ antialias: true });
const cameraControls = new CameraControls( camera, renderer.domElement );
cameraControls.setTarget(0, 0, 0, true)
const pivot = new THREE.Object3D();
scene.add(pivot);
pivot.add(camera);  // camera rotates with pivot
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.htmlVars = {cameraControls: cameraControls, camera: camera, renderer: renderer, scene: scene, pivot: pivot}

// Add lights
const light = new THREE.PointLight(0xffffff, 1);
light.position.set(500, 500, 500);
scene.add(light);

// -----------------------Functions------------------------------- //
// Need to build coordinate system from anchor points
//  TODO: Be dynamic
function reconstructAnchorsFromDistances(dAB, dAC, dBC) {
  // A at (0,0,0), B at (dAB, 0, 0)
  const A = [0, 0, 0];
  const B = [dAB, 0, 0];

  const xC = (dAC ** 2 + dAB ** 2 - dBC ** 2) / (2 * dAB);
  const ySquared = dAC ** 2 - xC ** 2;
  if (ySquared < 0) throw new Error("Invalid triangle — cannot place C.");

  const yC = Math.sqrt(ySquared);
  const C = [xC, yC, 0]; // we pick the +y option arbitrarily

  return { A, B, C };
}

function buildBasis(P1, P2, P3) {
  // Unit vector of side BA
  const ex = numeric.div(numeric.sub(P2, P1), numeric.norm2(numeric.sub(P2, P1)));
  // Projection of AC onto BA (its x-component)
  const i = numeric.dot(ex, numeric.sub(P3, P1));
  const aux = numeric.sub(P3, numeric.add(P1, numeric.mul(ex, i)));
  // Unit vector for y-axis
  const ey = numeric.div(aux, numeric.norm2(aux));
  // Projection of AC onto y axis (the y component)
  const j = numeric.dot(ey, numeric.sub(P3, P1));

  // z axis will just be cross product of x and y unit vectors
  const ez = math.cross(ex, ey);

  const basis = {ex: ex, ey: numeric.mul(-1, ez), ez: ey, i: i, j: j}; // This is not a mistake - the basis vectors need to be rotated
  return basis;
}

// Quadrilateration (trilateration, but more!)
function trilaterate4(name, P1, P2, P3, P4, r1, r2, r3, r4) {
  const basis = buildBasis(P1, P2, P3);
  const ex = basis.ex;
  const ey = basis.ey;
  const ez = basis.ez;
  const i = basis.i;
  const j = basis.j;

  const d = numeric.norm2(numeric.sub(P2, P1));
  const x = (r1**2 - r2**2 + d**2) / (2 * d);
  const y = ((r1**2 - r3**2 + i**2 + j**2) / (2 * j)) - ((i / j) * x);

  var zSquared = r1**2 - x**2 - y**2;
  if (zSquared < 0) {
    console.log("Invalid trilateration - Using -zSquared\n zSquared = ", zSquared, "\n Name: ", name)
    zSquared *= -1;
    //throw new Error("Trilateration failed: No real solution (z² < 0)");
  }

  const z = Math.sqrt(zSquared);

  // Position relative to P1
  const result1 = numeric.add(P1, numeric.add(numeric.mul(ex, x), numeric.add(numeric.mul(ey, y), numeric.mul(ez, z))));
  const result2 = numeric.add(P1, numeric.add(numeric.mul(ex, x), numeric.add(numeric.mul(ey, y), numeric.mul(ez, -z)))); // mirrored solution

  // Use P4 to disambiguate which of the two points is closer
  const dist1 = Math.abs(Math.sqrt(numeric.dot(numeric.sub(P4, result1), numeric.sub(P4, result1))) - r4);
  const dist2 = Math.abs(Math.sqrt(numeric.dot(numeric.sub(P4, result2), numeric.sub(P4, result2))) - r4);

  return dist1 < dist2 ? result1 : result2;
}


// Trilateration function - only used to get cooridinates of fourth anchor point
// TODO: Generalize to n-lateration for arbitrary anchor points
function trilateratePoint(name, P1, P2, P3, r1, r2, r3) {
  const basis = buildBasis(P1, P2, P3);
  const ex = basis.ex;
  const ey = basis.ey;
  const ez = basis.ez;
  const i = basis.i;
  const j = basis.j;
  const d = numeric.norm2(numeric.sub(P2, P1));

  // Algorithm for trilateration
  const x = (r1 ** 2 - r2 ** 2 + d ** 2) / (2 * d);
  // y = ((r1^2 - r3^2 + i^2 + j^2) / (2 * j)) - (i/j) * x
  const y = ((r1 ** 2 - r3 ** 2 + i ** 2 + j ** 2) / (2 * j)) - (i / j) * x;

  // r1^2 - x^2 - y^2
  var zSquared = r1 ** 2 - x ** 2 - y ** 2;
    console.log(x, y, zSquared);

  // Decide what to do with z
  if(zSquared < 0) {
    //pass
    console.log("Invalid trilateration - Using -zSquared\n zSquared = ", zSquared, "\n Name: ", name);

    zSquared *= -1;
  }

  const z = Math.sqrt(zSquared);

  // Final coordinates: P = A + x*ex + y*ey + z*ez
  const part1 = numeric.add(P1, numeric.mul(ex, x));
  const part2 = numeric.add(part1, numeric.mul(ey, y));
  const solution1 = numeric.add(part2, numeric.mul(ez, z));
  const solution2 = numeric.sub(part2, numeric.mul(ez, z)); // mirrored solution

  console.log("Plotting ", name, " at point ", solution1)
  return solution1; //part1 < part2 ? solution1 : solution2;

}

// Retrieve CSV of star data, process the distances into proper coordinates
function applyAstrometrics(fileName) {
  $.get(fileName, function(CSVdata) {
        window.astrometrics = $.csv.toObjects(CSVdata);
        processAstrometrics(); // Avoids async issues
  });
}

// Used to avoid async issues
function processAstrometrics() {
  const stars = window.astrometrics;
  const dAB = stars[0].B;
  const dAC = stars[0].C;
  const dBC = stars[1].C;
  
  const anchors = reconstructAnchorsFromDistances(dAB, dAC, dBC);
  const basis = buildBasis(anchors.A, anchors.B, anchors.C);

  const P4 = trilateratePoint(stars[3].name, anchors.A, anchors.B, anchors.C, stars[3].A, stars[3].B, stars[3].C)

  // Use the loaded star data
  stars.forEach(system => {
    // Material for stars
    const starMaterial = new THREE.MeshBasicMaterial({ color: system.color});
    const geometry = new THREE.SphereGeometry(.8, 16, 16);
    const star = new THREE.Mesh(geometry, starMaterial);

    // Trilaterate point (only takes first solution right now)
    const star_pos = trilaterate4(system.name, anchors.A, anchors.B, anchors.C, P4, system.A, system.B, system.C, system.D);

    star.position.set(star_pos[0], star_pos[1], star_pos[2]);
    star.name = system.name;
    scene.add(star);

    const selector = document.getElementById("starSelector");
    const option = document.createElement("option");
    option.value = [star_pos[0], star_pos[1], star_pos[2]];
    option.textContent = star.name;
    selector.appendChild(option);
  });
}

applyAstrometrics("astrometrics.csv");

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
      cameraControls.azimuthAngle += -10 * delta * THREE.MathUtils.DEG2RAD;
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
