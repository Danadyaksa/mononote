import type { JSONContent } from '@tiptap/react';
import type { HeadingItem } from '../types/note';

export function extractHeadingsFromDoc(doc: JSONContent | null | undefined): HeadingItem[] {
  if (!doc || !Array.isArray(doc.content)) {
    return [];
  }

  const headings: HeadingItem[] = [];
  let index = 0;

  const collectText = (node: JSONContent): string => {
    if (typeof node.text === 'string') return node.text;
    if (!node.content) return '';
    return node.content.map(collectText).join('');
  };

  const walk = (node: JSONContent) => {
    if (node.type === 'heading') {
      const rawLevel = Number(node.attrs?.level) || 1;
      const level = Math.min(Math.max(rawLevel, 1), 3);
      const rawText = collectText(node).trim();
      const text = rawText || `(Subjudul H${level})`;

      headings.push({
        id: `heading-${index}`,
        index,
        level,
        text,
      });
      index++;
      return;
    }

    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(walk);
    }
  };

  doc.content.forEach(walk);
  return headings;
}

export function extractHeadingsFromJson(jsonStr: string): HeadingItem[] {
  if (!jsonStr) return [];
  try {
    const doc = JSON.parse(jsonStr) as JSONContent;
    return extractHeadingsFromDoc(doc);
  } catch {
    return [];
  }
}
