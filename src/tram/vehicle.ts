import { Group, PointLight, Vector3 } from 'three'
import { SlotMesh } from './tramMesh'
import {
  buildDoorSurround,
  buildDoorGeometryTemplates,
  buildEnd,
  buildExteriorTrim,
  buildGlazing,
  buildHull,
  buildLivery,
  buildRoofPod,
  instantiateDoors,
} from './tramBody'
import { buildInterior } from './tramInterior'
import { buildRunningGear } from './tramRunning'
import { tramMaterials } from './tramMaterials'
import { CAR_LENGTH, CAR_WIDTH } from './tramShape'
import type { SlotGeometryTemplate } from './tramMesh'

/**
 * "THE LOOP" — Elysium Planitia Park's two-car automated people mover, and
 * the hero object of the game: the player arrives inside it, rides it, and
 * watches it cross the boulevard all day.
 *
 * Local frame: origin on the CABIN FLOOR at the car's centre, +Z forward,
 * +X left. `tramSystem` places the group at guideway point + 0.62 m and
 * yaws it to the tangent, so the beam top is local y = −0.62 and the guide
 * wheels grip the beam flanks at x = ±0.675.
 *
 * Build order (experience-craft §5.1 — region by region, shell → trim →
 * hardware → lamp):
 *   1  monocoque hull: one welded grid, apertures cut by omission
 *   2  glazing: framed panes whose border band IS the rubber seal
 *   3  door surround: sill trim, upper track, jamb grab rails
 *   4  nose + tail: mask edge, windshield, fascia, lamp clusters, coupler
 *   5  livery: orange waist band, alpha-cut stencils
 *   6  roof: HVAC fairing, grilles, antenna, beacon, lifting eyes
 *   7  exterior trim: cant gutter, skirt rubbing strip
 *   8  running gear: underframe, two bogies, tyres, guide wheels
 *   9  interior: floor, trims, light coves, four benches, stanchions, console
 *  10  doors: two sliding leaves in their own Group (the animation contract)
 */

export interface TramCar {
  group: Group
  /** Platform-side doors. EXACTLY two children; `tramSystem` drives their
   *  local z to ±0.78. Child 0 is the leaf at negative z. */
  doorsLeft: Group
  /** Right-side doors: this vehicle is single-sided, so the group is empty
   *  and animating it is a no-op. Kept so existing callers still compile. */
  doorsRight: Group
  /** Cabin seat surfaces in local space, facing `yaw` (0 = direction of
   *  travel). `seats[0]` is the front-left window seat — the arrival seat. */
  seats: Array<{ position: Vector3; yaw: number }>
  /** Triangles in this car, for the budget report. */
  triangles: number
}

export interface TramGeometryTemplate {
  body: readonly SlotGeometryTemplate[]
  doorLeaves: readonly SlotGeometryTemplate[][]
  seats: ReadonlyArray<{ position: Vector3; yaw: number }>
  triangles: number
}

export { CAR_LENGTH, CAR_WIDTH }

/** Slots whose meshes must not be written into the sun's shadow map. */
const NO_SHADOW_SLOTS = new Set(['glass', 'lampHead', 'lampTail', 'lampWarm', 'screen'])

/**
 * Cabin lamp intensity. `intensity / d²` at the seated head (≈0.9 m below the
 * fixture) lands ≈ 3.7 — bright enough to model the lining and the seat backs
 * against a dusk exterior, well under the 3.15 sun so the interior never
 * out-reads the world through the glass.
 */
const CABIN_LAMP_INTENSITY = 3

let autoIndex = 0

/** Build the immutable body and door buffers once for all cars in a train. */
export function buildTramGeometryTemplate(): TramGeometryTemplate {
  const slots = new SlotMesh()

  buildHull(slots)
  buildGlazing(slots)
  buildDoorSurround(slots)
  buildEnd(slots, 1)
  buildEnd(slots, -1)
  buildLivery(slots)
  buildRoofPod(slots)
  buildExteriorTrim(slots)
  buildRunningGear(slots)
  const cabinSeats = buildInterior(slots)

  return {
    body: slots.buildGeometryTemplate(),
    doorLeaves: buildDoorGeometryTemplates(() => new SlotMesh()),
    seats: orderSeats(cabinSeats),
    // Preserve the existing budget contract: it reports the body mesh and
    // excludes the separately authored animated door leaves.
    triangles: slots.triangles,
  }
}

export function buildTramCar(options?: {
  index?: number
  template?: TramGeometryTemplate
}): TramCar {
  const index = options?.index ?? autoIndex++
  const materials = tramMaterials(index)
  const template = options?.template ?? buildTramGeometryTemplate()

  const group = new Group()
  group.name = `tram-car-${index}`
  const body = SlotMesh.instantiate(template.body, materials)
  // Glazing and lenses do not cast: a transparent pane written into a shadow
  // map darkens the cabin it is supposed to let light into.
  for (const child of body.children) {
    if (NO_SHADOW_SLOTS.has(child.name.replace('tram:', ''))) child.castShadow = false
  }
  group.add(body)

  // Cabin lamps. Emissive coves read as fixtures but light nothing, and the
  // player rides in here for a minute at dusk. Two per car, never toggled,
  // never shadow-casting — the two disciplines in world/lightFixtures.ts.
  // NOTE for the lighting owner: these are OUTSIDE the LightFixtureRig
  // budget because the rig's group is world-space and these must travel with
  // the vehicle. See the tram doc for the requested registration.
  for (const z of [-2.1, 2.1]) {
    const lamp = new PointLight(0xffd9b0, CABIN_LAMP_INTENSITY, 6.5, 2)
    lamp.position.set(0, 1.98, z)
    lamp.castShadow = false
    lamp.name = `tram-cabin-lamp-${index}-${z > 0 ? 'f' : 'r'}`
    group.add(lamp)
  }

  const doorsLeft = instantiateDoors(materials, template.doorLeaves)
  group.add(doorsLeft)
  const doorsRight = new Group()
  doorsRight.name = 'tram-doors-right'
  group.add(doorsRight)

  // Contract: seats[0] is the arrival seat — front bench, LEFT window side,
  // facing travel, with the whole windshield ahead of it.
  const seats = template.seats.map((seat) => ({
    position: seat.position.clone(),
    yaw: seat.yaw,
  }))

  return { group, doorsLeft, doorsRight, seats, triangles: template.triangles }
}

/** Front-facing window seat first, then front aisle, then the rear pair. */
function orderSeats(seats: Array<{ position: Vector3; yaw: number }>): TramCar['seats'] {
  const score = (s: { position: Vector3; yaw: number }): number => {
    const forward = s.yaw === 0 ? 0 : 1000
    const outboard = -Math.abs(s.position.x) * 10
    const leftFirst = s.position.x > 0 ? 0 : 1
    return forward + outboard + leftFirst
  }
  return seats.slice().sort((a, b) => score(a) - score(b))
}
