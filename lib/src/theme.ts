import { EditorView } from '@codemirror/view'

export const baseSelectionStyles = EditorView.theme({
  '.cm-peer-user-cursor': {
    position: 'relative',
  },
  '.cm-peer-user-cursor-line': {
    position: 'absolute',
    top: '0',
    bottom: '0',
    left: '0',
    right: '0',
    borderLeft: '0.15em solid yellow',
  },
  '.cm-peer-user-cursor-line::after': {
    content: '""',
    backgroundColor: 'inherit',
    width: '0.25em',
    display: 'block',
    height: '0.2em',
    borderBottomRightRadius: '50%',
    borderTopRightRadius: '50%',
  },
  '.cm-peer-user-cursor-info': {
    position: 'absolute',
    top: '-1em',
    left: '0px',
    fontSize: '.8em',
    fontFamily: 'inherit',
    fontStyle: 'normal',
    fontWeight: 'normal',
    lineHeight: 'normal',
    userSelect: 'none',
    color: 'black',
    paddingLeft: '4px',
    paddingRight: '4px',
    zIndex: 101,
    borderRadius: '4px',
    borderBottomLeftRadius: '0px',
    transition: 'opacity 1.5s ease-out',
    backgroundColor: 'yellow',
    whiteSpace: 'nowrap',
    opacity: 0,
    transitionDelay: '0s',
  },
  '.cm-peer-user-cursor-info.show-info': {
    opacity: 1,
  },
  '.cm-peer-user-cursor:hover .cm-peer-user-cursor-info': {
    transition: 'opacity 1s ease-in',
    opacity: 1,
  },
})
