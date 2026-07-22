import { createRouter, type Screen } from './app/router'

// Drill modules register here as they are built (Tasks 7+).
const screens: Screen[] = []

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('missing #app root element')

createRouter(screens, root).start()
