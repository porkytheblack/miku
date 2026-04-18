/**
 * Slash command autocomplete for CodeMirror 6.
 *
 * When the user types "/" at the start of a line, a completion popup
 * appears with formatting options (headings, lists, quotes, etc.).
 */

import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
  type Completion,
} from '@codemirror/autocomplete';

const SLASH_COMMANDS: {
  label: string;
  icon: string;
  prefix: string;
  detail: string;
}[] = [
  { label: 'Heading 1', icon: 'H1', prefix: '# ', detail: 'Large heading' },
  { label: 'Heading 2', icon: 'H2', prefix: '## ', detail: 'Medium heading' },
  { label: 'Heading 3', icon: 'H3', prefix: '### ', detail: 'Small heading' },
  { label: 'Bullet List', icon: '•', prefix: '- ', detail: 'Unordered list' },
  { label: 'Numbered List', icon: '1.', prefix: '1. ', detail: 'Ordered list' },
  { label: 'Quote', icon: '"', prefix: '> ', detail: 'Block quote' },
  { label: 'Code Block', icon: '<>', prefix: '```\n', detail: 'Fenced code' },
  { label: 'Divider', icon: '—', prefix: '---\n', detail: 'Horizontal rule' },
  { label: 'Image', icon: '🖼', prefix: '![](', detail: 'Embed image' },
];

function slashCompletions(
  context: CompletionContext,
): CompletionResult | null {
  // Only trigger when "/" is at the start of a line (or after only whitespace)
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = context.state.doc.sliceString(line.from, context.pos);
  const match = textBefore.match(/^(\s*)\/([\w]*)$/);
  if (!match) return null;

  const slashPos = line.from + match[1].length;
  const filter = match[2].toLowerCase();

  const options: Completion[] = SLASH_COMMANDS.filter(
    (cmd) =>
      !filter ||
      cmd.label.toLowerCase().includes(filter) ||
      cmd.icon.toLowerCase().includes(filter),
  ).map((cmd) => ({
    label: cmd.label,
    detail: cmd.detail,
    apply: (view, _completion, from, to) => {
      view.dispatch({
        changes: { from: slashPos, to, insert: cmd.prefix },
        selection: { anchor: slashPos + cmd.prefix.length },
      });
    },
  }));

  if (options.length === 0) return null;

  return {
    from: slashPos,
    to: context.pos,
    options,
    filter: false,
  };
}

export function slashCommandsExtension() {
  return autocompletion({
    override: [slashCompletions],
    activateOnTyping: true,
    icons: false,
  });
}
