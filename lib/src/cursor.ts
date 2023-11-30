import { Range } from '@codemirror/state'
import { EditorView, WidgetType, Decoration } from '@codemirror/view'

export class PeerCursorWidget extends WidgetType {
  constructor(private id: string, private name: string, private color: string) {
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
    cLine.style.borderColor = this.color
    cLine.style.backgroundColor = this.color
    let info = document.createElement('div')
    info.className = 'show-info cm-peer-user-cursor-info'
    info.style.backgroundColor = this.color
    info.textContent = this.name
    wrap.append(cLine, info)
    return wrap
  }

  static hideCursorsInfo(view: EditorView) {
    view.contentDOM.querySelectorAll('.cm-peer-user-cursor-info').forEach((e) => e.classList.remove('show-info'))
  }
}

export const createCursorDecoration = (pRange: any): Range<Decoration> => {
  const { clientId, user, range } = pRange
  return Decoration.widget({
    widget: new PeerCursorWidget(clientId, user.name, user.color),
    side: 1,
  }).range(range.from, range.to)
}
