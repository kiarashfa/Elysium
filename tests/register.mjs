import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('.') || specifier.startsWith('/')) && !/\.[a-z]+$/i.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context)
      } catch {
        // Let Node report the original resolution failure when the TypeScript
        // sibling does not exist.
      }
    }
    return nextResolve(specifier, context)
  },
})
