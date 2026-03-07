'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useDebouncedCallback } from 'use-debounce';
import { useEffect } from 'react';
import { defaultExtensions } from './novel-extensions';
import RichTextToolbar from './RichTextToolbar';

interface NovelEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  dark?: boolean;
  minHeight?: string;
  onEditorReady?: (editor: any) => void;
  showToolbar?: boolean;
}

export default function NovelEditor({
  content = '',
  onChange,
  placeholder = 'Start typing...',
  className = '',
  editable = true,
  dark = false,
  minHeight = '300px',
  onEditorReady,
  showToolbar = false,
}: NovelEditorProps) {
  
  const editor = useEditor({
    extensions: defaultExtensions,
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `prose prose-lg ${dark ? 'prose-invert' : ''} focus:outline-none max-w-full p-4 ${className}`,
        style: `min-height: ${minHeight};`,
      },
    },
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    onCreate: ({ editor }) => {
      onEditorReady?.(editor);
    },
  });

  // Update content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  const bgColor = dark ? 'bg-slate-800 text-white' : 'bg-white text-gray-900';
  const borderColor = dark ? 'border-slate-600' : 'border-gray-300';

  return (
    <div className={`relative w-full border ${borderColor} ${bgColor} rounded-md flex flex-col`}>
      {showToolbar && editable && (
        <RichTextToolbar editor={editor} disabled={!editable} dark={dark} />
      )}
      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
