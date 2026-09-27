import * as THREE from 'three';

export function createMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    paint: new THREE.MeshPhysicalMaterial({ color: 0x9e0f14, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide }),
    trim: std({ color: 0x121214, metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x223038, roughness: 0.05, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    tire: std({ color: 0x151515, roughness: 0.85, metalness: 0 }),
    rim: std({ color: 0x3a3a3e, metalness: 0.9, roughness: 0.3 }),
    copper: std({ color: 0xb87333, metalness: 1, roughness: 0.32 }),
    aluminum: std({ color: 0xc8ccd2, metalness: 1, roughness: 0.28 }),
    steel: std({ color: 0x8a8f96, metalness: 0.9, roughness: 0.42 }),
    brass: std({ color: 0xc9a45c, metalness: 1, roughness: 0.3 }),
    seat: std({ color: 0xe8dcc6, roughness: 0.7, metalness: 0 }),
    interior: std({ color: 0x1c1b1d, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide }),
    screen: std({ color: 0x0a0f14, emissive: 0x2a6f9a, emissiveIntensity: 0.6, roughness: 0.2 }),
    headlight: std({ color: 0xdfe9f5, emissive: 0xcfe6ff, emissiveIntensity: 0, roughness: 0.15 }),
    taillight: std({ color: 0x5a0508, emissive: 0xff2a20, emissiveIntensity: 0, roughness: 0.2 }),
    battery: std({ color: 0x2b4a6e, metalness: 0.5, roughness: 0.4 }),
  };
}
