import { collectionToArray, onClick } from '../utils/dom.js'

const style = `
  ::slotted(*) {
    width: 100%;
  }
`

export default class Tabs extends HTMLElement {
  public static readonly NAME = 'pl-tabs'

  private readonly navs: Map<string, HTMLElement>
  private readonly contents: Map<string, HTMLElement>
  private _key: string
  private _noAction: boolean

  constructor () {
    super()

    this.navs = new Map()
    this.contents = new Map()
    this._key = ''
    this._noAction = false
  }

  connectedCallback (): void {
    const $shadow = this.attachShadow({ mode: 'open' })

    const $navList = document.createElement('div')
    const $navSlot = document.createElement('slot')
    $navSlot.name = 'nav'
    $navList.append($navSlot)

    const $contentSlot = document.createElement('slot')
    $contentSlot.name = 'content'

    const $style = document.createElement('style')
    $style.textContent = style

    $shadow.append($navList, $contentSlot, $style)

    // init nav
    const $navs = collectionToArray(($navSlot.assignedElements()[0] as HTMLElement).children)
    $navs.forEach(($nav) => {
      const key = $nav.getAttribute('for') ?? ''
      this.navs.set(key, $nav)
      onClick($nav, () => { this.change(key, this._noAction) })
    })
    const $contents = collectionToArray(($contentSlot.assignedElements()[0] as HTMLElement).children)
    $contents.forEach(($content) => {
      this.contents.set($content.id, $content)
    })

    this._noAction = this.hasAttribute('data-no-action')
  }

  public change (key: string, silent = false): void {
    this._key = key
    this.dispatchEvent(new Event('change'))
    if (silent) return
    this.navs.forEach(($nav) => {
      const navKey = $nav.getAttribute('for') ?? ''
      $nav.classList.toggle('active', this._key === navKey)
      const $content = this.contents.get(navKey)
      $content?.classList.toggle('active', this._key === $content.id)
    })
  }

  public get key (): string {
    return this._key
  }
}
