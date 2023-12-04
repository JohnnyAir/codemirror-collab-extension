import { Update, rebaseUpdates } from '@codemirror/collab'
import { ChangeSet, Text } from '@codemirror/state'

export class DocumentService {
  private updates: Update[] = []
  private doc = Text.of(['//Codemirror Collaborative editor. \n'])

  getDoc() {
    return { version: this.updates.length, doc: this.doc.toString() }
  }

  getUpdates(version: number) {
    return this.updates.slice(version)
  }

  update(updateDocumentDto: any) {
    let received = updateDocumentDto.updates.map((json: any) => ({
      clientID: json.clientID,
      changes: ChangeSet.fromJSON(json.changes),
      effects: json.effects,
    }))

    if (updateDocumentDto.version !== this.updates.length) {
      const rebasedUpdates = rebaseUpdates(received, this.updates.slice(updateDocumentDto.version))
      this._applyRecievedUpdateToDocument(rebasedUpdates)
      return this._transformUpdatesToJson(rebasedUpdates)
    } else {
      this._applyRecievedUpdateToDocument(received)
      return this._transformUpdatesToJson(received)
    }
  }

  _transformUpdatesToJson(updates: readonly Update[]) {
    return updates.map((u) => ({ ...u, changes: u.changes.toJSON() }))
  }

  _applyRecievedUpdateToDocument(receivedUpdates: readonly Update[]) {
    for (let update of receivedUpdates) {
      this.updates.push(update)
      this.doc = update.changes.apply(this.doc)
    }
  }
}
