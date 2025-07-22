import * as tri from './trilateration.js';

// Validation function that compares calculated positions with known distances
export function validateCalculatedPositions(knownSystemsData, validationData) {
  console.log("Starting validation of calculated positions...");
  
  // Extract anchor systems (systems with is_anchor = true)
  const anchorSystems = knownSystemsData.filter(system => JSON.parse(system.is_anchor));
  const nonAnchorSystems = knownSystemsData.filter(system => !JSON.parse(system.is_anchor));
  
  if (anchorSystems.length < 4) {
    console.error("Need at least 4 anchor systems for validation");
    return null;
  }
  
  // Use first 4 anchors to build coordinate system
  // Get all six pairwise distances between the four anchors
  const dAB = anchorSystems[0].B;
  const dAC = anchorSystems[0].C;
  const dAD = anchorSystems[0].D;
  const dBC = anchorSystems[1].C;
  const dBD = anchorSystems[1].D;
  const dCD = anchorSystems[2].D;

  // Reconstruct all four anchor positions
  let anchors;
  try {
    anchors = tri.reconstructAnchorsFromDistances(dAB, dAC, dAD, dBC, dBD, dCD);
  } catch (e) {
    console.error("Failed to reconstruct anchor positions for validation:", e);
    return null;
  }

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
  
  // Calculate positions for all systems (both anchor and non-anchor)
  const allSystems = [...anchorSystems, ...nonAnchorSystems];
  const systemPositions = {};
  
  // Store anchor positions
  systemPositions[anchorSystems[0].name] = anchors.A;
  systemPositions[anchorSystems[1].name] = anchors.B;
  systemPositions[anchorSystems[2].name] = anchors.C;
  systemPositions[anchorSystems[3].name] = anchors.D;
  
  // Calculate positions for non-anchor systems
  nonAnchorSystems.forEach(system => {
    try {
      const calculatedPosition = tri.trilaterate4(
        system.name,
        [anchors.A, anchors.B, anchors.C, anchors.D],
        [system.A, system.B, system.C, system.D]
      );
      
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
  
  // Validate against the validation_data
  validationData.forEach(validationEntry => {
    const fromSystem = validationEntry.from;
    const toSystems = validationEntry.to;
    
    // Check if we have the "from" system position
    if (!systemPositions[fromSystem]) {
      console.warn(`Missing position for system: ${fromSystem}`);
      return;
    }
    
    const fromPosition = systemPositions[fromSystem];
    
    // Validate each "to" system distance
    Object.entries(toSystems).forEach(([toSystem, knownDistance]) => {
      // Check if we have the "to" system position
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
      
      // Check if error exceeds threshold (e.g., 5% of known distance)
      if (percentError > 5) {
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
      
      console.log(`Distance ${fromSystem} → ${toSystem}: Known=${knownDistance}, Calculated=${calculatedDistance.toFixed(2)}, Error=${error.toFixed(2)} (${percentError.toFixed(2)}%)`);
    });
  });
  
  // Calculate summary statistics
  if (errorCount > 0) {
    validationResults.summary.averageError = totalError / errorCount;
  }
  
  // Log validation results
  console.log("Validation Summary:", validationResults.summary);
  console.log("Validation Results:", validationResults);
  
  return validationResults;
}