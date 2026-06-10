// IMPORTS AND ENVIRONMENT
import * as THREE from 'three';
import CameraControls from 'camera-controls';
import $ from 'jquery';
import * as tri from './trilateration.js';
import * as debug from './debug.js';
import * as astro from './astrometry.js';
import * as ui from './ui.js';
import { validateCalculatedPositions } from './validation.js';
import validationData from './validation_data.json';
import './popup.css';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { setupFilters } from './filter.js';
import 'jquery-csv';

window.jQuery = $;
const BACKEND = import.meta.env.VITE_BACKEND_URL;

// GLOBAL STATE AND PHYSICS CONSTANTS
let clock = null;
let scene = null;
let camera = null;
let cameraControls = null;
let renderer = null;
let composer = null;
let popup = null;
let mouse = null;
let raycaster = null;

window.currentGalaxy = "euclid";
let labelsVisible = true;
let systemList = [];
let stars = {};
let firstPass = true;

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  arrowup: false,
  arrowdown: false,
  arrowleft: false,
  arrowright: false,
  ' ': false, 
  shift: false, 
  h: false,
  f: false,
  fToggle: true
};

const CAMERA_MOVE_SPEED = 125; 
let velocity = new THREE.Vector3(0, 0, 0);
let holdTime = 0;
let lookVelocity = new THREE.Vector2(0, 0);

const lookSensitivity = 0.0001; 
const lookFriction = 0.9; 
const baseSpeed = 10.0;
const maxSpeed = 500.0;
const timeToMax = 1.5; 
const friction = 0.92;

// CORE WEBGL AND SCENE INITIALIZATION
function initializeScene() { 
  return new Promise(function(resolve, reject) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.FogExp2(0x1a0a2a, 0.0007);

    createBackgroundStarfield(scene);

    CameraControls.install({THREE: THREE});
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera( 60, width / height, 0.01, 5000 );
    renderer = new THREE.WebGLRenderer({ antialias: true });
    
    window.cameraControls = new CameraControls( camera, renderer.domElement );
    cameraControls = window.cameraControls;
    
    window.cameraControls.touches.one = CameraControls.ACTION.TOUCH_ROTATE;
    window.cameraControls.touches.two = CameraControls.ACTION.TOUCH_DOLLY_TRUCK;
    window.cameraControls.touches.three = CameraControls.ACTION.NONE;
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0px';
    renderer.domElement.style.left = '0px';
    document.body.appendChild(renderer.domElement);

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5, 
      0.6, 
      0.0  
    );

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(500, 500, 500);
    scene.add(light);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    popup = document.createElement('div');
    popup.className = 'system-popup';
    document.body.appendChild(popup);

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

    cameraControls.setLookAt(20, 20, 20, 0, 0, 0, false);

    setupFilters(
      scene,
      () => labelsVisible,
      () => {
        if (composer) composer.render();
        else if (renderer) renderer.render(scene, camera);
      }
    );

    const data = {cameraControls: cameraControls, camera: camera, renderer: renderer, clock: clock, popup: popup, mouse: mouse, raycaster: raycaster};
    if (data) resolve(data);
  });
}

export async function getScene() {
  await initializeScene();
  return scene;
}

// MESH AND GEOMETRY GENERATION
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
  
  for (let i = 0; i < particleCount; i++) {
    const x = (Math.random() - 0.5) * 8000;
    const y = (Math.random() - 0.5) * 8000;
    const z = (Math.random() - 0.5) * 8000;
    starVertices.push(x, y, z);
  }

  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
  const backgroundStars = new THREE.Points(starGeometry, starMaterial);
  backgroundStars.name = "BackgroundStarfield"; 
  
  scene.add(backgroundStars);
}

function createTextSprite(message) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  const fontSize = 24;
  context.font = `${fontSize}px Arial`;

  const metrics = context.measureText(message);
  const textWidth = metrics.width;

  canvas.width = textWidth + 10;
  canvas.height = fontSize + 10;

  context.font = `${fontSize}px Arial`;
  context.fillStyle = "rgba(0, 255, 255, 0.9)";
  context.shadowColor = "rgba(0, 255, 255, 0.5)";
  context.shadowBlur = 0.5;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(message, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  
  const spriteMaterial = new THREE.SpriteMaterial({ 
    map: texture, 
    transparent: true,
    depthTest: false 
  });
  
  const sprite = new THREE.Sprite(spriteMaterial);
  const scaleMultiplier = 0.08; 
  sprite.scale.set(canvas.width * scaleMultiplier, canvas.height * scaleMultiplier, 1);
  
  return sprite;
}

