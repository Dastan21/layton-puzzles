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
    debug: Record<string, any>
  }
  interface Document {
    startViewTransition: any
  }
}

interface WebSettings extends NDSSettings {
  game: GameType
}

const settings: WebSettings = local.store({
  volume: 0.5,
  mute: false,
  game: 'PL1'
})

function onReady (): void {
  window.debug = {}

  if (import.meta.env.DEV) {
    window.debug.loadState = (stateId: string) => { void nds.loadState(stateId) }
    window.debug.saveState = (state = 'save') => { nds.saveState(state) }
    window.debug.takeScreenshot = (screen: 0 | 1 = 1, name?: string) => { nds.takeScreenshot(screen, name) }
    window.debug.saveAndScreen = (puzzle: string) => {
      window.debug.saveState(`${settings.game}-${puzzle}`)
      window.debug.takeScreenshot(1, puzzle)
      location.reload()
    }
  }

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
    const key = $tabs.key
    if (settings.game !== key) {
      settings.game = key as GameType
      unload()
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
}

interface Filters {
  name: string[]
  selects: Record<string, string[]>
  showReset: boolean
}

function initFilters (): void {
  collectionToArray(document.getElementsByClassName('game ')).forEach(($game) => {
    const $filterName = $game.getElementsByClassName('puzzle-filter-name').item(0) as HTMLInputElement
    const $filterSelects = collectionToArray($game.getElementsByTagName('pl-select') as HTMLCollection) as Select[]
    const $filterReset = $game.getElementsByClassName('puzzle-filter-reset').item(0) as HTMLButtonElement

    const filters: Filters = {
      name: [],
      selects: {},
      get showReset () {
        return !(this.name.length > 0 || Object.values(this.selects).some((s) => s.length > 0))
      }
    }

    // filter puzzles
    const filter = (): void => {
      const $puzzlesList = $game.getElementsByClassName('game-puzzles').item(0)
      if ($puzzlesList == null) return
      const $puzzles = collectionToArray($puzzlesList.getElementsByClassName('puzzle'))
      let count = 0
      $puzzles.forEach(($p) => {
        const name = normalize($p.getElementsByClassName('puzzle-name').item(0)?.textContent ?? '')
        const filterByName = filters.name.every((v) => name?.includes(v))
        const filterBySelects = Object.keys(filters.selects).every((key) => {
          const $info = $p.getElementsByClassName(`puzzle-info-${key}`).item(0)
          const select = normalize($info?.getElementsByClassName('puzzle-info-value').item(0)?.textContent ?? '').replace(/ /g, '-')
          return filters.selects[key].length <= 0 || filters.selects[key].includes(select)
        })
        const show = filterByName && filterBySelects
        if (show) count += 1
        $p.classList.toggle('hidden', !show)
      })
      const $resCount = $game.getElementsByClassName('filter-results').item(0) as HTMLElement
      $resCount.innerText = `${count} résultat${count > 1 ? 's' : ''}`
      $filterReset.disabled = filters.showReset
    }

    onInput($filterName, ($input) => {
      const values = normalize($input.value ?? '').split(/\s/).filter((s) => s.length > 0)
      $input.classList.toggle('filtering', values.join('').length > 0)
      filters.name = values
      filter()
    })

    $filterSelects.forEach(($select, i) => {
      $select.style.zIndex = String(10 + $filterSelects.length - i)
      $select.addEventListener('change', () => {
        $select.classList.toggle('filtering', $select.value.length > 0)
        filters.selects[$select.getAttribute('data-type') ?? ''] = $select.value
        filter()
      })
    })

    // reset filters
    onClick($filterReset, () => {
      $filterName.value = ''
      $filterName.dispatchEvent(new Event('input'))
      $filterSelects.forEach(($select) => { $select.reset() })
    })
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

// on load
const game = new Game(settings.game)
const nds = document.getElementById('nds') as NDS

window.wasmReady = onReady

initNds()
initFilters()
load()
