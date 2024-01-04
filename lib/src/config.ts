import { Facet, combineConfig } from '@codemirror/state'
import { IPeerConnection } from './types'

/**
 * Options for configuring the behavior and appearance of collaborative editing with peers.
 */
export type PeerConfigOptions = {
  /**
   * A unique identifier for the client.
   */
  clientID: string
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

// fully populated configuration, ensures all optional fields have default values.
type Config = Required<PeerConfigOptions>

export type ConfigWithConnection<T extends object> = T & {
  connection: IPeerConnection
}

type ConfigOptionsWithConnection = ConfigWithConnection<PeerConfigOptions>

export type PeerConfig = ConfigWithConnection<Config>

/**
 * Facet for managing collaborative editing configuration, combining provided options with default values.
 */
export const peerConfig = Facet.define<ConfigOptionsWithConnection, PeerConfig>({
  combine(value) {
    const combined = combineConfig<PeerConfig>(value, { docStartVersion: 0, pushUpdateDelayMs: 100 })
    return combined
  },
})
