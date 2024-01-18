import { Extension } from '@codemirror/state'
import { PeerCollabOptions, peerCollab, PeerCollabConfigOptions } from './peer-collab'
import { PeerSelectionOptions, peerSelection, PeerSelectionEvents, PeerSelectionConfigOptions } from './peer-selection'
import { IPeerCollabConnection, IPeerConnection } from './types'

type peerExtensionOptions =
  | { connection: IPeerCollabConnection; clientID: string; collab: PeerCollabOptions; selection?: null }
  | { connection: IPeerConnection; clientID: string; collab: PeerCollabOptions; selection: PeerSelectionOptions }

type peerExtensionFunc = (config: peerExtensionOptions) => Extension

const peerExtension: peerExtensionFunc = ({ clientID, connection, collab, selection }) => {
  const extensions: Extension[] = []

  extensions.push(peerCollab(Object.assign({ connection, clientID }, collab)))

  if (selection) {
    extensions.push(
      peerSelection({
        ...selection,
        clientID,
        onBroadcastLocalSelection: connection.onBroadcastLocalSelection,
        onReceiveSelection: connection.onReceiveSelection,
      })
    )
  }

  return extensions
}

//exports
export default peerExtension
export { peerCollab, peerExtension, peerSelection }

//types
export * from './types'
export {
  IPeerCollabConnection,
  IPeerConnection,
  PeerCollabOptions,
  PeerCollabConfigOptions,
  PeerSelectionEvents,
  PeerSelectionOptions,
  PeerSelectionConfigOptions,
}