async function placeStars(starData, scene) {
  const starsToRemove = scene.children.filter(child => child.userData && child.userData.isSystemStar);
  
  starsToRemove.forEach(star => {
    if (star.geometry) star.geometry.dispose();
    if (star.material) {
      if (star.material.map) star.material.map.dispose(); 
      star.material.dispose();
    }
    scene.remove(star);
  });

  console.log("placeStars called with", Object.keys(starData).length, "systems");
  let starsPlaced = 0;
  
  for (const system in starData) {
    const starPos = [starData[system].ghc_x, starData[system].ghc_y, starData[system].ghc_z];
    
    if (starPos[0] === null || starPos[0] === undefined || 
        starPos[1] === null || starPos[1] === undefined || 
        starPos[2] === null || starPos[2] === undefined) {
      continue;
    }

    const scale = 1;
    const renderX = -starPos[0] * scale;
    const renderY = starPos[1] * scale;
    const renderZ = starPos[2] * scale;

    const starMaterial = new THREE.MeshBasicMaterial({ color: starData[system].color || 0xffffff});
    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const star = new THREE.Mesh(geometry, starMaterial);
    
    star.position.set(renderX, renderY, renderZ);
    
    const wikiData = starData[system].wiki_data;
    star.name = starData[system].name;
    star.userData.isSystemStar = true; 
    star.userData.systemData = starData[system]; 
    star.userData.wikiData = wikiData; 

    scene.add(star);

    const hubtag = starData[system].id  + " " + starData[system].name; 
    
    if (hubtag && hubtag.trim() !== '') {
      const labelSprite = createTextSprite(hubtag);
      labelSprite.position.set(renderX, renderY + 3.5, renderZ);
      labelSprite.userData.isSystemStar = true; 
      labelSprite.userData.isLabel = true; 
      labelSprite.visible = labelsVisible;
      labelSprite.userData.systemData = starData[system]; 
      labelSprite.userData.wikiData = wikiData; 

      scene.add(labelSprite);
    }

    starsPlaced++;
  }
  
  console.log(`Placed ${starsPlaced} stars and labels in scene.`);
}

// CAMERA MATH AND MOVEMENT PHYSICS
function handleCameraMovement(keysPressed, cameraObj, controlsObj, delta) {
  if (!cameraObj || !controlsObj) return;

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraObj.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraObj.quaternion);
  const up = new THREE.Vector3(0, 1, 0); 
  
  forward.y = 0; forward.normalize();
  right.y = 0; right.normalize();

  const moveDir = new THREE.Vector3(0, 0, 0);
  let isMoving = false;

  if (keysPressed.w || keysPressed.arrowup) { moveDir.add(forward); isMoving = true; }
  if (keysPressed.s || keysPressed.arrowdown) { moveDir.sub(forward); isMoving = true; }
  if (keysPressed.a || keysPressed.arrowleft) { moveDir.sub(right); isMoving = true; }
  if (keysPressed.d || keysPressed.arrowright) { moveDir.add(right); isMoving = true; }
  if (keysPressed[' ']) { moveDir.add(up); isMoving = true; } 
  if (keysPressed.shift) { moveDir.sub(up); isMoving = true; }

  if (isMoving) {
    holdTime += delta;
    
    const rampUp = Math.min(holdTime / timeToMax, 1.0);
    const currentSpeedLimit = baseSpeed + ((maxSpeed - baseSpeed) * rampUp);
    const maxFrameSpeed = currentSpeedLimit * delta;
    const accelerationRate = maxFrameSpeed * 4.0; 
    
    moveDir.normalize().multiplyScalar(accelerationRate * delta);
    velocity.add(moveDir); 
    velocity.multiplyScalar(0.95);
    
    if (velocity.length() > maxFrameSpeed) {
      velocity.setLength(maxFrameSpeed);
    }
  } else {
    holdTime -= delta * 3.0; 
    if (holdTime < 0) holdTime = 0;
    velocity.multiplyScalar(friction); 
  }

  if (velocity.lengthSq() > 0.000001) {
    const currentPos = new THREE.Vector3();
    const currentTarget = new THREE.Vector3();
    
    controlsObj.getPosition(currentPos);
    controlsObj.getTarget(currentTarget);
    
    currentPos.add(velocity);
    currentTarget.add(velocity);
    
    controlsObj.setLookAt(
      currentPos.x, currentPos.y, currentPos.z,
      currentTarget.x, currentTarget.y, currentTarget.z,
      false 
    );
  }
}

