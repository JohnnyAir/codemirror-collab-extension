import './style.css'
import { loadEditor } from './editor.ts'

const node = document.getElementById('editor')
if (node) loadEditor(node)
