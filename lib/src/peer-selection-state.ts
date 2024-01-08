import { Annotation, EditorSelection, StateField, Transaction } from '@codemirror/state'
import { PeerEditorSelection, PeerEditorSelectionJSON, PeerSelectionRange } from './types'
import { getSyncedVersion } from '@codemirror/collab'
import { remoteUpdateRecieved } from './peer-collab'

export class PeerSelectionState {
  public selectionMap: Map<string, PeerEditorSelection>

  constructor(instanceOrSelectionMap?: PeerSelectionState | Map<string, PeerEditorSelection>) {
    if (instanceOrSelectionMap instanceof PeerSelectionState) {
      this.selectionMap = new Map(instanceOrSelectionMap.selectionMap)
    } else {
      this.selectionMap = instanceOrSelectionMap || new Map()
    }
  }

  public get selections() {
    return Array.from(this.selectionMap.values())
  }

  public get selectionsRanges() {
    return this.getAllSelectionRanges(this.selections)
  }

  // optimistically move the cursor(s) of a peer that made changes to the document.
  private applyOptimisticSelectionUpdateForRemoteUserChange(clientID: string, tr: Transaction) {
    //get selection of the user that make the remote changes
    const peerSelection = this.selectionMap.get(clientID)
    if (!peerSelection) return

    const cursors = peerSelection.selection.ranges.filter((r) => r.empty)
    const multiRangeSelections = peerSelection.selection.ranges.filter((r) => !r.empty)

    // Optimistically update cursors position based on document changes
    tr.changes.iterChanges((_, toA, __, toB) => {
      const cursorIndex = cursors.findIndex((r) => r.head == toA)
      if (cursorIndex > -1) {
        cursors[cursorIndex] = EditorSelection.cursor(toB)
      }
    })

    // Map non-empty selections through transaction changes
    const updatedMultiSelection = multiRangeSelections.map((r) => r.map(tr.changes))
    const updatedSelection = EditorSelection.create(updatedMultiSelection.concat(cursors))
    this.selectionMap.set(clientID, { ...peerSelection, selection: updatedSelection })
  }

  private getAllSelectionRanges(selections: PeerEditorSelection[]) {
    const convertSelectionMapToPeerRanges = ({ selection, user, version, clientID }: PeerEditorSelection) =>
      selection.ranges.map((range) => ({ clientID, user, range, version }))
    return selections.flatMap<PeerSelectionRange>(convertSelectionMapToPeerRanges)
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

  /**
   * Map all remote selections through transaction changes.
   * Adjusts all peers' selections' positions for changes.
   * If doc-changed, optimistically move the cursor of the peer that made changes to the document.
   */
  mapChanges(tr: Transaction) {
    const newState = new PeerSelectionState(this)
    const remoteUpdate = tr.annotation(remoteUpdateRecieved)
    const remoteClientID = remoteUpdate && remoteUpdate.clientID

    //optimistic cursor position update for remote peer changes
    if (tr.docChanged && remoteClientID && !remoteUpdate.isOwnChange) {
      newState.applyOptimisticSelectionUpdateForRemoteUserChange(remoteClientID, tr)
    }

    newState.selectionMap.forEach((ps) => {
      if (remoteClientID !== ps.clientID) ps.selection = ps.selection.map(tr.changes)
    })

    return newState
  }
}

export const peerSelectionsAnnotation = Annotation.define<[clientID: string, PeerEditorSelectionJSON | null]>()

/**
 * StateField to hold the selections of all connected remote peers
 */
export const peerSelectionField = StateField.define<Readonly<PeerSelectionState>>({
  create() {
    return new PeerSelectionState()
  },

  update(state, tr) {
    const selectionUpdate = tr.annotation(peerSelectionsAnnotation)

    // Adjust the selections' position for changes.
    const newState = state.mapChanges(tr)

    if (!selectionUpdate) return newState
    const [clientID, selectionJson] = selectionUpdate

    // remove peer selection if data recieved is null or falsy.
    if (!selectionJson) {
      newState.remove(clientID)
    } else {
      newState.addOrUpdate(
        {
          clientID,
          ...selectionJson,
          selection: EditorSelection.fromJSON(selectionJson.selection),
        },
        tr
      )
    }

    return newState
  },
})