function resetCamera() {
  cameraControls.setLookAt(20, 20, 20, 0, 0, 0, true);
  hidePopup();
}

function unsnapCamera() {
  hidePopup();

  const currentPos = new THREE.Vector3();
  cameraControls.getPosition(currentPos);

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const distance = 10;
  const newTarget = currentPos.clone().add(forward.multiplyScalar(distance));

  cameraControls.setLookAt(
    currentPos.x, currentPos.y, currentPos.z,
    newTarget.x, newTarget.y, newTarget.z,
    false 
  );
}
window.unsnapCamera = unsnapCamera;

function animate() {
  const delta = clock.getDelta();

  if (Math.abs(lookVelocity.x) > 0.00001 || Math.abs(lookVelocity.y) > 0.00001) {
    cameraControls.azimuthAngle += lookVelocity.x;
    cameraControls.polarAngle += lookVelocity.y;
    lookVelocity.multiplyScalar(lookFriction);
  }
  
  const updated = cameraControls.update(delta);
  handleCameraMovement(keys, camera, cameraControls, delta);
  
  updateCameraPositionDisplay();
  ui.updateTargetingComputer(camera, scene);

  requestAnimationFrame(animate);

  if (updated || velocity.lengthSq() > 0.001) {
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }
}

// DATA MANAGEMENT AND GALAXY SWAPPING
async function switchGalaxy(newGalaxy, activeBtn, inactiveBtn) {
  if (window.currentGalaxy === newGalaxy) return;

  activeBtn.classList.add('active');
  inactiveBtn.classList.remove('active');
  window.currentGalaxy = newGalaxy;

  const inputA = document.getElementById('new-a');
  const inputB = document.getElementById('new-b');
  const inputC = document.getElementById('new-c');
  const inputD = document.getElementById('new-d');
  const inputE = document.getElementById('new-e');

  if (window.currentGalaxy === 'euclid') {
    inputA.placeholder = 'Distance to [HUB12-416] Lion Shield';
    inputB.placeholder = 'Distance to [HUB1-74] Sun Tzu';
    inputC.placeholder = 'Distance to [HUB7-3FE] Aniwani';
    inputD.placeholder = 'Distance to [HUB22-406] Legods';
  } else {
    inputA.placeholder = 'Distance to [HUB44-A] Tashat';
    inputB.placeholder = 'Distance to [HUB45-A] Nasfiel-Nit';
    inputC.placeholder = 'Distance to [HUB17-A] Ochleac';
    inputD.placeholder = 'Distance to [HUB25-A] Snezhna';
  }

  if (inputE) {
    if (window.currentGalaxy === 'euclid') {
      inputE.style.display = 'none';
      inputE.required = false;
      inputE.value = ''; 
    } else {
      inputE.style.display = 'block';
      inputE.required = true;
    }
  }

  const overlay = document.getElementById('hyperspace-overlay');
  const overlayText = document.getElementById('hyper-text-content');
  overlayText.style.color = '#00ffff'; 
  overlayText.textContent = `WARPING TO ${newGalaxy.toUpperCase()}...`;
  overlay.classList.add('active');

  const systemSearchInput = document.getElementById('anchor-search');
  const snapButton = document.getElementById('snap-anchor-btn');
  
  if (systemSearchInput) {
    systemSearchInput.value = '';
    systemSearchInput.placeholder = 'Connecting to Database...';
    systemSearchInput.disabled = true;
  }
  if (snapButton) {
    snapButton.disabled = true;
  }

  const starsToRemove = scene.children.filter(child => child.userData && child.userData.isSystemStar);
  starsToRemove.forEach(star => {
    if (star.geometry) star.geometry.dispose();
    if (star.material) star.material.dispose();
    scene.remove(star);
  });

  const popupElement = document.querySelector('.system-popup');
  if (popupElement) popupElement.classList.remove('open');
  unsnapCamera();

  try {
    stars = await astro.processAstrometrics(window.currentGalaxy);
    placeStars(stars, scene);

    const knownSystemsArray = Object.values(stars);
    if (knownSystemsArray.length > 0) {
      validateCalculatedPositions(knownSystemsArray, validationData);
    }
  } catch (err) {
    console.error("Failed to map new galaxy:", err);
    overlayText.textContent = `WARP FAILED: ${newGalaxy.toUpperCase()} UNREACHABLE`;
    overlayText.style.color = '#ff4757'; 
    setTimeout(() => { overlay.classList.remove('active'); }, 3000);
    return;
  }

  setTimeout(() => {
    overlay.classList.remove('active');
  }, 400);
}

