import * as THREE from 'three';
import CameraControls from 'camera-controls';
import $ from 'jquery';
import * as tri from './trilateration.js';
import * as debug from './debug.js';
import * as astro from './astrometry.js';
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
const GALAXY = "euclid";
// Don't forget to also change what backend is running

// Keyboard controls state
var keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  q: false, // Up
  e: false  // Down
};
const CAMERA_MOVE_SPEED = 75; // units per second

// ---------------------Basic setup - TESTING HMR------------------------------- //
function initializeScene() { 
  return new Promise(function(resolve, reject) {
    // Set up scene, camera, and renderer
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

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
    camera.position.set(20, 20, 20); // Offset from origin
    cameraControls.setTarget(0, 0, 0, true); // Look at origin where Sun Tzu should be

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

export function updateAnchorDropdown(anchors = null) {
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

// Click handler for snapping to systems
function onMouseClick(event) {
 // const cameraControls = cameraControls;
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
        
        // Show unsnap button
        unsnapButton.style.display = 'block';
      };
      
      cameraControls.addEventListener('rest', onCameraRest);
    }
  } else {
    // Hide popup if clicking on empty space
    hidePopup();
  }
}


// Keyboard event handlers
function onKeyDown(event) {
  const key = event.key.toLowerCase();
  //console.log("KEY PRESSED: ", key, "Event:", event);
  if (key in keys) {
    keys[key] = true;
    //console.log('Key pressed:', key, 'Keys state:', keys);
    event.preventDefault();
  } else {
    console.log('Key not in keys object:', key);
  }
}

function onKeyUp(event) {
  const key = event.key.toLowerCase();
  if (key in keys) {
    keys[key] = false;
    //console.log('Key released:', key, 'Keys state:', keys);
    event.preventDefault();
  }
}

// Handle camera movement based on keyboard input
function handleCameraMovement(delta) {
  if (!cameraControls) return;
  
  // Check if any keys are pressed
  const anyKeyPressed = keys.w || keys.a || keys.s || keys.d || keys.q || keys.e;
  if (!anyKeyPressed) return;
  
  const moveDistance = CAMERA_MOVE_SPEED * delta;
  const moveVector = new THREE.Vector3();
  
  // Get camera direction vectors (forward direction)
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  
  // Calculate right vector (perpendicular to camera direction and up)
  const rightVector = new THREE.Vector3();
  rightVector.crossVectors(cameraDirection, camera.up).normalize();
  
  // Debug: Check if right vector is valid
  if (rightVector.length() < 0.1) {
    console.warn('Right vector is too small, using fallback');
    rightVector.set(1, 0, 0); // Fallback to world X axis
  }
  
  // Use world up vector for vertical movement
  const upVector = new THREE.Vector3(0, 1, 0);
  
  // Debug: Log camera vectors
  console.log('Camera vectors:', {
    direction: cameraDirection.toArray(),
    right: rightVector.toArray(),
    up: upVector.toArray(),
    moveDistance: moveDistance
  });
  
  // Calculate movement based on pressed keys
  if (keys.w) {
    moveVector.add(cameraDirection.clone().multiplyScalar(moveDistance));
  }
  if (keys.s) {
    moveVector.add(cameraDirection.clone().multiplyScalar(-moveDistance));
  }
  if (keys.a) {
    moveVector.add(rightVector.clone().multiplyScalar(-moveDistance));
  }
  if (keys.d) {
    const rightMovement = rightVector.clone().multiplyScalar(moveDistance);
    moveVector.add(rightMovement);
    console.log('D pressed - adding right movement:', rightMovement.toArray());
    console.log('D key - rightVector:', rightVector.toArray(), 'moveDistance:', moveDistance);
    console.log('D key - rightVector length:', rightVector.length());
  }
  if (keys.q) {
    moveVector.add(upVector.clone().multiplyScalar(moveDistance));
  }
  if (keys.e) {
    moveVector.add(upVector.clone().multiplyScalar(-moveDistance));
  }
  
  // Debug: Test with a simple movement if no keys are working
  if (moveVector.length() === 0 && (keys.w || keys.a || keys.s || keys.d)) {
    console.log('No movement calculated, testing with simple forward movement');
    moveVector.set(0, 0, -moveDistance); // Simple forward movement
  }
  
  // Debug: Test D key specifically with simple right movement
  if (keys.d && moveVector.length() === 0) {
    console.log('D key pressed but no movement, using simple right movement');
    moveVector.set(moveDistance, 0, 0); // Simple right movement along X axis
  }
  
  // Apply movement to camera target only
  if (moveVector.length() > 0) {
    const oldPos = cameraControls.getPosition();
    const oldTarget = cameraControls.getTarget();

    const newPos = oldPos.clone().add(moveVector);
    
    const newTarget = {
      x: oldTarget.x + moveVector.x,
      y: oldTarget.y + moveVector.y,
      z: oldTarget.z + moveVector.z
    };
    
    // Move only the target, let camera controls handle camera positioning
    //cameraControls.setTarget(newTarget.x, newTarget.y, newTarget.z, false);
    //camera.position.set(newTarget.x, newTarget.y, newTarget.z)
    cameraControls.setPosition(newPos.x, newPos.y, newPos.z);
    cameraControls.setTarget(newTarget.x, newTarget.y, newTarget.z);
    
    // Debug logging (can be removed later)
    
  }
}

// Function to update camera position display
function updateCameraPositionDisplay() {
  const camX = document.getElementById('cam-x');
  const camY = document.getElementById('cam-y');
  const camZ = document.getElementById('cam-z');
  const keyW = document.getElementById('key-w');
  const keyA = document.getElementById('key-a');
  const keyS = document.getElementById('key-s');
  const keyD = document.getElementById('key-d');
  
  if (camX && camY && camZ && camera) {
    camX.textContent = camera.position.x.toFixed(2);
    camY.textContent = camera.position.y.toFixed(2);
    camZ.textContent = camera.position.z.toFixed(2);
  }
  
  if (keyW && keyA && keyS && keyD) {
    keyW.textContent = keys.w ? 'true' : 'false';
    keyA.textContent = keys.a ? 'true' : 'false';
    keyS.textContent = keys.s ? 'true' : 'false';
    keyD.textContent = keys.d ? 'true' : 'false';
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
    const geometry = new THREE.SphereGeometry(.8, 16, 16);
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
  <div style="margin-top: 8px; font-size: 12px;">
    <div>W: <span id="key-w">false</span></div>
    <div>A: <span id="key-a">false</span></div>
    <div>S: <span id="key-s">false</span></div>
    <div>D: <span id="key-d">false</span></div>
  </div>
`;
document.body.appendChild(cameraPositionBox);

// Create unsnap button
const unsnapButton = document.createElement('button');
unsnapButton.textContent = 'Unsnap Camera';
unsnapButton.className = 'unsnap-button';
unsnapButton.style.cssText = `
  position: fixed;
  top: 30px;
  right: 250px;
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

// Function to unsnap camera
function unsnapCamera() {
  // Return camera to default position
  cameraControls.setLookAt(
    50, 50, 50,  // Default camera position
    0, 0, 0,     // Look at origin
    true         // Smooth transition
  );
  
  // Hide popup
  hidePopup();
  
  // Hide unsnap button
  unsnapButton.style.display = 'none';
}

// Add click handler for unsnap button
unsnapButton.addEventListener('click', unsnapCamera);

// Function to fetch data from No Man's Sky Miraheze wiki
async function fetchWikiData(systemName) {
  try {
    // Clean the system name for wiki search
    const cleanName = systemName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    
    // First, search for the system page
    const searchUrl = `https://nmsgalactichub.miraheze.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanName)}&format=json&origin=*`;
    
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`Search request failed: ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData.query || searchData.query.search.length === 0) {
      return { error: `No wiki page found for system: ${systemName}` };
    }
    
    // Get the first search result (most relevant)
    const pageId = searchData.query.search[0].pageid;
    const pageTitle = searchData.query.search[0].title;
    
    // Fetch the page content
    const contentUrl = `https://nmsgalactichub.miraheze.org/w/api.php?action=parse&pageid=${pageId}&format=json&origin=*`;
    
    const contentResponse = await fetch(contentUrl, {
      method: 'GET',
      headers: new Headers( {
        'Api-User-Agent': 'Soideos (thesoideosinterface@gmail.com)'
      })
    });
    if (!contentResponse.ok) {
      throw new Error(`Content request failed: ${contentResponse.status}`);
    }
    
    const contentData = await contentResponse.json();
    
    if (!contentData.parse) {
      return { error: `Could not parse wiki page for: ${systemName}` };
    }
    
    // Extract useful information from the parsed content
    const htmlContent = contentData.parse.text['*'];
    
    // Create a temporary DOM element to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // Extract key information
    const wikiData = {
      title: pageTitle,
      url: `https://nmsgalactichub.miraheze.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`,
      summary: '',
      galaxy: '',
      region: '',
      planets: '',
      moons: '',
      spectral_class: '',
      distance: '',
      glyphs: '',
      waterworlds: '',
      dissonant: '',
      faction: '',
      economy: '',
      wealth: '',
      conflict: '',
      discoveredBy: '',
    };
    
    // Try to extract information from infobox or content
    const infobox = tempDiv.querySelector('.infoboxWrap');
    console.log(infobox);
    if (infobox) {
      const rowData = infobox.querySelectorAll('.pi-data-value');
      const rowLabels = infobox.querySelectorAll('.pi-data-label');
      
      rowLabels.forEach((row, i) => {
        const label = row.innerText.trim().toLowerCase();
        const value = rowData[i].innerText.trim();

        if (label.includes('galaxy')) wikiData.galaxy = value;
        else if (label.includes('region')) wikiData.region = value;
        else if (label.includes('planets')) wikiData.planets = value;
        else if (label.includes('moons')) wikiData.moons = value;
        else if (label.includes('spectral class')) wikiData.spectral_class = value;
        else if (label.includes('distance')) wikiData.distance = value;
        else if (label.includes('glyphs')) wikiData.glyphs = value;
        else if (label.includes('waterworld')) wikiData.waterworlds = value;
        else if (label.includes('dissonant')) wikiData.dissonant = value;
        else if (label.includes('faction')) wikiData.faction = value;
        else if (label.includes('economy')) wikiData.economy = value;
        else if (label.includes('conflict')) wikiData.conflict = value;
        else if (label.includes('discovered by')) wikiData.discoveredBy = value;
      });
    }
    
    // Extract summary from first paragraph
    const paragraphs = tempDiv.querySelectorAll('p');
    for (let p of paragraphs) {
      const text = p.textContent.trim();
      if (text.length > 50 && !text.includes('this article') && !text.includes('this page')) {
        wikiData.summary = text.substring(0, 200) + (text.length > 200 ? '...' : '');
        break;
      }
    }
    
    return wikiData;
    
  } catch (error) {
    console.error('Error fetching wiki data:', error);
    return { error: `Failed to fetch wiki data for ${systemName}: ${error.message}` };
  }
}

// Function to show system popup
async function showSystemPopup(systemName, worldPosition) {
  // Find system data

  const system = Object.fromEntries(
    Object.entries(stars)
      .filter(([key, value]) => value.name === systemName) // Filter entries where value is a string
  )[systemName];
  
  if (!system) {
    console.warn(`No data found for system: ${systemName}`);
    return;
  }
  
  // Convert 3D world position to screen coordinates
  const screenPosition = worldPosition.clone().project(camera);
  
  // Convert to pixel coordinates
  const mouseX = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
  const mouseY = (-screenPosition.y * 0.5 + 0.5) * window.innerHeight;
  
  // Show loading state
  popup.innerHTML = `
    <div class="system-name">${systemName}</div>
    <div class="loading-container">
      <div class="loading-spinner"></div>
      Loading wiki data...
    </div>
  `;
  
  // Position popup
  const popupWidth = 400;
  const popupHeight = 200;
  
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
  
  // Fetch wiki data
  const wikiData = await fetchWikiData(systemName);
  
  // Format the system data
  const formattedData = JSON.stringify(system, null, 2);
  
  // Create wiki data section
  let wikiSection = '';
  if (wikiData.error) {
    wikiSection = `
      <div class="wiki-section">
        <div class="wiki-title"> ${systemName} </div>
        ${JSON.parse(system.anchors).B}LY from Capital
        <div class="error-message">Wiki Data</div>
        <div class="error-text">${wikiData.error}</div>
      </div>
    `;
  } else {
    wikiSection = `
      <div class="wiki-section">
        <div class="wiki-title">
          <a href="${wikiData.url}">${wikiData.title}</a>
        </div>
        ${JSON.parse(system.anchors).B}LY from Capital
        ${wikiData.summary ? `<div class="wiki-summary">${wikiData.summary}</div>` : ''}
        ${wikiData.galaxy ? `<div class="wiki-info"><strong>Galaxy:</strong> ${wikiData.galaxy}</div>` : ''}
        ${wikiData.region ? `<div class="wiki-info"><strong>Region:</strong> ${wikiData.region}</div>` : ''}
        ${wikiData.planets ? `<div class="wiki-info"><strong>Planets:</strong> ${wikiData.planets}</div>` : ''}
        ${wikiData.moons ? `<div class="wiki-info"><strong>Moons:</strong> ${wikiData.moons}</div>` : ''}
        ${wikiData.spectral_class ? `<div class="wiki-info"><strong>Spectral Class:</strong> ${wikiData.spectral_class}</div>` : ''}
        ${wikiData.distance ? `<div class="wiki-info"><strong>Distance:</strong> ${wikiData.distance}</div>` : ''}
        ${wikiData.glyphs ? `<div class="wiki-info glyphs"><strong>Glyphs:</strong> ${wikiData.glyphs}</div>` : ''}
        ${wikiData.waterworlds ? `<div class="wiki-info"><strong>Waterworlds:</strong> ${wikiData.waterworlds}</div>` : ''}
        ${wikiData.dissonant ? `<div class="wiki-info"><strong>Dissonant:</strong> ${wikiData.dissonant}</div>` : ''}
        ${wikiData.faction ? `<div class="wiki-info"><strong>Faction:</strong> ${wikiData.faction}</div>` : ''}
        ${wikiData.economy ? `<div class="wiki-info"><strong>Economy:</strong> ${wikiData.economy}</div>` : ''}
        ${wikiData.wealth ? `<div class="wiki-info"><strong>Wealth:</strong> ${wikiData.wealth}</div>` : ''}
        ${wikiData.conflict ? `<div class="wiki-info"><strong>Conflict:</strong> ${wikiData.conflict}</div>` : ''}
        ${wikiData.discoveredBy ? `<div class="wiki-info"><strong>Discovered by:</strong> ${wikiData.discoveredBy}</div>` : ''}
      </div>
    `;
  }
  
  // Update popup content with both system data
  popup.innerHTML = `${wikiSection}`;
  
  // Update popup size based on content
  const newHeight = Math.min(600, popup.scrollHeight);
  popup.style.height = `${newHeight}px`;
}

// Function to hide popup
function hidePopup() {
  popup.style.display = 'none';
}
