import {
  Update,
  receiveUpdates,
  sendableUpdates,
  collab,
  getSyncedVersion,
} from '@codemirror/collab';
import { ChangeSet, Text } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { Socket } from 'socket.io-client';
import { PeerConnection } from './peerConnection';

type DebouncedFunction<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => void;

function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): DebouncedFunction<T> {
  let timeoutId: NodeJS.Timeout;

  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}



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

export function peerExtension(
  startVersion: number,
  connection: PeerConnection
) {
  let plugin = ViewPlugin.fromClass(
    class {
      private pushing = false;
      private pendingRecieved = [];
      private disconnected = false;

      constructor(private view: EditorView) {
        this.onConnected();
        this.onRecieved();
        this.onDisconnected();
      }

      onDisconnected() {
        connection.connection.on('disconnect', () => {
          this.disconnected = true;
        });
      }

      onConnected() {
        connection.onConnected(async () => {
          if (this.disconnected) {
            await this.getUpdates();
            this.push();
            this.disconnected = false;
          }
        });
      }

      onRecieved() {
        connection.onUpdatesReceived((updates) => {
          if (this.pushing || this.disconnected) {
            this.pendingRecieved.push.apply(updates);
          }
          this.view.dispatch(
            receiveUpdates(
              this.view.state,
              deserializeUpdates([...this.pendingRecieved, ...updates])
            )
          );
        });
      }

      update(update: ViewUpdate) {
        if (update.docChanged) this.push();
      }

      async push() {
        let updates = sendableUpdates(this.view.state);
        if (!updates.length || this.pushing || this.disconnected) return;
        this.pushing = true;
        let version = getSyncedVersion(this.view.state);
        pushUpdates(connection, version, updates);
        this.pushing = false;
        this.applyPendingUpdates();
        if (sendableUpdates(this.view.state).length) {
          this.debouncedPush();
        }
      }

      debouncedPush = debounce(this.push, 1500);

      async getUpdates() {
        let version = getSyncedVersion(this.view.state);
        const updates = await pullUpdates(connection, version);
        this.applyUpdates(updates);
      }

      applyUpdates(updates: Update[]) {
        this.view.dispatch(
          receiveUpdates(this.view.state, deserializeUpdates(updates))
        );
      }

      applyPendingUpdates() {
        if (this.pendingRecieved.length) {
          this.applyUpdates(this.pendingRecieved);
          this.pendingRecieved.length = 0;
        }
      }

      destroy() {
        console.log('destroying!!');
        connection.disconnect();
      }
    }
  );
  return [collab({ startVersion, clientID: connection.connection.id }), plugin];
}
