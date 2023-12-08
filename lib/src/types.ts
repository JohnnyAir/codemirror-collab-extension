import { Update } from '@codemirror/collab'
import { EditorSelection, SelectionRange } from '@codemirror/state'

export type PeerSelectionRangeJSON = {
  main: number
  ranges: Pick<SelectionRange, 'anchor' | 'head'>[]
}

export type PeerEditorSelectionJSON = {
  version: number
  user: { name: string; color: string }
  selection: PeerSelectionRangeJSON | null
}

export type PeerEditorSelection = {
  clientID: string
  version: number
  user: { name: string; color: string }
  selection: EditorSelection
}

export type PeerSelectionRange = {
  clientID: string
  user: { name: string; color: string }
  range: SelectionRange
}

/**
 * Represents a peer connection for collaborative editing.
 */
export interface IPeerConnection {
  /**
   * Registers a callback to be invoked when the connection is established.
   * @param onConnectedCallback - The callback function to be executed on connection.
   */
  onConnected: (onConnectedCallback: () => void) => void

  /**
   * Registers a callback to be invoked when the connection is disconnected.
   * @param onDisconnectedCallback - The callback function to be executed on disconnection.
   */
  onDisconnected: (onDisconnectedCallback: () => void) => void

  /**
   * Pulls updates made to the authority's document since the local version.
   * usually called during reconnection.
   * @param fromVersion - The version from which updates should be pulled.
   */
  pullUpdates: (fromVersion: number) => Promise<Update[]>

  /**
   * Pushes unconfirmed local updates to the authority to be applied and shared with other peers.
   * @param version - current synchronized version.
   * @param unconfirmedUpdates - The array of unconfirmed updates to be pushed.
   */
  pushUpdates: (version: number, unconfirmedUpdates: Update[]) => void

  /**
   * Registers a listener to receive real-time document updates and applies them to the local document.
   * @param onUpdatesReceivedCallback - The callback function to handle received updates.
   */
  onUpdatesReceived: (onUpdatesReceivedCallback: (updates: Update[]) => void) => void

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

  /**
   * Performs cleanup operations.
   */
  destroy: () => void
}

export type SelectionConfig = {
  name: string
  color: string
  bgColor: string
}

export type PeerColabConfig = {
  clientID: string
  docStartVersion: number
  selection: SelectionConfig
}