// USER INTERFACE CONSTRUCTION
const toggleLabelsBtn = document.createElement('button');
toggleLabelsBtn.id = 'toggle-labels-btn';
toggleLabelsBtn.className = 'hud-button';
toggleLabelsBtn.textContent = 'Hide Labels';
toggleLabelsBtn.style.position = 'absolute';
toggleLabelsBtn.style.top = '140px'; 
toggleLabelsBtn.style.left = '20px';
toggleLabelsBtn.style.width = 'fit-content';
toggleLabelsBtn.style.zIndex = '100';
document.body.appendChild(toggleLabelsBtn);

toggleLabelsBtn.addEventListener('click', (event) => {
  event.stopPropagation(); 
  labelsVisible = !labelsVisible;
  toggleLabelsBtn.textContent = labelsVisible ? 'Show Labels' : 'Hide Labels';
  scene.children.forEach(child => {
    if (child.userData && child.userData.isLabel) {
      child.visible = labelsVisible;
    }
  });
});

const resetButton = document.createElement('button');
resetButton.id = 'reset-btn';
resetButton.className = 'hud-button';
resetButton.textContent = 'Reset View';
document.body.appendChild(resetButton);
resetButton.addEventListener('click', resetCamera);

const targetNavPanel = document.createElement('div');
targetNavPanel.id = 'target-nav-panel';
targetNavPanel.className = 'hud-panel';
targetNavPanel.style.position = 'absolute';
targetNavPanel.style.top = '20px';
targetNavPanel.style.right = '20px';
targetNavPanel.style.zIndex = '100';
targetNavPanel.innerHTML = `
  <h3 style="margin-top: 3px; margin-bottom: 10px; margin-left: 5px;">Target Navigation</h3>
  <div style="display: flex; gap: 8px;">
    <input type="text" id="anchor-search" class="hud-input" list="anchor-datalist" placeholder="Enter system name..." autocomplete="off" style="flex-grow: 1;">
    <datalist id="anchor-datalist"></datalist>
    <button id="snap-anchor-btn" class="hud-button">Warp</button>
  </div>
`;
document.body.appendChild(targetNavPanel);

const systemSearchInput = document.getElementById('anchor-search');
const systemDatalist = document.getElementById('anchor-datalist');
const snapButton = document.getElementById('snap-anchor-btn');

const cameraPositionBox = document.createElement('div');
cameraPositionBox.id = 'camera-position-box';
cameraPositionBox.className = 'hud-panel';
cameraPositionBox.innerHTML = `
  <div style="color: #00ffff; margin-bottom: 6px;">[ SENSOR TELEMETRY ]</div>
  <div>X: <span id="cam-x">0.00</span></div>
  <div>Y: <span id="cam-y">0.00</span></div>
  <div>Z: <span id="cam-z">0.00</span></div>
`;
document.body.appendChild(cameraPositionBox);

const oldBtn = document.getElementById('add-system-btn');
if (oldBtn) oldBtn.remove();
const oldPanel = document.getElementById('add-system-panel');
if (oldPanel) oldPanel.remove();

const toggleAddButton = document.createElement('button');
toggleAddButton.id = 'add-system-btn';
toggleAddButton.className = 'hud-button';
toggleAddButton.textContent = '+ Initialize Target';
toggleAddButton.state = "Off";
document.body.appendChild(toggleAddButton);

