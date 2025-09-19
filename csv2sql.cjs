const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;
const Papa = require('papaparse');

// Config
const RPI_ADDRESS_EUCLID = 'http://10.0.0.218:3000/upload';

const RPI_ADDRESS_CAL = 'http://10.0.0.218:4000/upload';
const CAL_SYSTEMS_CSV = './backend/galaxy_data/new_calypso_astrometrics.csv';
const EUCLID_SYSTEMS_CSV = './backend/galaxy_data/new_euclid_astrometrics.csv';

const SYSTEMS_CSV = CAL_SYSTEMS_CSV;
const RPI_ADDRESS = RPI_ADDRESS_CAL;

// Load and parse CSVs
function loadCSV(filepath) {
  const text = fs.readFileSync(filepath, 'utf8');
  console.log(text)
  return Papa.parse(text.slice(0, text.length-1), { header: true }).data;
}

// Convert values
function convertSystems(rows) {
  return rows.map(r => ({
    id: r.id,
    name: r.name || null,
    anchors: r.anchors,
    ghc_x: parseFloat(r.ghc_x) || null,
    ghc_y: parseFloat(r.ghc_y) || null,
    ghc_z: parseFloat(r.ghc_z) || null,
    color: r.color,
    is_anchor: r.is_anchor === '1' || r.is_anchor === 'true',
    anchor_id: r.anchor_id,
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
