import * as tri from './trilateration.js';
import { updateSystemDropdown } from './main.js';

const BACKEND = 'https://atlas-eye-view.onrender.com/';
//const BACKEND = 'http://localhost:4000/';

// Function to update system coordinates on the backend
async function updateSystemCoordinates(galaxy, systemName, coordinates) {
  let address = "";
  if (galaxy === "euclid"){
    address = BACKEND + "update-coordinates";
  } else if (galaxy === "calypso") {
    address = BACKEND + "update-coordinates";
  }
  try {
    const updateData = {
      name: systemName,
      ghc_x: coordinates[0],
      ghc_y: coordinates[1],
      ghc_z: coordinates[2]
    };

    const response = await fetch(address, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Updated coordinates for ${systemName}: [${coordinates[0].toFixed(2)}, ${coordinates[1].toFixed(2)}, ${coordinates[2].toFixed(2)}]`);
    return result;
  } catch (error) {
    console.error(`Failed to update coordinates for ${systemName}:`, error.message);
    return null;
  }
}

// Fetch system database and process the data
export async function processAstrometrics(galaxy) {
  let address = "";
  if (galaxy === "euclid"){
    address = BACKEND + "systems";
  } else if (galaxy === "calypso") {
    address = BACKEND + "systems";
  }

  // Get system data from backend
  let stars = [];
  try {
    const res = await fetch(address);
    if (!res.ok) throw new Error("Failed to fetch systems: " + res.status);
    stars = await res.json();
  } catch (err) {
    console.error("Could not fetch systems from backend:", err);
    alert("Could not load star systems from backend. Is the server running?");
    return; // Stop further processing
  }

  let validationData = [];
  try {
    const validationRes = await fetch("./validation_data.json");
    validationData = await validationRes.json();
  } catch (error) {
    console.warn("Could not load validation_data.json:", error);
  }

  return new Promise(function(resolve, reject) {
    let starPosns = [];
    let systemData = {};

    const all_anchors = stars.filter(obj => obj.is_anchor).sort((a, b) => { return a.anchor_id.localeCompare(b.anchor_id)});
    console.log("All anchors: ", all_anchors); 

    // Build N x N pairwise distance matrix for anchors
    const N = all_anchors.length;
    const distMatrix = [];
    for (let i = 0; i < N; i++) {
      const i_id = all_anchors[i].anchor_id;

      distMatrix[i] = [];
      for (let j = 0; j < N; j++) {
        const j_id = all_anchors[j].anchor_id;
        if (i === j) {
          distMatrix[i][j] = 0;
        } else {
          // Try to get the distance from anchor i to anchor j
          // Use anchor_id as key
          let d = JSON.parse(all_anchors[i].anchors)[j_id];
          if (d === undefined) d = all_anchors[i].anchors[j_id];
          if (typeof d !== 'number') {
            // Try the reverse direction
            d = all_anchors[j].anchors[i_id];
            if (d === undefined) d = all_anchors[j].anchors[i_id];
          }
          distMatrix[i][j] = (typeof d === 'number') ? d : 0; // or NaN if you want to catch missing data
        }
      }
    }

    // Now reconstruct anchor positions
    const anchorPositions = tri.reconstructAnchorsFromPairwiseDistances(distMatrix);

    for (let i = 0; i < anchorPositions.length; i++) {
        all_anchors[i].ghc_x = anchorPositions[i][0];
        all_anchors[i].ghc_y = anchorPositions[i][1];
        all_anchors[i].ghc_z = anchorPositions[i][2];
    }

    const {origin, basis} = tri.buildBasis(anchorPositions);

    const GHUB_COORDINATE_SYSTEM = {
      origin: origin,
      basis: basis,
      anchors: all_anchors
    }

    // Store system data for popup
    stars.forEach(system => {
      systemData[system.name] = system;
    });

    // Use the loaded star data
    let processedCount = 0;
    for (const system of stars) {
      const sys_anchors = JSON.parse(system.anchors);

      // Estimate star position using multilateration (if the position does not already exist)
      let star_pos;
      try {
        if (system.ghc_x === null || system.ghc_y === null || system.ghc_z === null){
          star_pos = tri.multilaterate(GHUB_COORDINATE_SYSTEM, sys_anchors);
          updateSystemCoordinates(galaxy, system.name, star_pos);
          // Store the calculated position in the system data
          systemData[system.name].ghc_x = star_pos[0];
          systemData[system.name].ghc_y = star_pos[1];
          systemData[system.name].ghc_z = star_pos[2];
        } else {
          star_pos = tri.multilaterate(GHUB_COORDINATE_SYSTEM, sys_anchors);
          //star_pos = [system.ghc_x, system.ghc_y, system.ghc_z];
          starPosns.push(star_pos);
          // Ensure position is stored in systemData
          systemData[system.name].ghc_x = star_pos[0];
          systemData[system.name].ghc_y = star_pos[1];
          systemData[system.name].ghc_z = star_pos[2];
        }
      } catch (e) {
        console.warn(`Failed to multilaterate position for system ${system.name}:`, e);
        continue;
      }

      // Update progress
      processedCount++;
      if (processedCount % 10 === 0 || processedCount === stars.length) {
        console.log(`Processed ${processedCount}/${stars.length} systems (${((processedCount/stars.length)*100).toFixed(1)}%)`);
      }
    }

    console.log(`${stars.length} systems mapped!`)
    
    // Run validation on the loaded data
    //const validationResults = validateCalculatedPositions(stars, validationData);
    const validationResults = false;
    if (validationResults) {
      console.log("Position validation completed. Check console for detailed results.");
    }

    // Update anchor dropdown with the processed anchors
    updateSystemDropdown(stars);

    if (systemData) {
      console.log("systemdata", systemData)
      resolve(systemData);
    } else {
      reject("Failed to process astrometrics");
    }
  });
}
