import { describe, it, expect } from 'vitest'
// What ships is whatever `pages_build_output_dir` points at, and nothing
// connects that string to Vite's build output — the same runtime-only coupling
// as the README table and the drill ids. Move Vite's output and the deploy
// uploads an empty or stale directory with the whole suite still green, which
// on this app means a live URL teaching yesterday's entry sectors. No JSONC
// parser (no new dependencies), so the config is read as text the way
// styles.test.ts reads CSS.
import WRANGLER from '../wrangler.jsonc?raw'
import VITE_CONFIG from '../vite.config.ts?raw'

/** Vite builds into `dist` unless `build.outDir` overrides it. */
const VITE_OUT_DIR = 'dist'

/** The `.jsonc` comments are prose, and prose naming a key is not that key
 * being set — scanning them fails on a comment explaining why a key is absent.
 * styles.test.ts strips comments before scanning CSS for the same reason. */
const CONFIG = WRANGLER.replace(/^\s*\/\/.*$/gm, '')

describe('cloudflare deploy config', () => {
  it('uploads the directory Vite builds into', () => {
    expect(CONFIG, 'wrangler.jsonc is actually loaded').toContain('pages_build_output_dir')
    const directory = CONFIG.match(/"pages_build_output_dir"\s*:\s*"([^"]+)"/)?.[1]
    expect(directory, 'pages_build_output_dir in wrangler.jsonc').toBe(`./${VITE_OUT_DIR}`)
  })

  it('has no vite build.outDir redirecting that output', () => {
    // A blank `?raw` import would pass the assertion below without reading a
    // thing — the vacuous pass styles.test.ts guards against for the stylesheet.
    expect(VITE_CONFIG, 'vite.config.ts is actually loaded').toContain('defineConfig')
    // If this fails, Vite's output moved: point wrangler.jsonc at the new
    // directory in the same commit rather than deleting the assertion.
    expect(VITE_CONFIG).not.toMatch(/outDir/)
  })
})
