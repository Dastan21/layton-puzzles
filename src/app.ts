import './components'
import type NDS from './components/nds.js'
import { type NDSSettings } from './components/nds.js'
import type Select from './components/select.js'
import type Tabs from './components/tabs.js'
import Game, { type GameType } from './game.js'
import { collectionToArray, normalize, onClick, onInput } from './utils/dom.js'
import { local } from './utils/storage.js'

declare global {
  interface Window {
    Module: Record<string, any>
    wasmReady: () => void
  }
}

interface Filters {
  name: string
  selects: Record<string, string[]>
  showReset: boolean
}

interface WebSettings extends NDSSettings {
  game: GameType
  solved: string[]
  _filters: Filters
}

const settings: WebSettings = local.store({
  volume: 0.5,
  mute: false,
  game: 'PL1',
  solved: [],
  _filters: {
    name: '',
    selects: {},
    get showReset () {
      return !(this.name.length > 0 || Object.values<string[]>(this.selects).some((s) => s.length > 0))
    }
  }
})

function onReady (): void {
  [...collectionToArray(document.getElementsByClassName('puzzle')), ...collectionToArray(document.getElementsByClassName('minigame'))]?.forEach(($puzzle) => {
    onClick($puzzle.getElementsByClassName('puzzle-play').item(0) as HTMLButtonElement, () => {
      void game?.resolve($puzzle.id).then(() => { foldNds(false) })
      collectionToArray(document.getElementsByClassName('playing')).forEach(($p) => { $p.classList.remove('playing') })
      $puzzle.classList.add('playing')
    })
  })

  game.start()
}

function foldNds (fold: boolean): void {
  if (fold) nds.fold()
  else nds.unfold()
}

function toggleSmallScreen (): void {
  document.body.classList.toggle('small-screen', outerWidth <= 1440)
  foldNds(outerWidth <= 1440)
}

function initNds (): void {
  nds.onsettingschange = (ndsSettings) => {
    settings.volume = ndsSettings.volume
    settings.mute = ndsSettings.mute
  }
  nds.updateSettings(settings)
  const $tabs = document.getElementById('game-tabs') as Tabs
  $tabs.addEventListener('change', () => {
    if (settings.game !== $tabs.key) {
      settings.game = $tabs.key as GameType
      unload()

      const url = new URL(location.href)
      url.search = ''
      url.pathname = $tabs.key
      history.replaceState({}, '', url)

      setTimeout(() => {
        location.reload()
      }, 200)
    }
  })
  setTimeout(() => {
    $tabs.change(settings.game)
  }, 0)

  const $settingsFold = document.getElementById('settings-fold')
  onClick($settingsFold, ($button) => {
    const fold = !nds.classList.contains('fold')
    $button.title = 'Masquer le jeu'
    $button.innerHTML = `<svg class="icon"><use href="/assets/icons-sprite.svg#${fold ? 'show' : 'hide'}"></use></svg>`
    foldNds(fold)
  })
  addEventListener('resize', () => { toggleSmallScreen() })
  toggleSmallScreen()

  nds.addEventListener('solved', ((e: CustomEvent) => {
    const $puzzle = document.getElementById(e.detail)
    if ($puzzle == null) return
    $puzzle.classList.add('solved')
    settings.solved = [...new Set([...settings.solved, e.detail])]
  }) as EventListener)

  settings.solved.forEach((s) => {
    document.getElementById(s)?.classList.add('solved')
  })
}

