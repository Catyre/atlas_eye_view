import * as THREE from 'three';
import CameraControls from 'camera-controls';
import $ from 'jquery';
import * as tri from './trilateration.js';
import { validateCalculatedPositions } from './validation.js';
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
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0px';
renderer.domElement.style.left = '0px';
document.body.appendChild(renderer.domElement);

window.htmlVars = {cameraControls: cameraControls, camera: camera, renderer: renderer, scene: scene}//, pivot: pivot}

// Add lights
const light = new THREE.PointLight(0xffffff, 1);
light.position.set(500, 500, 500);
scene.add(light);

// Add raycaster for click detection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Create popup element
const popup = document.createElement('div');
popup.style.cssText = `
  position: absolute;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #444;
  font-family: monospace;
  font-size: 12px;
  max-width: 300px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
  display: none;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
`;
document.body.appendChild(popup);

// Store system data for popup
let systemData = {};

// Click handler for snapping to systems
function onMouseClick(event) {
  // Prevent default behavior and stop propagation
  event.preventDefault();
  event.stopPropagation();
  
  // Calculate mouse position in normalized device coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Update the picking ray with the camera and mouse position
  raycaster.setFromCamera(mouse, camera);

  // Get all objects in the scene that could be clicked
  const clickableObjects = scene.children.filter(obj => obj.name && obj.type === 'Mesh');

  // Calculate objects intersecting the picking ray
  const intersects = raycaster.intersectObjects(clickableObjects);

  if (intersects.length > 0) {
    const clickedObject = intersects[0].object;
    
    // Check if the clicked object is a star (has a name)
    if (clickedObject.name) {
      // Get the star's position
      const targetPosition = clickedObject.position;
      
      // Calculate camera position with offset
      const cameraOffset = 20;
      const cameraPosition = {
        x: targetPosition.x + cameraOffset,
        y: targetPosition.y + cameraOffset,
        z: targetPosition.z + cameraOffset
      };
      
      // Animate camera to the star's position
      cameraControls.setLookAt(
        cameraPosition.x,
        cameraPosition.y,
        cameraPosition.z,
        targetPosition.x,      // Look at the star
        targetPosition.y,
        targetPosition.z,
        true // Enable smooth transition
      );

      // Listen for camera movement completion
      const onCameraRest = () => {
        cameraControls.removeEventListener('rest', onCameraRest);
        // Show popup after camera has finished moving
        showSystemPopup(clickedObject.name, clickedObject.position);
      };
      
      cameraControls.addEventListener('rest', onCameraRest);
    }
  } else {
    // Hide popup if clicking on empty space
    hidePopup();
  }
}

