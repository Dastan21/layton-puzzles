import { onClick } from '../utils/dom.js'

const style = `
  ::slotted(*) {}
`

export default class Collapse extends HTMLElement {
  public static readonly NAME = 'pl-collapse'

  private $content: HTMLElement | null = null
  private _state: boolean

  constructor () {
    super()

    this._state = false
  }

  connectedCallback (): void {
    const $shadow = this.attachShadow({ mode: 'open' })

    const $buttonSlot = document.createElement('slot')
    $buttonSlot.name = 'button'

    const $contentSlot = document.createElement('slot')
    this.$content = document.createElement('div')
    this.$content.style.display = 'none'
    this.$content.append($contentSlot)

    const $style = document.createElement('style')
    $style.textContent = style

    $shadow.append($buttonSlot, this.$content, $style)

    onClick($buttonSlot, () => {
      this.dispatchEvent(new Event('click'))
      this.toggle()
    })

    this.toggle(this.classList.contains('show'))
  }

  public toggle (force?: boolean): boolean {
    const newState = force ?? !this._state
    this._state = newState
    if (this.$content != null) this.$content.style.display = newState ? 'block' : 'none'
    this.classList.toggle('show', newState)
    return newState
  }
}