function initFilters (): void {
  collectionToArray(document.getElementsByClassName('game')).forEach(($game) => {
    const $filterName = $game.getElementsByClassName('puzzle-filter-name').item(0) as HTMLInputElement
    const $filterSelects = collectionToArray($game.getElementsByTagName('pl-select') as HTMLCollection) as Select[]
    const $filterReset = $game.getElementsByClassName('puzzle-filter-reset').item(0) as HTMLButtonElement

    // filter puzzles
    const filter = (): void => {
      const $puzzlesList = $game.getElementsByClassName('game-puzzles').item(0)
      if ($puzzlesList == null) return
      const $puzzles = collectionToArray($puzzlesList.getElementsByClassName('puzzle'))
      let count = 0
      $puzzles.forEach(($p) => {
        const name = normalize($p.getElementsByClassName('puzzle-name').item(0)?.textContent ?? '')
        const filterByName = settings._filters.name.split(' ').every((v) => name?.includes(v))
        const filterBySelects = Object.keys(settings._filters.selects).every((key) => {
          const $info = $p.getElementsByClassName(`puzzle-info-${key}`).item(0)
          const select = normalize($info?.getElementsByClassName('puzzle-info-value').item(0)?.textContent ?? '').replace(/ /g, '-')
          return settings._filters.selects[key].length <= 0 || settings._filters.selects[key].includes(select)
        })
        const show = filterByName && filterBySelects
        if (show) count += 1
        $p.classList.toggle('hidden', !show)
      })
      const $resCount = $game.getElementsByClassName('filter-results').item(0) as HTMLElement
      $resCount.innerText = `${count} résultat${count > 1 ? 's' : ''}`
      $filterReset.disabled = settings._filters.showReset

      // update url
      const url = new URL(location.href)
      url.search = ''
      const name = settings._filters.name
      if (name != null && name !== '') url.searchParams.set('name', name)
      Object.keys(settings._filters.selects).forEach((key) => {
        settings._filters.selects[key].forEach((val) => {
          url.searchParams.append(key, val)
        })
      })
      history.replaceState({}, '', url)
    }

    $filterName.value = settings._filters.name
    $filterName.classList.toggle('filtering', settings._filters.name.length > 0)
    onInput($filterName, ($input) => {
      const name = normalize($input.value ?? '').split(/\s/).filter((s) => s.length > 0).join(' ')
      settings._filters.name = name
      $input.classList.toggle('filtering', name.length > 0)
      filter()
    })

    $filterSelects.forEach(($select, i) => {
      const type = $select.getAttribute('data-type') ?? ''
      $select.toggleSelect(settings._filters.selects[type] ?? [])
      $select.classList.toggle('filtering', $select.value.length > 0)

      $select.style.zIndex = String(10 + $filterSelects.length - i)
      $select.addEventListener('change', () => {
        const type = $select.getAttribute('data-type') ?? ''
        settings._filters.selects[type] = $select.value
        $select.classList.toggle('filtering', $select.value.length > 0)
        filter()
      })
    })

    // reset filters
    onClick($filterReset, () => {
      $filterName.value = ''
      $filterName.dispatchEvent(new Event('input'))
      $filterSelects.forEach(($select) => { $select.reset() })
      settings._filters = {
        name: '',
        selects: {},
        showReset: false
      }
    })

    filter()
  })
}

function load (): void {
  const $loading = document.getElementById('loading') as HTMLElement
  setTimeout(() => {
    $loading.classList.add('invisible')
    setTimeout(() => { $loading.classList.add('hidden') }, 200)
  }, 0)
}

function unload (): void {
  const $loading = document.getElementById('loading') as HTMLElement
  $loading.classList.remove('hidden')
  setTimeout(() => {
    $loading.classList.remove('invisible')
  }, 0)
}

function parseUrl (): void {
  // get url
  const url = new URL(location.href)
  const gameType = url.pathname.replace(/^\//, '')
  if (['PL1', 'PL2', 'PL3', 'PL4'].includes(gameType)) {
    settings.game = gameType as GameType
  }
  settings._filters.name = url.searchParams.get('name') ?? ''
  const selects: Record<string, string[]> = {}
  for (const $select of collectionToArray(document.getElementById(settings.game)?.getElementsByTagName('pl-select') as HTMLCollection)) {
    const type = $select.getAttribute('data-type') ?? ''
    selects[type] = url.searchParams.getAll(type) ?? []
  }
  settings._filters.selects = selects

  // set url
  url.pathname = settings.game
  history.replaceState({}, '', url)
}

// on load
parseUrl()
const game = new Game(settings.game)
document.body.setAttribute('data-game', settings.game)
const nds = document.getElementById('nds') as NDS
document.title = {
  PL1: 'Professeur Layton et l\'Étrange Village',
  PL2: 'Professeur Layton et la Boîte de Pandore',
  PL3: 'Professeur Layton et le Destin perdu',
  PL4: 'Professeur Layton et l\'Appel du Spectre'
}[settings.game]

window.wasmReady = onReady

initNds()
initFilters()
load()
