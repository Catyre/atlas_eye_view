import { calculateDistance } from './trilateration.js';

// --- DECODING PORTAL GLYPHS FROM HUBTAG ---
// Dictionary of Region Coordinates
const euclidRegionDictionary = {
  "HUB1": { x: "041D", y: "004E", z: "0D88" }, // 041D:004E:0D88
  "HUB2": {x: "041D", y: "004E", z: "0D87"}, // 041D:004E:0D87
  "HUB3": {x: "041E", y: "004E", z:"0D87"}, //041E:004E:0D87
  "HUB4": {x: "041E", y: "004E", z: "0D88"}, // 041E:004E:0D88
  "HUB5": {x: "041E", y: "004E", z: "0D89"}, // 041E:004E:0D89
  "HUB6": {x: "041D", y: "004E", z: "0D89"}, // 041D:004E:0D89
  "HUB7": {x: "041C" , y: "004E", z: "0D89"}, // 041C:004E:0D89
  "HUB8": {x: "041C", y: "004E", z: "0D88"}, // 041C:004E:0D88
  "HUB9": {x: "041C", y: "004E", z: "0D87"}, // 041C:004E:0D87
  "HUB10": {x: "041D", y: "004F", z: "0D88"}, // 041D:004F:0D88
  "HUB11": {x: "041D", y: "004F", z: "0D87"}, // 041D:004F:0D87
  "HUB12": {x: '041E', y: "004F", z: "0D87"}, // 041E:004F:0D87
  "HUB13": {x: "041E", y: "004F", z: "0D88"}, // 041E:004F:0D88
  "HUB14": {x: "042F", y: "0077", z: "0D55"}, // 042F:0077:0D55
  "HUB15": {x: "041D", y: "004F", z: "0D89"}, // 041D:004F:0D89
  "HUB16": {x: "041C", y: "004F", z: "0D89"}, // 041C:004F:0D89
  "HUB17": {x: "041C", y: "004F", z: "0D88"}, // 041C:004F:0D88
  "HUB18": {x: "041C", y: "004F", z: "0D87"}, // 041C:004F:0D87
  "HUB19": {x: "041D", y: "004D", z: "0D88"}, // 041D:004D:0D88
  "HUB20": {x: "041D", y: "004D", z: "0D87"}, // 041D:004D:0D87
  "HUB21": {x: "041E", y: "004D", z: "0D87"}, // 041E:004D:0D87
  "HUB22": {x: "041E", y: "004D", z: "0D88"}, // 041E:004D:0D88
  "HUB23": {x: "041E", y: "004D", z: "0D89"}, // 041E:004D:0D89
  "HUB24": {x: "041D", y: "004D", z: "0D89"}, // 041D:004D:0D89
  "HUB25": {x: "041C", y: "004D", z: "0D89"}, // 041C:004D:0D89
  "HUB26": {x: "041C", y: "004D", z: "0D88"}, // 041C:004D:0D88
  "HUB27": {x: "041C", y: "004D", z: "0D87"} // 041C:004D:0D87
};

