
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
export async function showSystemPopup(systemName, worldPosition, system, camera, popup) {
  // Find system data

  
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