// -----------------------Functions------------------------------- //
// Fetch system database and process the data
async function processAstrometrics() {
  const res= await fetch("http://192.168.1.96:3000/systems");
  const stars = await res.json();
  
  // Load validation data
  let validationData = [];
  try {
    const validationRes = await fetch("./validation_data.json");
    validationData = await validationRes.json();
  } catch (error) {
    console.warn("Could not load validation_data.json:", error);
  }
  
  const dAB = stars[0].B;
  const dAC = stars[0].C;
  const dBC = stars[1].C;
  
  const anchors = tri.reconstructAnchorsFromDistances(dAB, dAC, dBC);
  const basis = tri.buildBasis(anchors.A, anchors.B, anchors.C);
  
  // Start camera centered on Sun Tzu system at origin
  camera.position.set(20, 20, 20); // Offset from origin
  cameraControls.setTarget(0, 0, 0, true); // Look at origin where Sun Tzu should be

  const P4 = tri.trilateratePoint(stars[3].name, anchors.A, anchors.B, anchors.C, stars[3].A, stars[3].B, stars[3].C)
  
  // Find Sun Tzu system and calculate the shift needed to place it at origin
  const sunTzuSystem = stars.find(system => system.name === "Sun Tzu");
  let coordinateShift = [0, 0, 0];
  
  if (sunTzuSystem) {
    // Calculate Sun Tzu's position using trilateration
    const sunTzuPosition = tri.trilaterate4(sunTzuSystem.name, anchors.A, anchors.B, anchors.C, P4, sunTzuSystem.A, sunTzuSystem.B, sunTzuSystem.C, sunTzuSystem.D);
    coordinateShift = sunTzuPosition.map(coord => -coord); // Negative to shift to origin
    console.log("Sun Tzu found at:", sunTzuPosition, "Shifting by:", coordinateShift);
  } else {
    console.warn("Sun Tzu system not found in data");
  }
  
  // Store system data for popup
  stars.forEach(system => {
    systemData[system.name] = system;
  });
  
  // Add anchor stars to the scene for clicking (with coordinate shift)
  const anchorNames = [stars[0].name, stars[1].name, stars[2].name, stars[3].name];
  const anchorPositions = [anchors.A, anchors.B, anchors.C, P4];
  
  anchorNames.forEach((name, index) => {
    const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const geometry = new THREE.SphereGeometry(1.0, 16, 16);
    const star = new THREE.Mesh(geometry, starMaterial);
    
    const shiftedPosition = anchorPositions[index].map((coord, i) => coord + coordinateShift[i]);
    star.position.set(shiftedPosition[0], shiftedPosition[1], shiftedPosition[2]);
    star.name = name;
    scene.add(star);
  });
  
  // Use the loaded star data
  stars.forEach(system => {
    // Only create stars for non-anchor systems
    if (!JSON.parse(system.is_anchor)) {
      // Trilaterate point (only takes first solution right now)
      const star_pos = tri.trilaterate4(system.name, anchors.A, anchors.B, anchors.C, P4, system.A, system.B, system.C, system.D);

      // Material for stars
      const starMaterial = new THREE.MeshBasicMaterial({ color: system.color});
      const geometry = new THREE.SphereGeometry(.8, 16, 16);
      const star = new THREE.Mesh(geometry, starMaterial);

      // Apply coordinate shift to position Sun Tzu at origin
      const shiftedPosition = star_pos.map((coord, i) => coord + coordinateShift[i]);
      star.position.set(shiftedPosition[0], shiftedPosition[1], shiftedPosition[2]);
      star.name = system.name;
      scene.add(star);

      const selector = document.getElementById("starSelector");
      const option = document.createElement("option");
      option.value = [shiftedPosition[0], shiftedPosition[1], shiftedPosition[2]];
      option.textContent = star.name;
      selector.appendChild(option);
    }
  });

  console.log(`${stars.length} systems mapped!`)
  
  // Run validation on the loaded data
  const validationResults = validateCalculatedPositions(stars, validationData);
  if (validationResults) {
    console.log("Position validation completed. Check console for detailed results.");
  }
  
  // Add click event listener after scene is loaded
  window.addEventListener('click', onMouseClick);
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

// Add click outside popup to close it
document.addEventListener('click', (event) => {
  if (!popup.contains(event.target)) {
    hidePopup();
  }
});

// Function to show system popup
function showSystemPopup(systemName, worldPosition) {
  // Find system data
  const system = systemData[systemName];
  if (!system) {
    console.warn(`No data found for system: ${systemName}`);
    return;
  }
  
  // Convert 3D world position to screen coordinates
  const screenPosition = worldPosition.clone().project(camera);
  
  // Convert to pixel coordinates
  const mouseX = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
  const mouseY = (-screenPosition.y * 0.5 + 0.5) * window.innerHeight;
  
  // Format the JSON data for display
  const formattedData = JSON.stringify(system, null, 2);
  
  // Update popup content
  popup.innerHTML = `
    <div style="margin-bottom: 10px; font-weight: bold; color: #4CAF50;">${systemName}</div>
    <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">${formattedData}</pre>
  `;
  
  // Position popup near the star but ensure it stays within viewport
  const popupWidth = 300;
  const popupHeight = Math.min(400, popup.scrollHeight);
  
  let left = mouseX + 10;
  let top = mouseY + 10;
  
  // Adjust if popup would go off screen
  if (left + popupWidth > window.innerWidth) {
    left = mouseX - popupWidth - 10;
  }
  if (top + popupHeight > window.innerHeight) {
    top = mouseY - popupHeight - 10;
  }
  
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.style.display = 'block';
}

// Function to hide popup
function hidePopup() {
  popup.style.display = 'none';
}