const calypsoRegionDictionary = {
  "HUB1": { x: "042F", y: "0078", z: "0D55" },
  "HUB2": { x: "042F", y: "0078", z: "0D54" },
  "HUB3": { x: "0430", y: "0078", z: "0D54" },
  "HUB4": { x: "0430", y: "0078", z: "0D55" },
  "HUB5": { x: "0430", y: "0078", z: "0D56" },
  "HUB6": { x: "042F", y: "0078", z: "0D56" },
  "HUB7": { x: "042E", y: "0078", z: "0D56" },
  "HUB8": { x: "042E", y: "0078", z: "0D55" },
  "HUB9": { x: "042E", y: "0078", z: "0D54" },
  "HUB10": { x: "042F", y: "0079", z: "0D55" },
  "HUB11": { x: "042F", y: "0077", z: "0D55" },
  "HUB12": { x: "042E", y: "0078", z: "0D53" },
  "HUB13": { x: "042F", y: "0078", z: "0D53" },
  "HUB14": { x: "0430", y: "0078", z: "0D53" },
  "HUB15": { x: "0431", y: "0078", z: "0D53" },
  "HUB16": { x: "0431", y: "0078", z: "0D54" },
  "HUB17": { x: "0431", y: "0078", z: "0D55" },
  "HUB18": { x: "0431", y: "0078", z: "0D56" },
  "HUB19": { x: "0431", y: "0078", z: "0D57" },
  "HUB20": { x: "0430", y: "0078", z: "0D57" },
  "HUB21": { x: "042F", y: "0078", z: "0D57" },
  "HUB22": { x: "042E", y: "0078", z: "0D57" },
  "HUB23": { x: "042D", y: "0078", z: "0D57" },
  "HUB24": { x: "042D", y: "0078", z: "0D56" },
  "HUB25": { x: "042D", y: "0078", z: "0D55" },
  "HUB26": { x: "042D", y: "0078", z: "0D54" },
  "HUB27": { x: "042D", y: "0078", z: "0D53" },
  "HUB28": { x: "042F", y: "0079", z: "0D54" },
  "HUB29": { x: "0430", y: "0079", z: "0D54" },
  "HUB30": { x: "0430", y: "0079", z: "0D55" },
  "HUB31": { x: "0430", y: "0079", z: "0D56" },
  "HUB32": { x: "042F", y: "0079", z: "0D56" },
  "HUB33": { x: "042E", y: "0079", z: "0D56" },
  "HUB34": { x: "042E", y: "0079", z: "0D55" },
  "HUB35": { x: "042E", y: "0079", z: "0D54" },
  "HUB36": { x: "042F", y: "0077", z: "0D54" },
  "HUB37": { x: "0430", y: "0077", z: "0D54" },
  "HUB38": { x: "0430", y: "0077", z: "0D55" },
  "HUB39": { x: "0430", y: "0077", z: "0D56" },
  "HUB40": { x: "042F", y: "0077", z: "0D56" },
  "HUB41": { x: "042E", y: "0077", z: "0D56" },
  "HUB42": { x: "042E", y: "0077", z: "0D55" },
  "HUB43": { x: "042E", y: "0077", z: "0D54" },
  "HUB44": { x: "042F", y: "007A", z: "0D55" },
  "HUB45": { x: "042F", y: "0076", z: "0D55" }
};

function decodeHubtag(hubtag) {
  // Parse the solar system index and region
  const tagMatch = hubtag.match(/HUB(\d+)-([A-Fa-f0-9]+)/i);
  
  if (!tagMatch) {
    throw new Error("Invalid hubtag format. Expected format like 'HUB1-74'.");
  }
  
  const regionId = `HUB${tagMatch[1]}`;
  const rawSSI = tagMatch[2]; 
  let coords = null;

  // Look up the region's coordinates in the dictionary
  if (window.currentGalaxy === "euclid") { 
    coords = euclidRegionDictionary[regionId];
  } else if (window.currentGalaxy === "calypso") {
    coords = calypsoRegionDictionary[regionId];
  }

  if (!coords) {
    throw new Error(`Region ${regionId} not found in the dictionary.`);
  }

  // Format the Signal Booster string
  const signalBoosterFormat = `XXXX:${coords.x}:${coords.y}:${coords.z}:${rawSSI.padStart(4, '0')}`;

  // Apply the true offsets and use bitwise masks to handle overflow truncation
  const adjX = (parseInt(coords.x, 16) + 0x801) & 0xFFF;
  const adjY = (parseInt(coords.y, 16) + 0x81) & 0xFF;
  const adjZ = (parseInt(coords.z, 16) + 0x801) & 0xFFF;

  // Convert to formatted hex strings
  const hexX = adjX.toString(16).toUpperCase().padStart(3, '0');
  const hexY = adjY.toString(16).toUpperCase().padStart(2, '0');
  const hexZ = adjZ.toString(16).toUpperCase().padStart(3, '0');

  // Format the Solar System Index to 3 characters
  const ssi = parseInt(rawSSI, 16).toString(16).toUpperCase().padStart(3, '0').slice(-3);
  
  // Set Planet Index to 0 for the system's primary portal
  const planetIndex = "0";

  // Assemble the final Portal Address: P SSS YY ZZZ XXX
  const portalAddress = `${planetIndex}${ssi}${hexY}${hexZ}${hexX}`;

  return {
    inputHubtag: hubtag,
    region: regionId,
    signalBooster: signalBoosterFormat,
    portalAddress: portalAddress
  };
}

