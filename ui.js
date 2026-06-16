import { calculateDistance } from './trilateration.js';
import * as THREE from 'three';

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
          <button id="open-wiki-reader-btn" style="display: block; width: 100%; cursor: pointer; padding: 10px; background: rgba(0, 255, 255, 0.1); border: 1px solid #00ffff; color: #00ffff; text-decoration: none; border-radius: 2px; font-size: 0.8em; letter-spacing: 2px; text-transform: uppercase;">
            Access Full Database Entry
          </button>
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

  let parsedBases = [];
  if (system.bases) {
    try {
      parsedBases = typeof system.bases === 'string' 
        ? JSON.parse(system.bases) 
        : system.bases;
    } catch (e) {}
  }

  let basesHtml = '';
  if (parsedBases.length > 0) {
    const basesListHtml = parsedBases.map(baseName => {
      const displayName = baseName.replace(/_/g, ' ');
      return `<div class="base-preview-tag" data-basename="${baseName}">
                <span style="color: #00ffff; margin-right: 5px;">[+]</span>${displayName}
              </div>`;
    }).join('');

    basesHtml = `
      <div class="system-bases-section" style="margin-top: 15px; border-top: 1px solid rgba(0, 255, 255, 0.3); padding-top: 10px;">
        <div style="color: #00ffff; font-size: 0.85em; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px;">
          Registered Habitats (${parsedBases.length})
        </div>
        <div class="bases-container" style="display: flex; flex-direction: column; gap: 5px; max-height: 120px; overflow-y: auto; padding-right: 5px;">
          ${basesListHtml}
        </div>
      </div>
    `;
  }

  popup.innerHTML = `
    ${wikiSection}
    <br>
    ${personalLog}
    ${basesHtml}
    <button id="mobile-unsnap-btn" class="hud-button warning" style="position: absolute; top: 15px; right: 15px; display: none;">
      [X]
    </button>
    ${coordsHtml}
    `;

  const baseTags = document.querySelectorAll('.base-preview-tag');
  baseTags.forEach(tag => {
    tag.addEventListener('click', (e) => {
      e.stopPropagation();
      const baseName = tag.getAttribute('data-basename');
      
      openArticleReader(baseName);
    });
  });


  // Connect the Wiki Reader Button
  const readWikiBtn = document.getElementById('open-wiki-reader-btn');

  if (readWikiBtn && wikiData && wikiData.title) {
    readWikiBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent the click from passing through to the canvas
      openArticleReader(wikiData);
    });
  }

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
const crosshairContainer = document.createElement('div');
crosshairContainer.id = 'targeting-crosshair';
crosshairContainer.style.position = 'absolute';
crosshairContainer.style.top = '0';
crosshairContainer.style.left = '0';
crosshairContainer.style.width = '40px';
crosshairContainer.style.height = '40px';
crosshairContainer.style.pointerEvents = 'none'; 
crosshairContainer.style.zIndex = '50';
crosshairContainer.style.transition = 'opacity 0.2s ease';
crosshairContainer.style.transform = `translate(-50%, -50%) translate(${window.innerWidth / 2}px, ${window.innerHeight / 2}px)`;

crosshairContainer.innerHTML = `
  <div style="position: absolute; top: 50%; left: 0; width: 10px; height: 1px; background: #00ffff; box-shadow: 0 0 4px #00ffff;"></div>
  <div style="position: absolute; top: 50%; right: 0; width: 10px; height: 1px; background: #00ffff; box-shadow: 0 0 4px #00ffff;"></div>
  <div style="position: absolute; top: 0; left: 50%; width: 1px; height: 10px; background: #00ffff; box-shadow: 0 0 4px #00ffff;"></div>
  <div style="position: absolute; bottom: 0; left: 50%; width: 1px; height: 10px; background: #00ffff; box-shadow: 0 0 4px #00ffff;"></div>
  <div style="position: absolute; top: 50%; left: 50%; width: 2px; height: 2px; background: #fff; border-radius: 50%; transform: translate(-50%, -50%);"></div>
`;

