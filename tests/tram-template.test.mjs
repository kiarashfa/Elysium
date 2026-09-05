import assert from 'node:assert/strict'
import test from 'node:test'
import { MeshBasicMaterial } from 'three'
import { SlotMesh } from '../src/tram/tramMesh.ts'
import { buildTramGeometryTemplate } from '../src/tram/vehicle.ts'

test('tram geometry template shares immutable body and door buffers', () => {
  const template = buildTramGeometryTemplate()
  const materials = Object.fromEntries(
    [...new Set([
      ...template.body.map((entry) => entry.slot),
      ...template.doorLeaves.flat().map((entry) => entry.slot),
    ])].map((slot) => [slot, new MeshBasicMaterial()]),
  )

  const bodyA = SlotMesh.instantiate(template.body, materials)
  const bodyB = SlotMesh.instantiate(template.body, materials)
  assert.notEqual(bodyA, bodyB)
  assert.equal(bodyA.children.length, bodyB.children.length)
  for (let i = 0; i < bodyA.children.length; i++) {
    assert.equal(bodyA.children[i].geometry, bodyB.children[i].geometry)
    assert.equal(bodyA.children[i].material, bodyB.children[i].material)
  }

  const doorsA = template.doorLeaves.map((leaf) => SlotMesh.instantiate(leaf, materials))
  const doorsB = template.doorLeaves.map((leaf) => SlotMesh.instantiate(leaf, materials))
  for (let i = 0; i < doorsA.length; i++) {
    assert.equal(doorsA[i].children[0].geometry, doorsB[i].children[0].geometry)
  }
  assert.equal(template.body.reduce((sum, entry) => sum + entry.triangles, 0), template.triangles)
  assert.equal(template.doorLeaves.length, 2)
})
