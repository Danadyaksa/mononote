import type { JSONContent } from '@tiptap/react';

interface InlineTextNode {
  type: 'text';
  text: string;
  marks?: Array<{ type: 'bold' | 'italic' }>;
}

/**
 * Parses inline markdown marks (bold, italic, bold+italic) into TipTap text nodes.
 */
export function parseInlineMarkdown(rawText: string): InlineTextNode[] {
  if (!rawText) return [];

  const nodes: InlineTextNode[] = [];
  // Tokenize ***bold italic***, **bold**, *italic*, __bold__, _italic_
  const tokenRegex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|___(.+?)___|__(.+?)__|_(.+?)_)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(rawText)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      nodes.push({
        type: 'text',
        text: rawText.slice(lastIndex, matchIndex),
      });
    }

    const fullMatch = match[0];
    let contentText = '';
    const marks: Array<{ type: 'bold' | 'italic' }> = [];

    if (fullMatch.startsWith('***') && fullMatch.endsWith('***')) {
      contentText = match[2];
      marks.push({ type: 'bold' }, { type: 'italic' });
    } else if (fullMatch.startsWith('___') && fullMatch.endsWith('___')) {
      contentText = match[5];
      marks.push({ type: 'bold' }, { type: 'italic' });
    } else if (fullMatch.startsWith('**') && fullMatch.endsWith('**')) {
      contentText = match[3];
      marks.push({ type: 'bold' });
    } else if (fullMatch.startsWith('__') && fullMatch.endsWith('__')) {
      contentText = match[6];
      marks.push({ type: 'bold' });
    } else if (fullMatch.startsWith('*') && fullMatch.endsWith('*')) {
      contentText = match[4];
      marks.push({ type: 'italic' });
    } else if (fullMatch.startsWith('_') && fullMatch.endsWith('_')) {
      contentText = match[7];
      marks.push({ type: 'italic' });
    }

    if (contentText) {
      nodes.push({
        type: 'text',
        text: contentText,
        marks,
      });
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < rawText.length) {
    nodes.push({
      type: 'text',
      text: rawText.slice(lastIndex),
    });
  }

  return nodes;
}

/**
 * Serializes TipTap inline text nodes back to markdown syntax.
 */
export function serializeInlineMarkdown(nodes?: JSONContent[]): string {
  if (!nodes || nodes.length === 0) return '';
  return nodes
    .map((node) => {
      if (node.type !== 'text' || !node.text) return '';
      const isBold = node.marks?.some((m) => m.type === 'bold');
      const isItalic = node.marks?.some((m) => m.type === 'italic');
      let text = node.text;

      if (isBold && isItalic) {
        text = `***${text}***`;
      } else if (isBold) {
        text = `**${text}**`;
      } else if (isItalic) {
        text = `*${text}*`;
      }
      return text;
    })
    .join('');
}

export interface ParsedMarkdownResult {
  doc: JSONContent;
  contentJson: string;
  title: string;
  preview: string;
  plainText: string;
}

/**
 * Converts a markdown string into a valid Mononote TipTap document.
 * Follows Mononote's rule: First block must be a Heading 1 (Title).
 */
