import { createRouter, type Screen } from './app/router'
import { entryDrillScreen } from './modules/entry-drill'
import { oralPrepScreen } from './modules/oral-prep'
import { writtenTestScreen } from './modules/written-test'

// Drill modules register here as they are built (Tasks 7+).
const screens: Screen[] = [entryDrillScreen, writtenTestScreen, oralPrepScreen]

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('missing #app root element')

createRouter(screens, root).start()
