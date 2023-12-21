import { Range } from '@codemirror/state'
import { EditorView, WidgetType, Decoration } from '@codemirror/view'
import { PeerSelectionRange } from '.'

export class PeerCursorWidget extends WidgetType {
  constructor(
    private id: string,
    private name: string,
    private color: string,
    private bgColor: string
  ) {
    super()
  }

  eq(other: PeerCursorWidget) {
    return other.id == this.id
  }

  toDOM() {
    let wrap = document.createElement('span')
    wrap.setAttribute('aria-hidden', 'true')
    wrap.className = 'cm-peer-user-cursor'
    let cLine = document.createElement('div')
    cLine.className = 'blink cm-peer-user-cursor-line'
    cLine.style.borderColor = this.bgColor
    cLine.style.backgroundColor = this.bgColor
    let info = document.createElement('div')
    info.className = 'show-info cm-peer-user-cursor-info'
    info.style.backgroundColor = this.bgColor
    info.style.color = this.color
    info.textContent = this.name
    wrap.append(cLine, info)
    return wrap
  }

  static hideCursorsTooltip(view: EditorView) {
    view.contentDOM.querySelectorAll('.cm-peer-user-cursor-info').forEach((e) => e.classList.remove('show-info'))
  }
}

export const createCursorDecoration = (peerRange: PeerSelectionRange): Range<Decoration> => {
  const { clientID, user, range } = peerRange
  return Decoration.widget({
    widget: new PeerCursorWidget(clientID, user.name, user.color, user.bgColor),
    side: 1,
  }).range(range.from, range.to)
}