export async function showSystemPopup(systemName, worldPosition, system, camera, popup) {
  if (!system) {
    console.warn(`No data found for system: ${systemName}`);
    return;
  }

  const ghc_system = [system.ghc_x, system.ghc_y, system.ghc_z];
  let ghc_capital = [0, 0, 0];
  if (window.currentGalaxy === 'euclid') {
    ghc_capital = [-500.00390254377453, 236.72745822760584, -298.53842838766906]; // Hard coded for Bixiann for now
  } else if (window.currentGalaxy === 'calypso'){
    ghc_capital = [0, 0, 0]; // Update for Edogya
  }
  const dist2capital = calculateDistance(ghc_system, ghc_capital);
  
  popup.innerHTML = `
    <div class="wiki-section" id="wiki-container-${systemName.replace(/\s+/g, '-')}">
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <span>Accessing Galactic Archives...</span>
      </div>
    </div>
  `;
  popup.classList.add('open');
  
  const wikiData = JSON.parse(system.wiki_data);
  const systemGlyphs = decodeHubtag(system.id).portalAddress;
  
  let wikiSection = '';
  if (wikiData === null) {
    wikiSection = `
      <div class="wiki-section" style="background: rgba(10, 15, 30, 0.6); border: 1px solid rgba(0, 255, 255, 0.2); padding: 15px; font-family: sans-serif;">
        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(0, 255, 255, 0.3); padding-bottom: 10px; margin-bottom: 12px;">
          <div>
            <div class="wiki-title"> ${system.id} ${systemName} </div>
            <div style="color: #8892b0; font-size: 0.85em; font-family: monospace; margin-top: 4px;">
              DISTANCE: ${dist2capital.toFixed(0)} LY FROM CAPITAL
            </div>
          </div>
          <img src="Galactic_Hub_Main_Emblem.png" alt="Galactic Hub Emblem" style="width: 65px; height: auto; opacity: 0.85; filter: drop-shadow(0 0 6px rgba(0, 255, 255, 0.5));">
        </div>

        ${systemGlyphs ? `
          <div style="background: rgba(0, 0, 0, 0.5); border: 1px solid #333; padding: 10px; text-align: center; margin-bottom: 15px;">
            <div style="color: #00ffff; font-size: 0.75em; letter-spacing: 2px; margin-bottom: 5px;">[ PORTAL SEQUENCE ]</div>
            <div class="nms-glyph-text" style="color: #ffffff; text-shadow: 0 0 5px rgba(255,255,255,0.5);">${systemGlyphs}</div>
          </div>
        ` : ''}

        <div class="error-message">Galactic Hub Database</div>
        <div class="error-text">Cannot find Galactic Hub data for this system.</div>
      </div>
    `;
  } else {
    wikiSection = `
      <div class="wiki-section" style="background: rgba(10, 15, 30, 0.6); border: 1px solid rgba(0, 255, 255, 0.2); padding: 15px; font-family: sans-serif;">
        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(0, 255, 255, 0.3); padding-bottom: 10px; margin-bottom: 12px;">
          <div>
            <div class="wiki-title" style="font-size: 1.25em; letter-spacing: 1px; text-transform: uppercase;">
              <a href="${wikiData.url}" target="_blank" style="color: #00ffff; text-decoration: none; text-shadow: 0 0 8px rgba(0,255,255,0.5);">${wikiData.title}</a>
            </div>
            <div style="color: #8892b0; font-size: 0.85em; font-family: monospace; margin-top: 4px;">
              DISTANCE: ${dist2capital.toFixed(0)} LY FROM CAPITAL
            </div>
          </div>
          <img src="Galactic_Hub_Main_Emblem.png" alt="Galactic Hub Emblem" style="width: 65px; height: auto; opacity: 0.85; filter: drop-shadow(0 0 6px rgba(0, 255, 255, 0.5));">
        </div>

        ${systemGlyphs ? `
          <div style="background: rgba(0, 0, 0, 0.5); border: 1px solid #333; padding: 10px; text-align: center; margin-bottom: 15px;">
            <div style="color: #00ffff; font-size: 0.75em; letter-spacing: 2px; margin-bottom: 5px;">[ PORTAL SEQUENCE ]</div>
            <div class="nms-glyph-text" style="color: #ffffff; text-shadow: 0 0 5px rgba(255,255,255,0.5);">${systemGlyphs}</div>
          </div>
        ` : ''}

        <div class="wiki-title">Galactic Hub Database</div>
        ${wikiData.summary ? `<div class="wiki-summary" style="font-style: italic; color: #a8b2d1; font-size: 0.9em; margin-bottom: 15px; line-height: 1.4;">${wikiData.summary}</div>` : ''}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.9em;">
          
          ${wikiData.galaxy ? `<div class="wiki-info"><div style="color: #00ffff; font-size: 0.75em; letter-spacing: 1px;">GALAXY</div><div style="color: #fff;">${wikiData.galaxy}</div></div>` : ''}
          ${wikiData.region ? `<div class="wiki-info"><div style="color: #00ffff; font-size: 0.75em; letter-spacing: 1px;">REGION</div><div style="color: #fff;">${wikiData.region}</div></div>` : ''}
          
          ${wikiData.planets || wikiData.moons ? `<div class="wiki-info"><div style="color: #00ffff; font-size: 0.75em; letter-spacing: 1px;">CELESTIAL BODIES</div><div style="color: #fff;">${wikiData.planets || '0'} Planets, ${wikiData.moons || '0'} Moons</div></div>` : ''}
          ${wikiData.spectral_class ? `<div class="wiki-info"><div style="color: #00ffff; font-size: 0.75em; letter-spacing: 1px;">SPECTRAL CLASS</div><div style="color: #fff;">${wikiData.spectral_class}</div></div>` : ''}
          
          ${wikiData.faction ? `<div class="wiki-info"><div style="color: #00ffff; font-size: 0.75em; letter-spacing: 1px;">DOMINANT FORM</div><div style="color: #fff;">${wikiData.faction}</div></div>` : ''}
          ${wikiData.conflict ? `<div class="wiki-info"><div style="color: #00ffff; font-size: 0.75em; letter-spacing: 1px;">CONFLICT LEVEL</div><div style="color: #fff;">${wikiData.conflict}</div></div>` : ''}
          
          ${wikiData.economy || wikiData.wealth ? `<div class="wiki-info"><div style="color: #00ffff; font-size: 0.75em; letter-spacing: 1px;">ECONOMY</div><div style="color: #fff;">${wikiData.economy || 'Unknown'} ${wikiData.wealth ? `(${wikiData.wealth})` : ''}</div></div>` : ''}
          ${wikiData.dissonant ? `<div class="wiki-info"><div style="color: #00ffff; font-size: 0.75em; letter-spacing: 1px;">SYSTEM STATE</div><div style="color: #ff4757;">Dissonant</div></div>` : ''}
          
          ${wikiData.waterworlds ? `<div class="wiki-info"><div style="color: #00ffff; font-size: 0.75em; letter-spacing: 1px;">WATERWORLDS</div><div style="color: #fff;">${wikiData.waterworlds}</div></div>` : ''}
          ${wikiData.discoveredBy ? `<div class="wiki-info"><div style="color: #00ffff; font-size: 0.75em; letter-spacing: 1px;">DISCOVERED BY</div><div style="color: #fff;">${wikiData.discoveredBy}</div></div>` : ''}

        </div>
        
        <div style="margin-top: 18px; text-align: center;">
          <a href="${wikiData.url}" target="_blank" rel="noopener noreferrer" style="display: block; padding: 10px; background: rgba(0, 255, 255, 0.1); border: 1px solid #00ffff; color: #00ffff; text-decoration: none; border-radius: 2px; font-size: 0.8em; letter-spacing: 2px; text-transform: uppercase;">
            Access Full Database Entry
          </a>
        </div>
      </div>
    `;
  }

  const coordsHtml = `
  <div style="display: flex; align-items: center; gap: 8px; background: rgba(10, 15, 30, 0.85); border: 1px solid rgba(0, 255, 255, 0.3); border-left: 2px solid #00ffff; padding: 8px 8px; box-shadow: 0 0 10px rgba(0, 255, 255, 0.1); margin-top: 15px; margin-bottom: 15px;">
    <div style="color: #00ffff; font-size: 0.7rem; letter-spacing: 1px; border-right: 1px solid rgba(0, 255, 255, 0.3); padding-right: 15px;">
      [GHC COORDINATES]
    </div>
    <div style="display: flex; gap: 20px; font-family: monospace; font-size: 1.1rem; color: #8892b0;">
      <div>X: <span style="color: #ffffff; text-shadow: 0 0 4px rgba(255,255,255,0.5);">${system.ghc_x.toFixed(2)}</span></div>
      <div>Y: <span style="color: #ffffff; text-shadow: 0 0 4px rgba(255,255,255,0.5);">${system.ghc_y.toFixed(2)}</span></div>
      <div>Z: <span style="color: #ffffff; text-shadow: 0 0 4px rgba(255,255,255,0.5);">${system.ghc_z.toFixed(2)}</span></div>
    </div>
  </div>
  `;

  const personalLog = `
    <div class="system-notes-container" style="margin-top: 15px; border-top: 1px solid #333; padding-top: 10px;">
      <div style="color: #00ffff; font-size: 0.9em; margin-bottom: 5px;">[ PERSONAL LOG ]</div>
      <textarea id="system-personal-notes" placeholder="Enter surveyor notes..." style="width: 100%; height: 80px; background: rgba(0,0,0,0.5); color: #fff; border: 1px solid #444; padding: 5px; font-family: monospace; resize: vertical;"></textarea>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
        <button id="save-note-btn" class="hud-button" style="padding: 4px 8px; font-size: 0.8em;">Save Log</button>
        <span id="note-save-status" style="font-size: 0.8em; color: #20bf6b;"></span>
      </div>
    </div>
  `;

  popup.innerHTML = `
    ${wikiSection}
    <br>
    ${personalLog}
    <button id="mobile-unsnap-btn" class="hud-button warning" style="position: absolute; top: 15px; right: 15px; display: none;">
      [X]
    </button>
    ${coordsHtml}
    `;

  // Generate a unique key for this specific system
  const storageKey = `gh_notes_${system.name}`;
  const notesArea = document.getElementById('system-personal-notes');
  const saveBtn = document.getElementById('save-note-btn');
  const statusText = document.getElementById('note-save-status');

  // Forcefully trap all keyboard events inside the textarea
  notesArea.addEventListener('keydown', (e) => e.stopPropagation());
  notesArea.addEventListener('keyup', (e) => e.stopPropagation());
  notesArea.addEventListener('keypress', (e) => e.stopPropagation());

  // Load any existing note from the user's browser memory
  const existingNote = localStorage.getItem(storageKey);
  if (existingNote) {
    notesArea.value = existingNote;
  }

  // Save the note when the button is clicked
  saveBtn.addEventListener('click', () => {
    const currentText = notesArea.value;
    localStorage.setItem(storageKey, currentText);
    
    statusText.textContent = "Saved to local storage.";
    setTimeout(() => { statusText.textContent = ""; }, 2000);
  });
}

