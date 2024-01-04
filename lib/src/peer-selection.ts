import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { EditorSelection, Range, Extension } from '@codemirror/state'
import { baseSelectionStyles } from './theme'
import { getSyncedVersion, sendableUpdates } from '@codemirror/collab'
import { remoteUpdateRecieved } from './peer-collab'
import { PeerCursorWidget, createCursorDecoration } from './cursor'
import { PeerSelectionRange, PeerUser } from './types'
import { PeerSelectionState, peerSelectionField, peerSelectionsAnnotation } from './peer-selection-state'
import { Facet, combineConfig } from '@codemirror/state'
import { PeerEditorSelectionJSON } from './types'

export interface PeerSelectionEvents {
  /**
   * Shares the local selection and cursor with other peers.
   * @param localSelectionData - The local selection data to be broadcasted.
   */
  onBroadcastLocalSelection: (clientID: string, localSelectionData: PeerEditorSelectionJSON) => void
  /**
   * Receives selection and cursor updates from peers.
   * @param onReceiveSelectionCallback - The callback function to handle received selection updates.
   */
  onReceiveSelection: (
    onReceiveSelectionCallback: (clientID: string, data: PeerEditorSelectionJSON | null) => void
  ) => void
}

export interface PeerSelectionOptions {
  user: PeerUser
  /**
   * Number of milliseconds to show the username tooltip before hiding it.
   */
  tooltipHideDelayMs?: number
  /**
   * when `true`, it will send event to remove cursor when the editor loses focus.
   */
  removeOnEditorFocusOut?: boolean
}

export type PeerSelectionConfigOptions = PeerSelectionOptions & PeerSelectionEvents
export type PeerSelectionFullConfig = Required<PeerSelectionConfigOptions> & { clientID: string }

const peerSelectionConfig = Facet.define<PeerSelectionConfigOptions, PeerSelectionFullConfig>({
  combine(value) {
    const combined = combineConfig<PeerSelectionFullConfig>(value, {
      tooltipHideDelayMs: 1000,
      removeOnEditorFocusOut: false,
    })
    return combined
  },
})

class PeerSelectionPlugin {
  decorations: DecorationSet
  peerSelectionState: Readonly<PeerSelectionState>
  localSelection: EditorSelection | null
  config: PeerSelectionFullConfig

  constructor(public view: EditorView) {
    this.decorations = Decoration.none
    this.localSelection = null
    this.peerSelectionState = view.state.field(peerSelectionField)
    this.config = view.state.facet(peerSelectionConfig)
    this._subscribeToRemoteSelections()
  }

  update(update: ViewUpdate) {
    this.peerSelectionState = this.view.state.field(peerSelectionField)
    this._brodcastUserSelection(update)
    this._computeSelectionsDecorations(update)
    this._hideCursorsTooltip()
  }

  _brodcastUserSelection(update: ViewUpdate) {
    const hasRemoteUpdate = update.transactions.some((tr) => tr.annotation(remoteUpdateRecieved))
    if (update.selectionSet || hasRemoteUpdate) {
      if (!sendableUpdates(update.view.state).length) {
        this._broadcastSelection()
      }
    }
  }

  _broadcastSelection() {
    this.localSelection = this.view.state.selection
    const selection = this.localSelection.toJSON()
    this.config.onBroadcastLocalSelection(this.config.clientID, {
      version: getSyncedVersion(this.view.state),
      user: this.config.user,
      selection,
    })
  }

  _subscribeToRemoteSelections() {
    this.config.onReceiveSelection((clientID, peerSelectionJson) => {
      this.view.dispatch({
        annotations: [peerSelectionsAnnotation.of([clientID, peerSelectionJson])],
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
      attributes: { style: `background-color: ${user.bgColor}33` },
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

      //line decoration to lines in between the selections
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

  _hideCursorsTooltip() {
    setTimeout(() => {
      PeerCursorWidget.hideCursorsTooltip(this.view)
    }, this.config.tooltipHideDelayMs)
  }

  destroy() {
    this.decorations = Decoration.none
  }
}

export const peerSelection = (config: PeerSelectionConfigOptions & { clientID: string }): Extension => [
  peerSelectionConfig.of(config),
  peerSelectionField,
  ViewPlugin.fromClass(PeerSelectionPlugin, {
    decorations: (v) => v.decorations,
    provide: () => baseSelectionStyles,
  }),
]
