import { normalize, onClick } from '../utils/dom.js'

const style = `
  :host {
    position: relative;
    width: fit-content;
    cursor: pointer;
  }

  :host > ul {
    position: absolute;
    left: 0;
    display: flex;
    flex-direction: column;
    border: 2px solid var(--brown);
    border-radius: 4px;
    background-color: white;
    padding: 0;
    list-style: none;
    white-space: nowrap;
    text-align: start;
    user-select: none;
  }

  ::slotted(:not([slot="button"])) {
    display: flex;
    flex-direction: row;
    gap: 4px;
    padding: 2px 8px;
  }

  ::slotted(:not([slot="button"]):nth-child(odd)) {
    background-color: #0000000c;
  }
  
  ::slotted(:not([slot="button"]):hover) {
    background-color: var(--beige);
  }
`

export default class Select extends HTMLElement {
  public static readonly NAME = 'pl-select'

  private list: HTMLElement | null = null
  private readonly $options: Map<string, HTMLElement>
  private readonly $selected: Set<string>
  private _state: boolean

  constructor () {
    super()

    this.$options = new Map()
    this.$selected = new Set()
    this._state = false

    addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (!this.isEqualNode(target.closest('pl-select'))) this.toggle(false)
    })
  }

  connectedCallback (): void {
    const $shadow = this.attachShadow({ mode: 'open' })

    const $buttonSlot = document.createElement('slot')
    $buttonSlot.name = 'button'

    const $listSlot = document.createElement('slot')
    this.list = document.createElement('ul')
    this.list.style.display = 'none'
    this.list.append($listSlot)

    const $style = document.createElement('style')
    $style.textContent = style

    $shadow.append($buttonSlot, this.list, $style)

    onClick($buttonSlot, () => {
      this.dispatchEvent(new Event('click'))
      this.toggle()
    })

    // init options
    const $options = $listSlot.assignedNodes().filter(($o) => $o instanceof HTMLElement) as HTMLElement[]
    $options.forEach(($option) => {
      const key = normalize($option.textContent ?? '').replace(/ /g, '-')
      this.$options.set(key, $option)
      $option.setAttribute('key', key)
      $option.addEventListener('mouseup', (e) => {
        if (e.button !== 0) return
        this.toggleSelect($option.getAttribute('key') ?? '')
      })
    })
  }

  public toggleSelect (key: string, force?: boolean): void {
    const val = force ?? !this.$selected.has(key)
    if (val) this.select(key)
    else this.unselect(key)

    if (this.list != null) this.$options.get(key)?.classList.toggle('active', val)
    this.dispatchEvent(new Event('change'))
  }

  public select (key: string): void {
    this.$selected.add(key)
  }

  public unselect (key: string): void {
    this.$selected.delete(key)
  }

  public toggle (force?: boolean): boolean {
    const newState = force ?? !this._state
    this._state = newState
    if (this.list != null) {
      this.list.style.display = newState ? 'block' : 'none'
      const rect = this.list.getBoundingClientRect()
      if (rect.x + rect.width > outerWidth) {
        this.list.style.left = 'auto'
        this.list.style.right = '0'
      } else {
        this.list.style.left = '0'
        this.list.style.right = 'auto'
      }
    }
    return newState
  }

  public open (): void {
    this.toggle(true)
  }

  public close (): void {
    this.toggle(false)
  }

  public reset (): void {
    this.$selected.clear()
    this.$options.forEach(($o) => { $o.classList.remove('active') })
    this.dispatchEvent(new Event('change'))
  }

  public get value (): string[] {
    return [...this.$selected]
  }
}
