import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Document from '@tiptap/extension-document';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import type { Note } from '../types/note';
import { EMPTY_DOC_JSON } from '../api/notes';
import type { EditorFormatAction, EditorFormatState } from './Titlebar';

const TitleDocument = Document.extend({
  content: 'heading block*',
});

export interface NoteEditorHandle {
  runFormatAction: (action: EditorFormatAction) => void;
}

export interface NoteEditorProps {
  note: Note;
  saveStatus: 'saved' | 'saving' | 'error';
  onContentChange: (noteId: string, contentJson: string, plainText: string) => void;
  onFormatStateChange: (state: EditorFormatState) => void;
}

function parseDocSafely(contentJson: string): JSONContent {
  try {
    return JSON.parse(contentJson) as JSONContent;
  } catch {
    return JSON.parse(EMPTY_DOC_JSON) as JSONContent;
  }
}

export function serializeDocToPlainText(doc: JSONContent): string {
  const lines: string[] = [];

  const collectInlineText = (node: JSONContent): string => {
    if (typeof node.text === 'string') return node.text;
    if (!node.content) return '';
    return node.content.map(collectInlineText).join('');
  };

  const walkBlock = (node: JSONContent) => {
    if (node.type === 'heading' || node.type === 'paragraph') {
      lines.push(collectInlineText(node));
      return;
    }
    if (node.content) {
      node.content.forEach(walkBlock);
    }
  };

  doc.content?.forEach(walkBlock);
  return lines.join('\n').trimEnd();
}

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(
  { note, saveStatus, onContentChange, onFormatStateChange },
  ref
) {
  const activeNoteIdRef = useRef(note.id);
  const suppressUpdateRef = useRef(false);

  const emitFormatState = (currentEditor: Editor) => {
    onFormatStateChange({
      bold: currentEditor.isActive('bold'),
      italic: currentEditor.isActive('italic'),
      bulletList: currentEditor.isActive('bulletList'),
      taskList: currentEditor.isActive('taskList'),
    });
  };

  const editor = useEditor({
    extensions: [
      TitleDocument,
      StarterKit.configure({
        document: false,
        heading: { levels: [1] },
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: false,
      }),
      Placeholder.configure({
        includeChildren: true,
        placeholder: ({ node }) =>
          node.type.name === 'heading' ? 'Judul catatan...' : 'Mulai menulis...',
      }),
    ],
    content: parseDocSafely(note.contentJson),
    editorProps: {
      attributes: {
        class: 'tiptap-surface',
        spellcheck: 'false',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (suppressUpdateRef.current) return;
      const json = currentEditor.getJSON();
      const plainText = serializeDocToPlainText(json);
      onContentChange(activeNoteIdRef.current, JSON.stringify(json), plainText);
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      emitFormatState(currentEditor);
    },
    onTransaction: ({ editor: currentEditor }) => {
      emitFormatState(currentEditor);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (activeNoteIdRef.current !== note.id) {
      activeNoteIdRef.current = note.id;
      suppressUpdateRef.current = true;
      editor.commands.setContent(parseDocSafely(note.contentJson), false);
      suppressUpdateRef.current = false;
    }
  }, [editor, note.id, note.contentJson]);

  useImperativeHandle(
    ref,
    () => ({
      runFormatAction: (action: EditorFormatAction) => {
        if (!editor) return;
        const chain = editor.chain().focus();
        switch (action) {
          case 'bold':
            chain.toggleBold().run();
            break;
          case 'italic':
            chain.toggleItalic().run();
            break;
          case 'bulletList':
            if (editor.isActive('heading')) {
              editor.chain().focus().insertContentAt(editor.state.selection.to, { type: 'paragraph' }).run();
              editor.chain().focus().toggleBulletList().run();
            } else {
              chain.toggleBulletList().run();
            }
            break;
          case 'taskList':
            if (editor.isActive('heading')) {
              editor.chain().focus().insertContentAt(editor.state.selection.to, { type: 'paragraph' }).run();
              editor.chain().focus().toggleTaskList().run();
            } else {
              chain.toggleTaskList().run();
            }
            break;
        }
      },
    }),
    [editor]
  );

  const statusLabel =
    saveStatus === 'saving'
      ? 'Menyimpan…'
      : saveStatus === 'error'
        ? 'Gagal menyimpan — coba ketik ulang'
        : '';

  return (
    <main className="editor-pane">
      <div className="editor-scroll">
        <div className="editor-column">
          <EditorContent editor={editor} />
        </div>
      </div>
      {statusLabel && (
        <div className={`editor-status ${saveStatus === 'error' ? 'is-error' : ''}`}>
          {statusLabel}
        </div>
      )}
    </main>
  );
});
