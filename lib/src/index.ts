import { PeerConfigOptions, peerConfig } from './config'
import { peerExtension } from './peer-collab'
import { peerSelection } from './peer-selection'
import { IPeerConnection } from './types'

const peerCollab = (connection: IPeerConnection, options: PeerConfigOptions) => {
  const { clientID, docStartVersion = 0 } = options

  return [
    peerConfig.of({
      connection,
      ...options,
    }),
    peerExtension(clientID, docStartVersion),
    peerSelection,
  ]
}

//Exports
export { peerCollab, peerExtension, peerSelection, PeerConfigOptions }
export * from './types'
