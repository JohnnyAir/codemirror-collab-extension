import { Update, receiveUpdates, sendableUpdates, collab, getSyncedVersion } from '@codemirror/collab'
import { ChangeSet, Annotation } from '@codemirror/state'
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { debounce } from './utils'
import { IPeerConnection } from './types'
import { PeerConfig, peerConfig } from './config'

const serializeUpdates = (updates: readonly Update[]): Update[] => {
  return updates.map((u) => ({
    clientID: u.clientID,
    changes: u.changes.toJSON(),
    effects: u.effects,
  }))
}

const deserializeUpdates = (updates: Update[]): Update[] => {
  return updates.map((u: any) => ({
    ...u,
    changes: ChangeSet.fromJSON(u.changes),
  }))
}

export const remoteUpdateRecieved = Annotation.define<boolean>()

enum CollabState {
  Idle = 'idle',
  Pushing = 'pushing',
  Pulling = 'pulling',
  Disconnected = 'disconnected',
}

class PeerExtensionPlugin {
  private cbState: CollabState = CollabState.Idle
  private pendingRecieved = []
  private conf: PeerConfig
  private connection: IPeerConnection

  constructor(private view: EditorView) {
    this.conf = view.state.facet(peerConfig)
    this.connection = this.conf.connection
    this.onConnected()
    this.receiveUpdates()
    this.onDisconnected()
  }

  private changeState(newState: CollabState) {
    this.cbState = newState
  }

  private onDisconnected() {
    this.connection.onDisconnected(() => {
      this.changeState(CollabState.Disconnected)
    })
  }

  private onConnected() {
    this.connection.onConnected(async () => {
      if (this.cbState === CollabState.Disconnected) {
        await this._getUpdates()
        this.changeState(CollabState.Idle)
        this._pushUpdate()
      }
    })
  }

  private receiveUpdates() {
    this.connection.onUpdatesReceived((updates) => {
      if (this.cbState !== CollabState.Idle) {
        this.pendingRecieved.push.apply(updates)
        return
      }
      this.applyUpdates([...this.pendingRecieved, ...updates])
    })
  }

  update(update: ViewUpdate) {
    if (update.docChanged) {
      this._debouncedPushUpdate()
    }
  }

  private get _debouncedPushUpdate() {
    const func = debounce(() => this._pushUpdate(), this.conf.pushUpdateDelay)
    Object.defineProperty(this, '_debouncedPushUpdate', { value: func, writable: false })
    return func
  }

  private async _pushUpdate() {
    let updates = sendableUpdates(this.view.state)
    if (!updates.length || this.cbState !== CollabState.Idle) return
    this.changeState(CollabState.Pushing)
    let version = getSyncedVersion(this.view.state)
    const serialized = serializeUpdates(updates)
    this.connection.pushUpdates(version, serialized)
    this.changeState(CollabState.Idle)
    this.applyPendingUpdates()
    if (sendableUpdates(this.view.state).length) {
      this._debouncedPushUpdate()
    }
  }

  private async _getUpdates() {
    try {
      this.changeState(CollabState.Pulling)
      let version = getSyncedVersion(this.view.state)
      const updates = await this.connection.pullUpdates(version)
      this.applyUpdates(updates)
    } catch (error) {
      console.error(error)
    }
  }

  private applyUpdates(updates: Update[]) {
    const tr = receiveUpdates(this.view.state, deserializeUpdates(updates))
    this.view.dispatch(tr, { annotations: [remoteUpdateRecieved.of(true)] })
  }

  private applyPendingUpdates() {
    if (this.pendingRecieved.length) {
      this.applyUpdates(this.pendingRecieved)
      this.pendingRecieved.length = 0
    }
  }

  destroy() {
    this.connection.destroy()
  }
}

export function peerExtension(clientID: string, startVersion: number) {
  return [collab({ startVersion, clientID }), ViewPlugin.fromClass(PeerExtensionPlugin)]
}