// Crosshair
const crosshair = document.createElement('div');
crosshair.id = 'viewport-crosshair';
crosshair.style.cssText = `
  position: fixed;
  top: 50%;
  left: 50%;
  width: 30px;
  height: 30px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 1000;
`;
crosshair.innerHTML = `
  <div class="crosshair-line" style="top: 14px; left: 0; width: 10px; height: 2px;"></div>
  <div class="crosshair-line" style="top: 14px; right: 0; width: 10px; height: 2px;"></div>
  <div class="crosshair-line" style="top: 0; left: 14px; width: 2px; height: 10px;"></div>
  <div class="crosshair-line" style="bottom: 0; left: 14px; width: 2px; height: 10px;"></div>
  <div class="crosshair-line" style="top: 14px; left: 14px; width: 2px; height: 2px;"></div>
`;
document.body.appendChild(crosshair);

// Bind the unsnap function to the new button
const mobileCloseBtn = document.getElementById('mobile-unsnap-btn');
if (mobileCloseBtn) {
  // Show the button only if the screen is mobile-sized
  if (window.innerWidth <= 768) {
    mobileCloseBtn.style.display = 'block';
  }
  
  mobileCloseBtn.addEventListener('click', () => {
    // Dispatch a custom event or call window.unsnapCamera if you made it global
    if (typeof window.unsnapCamera === 'function') {
      window.unsnapCamera();
    }
  });
}
