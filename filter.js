export function setupFilters(scene, getLabelsVisible, triggerRender) {
  const toggleFilterBtn = document.createElement('button');
  toggleFilterBtn.id = 'toggle-filter-btn';
  toggleFilterBtn.className = 'hud-button';
  toggleFilterBtn.textContent = 'DATABASE FILTERS >';
  
  toggleFilterBtn.style.position = 'absolute';
  toggleFilterBtn.style.top = '130px';
  toggleFilterBtn.style.right = '20px';
  toggleFilterBtn.style.zIndex = '101';
  toggleFilterBtn.style.transition = 'background 0.2s, color 0.2s';
  document.body.appendChild(toggleFilterBtn);

  toggleFilterBtn.addEventListener('mousedown', (e) => e.stopPropagation());
  toggleFilterBtn.addEventListener('click', (e) => e.stopPropagation());

  const filterPanel = document.createElement('div');
  filterPanel.id = 'filter-panel';
  filterPanel.className = 'hud-panel';
  
  filterPanel.style.position = 'absolute';
  filterPanel.style.top = '155px'; 
  filterPanel.style.right = '20px';
  filterPanel.style.zIndex = '100';
  filterPanel.style.width = '280px';
  filterPanel.style.background = 'rgba(10, 15, 30, 0.85)';
  filterPanel.style.border = '1px solid rgba(0, 255, 255, 0.3)';
  filterPanel.style.padding = '15px';
  filterPanel.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.1)';
  
  filterPanel.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
  filterPanel.style.transform = 'translateX(120%)'; 
  filterPanel.style.opacity = '0';
  filterPanel.style.pointerEvents = 'none';

  filterPanel.innerHTML = `
    <div style="color: #00ffff; font-size: 0.9rem; letter-spacing: 2px; margin-bottom: 15px; border-bottom: 1px solid rgba(0,255,255,0.3); padding-bottom: 5px;">
      [ SEARCH PARAMETERS ]
    </div>
    
    <div style="margin-bottom: 12px;">
      <label style="display: block; font-size: 0.75rem; color: #8892b0; margin-bottom: 4px;">SEARCH NAME / HUBTAG</label>
      <input type="text" id="filter-text" placeholder="e.g., HUB1-1" style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid #444; color: #fff; padding: 4px 8px; font-family: monospace;">
    </div>
    
    <div style="display: flex; gap: 10px; margin-bottom: 12px;">
      <div style="flex: 1;">
        <label style="display: block; font-size: 0.75rem; color: #8892b0; margin-bottom: 4px;">STAR COLOR</label>
        <select id="filter-color" style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid #444; color: #fff; padding: 4px 8px; font-family: monospace;">
          <option value="all">All</option>
          <option value="yellow">Yellow</option>
          <option value="red">Red</option>
          <option value="green">Green</option>
          <option value="blue">Blue</option>
        </select>
      </div>
      <div style="flex: 1;">
        <label style="display: block; font-size: 0.75rem; color: #8892b0; margin-bottom: 4px;">FACTION</label>
        <select id="filter-faction" style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid #444; color: #fff; padding: 4px 8px; font-family: monospace;">
          <option value="all">Any</option>
          <option value="gek">Gek</option>
          <option value="korvax">Korvax</option>
          <option value="vy'keen">Vy'keen</option>
          <option value="uncharted">Uncharted</option>
        </select>
      </div>
    </div>

    <div style="margin-bottom: 12px;">
      <label style="display: block; font-size: 0.75rem; color: #8892b0; margin-bottom: 4px;">ECONOMY / WEALTH</label>
      <input type="text" id="filter-economy" placeholder="e.g., Wealthy, Trading" style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid #444; color: #fff; padding: 4px 8px; font-family: monospace;">
    </div>

    <div style="margin-bottom: 12px;">
      <label style="display: block; font-size: 0.75rem; color: #8892b0; margin-bottom: 4px;">CONFLICT LEVEL</label>
      <input type="text" id="filter-conflict" placeholder="e.g., High, Peaceful" style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid #444; color: #fff; padding: 4px 8px; font-family: monospace;">
    </div>

    <div style="display: flex; gap: 10px; margin-bottom: 15px; border-top: 1px solid rgba(0,255,255,0.1); padding-top: 10px; flex-wrap: wrap;">
      <label style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #8892b0; cursor: pointer;">
        <input type="checkbox" id="filter-dissonant"> Dissonant
      </label>
      <label style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #8892b0; cursor: pointer;">
        <input type="checkbox" id="filter-water"> Waterworld
      </label>
      <label style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #8892b0; cursor: pointer;">
        <input type="checkbox" id="filter-nowiki"> No Wiki Page
      </label>
      <label style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #8892b0; cursor: pointer;">
        <input type="checkbox" id="filter-haswiki"> Wiki Page
      </label>
    </div>

    <div style="display: flex; gap: 10px;">
      <button id="apply-filters-btn" class="hud-button" style="flex: 1;">Apply</button>
      <button id="reset-filters-btn" class="hud-button" style="flex: 1; background: rgba(255,0,0,0.1); border-color: #fc5c65; color: #fc5c65;">Reset</button>
    </div>
  `;
  document.body.appendChild(filterPanel);

  let isFilterOpen = false;

  toggleFilterBtn.addEventListener('click', () => {
    isFilterOpen = !isFilterOpen;
    
    if (isFilterOpen) {
      filterPanel.style.transform = 'translateX(0)';
      filterPanel.style.opacity = '1';
      filterPanel.style.pointerEvents = 'auto';
      
      toggleFilterBtn.textContent = 'DATABASE FILTERS v';
      toggleFilterBtn.style.background = 'rgba(0, 255, 255, 0.2)';
      toggleFilterBtn.style.color = '#fff';
    } else {
      filterPanel.style.transform = 'translateX(120%)';
      filterPanel.style.opacity = '0';
      filterPanel.style.pointerEvents = 'none';
      
      toggleFilterBtn.textContent = 'DATABASE FILTERS >';
      toggleFilterBtn.style.background = '';
      toggleFilterBtn.style.color = '';
    }
  });

  filterPanel.addEventListener('mousedown', (e) => e.stopPropagation());
  filterPanel.addEventListener('click', (e) => e.stopPropagation());

  const applyFiltersBtn = document.getElementById('apply-filters-btn');
  const resetFiltersBtn = document.getElementById('reset-filters-btn');
  const filterTextInput = document.getElementById('filter-text');
  const filterColorInput = document.getElementById('filter-color');
  const filterFactionInput = document.getElementById('filter-faction');
  const filterEconomyInput = document.getElementById('filter-economy');
  const filterConflictInput = document.getElementById('filter-conflict');
  const filterDissonantInput = document.getElementById('filter-dissonant');
  const filterWaterInput = document.getElementById('filter-water');
  const filterNoWikiInput = document.getElementById('filter-nowiki');
  const filterHasWikiInput = document.getElementById('filter-haswiki');

  function runFilters() {
    const searchTerm = filterTextInput.value.toLowerCase().trim();
    const selectedColor = filterColorInput.value.toLowerCase();
    const selectedFaction = filterFactionInput.value.toLowerCase();
    const searchEconomy = filterEconomyInput.value.toLowerCase().trim();
    const searchConflict = filterConflictInput.value.toLowerCase().trim();
    const requireDissonant = filterDissonantInput.checked;
    const requireWater = filterWaterInput.checked;
    const requireNoWiki = filterNoWikiInput.checked;
    const requireHasWiki = filterHasWikiInput.checked;

    let totalChecked = 0;
    let matchCount = 0;

    scene.traverse((child) => {
      if (child.userData && child.userData.systemData) {
        
        if (child.userData.isSystemStar) {
          totalChecked++;
        }
        
        const data = child.userData.systemData;
        
        let wiki = {};
        if (child.userData.wikiData) {
          try {
            wiki = JSON.parse(child.userData.wikiData);
          } catch (e) {
            console.error('Failed to parse wiki data for system:', data.name);
          }
        }

        let isMatch = true;

        if (searchTerm !== '') {
          const sysName = data.name ? String(data.name).toLowerCase() : '';
          const sysId = data.id ? String(data.id).toLowerCase() : '';
          if (!sysName.includes(searchTerm) && !sysId.includes(searchTerm)) {
            isMatch = false;
          }
        }

        if (selectedColor !== 'all' && isMatch) {
          const sysColor = data.color ? String(data.color).toLowerCase() : '';
          if (!sysColor.includes(selectedColor)) {
            isMatch = false;
          }
        }

        if (selectedFaction !== 'all' && isMatch) {
          const sysFaction = wiki.faction ? String(wiki.faction).toLowerCase() : '';
          if (selectedFaction === 'uncharted') {
            if (!sysFaction.includes('uncharted') && !sysFaction.includes('abandoned') && sysFaction !== '') isMatch = false;
          } else {
            if (!sysFaction.includes(selectedFaction)) isMatch = false;
          }
        }

        if (searchEconomy !== '' && isMatch) {
          const sysEconomy = wiki.economy ? String(wiki.economy).toLowerCase() : '';
          const sysWealth = wiki.wealth ? String(wiki.wealth).toLowerCase() : '';
          if (!sysEconomy.includes(searchEconomy) && !sysWealth.includes(searchEconomy)) {
            isMatch = false;
          }
        }

        if (searchConflict !== '' && isMatch) {
          const sysConflict = wiki.conflict ? String(wiki.conflict).toLowerCase() : '';
          if (!sysConflict.includes(searchConflict)) {
            isMatch = false;
          }
        }

        if (requireDissonant && isMatch) {
          const isDissonant = wiki.dissonant && String(wiki.dissonant).toLowerCase() !== 'no' && String(wiki.dissonant) !== '0';
          if (!isDissonant) isMatch = false;
        }

        if (requireWater && isMatch) {
          const hasWater = wiki.waterworlds && String(wiki.waterworlds).toLowerCase() !== 'no' && String(wiki.waterworlds) !== '0';
          if (!hasWater) isMatch = false;
        }

        if (requireNoWiki && isMatch) {
          const hasDedicatedPage = wiki.title && wiki.title !== 'Reference Only';
          if (hasDedicatedPage) {
            isMatch = false;
          }
        }

        if (requireHasWiki && isMatch) {
          const hasDedicatedPage = wiki.title && wiki.title !== 'Reference Only';
          if (!hasDedicatedPage) {
            isMatch = false;
          }
        }

        if (child.userData.isSystemStar) {
          child.visible = isMatch;
          if (isMatch) matchCount++;
        } else if (child.userData.isLabel) {
          const areLabelsOn = typeof getLabelsVisible === 'function' ? getLabelsVisible() : true;
          child.visible = isMatch && areLabelsOn;
        }
      }
    });

    console.log(`[FILTER] Scanned ${totalChecked} stars. Found ${matchCount} matches.`);
    
    if (typeof triggerRender === 'function') {
      triggerRender();
    }
  }

  applyFiltersBtn.addEventListener('click', runFilters);


  const handleEnterKey = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') runFilters();
  };

  filterTextInput.addEventListener('keydown', handleEnterKey);
  filterEconomyInput.addEventListener('keydown', handleEnterKey);
  filterConflictInput.addEventListener('keydown', handleEnterKey);

  resetFiltersBtn.addEventListener('click', () => {
    let totalRestored = 0;

    scene.traverse((child) => {
      if (child.userData && child.userData.systemData) {
        if (child.userData.isSystemStar) {
          child.visible = true;
          totalRestored++;
        } else if (child.userData.isLabel) {
          const areLabelsOn = typeof getLabelsVisible === 'function' ? getLabelsVisible() : true;
          child.visible = areLabelsOn;
        }
      }
    });

    console.log(`[FILTER] Map reset. Restored visibility to ${totalRestored} systems.`);

    if (typeof triggerRender === 'function') {
      triggerRender();
    }
  });
}
