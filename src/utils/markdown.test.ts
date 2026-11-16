import { describe, expect, it } from 'vitest';
import {
  parseInlineMarkdown,
  parseMarkdownToTipTap,
  serializeInlineMarkdown,
  serializeTipTapToMarkdown,
} from './markdown';

describe('Markdown conversion utilities', () => {
  it('parses inline bold and italic marks accurately', () => {
    const raw = 'Normal **bold text** dan *italic text* serta ***bold and italic***';
    const parsed = parseInlineMarkdown(raw);

    expect(parsed[0]).toEqual({ type: 'text', text: 'Normal ' });
    expect(parsed[1]).toEqual({ type: 'text', text: 'bold text', marks: [{ type: 'bold' }] });
    expect(parsed[2]).toEqual({ type: 'text', text: ' dan ' });
    expect(parsed[3]).toEqual({ type: 'text', text: 'italic text', marks: [{ type: 'italic' }] });
    expect(parsed[4]).toEqual({ type: 'text', text: ' serta ' });
    expect(parsed[5]).toEqual({
      type: 'text',
      text: 'bold and italic',
      marks: [{ type: 'bold' }, { type: 'italic' }],
    });

    const serialized = serializeInlineMarkdown(parsed);
    expect(serialized).toBe(raw);
  });

  it('converts markdown with headings, bullets, and task checklists into valid TipTap doc', () => {
    const markdown = `# Catatan Proyek

Ini adalah paragraf pengantar.

## Rincian Fitur
- Poin satu
- Poin dua

### Checklist Tugas
- [x] Siapkan environment
- [ ] Implementasikan parser
`;

    const result = parseMarkdownToTipTap(markdown);
    expect(result.title).toBe('Catatan Proyek');
    expect(result.doc.type).toBe('doc');
    expect(result.doc.content?.[0].type).toBe('heading');
    expect(result.doc.content?.[0].attrs?.level).toBe(1);

    // Verify roundtrip serialization back to clean markdown
    const exportedMarkdown = serializeTipTapToMarkdown(result.doc);
    expect(exportedMarkdown).toContain('# Catatan Proyek');
    expect(exportedMarkdown).toContain('## Rincian Fitur');
    expect(exportedMarkdown).toContain('### Checklist Tugas');
    expect(exportedMarkdown).toContain('- Poin satu\n- Poin dua');
    expect(exportedMarkdown).toContain('- [x] Siapkan environment\n- [ ] Implementasikan parser');
  });

  it('automatically promotes the first line as H1 title if no markdown hash was provided', () => {
    const markdown = `Daftar Belanja Mingguan
- Susu oat
- Kopi arabika
`;
    const result = parseMarkdownToTipTap(markdown);
    expect(result.title).toBe('Daftar Belanja Mingguan');
    expect(result.doc.content?.[0]).toEqual({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Daftar Belanja Mingguan' }],
    });
  });

  it('handles completely empty markdown gracefully', () => {
    const result = parseMarkdownToTipTap('', 'Catatan Baru.md');
    expect(result.title).toBe('Catatan Baru.md');
    expect(result.doc.content?.[0].type).toBe('heading');
  });
});
