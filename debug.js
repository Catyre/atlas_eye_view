import * as THREE from 'three';
import { getScene } from './main.js';

// --- Coordinate System Overlay --- //
let axesHelper = null;
let gridHelper = null;
//var scene = null;

// Create a volumetric (3D) grid as a LineSegments object
export function createVolumetricGrid(size = 1000, divisions = 20, color = 0x888888) {
  const step = size / divisions;
  const half = size / 2;
  const vertices = [];
  const colors = [];

  function addLine(x1, y1, z1, x2, y2, z2) {
    vertices.push(x1, y1, z1, x2, y2, z2);
    for (let i = 0; i < 2; i++) {
      colors.push((color >> 16 & 255) / 255, (color >> 8 & 255) / 255, (color & 255) / 255);
    }
  }

  // Lines parallel to X
  for (let y = -half; y <= half; y += step) {
    for (let z = -half; z <= half; z += step) {
      addLine(-half, y, z, half, y, z);
    }
  }
  // Lines parallel to Y
  for (let x = -half; x <= half; x += step) {
    for (let z = -half; z <= half; z += step) {
      addLine(x, -half, z, x, half, z);
    }
  }
  // Lines parallel to Z
  for (let x = -half; x <= half; x += step) {
    for (let y = -half; y <= half; y += step) {
      addLine(x, y, -half, x, y, half);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({ vertexColors: true, opacity: 0.25, transparent: true });
  const grid = new THREE.LineSegments(geometry, material);
  grid.name = 'VolumetricGridHelper';
  return grid;
}
var axesFlag = false;
var gridFlag = false;
export function addCoordinateSystemOverlay(scene, size = 100) {
  console.log(scene)
  if (!axesFlag) {
    axesHelper = new THREE.AxesHelper(size);
    axesHelper.name = 'CoordinateSystemOverlay';
    scene.add(axesHelper);
    axesFlag = true;
  }
  if (!gridFlag) {
    gridHelper = createVolumetricGrid(200, 30, 0x888888);
    scene.add(gridHelper);
    gridFlag = true;
  }
}

export function removeCoordinateSystemOverlay(scene) {
  if (axesFlag) {
    scene.remove(axesHelper);
    axesFlag = false;
  }
  if (gridFlag) {
    scene.remove(gridHelper);
    gridFlag = false;
  }
}

export function toggleCoordinateSystemOverlay(scene) {
  if (axesFlag || gridFlag) {
    removeCoordinateSystemOverlay(scene);
  } else {
    addCoordinateSystemOverlay(scene);
  }
}
