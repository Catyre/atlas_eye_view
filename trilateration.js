// TODO: Choose least coplanar three anchors for basis
//  Introduce confidence calculations
//  Dyanmic anchors

import * as numeric from 'numeric';
import * as math from 'mathjs';

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

export function buildBasis(P1, P2, P3) {
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

  //const basis = {ex: ex, ey: numeric.mul(-1, ez), ez: ey, i: i, j: j}; // This is not a mistake - the basis vectors need to be rotated
  const basis = {ex: ex, ey: ey, ez: ez, i: i, j: j};
  return basis;
}

// Quadrilateration (trilateration, but more!)
export function trilaterate4(name, P1, P2, P3, P4, r1, r2, r3, r4) {
  const basis = buildBasis(P1, P2, P3);
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
    console.log("Invalid trilateration - Using -zSquared\n zSquared = ", zSquared, "\n Distances: [", r1, r2, r3, r4, "]");
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
export function trilateratePoint(name, P1, P2, P3, r1, r2, r3) {
  const basis = buildBasis(P1, P2, P3);
  const ex = basis.ex;
  const ey = basis.ey;
  const ez = basis.ez;
  const i = basis.i;
  const j = basis.j;
  const d = numeric.norm2(numeric.sub(P2, P1));

  // Algorithm for trilateration
  const x = (r1 ** 2 - r2 ** 2 + d ** 2) / (2 * d);
  // y = ((r1^2 - r3^2 + i^2 + j^2) / (2 * j)) - (i/j) * x
  const y = ((r1 ** 2 - r3 ** 2 + i ** 2 + j ** 2) / (2 * j)) - (i / j) * x;

  // r1^2 - x^2 - y^2
  var zSquared = r1 ** 2 - x ** 2 - y ** 2;

  // Decide what to do with z
  if(zSquared < 0) {
    //pass
    console.log("Invalid trilateration - Using -zSquared\n zSquared = ", zSquared, "\n Distances: [", r1, r2, r3, "]");

    zSquared *= -1;
  }

  const z = Math.sqrt(zSquared);

  // Final coordinates: P = A + x*ex + y*ey + z*ez
  const part1 = numeric.add(P1, numeric.mul(ex, x));
  const part2 = numeric.add(part1, numeric.mul(ey, y));
  const solution1 = numeric.add(part2, numeric.mul(ez, z));
  const solution2 = numeric.sub(part2, numeric.mul(ez, z)); // mirrored solution

  return solution1; //part1 < part2 ? solution1 : solution2;
}
