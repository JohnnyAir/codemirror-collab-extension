import { EditorView } from '@codemirror/view';

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
    borderLeft: '1px solid yellow',
  },
  '.cm-peer-user-cursor-line::after': {
    content: '""',
    background: 'yellow',
    width: '0.25em',
    display: 'block',
    height: '0.2em',
    borderBottomRightRadius: '50%',
    borderTopRightRadius: '50%',
  },
  // '.blink.cm-peer-user-cursor-line': {
  //   animation: 'steps(1) cm-blink 1.2s infinite',
  // },
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
    transition: 'opacity 3s ease-in-out',
    backgroundColor: 'yellow',
    whiteSpace: 'nowrap',
  },
});

export const aplha = (hexColor: string, alpha: number) => {
  alpha = Math.max(0, Math.min(1, alpha));
  hexColor = hexColor.replace(/^#/, '');
  const bigint = parseInt(hexColor, 16);
  const red = (bigint >> 16) & 255;
  const green = (bigint >> 8) & 255;
  const blue = bigint & 255;
  const rgbaColor = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  return rgbaColor;
};
