import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Vitest replaces CSS imports with empty strings by default, which would
    // silently blank the `?raw` read in styles.test.ts. Scoped to the one file
    // that test asserts on. https://vitest.dev/config/#css
    // (no `$` anchor — the module id carries the `?raw` query)
    css: { include: [/styles\.css/] },
  },
})
