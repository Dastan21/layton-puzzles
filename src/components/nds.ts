import { type GameType } from '../game.js'
import { download, fetchFile } from '../utils/api.js'
import { onClick, onInput, onPress } from '../utils/dom.js'

type Context2D = [
  CanvasRenderingContext2D | null,
  CanvasRenderingContext2D | null
]

interface Canvas {
  canvas: HTMLCanvasElement | null
  gl: WebGLRenderingContext | null
  outResolutionUniformLocation: WebGLUniformLocation | null
}

type ScreenData = [
  ImageData | null,
  ImageData | null
]

interface AudioData {
  audioFifoL: Int16Array
  audioFifoR: Int16Array
  audioBuffer: Int16Array
  audioContext: AudioContext | null
}

interface TouchData {
  pressed: boolean
  x: number
  y: number
  locked: boolean
}

const style = `
  :host {
    position: relative;
    display: flex;
    flex-direction: column;
    background-color: var(--beige);
  }

  canvas {
    height: calc((100vh - 40px) / 2);
    width: calc(((100vh - 40px) / 2) * 4 / 3);
    max-height: calc(100vw * 3 / 4);
    max-width: 100vw;
    aspect-ratio: auto 256 / 192;
  }

  button, input {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: var(--brown);
    border: none;
    background: none;
    box-sizing: border-box;
    cursor: pointer;
  }

  button:active {
    transform: translateY(1px);
  }

  .settings {
    display: flex;
    justify-content: space-between;
    gap: 32px;
    padding: 4px 8px;
    color: var(--brown);
  }

  .settings .icon {
    width: 32px;
    height: 32px;
  }

  .settings .settings-volume {
    display: flex;
    gap: 8px;
  }

  #settings-volume {
    --value: 50%;

    appearance: none;
    width: 96px;
  }

  #settings-volume::-webkit-slider-runnable-track {
    height: 10px;
    border-radius: 6px;
    background: linear-gradient(to right, var(--brown) 0%, var(--brown) var(--value), var(--beige) var(--value), var(--beige) 100%);
    border: 3px solid var(--brown);
  }

  #settings-volume::-webkit-slider-thumb {
    appearance: none;
    height: 10px;
    width: 10px;
    transform: scale(2);
    margin-top: -3px;
    border-radius: 18px;
    background-color: var(--beige);
    border: 2px solid var(--brown);
    cursor: pointer;
  }

  #settings-volume:active::-webkit-slider-thumb {
    transform: scale(2.25);
  }

  .overlay {
    position: absolute;
    width: 100%;
    height: calc(100% - 40px);
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none;
  }

  .overlay .background {
    position: absolute;
    width: 100%;
    height: 100%;
  }

  .overlay.pause .background {
    background-color: black;
    opacity: .8;
  }

  .overlay .content {
    font-size: 32px;
    font-weight: bold;
    color: var(--beige);
    z-index: 1;
  }

  @keyframes rotate{
    to { transform: rotate(360deg); }
  }

  .overlay .content > svg {
    width: 64px;
    height: 64px;
    color: var(--brown);
    animation: rotate 6s linear infinite;
  }

  .hidden, .fold {
    display: none;
  }
`

export interface NDSSettings {
  volume: number
  mute: boolean
}

export enum NDSState {
  Off,
  Starting,
  Started,
}

export enum NDSScreen {
  Top,
  Bottom
}

export default class NDS extends HTMLElement {
  private static readonly NDS_SPEED_NORMAL = 33
  private static readonly NDS_SPEED_FAST = 1
  private static readonly START_DELAYS = {
    PL1: 2000,
    PL2: 2000,
    PL3: 5000,
    PL4: 5000
  }

  public static readonly NAME = 'nintendo-ds'

  // draw
  private readonly ctx2d: Context2D
  private readonly screenCanvas: [Canvas, Canvas]
  private readonly screenData: ScreenData

  // audio
  private readonly audioData: AudioData
  private readonly audioFifoCap = 8192
  private audioFifoHead = 0
  private audioFifoLen = 0
  private readonly baseVolume = 0.2

  // emu
  private _interval: ReturnType<typeof setTimeout> | null = null
  private readonly _touchData: TouchData
  private _savestate: string | null = null
  private _state: NDSState
  private _pause: boolean
  private _microphone: boolean

  private $overlay: HTMLElement | null = null

