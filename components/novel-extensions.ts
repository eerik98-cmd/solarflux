import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

const placeholder = Placeholder.configure({
  placeholder: ({ node }) => {
    if (node.type.name === 'heading') {
      return `Heading ${node.attrs.level}`;
    }
    return 'Start typing... (bold, italic, lists, etc.)';
  },
  includeChildren: true,
});

// Configure StarterKit to exclude extensions we're adding separately
export const defaultExtensions = [
  StarterKit.configure({
    // Disable built-in extensions that we're replacing with configured versions
    history: false, // We'll use the default history from StarterKit
  }),
  placeholder,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: 'text-blue-600 underline cursor-pointer',
    },
  }),
  Image.configure({
    inline: true,
    allowBase64: true,
    HTMLAttributes: {
      class: 'rounded-lg max-w-full h-auto',
    },
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  Underline,
  TextStyle,
  Color,
  FontFamily.configure({
    types: ['textStyle'],
  }),
  TaskList.configure({
    HTMLAttributes: {
      class: 'not-prose pl-2',
    },
  }),
  TaskItem.configure({
    HTMLAttributes: {
      class: 'flex gap-2 items-start my-4',
    },
    nested: true,
  }),
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
];

