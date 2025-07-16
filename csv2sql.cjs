const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;
const Papa = require('papaparse');

// Config
const RPI_ADDRESS = 'http://192.168.1.96:3000/upload';  // replace with your Pi's IP
const SYSTEMS_CSV = './euclid_systems_backup.csv';

// Load and parse CSVs
function loadCSV(filepath) {
  const text = fs.readFileSync(filepath, 'utf8');
  return Papa.parse(text, { header: true }).data;
}

// Convert values
function convertSystems(rows) {
  return rows.map(r => ({
    id: r.id,
    name: r.name || null,
    A: parseFloat(r.A),
    B: parseFloat(r.B),
    C: parseFloat(r.C),
    D: parseFloat(r.D),
    ghc_x: parseFloat(r.ghc_x),
    ghc_y: parseFloat(r.ghc_y),
    ghc_z: parseFloat(r.ghc_z),
    color: r.color,
    is_anchor: r.is_anchor === '1' || r.is_anchor === 'true',
    confidence: parseFloat(r.confidence || 0)
  }));
}

// Send to Pi
async function uploadData() {
  const systems = convertSystems(loadCSV(SYSTEMS_CSV));

  console.log(JSON.stringify(systems));

  const response = await fetch(RPI_ADDRESS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({systems})
  });

  const result = await response.json();
  console.log(result);
}

uploadData().catch(console.error);