const addSystemPanel = document.createElement('div');
addSystemPanel.id = 'add-system-panel';
addSystemPanel.className = 'hud-panel';
addSystemPanel.innerHTML = `
  <h3>New Star System</h3>
  <form style="display: flex; flex-direction: column; gap: 8px;">
    <input type="text" id="new-hubtag" class="hud-input" placeholder="Hubtag" required>
    <input type="text" id="new-name" class="hud-input" placeholder="System Name" required>
    <input type="text" id="new-color" class="hud-input" placeholder="Star Color (yellow, red, green, blue, purple)" required>
    <input type="number" step="any" id="new-a" class="hud-input" placeholder="Distance to [HUB12-416] Lion Shield" required>
    <input type="number" step="any" id="new-b" class="hud-input" placeholder="Distance to [HUB1-74] Sun Tzu" required>
    <input type="number" step="any" id="new-c" class="hud-input" placeholder="Distance to [HUB7-3FE] Aniwani" required>
    <input type="number" step="any" id="new-d" class="hud-input" placeholder="Distance to [HUB22-406] Legods" required>
    <input type="number" step="any" id="new-e" class="hud-input" placeholder="Distance to [HUB21-1E] Sidusius" required>
    <button type="submit" class="hud-button submit">Transmit Coordinates</button>
  </form>
  <div id="add-status" style="margin-top: 12px; font-size: 12px; text-align: center;"></div>
`;
document.body.appendChild(addSystemPanel);

const inputE = document.getElementById('new-e');
if (inputE) {
  inputE.style.display = 'none';
  inputE.required = false;
  inputE.value = ''; 
}

const toggleControlsBtn = document.createElement('button');
toggleControlsBtn.id = 'toggle-controls-btn';
toggleControlsBtn.className = 'hud-button';
toggleControlsBtn.textContent = '?';
toggleControlsBtn.style.position = 'relative';
toggleControlsBtn.style.bottom = '10px'; 
toggleControlsBtn.style.left = '20px'; 
toggleControlsBtn.style.zIndex = '101';
toggleControlsBtn.style.width = '35px';
toggleControlsBtn.style.height = '35px';
toggleControlsBtn.style.borderRadius = '50%';
toggleControlsBtn.style.padding = '0';
toggleControlsBtn.style.display = 'flex';
toggleControlsBtn.style.justifyContent = 'center';
toggleControlsBtn.style.alignItems = 'center';
toggleControlsBtn.style.transition = 'background 0.2s, color 0.2s';
document.body.appendChild(toggleControlsBtn);

const controlsTooltip = document.createElement('div');
controlsTooltip.id = 'controls-tooltip';
controlsTooltip.className = 'hud-panel';
controlsTooltip.style.position = 'absolute';
controlsTooltip.style.bottom = '155px'; 
controlsTooltip.style.left = '20px'; 
controlsTooltip.style.zIndex = '100';
controlsTooltip.style.width = '260px';
controlsTooltip.style.background = 'rgba(10, 15, 30, 0.85)';
controlsTooltip.style.border = '1px solid rgba(0, 255, 255, 0.3)';
controlsTooltip.style.padding = '15px';
controlsTooltip.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.1)';
controlsTooltip.style.fontFamily = 'monospace';
controlsTooltip.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
controlsTooltip.style.transform = 'translateY(20px)';
controlsTooltip.style.opacity = '0';
controlsTooltip.style.pointerEvents = 'none';
controlsTooltip.innerHTML = `
  <div style="color: #00ffff; font-size: 0.9rem; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 1px solid rgba(0,255,255,0.3); padding-bottom: 5px;">
    [ SYSTEM CONTROLS ]
  </div>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.8rem; color: #8892b0; margin-bottom: 12px;">
    <div style="grid-column: 1 / -1;"><span class="hud-key" style="color:#fff">WASD / ↑↓←→</span> Move</div>
    <div><span class="hud-key" style="color:#fff">Space</span> Up</div>
    <div><span class="hud-key" style="color:#fff">Shift</span> Down</div>
    <div><span class="hud-key" style="color:#fff">F</span> Filters</div>
    <div><span class="hud-key" style="color:#fff">H</span> Labels</div>
  </div>
  <div style="color: rgba(224, 255, 255, 0.7); font-size: 0.75rem; border-top: 1px solid rgba(0,255,255,0.1); padding-top: 10px; line-height: 1.4;">
    Left-click any star to initialize telemetry readout.
  </div>
`;
document.body.appendChild(controlsTooltip);

const galaxySelector = document.createElement('div');
galaxySelector.id = 'galaxy-selector';
galaxySelector.className = 'hud-panel';
galaxySelector.innerHTML = `
  <h3>Active Database</h3>
  <div class="galaxy-tabs" id="galaxy-tabs-container"></div>
`;
document.body.appendChild(galaxySelector);

