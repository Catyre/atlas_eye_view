import * as tri from './trilateration.js';

export function validateCalculatedPositions(knownSystemsData, validationData) {
  console.log("Starting validation of calculated positions...");
    
  const anchorSystems = knownSystemsData.filter(system => 
    system.is_anchor === true || system.is_anchor === 'true' || system.is_anchor === 1
  );
  const nonAnchorSystems = knownSystemsData.filter(system => 
    system.is_anchor !== true && system.is_anchor !== 'true' && system.is_anchor !== 1
  );
  
  if (anchorSystems.length < 4) {
    console.error("Need at least 4 anchor systems for validation");
    return null;
  }

  const optimalGeometry = tri.chooseLeastCoplanarAnchors(anchorSystems);
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
  
  const anchors = GHUB_COORDINATE_SYSTEM.anchors;
  console.log("Anchors: " + Object.entries(anchors[0]));

  const validationResults = {
    anchorPositions: {
      A: anchors.A,
      B: anchors.B, 
      C: anchors.C,
      D: anchors.D
    },
    calculatedPositions: {},
    validationErrors: [],
    summary: {
      totalComparisons: 0,
      comparisonsWithErrors: 0,
      averageError: 0,
      maxError: 0,
      minError: Infinity
    }
  };
  
  let totalError = 0;
  let errorCount = 0;
 
  // Position of each system in GHC
  const systemPositions = {};
  
  nonAnchorSystems.forEach(system => {
    let usedAnchors = [];
    let sysAnchors = JSON.parse(system.anchors);
    try {
      // Todo: does not use least coplanar anchors
      // match up system's anchors with the ones that are used in GHUB_COORDINATE_SYSTEM
      anchors.forEach(anchor => {
        usedAnchors.push(sysAnchors[anchor.anchor_id]);
      })
      const sysDists = JSON.parse(system.anchors);
      
      const calculatedPosition = tri.multilaterate(GHUB_COORDINATE_SYSTEM, sysAnchors);
      
      systemPositions[system.name] = calculatedPosition;
      validationResults.calculatedPositions[system.name] = calculatedPosition;
    } catch (error) {
      console.error(`Error calculating position for ${system.name}:`, error);
      validationResults.validationErrors.push({
        system: system.name,
        error: error.message
      });
    }
  });
  
  validationData.forEach(validationEntry => {
    const fromSystem = validationEntry.from;
    const toSystems = validationEntry.to;
    
    if (!systemPositions[fromSystem]) {
      console.warn(`Missing position for system: ${fromSystem}`);
      return;
    }
    
    const fromPosition = systemPositions[fromSystem];
    
    Object.entries(toSystems).forEach(([toSystem, knownDistance]) => {
      if (!systemPositions[toSystem]) {
        console.warn(`Missing position for system: ${toSystem}`);
        return;
      }
      
      const toPosition = systemPositions[toSystem];
      const calculatedDistance = tri.calculateDistance(fromPosition, toPosition);
      const error = Math.abs(calculatedDistance - knownDistance);
      const percentError = (error / knownDistance) * 100;
      
      totalError += error;
      errorCount++;
      validationResults.summary.totalComparisons++;
      
      if (error > validationResults.summary.maxError) {
        validationResults.summary.maxError = error;
      }
      if (error < validationResults.summary.minError) {
        validationResults.summary.minError = error;
      }
      
      const NOISE_FLOOR_LY = 2.0;

      if (percentError > 5 && error > NOISE_FLOOR_LY) {
        validationResults.summary.comparisonsWithErrors++;
        validationResults.validationErrors.push({
          fromSystem: fromSystem,
          toSystem: toSystem,
          knownDistance: knownDistance,
          calculatedDistance: calculatedDistance,
          absoluteError: error,
          percentError: percentError
        });
      }
    });
  });
  
  if (errorCount > 0) {
    validationResults.summary.averageError = totalError / errorCount;
  }
  
  console.log("Validation Summary:", validationResults.summary);
  return validationResults;
}
