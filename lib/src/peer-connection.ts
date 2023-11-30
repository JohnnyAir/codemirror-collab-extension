import { Socket, io } from 'socket.io-client'
import { Update } from '@codemirror/collab'

const createConnection = () => {
  const url = 'http://localhost:4000'
  return io(url)
}

//socket.io PeerConnection
export class PeerConnection {
  public connection: Socket

  constructor() {
    this.connection = createConnection()
    // this.connection.onAny((event, ...args) => {
    //   console.log(`in event:: ${event} =>`, ...args);
    // });

    // this.connection.onAnyOutgoing((event, ...args) => {
    //   console.log(`out event:: ${event} =>`, ...args);
    // });
  }

  connect() {
    this.connection.connect()
  }

  onConnected(handler: () => void) {
    this.connection.on('connect', handler)
  }

  pullUpdates(version: number) {
    return this.connection.timeout(3000).emitWithAck('pullDocumentUpdates', version)
  }

  pushUpdates<T>(updates: T) {
    return this.connection.emit('updateDocument', updates) as any
  }

  onUpdatesReceived(handler: (updates: Update[]) => void) {
    this.connection.on('updatesRecieved', handler)
  }

  onBroadcastLocalSelection(data: any) {
    this.connection.emit('pushSelection', data)
  }

  onRecieveSelection(handler: (data: any) => void) {
    this.connection.on('peer-selection', handler)
  }

  disconnect() {
    this.connection.offAny()
    this.connection.offAnyOutgoing()
    this.connection.close()
  }
}