  // settings
  private _settings: NDSSettings
  private $settings: {
    volume: HTMLInputElement
    mute: HTMLButtonElement
    microphone: HTMLButtonElement
  } | null = null

  private _onsettingschange: (settings: NDSSettings) => any = () => {}

  constructor () {
    super()

    this.ctx2d = [null, null]
    this.screenCanvas = [
      {
        canvas: null,
        gl: null,
        outResolutionUniformLocation: null
      },
      {
        canvas: null,
        gl: null,
        outResolutionUniformLocation: null
      }
    ]
    this.screenData = [null, null]
    this.audioData = {
      audioFifoL: new Int16Array(this.audioFifoCap),
      audioFifoR: new Int16Array(this.audioFifoCap),
      audioBuffer: new Int16Array(),
      audioContext: null
    }
    this._touchData = {
      pressed: false,
      x: 0,
      y: 0,
      locked: true
    }

    this._settings = {
      volume: 0.5,
      mute: false
    }
    this._state = NDSState.Off
    this._pause = true
    this._microphone = false

    addEventListener('focus', () => { this.resume() })
    addEventListener('blur', () => { this.pause() })
  }

  connectedCallback (): void {
    const $shadow = this.attachShadow({ mode: 'open' })

    const $canvasTop = document.createElement('canvas')
    $canvasTop.id = 'top-screen'
    $canvasTop.width = 256
    $canvasTop.height = 192
    this.screenCanvas[0].canvas = $canvasTop

    const $canvasBottom = document.createElement('canvas')
    $canvasBottom.id = 'bottom-screen'
    $canvasBottom.width = 256
    $canvasBottom.height = 192
    this.screenCanvas[1].canvas = $canvasBottom

    this.$overlay = document.createElement('div')
    this.$overlay.classList.add('overlay')
    const $overlayContent = document.createElement('div')
    $overlayContent.classList.add('content')
    $overlayContent.innerHTML = '<svg><use href="/assets/icons-sprite.svg#gear"></use></svg>'
    const $overlayBackground = document.createElement('div')
    $overlayBackground.classList.add('background')
    this.$overlay.append($overlayContent, $overlayBackground)

    const $settingsContainer = document.createElement('div')
    $settingsContainer.classList.add('settings')
    const $settingsVolume = document.createElement('div')
    $settingsVolume.classList.add('settings-volume')
    const $settingsSlot = document.createElement('slot')
    $settingsSlot.name = 'settings'
    $settingsContainer.append($settingsVolume, $settingsSlot)

    const $settingsVolumeInput = document.createElement('input')
    $settingsVolumeInput.id = 'settings-volume'
    $settingsVolumeInput.title = 'Volume'
    $settingsVolumeInput.type = 'range'
    $settingsVolumeInput.min = '0'
    $settingsVolumeInput.max = '1'
    $settingsVolumeInput.step = '0.01'

    const $settingsMuteButton = document.createElement('button')
    $settingsMuteButton.id = 'settings-mute'
    $settingsMuteButton.title = 'Mode silencieux'
    $settingsMuteButton.innerHTML = '<svg class="icon"><use href="/assets/icons-sprite.svg#volume-high"></use></svg>'

    const $settingsMicrophoneButton = document.createElement('button')
    $settingsMicrophoneButton.id = 'settings-microphone'
    $settingsMicrophoneButton.title = 'Microphone'
    $settingsMicrophoneButton.innerHTML = '<svg class="icon"><use href="/assets/icons-sprite.svg#microphone"></use></svg>'

    $settingsVolume.append($settingsMuteButton, $settingsVolumeInput, $settingsMicrophoneButton)
    this.$settings = {
      volume: $settingsVolumeInput,
      mute: $settingsMuteButton,
      microphone: $settingsMicrophoneButton
    }

    const $style = document.createElement('style')
    $style.textContent = style

    $shadow.append($canvasTop, $canvasBottom, $settingsContainer, this.$overlay, $style)

    onInput(this.$settings.volume, ($input) => {
      this._settings.volume = Number($input.value)
      this.refreshSettings()
    })
    onClick(this.$settings.mute, ($button) => {
      this._settings.mute = $button.getAttribute('value') !== 'true'
      $button.setAttribute('value', String(this._settings.mute))
      this.refreshSettings()
    })
    onPress(this.$settings.microphone, () => {
      this._microphone = true
      this.refreshSettings()
    }, () => {
      this._microphone = false
      this.refreshSettings()
    })

    this.fold()

    this.screenCanvas[1].canvas.addEventListener('mousedown', (e) => { this.mouseHandle(e) })
    this.screenCanvas[1].canvas.addEventListener('mouseup', (e) => { this.mouseHandle(e) })
    this.screenCanvas[1].canvas.addEventListener('mousemove', (e) => { this.mouseHandle(e) })
    this.screenCanvas[1].canvas.addEventListener('touchstart', (e) => { this.touchHandle(e) })
    this.screenCanvas[1].canvas.addEventListener('touchend', (e) => { this.touchHandle(e) })
    this.screenCanvas[1].canvas.addEventListener('touchmove', (e) => { this.touchHandle(e) })
  }

