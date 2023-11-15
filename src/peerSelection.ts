import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { PeerConnection } from './peerConnection';
import {
  EditorSelection,
  Annotation,
  Range,
  SelectionRange,
} from '@codemirror/state';
import { aplha, baseSelectionStyles } from './theme';

type PeerSelectionRangeJSON = {
  main: number;
  ranges: Pick<SelectionRange, 'anchor' | 'head'>[];
};

type PeerEditorSelectionJSON = {
  clientId: string;
  user: { name: string; color: string };
  selection: PeerSelectionRangeJSON | null;
};

type PeerEditorSelection = {
  clientId: string;
  user: { name: string; color: string };
  selection: EditorSelection;
};

type PeerSelectionRange = {
  clientId: string;
  user: { name: string; color: string };
  range: SelectionRange;
};

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
    cLine.className = 'cm-peer-user-cursor-line';
    let info = document.createElement('div');
    info.className = 'cm-peer-user-cursor-info';
    info.textContent = this.name;
    wrap.append(cLine);
    return wrap;
  }
}

const peerSelectionsAnnotation = Annotation.define();

export const peerSelectionPlugin = (connection: PeerConnection) => {
  const userObj = { name: 'Anonymous Bird', color: '#dddddd' };

  class PeerSelection {
    decorations: DecorationSet;
    peersSelections: PeerEditorSelection[];
    localSelection: EditorSelection | null;

    constructor(public view: EditorView) {
      this.decorations = Decoration.none;
      this.localSelection = null;
      this.peersSelections = [];
      this.subscribe();
    }

    update(update: ViewUpdate) {
      if (update.transactions[0]?.annotation(peerSelectionsAnnotation)) {
        this.computeDecorations(update);
        return;
      }
      this.pushSelectionRange(update);
    }

    pushSelectionRange(update: ViewUpdate) {
      if (
        !connection.connection.id ||
        (this.localSelection !== null &&
          update.state.selection.eq(this.localSelection))
      ) {
        return;
      }

      console.log('pushing');
      const clientId = connection.connection.id;
      this.localSelection = this.view.state.selection;
      const selection = this.localSelection.toJSON();
      connection.onPushSelections({
        clientId,
        user: userObj,
        selection,
      });
    }

    subscribe() {
      connection.onSelections((selectionJSON: PeerEditorSelectionJSON) => {
        //remove peer selection
        const pSelections = this.peersSelections.filter(
          (es) => es.clientId !== selectionJSON.clientId
        );

        //add peer selection
        if (selectionJSON.selection) {
          pSelections.push({
            ...selectionJSON,
            selection: EditorSelection.fromJSON(selectionJSON.selection),
          });
        }
        console.log('pSelections', pSelections);
        this.peersSelections = pSelections;
        this.view.dispatch({
          annotations: [peerSelectionsAnnotation.of([])],
        });
      });
    }

    computeDecorations(update: ViewUpdate) {
      const allPeersSelectionRange = this.combinePeersSelectionRange();
      const decorationsRange = allPeersSelectionRange
        .map((peerRange) => {
          if (peerRange.range.empty) {
            return this.getCursorDecoration(peerRange);
          }
          return this.getSelectionRangeDecoration(update, peerRange);
        })
        .flat(1);
      this.decorations = Decoration.set(decorationsRange, true);
    }

    combinePeersSelectionRange() {
      return this.peersSelections.reduce(
        (combined, { selection, user, clientId }) => {
          const peerRanges = selection.ranges.map((range) => ({
            clientId,
            user,
            range,
          }));
          combined.push.apply(combined, peerRanges);
          return combined;
        },
        [] as PeerSelectionRange[]
      );
    }

    getCursorDecoration(pRange: PeerSelectionRange) {
      const { clientId, user, range } = pRange;
      return Decoration.widget({
        widget: new PeerCursorWidget(clientId, user.name, user.color),
        side: 1,
      }).range(range.from, range.to);
    }

    getSelectionRangeDecoration(
      update: ViewUpdate,
      peerRange: PeerSelectionRange
    ) {
      const { clientId, range, user } = peerRange;
      const from = Math.min(range.anchor, range.head);
      const to = Math.max(range.anchor, range.head);
      const fromLine = update.view.state.doc.lineAt(from);
      const toLine = update.view.state.doc.lineAt(to);

      const isSingleLineSelection = fromLine.number === toLine.number;

      const decorationOption = {
        attributes: { style: `background-color: ${aplha(user.color, 0.3)}` },
        class: 'peer-user-selection',
      };

      const decorations: Range<Decoration>[] = [];

      if (isSingleLineSelection) {
        decorations.push(Decoration.mark(decorationOption).range(from, to));
      } else {
        //first line
        //mark decoration range cannot be empty
        //skip adding mark decoration when is line empty
        if (fromLine.length !== 0) {
          decorations.push(
            Decoration.mark(decorationOption).range(
              from,
              from + fromLine.length
            )
          );
        }

        //mark decoration for last line
        if (toLine.length !== 0) {
          decorations.push(
            Decoration.mark(decorationOption).range(toLine.from, to)
          );
        }

        for (let i = fromLine.number + 1; i < toLine.number; i++) {
          const lineNum = update.view.state.doc.line(i).from;
          decorations.push(
            Decoration.line(decorationOption).range(lineNum, lineNum)
          );
        }
      }

      //cursor
      const cursor = EditorSelection.cursor(range.head);

      decorations.push(
        this.getCursorDecoration({ clientId, user, range: cursor })
      );

      return decorations;
    }

    destroy() {
      this.decorations = Decoration.none;
    }
  }

  return ViewPlugin.fromClass(PeerSelection, {
    decorations: (v) => v.decorations,
    provide: () => baseSelectionStyles,
  });
};
