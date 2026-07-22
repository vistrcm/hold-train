import { createRouter, type Screen } from './app/router'
import { entryDrillScreen } from './modules/entry-drill'

// Drill modules register here as they are built (Tasks 7+).
const screens: Screen[] = [entryDrillScreen]

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('missing #app root element')

createRouter(screens, root).start()
