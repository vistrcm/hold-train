import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Node >= 24 defines its own `localStorage` on globalThis, unavailable
    // without --localstorage-file. Vitest only lets jsdom overwrite a global
    // that already exists if the key is on its own hardcoded list, and
    // `localStorage` is not on it — so jsdom's never installs and the store
    // silently degrades to its in-memory fallback (store.ts `defaultStorage`).
    // Turning Web Storage off restores the intended jsdom environment on any
    // Node version, rather than teaching the tests to expect a broken one.
    execArgv: ['--no-experimental-webstorage'],
    // Vitest replaces CSS imports with empty strings by default, which would
    // silently blank the `?raw` read in styles.test.ts. Scoped to the one file
    // that test asserts on. https://vitest.dev/config/#css
    // (no `$` anchor — the module id carries the `?raw` query)
    css: { include: [/styles\.css/] },
  },
})