  disconnectedCallback (): void {
    if (this._interval == null) return
    clearInterval(this._interval)
  }

  private async loadRom (romName: string): Promise<void> {
    this.$overlay?.classList.remove('hidden')

    const buffer = await fetchFile(`/roms/${romName}.nds`)
    if (buffer == null) return
    if (buffer.byteLength < 1024) return

    try {
      const romSize = buffer.byteLength
      const romBufPtr: number = window.Module._prepareRomBuffer(romSize)
      const blockSize = 4 * 1024 * 1024
      for (let pos = 0; pos < romSize; pos += blockSize) {
        const chunk = buffer.slice(pos, pos + blockSize)
        window.Module.HEAPU8.set(new Uint8Array(chunk), romBufPtr + pos)
      }
      if (import.meta.env.DEV) {
        const saveData = await fetchFile(`/saves/${romName}.dsv`).then((buf) => buf == null ? null : new Uint8Array(buf))
        if (saveData != null) window.Module.HEAPU8.set(saveData, window.Module._savGetPointer(saveData.length))
      }
      window.Module._savUpdateChangeFlag()
      window.Module._emuSetLang(2)
      const ret = window.Module._loadROM()
      if (ret < 0) throw new Error('Failed to load ROM')
      const fb: number = window.Module._getFrameBuffer(4)
      this.screenData[0] = new ImageData(new Uint8ClampedArray(window.Module.HEAPU8.buffer).subarray(fb, fb + 256 * 192 * 4), 256, 192)
      this.screenData[1] = new ImageData(new Uint8ClampedArray(window.Module.HEAPU8.buffer).subarray(fb + 256 * 192 * 4, fb + 256 * 192 * 4 * 2), 256, 192)
      const ptrAudio = window.Module._getAudioBuffer(6)
      this.audioData.audioBuffer = new Int16Array(window.Module.HEAPU8.buffer).subarray(ptrAudio / 2, ptrAudio / 2 + 16384 * 2)
      this.playAudio()
    } catch (err) {
      throw new Error(`Could not load ROM: ${String((err as Error).message)}`)
    } finally {
      this.$overlay?.classList.add('hidden')
      const $overlayContent = this.$overlay?.getElementsByClassName('content').item(0)
      if ($overlayContent != null) $overlayContent.textContent = 'Pause'
    }
  }

  public async start (game: GameType): Promise<void> {
    if (this._interval != null) return
    this._state = NDSState.Starting

    await this.loadRom(game)

    if (this.screenCanvas[0].canvas == null || this.screenCanvas[1].canvas == null) throw new Error('NDS element not found')

    this.ctx2d[0] = this.screenCanvas[0].canvas.getContext('2d', { alpha: false })
    this.ctx2d[1] = this.screenCanvas[1].canvas.getContext('2d', { alpha: false })

    const gameSpeed = import.meta.env.DEV ? NDS.NDS_SPEED_FAST : NDS.NDS_SPEED_NORMAL
    this._interval = setInterval(() => {
      this.runFrame()
    }, gameSpeed)

    setTimeout(() => {
      this._state = NDSState.Started
      this.dispatchEvent(new Event('started'))
    }, NDS.delayByGame(game))
  }

  public stop (): void {
    if (this._state === NDSState.Off) return
    if (this._interval != null) clearInterval(this._interval)
    this._interval = null
    const arr = new Uint8ClampedArray(196608)
    for (let i = 0; i < 49152; i++) arr.set([249, 235, 211, 255], i * 4)
    this.ctx2d[0]?.putImageData(new ImageData(arr, 256, 192), 0, 0)
    this.ctx2d[1]?.putImageData(new ImageData(arr, 256, 192), 0, 0)
    this.ctx2d[0] = null
    this.ctx2d[1] = null
    this.screenCanvas[0].canvas = null
    this.screenCanvas[1].canvas = null
    this._state = NDSState.Off
  }

