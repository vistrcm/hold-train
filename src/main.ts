import { ankiExportScreen } from './app/anki-export'
import { createRouter, type Screen } from './app/router'
import { clearanceCopyScreen } from './modules/clearance-copy'
import { entryDrillScreen } from './modules/entry-drill'
import { learnScreen } from './modules/learn'
import { oralPrepScreen } from './modules/oral-prep'
import { windLabScreen } from './modules/wind-lab'
import { writtenTestScreen } from './modules/written-test'

// Drill modules register here as they are built (Tasks 7+).
const screens: Screen[] = [
  learnScreen,
  entryDrillScreen,
  writtenTestScreen,
  oralPrepScreen,
  windLabScreen,
  clearanceCopyScreen,
  ankiExportScreen,
]

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('missing #app root element')

createRouter(screens, root).start()