const tabContainer = document.getElementById('galaxy-tabs-container');
const calypsoBtn = document.createElement('button');
calypsoBtn.className = 'hud-tab';
calypsoBtn.textContent = 'Calypso';
const euclidBtn = document.createElement('button');
euclidBtn.className = 'hud-tab active';
euclidBtn.textContent = 'Euclid';
tabContainer.appendChild(calypsoBtn);
tabContainer.appendChild(euclidBtn);

const hyperOverlay = document.createElement('div');
hyperOverlay.id = 'hyperspace-overlay';
hyperOverlay.innerHTML = `
  <div class="hyper-spinner"></div>
  <div class="hyper-text" id="hyper-text-content">INITIATING WARP...</div>
`;
document.body.appendChild(hyperOverlay);

const dataManagementPanel = document.createElement('div');
dataManagementPanel.id = 'data-management-panel';
dataManagementPanel.className = 'hud-panel';
dataManagementPanel.style.position = 'absolute';
dataManagementPanel.style.bottom = '20px';
dataManagementPanel.style.left = '20px';
dataManagementPanel.style.zIndex = '100';
dataManagementPanel.innerHTML = `
  <h3 style="margin-top: 3px; margin-bottom: 10px; margin-left: 5px;">Local Data</h3>
  <div style="display: flex; gap: 8px;">
    <button id="export-logs-btn" class="hud-button">Backup Logs</button>
    <button id="import-logs-btn" class="hud-button">Restore Logs</button>
    <input type="file" id="import-file-input" accept=".json" style="display: none;">
  </div>
  <div id="data-status" style="margin-top: 8px; font-size: 0.8em; color: #20bf6b; text-align: center;"></div>
`;
document.body.appendChild(dataManagementPanel);

// GLOBAL EVENT LISTENERS
function hidePopup() {
  if (popup) popup.classList.remove('open');
  if (document.activeElement.tagName !== 'INPUT') {
    renderer.domElement.requestPointerLock();
  }
}

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

export function updateSystemDropdown(systems = null) {
  const systemsToUse = systems || systemList;
  if (!systemDatalist) return;
  
  systemDatalist.innerHTML = '';
  if (!systemsToUse || systemsToUse.length === 0) {
    if (snapButton) snapButton.disabled = true;
    if (systemSearchInput) systemSearchInput.disabled = true;
    return;
  }
  
  systemList = systemsToUse;
  for (const [name, data] of Object.entries(systemsToUse)){
    if (!name) continue;
    const opt = document.createElement('option');
    opt.value = name;
    systemDatalist.appendChild(opt);
  }
  
  if (snapButton) snapButton.disabled = false;
  if (systemSearchInput) {
    systemSearchInput.disabled = false;
    systemSearchInput.placeholder = 'Enter system name...';
  }
}

function snapToSelectedAnchor() {
  const targetName = systemSearchInput.value;
  const targetSystem = Object.entries(systemList).find(([name, data]) => name === targetName)?.[1];

  if (!targetSystem) {
    systemSearchInput.style.border = '1px solid #fc5c65';
    setTimeout(() => { systemSearchInput.style.border = ''; }, 1000);
    return;
  }

  const targetX = targetSystem.ghc_x ?? targetSystem.x;
  const targetY = targetSystem.ghc_y ?? targetSystem.y;
  const targetZ = targetSystem.ghc_z ?? targetSystem.z;

  if (targetX == null || targetY == null || targetZ == null) return;
  
  const scale = 1;
  const offset = 20;
  const pos = [-targetX * scale, targetY * scale, targetZ * scale];
  
  cameraControls.setLookAt(
    pos[0] + offset, pos[1] + offset, pos[2] + offset,
    pos[0], pos[1], pos[2], true
  );
}

