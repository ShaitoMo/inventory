declare module 'winbox/src/js/winbox.js' {
  export interface WinBoxParams {
    id?: string
    index?: number
    root?: Node
    title?: string
    icon?: string
    mount?: Node
    html?: string
    url?: string
    x?: 'right' | 'center' | string | number
    y?: 'bottom' | 'center' | string | number
    width?: string | number
    height?: string | number
    minwidth?: string | number
    minheight?: string | number
    maxwidth?: string | number
    maxheight?: string | number
    left?: string | number
    right?: string | number
    top?: string | number
    bottom?: string | number
    min?: boolean
    max?: boolean
    hidden?: boolean
    modal?: boolean
    background?: string
    border?: string | number
    class?: string | string[]
    oncreate?: (this: WinBox, params?: WinBoxParams) => void
    onclose?: (this: WinBox, force?: boolean) => boolean | void
    onfocus?: (this: WinBox) => void
    onblur?: (this: WinBox) => void
    onmove?: (this: WinBox, x: number, y: number) => void
    onresize?: (this: WinBox, width: number, height: number) => void
    onfullscreen?: (this: WinBox) => void
    onminimize?: (this: WinBox) => void
    onmaximize?: (this: WinBox) => void
    onrestore?: (this: WinBox) => void
    onhide?: (this: WinBox) => void
    onshow?: (this: WinBox) => void
  }

  export default class WinBox {
    constructor(title: string, params?: WinBoxParams)
    constructor(params: WinBoxParams)

    id: string | number
    x: number
    y: number
    width: number
    height: number
    min: boolean
    max: boolean
    full: boolean
    hidden: boolean
    focused: boolean
    body: HTMLElement

    mount(src?: Element): this
    unmount(dest?: Element): this
    setTitle(title: string): this
    setIcon(url: string): this
    setBackground(background: string): this
    setUrl(url: string, onload?: () => void): this
    focus(state?: boolean): this
    blur(state?: boolean): this
    hide(state?: boolean): this
    show(state?: boolean): this
    minimize(state?: boolean): this
    restore(): this
    maximize(state?: boolean): this
    fullscreen(state?: boolean): this
    close(force?: boolean): boolean | undefined
    move(x?: string | number, y?: string | number, skipUpdate?: boolean): this
    resize(w?: string | number, h?: string | number, skipUpdate?: boolean): this
    addClass(classname: string): this
    removeClass(classname: string): this
    hasClass(classname: string): boolean
    toggleClass(classname: string): this
  }
}
