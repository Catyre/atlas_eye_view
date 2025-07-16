// TODO: Choose least coplanar three anchors for basis
//  Introduce confidence calculations
//  Dyanmic anchors

import * as numeric from 'numeric';
import * as math from 'mathjs';

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

// Choose the 4 least coplanar anchor points from available anchors
export function chooseLeastCoplanarAnchors(anchors) {
  const numAnchors = anchors.length;

  const anchor_ids = anchors.map(a => (a.anchor_id !== "false") ? a.anchor_id : a.name);
  
  if (numAnchors < 4) {
    throw new Error(`Need at least 4 anchor points, but only ${numAnchors} are available`);
  }
  
  let bestVolume = 0;
  let bestAnchors = [anchors[0], anchors[1], anchors[2], anchors[3]]; // Default selection
  let bestPositions = [];
  
  // Try all combinations of 4 anchor points
  for (let i = 0; i < numAnchors - 3; i++) {
    for (let j = i + 1; j < numAnchors - 2; j++) {
      for (let k = j + 1; k < numAnchors - 1; k++) {
        for (let l = k + 1; l < numAnchors; l++) {
          // Get the distances between the first 3 anchors
          const dAB = anchors[i][anchor_ids[j]] || anchors[j][anchor_ids[i]];
          const dAC = anchors[i][anchor_ids[k]] || anchors[k][anchor_ids[i]];
          const dBC = anchors[j][anchor_ids[k]] || anchors[k][anchor_ids[j]];
          
          // Reconstruct the first 3 anchor positions
          const primaryAnchors = reconstructAnchorsFromDistances(dAB, dAC, dBC);
          
          // Get distances from 4th anchor to the first 3
          const d4A = anchors[l][anchor_ids[i]] || anchors[i][anchor_ids[l]];
          const d4B = anchors[l][anchor_ids[j]] || anchors[j][anchor_ids[l]];
          const d4C = anchors[l][anchor_ids[k]] || anchors[k][anchor_ids[l]];
          
          // Calculate position of 4th anchor
          const P4 = trilateratePoint(anchors[l].name, [primaryAnchors.A, primaryAnchors.B, primaryAnchors.C], [d4A, d4B, d4C]);
          
          // Create position vectors for volume calculation
          const P1 = primaryAnchors.A;
          const P2 = primaryAnchors.B;
          const P3 = primaryAnchors.C;
          
          const volume = calculateTetrahedronVolume(P1, P2, P3, P4);
          
          // Check if this combination has better volume (less coplanar)
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

// Need to build coordinate system from anchor points
//  TODO: Be dynamic
export function reconstructAnchorsFromDistances(dAB, dAC, dBC) {
  // A at (0,0,0), B at (dAB, 0, 0)
  const A = [0, 0, 0];
  const B = [dAB, 0, 0];

  const xC = (dAC ** 2 + dAB ** 2 - dBC ** 2) / (2 * dAB);
  const ySquared = dAC ** 2 - xC ** 2;
  if (ySquared < 0) throw new Error("Invalid triangle — cannot place C.");

  const yC = Math.sqrt(ySquared);
  const C = [xC, yC, 0]; // we pick the +y option arbitrarily

  return { A, B, C };
}
/*
// Enhanced quadrilateration with dynamic anchor selection
export function trilaterate4Dynamic(name, anchors, targetDistances) {
  // Choose the 4 least coplanar anchor points
  const selection = chooseLeastCoplanarAnchors(anchors);
  const anchor_ids = anchors.map(a => (a.anchor_id !== "false") ? a.anchor_id : a.name);
  
  // Get the distances between the selected anchors
  const dAB = selection.anchors[0][anchor_ids[1]] || selection.anchors[1][anchor_ids[0]];
  const dAC = selection.anchors[0][anchor_ids[2]] || selection.anchors[2][anchor_ids[0]];
  const dBC = selection.anchors[1][anchor_ids[2]] || selection.anchors[2][anchor_ids[1]];
  
  // Reconstruct the first 3 anchor positions
  const primaryAnchors = reconstructAnchorsFromDistances(dAB, dAC, dBC);
  
  // Get distances from 4th anchor to the first 3
  const d4A = selection.anchors[3][anchor_ids[0]] || selection.anchors[0][anchor_ids[3]];
  const d4B = selection.anchors[3][anchor_ids[1]] || selection.anchors[1][anchor_ids[3]];
  const d4C = selection.anchors[3][anchor_ids[2]] || selection.anchors[2][anchor_ids[3]];
  
  // Calculate position of 4th anchor
  const P4 = trilateratePoint(selection.anchors[3].name, [primaryAnchors.A, primaryAnchors.B, primaryAnchors.C], [d4A, d4B, d4C]);
  
  // Create the anchor positions array
  const anchorPositions = [primaryAnchors.A, primaryAnchors.B, primaryAnchors.C, P4];
  
  // Use the original trilaterate4 function with the selected anchors
  return trilaterate4(name, anchorPositions, targetDistances);
}
*/

function buildBasis(anchors) {
  const P1 = anchors[0];
  const P2 = anchors[1];
  const P3 = anchors[2];

  console.log("Building basis for ", P1, P2, P3);
  // Unit vector of side BA
  const ex = numeric.div(numeric.sub(P2, P1), numeric.norm2(numeric.sub(P2, P1)));
  // Projection of AC onto BA (its x-component)
  const i = numeric.dot(ex, numeric.sub(P3, P1));
  const aux = numeric.sub(P3, numeric.add(P1, numeric.mul(ex, i)));
  // Unit vector for y-axis
  const ey = numeric.div(aux, numeric.norm2(aux));
  // Projection of AC onto y axis (the y component)
  const j = numeric.dot(ey, numeric.sub(P3, P1));

  // z axis will just be cross product of x and y unit vectors
  const ez = math.cross(ex, ey);

  const OGbasis = [ex, ey, ez];
  const basis = OGbasis.map(vec => rotate3D(vec, 'y', 180));

  // Ensure right-handed system
  if (numeric.dot(math.cross(basis[0], basis[1]), basis[2]) < 0) {
    basis[2] = numeric.mul(-1, basis[2]);
  }

  //console.warn(basis, ex, ey, ez)
  return {ex: basis[0], ey: basis[1], ez: basis[2], i: i, j: j};
}


// Quadrilateration (trilateration, but more!)
// Assumes trilaterate4Dyanmic has already selected the best 4 anchors
export function trilaterate4(name, anchors, distances) {
  const [P1, P2, P3, P4] = anchors;
  const [r1, r2, r3, r4] = distances;

  console.log("Trilaterating ", name, " with distances ", r1, r2, r3, r4);
  
  const basis = buildBasis([P1, P2, P3]);
  const ex = basis.ex;
  const ey = basis.ey;
  const ez = basis.ez;
  const i = basis.i;
  const j = basis.j;

  const d = numeric.norm2(numeric.sub(P2, P1));
  const x = (r1**2 - r2**2 + d**2) / (2 * d);
  const y = ((r1**2 - r3**2 + i**2 + j**2) / (2 * j)) - ((i / j) * x);

  var zSquared = r1**2 - x**2 - y**2;
  if (zSquared < 0) {
    console.log("Invalid trilateration for ", name, "- Using -zSquared\n zSquared = ", zSquared, "\n Distances: [", r1, r2, r3, r4, "]");
    zSquared *= -1;
    //throw new Error("Trilateration failed: No real solution (z² < 0)");
  }

  const z = Math.sqrt(zSquared);

  // Position relative to P1
  const result1 = numeric.add(P1, numeric.add(numeric.mul(ex, x), numeric.add(numeric.mul(ey, y), numeric.mul(ez, z))));
  const result2 = numeric.add(P1, numeric.add(numeric.mul(ex, x), numeric.add(numeric.mul(ey, y), numeric.mul(ez, -z)))); // mirrored solution

  // Use P4 to disambiguate which of the two points is closer
  const dist1 = Math.abs(Math.sqrt(numeric.dot(numeric.sub(P4, result1), numeric.sub(P4, result1))) - r4);
  const dist2 = Math.abs(Math.sqrt(numeric.dot(numeric.sub(P4, result2), numeric.sub(P4, result2))) - r4);

  return dist1 < dist2 ? result1 : result2;
}


// Trilateration function - only used to get cooridinates of fourth anchor point
// TODO: Generalize to n-lateration for arbitrary anchor points
export function trilateratePoint(name, anchors, distance) {
  const basis = buildBasis(anchors);
  const ex = basis.ex;
  const ey = basis.ey;
  const ez = basis.ez;
  const i = basis.i;
  const j = basis.j;
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
