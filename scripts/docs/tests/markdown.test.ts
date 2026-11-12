import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { firstParagraph, inlineSummary, markdownToPlainText, scanLines } from '../docs-util.ts';

describe('documentation Markdown handling', () => {
  it('extracts the first paragraph and plain text for summaries and search', () => {
    assert.equal(firstParagraph('First line\nsecond line.\n\nSecond paragraph.'), 'First line second line.');
    assert.equal(firstParagraph('```ts\ncode\n```\n\nAfter.'), 'After.');
    assert.equal(markdownToPlainText('A [link](x) with `code` and **bold**.'), 'A link with code and bold.');
    assert.equal(inlineSummary('See [`Foo`] and [text](url).'), 'See `Foo` and text.');
  });

  it('scanLines reports fence state per line', () => {
    const seen: string[] = [];

    scanLines('a\n```\nb\n```\nc', (line, state) => seen.push(`${line}:${state.inFence}`));

    assert.deepEqual(seen, ['a:false', '```:true', 'b:true', '```:true', 'c:false']);
  });
});
