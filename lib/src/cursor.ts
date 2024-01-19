import { Range } from '@codemirror/state'
import { WidgetType, Decoration } from '@codemirror/view'
import { PeerSelectionRange, PeerUser } from './types'

const cursorsTimeoutIds: { [clientID: string]: number } = {}

export class PeerCursorWidget extends WidgetType {
  private id: string
  private isOptimistic?: boolean
  private user: PeerUser

  constructor(
    peerRange: PeerSelectionRange,
    private tooltipHideDelay: number
  ) {
    super()
    this.id = peerRange.clientID
    this.isOptimistic = peerRange.isOptimistic
    this.user = peerRange.user
  }

  eq(other: PeerCursorWidget) {
    return this.isOptimistic ? false : other.id == this.id
  }

  updateDOM(dom: HTMLElement): boolean {
    const tooltip = dom.querySelector('.cm-peer-user-cursor-info')
    if (tooltip) {
      tooltip.classList.add('show-info')
      this.hideCursorTooltip()
    }
    return !!tooltip
  }

  toDOM() {
    let wrap = document.createElement('span')
    wrap.setAttribute('aria-hidden', 'true')
    wrap.className = 'cm-peer-user-cursor'
    let cLine = document.createElement('div')
    cLine.className = 'cm-peer-user-cursor-line'
    cLine.style.borderColor = this.user.bgColor
    cLine.style.backgroundColor = this.user.bgColor
    let info = document.createElement('div')
    info.dataset.id = this.id
    info.className = 'show-info cm-peer-user-cursor-info'
    info.style.backgroundColor = this.user.bgColor
    info.style.color = this.user.color
    info.textContent = this.user.name
    wrap.append(cLine, info)
    this.hideCursorTooltip()
    return wrap
  }

  hideCursorTooltip() {
    clearTimeout(cursorsTimeoutIds[this.id])
    cursorsTimeoutIds[this.id] = setTimeout(() => {
      document.querySelectorAll(`.show-info.cm-peer-user-cursor-info[data-id=${this.id}]`).forEach((e) => e.classList.remove('show-info'))
    }, this.tooltipHideDelay)
  }
}

export const createCursorDecoration = (peerRange: PeerSelectionRange, tooltipHideDelay: number): Range<Decoration> => {
  const { range } = peerRange
  return Decoration.widget({
    widget: new PeerCursorWidget(peerRange, tooltipHideDelay),
    side: 1,
  }).range(range.from, range.to)
}
