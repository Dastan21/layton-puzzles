import type NDS from './components/nds.js'
import { NDSScreen, NDSState } from './components/nds.js'
import { throttle } from './utils/dom.js'

type DotRGB = [number, number, number, number?, number?]
interface GameDot {
  puzzle: DotRGB
  minigame: Record<string, DotRGB>
}
type DotByGame = Record<GameType, GameDot>

const WIN_SCREENS: DotByGame = {
  PL1: {
    puzzle: [222, 181, 140],
    minigame: {}
  },
  PL2: {
    puzzle: [222, 165, 74],
    minigame: {
      photo: [107, 123, 0]
    }
  },
  PL3: {
    puzzle: [222, 165, 74],
    minigame: {
      minimobile: [255, 198, 140, 86, 55],
      perroquet: [189, 90, 0, 86, 55],
      livre: [247, 140, 0, 254, 1]
    }
  },
  PL4: {
    puzzle: [222, 165, 74],
    minigame: {
      miniexpress: [255, 198, 140, 66, 61],
      poisson: [247, 206, 173, 85, 61],
      marionnettes: [239, 132, 66, 67, 75]
    }
  }
}
const LOSE_SCREENS: DotByGame = {
  PL1: {
    puzzle: [49, 74, 66],
    minigame: {}
  },
  PL2: {
    puzzle: [115, 156, 156],
    minigame: {}
  },
  PL3: {
    puzzle: [115, 156, 156],
    minigame: {}
  },
  PL4: {
    puzzle: [115, 156, 156],
    minigame: {}
  }
}
const LEAVE_SCREENS: DotByGame = {
  PL1: {
    puzzle: [16, 74, 82],
    minigame: {}
  },
  PL2: {
    puzzle: [57, 49, 24],
    minigame: {}
  },
  PL3: {
    puzzle: [0, 148, 156],
    minigame: {}
  },
  PL4: {
    puzzle: [107, 173, 173],
    minigame: {}
  }
}
const MENU_SCREENS: DotByGame = {
  PL1: {
    puzzle: [123, 90, 41],
    minigame: {}
  },
  PL2: {
    puzzle: [206, 189, 140],
    minigame: {}
  },
  PL3: {
    puzzle: [173, 132, 33],
    minigame: {}
  },
  PL4: {
    puzzle: [165, 132, 74],
    minigame: {}
  }
}

type RectByGame = Record<GameType, { puzzle: DOMRect, minigame: Record<string, DOMRect> }>

const LEAVE_RECTS: RectByGame = {
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
  },
  PL3: {
    puzzle: new DOMRect(195, 30, 65, 30),
    minigame: {
      minimobile: new DOMRect(180, 160, 80, 40),
      perroquet: new DOMRect(200, 165, 60, 35),
      livre: new DOMRect(195, 165, 65, 35)
    }
  },
  PL4: {
    puzzle: new DOMRect(195, 30, 65, 30),
    minigame: {
      miniexpress: new DOMRect(180, 160, 80, 40),
      poisson: new DOMRect(200, 165, 60, 35),
      marionnettes: new DOMRect(190, 165, 80, 35)
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
  public static readonly STATE_LOAD_TIME = 500
  public static readonly RESOLVE_THROTTLE_TIME = 2000

  private readonly nds: NDS
  private readonly _game: GameType
  private _type: PuzzleType
  private _state: string | null
  private _stateId: string | null
  private _res: PuzzleResult
  private readonly _resolve: (stateId: string) => Promise<void>
  private readonly $games: HTMLElement | null

  constructor (game: GameType) {
    this.nds = document.getElementById('nds') as NDS
    this.$games = document.getElementById('games')
    this._resolve = throttle(async (stateId: string) => {
      await this.nds.loadState(stateId).then(() => {
        this.nds.resume()
        this.nds.unlock()
        setTimeout(() => {
          this._res = PuzzleResult.None
        }, Game.STATE_LOAD_TIME)
      })
    }, () => { this.toggleResolve(false) }, Game.RESOLVE_THROTTLE_TIME)

    this._game = game
    this._type = 'puzzle'
    this._state = null
    this._stateId = null
    this._res = PuzzleResult.None
    this.nds.addEventListener('started', () => { this.toggleResolve(false) })
  }

  public start (): void {
    if (this.nds.state !== NDSState.Off) return

    this.nds.start(this._game).then(() => {
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
    this._state = stateId.replace(/PL\d-/, '')
    this._stateId = this._state.split('-')[0]
    await this._resolve(stateId)
  }

  private toggleResolve (value: boolean): void {
    this.$games?.classList.toggle('state', value)
  }

  private getPuzzleResult (): PuzzleResult {
    if (this.checkGameDot(WIN_SCREENS[this._game])) return PuzzleResult.Win
    if (this.checkGameDot(LOSE_SCREENS[this._game])) return PuzzleResult.Lose
    if (this.checkGameDot(LEAVE_SCREENS[this._game]) || this.checkGameDot(MENU_SCREENS[this._game])) return PuzzleResult.Leave
    return PuzzleResult.None
  }

  private checkGameDot (game: GameDot): boolean {
    return this.checkDot(game.puzzle) || Object.values(game.minigame).some(d => this.checkDot(d))
  }

  private checkDot (dotB: DotRGB): boolean {
    const dotA = this.nds.getDot(NDSScreen.Bottom, Math.max(dotB[3] ?? 1, 1), Math.max(dotB[4] ?? 1, 1))
    return dotB[0] === dotA[0] && dotB[1] === dotA[1] && dotB[2] === dotA[2]
  }

  private get isOnLeaveButton (): boolean {
    if (this._stateId == null) return false
    let rect: DOMRect | undefined
    if (this._type === 'puzzle') rect = LEAVE_RECTS[this._game][this._type]
    else rect = LEAVE_RECTS[this._game][this._type][this._stateId]
    return this.nds.isInRect(rect)
  }

  private listenPuzzleResult (): void {
    window.requestAnimationFrame(() => { this.listenPuzzleResult() })
    if (!this.nds.isPlaying || this._res !== PuzzleResult.None) return
    this._res = this.getPuzzleResult()
    if (this._res === PuzzleResult.None) {
      if (this.isOnLeaveButton) this.nds.lock()
      else this.nds.unlock()
      return
    }
    this.endPuzzleProcess()
  }

  private endPuzzleProcess (): void {
    this.nds.lock()
    if (this._res === PuzzleResult.Leave) {
      void this.nds.reloadState()
      this.nds.unlock()
      this._res = PuzzleResult.Leave
      setTimeout(() => {
        this._res = PuzzleResult.None
      }, Game.STATE_LOAD_TIME)
    } else if (this._res === PuzzleResult.Win) {
      this.nds.dispatchEvent(new CustomEvent('solved', { detail: `${this._game}-${this._state ?? ''}` }))
    }
  }
}
