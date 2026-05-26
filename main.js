import * as THREE from 'three';
import CameraControls from 'camera-controls';
import $ from 'jquery';
import * as tri from './trilateration.js';
import * as debug from './debug.js';
import * as astro from './astrometry.js';
import * as ui from './ui.js';
import { validateCalculatedPositions } from './validation.js';
import './popup.css';
window.jQuery = $;
import 'jquery-csv';

var clock = null;
var scene = null;
var camera = null;
var cameraControls = null;
var renderer = null;
var popup = null;
var mouse = null;
var raycaster = null;
const GALAXY = "calypso";
const BACKEND = 'https://atlas-eye-view.onrender.com:10000/'
//const BACKEND = 'http://localhost:4000/'
// Don't forget to also change what backend is running

// Keyboard controls state
var keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  ' ': false, // Space for Up
  shift: false // Shift for Down
};
const CAMERA_MOVE_SPEED = 125; // units per second

// ---------------------Basic setup - TESTING HMR------------------------------- //
function initializeScene() { 
  return new Promise(function(resolve, reject) {
    // Set up scene, camera, and renderer
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Add the background starfield
    createBackgroundStarfield(scene);

    CameraControls.install({THREE: THREE});

    const width = window.innerWidth;
    const height = window.innerHeight;
    var clock = new THREE.Clock();
    var camera = new THREE.PerspectiveCamera( 60, width / height, 0.01, 5000 );
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    var cameraControls = new CameraControls( camera, renderer.domElement );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0px';
    renderer.domElement.style.left = '0px';
    document.body.appendChild(renderer.domElement);

    // Add lights
    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(500, 500, 500);
    scene.add(light);

    // Add raycaster for click detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Create popup element
    const popup = document.createElement('div');
    popup.className = 'system-popup';
    document.body.appendChild(popup);

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

    // Start camera centered on Sun Tzu system at origin
    cameraControls.setLookAt(
      20, 20, 20, // Initial camera position
      0, 0, 0,    // Target position (origin)
      false       // Snap instantly on load without transition animation
    );

    //console.log("blah",scene)
    var data = {cameraControls: cameraControls, camera: camera, renderer: renderer, clock: clock, popup: popup, mouse: mouse, raycaster: raycaster};//, pivot: pivot}
    //console.log(htmlVars);
    
    if (data) {
      resolve(data);
    }
  });
}

export async function getScene() {
  await initializeScene();
  //console.log(window.htmlVars)
  return scene;
}


// --- Anchor Snap UI Logic --- //
// Store anchor data for snapping
let anchorList = [];
const anchorSelect = document.getElementById('anchor-select');
const snapButton = document.getElementById('snap-anchor-btn');

export function updateSystemDropdown(anchors = null) {
  // Use provided anchors or fall back to stored anchorList
  const anchorsToUse = anchors || anchorList;
  
  console.log('Updating anchor dropdown with:', anchorsToUse);
  anchorSelect.innerHTML = '';
  
  if (!anchorsToUse || anchorsToUse.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No anchors';
    anchorSelect.appendChild(opt);
    snapButton.disabled = true;
    return;
  }
  
  // Store anchors for later use
  anchorList = anchorsToUse;
  
  for (const anchor of anchorsToUse) {
    const opt = document.createElement('option');
    opt.value = anchor.anchor_id;
    opt.textContent = anchor.name || anchor.anchor_id;
    anchorSelect.appendChild(opt);
  }
  snapButton.disabled = false;
}

  function snapToSelectedAnchor() {
    //const cameraControls = sceneSetup.cameraControls;
    const anchorId = anchorSelect.value;
    const anchor = anchorList.find(a => a.anchor_id === anchorId);
    if (!anchor) return;
    // Camera offset for better view
    const offset = 20;
    const pos = [anchor.ghc_x, anchor.ghc_y, anchor.ghc_z];
    cameraControls.setLookAt(
      pos[0] + offset,
      pos[1] + offset,
      pos[2] + offset,
      pos[0],
      pos[1],
      pos[2],
      true
    );
  }

// Store system data for popup