function onMouseClick(event) {
  if (event.button !== 0) return;

  if (event.target.closest('.system-popup') || event.target.closest('.hud-panel') || event.target.tagName.toLowerCase() === 'a') {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  
  if (!window.currentLockedSystem) return;

  const starMesh = window.currentLockedSystem;
  const sysData = starMesh.userData.systemData;

  let popupElement = document.getElementById('system-popup'); 
  
  if (popupElement) {
    popupElement = document.createElement('div');
    popupElement.id = 'system-popup';
    popupElement.className = 'system-popup hud-panel'; 
    popupElement.style.position = 'absolute';
    popupElement.style.top = '20px';
    popupElement.style.left = '20px'; 
    popupElement.style.zIndex = '200';
    document.body.appendChild(popupElement);
  }

  ui.showSystemPopup(sysData.name, starMesh.position, sysData, camera, popup);
}

function onKeyDown(event) {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  
  const key = event.key.toLowerCase();
  
  if (key === 'f') {
    const applyBtn = document.getElementById('apply-filters-btn');
    const resetBtn = document.getElementById('reset-filters-btn');
    
    if (keys.fToggle) applyBtn.click();
    else resetBtn.click();

    keys.fToggle = !keys.fToggle;
  }
  
  if (key === 'h') {
    const labelsBtn = document.getElementById('toggle-labels-btn');
    if (labelsBtn) labelsBtn.click();
  }

  if (key in keys) {
    keys[key] = true;
    event.preventDefault();
  }
}

function onKeyUp(event) {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

  const key = event.key.toLowerCase();
  if (key in keys) {
    keys[key] = false;
    event.preventDefault();
  }
}

// UI Event Binding
if (snapButton) snapButton.addEventListener('click', snapToSelectedAnchor);
if (systemSearchInput) {
  systemSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      snapToSelectedAnchor();
    }
  });
  systemSearchInput.addEventListener('keydown', (e) => e.stopPropagation());
}

toggleAddButton.addEventListener('click', (event) => {
  event.stopPropagation();
  if (addSystemPanel.style.display !== 'block') {
    addSystemPanel.style.display = 'block';
    toggleAddButton.textContent = '- Cancel';
    toggleAddButton.style.cssText += "background: rgba(227, 2, 35, 0.95);"
    document.exitPointerLock(); 
  } else {
    toggleAddButton.textContent = "+ Initialize Target";
    toggleAddButton.style.cssText += "background: #20bf6b;"
    addSystemPanel.style.display = 'none';
  }
  toggleAddButton.state = toggleAddButton.state === "On" ? "Off" : "On"
});

