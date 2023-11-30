import { EditorSelection, SelectionRange } from '@codemirror/state';

export type PeerSelectionRangeJSON = {
  main: number;
  ranges: Pick<SelectionRange, 'anchor' | 'head'>[];
};

export type PeerEditorSelectionJSON = {
  clientID: string;
  version: number;
  user: { name: string; color: string };
  selection: PeerSelectionRangeJSON | null;
};

export type PeerEditorSelection = {
  clientID: string;
  version: number;
  user: { name: string; color: string };
  selection: EditorSelection;
};

export type PeerSelectionRange = {
  clientID: string;
  user: { name: string; color: string };
  range: SelectionRange;
};