  // DEBUG
  public saveState (savestate: string): void {
    if (window.Module._stateSave() === 0) return
    const ptr: number = window.Module._stateGetPointer()
    const len: number = window.Module._stateGetSize()
    const arrBuf: Uint8Array = window.Module.HEAPU8.slice(ptr, ptr + len)
    download(arrBuf, `${savestate}.state`)
  }

  public async loadState (savestate: string): Promise<void> {
    if (this._state === NDSState.Off) return

    this._savestate = savestate
    this.resume()
    this.playAudio()
    await fetchFile(`/states/${savestate.split('-')[0]}/${savestate}.state`).then((buf) => {
      if (buf == null) return
      const arrBuf = new Uint8Array(buf)
      const ptr: number = window.Module._stateGetPointer(arrBuf.length)
      window.Module.HEAPU8.set(arrBuf, ptr)
      window.Module._stateLoad()
    }).catch(() => {})
  }

  public async reloadState (): Promise<void> {
    if (this._savestate == null) return
    await this.loadState(this._savestate)
  }

  public takeScreenshot (screen: 0 | 1 = 1, name?: string): void {
    const url = this.screenCanvas[screen].canvas?.toDataURL('image/jpeg')
    if (url == null) return
    const filename = (name ?? `screen${screen}`).replace(/\.[^.]+$/, '') + '.jpg'
    download(url, filename)
  }

  private runFrame (): void {
    if (!this.isPlaying) return

    this.runAudio()

    const rect = window.debug.rect ?? [0, 0, 0, 0]

    const isTouching = Number(this.canTouch && this._touchData.pressed && !this.isInRect(new DOMRect(...rect)))
    const micEnabled = Number(this._microphone)
    window.Module._runFrame(0, isTouching, this._touchData.x, this._touchData.y, micEnabled)
    window.Module._runFrame(1, isTouching, this._touchData.x, this._touchData.y, micEnabled)

    if (this.ctx2d[0] == null || this.ctx2d[1] == null || this.screenData[0] == null || this.screenData[1] == null) return
    this.ctx2d[0].putImageData(this.screenData[0], 0, 0)
    this.ctx2d[1].putImageData(this.screenData[1], 0, 0)
    this.ctx2d[1].fillStyle = '#ff000055'
    this.ctx2d[1].fillRect(rect[0], rect[1], rect[2], rect[3])
  }

  public isInRect (r: DOMRect): boolean {
    return NDS.isPointInRect(this._touchData.x, this._touchData.y, r)
  }

  public static isPointInRect (x: number, y: number, r: DOMRect): boolean {
    return ((x >= r.x) && (x < r.x + r.width)) && ((y >= r.y) && (y < r.y + r.height))
  }

  private mouseHandle (e: MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()

    const r = (this.screenCanvas[1]).canvas?.getBoundingClientRect()
    if (r == null) return

    this._touchData.pressed = (e.buttons !== 0) && (NDS.isPointInRect(e.clientX, e.clientY, r))
    this._touchData.x = (e.clientX - r.x) / r.width * 256
    this._touchData.y = (e.clientY - r.y) / r.height * 192
  }

  private touchHandle (e: TouchEvent): void {
    e.preventDefault()
    e.stopPropagation()

    const r = (this.screenCanvas[1]).canvas?.getBoundingClientRect()
    if (r == null) return

    const touch = e.touches.item(0)
    this._touchData.pressed = touch != null && (NDS.isPointInRect(touch.clientX, touch.clientY, r))

    this._touchData.x = touch != null ? ((touch.clientX - r.x) / r.width * 256) : 0
    this._touchData.y = touch != null ? ((touch.clientY - r.y) / r.height * 192) : 0
  }

  private playAudio (): void {
    try {
      if (this.audioData.audioContext != null) {
        if (this.audioData.audioContext.state !== 'running') void this.audioData.audioContext.resume()
        return
      }

      this.audioData.audioContext = new AudioContext({ latencyHint: 0.0001, sampleRate: 48000 })
      const scriptNode = this.audioData.audioContext.createScriptProcessor(2048, 0, 2)
      scriptNode.onaudioprocess = (e) => { this.onScriptNodeAudioProcess(e) }
      scriptNode.connect(this.audioData.audioContext.destination)
      void this.audioData.audioContext.resume()
    } catch (e) {
      console.error(e)
    }
  }

