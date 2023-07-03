import type NDS from './components/nds.js'
import { NDSScreen, NDSState } from './components/nds.js'
import { throttle } from './utils/dom.js'

type DotRGB = [number, number, number]
type DotByGame = Record<string, DotRGB>

const WIN_SCREENS: DotByGame = {
  PL1: [222, 181, 140],
  PL2: [222, 165, 74]
}
const LOSE_SCREENS: DotByGame = {
  PL1: [49, 74, 66],
  PL2: [115, 156, 156]
}
const LEAVE_SCREENS: DotByGame = {
  PL1: [16, 74, 82],
  PL2: [57, 49, 24]
}
const MENU_SCREENS: DotByGame = {
  PL1: [123, 90, 41],
  PL2: [206, 189, 140]
}

const LEAVE_RECTS: Record<string, { puzzle: DOMRect, minigame: Record<string, DOMRect> }> = {
  PL1: {
    puzzle: new DOMRect(182, 22, 100, 22),
    minigame: {
      hotel: new DOMRect(103, 170, 50, 30),
      tableau: new DOMRect(195, 0, 70, 28)
    }
  },
  PL2: {
    puzzle: new DOMRect(186, 26, 100, 34),
    minigame: {
      hamster: new DOMRect(200, 155, 60, 45),
      photo: new DOMRect(205, 170, 65, 30)
    }
  }
}

export type GameType = 'PL1' | 'PL2' | 'PL3' | 'PL4'
type PuzzleType = 'puzzle' | 'minigame'

enum PuzzleResult {
  None,
  Win,
  Lose,
  Leave
}

export default class Game {
  private readonly nds: NDS
  private readonly _game: GameType
  private _type: PuzzleType
  private _state: string | null
  private readonly _resolve: (stateId: string) => Promise<void>
  private readonly $games: HTMLElement | null

  constructor (game: GameType) {
    this.nds = document.getElementById('nds') as NDS
    this.$games = document.getElementById('games')
    this._resolve = throttle(async (stateId: string) => {
      await this.nds.loadState(stateId).then(() => {
        this.nds.resume()
        this.nds.unlock()
      })
    }, () => { this.toggleResolve(false) }, 2000)

    this._game = game
    this._type = 'puzzle'
    this._state = null
    this.nds.addEventListener('started', () => { this.toggleResolve(false) })
  }

  public start (): void {
    if (this.nds.state !== NDSState.Off) return

    this.nds.start(this._game).then(() => {
      if (import.meta.env.DEV) return
      this.listenPuzzleResult()
    }).catch((err) => { console.error(err) })
  }

  public async resolve (stateId: string): Promise<void> {
    const $puzzle = document.getElementById(stateId)
    if ($puzzle == null) throw new Error(`State not found: ${stateId}`)
    const type = $puzzle.classList.contains('puzzle') ? 'puzzle' : ($puzzle.classList.contains('minigame') ? 'minigame' : null)
    if (type == null) throw new Error('Invalid puzzle type')
    this.toggleResolve(true)
    this._type = type
    this._state = stateId.split('-')[1]
    await this._resolve(stateId)
  }

  private toggleResolve (value: boolean): void {
    this.$games?.classList.toggle('state', value)
  }

  private getPuzzleResult (): PuzzleResult {
    const dotToCheck = this.nds.getDot(NDSScreen.Bottom, 1, 1)
    if (this.checkDot(dotToCheck, WIN_SCREENS[this._game])) return PuzzleResult.Win
    if (this.checkDot(dotToCheck, LOSE_SCREENS[this._game])) return PuzzleResult.Lose
    if (this.checkDot(dotToCheck, LEAVE_SCREENS[this._game]) || this.checkDot(dotToCheck, MENU_SCREENS[this._game])) return PuzzleResult.Leave
    return PuzzleResult.None
  }

  private checkDot (dotA: Uint8ClampedArray, dotB: DotRGB): boolean {
    return dotB[0] === dotA[0] && dotB[1] === dotA[1] && dotB[2] === dotA[2]
  }

  private get isOnLeaveButton (): boolean {
    if (this._state == null) return false
    let rect: DOMRect | undefined
    if (this._type === 'puzzle') rect = LEAVE_RECTS[this._game][this._type]
    else rect = LEAVE_RECTS[this._game][this._type][this._state]
    return this.nds.isInRect(rect)
  }

  private listenPuzzleResult (): void {
    setInterval(() => {
      if (!this.nds.isPlaying) return
      // check result
      const res = this.getPuzzleResult()
      // check leave button
      if (res === PuzzleResult.None) {
        if (this.isOnLeaveButton) this.nds.lock()
        else this.nds.unlock()
        return
      }
      this.endPuzzleProcess(res)
    }, 1)
  }

  private endPuzzleProcess (res: PuzzleResult): void {
    this.nds.lock()
    if (res === PuzzleResult.Leave) {
      void this.nds.reloadState()
      this.nds.unlock()
    }
  }
}
