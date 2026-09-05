import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from 'three'
import type { Material } from 'three'
import { buildMaterials } from './optimusMaterials'
import type { OptimusPayload } from './optimusBuild'

/**
 * Main-thread side of the Optimus asset: worker payload -> BufferGeometry per
 * LOD, plus the material array each geometry's draw ranges index into.
 *
 * One geometry per LOD with `groups`, not one geometry per material: three
 * renders a grouped geometry against a material ARRAY, so a whole figure —
 * every slot, every LOD — is a single object with a single instance matrix
 * buffer. That is what lets eight figures cost eight instances rather than
 * eight scene graphs.
 */
export interface OptimusAsset {
  /** `[0]` exact, then progressively coarser. */
  lods: Array<{ geometry: BufferGeometry; triangles: number }>
  materials: Material[]
  buildMs: number
}

export function prepareOptimusPayload(): Promise<OptimusPayload> {
  return runBuild()
}

export async function loadOptimusAsset(
  payloadPromise: Promise<OptimusPayload> = prepareOptimusPayload(),
): Promise<OptimusAsset> {
  const payload = await payloadPromise
  const mats = buildMaterials()

  // Material NAMES come from the payload; the array's order is the draw
  // ranges' `materialIndex`, so a missing slot would silently shift every
  // later group onto the wrong material.
  const materials: Material[] = payload.lods[0].mats.map((name) => {
    const material = mats[name]
    if (!material) throw new Error(`Optimus: no material named "${name}"`)
    return material
  })

  const lods = payload.lods.map((lod) => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(lod.position, 3))
    geometry.setAttribute('normal', new BufferAttribute(lod.normal, 3))
    geometry.setIndex(new BufferAttribute(lod.index, 1))
    for (const group of lod.groups) geometry.addGroup(group.start, group.count, group.materialIndex)
    // Authored rather than computed: the figure is a known 1.73 m standing on
    // its own origin, and computeBoundingSphere on 450 k verts is pure cost.
    geometry.boundingSphere = new Sphere(new Vector3(0, 0.87, 0), 1.05)
    return { geometry, triangles: lod.index.length / 3 }
  })

  return { lods, materials, buildMs: payload.buildMs }
}

/**
 * Off-thread when the browser gives us a module worker, inline when it does
 * not. The fallback is a ~3 s block behind the entry screen rather than a
 * failure to load — an exhibit that silently goes missing is worse.
 */
function runBuild(): Promise<OptimusPayload> {
  return new Promise<OptimusPayload>((resolve, reject) => {
    let worker: Worker
    let settled = false
    const complete = (payload: OptimusPayload): void => {
      if (settled) return
      settled = true
      resolve(payload)
    }
    const fail = (error: unknown): void => {
      if (settled) return
      settled = true
      reject(error)
    }
    const buildInline = (): void => {
      if (settled) return
      void import('./optimusBuild')
        .then(({ buildOptimusPayload }) => buildOptimusPayload())
        .then(complete, fail)
    }

    try {
      worker = new Worker(new URL('./optimusWorker.ts', import.meta.url), { type: 'module' })
    } catch {
      buildInline()
      return
    }
    worker.onmessage = (event: MessageEvent<OptimusPayload>): void => {
      worker.terminate()
      complete(event.data)
    }
    worker.onerror = (): void => {
      worker.terminate()
      buildInline()
    }
    worker.postMessage('build')
  })
}
