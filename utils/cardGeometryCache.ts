// ============================================================
// cardGeometryCache — carica game_card.glb una sola volta e
// restituisce cloni della geometria con UV planar già applicati.
// Tutti gli istanze di CartaGLB condividono questo cache.
// ============================================================

// Bounds estratti dall'analisi del GLB
const XMIN = -0.6479, XMAX = 0.6497
const YMIN = -1.0033, YMAX = 1.0021

let _promise: Promise<unknown> | null = null

export async function getCardGeometry(): Promise<unknown> {
  if (!_promise) {
    _promise = (async () => {
      const THREE      = await import('three')
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
      const gltf = await new GLTFLoader().loadAsync('/bustine/game_card.glb')
      const src  = (gltf.scene.children[0] as any).geometry as typeof THREE.BufferGeometry.prototype

      // Planar UV — front face (normalZ > 0) U=left→right, back face U specchiata
      const pos     = src.attributes.position
      const normals = src.attributes.normal
      const uvs     = new Float32Array(pos.count * 2)
      for (let i = 0; i < pos.count; i++) {
        const x  = pos.getX(i)
        const y  = pos.getY(i)
        const nz = normals.getZ(i)
        let   u  = (x - XMIN) / (XMAX - XMIN)
        // V con leggero offset per replicare object-position:center 15%
        const v  = (y - YMIN) / (YMAX - YMIN) * 0.88 + 0.08
        if (nz < 0) u = 1 - u
        uvs[i * 2]     = u
        uvs[i * 2 + 1] = v
      }
      src.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      return src
    })()
  }
  const geo = (await _promise) as any
  return geo.clone()
}
