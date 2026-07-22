export interface Screen {
  /** hash path without the '#/' prefix; '' is reserved for home */
  path: string
  title: string
  render(el: HTMLElement): void
}

export interface Router {
  resolve(hash: string): Screen
  renderCurrent(): void
  start(): void
}

function homeScreen(screens: Screen[]): Screen {
  return {
    path: '',
    title: 'Hold Train',
    render(el) {
      const items = screens
        .map((s) => `<li><a class="module-link" href="#/${s.path}">${s.title}</a></li>`)
        .join('')
      el.innerHTML = `
        <h1>Hold Train</h1>
        <p>Holding pattern trainer for the instrument rating.</p>
        <ul class="module-list">${items}</ul>
      `
    },
  }
}

export function createRouter(screens: Screen[], root: HTMLElement): Router {
  const home = homeScreen(screens)

  function resolve(hash: string): Screen {
    const path = hash.replace(/^#\/?/, '')
    return screens.find((s) => s.path === path) ?? home
  }

  function renderCurrent(): void {
    root.innerHTML = ''
    resolve(window.location.hash).render(root)
  }

  return {
    resolve,
    renderCurrent,
    start() {
      window.addEventListener('hashchange', renderCurrent)
      renderCurrent()
    },
  }
}
