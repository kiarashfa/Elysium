import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const terrain = await import('../src/world/interiorHeight.ts')

const samples = [
  [-120, -90],
  [-24, 18],
  [0, 0],
  [37, 54],
  [88, -42],
  [131, 7],
]

test('optimized terrain samplers remain deterministic and finite across the boot field', () => {
  const expected = [
    [0.02097816331202082, 0.02097816331202082, 0.02097816331202082, 0],
    [0.4903489059183961, 0.4903489059183961, 0.4903489059183961, 0],
    [0.55, 0.55, 0.625, 0],
    [0.55, 0.55, 0.625, 0],
    [0.36526308565246424, 0.26341979926255976, 0.44026308565246425, 0],
    [0.11270576064212168, 0.11270576064212168, 0.11270576064212168, 0],
  ]
  for (const [x, z] of samples) {
    const values = [
      terrain.groundGrade(x, z),
      terrain.regolithSurface(x, z),
      terrain.interiorHeight(x, z),
      terrain.throatLift(x, z),
    ]
    for (const value of values) assert.ok(Number.isFinite(value), `${x},${z}: ${value}`)
    const index = samples.findIndex(([sampleX, sampleZ]) => sampleX === x && sampleZ === z)
    for (let i = 0; i < values.length; i++) {
      assert.ok(Math.abs(values[i] - expected[index][i]) < 1e-12, `${x},${z} changed at ${i}`)
    }
  }
})

test('terrain optimization keeps the shared-sample and hoisted-tail contracts', async () => {
  const source = await readFile(new URL('../src/world/interiorHeight.ts', import.meta.url), 'utf8')
  assert.match(source, /const pavedDistance = pavedSignedDistance\(x, z\)/)
  assert.match(source, /groundGradeWithPavedDistance\(x, z, pavedDistance\)/)
  assert.match(source, /const SPUR_TAIL = ARRIVAL_SPINE\.slice\(SPUR_TAIL_FROM\)/)
  assert.doesNotMatch(source, /const tail = ARRIVAL_SPINE\.slice\(SPUR_TAIL_FROM\)/)
})

test('regolith and walkable surfaces preserve their datum ordering', () => {
  for (const [x, z] of samples) {
    const grade = terrain.groundGrade(x, z)
    const regolith = terrain.regolithSurface(x, z)
    const walkable = terrain.interiorHeight(x, z)
    assert.ok(regolith <= grade + 1e-9, `${x},${z}: regolith lifted above grade`)
    assert.ok(Number.isFinite(walkable))
  }
})

test('arrival spur lookup rejects distant samples and returns a finite datum near the tail', () => {
  assert.equal(terrain.spurTrackDatum(-1000, -1000), null)
  const datum = terrain.spurTrackDatum(0, 120)
  assert.ok(datum)
  assert.ok(Number.isFinite(datum.d))
  assert.ok(Number.isFinite(datum.y))
})
