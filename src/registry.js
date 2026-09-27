export const GROUPS = ['exterior', 'wheels', 'interior', 'chassis'];

export function createRegistry() {
  const parts = [];
  return {
    parts,
    add(spec) {
      if (!GROUPS.includes(spec.group)) throw new Error(`unknown group: ${spec.group}`);
      if (parts.some((p) => p.name === spec.name)) throw new Error(`duplicate part: ${spec.name}`);
      const o = spec.object3d;
      const part = {
        name: spec.name,
        group: spec.group,
        object3d: o,
        home: { position: [o.position.x, o.position.y, o.position.z], rotation: [o.rotation.x, o.rotation.y, o.rotation.z] },
        explode: { offset: spec.explode.offset, rotate: spec.explode.rotate ?? [0, 0, 0] },
      };
      o.userData.partName = spec.name;
      parts.push(part);
      return part;
    },
    byGroup: (g) => parts.filter((p) => p.group === g),
    get: (name) => parts.find((p) => p.name === name),
    count: () => parts.length,
  };
}
