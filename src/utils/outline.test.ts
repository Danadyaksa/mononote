import { describe, expect, it } from 'vitest';
import { extractHeadingsFromDoc, extractHeadingsFromJson } from './outline';

describe('outline utility', () => {
  it('extracts H1, H2, and H3 headings in document order', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Judul Utama' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Paragraf pendahuluan...' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Subjudul Pertama' }],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Detail Tambahan' }],
        },
      ],
    };

    const headings = extractHeadingsFromDoc(doc);
    expect(headings).toHaveLength(3);
    expect(headings[0]).toEqual({
      id: 'heading-0',
      index: 0,
      level: 1,
      text: 'Judul Utama',
    });
    expect(headings[1]).toEqual({
      id: 'heading-1',
      index: 1,
      level: 2,
      text: 'Subjudul Pertama',
    });
    expect(headings[2]).toEqual({
      id: 'heading-2',
      index: 2,
      level: 3,
      text: 'Detail Tambahan',
    });
  });

  it('handles empty doc and malformed JSON safely', () => {
    expect(extractHeadingsFromDoc(null)).toEqual([]);
    expect(extractHeadingsFromJson('')).toEqual([]);
    expect(extractHeadingsFromJson('{ malformed json')).toEqual([]);
  });

  it('provides a fallback title for empty headings', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [],
        },
      ],
    };

    const headings = extractHeadingsFromDoc(doc);
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('(Subjudul H2)');
  });
});