function onMouseClick(event) {
  event.preventDefault();
  event.stopPropagation();
  
  if (document.pointerLockElement === renderer.domElement) {
    mouse.x = 0;
    mouse.y = 0;
  } else {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  raycaster.setFromCamera(mouse, camera);

  const clickableObjects = scene.children.filter(obj => obj.name && obj.type === 'Mesh');
  const intersects = raycaster.intersectObjects(clickableObjects);

  if (intersects.length > 0) {
    const clickedObject = intersects[0].object;
    
    if (clickedObject.name) {
      const targetPosition = clickedObject.position;
      
      const cameraOffset = 20;
      const cameraPosition = {
        x: targetPosition.x + cameraOffset,
        y: targetPosition.y + cameraOffset,
        z: targetPosition.z + cameraOffset
      };
      
      cameraControls.setLookAt(
        cameraPosition.x,
        cameraPosition.y,
        cameraPosition.z,
        targetPosition.x,
        targetPosition.y,
        targetPosition.z,
        true 
      );

      const onCameraRest = () => {
        cameraControls.removeEventListener('rest', onCameraRest);
        const system = Object.fromEntries(
          Object.entries(stars)
            .filter(([key, value]) => value.name === clickedObject.name) 
        )[clickedObject.name];
        ui.showSystemPopup(clickedObject.name, clickedObject.position, system, camera, popup);
        
        document.exitPointerLock();
        
        unsnapButton.style.display = 'block';
      };
      
      cameraControls.addEventListener('rest', onCameraRest);
    }
  } else {
    hidePopup();
  }
}

// Keyboard event handlers
function onKeyDown(event) {
  // Ignore key events if the user is typing in an input field
  if (document.activeElement.tagName === 'INPUT') return;
  
  const key = event.key.toLowerCase();
  if (key in keys) {
    keys[key] = true;
    event.preventDefault();
  } else {
    console.log('Key not in keys object:', key);
  }
}

function onKeyUp(event) {
  // Ignore key events if the user is typing in an input field
  if (document.activeElement.tagName === 'INPUT') return;

  const key = event.key.toLowerCase();
  if (key in keys) {
    keys[key] = false;
    event.preventDefault();
  }
}

function handleCameraMovement(delta) {
  if (!cameraControls) return;
  
  const anyKeyPressed = keys.w || keys.a || keys.s || keys.d || keys.q || keys.e || keys[' '] || keys.shift;
  if (!anyKeyPressed) return;
  
  const moveDistance = CAMERA_MOVE_SPEED * delta;
  
  // forward() translates both the camera and target along the line of sight
  if (keys.w) cameraControls.forward(moveDistance);
  if (keys.s) cameraControls.forward(-moveDistance);
  
  // truck() translates both the camera and target parallel to the screen plane
  if (keys.a) cameraControls.truck(-moveDistance, 0);
  if (keys.d) cameraControls.truck(moveDistance, 0);
  
  // elevate() translates both the camera and target along the global up/down Y axis
  if (keys.q || keys[' ']) cameraControls.elevate(moveDistance);
  if (keys.e || keys.shift) cameraControls.elevate(-moveDistance);
}


// Function to update camera position display
function updateCameraPositionDisplay() {
  const camX = document.getElementById('cam-x');
  const camY = document.getElementById('cam-y');
  const camZ = document.getElementById('cam-z');
  
  if (camX && camY && camZ && camera) {
    camX.textContent = camera.position.x.toFixed(2);
    camY.textContent = camera.position.y.toFixed(2);
    camZ.textContent = camera.position.z.toFixed(2);
  }
}

// Animation loop
function animate() {
  const delta = clock.getDelta();
	const elapsed = clock.getElapsedTime();
	const updated = cameraControls.update(delta);

  // Handle keyboard camera movement
  handleCameraMovement(delta);
  
  // Update camera position display
  updateCameraPositionDisplay();

  //if (!disableAutoRotate) {
      //cameraControls.azimuthAngle += -10 * delta * THREE.MathUtils.DEG2RAD;
      //cameraControls.polarAngle += 10 * delta * THREE.MathUtils.DEG2RAD;
  //}

  requestAnimationFrame(animate);

  if (updated) {
		renderer.render( scene, camera );
	}
}

function createBackgroundStarfield(scene) {
  const starGeometry = new THREE.BufferGeometry();
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.7,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true
  });

  const starVertices = [];
  const particleCount = 8000;
  
  // Create a massive sphere of stars far beyond your interactive elements
  for (let i = 0; i < particleCount; i++) {
    const x = (Math.random() - 0.5) * 4000;
    const y = (Math.random() - 0.5) * 4000;
    const z = (Math.random() - 0.5) * 4000;
    starVertices.push(x, y, z);
  }

  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
  const backgroundStars = new THREE.Points(starGeometry, starMaterial);
  
  // Optional: prevent background stars from interfering with raycasting
  backgroundStars.name = "BackgroundStarfield"; 
  
  scene.add(backgroundStars);
}