const crosshairLabel = document.createElement('div');
crosshairLabel.style.position = 'absolute';
crosshairLabel.style.top = '45px';
crosshairLabel.style.left = '50%';
crosshairLabel.style.transform = 'translateX(-50%)';
crosshairLabel.style.color = '#fff';
crosshairLabel.style.fontFamily = 'monospace';
crosshairLabel.style.fontSize = '0.85rem';
crosshairLabel.style.letterSpacing = '1px';
crosshairLabel.style.textShadow = '0 0 5px rgba(0, 255, 255, 0.8)';
crosshairLabel.style.whiteSpace = 'nowrap';
crosshairLabel.textContent = '';

crosshairContainer.appendChild(crosshairLabel);
document.body.appendChild(crosshairContainer);

const tempVector = new THREE.Vector3();

export function updateTargetingComputer(camera, scene) {
  const snapThreshold = 0.15; 
  let closestSystem = null;
  let minDistance = snapThreshold;
  let lockedScreenPosition = new THREE.Vector2();

  scene.traverse((child) => {
    if (child.isMesh && child.userData && child.userData.isSystemStar && child.visible) {
      tempVector.copy(child.position);
      tempVector.project(camera); 

      if (tempVector.z > 1 || tempVector.z < -1) return;

      const distance = Math.sqrt(tempVector.x * tempVector.x + tempVector.y * tempVector.y);

      if (distance < minDistance) {
        minDistance = distance;
        closestSystem = child;
        lockedScreenPosition.set(tempVector.x, tempVector.y);
      }
    }
  });

  if (closestSystem) {
    window.currentLockedSystem = closestSystem;

    const x = (lockedScreenPosition.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(lockedScreenPosition.y * 0.5) + 0.5) * window.innerHeight;

    crosshairContainer.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    crosshairContainer.style.opacity = '1';
    
    crosshairContainer.children[0].style.width = '14px';
    crosshairContainer.children[1].style.width = '14px';
    crosshairContainer.children[2].style.height = '14px';
    crosshairContainer.children[3].style.height = '14px';
    
    const data = closestSystem.userData.systemData;
    crosshairLabel.textContent = data.id + " " + data.name || 'Unknown System';
  } else {
    window.currentLockedSystem = null;

    crosshairContainer.style.transform = `translate(-50%, -50%) translate(${window.innerWidth / 2}px, ${window.innerHeight / 2}px)`;
    crosshairContainer.style.opacity = '0.3'; 
    crosshairLabel.textContent = '';
    
    crosshairContainer.children[0].style.width = '10px';
    crosshairContainer.children[1].style.width = '10px';
    crosshairContainer.children[2].style.height = '10px';
    crosshairContainer.children[3].style.height = '10px';
  }
}

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

