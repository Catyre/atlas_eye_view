import * as tri from './trilateration.js';
import { updateSystemDropdown } from './main.js';

const BACKEND = import.meta.env.VITE_BACKEND_URL;

async function updateSystemCoordinates(galaxy, systemName, coordinates) {
  let address = BACKEND + "update-coordinates?galaxy=" + encodeURIComponent(galaxy);
  
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

export async function processAstrometrics(galaxy) {
  let address = BACKEND + "systems?galaxy=" + encodeURIComponent(galaxy);

  let stars = [];
  try {
    const res = await fetch(address);
    if (!res.ok) throw new Error("Failed to fetch systems: " + res.status);
    stars = await res.json();
  } catch (err) {
    console.error("Could not fetch systems from backend:", err);
    alert("Could not load star systems from backend. Is the server running?");
    return; 
  }

  return new Promise(function(resolve, reject) {
    let starPosns = [];
    let systemData = {};

    const all_anchors = stars.filter(obj => obj.is_anchor).sort((a, b) => { return a.anchor_id.localeCompare(b.anchor_id)});

    if (all_anchors.length < 4) {
      console.error("Critical Error: Less than 4 anchor points found.");
      reject("Insufficient anchors");
      return;
    }

    all_anchors.forEach(anchor => {
      try {
        const parsedAnchors = typeof anchor.anchors === 'string' 
          ? JSON.parse(anchor.anchors) 
          : anchor.anchors;
        
        Object.assign(anchor, parsedAnchors);
      } catch (e) {
        console.warn(`Failed to parse anchors for system ${anchor.name}`);
      }
    });

    const optimalGeometry = tri.chooseLeastCoplanarAnchors(all_anchors);
    const selectedAnchors = optimalGeometry.anchors;
    const selectedAnchorPositions = optimalGeometry.anchorPositions;

    for (let i = 0; i < selectedAnchors.length; i++) {
        selectedAnchors[i].ghc_x = selectedAnchorPositions[i][0];
        selectedAnchors[i].ghc_y = selectedAnchorPositions[i][1];
        selectedAnchors[i].ghc_z = selectedAnchorPositions[i][2];
    }

    const {origin, basis} = tri.buildBasis(selectedAnchorPositions);

    const GHUB_COORDINATE_SYSTEM = {
      origin: origin,
      basis: basis,
      anchors: selectedAnchors
    }

    stars.forEach(system => {
      systemData[system.name] = system;
    });

    let processedCount = 0;
    let mapScale = 2;
    for (const system of stars) {
      let star_pos;
      try {
        const sys_anchors = typeof system.anchors === 'string' 
          ? JSON.parse(system.anchors) 
          : system.anchors;

        if (system.ghc_x === null || system.ghc_y === null || system.ghc_z === null){
          star_pos = tri.multilaterate(GHUB_COORDINATE_SYSTEM, sys_anchors);
          updateSystemCoordinates(galaxy, system.name, star_pos);
          systemData[system.name].ghc_x = star_pos[0] * mapScale;
          systemData[system.name].ghc_y = star_pos[1] * mapScale;
          systemData[system.name].ghc_z = star_pos[2] * mapScale;
        } else {
          star_pos = [system.ghc_x, system.ghc_y, system.ghc_z];
          starPosns.push(star_pos);
          systemData[system.name].ghc_x = star_pos[0] * mapScale;
          systemData[system.name].ghc_y = star_pos[1] * mapScale;
          systemData[system.name].ghc_z = star_pos[2] * mapScale;
        }
      } catch (e) {
        console.warn(`Failed to process position for system ${system.name}:`, e);
        continue;
      }

      processedCount++;
      if (processedCount % 10 === 0 || processedCount === stars.length) {
        console.log(`Processed ${processedCount}/${stars.length} systems (${((processedCount/stars.length)*100).toFixed(1)}%)`);
      }
    }

    console.log(`${stars.length} systems mapped!`)
    
    updateSystemDropdown(stars);

    if (systemData) {
      resolve(systemData);
    } else {
      reject("Failed to process astrometrics");
    }
  });
}
