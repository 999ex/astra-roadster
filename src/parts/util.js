import * as THREE from 'three';

export function loftToGeometry({ positions, indices }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.computeVertexNormals();
  return g;
}
