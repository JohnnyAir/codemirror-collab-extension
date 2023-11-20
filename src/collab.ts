import {
  Update,
  receiveUpdates,
  sendableUpdates,
  collab,
  getSyncedVersion,
} from '@codemirror/collab';
import { ChangeSet, Facet } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { PeerConnection } from './peerConnection';
import { debounce } from './utils';

export type IPeerCollabConfig = {
  clientID: string;
  connection: PeerConnection;
  color: string;
  name: string;
};

export const peerCollabConfig = Facet.define<
  IPeerCollabConfig,
  IPeerCollabConfig
>({
  combine(value) {
    return value[value.length - 1];
  },
});

export const RecievedEvent = (() => {
  let listeners: any[] = [];

  return {
    add: (event: () => void) => {
      listeners.push(event);
    },
    emit: () => {
      listeners.map((l) => l.call(null));
    },
    clear: () => {
      console.log('clearing');
      listeners.length = 0;
    },
  };
})();

const pushUpdates = (
  connection: PeerConnection,
  version: number,
  updates: readonly Update[]
) => {
  let updatesJSON = updates.map((u) => ({
    clientID: u.clientID,
    changes: u.changes.toJSON(),
  }));
  return connection.pushUpdates({ version, updates: updatesJSON });
};

const pullUpdates = async (
  connection: PeerConnection,
  currentVersion: number
) => {
  try {
    return await connection.pullUpdates(currentVersion);
  } catch (error) {
    return [];
  }
};

const deserializeUpdates = (updates: Update[]) => {
  return updates.map((u: any) => ({
    ...u,
    changes: ChangeSet.fromJSON(u.changes),
  }));
};

let plugin = ViewPlugin.fromClass(class {
    private pushing = false;
    private pendingRecieved = [];
    private disconnected = false;
    private connection: PeerConnection;

    constructor(private view: EditorView) {
      this.connection = view.state.facet(peerCollabConfig).connection;
      this.onConnected();
      this.onRecieved();
      this.onDisconnected();
    }

    onDisconnected() {
      this.connection.connection.on('disconnect', () => {
        this.disconnected = true;
      });
    }

    onConnected() {
      this.connection.onConnected(async () => {
        if (this.disconnected) {
          await this._getUpdates();
          this.disconnected = false;
          this._pushUpdate();
        }
      });
    }

    onRecieved() {
      this.connection.onUpdatesReceived((updates) => {
        if (this.pushing || this.disconnected) {
          this.pendingRecieved.push.apply(updates);
          return;
        }
        this.view.dispatch(
          receiveUpdates(
            this.view.state,
            deserializeUpdates([...this.pendingRecieved, ...updates])
          )
        );
        RecievedEvent.emit();
      });
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        this._debouncedPushUpdate();
      }
    }

    private _debouncedPushUpdate = debounce(this._pushUpdate, 200);

    private async _pushUpdate() {
      let updates = sendableUpdates(this.view.state);
      if (!updates.length || this.pushing || this.disconnected) return;
      this.pushing = true;
      let version = getSyncedVersion(this.view.state);
      pushUpdates(this.connection, version, updates);
      this.pushing = false;
      this.applyPendingUpdates();
      if (sendableUpdates(this.view.state).length) {
        this._debouncedPushUpdate();
      }
    }

    async _getUpdates() {
      let version = getSyncedVersion(this.view.state);
      const updates = await pullUpdates(this.connection, version);
      this.applyUpdates(updates);
    }

    applyUpdates(updates: Update[]) {
      this.view.dispatch(
        receiveUpdates(this.view.state, deserializeUpdates(updates))
      );
      RecievedEvent.emit();
    }

    applyPendingUpdates() {
      if (this.pendingRecieved.length) {
        this.applyUpdates(this.pendingRecieved);
        this.pendingRecieved.length = 0;
      }
    }

    destroy() {
      console.log('destroying!!');
      this.connection.disconnect();
    }
  }
);

export function peerExtension(
  startVersion: number,
  connection: PeerConnection,
  clientID: string,
  name: string,
  color: string
) {
  return [
    collab({ startVersion, clientID }),
    plugin,
    peerCollabConfig.of({ connection, name, color, clientID }),
  ];
}
