import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { PeerConnection } from './peer-connection'
import { EditorSelection, Range, Extension } from '@codemirror/state'
import { baseSelectionStyles } from './theme'
import { getSyncedVersion, sendableUpdates } from '@codemirror/collab'
import { IPeerCollabConfig, peerCollabConfig } from './collab'
import { PeerCursorWidget, createCursorDecoration } from './cursor'
import { PeerSelectionRange } from './types'
import { PeerSelectionState, peerSelectionField, peerSelectionsAnnotation } from './peer-selection-state'

class PeerSelectionPlugin {
  decorations: DecorationSet
  peerSelectionState: Readonly<PeerSelectionState>
  localSelection: EditorSelection | null
  config: IPeerCollabConfig
  connection: PeerConnection

  constructor(public view: EditorView) {
    this.decorations = Decoration.none
    this.localSelection = null
    this.peerSelectionState = view.state.field(peerSelectionField)
    this.config = view.state.facet(peerCollabConfig)
    this.connection = this.config.connection
    this._subscribeToPeersEditorSelections()
    this.config.colab.onVersionUpdate = (_, hasUnconfirmedChanges) => {
      if (!hasUnconfirmedChanges) {
        this._broadcastSelection()
      }
    }
  }

  update(update: ViewUpdate) {
    this.peerSelectionState = this.view.state.field(peerSelectionField)
    this._brodcastUserSelection(update)
    this._computeSelectionsDecorations(update)
    this._hideCursorsInfo()
  }

  _brodcastUserSelection(update: ViewUpdate) {
    if (update.selectionSet && update.transactions.length) {
      //const tr = update.transactions[0]
      //TODO: don't send when pushing or disconneted.
      //Use facet to hold these values?
      if (!sendableUpdates(update.view.state).length) {
        this._broadcastSelection()
      }
    }
  }

  _broadcastSelection() {
    this.localSelection = this.view.state.selection
    const selection = this.localSelection.toJSON()
    this.connection.onBroadcastLocalSelection({
      clientID: this.config.clientID,
      version: getSyncedVersion(this.view.state),
      user: this.config.user,
      selection,
    })
  }

  _subscribeToPeersEditorSelections() {
    this.connection.onRecieveSelection((peerSelectionJson) => {
      this.view.dispatch({
        annotations: [peerSelectionsAnnotation.of(peerSelectionJson)],
      })
    })
  }

  _computeSelectionsDecorations(update: ViewUpdate) {
    const decorationsRange = this.peerSelectionState.selectionsRanges
      .map((peerRange) => {
        if (peerRange.range.empty || peerRange.range.from === peerRange.range.to) {
          return createCursorDecoration(peerRange)
        }
        return this._getSelectionRangeDecoration(update, peerRange)
      })
      .flat(1)
    this.decorations = Decoration.set(decorationsRange, true)
  }

  _getSelectionRangeDecoration(update: ViewUpdate, peerRange: PeerSelectionRange) {
    const { clientID, range, user } = peerRange
    const from = range.from
    const to = range.to
    const fromLine = update.view.state.doc.lineAt(from)
    const toLine = update.view.state.doc.lineAt(to)
    const isSingleLineSelection = fromLine.number === toLine.number
    const decorationOption = {
      attributes: { style: `background-color: ${user.color}33` },
      class: 'peer-user-selection',
    }

    const decorations: Range<Decoration>[] = []

    if (isSingleLineSelection) {
      decorations.push(Decoration.mark(decorationOption).range(from, to))
    } else {
      //add mark decoration to first line
      //mark decoration range cannot be empty. skip adding mark decoration when line is empty
      if (fromLine.length !== 0) {
        decorations.push(Decoration.mark(decorationOption).range(from, from + fromLine.length))
      }

      //add mark decoration to last line
      if (toLine.length !== 0) {
        decorations.push(Decoration.mark(decorationOption).range(toLine.from, to))
      }

      for (let i = fromLine.number + 1; i < toLine.number; i++) {
        const lineNum = update.view.state.doc.line(i).from
        decorations.push(Decoration.line(decorationOption).range(lineNum, lineNum))
      }
    }

    //cursor
    const cursor = EditorSelection.cursor(range.head)
    decorations.push(createCursorDecoration({ clientID, user, range: cursor }))

    return decorations
  }

  _hideCursorsInfo() {
    setTimeout(() => {
      PeerCursorWidget.hideCursorsInfo(this.view)
    }, 1000)
  }

  destroy() {
    this.decorations = Decoration.none
  }
}

export const peerSelection: Extension = [
  peerSelectionField,
  ViewPlugin.fromClass(PeerSelectionPlugin, {
    decorations: (v) => v.decorations,
    provide: () => baseSelectionStyles,
  }),
]
