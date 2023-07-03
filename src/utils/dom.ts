export function createDOM (el: string): HTMLElement {
  const $root = document.createElement('div')
  $root.innerHTML = el
  if (!/<.+>((.*)<\/.+>)*/gs.test(el)) return $root
  return $root.firstElementChild as HTMLElement
}

export function attachDOM (el: HTMLElement | string | null, $dom: HTMLElement, selector?: string, prepend = false): void {
  if (el == null) return
  if (typeof selector === 'boolean') {
    prepend = selector
    selector = undefined
  }
  if (typeof el === 'string') el = createDOM(el)
  if (selector != null) {
    const $sel = querySelector($dom, selector)
    if ($sel != null) $dom = $sel
  }
  if (el == null) {
    console.warn('DOM element not found')
    return
  }
  if (!prepend) $dom?.append(el)
  else el.prepend(el)
}

export function collectionToArray ($col: HTMLCollection): HTMLElement[] {
  if ($col == null || ($col.length != null && $col.length < 1)) return []
  return Array.from($col) as HTMLElement[]
}

export function querySelector ($dom: HTMLElement, selector: string): HTMLElement | null {
  const $ret = $dom.querySelector<HTMLElement>(selector)
  if ($ret != null) return $ret
  if ($dom.matches?.(selector) || $dom.matches?.(selector)) return $dom
  return null
}

export function onClick<T extends HTMLElement> ($input: T | null, onclick: ($input: T, e: Event) => unknown, once = false): void {
  if ($input == null) return
  $input.addEventListener('click', (e) => onclick($input, e), { once })
}

export function onInput<T extends HTMLElement> ($input: T | null, oninput: ($input: T, e: Event) => unknown, once = false): void {
  if ($input == null) return
  $input.addEventListener('input', (e) => oninput($input, e), { once })
}

export function onPress<T extends HTMLElement> ($input: T | null, onpress: ($input: T, e: Event) => unknown, onrelease: ($input: T, e: Event) => unknown, once = false): void {
  if ($input == null) return
  $input.addEventListener('mousedown', (e) => onpress($input, e), { once })
  $input.addEventListener('mouseup', (e) => onrelease($input, e), { once })
}

export function normalize (str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/-|_|'|"|\./gm, ' ')
}

export function throttle<F extends (...args: any[]) => any> (fn: F, delay?: number): () => any
export function throttle<F extends (...args: any[]) => any, R extends (...args: any[]) => any> (fn: F, reset: R, delay?: number): () => any
export function throttle<F extends (...args: any[]) => any, R extends (...args: any[]) => any> (fn: F, reset: R | number, delay = 500): () => any {
  if (typeof reset === 'number') delay = reset
  let shouldWait = false
  return (...args) => {
    if (shouldWait) return
    fn(...args)
    shouldWait = true
    setTimeout(() => {
      shouldWait = false
      if (typeof reset === 'function') reset()
    }, delay)
  }
}
