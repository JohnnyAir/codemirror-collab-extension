import { Socket, io } from 'socket.io-client'
import { Update } from '@codemirror/collab'

const createConnection = () => {
  const url = 'http://localhost:4000'
  return io(url)
}

//socket.io PeerConnection
export class PeerConnection {
  public socket: Socket

  constructor() {
    this.socket = createConnection()
  }

  connect() {
    this.socket.connect()
  }

  onConnected(handler: () => void) {
    this.socket.on('connect', handler)
  }

  onDisconnected(handler: () => void) {
    this.socket.on('disconnect', handler)
  }

  pullUpdates(version: number) {
    return this.socket.timeout(3000).emitWithAck('pullDocumentUpdates', version)
  }

  pushUpdates<T>(updates: T) {
    return this.socket.emit('updateDocument', updates) as any
  }

  onUpdatesReceived(handler: (updates: Update[]) => void) {
    this.socket.on('updatesRecieved', handler)
  }

  onBroadcastLocalSelection(data: any) {
    this.socket.emit('pushSelection', data)
  }

  onRecieveSelection(handler: (data: any) => void) {
    this.socket.on('peer-selection', handler)
  }

  disconnect() {
    this.socket.offAny()
    this.socket.offAnyOutgoing()
    this.socket.close()
  }
}
