import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as numeric from 'numeric';
import * as math from 'mathjs';
import $ from 'jquery';
window.jQuery = $;
import 'jquery-csv';
// ---------------------Basic setup------------------------------- //
// Update astrometry
//const dummy = csv2json("astrometrics.csv");

// Set up scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.z = 1000;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.keys = {
  LEFT: 'ArrowLeft', //left arrow
  UP: 'ArrowUp', // up arrow
  RIGHT: 'ArrowRight', // right arrow
  BOTTOM: 'ArrowDown' // down arrow
}

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

// Trilateration function
// TODO: Generalize to n-lateration for arbitrary anchor points
function trilateratePoint(name, A, B, C, r1, r2, r3) {
  // Convert to numeric vectors
  const P1 = A, P2 = B, P3 = C;
  const ex = numeric.div(numeric.sub(P2, P1), numeric.norm2(numeric.sub(P2, P1)));
  const i = numeric.dot(ex, numeric.sub(P3, P1));
  const aux = numeric.sub(P3, numeric.add(P1, numeric.mul(ex, i)));
  const ey = numeric.div(aux, numeric.norm2(aux));
  const j = numeric.dot(ey, numeric.sub(P3, P1));
  const ez = math.cross(ex, ey);

  const d = numeric.norm2(numeric.sub(P2, P1));
  const x = (r1 ** 2 - r2 ** 2 + d ** 2) / (2 * d);
  const y = ((r1 ** 2 - r3 ** 2 + i ** 2 + j ** 2) / (2 * j)) - (i / j) * x;

  const zSquared = r1 ** 2 - x ** 2 - y ** 2;

  // Decide what to do with z
  if(zSquared < 0) {
    //pass
    console.log("Invalid trilateration - skipping\n zSquared = ", zSquared, "\n Name: ", name)
    return [0, 0, 0];
  } else {
    const z = Math.sqrt(zSquared);

    // Final coordinates: P = A + x*ex + y*ey + z*ez
    const part1 = numeric.add(P1, numeric.mul(ex, x));
    const part2 = numeric.add(part1, numeric.mul(ey, y));
    const solution1 = numeric.add(part2, numeric.mul(ez, z));
    const solution2 = numeric.sub(part2, numeric.mul(ez, z)); // mirrored solution

    console.log("Plotting ", name, " at point ", solution1)
    return solution1;
    return [solution1, solution2];
  }

}

// Load star spreadsheet
async function loadStarDistanceData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch JSON data");
    const data = await response.json();
    console.log("Loaded star data:", data);
    return data;
  } catch (error) {
    console.error("Error loading star distances:", error);
  }
}

var stars;
$.get("astrometrics.csv", function(CSVdata) {
      stars = $.csv.toObjects(CSVdata);
      console.log("JSON Object: ", stars)
});

const dAB = stars[0].B; // A's distance to B
const dAC = stars[0].C; // A's distance to C
const dBC = stars[1].C; // B's distance to C

const anchors = reconstructAnchorsFromDistances(dAB, dAC, dBC);

// Use the loaded star data
stars.forEach(system => {

  // Material for stars
  const starMaterial = new THREE.MeshBasicMaterial({ color: system.color});
  const geometry = new THREE.SphereGeometry(5, 8, 8);
  const star = new THREE.Mesh(geometry, starMaterial);

  // Trilaterate point (only takes first solution right now)
  const star_pos = trilateratePoint(system.name, anchors.A, anchors.B, anchors.C, system.A, system.B, system.C);

  star.position.set(star_pos[0], star_pos[1], star_pos[2]);
  star.name = system.name;
  scene.add(star);
});


// -----------------------Begin render------------------------------- //

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  // controls.autoRotate();
  controls.update();
  renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