function placeStars(starData, scene) {
  console.log("placeStars called with", Object.keys(starData).length, "systems");
  let starsPlaced = 0;
  
  for (const system in starData) {
    const starPos = [starData[system].ghc_x, starData[system].ghc_y, starData[system].ghc_z];
    
    // Skip if position data is missing
    if (starPos[0] === null || starPos[0] === undefined || 
        starPos[1] === null || starPos[1] === undefined || 
        starPos[2] === null || starPos[2] === undefined) {
      console.warn(`Skipping system ${system} - missing position data:`, starPos);
      continue;
    }

    // Material for stars
    const starMaterial = new THREE.MeshBasicMaterial({ color: starData[system].color || 0xffffff});
    const geometry = new THREE.SphereGeometry(2, 16, 16);
    const star = new THREE.Mesh(geometry, starMaterial);
    
    star.position.set(starPos[0], starPos[1], starPos[2]);
    star.name = starData[system].name;
    
    scene.add(star);
    starsPlaced++;
  }
  
  console.log(`Placed ${starsPlaced} stars in scene. Scene now has ${scene.children.length} children.`);
}

let firstPass = true;
let stars = {};
initializeScene().then(function(data) {
  clock = data.clock;
  camera = data.camera;
  cameraControls = data.cameraControls;
  renderer = data.renderer;
  mouse = data.mouse;
  popup = data.popup;
  raycaster = data.raycaster;

  astro.processAstrometrics(GALAXY).then(function(data2) {
    //console.log('data',data2);
    stars = data2;
    console.log('stars data received:', stars);
    //console.log('Sample star data:', Object.keys(stars).slice(0, 3).map(key => ({ name: key, data: stars[key] })));
    placeStars(stars, scene);
    
    // Start animation only after stars are placed
    if (firstPass) {
      firstPass = false;
      //debug.addCoordinateSystemOverlay(scene);
    }

    // Handle window resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Keyboard controls: WASD for movement, C for coordinate overlay
    console.log('Adding keyboard event listeners');
    
    // Test if event listeners are working at all
    window.addEventListener('keydown', (e) => {
      console.log('WINDOW KEYDOWN EVENT:', e.key, e.code, e.type);
    });
    
    document.addEventListener('keydown', (e) => {
      console.log('DOCUMENT KEYDOWN EVENT:', e.key, e.code, e.type);
    });
    
    renderer.domElement.addEventListener('keydown', (e) => {
      console.log('CANVAS KEYDOWN EVENT:', e.key, e.code, e.type);
    });
    
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    // Ensure the canvas can receive focus for keyboard events
    renderer.domElement.setAttribute('tabindex', '0');
    renderer.domElement.style.outline = 'none';
    
    // Add click handler to focus canvas when clicked
    renderer.domElement.addEventListener('click', () => {
      renderer.domElement.focus();
      console.log('Canvas focused for keyboard input');
      console.log('Canvas has focus:', document.activeElement === renderer.domElement);
    });
    
    // Auto-focus canvas on load
    setTimeout(() => {
      renderer.domElement.focus();
      console.log('Auto-focused canvas');
    }, 1000);
    
    // Keyboard shortcut: 'C' to toggle coordinate system overlay
    window.addEventListener('keydown', (e) => {
      if (e.key === 'c' || e.key === 'C') {
        console.log("C pressed!")
        debug.toggleCoordinateSystemOverlay(scene);
      }
    });

    // Optionally, add overlay by default:

    // Add click outside popup to close it
    document.addEventListener('click', (event) => {
      if (!popup.contains(event.target)) {
        hidePopup();
      }
    });

    renderer.domElement.addEventListener('click', function() {
      renderer.domElement.requestPointerLock();
    });

    document.addEventListener('mousemove', function(event) {
      if (document.pointerLockElement === renderer.domElement) {
        const sensitivity = 0.002; 
        cameraControls.azimuthAngle -= event.movementX * sensitivity;
        cameraControls.polarAngle -= event.movementY * sensitivity;
      }
    });

    // Add click event listener after scene is loaded
    window.addEventListener('click', onMouseClick);
    snapButton.addEventListener('click', snapToSelectedAnchor);
    animate();
  });
});



