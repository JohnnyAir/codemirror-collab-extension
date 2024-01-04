import { Extension } from '@codemirror/state'
import { PeerConfigOptions } from './config'
import { CollabConfigOptions, peerCollab } from './peer-collab'
import { PeerSelectionConfigOptions, PeerSelectionOptions, peerSelection, PeerSelectionEvents } from './peer-selection'
import { IPeerCollabConnection, IPeerConnection } from './types'

type peerExtensionFunc = {
  (connection: IPeerCollabConnection, collabOptions: CollabConfigOptions, selectionOptions: undefined): Extension
  (
    connection: IPeerCollabConnection,
    collabOptions: CollabConfigOptions,
    selectionOptions: PeerSelectionConfigOptions
  ): Extension
  (connection: IPeerConnection, collabOptions: CollabConfigOptions, selectionOptions: PeerSelectionOptions): Extension
}

const peerExtension: peerExtensionFunc = (connection, collabOptions, selectionOptions) => {
  const { clientID } = collabOptions

  const extensions: Extension[] = []

  extensions.push(peerCollab(connection, collabOptions))

  if (selectionOptions) {
    const selectionOpts = selectionOptions as PeerSelectionConfigOptions
    const pConnection = connection as IPeerConnection

    extensions.push(
      peerSelection({
        clientID,
        ...selectionOptions,
        onBroadcastLocalSelection: selectionOpts.onBroadcastLocalSelection || pConnection.onBroadcastLocalSelection,
        onReceiveSelection: selectionOpts.onReceiveSelection || pConnection.onReceiveSelection,
      })
    )
  }

  return extensions
}

//exports
export default peerExtension
export { peerCollab, peerExtension, peerSelection, PeerSelectionEvents, PeerConfigOptions }
export * from './types'