export async function openArticleReader(wikiData, isBackNavigation = false, redirectedFrom = null) {
  let pageTitle = "";
  let fallbackMentions = [];
  let hasDirectArticle = true;

  if (typeof wikiData === 'string') {
    pageTitle = wikiData;
  } else if (wikiData && typeof wikiData === 'object') {
    pageTitle = wikiData.title;
    fallbackMentions = wikiData.mentioned_in || [];
    
    if (!wikiData.url) {
      hasDirectArticle = false;
    }
  }

  if (!pageTitle) return;

  if (!window.wikiHistory) window.wikiHistory = [];

  let readerPanel = document.getElementById('wiki-reader-panel');
  let isFirstOpen = (!readerPanel || readerPanel.style.display === 'none' || readerPanel.style.display === '');

  if (isFirstOpen) {
    window.wikiHistory = [pageTitle];
  } 
  else if (!isBackNavigation && window.wikiHistory[window.wikiHistory.length - 1] !== pageTitle) {
    window.wikiHistory.push(pageTitle);
  }

  if (!readerPanel) {
    readerPanel = document.createElement('div');
    readerPanel.id = 'wiki-reader-panel';
    readerPanel.className = 'hud-panel';
    
    // Upgraded to position: fixed and dvh for rock-solid mobile viewport mapping
    readerPanel.style.cssText = `
      position: fixed;
      top: 2.5dvh;
      left: 2.5vw;
      width: 95vw;
      height: 95dvh;
      z-index: 9999;
      background: rgba(5, 5, 16, 0.85); /* Slightly darker for better mobile contrast */
      backdrop-filter: blur(8px); 
      -webkit-backdrop-filter: blur(8px);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch; /* Momentum scrolling for iOS */
      padding: 40px 10%;
      box-sizing: border-box;
      color: #e0e0e0;
      font-family: sans-serif;
      border: 2px solid #00ffff;
      outline: 1px solid rgba(0, 255, 255, 0.4);
      outline-offset: -12px;
      box-shadow: inset 0 0 40px rgba(0, 255, 255, 0.05), 0 0 30px rgba(0, 0, 0, 0.9);
      border-radius: 4px;
    `;

    readerPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
    readerPanel.addEventListener('pointerup', (e) => e.stopPropagation());
    readerPanel.addEventListener('click', (e) => e.stopPropagation());
    readerPanel.addEventListener('wheel', (e) => e.stopPropagation());

    document.addEventListener('keydown', (e) => {
      const activePanel = document.getElementById('wiki-reader-panel');
      if (activePanel && activePanel.style.display === 'block') {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

        if (e.key === 'Escape' || e.key.toLowerCase() === 'x') {
          const closeBtn = document.getElementById('close-reader-btn');
          if (closeBtn) closeBtn.click();
        }
        
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const backBtn = document.getElementById('back-reader-btn');
          if (backBtn) backBtn.click();
        }
      }
    });

    const wikiStyles = document.createElement('style');
    wikiStyles.textContent = `
      /* TOAST NOTIFICATION ANIMATION */
      @keyframes hudToastFade {
        0% { opacity: 0; transform: translateY(-10px); }
        5% { opacity: 1; transform: translateY(0); }
        85% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); pointer-events: none; visibility: hidden; }
      }

      .mw-parser-output * {
        background-color: transparent !important;
        color: inherit !important;
      }
      .mw-parser-output a { color: #00ffff !important; text-decoration: none; }
      .mw-parser-output a:hover { text-decoration: underline; }
      
      .infoboxWrap, .portable-infobox {
        float: right !important;
        clear: right !important;
        width: 320px !important;
        max-width: 100% !important;
        margin: 0 0 1.5em 1.5em !important;
        background: rgba(0, 0, 0, 0.6) !important;
        border: 1px solid rgba(0, 255, 255, 0.3) !important;
        box-sizing: border-box !important;
        font-size: 0.85em !important; 
        line-height: 1.4 !important;
      }
      .infobox th, .infobox td {
        padding: 6px !important; 
      }
      
      .portable-infobox .pi-title {
        background: rgba(0, 255, 255, 0.15) !important;
        color: #00ffff !important;
        text-align: center !important;
        padding: 12px !important;
        margin: 0 !important;
        font-size: 1.2em !important;
        text-transform: uppercase !important;
        border-bottom: 1px solid rgba(0, 255, 255, 0.3) !important;
      }
      
      .portable-infobox .pi-image {
        padding: 10px !important;
        text-align: center !important;
        border-bottom: 1px solid rgba(0, 255, 255, 0.15) !important;
      }
      
      .portable-infobox .pi-data {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 8px 10px !important;
        border-bottom: 1px solid rgba(0, 255, 255, 0.1) !important;
      }
      
      .portable-infobox .pi-data-label {
        color: #8892b0 !important;
        font-weight: normal !important;
        margin: 0 !important;
        flex: 1 !important;
        text-align: left !important;
      }
      
      .portable-infobox .pi-data-value {
        color: #fff !important;
        flex: 1.2 !important;
        text-align: right !important;
        word-break: break-word !important;
      }

      .wikitable, .navbox, table:not(.infobox) { 
        float: none !important;
        display: block !important;
        width: 100% !important; 
        max-width: 100% !important; 
        overflow-x: auto !important;
        border-collapse: collapse !important; 
        margin: 1.5em 0 !important; 
        background: rgba(0, 0, 0, 0.6) !important; 
        border: 1px solid rgba(0, 255, 255, 0.3) !important;
        box-sizing: border-box !important;
        -webkit-overflow-scrolling: touch; 
      }
      
      th, td { 
        border: 1px solid rgba(0, 255, 255, 0.15) !important; 
        padding: 10px !important; 
        white-space: normal !important;
        word-break: break-word !important; 
        overflow-wrap: break-word !important;
        min-width: 100px; 
      }
      th { 
        background: rgba(0, 255, 255, 0.1) !important; 
        color: #00ffff !important; 
        text-align: left;
      }

      .thumb, .thumbinner, .tright, .tleft { 
        float: none !important; 
        margin: 1.5em auto !important; 
        background: rgba(0, 0, 0, 0.4) !important; 
        border: 1px solid rgba(255, 255, 255, 0.1) !important; 
        padding: 10px !important; 
        max-width: 100% !important; 
        text-align: center;
        box-sizing: border-box !important;
      }
      .thumbcaption { font-size: 0.85em; color: #8892b0 !important; padding-top: 8px; }
      .mw-parser-output img { max-width: 100% !important; height: auto !important; }

      .mw-parser-output h2, .mw-parser-output h3 { 
        border-bottom: 1px solid rgba(0, 255, 255, 0.3); 
        padding-bottom: 5px; 
        margin-top: 2em; 
        color: #fff !important; 
      }
      .mw-parser-output ul { margin-left: 1.5em; padding-left: 0; }
      .toc { 
        background: rgba(0, 0, 0, 0.5) !important; 
        border: 1px solid rgba(0, 255, 255, 0.2) !important; 
        padding: 20px !important; 
        display: inline-block; 
        margin-bottom: 2em; 
        max-width: 100%; 
        overflow-x: auto; 
        box-sizing: border-box !important;
      }

      /* --- MOBILE OPTIMIZATIONS --- */
      @media (max-width: 768px) {
        #wiki-reader-panel {
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
          padding: 60px 15px 20px 15px !important; /* Pad top to avoid close buttons */
          border-radius: 0 !important;
          border: none !important;
          outline: none !important;
        }

        /* Prevent infoboxes from crushing text on narrow screens */
        .infoboxWrap, .portable-infobox {
          float: none !important;
          width: 100% !important;
          margin: 1.5em 0 !important;
        }

        /* Adjust the main title so it fits below the header buttons */
        .wiki-reader-title {
          font-size: 1.25em !important;
          padding-right: 0 !important;
          margin-top: 20px !important;
        }

        /* Enlarge touch targets for comfortable mobile use */
        #close-reader-btn, #back-reader-btn {
          padding: 10px 14px !important;
          font-size: 0.95em !important;
        }
      }
    `;
    readerPanel.appendChild(wikiStyles);
    document.body.appendChild(readerPanel);
  }

  const hasHistory = window.wikiHistory.length > 1;

  readerPanel.innerHTML = `
    <style>${readerPanel.querySelector('style').textContent}</style>
    
    ${redirectedFrom ? `
      <div style="position: absolute; top: 80px; right: 20px; z-index: 100; background: rgba(20, 25, 40, 0.95); border: 1px dashed #00ffff; color: #e0e0e0; padding: 15px 20px; border-radius: 4px; box-shadow: 0 4px 15px rgba(0,0,0,0.5), 0 0 20px rgba(0,255,255,0.1); animation: hudToastFade 6.5s forwards; max-width: 350px;">
        <div style="color: #00ffff; font-size: 0.85em; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px;">Redirect Notice</div>
        Direct entry missing for <span style="color: #fff;">${redirectedFrom.replace(/_/g, ' ')}</span>.<br>Loaded related record instead.
      </div>
    ` : ''}

    <div style="position: absolute; top: 15px; right: 15px; z-index: 50; display: flex; gap: 10px;">
      ${hasHistory ? '<button id="back-reader-btn" class="hud-button" style="background: rgba(0, 255, 255, 0.1); border: 1px solid #00ffff; color: #00ffff;">[BckSpce] Back</button>' : ''}
      <button id="close-reader-btn" class="hud-button warning">[X] Close</button>
    </div>

    <div class="wiki-reader-title" style="color: #00ffff; font-size: 1.5em; text-transform: uppercase; margin-bottom: 20px; border-bottom: 1px solid rgba(0,255,255,0.5); padding-bottom: 10px; position: relative; z-index: 10; padding-right: 150px;">
      Accessing Database: ${pageTitle.replace(/_/g, ' ')}
    </div>
    
    <div id="wiki-content-area" style="line-height: 1.6; font-size: 0.95em; clear: both; position: relative; z-index: 10;">
      <div class="loading-spinner"></div>
    </div>
  `;
  
  readerPanel.style.display = 'block';

  document.getElementById('close-reader-btn').addEventListener('click', () => {
    document.getElementById('wiki-reader-panel').style.display = 'none';
    window.wikiHistory = []; 
  });

  const backBtn = document.getElementById('back-reader-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.wikiHistory.pop(); 
      const prevPage = window.wikiHistory[window.wikiHistory.length - 1]; 
      openArticleReader(prevPage, true); 
    });
  }

  try {
    // Instant Redirect: Pass the original title forward to trigger the toast UI
    if (!hasDirectArticle && fallbackMentions.length > 0) {
      window.wikiHistory.pop();
      const foundTitle = fallbackMentions[0];
      openArticleReader(foundTitle, false, pageTitle);
      return;
    }

    const apiUrl = `https://nmsgalactichub.miraheze.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&format=json&origin=*&disableeditsection=true`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.error) {
      if (data.error.code === 'missingtitle' && fallbackMentions.length > 0) {
        window.wikiHistory.pop();
        const foundTitle = fallbackMentions[0];
        openArticleReader(foundTitle, false, pageTitle);
        return;
      }
      throw new Error(data.error.info);
    }

    const contentArea = document.getElementById('wiki-content-area');
    contentArea.innerHTML = data.parse.text['*'];

    const images = contentArea.querySelectorAll('img');
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (src && src.startsWith('//')) {
        img.src = 'https:' + src;
      } else if (src && src.startsWith('/')) {
        img.src = 'https://nmsgalactichub.miraheze.org' + src;
      }
      img.removeAttribute('width');
      img.removeAttribute('height');
    });

    const links = contentArea.querySelectorAll('a');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;

      if (href.startsWith('#')) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          try {
            const targetId = href.substring(1);
            const targetElement = contentArea.querySelector(`[id="${CSS.escape(targetId)}"]`);
            if (targetElement) {
              targetElement.scrollIntoView({ behavior: 'smooth' });
            }
          } catch(err) {}
        });
        return;
      }

      if (href.startsWith('/wiki/')) {
        link.href = '#';
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const cleanPath = href.replace('/wiki/', '').split('#')[0];
          const newPageTitle = decodeURIComponent(cleanPath);
          openArticleReader(newPageTitle);
        });
        return;
      }

      if (href.includes('/w/index.php?title=')) {
        link.href = '#';
        link.addEventListener('click', (e) => {
          e.preventDefault();
          try {
            const url = new URL(href, 'https://nmsgalactichub.miraheze.org');
            const newPageTitle = url.searchParams.get('title');
            if (newPageTitle) openArticleReader(newPageTitle);
          } catch (err) {}
        });
        return;
      }

      if (href.startsWith('//')) {
        link.href = 'https:' + href;
      } else if (href.startsWith('/')) {
        link.href = 'https://nmsgalactichub.miraheze.org' + href;
      }
      
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });

  } catch (error) {
    document.getElementById('wiki-content-area').innerHTML = `
      <div style="color: #ff4757; margin-top: 20px; border: 1px solid #ff4757; padding: 15px; background: rgba(255, 71, 87, 0.1);">
        Database Error: Could not retrieve article.
        <br>Reason: ${error.message}
      </div>
    `;
  }
}
