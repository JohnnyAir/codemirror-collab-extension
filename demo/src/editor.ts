import { basicSetup } from 'codemirror'
import { EditorState, Text } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { createPeerConnection } from './connection'
import { javascript } from '@codemirror/lang-javascript'
import { peerExtension } from '@joncodes/codemirror-collab-extension'
import { nightOwl } from 'code-mirror-night-owl'
import tinycolor from 'tinycolor2'

const generateClientID = () => Math.floor(Math.random() * 1e9).toString(36)

const clientID = generateClientID()
const connection = createPeerConnection(clientID)

connection.onConnected(() => notifyEditorConnectionState('connected'))
connection.onDisconnected(() => notifyEditorConnectionState('disconnected'))

const getDocument = async (): Promise<{ version: number; doc: Text } | null> => {
  try {
    const data = await connection.socket.timeout(2000).emitWithAck('getDocument')
    return {
      version: data.version,
      doc: Text.of(data.doc.split('\n')),
    }
  } catch (error: any) {
    notifyError(error.message || 'Failed To fetch document')
    return null
  }
}

const notifyError = (errMessage: string) => {
  const errorElem = document.getElementById('error')
  if (errorElem) {
    errorElem.textContent = errMessage
    errorElem.classList.add('show')
  }
}

const editorStyles = EditorView.theme({ '&': { height: '100%' } })

const disableSpellCheck = EditorView.contentAttributes.of({
  'data-spellcheck': 'false',
  'data-enable-grammarly': 'false',
  'data-gramm_editor': 'false',
  'data-gramm': 'false',
})

const createEditorState = async () => {
  const editorDocument = await getDocument()
  if (!editorDocument) return
  const { version, doc } = editorDocument

  const color = tinycolor.random()

  const collab = {
    docStartVersion: version,
    pushUpdateDelayMs: 100,
  }

  const selection = {
    user: {
      name: 'User:' + clientID,
      color: color.isLight() ? 'black' : 'white',
      bgColor: `#${color.toHex()}`,
    },
  }

  return EditorState.create({
    doc: doc,
    extensions: [
      basicSetup,
      editorStyles,
      disableSpellCheck,
      nightOwl,
      javascript({ typescript: true }),
      peerExtension({ connection, clientID, collab, selection }),
    ],
  })
}

export const loadEditor = async (parent: Element) => {
  const state = await createEditorState()
  new EditorView({ state, parent })
  notifyClientId(clientID)
  notifyEditorConnectionState('connected')
  registerConnectionToggleListener()
}

const notifyClientId = (id: string) => {
  let el = document.getElementById('clientId')
  if (el) el.textContent = id
}

const notifyEditorConnectionState = (state: 'connected' | 'pending' | 'disconnected') => {
  const stateElem = document.querySelector('.connection-state')
  if (!stateElem) return
  switch (state) {
    case 'connected': {
      stateElem.textContent = 'connected'
      stateElem.setAttribute('data-connect', 'true')
      break
    }
    case 'disconnected': {
      stateElem.textContent = 'not connected'
      stateElem.setAttribute('data-connect', 'false')
      break
    }
    case 'pending': {
      stateElem.textContent = 'not connected'
      stateElem.setAttribute('data-connect', 'pending')
      break
    }
    default:
      throw new Error('Invalid state')
  }
}

const connectionToggleHandler = (event: Event) => {
  const btn = event.target as HTMLElement

  if (connection.socket.connected) {
    connection.socket.disconnect()
    btn.textContent = 'Reconnect'
  } else {
    connection.connect()
    btn.textContent = 'Disconnect'
    notifyEditorConnectionState('pending')
  }
}

export const registerConnectionToggleListener = () => {
  const btn = document.getElementById('toggle-connection')
  btn?.addEventListener('click', connectionToggleHandler)
}