addSystemPanel.addEventListener('click', (event) => event.stopPropagation());
const form = addSystemPanel.querySelector('form');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  const statusDiv = addSystemPanel.querySelector('#add-status');
  statusDiv.textContent = 'Submitting...';
  statusDiv.style.color = '#fff';

  const valE = parseFloat(addSystemPanel.querySelector('#new-e').value);
  const payload = {
    id: addSystemPanel.querySelector('#new-hubtag').value,
    name: addSystemPanel.querySelector('#new-name').value,
    color: addSystemPanel.querySelector('#new-color').value,
    new_a: parseFloat(addSystemPanel.querySelector('#new-a').value),
    new_b: parseFloat(addSystemPanel.querySelector('#new-b').value),
    new_c: parseFloat(addSystemPanel.querySelector('#new-c').value),
    new_d: parseFloat(addSystemPanel.querySelector('#new-d').value),
    new_e: isNaN(valE) ? null : valE
  };

  try {
    const response = await fetch(BACKEND + 'add-system?galaxy=' + encodeURIComponent(window.currentGalaxy), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP Status ${response.status}`);
    }

    statusDiv.textContent = 'Success! System added.';
    statusDiv.style.color = '#20bf6b';
    event.target.reset();

    try {
      stars = await astro.processAstrometrics(window.currentGalaxy);
      placeStars(stars, scene);
      
      const knownSystemsArray = JSON.parse(JSON.stringify(Object.values(stars)));
      if (knownSystemsArray.length > 0) {
        validateCalculatedPositions(knownSystemsArray, validationData);
      }
      statusDiv.textContent = 'Map synchronized.';
      setTimeout(() => {
        if (addSystemPanel.style.display === 'block') toggleAddButton.click(); 
      }, 2000);
    } catch (refreshError) {
      statusDiv.textContent = 'System added (Refresh page to see).';
      statusDiv.style.color = '#feca57'; 
    }
  } catch (error) {
    statusDiv.textContent = 'Error submitting data.';
    statusDiv.style.color = '#fc5c65';
  }
});

let isControlsOpen = false;
toggleControlsBtn.addEventListener('mousedown', (e) => e.stopPropagation());
toggleControlsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  isControlsOpen = !isControlsOpen;
  if (isControlsOpen) {
    controlsTooltip.style.transform = 'translateY(0)';
    controlsTooltip.style.opacity = '1';
    toggleControlsBtn.style.background = 'rgba(0, 255, 255, 0.2)';
    toggleControlsBtn.style.color = '#fff';
  } else {
    controlsTooltip.style.transform = 'translateY(20px)';
    controlsTooltip.style.opacity = '0';
    toggleControlsBtn.style.background = '';
    toggleControlsBtn.style.color = '';
  }
});

calypsoBtn.addEventListener('click', () => switchGalaxy('calypso', calypsoBtn, euclidBtn));
euclidBtn.addEventListener('click', () => switchGalaxy('euclid', euclidBtn, calypsoBtn));

dataManagementPanel.addEventListener('click', (event) => event.stopPropagation());
const exportBtn = document.getElementById('export-logs-btn');
const importBtn = document.getElementById('import-logs-btn');
const fileInput = document.getElementById('import-file-input');
const dataStatus = document.getElementById('data-status');

exportBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  const logs = {};
  let count = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('gh_notes_')) {
      logs[key] = localStorage.getItem(key);
      count++;
    }
  }
  
  if (count === 0) {
    dataStatus.textContent = 'No logs found to export.';
    dataStatus.style.color = '#feca57';
    setTimeout(() => { dataStatus.textContent = ''; }, 3000);
    return;
  }
  
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = 'surveyor_logs_backup.json';
  downloadLink.click();
  URL.revokeObjectURL(url);
  
  dataStatus.textContent = `Exported ${count} logs.`;
  dataStatus.style.color = '#20bf6b';
  setTimeout(() => { dataStatus.textContent = ''; }, 3000);
});

importBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const logs = JSON.parse(e.target.result);
      let count = 0;
      for (const key in logs) {
        if (key.startsWith('gh_notes_')) {
          localStorage.setItem(key, logs[key]);
          count++;
        }
      }
      dataStatus.textContent = `Restored ${count} logs.`;
      dataStatus.style.color = '#20bf6b';
    } catch (err) {
      dataStatus.textContent = 'Invalid backup file.';
      dataStatus.style.color = '#fc5c65';
    }
    fileInput.value = '';
    setTimeout(() => { dataStatus.textContent = ''; }, 3000);
  };
  reader.readAsText(file);
});

window.addEventListener('resize', () => {
  if(camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  }
});

window.addEventListener('mousedown', (event) => {
  if (event.button === 2) unsnapCamera();
});

window.addEventListener('contextmenu', (event) => event.preventDefault());

// MAIN ENTRY POINT
initializeScene().then(function(data) {
  clock = data.clock;
  camera = data.camera;
  cameraControls = data.cameraControls;
  renderer = data.renderer;
  mouse = data.mouse;
  popup = data.popup;
  raycaster = data.raycaster;

  astro.processAstrometrics(window.currentGalaxy).then(function(data2) {
    stars = data2;
    placeStars(stars, scene);
    
    const knownSystemsArray = JSON.parse(JSON.stringify(Object.values(stars)));
    if (knownSystemsArray.length > 0) {
      const validationResults = validateCalculatedPositions(knownSystemsArray, validationData);
      if (validationResults && validationResults.summary.comparisonsWithErrors > 0) {
        console.warn("Astrometric drift detected. Check validation logs for outliers.");
      } else {
        console.log("Astrometric validation passed within acceptable tolerances.");
      }
    }
    
    if (firstPass) firstPass = false;

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    renderer.domElement.setAttribute('tabindex', '0');
    renderer.domElement.style.outline = 'none';
    
    renderer.domElement.addEventListener('click', () => {
      renderer.domElement.focus();
    });
    
    setTimeout(() => { renderer.domElement.focus(); }, 1000);
    
    document.addEventListener('click', (event) => {
      if (!popup.contains(event.target)) hidePopup();
    });

    renderer.domElement.addEventListener('click', function() {
      renderer.domElement.requestPointerLock();
    });

    document.addEventListener('mousemove', function(event) {
      if (document.pointerLockElement === renderer.domElement) {
        const sensitivity = 0.002; 
        cameraControls.azimuthAngle -= event.movementX * sensitivity;
        cameraControls.polarAngle -= event.movementY * sensitivity;
        
        lookVelocity.x -= event.movementX * lookSensitivity;
        lookVelocity.y -= event.movementY * lookSensitivity;
      }
    });

    window.addEventListener('click', onMouseClick);

    window.addEventListener('touchstart', (event) => {
      if (event.touches.length > 1) return;
      const touch = event.touches[0];
      
      if (event.target.closest('.system-popup') || event.target.closest('.hud-panel') || event.target.tagName.toLowerCase() === 'a') {
        return;
      }

      mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    });

    animate();
  });
});
