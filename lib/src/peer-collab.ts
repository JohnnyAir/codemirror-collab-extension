import { Update, receiveUpdates, sendableUpdates, collab, getSyncedVersion } from '@codemirror/collab'
import { ChangeSet, Annotation, Facet, combineConfig } from '@codemirror/state'
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { debounce } from './utils'
import { IPeerCollabConnection } from './types'

export type PeerCollabOptions = {
  /**
   * The starting document version. Defaults to 0.
   */
  docStartVersion?: number
  /**
   * The debounce delay (in milliseconds) for pushing document updates to the authority.
   * Specify the time interval for collecting multiple updates before sending
   * them in a single request.
   */
  pushUpdateDelayMs?: number
}

export type PeerCollabConfigOptions = { connection: IPeerCollabConnection; clientID: string } & PeerCollabOptions

// fully populated configuration, ensures all optional fields have default values.
type PeerCollabConfigFull = Required<PeerCollabConfigOptions>

/**
 *  Configuration Facet, combine provided options with default values.
 */
export const peerConfig = Facet.define<PeerCollabConfigOptions, PeerCollabConfigFull>({
  combine(value) {
    const combined = combineConfig<PeerCollabConfigFull>(value, { docStartVersion: 0, pushUpdateDelayMs: 100 })
    return combined
  },
})

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

export const remoteUpdateRecieved = Annotation.define<{
  clientID: string | null
  clientIDs: string[]
  isOwnChange: boolean
}>()

enum CollabState {
  Idle = 'idle',
  Pushing = 'pushing',
  Pulling = 'pulling',
  Disconnected = 'disconnected',
}

class PeerExtensionPlugin {
  private cbState: CollabState = CollabState.Idle
  private pendingRecieved = []
  private conf: PeerCollabConfigFull
  private connection: IPeerCollabConnection

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
    const func = debounce(() => this._pushUpdate(), this.conf.pushUpdateDelayMs)
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

  private getUpdateAnnontation(updates: Update[]) {
    const clientIDs = Array.from(new Set(updates.map((u) => u.clientID)))
    const clientID = clientIDs.length === 1 && clientIDs[0] ? clientIDs[0] : null
    const isOwnChange = clientID === this.conf.clientID
    return [remoteUpdateRecieved.of({ clientID, clientIDs, isOwnChange })]
  }

  private applyUpdates(updates: Update[]) {
    const tr = receiveUpdates(this.view.state, deserializeUpdates(updates))
    this.view.dispatch(tr, { annotations: this.getUpdateAnnontation(updates) })
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

export function peerCollab(config: PeerCollabConfigOptions) {
  return [
    peerConfig.of(config),
    collab({ startVersion: config.docStartVersion, clientID: config.clientID }),
    ViewPlugin.fromClass(PeerExtensionPlugin),
  ]
}
