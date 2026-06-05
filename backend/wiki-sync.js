import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'galaxy_data', 'astrometrics.sqlite');

const API_BASE = 'https://nmsgalactichub.miraheze.org/w/api.php';
const DELAY_MS = 500; 

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to database.');
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function unescapeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/');
}

// Helper function to extract a value using multiple possible field names (aliases)
function extractWikiValue(text, fieldNames) {
  if (!Array.isArray(fieldNames)) {
    fieldNames = [fieldNames];
  }
  
  for (let i = 0; i < fieldNames.length; i++) {
    const fieldName = fieldNames[i];
    const regex = new RegExp(`\\|\\s*${fieldName}\\s*=\\s*(.*?)(?=\\n\\s*\\||\\n\\s*\\}\\})`, 'is');
    const match = text.match(regex);
    
    if (match && match[1]) {
      let value = match[1].trim();
      value = value.replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1');
      if (value !== '') {
        return value;
      }
    }
  }
  return '';
}

// Helper function to extract a brief summary after ignoring the infobox
function extractSummary(text) {
  let cleanText = text.replace(/\{\{[Ss]ystem infobox[\s\S]*?\n\}\}/, '');
  cleanText = cleanText.replace(/\{\{Infobox[\s\S]*?\n\}\}/i, '');
  cleanText = cleanText.replace(/\[\[File:.*?\]\]/ig, '');
  cleanText = cleanText.replace(/\{\{.*?\}\}/g, '');
  
  const paragraphs = cleanText.split(/\n+/);
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (trimmed.length > 25 && !trimmed.startsWith('==') && !trimmed.startsWith('|')) {
      return trimmed.replace(/'''?/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1').substring(0, 300);
    }
  }
  return '';
}

async function fetchWikiData(systemName) {
  try {
    const rawName = unescapeString(systemName);
    const cleanName = rawName.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    
    const searchUrl = `${API_BASE}?action=query&list=search&srsearch="${encodeURIComponent(cleanName)}"&format=json&origin=*`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: { 'Api-User-Agent': 'Astrometrics Node Sync' }
    });
    
    if (!searchResponse.ok) throw new Error(`Search request failed: ${searchResponse.status}`);
    const searchData = await searchResponse.json();
    
    if (!searchData.query || searchData.query.search.length === 0) {
      return { status: 'not_found' };
    }

    const topResult = searchData.query.search[0];
    
    const wikiData = {
      title: topResult.title,
      url: `https://nmsgalactichub.miraheze.org/wiki/${encodeURIComponent(topResult.title.replace(/ /g, '_'))}`,
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
      mentioned_in: [] 
    };

    if (topResult.title.toLowerCase() !== cleanName.toLowerCase()) {
      wikiData.mentioned_in = searchData.query.search.slice(0, 5).map(result => result.title);
      wikiData.title = 'Reference Only';
      wikiData.summary = `System does not have a dedicated page, but is referenced in: ${wikiData.mentioned_in.join(', ')}`;
      return { status: 'mentions_only', data: wikiData };
    }

    const contentUrl = `${API_BASE}?action=query&prop=revisions&rvprop=content&pageids=${topResult.pageid}&format=json&origin=*`;
    const contentResponse = await fetch(contentUrl, {
      headers: { 'Api-User-Agent': 'Astrometrics Node Sync' }
    });
    
    if (!contentResponse.ok) throw new Error(`Content request failed: ${contentResponse.status}`);
    const contentData = await contentResponse.json();
    
    const page = contentData.query.pages[topResult.pageid];
    if (!page || !page.revisions) return { status: 'parse_error' };

    const rawWikitext = page.revisions[0]['*'];
    
    wikiData.summary = extractSummary(rawWikitext);
    wikiData.galaxy = extractWikiValue(rawWikitext, 'galaxy');
    wikiData.region = extractWikiValue(rawWikitext, 'region');
    wikiData.planets = extractWikiValue(rawWikitext, ['planets', 'planet']);
    wikiData.moons = extractWikiValue(rawWikitext, ['moons', 'moon']);
    wikiData.spectral_class = extractWikiValue(rawWikitext, ['spectral_class', 'class']);
    wikiData.distance = extractWikiValue(rawWikitext, 'distance');
    wikiData.glyphs = extractWikiValue(rawWikitext, ['portalglyphs', 'glyphs', 'coordinates']);
    wikiData.waterworlds = extractWikiValue(rawWikitext, ['waterworlds', 'water']);
    wikiData.dissonant = extractWikiValue(rawWikitext, 'dissonant');
    wikiData.faction = extractWikiValue(rawWikitext, 'faction');
    wikiData.economy = extractWikiValue(rawWikitext, 'economy');
    wikiData.wealth = extractWikiValue(rawWikitext, 'wealth');
    wikiData.conflict = extractWikiValue(rawWikitext, 'conflict');
    wikiData.discoveredBy = extractWikiValue(rawWikitext, ['discoverer', 'discovered_by', 'discoveredby']);
    
    return { status: 'success', data: wikiData };
    
  } catch (error) {
    console.error('Error fetching wiki data:', error);
    return { status: 'error', message: error.message };
  }
}

async function processSystems() {
  console.log('Ensuring wiki_data column exists...');
  
  await new Promise((resolve) => {
    db.run('ALTER TABLE systems ADD COLUMN wiki_data TEXT', () => {
      resolve();
    });
  });

  db.all('SELECT id, name FROM systems', async (err, rows) => {
    if (err) {
      console.error('Error fetching systems:', err.message);
      return;
    }

    console.log(`Found ${rows.length} systems to process. Starting synchronization...`);

    for (let i = 0; i < rows.length; i++) {
      const system = rows[i];
      console.log(`[${i + 1}/${rows.length}] Fetching data for: ${system.name}`);

      const pageName = system.id + " " + system.name;
      let result = await fetchWikiData(pageName);

      if (result.status !== 'success') {
        console.log("   No system found under " + pageName + ".  Trying " + system.name);
        result = await fetchWikiData(system.name);
      }

      if (result.status === 'success' || result.status === 'mentions_only') {
        const updateQuery = 'UPDATE systems SET wiki_data = ? WHERE id = ?';
        await new Promise((resolve, reject) => {
          db.run(updateQuery, [JSON.stringify(result.data), system.id], function(updateErr) {
            if (updateErr) reject(updateErr);
            else resolve();
          });
        });
        
        if (result.status === 'mentions_only') {
          console.log(`   -> No direct page. Found mentions in ${result.data.mentioned_in.length} other pages.`);
        } else {
          console.log(`   -> Successfully updated exact match.`);
        }
      } else if (result.status === 'not_found') {
        console.log(`   -> No results found anywhere on the wiki.`);
      } else {
        console.log(`   -> Error processing system.`);
      }

      await sleep(DELAY_MS);
    }

    console.log('Synchronization complete.');
    db.close();
  });
}

processSystems();
