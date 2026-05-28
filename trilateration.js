// TODO: Choose least coplanar three anchors for basis
//  Introduce confidence calculations
//  Dyanmic anchors

import * as numeric from 'numeric';
import * as math from 'mathjs';
import { Matrix, EigenvalueDecomposition } from 'ml-matrix';

function rotate3D(v, axis, angle) {
  const [x, y, z] = v;
  const cos = Math.cos(angle * Math.PI/180);
  const sin = Math.sin(angle*Math.PI/180);

  switch (axis) {
    case 'x': return [x, y * cos - z * sin, y * sin + z * cos];
    case 'y': return [x * cos + z * sin, y, -x * sin + z * cos];
    case 'z': return [x * cos - y * sin, x * sin + y * cos, z];
    default: throw new Error("Invalid axis");
  }
}

// Calculate Euclidean distance between two 3D points
export function calculateDistance(point1, point2) {
  const dx = point1[0] - point2[0];
  const dy = point1[1] - point2[1];
  const dz = point1[2] - point2[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Calculate the volume of a tetrahedron formed by 4 points
// This measures how "non-coplanar" the points are
function calculateTetrahedronVolume(P1, P2, P3, P4) {
  // Create vectors from P1 to the other points
  const v1 = numeric.sub(P2, P1);
  const v2 = numeric.sub(P3, P1);
  const v3 = numeric.sub(P4, P1);
  
  // Calculate the scalar triple product: |v1 · (v2 × v3)|
  const crossProduct = math.cross(v2, v3);
  const volume = Math.abs(numeric.dot(v1, crossProduct)) / 6;
  
  return volume;
}


// Given anchorPositions: Array of [x, y, z]
// and distances: Array of distances to the unknown point
// Returns: [x, y, z] of the estimated point
export function multilaterate1(anchors, distances) {
  // Use nonlinear least squares to minimize the error
  // between the calculated and measured distances
  // We'll use numeric.js's uncmin for minimization

  // Initial guess: centroid of anchors
  const centroid = anchors.reduce((acc, p) => [acc[0]+p[0], acc[1]+p[1], acc[2]+p[2]], [0,0,0])
    .map(x => x/anchors.length);

  function errorFunc(pos) {
    let sum = 0;
    for (let i = 0; i < anchors.length; i++) {
      const dx = pos[0] - anchors[i][0];
      const dy = pos[1] - anchors[i][1];
      const dz = pos[2] - anchors[i][2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      sum += (dist - distances[i]) ** 2;
    }
    return sum;
  }

  const result = numeric.uncmin(errorFunc, centroid);
  return result.solution;
}

// Calculate the volume of a tetrahedron using the Cayley-Menger determinant
function cayleyMengerVolume(d12, d13, d14, d23, d24, d34) {
  // Cayley-Menger determinant for 4 points
  // dXY are the pairwise distances between points X and Y
  const M = [
    [0,      1,      1,      1,      1     ],
    [1,      0, d12*d12, d13*d13, d14*d14],
    [1, d12*d12,      0, d23*d23, d24*d24],
    [1, d13*d13, d23*d23,      0, d34*d34],
    [1, d14*d14, d24*d24, d34*d34,     0]
  ];
  const det = math.det(M);
  if (det < 0) return 0; // Negative due to floating point error, treat as 0
  return Math.sqrt(det / 288);
}

// Choose the 4 least coplanar anchor points from available anchors
export function chooseLeastCoplanarAnchors(anchors) {
  const numAnchors = anchors.length;
  const anchor_ids = anchors.map(a => (a.anchor_id !== "false") ? a.anchor_id : a.name);

  if (numAnchors < 4) {
    throw new Error(`Need at least 4 anchor points, but only ${numAnchors} are available`);
  }

  let bestVolume = 0;
  let bestAnchors = [anchors[0], anchors[1], anchors[2], anchors[3]]; 
  let bestPositions = [];

  for (let i = 0; i < numAnchors - 3; i++) {
    for (let j = i + 1; j < numAnchors - 2; j++) {
      for (let k = j + 1; k < numAnchors - 1; k++) {
        for (let l = k + 1; l < numAnchors; l++) {
          
          const dAB = anchors[i][anchor_ids[j]] || anchors[j][anchor_ids[i]];
          const dAC = anchors[i][anchor_ids[k]] || anchors[k][anchor_ids[i]];
          const dAD = anchors[i][anchor_ids[l]] || anchors[l][anchor_ids[i]];
          const dBC = anchors[j][anchor_ids[k]] || anchors[k][anchor_ids[j]];
          const dBD = anchors[j][anchor_ids[l]] || anchors[l][anchor_ids[j]];
          const dCD = anchors[k][anchor_ids[l]] || anchors[l][anchor_ids[k]];

          if (
            typeof dAB !== 'number' || typeof dAC !== 'number' || typeof dAD !== 'number' ||
            typeof dBC !== 'number' || typeof dBD !== 'number' || typeof dCD !== 'number' ||
            isNaN(dAB) || isNaN(dAC) || isNaN(dAD) || isNaN(dBC) || isNaN(dBD) || isNaN(dCD)
          ) {
            continue; 
          }

          const distMatrix = [
            [0,   dAB, dAC, dAD],
            [dAB, 0,   dBC, dBD],
            [dAC, dBC, 0,   dCD],
            [dAD, dBD, dCD, 0  ]
          ];

          let positions;
          try {
            positions = reconstructAnchorsFromPairwiseDistances(distMatrix);
          } catch (e) {
            continue;
          }
          
          const [ P1, P2, P3, P4 ] = positions;

          const cmVolume = cayleyMengerVolume(dAB, dAC, dAD, dBC, dBD, dCD);
          if (cmVolume < 1e-6) {
            console.warn(`Cayley-Menger volume for anchors [${anchors[i].name}, ${anchors[j].name}, ${anchors[k].name}, ${anchors[l].name}] is too small: ${cmVolume}`);
          }

          const volume = calculateTetrahedronVolume(P1, P2, P3, P4);

          if (volume > bestVolume) {
            bestVolume = volume;
            bestAnchors = [anchors[i], anchors[j], anchors[k], anchors[l]];
            bestPositions = [P1, P2, P3, P4];
          }
        }
      }
    }
  }

  console.log(`Selected anchors for trilateration: ${bestAnchors.map(a => a.name).join(', ')} (volume: ${bestVolume.toFixed(6)})`);

  return {
    anchors: bestAnchors,
    anchorPositions: bestPositions
  };
}


/**
 * Reconstructs N anchor positions in 3D from an N x N pairwise distance matrix using classical MDS.
 * @param {Array<Array<number>>} distMatrix - N x N matrix of pairwise distances
 * @returns {Array<[number, number, number]>} Array of N positions [x, y, z]
 */
export function reconstructAnchorsFromPairwiseDistances(distMatrix) {
  const N = distMatrix.length;
  // Step 1: Square the distance matrix
  const D2 = distMatrix.map(row => row.map(x => x * x));

  // Step 2: Double centering
  const rowMeans = D2.map(row => numeric.sum(row) / N);
  const colMeans = numeric.transpose(D2).map(col => numeric.sum(col) / N);
  const totalMean = numeric.sum(D2.flat()) / (N * N);

  // Build Gram matrix B
  const B = numeric.rep([N, N], 0);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      //console.log("D2[i][j]: ", D2[i][j], "rowMeans[i]: ", rowMeans[i], "colMeans[j]: ", colMeans[j], "totalMean: ", totalMean);
      B[i][j] = -0.5 * (D2[i][j] - rowMeans[i] - colMeans[j] + totalMean);
    }
  }

  // Step 3: Eigen-decomposition (using ml-matrix)
  //console.log("B: ", B);
  const Bmat = new Matrix(B);
  const eig = new EigenvalueDecomposition(Bmat);
  const eigenvalues = eig.realEigenvalues;
  const eigenvectors = eig.eigenvectorMatrix.to2DArray();
  // Sort eigenvalues/vectors by descending eigenvalue
  const idx = eigenvalues
    .map((val, i) => [val, i])
    .sort((a, b) => b[0] - a[0])
    .map(pair => pair[1]);
  // Take top 3
  const L = idx.slice(0, 3).map(i => eigenvalues[i]);
  const V = idx.slice(0, 3).map(i => eigenvectors.map(row => row[i]));

  // Step 4: Compute coordinates
  const coords = [];
  for (let i = 0; i < N; i++) {
    coords.push([
      Math.sqrt(Math.max(L[0], 0)) * V[0][i],
      Math.sqrt(Math.max(L[1], 0)) * V[1][i],
      Math.sqrt(Math.max(L[2], 0)) * V[2][i]
    ]);
  }
  return coords;
}

/**
 * Multilateration for N anchors in 3D using nonlinear least squares.
 * Works with any number of anchors >= 4, gracefully handling missing data.
 * @param {Object} coordinate_system - Object containing anchors and origin
 * @param {Object} anchorDistancesObj - Object mapping anchor IDs to distances to the unknown point
 * @returns {[number, number, number]} Estimated [x, y, z] position
 */
export function multilaterate(coordinate_system, anchorDistancesObj) {
  const anchors = coordinate_system.anchors;
  
  // Build arrays, filtering out anchors with missing or invalid distance data
  const anchorPos = [];
  const distances = [];
  const validAnchors = [];
  
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    const d = anchorDistancesObj[anchor.anchor_id] || anchorDistancesObj[anchor.name];
    
    // Check if distance data is valid
    if (typeof d === 'object') {
      anchorPos.push([anchor.ghc_x, anchor.ghc_y, anchor.ghc_z]);
      distances.push(d);
      validAnchors.push(anchor.anchor_id);
    } else {
      console.warn(`Skipping anchor ${anchor.anchor_id} - missing or invalid distance data:`, d);
    }
  }

  // Check if we have enough valid anchors
  if (validAnchors.length < 4) {
    throw new Error(`Insufficient valid anchors for multilateration. Found ${validAnchors.length}, need at least 4. Valid anchors: ${validAnchors.join(', ')}`);
  }

  console.log(`Multilateration using ${validAnchors.length} valid anchors: ${validAnchors.join(', ')}`);

  // Initial guess: centroid of valid anchors
  const centroid = coordinate_system.origin;

  function errorFunc(pos) {
    let sum = 0;
    for (let i = 0; i < anchorPos.length; i++) {
      const dx = pos[0] - anchorPos[i][0];
      const dy = pos[1] - anchorPos[i][1];
      const dz = pos[2] - anchorPos[i][2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      const error = dist - distances[i];
      sum += error * error;
    }
    return sum;
  }

  // Use numeric.js's uncmin for minimization
  const result = numeric.uncmin(errorFunc, centroid);
  
  if (!result || !result.solution) {
    throw new Error('Multilateration optimization failed');
  }
  
  console.log(`Multilateration result: [${result.solution[0].toFixed(2)}, ${result.solution[1].toFixed(2)}, ${result.solution[2].toFixed(2)}]`);
  return result.solution;
}

// Helper to convert anchor objects with dynamic keys to arrays for multilateration
/**
 * Extracts anchor positions and distances from a system object and anchor list.
 * @param {Object} system - The system object with distances to anchors (e.g., {A: 123, B: 456, ...})
 * @param {Array<Object>} anchorList - List of anchor objects with known positions {name, position: [x, y, z]}
 * @returns {{positions: Array<[number, number, number]>, distances: Array<number>}}
 */
export function extractAnchorsAndDistances(system, anchorList) {
  const positions = [];
  const distances = [];

  for (const anchor of anchorList) {
    // Try to get distance by anchor name or id
    let d = system[anchor.anchor_id];
    if (d === undefined && anchor.anchor_id) d = system[anchor.anchor_id];
    if (typeof d !== 'number') continue; // skip if not found or not a number
    positions.push(anchor.position);
    distances.push(d);
  }
  console.log("Extracted positions: ", positions, " and distances: ", distances);
  return { positions, distances };
}

/**
 * Refine the coordinate basis using N anchor positions via PCA.
 * @param {Array<[number, number, number]>} anchors - Array of anchor positions
 * @returns {{origin: number[], basis: number[][]}} - Centroid and orthonormal basis vectors
 */
export function buildBasis(anchors) {
  if (!Array.isArray(anchors) || anchors.length < 3) {
    throw new Error('Need at least 3 anchor positions for basis');
  }
  // Compute centroid
  const N = anchors.length;
  const centroid = anchors.reduce((acc, p) => [acc[0]+p[0], acc[1]+p[1], acc[2]+p[2]], [0,0,0]).map(x => x/N);
  // Center the points
  const centered = anchors.map(p => [p[0]-centroid[0], p[1]-centroid[1], p[2]-centroid[2]]);
  // Build covariance matrix
  const cov = [ [0,0,0], [0,0,0], [0,0,0] ];
  for (const p of centered) {
    for (let i=0; i<3; ++i) for (let j=0; j<3; ++j) cov[i][j] += p[i]*p[j];
  }
  for (let i=0; i<3; ++i) for (let j=0; j<3; ++j) cov[i][j] /= N;
  // Eigen-decomposition (ml-matrix)
  //const { Matrix, EigenvalueDecomposition } = require('ml-matrix');
  const covMat = new Matrix(cov);
  const eig = new EigenvalueDecomposition(covMat);
  // Sort eigenvectors by descending eigenvalue
  const eigenvalues = eig.realEigenvalues;
  const eigenvectors = eig.eigenvectorMatrix.to2DArray();
  const idx = eigenvalues.map((val, i) => [val, i]).sort((a, b) => b[0] - a[0]).map(pair => pair[1]);
  const basis = idx.map(i => eigenvectors.map(row => row[i])); // [ex, ey, ez]
  // Ensure right-handed system
  const cross = [
    basis[0][1]*basis[1][2] - basis[0][2]*basis[1][1],
    basis[0][2]*basis[1][0] - basis[0][0]*basis[1][2],
    basis[0][0]*basis[1][1] - basis[0][1]*basis[1][0]
  ];
  const dot = cross[0]*basis[2][0] + cross[1]*basis[2][1] + cross[2]*basis[2][2];
  if (dot < 0) {
    basis[2] = basis[2].map(x => -x);
  }
  return { origin: centroid, basis };
}




// Trilateration function - only used to get cooridinates of fourth anchor point
// TODO: Generalize to n-lateration for arbitrary anchor points
export function trilateratePoint(name, anchors, distance) {
  const basis = buildBasis(anchors);
  const ex = basis.basis[0];
  const ey = basis.basis[1];
  const ez = basis.basis[2];
  const i = basis.basis[0][0] * (anchors[2][0] - anchors[0][0]) + basis.basis[0][1] * (anchors[2][1] - anchors[0][1]) + basis.basis[0][2] * (anchors[2][2] - anchors[0][2]);
  const j = basis.basis[1][0] * (anchors[2][0] - anchors[0][0]) + basis.basis[1][1] * (anchors[2][1] - anchors[0][1]) + basis.basis[1][2] * (anchors[2][2] - anchors[0][2]);
  const d = numeric.norm2(numeric.sub(anchors[1], anchors[0]));

  // Algorithm for trilateration
  const x = (distance[0] ** 2 - distance[1] ** 2 + d ** 2) / (2 * d);
  // y = ((r1^2 - r3^2 + i^2 + j^2) / (2 * j)) - (i/j) * x
  const y = ((distance[0] ** 2 - distance[2] ** 2 + i ** 2 + j ** 2) / (2 * j)) - (i / j) * x;

  // r1^2 - x^2 - y^2
  var zSquared = distance[0] ** 2 - x ** 2 - y ** 2;

  // Decide what to do with z
  if(zSquared < 0) {
    //pass
    console.log("Invalid trilateration - Using -zSquared\n zSquared = ", zSquared, "\n Distances: [", distance[0], distance[1], distance[2], "]");

    zSquared *= -1;
  }

  const z = Math.sqrt(zSquared);

  // Final coordinates: P = A + x*ex + y*ey + z*ez
  const part1 = numeric.add(anchors[0], numeric.mul(ex, x));
  const part2 = numeric.add(part1, numeric.mul(ey, y));
  const solution1 = numeric.add(part2, numeric.mul(ez, z));
  const solution2 = numeric.sub(part2, numeric.mul(ez, z)); // mirrored solution

  return solution1; //part1 < part2 ? solution1 : solution2;
}
