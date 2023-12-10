import { peerCollabConfig, peerExtension } from './peer-collab'
import { peerSelection } from './peer-selection'
import { IPeerConnection, PeerColabConfig } from './types'

const peerCollab = (connection: IPeerConnection, options: PeerColabConfig) => {
  const { clientID, docStartVersion, selection } = options

  return [
    peerCollabConfig.of({
      clientID,
      connection,
      docStartVersion,
      selection,
      pushUpdateDelay: 200
    }),
    peerExtension(clientID, docStartVersion),
    peerSelection,
  ]
}

//Exports
export { peerCollab, peerExtension, peerSelection }
export * from './types'
