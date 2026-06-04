
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
  
  const wikiData = await fetchWikiData(systemName);
  
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
      <div class="wiki-section">
        <div class="wiki-title">
          <a href="${wikiData.url}" target="_blank" style="color: inherit; text-decoration: none;">${wikiData.title}</a>
        </div>
        ${JSON.parse(system.anchors).B}LY from Capital
        ${wikiData.summary ? `<div class="wiki-summary">${wikiData.summary}</div>` : ''}
        ${wikiData.galaxy ? `<div class="wiki-info"><span>Galaxy:</span> ${wikiData.galaxy}</div>` : ''}
        ${wikiData.region ? `<div class="wiki-info"><span>Region:</span> ${wikiData.region}</div>` : ''}
        ${wikiData.planets ? `<div class="wiki-info"><span>Planets:</span> ${wikiData.planets}</div>` : ''}
        ${wikiData.moons ? `<div class="wiki-info"><span>Moons:</span> ${wikiData.moons}</div>` : ''}
        ${wikiData.spectral_class ? `<div class="wiki-info"><span>Spectral Class:</span> ${wikiData.spectral_class}</div>` : ''}
        ${wikiData.distance ? `<div class="wiki-info"><span>Distance:</span> ${wikiData.distance}</div>` : ''}
        ${wikiData.glyphs ? `<div class="wiki-info glyphs"><span>Glyphs:</span> ${wikiData.glyphs}</div>` : ''}
        ${wikiData.waterworlds ? `<div class="wiki-info"><span>Waterworlds:</span> ${wikiData.waterworlds}</div>` : ''}
        ${wikiData.dissonant ? `<div class="wiki-info"><span>Dissonant:</span> ${wikiData.dissonant}</div>` : ''}
        ${wikiData.faction ? `<div class="wiki-info"><span>Faction:</span> ${wikiData.faction}</div>` : ''}
        ${wikiData.economy ? `<div class="wiki-info"><span>Economy:</span> ${wikiData.economy}</div>` : ''}
        ${wikiData.wealth ? `<div class="wiki-info"><span>Wealth:</span> ${wikiData.wealth}</div>` : ''}
        ${wikiData.conflict ? `<div class="wiki-info"><span>Conflict:</span> ${wikiData.conflict}</div>` : ''}
        ${wikiData.discoveredBy ? `<div class="wiki-info"><span>Discovered by:</span> ${wikiData.discoveredBy}</div>` : ''}
        
        <div style="margin-top: 15px; text-align: center;">
          <a href="${wikiData.url}" target="_blank" rel="noopener noreferrer" style="display: block; padding: 8px; background: rgba(0, 255, 255, 0.1); border: 1px solid #00ffff; color: #00ffff; text-decoration: none; border-radius: 4px; font-size: 0.9em; transition: background 0.2s;">
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
