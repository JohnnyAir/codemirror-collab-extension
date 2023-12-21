import { Facet, combineConfig } from '@codemirror/state'
import { IPeerConnection, SelectionConfig } from '.'

export type PeerConfigOptions = {
  clientID: string
  docStartVersion?: number
  selection: SelectionConfig
  /**
   * The delay (in milliseconds) used to throttle the frequency of pushing updates
   * to the server. This value determines the time interval during which multiple
   * updates will be collected before being sent in a single request.
   */
  pushUpdateDelay?: number
}

type Config = Required<PeerConfigOptions>

type ConfigWithConnection<T extends PeerConfigOptions> = T & {
  connection: IPeerConnection
}

type ConfigOptionsWithConnection = ConfigWithConnection<PeerConfigOptions>

export type PeerConfig = ConfigWithConnection<Config>

export const peerConfig = Facet.define<ConfigOptionsWithConnection, PeerConfig>({
  combine(value) {
    const combined = combineConfig<PeerConfig>(value, { docStartVersion: 0, pushUpdateDelay: 100 })
    return combined
  },
})
