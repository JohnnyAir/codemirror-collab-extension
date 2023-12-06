import { Annotation, EditorSelection, StateField, Transaction } from '@codemirror/state'
import { PeerEditorSelection, PeerEditorSelectionJSON, PeerSelectionRange } from './types'
import { getSyncedVersion } from '@codemirror/collab'

export class PeerSelectionState {
  public selectionMap: Map<string, PeerEditorSelection>

  constructor(instance: PeerSelectionState)
  constructor(selectionMap: Map<string, PeerEditorSelection>)
  constructor(instanceOrSelectionMap: PeerSelectionState | Map<string, PeerEditorSelection>) {
    if (instanceOrSelectionMap instanceof PeerSelectionState) {
      this.selectionMap = new Map(instanceOrSelectionMap.selectionMap)
    } else {
      this.selectionMap = instanceOrSelectionMap
    }
  }

  get selections() {
    return Array.from(this.selectionMap.values())
  }

  get selectionsRanges() {
    return this._combinePeersSelectionRange(this.selections)
  }

  _combinePeersSelectionRange(selections: PeerEditorSelection[]) {
    return selections.reduce((combined, { selection, user, version, clientID }) => {
      const peerRanges = selection.ranges.map((range) => ({
        clientID,
        user,
        range,
        version,
      }))
      combined.push.apply(combined, peerRanges)
      return combined
    }, [] as PeerSelectionRange[])
  }

  remove(id: string) {
    this.selectionMap.delete(id)
  }

  addOrUpdate(selection: PeerEditorSelection, tr: Transaction) {
    if (
      this.selectionMap.has(selection.clientID) &&
      this.selectionMap.get(selection.clientID)!.version > selection.version
    ) {
      return
    }

    // Currently, selection updates are synchronized independently of document changes.
    // Old changes are not retained by the client, making it impossible to map a stale selection.
    // Discard future selections, as they may contain ranges not valid in the local document version.
    if (getSyncedVersion(tr.state) !== selection.version) return

    this.selectionMap.set(selection.clientID, selection)
  }

  /**  Returns a new PeerSelectionState instance with adjusted selections based on transaction changes. */
  static mapChanges(state: PeerSelectionState, tr: Transaction) {
    const newState = new PeerSelectionState(state)
    newState.selectionMap.forEach((ps) => {
      ps.selection = ps.selection.map(tr.changes)
    })
    return newState
  }
}

export const peerSelectionsAnnotation = Annotation.define<[clientID: string, PeerEditorSelectionJSON | null]>()

export const peerSelectionField = StateField.define<Readonly<PeerSelectionState>>({
  create() {
    return new PeerSelectionState(new Map())
  },

  update(state, tr) {
    const selectionUpdate = tr.annotation(peerSelectionsAnnotation)
    //Adjust the selection position for changes.
    const mappedSelectionState = PeerSelectionState.mapChanges(state, tr)

    //TODO: optimistic cursor position update for remote changes
    if (!selectionUpdate) return mappedSelectionState
    const [clientID, selectionJson] = selectionUpdate
    if (!selectionJson) {
      mappedSelectionState.remove(clientID)
    } else {
      mappedSelectionState.addOrUpdate(
        {
          clientID,
          ...selectionJson,
          selection: EditorSelection.fromJSON(selectionJson.selection),
        },
        tr
      )
    }

    return mappedSelectionState
  },
})
