const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;
const Papa = require('papaparse');

// Config
const CAL_SYSTEMS_CSV = path.join(__dirname, 'backend', 'galaxy_data', 'calypso_astrometrics.csv');
const EUCLID_SYSTEMS_CSV = path.join(__dirname, 'backend', 'galaxy_data', 'new_euclid_astrometrics.csv');

const SYSTEMS_CSV = CAL_SYSTEMS_CSV;
const BACKEND_ADDRESS = 'http://localhost:10000/upload'; 

// Load and parse CSVs
function loadCSV(filepath) {
  const text = fs.readFileSync(filepath, 'utf8');
  
  return Papa.parse(text, { 
    header: true,
    skipEmptyLines: true // Safely handles trailing newlines
  }).data;
}

// Convert values
function convertSystems(rows) {
  return rows.map(r => {
    // Safely parse floats to preserve 0.0 values
    const parseCoord = (val) => {
      const parsed = parseFloat(val);
      return Number.isNaN(parsed) ? null : parsed;
    };

    return {
      id: r.id,
      name: r.name || null,
      anchors: r.anchors,
      ghc_x: parseCoord(r.ghc_x),
      ghc_y: parseCoord(r.ghc_y),
      ghc_z: parseCoord(r.ghc_z),
      color: r.color,
      is_anchor: r.is_anchor === '1' || r.is_anchor === 'true',
      anchor_id: r.anchor_id,
      confidence: parseFloat(r.confidence) || 0,
      galaxy: r.galaxy
    };
  });
}

// Send to server
async function uploadData() {
  try {
    const systems = convertSystems(loadCSV(SYSTEMS_CSV));
    console.log(`Prepared ${systems.length} systems for upload.`);

    const response = await fetch(BACKEND_ADDRESS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systems })
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Upload successful:', result);
  } catch (err) {
    console.error('Upload failed:', err);
  }
}

uploadData();
