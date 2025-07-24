import * as THREE from 'three';
import CameraControls from 'camera-controls';
import $ from 'jquery';
import * as tri from './trilateration.js';
import * as debug from './debug.js';
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

// ---------------------Basic setup - TESTING HMR------------------------------- //
function initializeScene() { 
  return new Promise(function(resolve, reject) {
    // Set up scene, camera, and renderer
    var scene = new THREE.Scene();
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

    //console.log("blah",scene)
    var data = {cameraControls: cameraControls, camera: camera, renderer: renderer, scene: scene, clock: clock, popup: popup, mouse: mouse, raycaster: raycaster};//, pivot: pivot}
    //console.log(htmlVars);
    
    if (data) {
      resolve(data);
    }
  });
}




export async function getScene() {
  const sceneData = await initializeScene();
  //console.log(window.htmlVars)
  return sceneData.scene;
}



// --- Anchor Snap UI Logic --- //
// Store anchor data for snapping
let anchorList = [];
const anchorSelect = document.getElementById('anchor-select');
const snapButton = document.getElementById('snap-anchor-btn');

function updateAnchorDropdown() {
  //console.log(anchorList)
  anchorSelect.innerHTML = '';
  if (!anchorList || anchorList.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No anchors';
    anchorSelect.appendChild(opt);
    snapButton.disabled = true;
    return;
  }
  for (const anchor of anchorList) {
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
let systemData = {};

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

// Function to update system coordinates on the backend
async function updateSystemCoordinates(systemName, coordinates) {
  try {
    const updateData = {
      name: systemName,
      ghc_x: coordinates[0],
      ghc_y: coordinates[1],
      ghc_z: coordinates[2]
    };

    const response = await fetch('http://192.168.1.96:4000/update-coordinates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Updated coordinates for ${systemName}: [${coordinates[0].toFixed(2)}, ${coordinates[1].toFixed(2)}, ${coordinates[2].toFixed(2)}]`);
    return result;
  } catch (error) {
    console.error(`Failed to update coordinates for ${systemName}:`, error.message);
    return null;
  }
}

// -----------------------Functions------------------------------- //
// Fetch system database and process the data
async function processAstrometrics() {
  let stars = [];
  try {
    const res = await fetch("http://192.168.1.96:3000/systems"); // Port 3000 for Euclid
    if (!res.ok) throw new Error("Failed to fetch systems: " + res.status);
    stars = await res.json();
  } catch (err) {
    console.error("Could not fetch systems from backend:", err);
    alert("Could not load star systems from backend. Is the server running?");
    return; // Stop further processing
  }

  const all_anchors = stars.filter(obj => obj.is_anchor).sort((a, b) => { return a.anchor_id.localeCompare(b.anchor_id)});
  anchorList = all_anchors; // Save for UI
  //console.log("All anchors: ", all_anchors); 
  // Load validation data
  let validationData = [];
  try {
    const validationRes = await fetch("./validation_data.json");
    validationData = await validationRes.json();
  } catch (error) {
    console.warn("Could not load validation_data.json:", error);
  }

    // Build N x N pairwise distance matrix for anchors
    const N = all_anchors.length;
    const distMatrix = [];
    for (let i = 0; i < N; i++) {
      const i_id = all_anchors[i].anchor_id;

      distMatrix[i] = [];
      for (let j = 0; j < N; j++) {
        const j_id = all_anchors[j].anchor_id;
        if (i === j) {
          distMatrix[i][j] = 0;
        } else {
          // Try to get the distance from anchor i to anchor j
          // Use anchor_id as key
          let d = JSON.parse(all_anchors[i].anchors)[j_id];
          if (d === undefined) d = all_anchors[i].anchors[j_id];
          if (typeof d !== 'number') {
            // Try the reverse direction
            d = all_anchors[j].anchors[i_id];
            if (d === undefined) d = all_anchors[j].anchors[i_id];
          }
          distMatrix[i][j] = (typeof d === 'number') ? d : 0; // or NaN if you want to catch missing data
        }
      }
    }

    // Now reconstruct anchor positions
    //console.log("Dist matrix: ", distMatrix);
    const anchorPositions = tri.reconstructAnchorsFromPairwiseDistances(distMatrix);
    //console.log("blah",anchorPositions)
    //console.log('Reconstructed anchor positions:', anchorPositions);

    for (let i = 0; i < anchorPositions.length; i++) {
        all_anchors[i].ghc_x = anchorPositions[i][0];
        all_anchors[i].ghc_y = anchorPositions[i][1];
        all_anchors[i].ghc_z = anchorPositions[i][2];
    }

    //console.log("Anchor positions:", all_anchors);

    const {origin, basis} = tri.buildBasis(anchorPositions);
    //console.log("Origin: ", origin, "Basis: ", basis);

    const GHUB_COORDINATE_SYSTEM = {
      origin: origin,
      basis: basis,
      anchors: all_anchors
      //anchor_ids: all_anchors.map((anchor) => anchor.anchor_id).sort()
    }
    //console.log(axesHelper);
    //axesHelper.position = GHUB_COORDINATE_SYSTEM.origin;
    //console.log("IDs:", GHUB_COORDINATE_SYSTEM.anchor_ids);


  //const basis = tri.buildBasis(anchors.A, anchors.B, anchors.C);
  
  // Start camera centered on Sun Tzu system at origin
  camera.position.set(20, 20, 20); // Offset from origin
  cameraControls.setTarget(0, 0, 0, true); // Look at origin where Sun Tzu should be

  //const P4 = tri.trilateratePoint(stars[3].name, anchors.A, anchors.B, anchors.C, stars[3].A, stars[3].B, stars[3].C)
  
  // Store system data for popup
  stars.forEach(system => {
    //updateSystemCoordinates(system.name, [system.ghc_x, system.ghc_y, system.ghc_z]);
    systemData[system.name] = system;
  });

  // Use the loaded star data
  let processedCount = 0;
  for (const system of stars) {
    //console.log("System", system)
    const sys_anchors = JSON.parse(system.anchors);
    //console.log("distance", sys_anchors)
    // Estimate star position using multilateration
    let star_pos;
    try {
      star_pos = tri.multilaterate(GHUB_COORDINATE_SYSTEM, sys_anchors);
      console.log(star_pos)
    } catch (e) {
      console.warn(`Failed to multilaterate position for system ${system.name}:`, e);
      continue;
    }

    // Material for stars
    const starMaterial = new THREE.MeshBasicMaterial({ color: system.color});
    const geometry = new THREE.SphereGeometry(.8, 16, 16);
    const star = new THREE.Mesh(geometry, starMaterial);
    
    star.position.set(star_pos[0], star_pos[1], star_pos[2]);
    star.name = system.name;
    scene.add(star);
    
    // Update progress
    processedCount++;
    if (processedCount % 10 === 0 || processedCount === stars.length) {
      console.log(`Processed ${processedCount}/${stars.length} systems (${((processedCount/stars.length)*100).toFixed(1)}%)`);
    }
  }

  console.log(`${stars.length} systems mapped!`)
  
  // Position camera offset from origin looking at it
  camera.position.set(50, 50, 50); // Offset from origin
  cameraControls.setTarget(all_anchors[1].ghc_x, all_anchors[1].ghc_y, all_anchors[1].ghc_z, false); // Look at origin where first anchor now is
  
  // Run validation on the loaded data
  //const validationResults = validateCalculatedPositions(stars, validationData);
  const validationResults = false;
  if (validationResults) {
    console.log("Position validation completed. Check console for detailed results.");
  }
  

  updateAnchorDropdown();
}

processAstrometrics();

// -----------------------Begin render------------------------------- //


// Animation loop
function animate() {
  const delta = clock.getDelta();
	const elapsed = clock.getElapsedTime();
	const updated = cameraControls.update(delta);


  //if (!disableAutoRotate) {
      //cameraControls.azimuthAngle += -10 * delta * THREE.MathUtils.DEG2RAD;
      //cameraControls.polarAngle += 10 * delta * THREE.MathUtils.DEG2RAD;
  //}

  requestAnimationFrame(animate);

  if (updated) {
		renderer.render( scene, camera );
	}
}
let firstPass = true;
initializeScene().then(function(data) {
  clock = data.clock;
  scene = data.scene;
  camera = data.camera;
  cameraControls = data.cameraControls;
  renderer = data.renderer;
  mouse = data.mouse;
  popup = data.popup;
  raycaster = data.raycaster;

  if (firstPass) {
    firstPass = false;
    
  debug.addCoordinateSystemOverlay(scene);
  }

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

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



// Create unsnap button
const unsnapButton = document.createElement('button');
unsnapButton.textContent = 'Unsnap Camera';
unsnapButton.className = 'unsnap-button';
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
  popup.innerHTML = `
    <div class="system-name">${systemName}</div>
    <div class="wiki-info">${system.B}LY from Capital</div>
    ${wikiSection}
  `;
  
  // Update popup size based on content
  const newHeight = Math.min(600, popup.scrollHeight);
  popup.style.height = `${newHeight}px`;
}

// Function to hide popup
function hidePopup() {
  popup.style.display = 'none';
}
