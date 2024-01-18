import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { EditorSelection, Range, Extension } from '@codemirror/state'
import { baseSelectionStyles } from './theme'
import { getSyncedVersion, sendableUpdates } from '@codemirror/collab'
import { remoteUpdateRecieved } from './peer-collab'
import { createCursorDecoration } from './cursor'
import { PeerSelectionRange, PeerUser } from './types'
import { PeerSelectionState, peerSelectionField, peerSelectionsAnnotation } from './peer-selection-state'
import { Facet, combineConfig } from '@codemirror/state'
import { PeerEditorSelectionJSON } from './types'
import { noop } from './utils'

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

export type PeerSelectionConfigOptions = PeerSelectionOptions & PeerSelectionEvents & { clientID: string }

type PeerSelectionFullConfig = Required<PeerSelectionConfigOptions>

const peerSelectionConfig = Facet.define<PeerSelectionConfigOptions, PeerSelectionFullConfig>({
  combine(value) {
    const combined = combineConfig<PeerSelectionFullConfig>(value, {
      tooltipHideDelayMs: 1000,
      removeOnEditorFocusOut: false,
      onBroadcastLocalSelection: noop,
      onReceiveSelection: noop,
    })
    return combined
  },
})

class PeerSelectionPlugin {
  decorations: DecorationSet
  peerSelectionState: Readonly<PeerSelectionState>
  config: PeerSelectionFullConfig

  constructor(public view: EditorView) {
    this.decorations = Decoration.none
    this.peerSelectionState = view.state.field(peerSelectionField)
    this.config = view.state.facet(peerSelectionConfig)
    this._subscribeToRemoteSelections()
  }

  update(update: ViewUpdate) {
    this.peerSelectionState = this.view.state.field(peerSelectionField)
    this._brodcastUserSelection(update)
    this._computeSelectionsDecorations(update)
  }

  _brodcastUserSelection(update: ViewUpdate) {
    const remoteTransaction = update.transactions.find((tr) => tr.annotation(remoteUpdateRecieved))
    const remoteUpdate = remoteTransaction?.annotation(remoteUpdateRecieved)
    if (update.selectionSet || (remoteUpdate && remoteUpdate.isOwnChange)) {
      if (!sendableUpdates(update.view.state).length) {
        this._broadcastSelection()
      }
    } else if (this.config.removeOnEditorFocusOut && update.focusChanged && !update.view.hasFocus) {
      this._broadcastSelection(true)
    }
  }

  _broadcastSelection(removeCursor = false) {
    const localSelection = this.view.state.selection
    const selection = removeCursor ? null : localSelection.toJSON()
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
          return createCursorDecoration(peerRange, this.config.tooltipHideDelayMs)
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
      // Check if the first line is fully selected; use a line decoration if true, else use a mark for the selected ranges.
      const isFromLineFullSelection = from === fromLine.from

      if (fromLine.to - from !== 0 && !isFromLineFullSelection) {
        // Add mark decoration to the first line if it isn't a full selection and the line range isn't empty.
        decorations.push(Decoration.mark(decorationOption).range(from, fromLine.to))
      }

      if (isFromLineFullSelection) {
        // Use a line decoration for the fully selected first line.
        decorations.push(Decoration.line(decorationOption).range(from, from))
      }

      const isToLineFullSelection = to === toLine.to

      // Add mark decoration to the last line if it isn't a full selection and the line range isn't empty.
      if (to - toLine.from !== 0 && !isToLineFullSelection) {
        decorations.push(Decoration.mark(decorationOption).range(toLine.from, to))
      }

      if (isToLineFullSelection) {
        // Use a line decoration for the fully selected last line.
        decorations.push(Decoration.line(decorationOption).range(to, to))
      }

      // All in-between lines will be fully selected, so use line decorations.
      for (let i = fromLine.number + 1; i < toLine.number; i++) {
        const lineNum = update.view.state.doc.line(i).from
        decorations.push(Decoration.line(decorationOption).range(lineNum, lineNum))
      }
    }

    //cursor
    const cursor = EditorSelection.cursor(range.head)
    decorations.push(createCursorDecoration({ clientID, user, range: cursor }, this.config.tooltipHideDelayMs))

    return decorations
  }

  destroy() {
    this.decorations = Decoration.none
  }
}

export const peerSelection = (config: PeerSelectionConfigOptions): Extension => [
  peerSelectionConfig.of(config),
  peerSelectionField,
  ViewPlugin.fromClass(PeerSelectionPlugin, {
    decorations: (v) => v.decorations,
    provide: () => baseSelectionStyles,
  }),
]