// Create camera position display box
const cameraPositionBox = document.createElement('div');
cameraPositionBox.className = 'camera-position-box';
cameraPositionBox.style.cssText = `
  position: fixed;
  top: 20px;
  left: 20px;
  background: rgba(30, 30, 30, 0.95);
  color: #fff;
  padding: 12px 16px;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 1px solid #444;
`;
cameraPositionBox.innerHTML = `
  <div style="font-weight: bold; margin-bottom: 4px;">Camera Position</div>
  <div>X: <span id="cam-x">0.00</span></div>
  <div>Y: <span id="cam-y">0.00</span></div>
  <div>Z: <span id="cam-z">0.00</span></div>
`;
document.body.appendChild(cameraPositionBox);

// Create unsnap button
const unsnapButton = document.createElement('button');
unsnapButton.textContent = 'Unsnap Camera';
unsnapButton.className = 'unsnap-button';
unsnapButton.style.cssText = `
  position: fixed;
  top: 80px;
  right: 155px;
  font-size: 1rem;
  padding: 4px 12px;
  border-radius: 4px;
  border: none;
  background: #ff4757;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
  z-index: 1000;
  display: none;
`;
document.body.appendChild(unsnapButton);

const resetButton = document.createElement('button');
resetButton.textContent = 'Reset Camera';
resetButton.className = 'reset-button';
resetButton.style.cssText = `
  position: fixed;
  top: 80px;
  right: 15px;
  font-size: 1rem;
  padding: 4px 12px;
  border-radius: 4px;
  border: none;
  background: #4b6584;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
  z-index: 1000;
`;
document.body.appendChild(resetButton);

function resetCamera() {
  cameraControls.setLookAt(
    20, 20, 20,  // Initial camera position
    0, 0, 0,     // Look at origin
    true         // Smooth transition
  );
  
  hidePopup();
  unsnapButton.style.display = 'none';
}

resetButton.addEventListener('click', resetCamera);

// Function to unsnap camera
function unsnapCamera() {
  // Hide popup
  hidePopup();
  
  // Hide unsnap button
  unsnapButton.style.display = 'none';
}

const crosshair = document.createElement('div');
crosshair.id = 'viewport-crosshair';
crosshair.style.cssText = `
  position: fixed;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  transform: translate(-50%, -50%);
  pointer-events: none; /* Crucial: allows clicks to pass through to the canvas */
  z-index: 1000;
`;

/* Using two nested divs to create a plus shape with a slight shadow for visibility against light stars */
crosshair.innerHTML = `
  <div style="
    position: absolute; 
    top: 9px; 
    left: 0; 
    width: 20px; 
    height: 2px; 
    background: rgba(255, 255, 255, 0.9); 
    box-shadow: 0 0 2px rgba(0,0,0,0.8);
  "></div>
  <div style="
    position: absolute; 
    top: 0; 
    left: 9px; 
    width: 2px; 
    height: 20px; 
    background: rgba(255, 255, 255, 0.9); 
    box-shadow: 0 0 2px rgba(0,0,0,0.8);
  "></div>
`;
document.body.appendChild(crosshair);

// Add click handler for unsnap button
unsnapButton.addEventListener('click', unsnapCamera);

// Function to hide popup
function hidePopup() {
  popup.style.display = 'none';
}

// 1. Destroy old elements to prevent HMR ghost clicks
const oldBtn = document.getElementById('add-system-btn');
if (oldBtn) oldBtn.remove();

