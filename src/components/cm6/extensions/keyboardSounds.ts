/**
 * Keyboard sound extension for CodeMirror 6.
 * Plays click sounds on keydown for typing keys.
 */

import { EditorView } from '@codemirror/view';

export function keyboardSoundsExtension(
  playKeySound: (type: 'keydown' | 'keyup', code: string) => void,
) {
  return EditorView.domEventHandlers({
    keydown(event) {
      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        const key = event.key;
        if (key.length === 1 || key === 'Enter' || key === 'Backspace') {
          playKeySound('keydown', event.code);
        }
      }
      return false;
    },
  });
}