  private runAudio (): void {
    const samplesRead = window.Module._fillAudioBuffer(4096)
    for (let i = 0; i < samplesRead; i++) {
      if (this.audioFifoLen >= this.audioFifoCap) break
      const wpos = (this.audioFifoHead + this.audioFifoLen) % this.audioFifoCap
      this.audioData.audioFifoL[wpos] = this.audioData.audioBuffer[i * 2]
      this.audioData.audioFifoR[wpos] = this.audioData.audioBuffer[i * 2 + 1]
      this.audioFifoLen++
    }
  }

  private onScriptNodeAudioProcess (e: AudioProcessingEvent): void {
    if (this._settings.mute || this._settings.volume <= 0) return

    const chanL = e.outputBuffer.getChannelData(0)
    const chanR = e.outputBuffer.getChannelData(1)
    for (let i = 0; i < chanL.length; i++) {
      if (this.audioFifoLen <= 0) return
      this.audioFifoLen--
      chanL[i] = this.audioData.audioFifoL[this.audioFifoHead] / 32768.0 * (this.baseVolume * this._settings.volume)
      chanR[i] = this.audioData.audioFifoR[this.audioFifoHead] / 32768.0 * (this.baseVolume * this._settings.volume)
      this.audioFifoHead = (this.audioFifoHead + 1) % this.audioFifoCap
    }
  }

  private refreshSettings (): void {
    this.$settings?.volume.style.setProperty('--value', `${this._settings.volume * 100}%`)
    const $ndsMute = this.$settings?.mute.firstElementChild
    if ($ndsMute != null) {
      const volumeType = this._settings.mute ? 'mute' : (this._settings.volume >= 0.5 ? 'high' : (this._settings.volume <= 0 ? 'mute' : 'low'))
      $ndsMute.innerHTML = `<use href="/assets/icons-sprite.svg#volume-${volumeType}">`
    }
    this._onsettingschange(structuredClone(this._settings))
  }

  public getDot (screen: NDSScreen, x: number, y: number): Uint8ClampedArray {
    const fb: number = window.Module._getFrameBuffer(4)
    const offset = fb + ((256 * 192 * screen) + (x % 256) + ((y % 192) * 256)) * 4
    return new Uint8ClampedArray(window.Module.HEAPU8.buffer).subarray(offset, offset + 4)
  }

  public pause (): void {
    if (import.meta.env.DEV) return
    this._pause = true
    this.$overlay?.classList.remove('hidden')
    this.$overlay?.classList.add('pause')
  }

  public resume (): void {
    if (this._savestate == null) return
    this._pause = false
    this.$overlay?.classList.add('hidden')
    this.$overlay?.classList.remove('pause')
  }

  public lock (): void {
    this._touchData.locked = true
  }

  public unlock (): void {
    this._touchData.locked = false
  }

  public fold (): void {
    this.classList.add('fold')
    this.screenCanvas[0].canvas?.classList.add('fold')
    this.screenCanvas[1].canvas?.classList.add('fold')
    this.$overlay?.classList.add('fold')
  }

  public unfold (): void {
    this.classList.remove('fold')
    this.screenCanvas[0].canvas?.classList.remove('fold')
    this.screenCanvas[1].canvas?.classList.remove('fold')
    this.$overlay?.classList.remove('fold')
  }

  public static delayByGame (game: GameType): number {
    return NDS.START_DELAYS[game]
  }

  public updateSettings (settings: Partial<NDSSettings>): void {
    this._settings = {
      volume: settings.volume ?? this._settings.volume,
      mute: settings.mute ?? this._settings.mute
    }
    this.$settings?.volume.setAttribute('value', String(this._settings.volume))
    this.$settings?.mute.setAttribute('value', String(this._settings.mute))
    this.refreshSettings()
  }

  public get onsettingschange (): (settings: NDSSettings) => any {
    return this._onsettingschange
  }

  public set onsettingschange (callback: (settings: NDSSettings) => any) {
    this._onsettingschange = callback
  }

  public get isPlaying (): boolean {
    return !this._pause || import.meta.env.DEV
  }

  public get canTouch (): boolean {
    return !this._touchData.locked || import.meta.env.DEV
  }

  public get state (): NDSState {
    return this._state
  }
}
