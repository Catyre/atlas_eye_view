import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('./backend/galaxy_data/astrometrics.sqlite');

async function scrapeBasesAndMapToSystems() {
  console.log('Initiating wiki base scrape...');
  
  const systemBasesMap = {};
  let continueParam = '';
  let hasMore = true;
  
  // Update this to match the exact category name used by the Galactic Hub
  const categoryName = encodeURIComponent('Category:Bases');

  try {
    while (hasMore) {
      // FIX 1: Added &cmnamespace=0 to ensure we ONLY pull articles, not images or subcategories
      const listUrl = `https://nmsgalactichub.miraheze.org/w/api.php?action=query&list=categorymembers&cmtitle=${categoryName}&cmnamespace=0&cmlimit=50&format=json${continueParam}`;
      const listResponse = await fetch(listUrl);
      const listData = await listResponse.json();

      if (!listData.query || !listData.query.categorymembers) {
        throw new Error('Failed to retrieve category members.');
      }

      const pages = listData.query.categorymembers;
      
      // If a batch is empty, break the loop
      if (pages.length === 0) break;

      const pageIds = pages.map(p => p.pageid).join('|');
      const contentUrl = `https://nmsgalactichub.miraheze.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&pageids=${pageIds}&format=json`;
      
      const contentResponse = await fetch(contentUrl);
      const contentData = await contentResponse.json();

      const pageObjects = contentData.query.pages;

      for (const id in pageObjects) {
        const page = pageObjects[id];
        const baseName = page.title;
        
        if (page.revisions && page.revisions[0] && page.revisions[0].slots && page.revisions[0].slots.main) {
          const wikitext = page.revisions[0].slots.main['*'];

          // FIX 2: Modified regex to grab the ENTIRE line until a line break, ignoring intermediate pipes
          const systemMatch = wikitext.match(/\|\s*system\s*=\s*([^\n]+)/i);
          
          if (systemMatch) {
            let rawSystem = systemMatch[1];
            
            // Aggressive string sanitation
            rawSystem = rawSystem.replace(/\[\[|\]\]|'''|''/g, '');
            
            if (rawSystem.includes('|')) {
              rawSystem = rawSystem.split('|')[0];
            }
            
            rawSystem = rawSystem.trim();

            // ISOLATE THE HUB ID
            let systemId = rawSystem;
            const idMatch = rawSystem.match(/(HUB\d+-[A-Z0-9]+)/i);
            
            if (idMatch) {
              systemId = idMatch[1].toUpperCase();
            }

            if (systemId) {
              console.log(systemId);
              if (!systemBasesMap[systemId]) {
                systemBasesMap[systemId] = [];
              }
              systemBasesMap[systemId].push(baseName);
            }
          } else {
            // Optional: Log bases that were found in the category but failed the regex check
            // console.warn(`Regex failed to find system parameter for base: ${baseName}`);
          }
        }
      }

      if (listData.continue && listData.continue.cmcontinue) {
        continueParam = `&cmcontinue=${listData.continue.cmcontinue}`;
        console.log(`Processing next batch...`);
      } else {
        hasMore = false;
      }
    }

    console.log('Scrape complete. Writing to local database...');

    db.serialize(() => {
      db.run("UPDATE systems SET hasBase = 0, bases = NULL");

      // Robust matching to prevent HUB1-7 from overwriting HUB1-74
      // 1. Checks if name contains [HUB1-74]
      // 2. Checks if name starts with HUB1-74 followed by a space
      // 3. Fallback for exact matches if no Hub ID was found
      const stmt = db.prepare(`
        UPDATE systems 
        SET hasBase = 1, bases = ? 
        WHERE id LIKE '%[' || ? || ']%' 
           OR id LIKE ? || ' %' 
           OR id = ?
      `);
      
      let updateCount = 0;
      for (const [sysId, bases] of Object.entries(systemBasesMap)) {
        stmt.run(JSON.stringify(bases), sysId, sysId, sysId);
        updateCount++;
      }
      
      stmt.finalize();
      console.log(`Successfully mapped bases to ${updateCount} systems.`);
    });

  } catch (error) {
    console.error(`Wiki scrape failed: ${error.message}`);
  }
}

scrapeBasesAndMapToSystems();
