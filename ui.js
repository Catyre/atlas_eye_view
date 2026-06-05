// TODO: Wiki data is now fetched for every system as its drawn...no need to fetch again when pulling system panel
// Move fetchWikiData to filter.js
import calculateDistance from 'trilateration.js';

export async function showSystemPopup(systemName, worldPosition, system, camera, popup) {
  if (!system) {
    console.warn(`No data found for system: ${systemName}`);
    return;
  }
  
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
  console.log(wikiData);
  
  let wikiSection = '';
  if (wikiData.error) {
    wikiSection = `
      <div class="wiki-section">
        <div class="wiki-title"> ${systemName} </div>
        ${JSON.parse(system.anchors).B}LY from Capital
        <div class="error-message">Galactic Hub Database</div>
        <div class="error-text">${wikiData.error}</div>
      </div>
    `;
  } else {
    wikiSection = `
      <div class="wiki-section" style="background: rgba(10, 15, 30, 0.6); border: 1px solid rgba(0, 255, 255, 0.2); padding: 15px; font-family: sans-serif;">
        
        <div style="border-bottom: 1px solid rgba(0, 255, 255, 0.3); padding-bottom: 10px; margin-bottom: 12px;">
          <div class="wiki-title" style="font-size: 1.25em; letter-spacing: 1px; text-transform: uppercase;">
            <a href="${wikiData.url}" target="_blank" style="color: #00ffff; text-decoration: none; text-shadow: 0 0 8px rgba(0,255,255,0.5);">${wikiData.title}</a>
          </div>
          <div style="color: #8892b0; font-size: 0.85em; font-family: monospace; margin-top: 4px;">
            DISTANCE: ${JSON.parse(system.anchors).B} LY FROM CAPITAL
          </div>
        </div>

        ${wikiData.summary ? `<div class="wiki-summary" style="font-style: italic; color: #a8b2d1; font-size: 0.9em; margin-bottom: 15px; line-height: 1.4;">${wikiData.summary}</div>` : ''}

        ${wikiData.glyphs ? `
          <div style="background: rgba(0, 0, 0, 0.5); border: 1px solid #333; padding: 10px; text-align: center; margin-bottom: 15px;">
            <div style="color: #00ffff; font-size: 0.75em; letter-spacing: 2px; margin-bottom: 5px;">[ PORTAL SEQUENCE ]</div>
            <div class="nms-glyph-text" style="color: #ffffff; text-shadow: 0 0 5px rgba(255,255,255,0.5);">${wikiData.glyphs}</div>
          </div>
        ` : ''}

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
