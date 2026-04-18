/**
 * AI suggestion highlighting extension for CodeMirror 6.
 *
 * Takes the Miku suggestion array (with startIndex / endIndex / type) and
 * renders them as coloured mark decorations. Clicking a mark dispatches
 * the active-suggestion event so the SuggestionPanel opens.
 */

import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import { Facet, RangeSet, Range } from '@codemirror/state';
import type { Suggestion, HighlightType } from '@/types';

// ─── Facets for external data ────────────────────────────────────────────────

export const suggestionsFacet = Facet.define<Suggestion[], Suggestion[]>({
  combine: (values) => values.flat(),
});

export const activeSuggestionIdFacet = Facet.define<
  string | null,
  string | null
>({
  combine: (values) => values[values.length - 1] ?? null,
});

export const onSuggestionClickFacet = Facet.define<
  (id: string) => void,
  (id: string) => void
>({
  combine: (values) => values[values.length - 1] ?? (() => {}),
});

// ─── Build decorations ──────────────────────────────────────────────────────

function classForType(type: HighlightType): string {
  return `cm-suggestion-${type}`;
}

function buildSuggestionDecos(view: EditorView): DecorationSet {
  const suggestions = view.state.facet(suggestionsFacet);
  const activeId = view.state.facet(activeSuggestionIdFacet);
  if (suggestions.length === 0) return Decoration.none;

  const decos: Range<Decoration>[] = [];
  const docLen = view.state.doc.length;

  for (const s of suggestions) {
    if (s.startIndex < 0 || s.endIndex > docLen || s.startIndex >= s.endIndex)
      continue;

    const classes = [classForType(s.type)];
    if (s.id === activeId) classes.push('cm-suggestion-active');

    decos.push(
      Decoration.mark({
        class: classes.join(' '),
        attributes: { 'data-suggestion-id': s.id },
      }).range(s.startIndex, s.endIndex),
    );
  }

  decos.sort((a, b) => a.from - b.from);

  try {
    return RangeSet.of(decos);
  } catch {
    return Decoration.none;
  }
}

// ─── ViewPlugin ──────────────────────────────────────────────────────────────

export const suggestionsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildSuggestionDecos(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.state.facet(suggestionsFacet) !==
          update.startState.facet(suggestionsFacet) ||
        update.state.facet(activeSuggestionIdFacet) !==
          update.startState.facet(activeSuggestionIdFacet)
      ) {
        this.decorations = buildSuggestionDecos(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      mousedown(event, view) {
        const target = event.target as HTMLElement;
        const mark = target.closest('[data-suggestion-id]') as HTMLElement | null;
        if (mark) {
          const id = mark.dataset.suggestionId;
          if (id) {
            event.preventDefault();
            const onClick = view.state.facet(onSuggestionClickFacet);
            onClick(id);
            return true;
          }
        }
        return false;
      },
    },
  },
);