const oldPanel = document.getElementById('add-system-panel');
if (oldPanel) oldPanel.remove();

// 2. Create button with an ID
const toggleAddButton = document.createElement('button');
toggleAddButton.id = 'add-system-btn';
toggleAddButton.textContent = '+ Add System';
toggleAddButton.style.cssText = `
  position: fixed;
  top: 30px;
  right: 350px;
  font-size: 1rem;
  padding: 4px 12px;
  border-radius: 4px;
  border: none;
  background: #20bf6b;
  color: #fff;
  cursor: pointer;
  z-index: 1000;
`;
document.body.appendChild(toggleAddButton);

// 3. Create panel with an ID
const addSystemPanel = document.createElement('div');
addSystemPanel.id = 'add-system-panel';
addSystemPanel.style.cssText = `
  position: fixed;
  top: 70px;
  right: 350px;
  background: rgba(30, 30, 30, 0.95);
  color: #fff;
  padding: 16px;
  border-radius: 8px;
  font-family: monospace;
  z-index: 1000;
  display: none;
  border: 1px solid #444;
  width: 250px;
`;

addSystemPanel.innerHTML = `
  <h3 style="margin-top: 0;">New Star System</h3>
  <form style="display: flex; flex-direction: column; gap: 8px;">
    <input type="text" id="new-hubtag" placeholder="Hubtag" required style="padding: 4px;">
    <input type="text" id="new-name" placeholder="System Name" required style="padding: 4px;">
    <input type="text" id="new-color" placeholder="Stellar class (blue, red, green, etc.)" required style="padding: 4px;">
    <input type="number" step="any" id="new-a" placeholder="Distance from anchor A" required style="padding: 4px;">
    <input type="number" step="any" id="new-b" placeholder="Distance from anchor B" required style="padding: 4px;">
    <input type="number" step="any" id="new-c" placeholder="Distance from anchor C" required style="padding: 4px;">
    <input type="number" step="any" id="new-d" placeholder="Distance from anchor D" required style="padding: 4px;">
    <input type="number" step="any" id="new-e" placeholder="Distance from anchor E" required style="padding: 4px;">
    <button type="submit" style="margin-top: 8px; padding: 6px; background: #4b6584; color: white; border: none; cursor: pointer;">Submit to Database</button>
  </form>
  <div id="add-status" style="margin-top: 8px; font-size: 12px;"></div>
`;
document.body.appendChild(addSystemPanel);

// 4. Prevent UI clicks from triggering the raycaster
toggleAddButton.addEventListener('click', (event) => {
  event.stopPropagation();
  
  if (addSystemPanel.style.display !== 'block') {
    addSystemPanel.style.display = 'block';
    document.exitPointerLock(); 
  } else {
    addSystemPanel.style.display = 'none';
  }
});

// 5. Prevent form clicks from triggering the raycaster
addSystemPanel.addEventListener('click', (event) => {
  event.stopPropagation();
});

const form = addSystemPanel.querySelector('form');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  const statusDiv = addSystemPanel.querySelector('#add-status');
  statusDiv.textContent = 'Submitting...';
  statusDiv.style.color = '#fff';
  
  const payload = {
    id: addSystemPanel.querySelector('#new-hubtag').value,
    name: addSystemPanel.querySelector('#new-name').value,
    color: addSystemPanel.querySelector('#new-color').value,
    new_a: parseFloat(addSystemPanel.querySelector('#new-a').value),
    new_b: parseFloat(addSystemPanel.querySelector('#new-b').value),
    new_c: parseFloat(addSystemPanel.querySelector('#new-c').value),
    new_d: parseFloat(addSystemPanel.querySelector('#new-d').value),
    new_e: parseFloat(addSystemPanel.querySelector('#new-e').value)
  };

  try {
    const response = await fetch(BACKEND + 'add-system', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Server rejected request');
    }

    statusDiv.textContent = 'Success! System added.';
    statusDiv.style.color = '#20bf6b';
    event.target.reset();
    
  } catch (error) {
    statusDiv.textContent = 'Error submitting data.';
    statusDiv.style.color = '#fc5c65';
    console.error('Failed to submit:', error);
  }
});
