import assert from 'node:assert/strict'
import test from 'node:test'
import { PerspectiveCamera, Scene } from 'three'
import { vec4 } from 'three/tsl'
import { TransparentCompositeNode } from '../src/render/transparentComposite.ts'

function fakeRenderer() {
  let size = { width: 1, height: 1 }
  let renderTarget = null
  let mrt = null
  let renderObjectFunction = null
  const clearColor = { set: () => clearColor }
  return {
    calls: 0,
    opaque: false,
    transparent: false,
    toneMapping: 0,
    toneMappingExposure: 1,
    outputColorSpace: 'srgb',
    autoClear: true,
    getRenderTarget: () => renderTarget,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    getRenderObjectFunction: () => renderObjectFunction,
    getPixelRatio: () => 1,
    getMRT: () => mrt,
    getClearColor: () => clearColor,
    getClearAlpha: () => 1,
    getScissorTest: () => false,
    setRenderTarget: (value) => { renderTarget = value },
    setMRT: (value) => { mrt = value },
    setRenderObjectFunction: (value) => { renderObjectFunction = value },
    setPixelRatio: () => undefined,
    setClearColor: () => undefined,
    setScissorTest: () => undefined,
    getDrawingBufferSize: (out) => out.set(size.width, size.height),
    compileAsync: async function compileAsync() { this.calls += 1 },
    setSize(width, height) { size = { width, height } },
  }
}

test('transparent composite compiles helper quads once and scene context on every pose', async () => {
  const renderer = fakeRenderer()
  const composite = new TransparentCompositeNode(
    vec4(0),
    new Scene(),
    new PerspectiveCamera(),
    vec4(0),
    1,
  )

  await composite.compileAsync(renderer)
  assert.equal(renderer.calls, 3)
  await composite.compileAsync(renderer)
  assert.equal(renderer.calls, 4)

  renderer.setSize(2, 2)
  composite.syncSize(renderer)
  await composite.compileAsync(renderer)
  assert.equal(renderer.calls, 7)
})
