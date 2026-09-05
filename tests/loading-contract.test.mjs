import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

async function source(path) {
  return readFile(new URL(path, root), 'utf8')
}

test('asset payload builders are started before renderer initialization and installed through their systems', async () => {
  const main = await source('src/main.ts')
  const optimusSystem = await source('src/robots/optimusExhibit.ts')
  const starshipSystem = await source('src/starship/starshipSystem.ts')

  const prepareStart = main.indexOf('const starshipPayloadPromise = prepareStarshipPayload()')
  const rendererInit = main.indexOf('renderer = await createRenderer')
  assert.ok(prepareStart >= 0)
  assert.ok(prepareStart < rendererInit)
  assert.match(main, /new StarshipSystem\(starshipPayloadPromise\)/)
  assert.match(main, /new OptimusExhibitSystem\(optimusPayloadPromise\)/)
  assert.match(starshipSystem, /loadStarshipAsset\(this\.payloadPromise\)/)
  assert.match(optimusSystem, /loadOptimusAsset\(this\.payloadPromise\)/)
})

test('successful asset paths keep procedural builders out of the main model modules', async () => {
  const optimus = await source('src/robots/optimus/optimusModel.ts')
  const starship = await source('src/starship/starshipModel.ts')
  const rig = await source('src/starship/starshipRig.ts')

  assert.doesNotMatch(optimus, /^import \{ buildOptimusPayload \} from/m)
  assert.doesNotMatch(starship, /^import \{ buildStarshipPayload \} from/m)
  assert.doesNotMatch(rig, /^import \{[^}]+\} from '\.\/starshipBuild'/m)
  assert.match(optimus, /import\('\.\/optimusBuild'\)/)
  assert.match(starship, /import\('\.\/starshipBuild'\)/)
})
