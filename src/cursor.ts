import { Range } from '@codemirror/state';
import { WidgetType, Decoration } from '@codemirror/view';

export class PeerCursorWidget extends WidgetType {
  constructor(
    private id: string,
    private name: string,
    private color: string
  ) {
    super();
  }

  eq(other: PeerCursorWidget) {
    return other.id == this.id;
  }

  toDOM() {
    let wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.className = 'cm-peer-user-cursor';
    let cLine = document.createElement('div');
    cLine.className = 'blink cm-peer-user-cursor-line';
    cLine.style.borderColor = this.color
    let info = document.createElement('div');
    info.className = 'cm-peer-user-cursor-info';
    info.style.backgroundColor = this.color
    info.textContent = this.name;
    wrap.append(cLine, info);
    return wrap;
  }
}

export const createCursorDecoration = (pRange: any): Range<Decoration> => {
  const { clientId, user, range } = pRange;
  return Decoration.widget({
    widget: new PeerCursorWidget(clientId, user.name, user.color),
    side: 1,
  }).range(range.from, range.to);
};
