import { Socket, io } from 'socket.io-client'
import { IPeerConnection } from '@joncodes/codemirror-collab-extension'
import { Update } from '@codemirror/collab'

type PConnection = IPeerConnection & { socket: Socket; connect: () => void }

export const createPeerConnection = (clientID: string): PConnection => {
  const url = 'http://localhost:4000'

  const socket = io(url, {
    transports: ['websocket'],
    auth: {
      clientID,
    },
  })

  return {
    socket,

    connect() {
      socket.connect()
    },

    onConnected(handler: () => void) {
      socket.on('connect', handler)
    },

    onDisconnected(handler: () => void) {
      socket.on('disconnect', handler)
    },

    pullUpdates(version) {
      return socket.timeout(3000).emitWithAck('pullDocumentUpdates', version) as Promise<Update[]>
    },

    pushUpdates(version, updates) {
      socket.emit('updateDocument', { version, updates })
    },

    onUpdatesReceived(handler) {
      socket.on('updatesRecieved', handler)
    },

    onBroadcastLocalSelection(clientId, selection) {
      socket.emit('pushSelection', clientId, selection)
    },

    onReceiveSelection(handler) {
      socket.on('peer-selection', handler)
    },

    destroy() {
      socket.offAny()
      socket.offAnyOutgoing()
      socket.close()
    },
  }
}