export function parseMarkdownToTipTap(
  markdown: string,
  fallbackTitle: string = 'Catatan Markdown'
): ParsedMarkdownResult {
  const normalized = markdown.replace(/\r\n/g, '\n').trim();
  const rawLines = normalized ? normalized.split('\n') : [];

  const blocks: JSONContent[] = [];
  let firstHeadingEncountered = false;
  let extractedTitle = '';
  let extractedPreview = '';

  let currentListType: 'bullet' | 'task' | null = null;
  let currentListItems: JSONContent[] = [];

  const flushList = () => {
    if (!currentListType || currentListItems.length === 0) {
      currentListType = null;
      currentListItems = [];
      return;
    }

    if (currentListType === 'bullet') {
      blocks.push({
        type: 'bulletList',
        content: currentListItems,
      });
    } else if (currentListType === 'task') {
      blocks.push({
        type: 'taskList',
        content: currentListItems,
      });
    }

    currentListType = null;
    currentListItems = [];
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Empty line breaks active list
    if (!trimmed) {
      flushList();
      continue;
    }

    // Heading: # H1, ## H2, ### H3, #### H4
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = Math.min(headingMatch[1].length, 3); // Support levels 1, 2, 3
      const text = headingMatch[2].trim();

      if (!firstHeadingEncountered) {
        firstHeadingEncountered = true;
        extractedTitle = text;
        blocks.push({
          type: 'heading',
          attrs: { level: 1 },
          content: parseInlineMarkdown(text),
        });
      } else {
        blocks.push({
          type: 'heading',
          attrs: { level },
          content: parseInlineMarkdown(text),
        });
      }
      continue;
    }

    // Task item: - [ ] or - [x] or * [ ] or * [x]
    const taskMatch = trimmed.match(/^[-*+]\s+\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      const isChecked = taskMatch[1].toLowerCase() === 'x';
      const text = taskMatch[2].trim();

      if (currentListType !== 'task') {
        flushList();
        currentListType = 'task';
      }

      currentListItems.push({
        type: 'taskItem',
        attrs: { checked: isChecked },
        content: [
          {
            type: 'paragraph',
            content: parseInlineMarkdown(text),
          },
        ],
      });
      continue;
    }

    // Bullet item: - or * or +
    const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      const text = bulletMatch[1].trim();

      if (currentListType !== 'bullet') {
        flushList();
        currentListType = 'bullet';
      }

      currentListItems.push({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: parseInlineMarkdown(text),
          },
        ],
      });
      continue;
    }

    // Standard paragraph line
    flushList();
    if (!firstHeadingEncountered) {
      // First non-heading line becomes the title (per Apple Notes / Mononote paradigm)
      firstHeadingEncountered = true;
      extractedTitle = trimmed;
      blocks.push({
        type: 'heading',
        attrs: { level: 1 },
        content: parseInlineMarkdown(trimmed),
      });
    } else {
      if (!extractedPreview) {
        extractedPreview = trimmed;
      }
      blocks.push({
        type: 'paragraph',
        content: parseInlineMarkdown(trimmed),
      });
    }
  }

  flushList();

  // If no blocks were created (empty file), ensure TitleDocument schema requirement
  if (blocks.length === 0) {
    extractedTitle = fallbackTitle;
    blocks.push({
      type: 'heading',
      attrs: { level: 1 },
      content: parseInlineMarkdown(fallbackTitle),
    });
    blocks.push({
      type: 'paragraph',
    });
  } else if (blocks[0]?.type !== 'heading') {
    // Safety guard: prepend title if somehow first block isn't heading
    extractedTitle = fallbackTitle;
    blocks.unshift({
      type: 'heading',
      attrs: { level: 1 },
      content: parseInlineMarkdown(fallbackTitle),
    });
  }

  if (!extractedTitle) {
    extractedTitle = fallbackTitle;
  }
  if (!extractedPreview && blocks.length > 1) {
    // Grab preview from second block if available
    const second = blocks[1];
    if (second.type === 'paragraph' && second.content) {
      extractedPreview = serializeInlineMarkdown(second.content);
    }
  }

  const doc: JSONContent = {
    type: 'doc',
    content: blocks,
  };

  // Plain text representation
  const plainLines: string[] = [];
  const collectPlainText = (node: JSONContent) => {
    if (typeof node.text === 'string') plainLines.push(node.text);
    if (node.content) node.content.forEach(collectPlainText);
  };
  doc.content?.forEach((block) => {
    const sub: string[] = [];
    const walk = (n: JSONContent) => {
      if (typeof n.text === 'string') sub.push(n.text);
      if (n.content) n.content.forEach(walk);
    };
    walk(block);
    plainLines.push(sub.join(''));
  });

  return {
    doc,
    contentJson: JSON.stringify(doc),
    title: extractedTitle,
    preview: extractedPreview || 'Belum ada teks tambahan',
    plainText: plainLines.filter(Boolean).join('\n'),
  };
}

/**
 * Converts a Mononote TipTap document back into clean, standard Markdown.
 */
export function serializeTipTapToMarkdown(doc: JSONContent): string {
  if (!doc.content || doc.content.length === 0) return '';
  const sections: string[] = [];

  for (const block of doc.content) {
    if (block.type === 'heading') {
      const level = Math.max(1, Math.min(block.attrs?.level || 1, 6));
      const prefix = '#'.repeat(level);
      const text = serializeInlineMarkdown(block.content);
      sections.push(`${prefix} ${text}`.trimEnd());
    } else if (block.type === 'paragraph') {
      const text = serializeInlineMarkdown(block.content);
      sections.push(text);
    } else if (block.type === 'bulletList') {
      if (block.content && block.content.length > 0) {
        const items = block.content.map((item) => {
          const p = item.content?.[0];
          const text = p ? serializeInlineMarkdown(p.content) : '';
          return `- ${text}`.trimEnd();
        });
        sections.push(items.join('\n'));
      }
    } else if (block.type === 'taskList') {
      if (block.content && block.content.length > 0) {
        const items = block.content.map((item) => {
          const checked = !!item.attrs?.checked;
          const p = item.content?.[0];
          const text = p ? serializeInlineMarkdown(p.content) : '';
          return `- [${checked ? 'x' : ' '}] ${text}`.trimEnd();
        });
        sections.push(items.join('\n'));
      }
    }
  }

  return sections.join('\n\n').trimEnd() + '\n';
}
