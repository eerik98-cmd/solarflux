'use client';

import { Editor } from '@tiptap/react';
import { 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
  List, ListOrdered, Link as LinkIcon, Palette
} from 'lucide-react';

interface RichTextToolbarProps {
  editor: Editor | null;
  disabled?: boolean;
  dark?: boolean;
}

const FONT_FAMILIES = [
  { value: '', label: 'Sans Serif'},
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Tahoma', label: 'Tahoma' },
  { value: 'Comic Sans MS', label: 'Comic Sans MS' },
];

const HEADING_SIZES = [
  { value: 'paragraph', label: 'Normal text' },
  { value: 'heading1', label: 'Heading 1' },
  { value: 'heading2', label: 'Heading 2' },
  { value: 'heading3', label: 'Heading 3' },
];

const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
];

export default function RichTextToolbar({ editor, disabled = false, dark = false }: RichTextToolbarProps) {
  if (!editor) return null;

  const bgColor = dark ? 'bg-slate-700' : 'bg-gray-50';
  const selectBg = dark ? 'bg-slate-800' : 'bg-white';
  const selectBorder = dark ? 'border-slate-600' : 'border-gray-300';
  const selectText = dark ? 'text-white' : 'text-gray-900';
  const buttonText = dark ? 'text-slate-300' : 'text-gray-700';
  const buttonHover = dark ? 'hover:bg-slate-600' : 'hover:bg-gray-200';
  const buttonActive = dark ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600';
  const dividerColor = dark ? 'bg-slate-600' : 'bg-gray-300';
  const iconColor = dark ? 'text-slate-400' : 'text-gray-600';
  const textColor = dark ? 'text-slate-400' : 'text-gray-600';
  const summaryBg = dark ? 'bg-slate-800 border-slate-600 hover:bg-slate-700' : 'bg-white border-gray-300 hover:bg-gray-50';
  const summaryText = dark ? 'text-slate-300' : 'text-gray-700';
  const dropdownBg = dark ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300';

  const setFontFamily = (fontFamily: string) => {
    if (fontFamily) {
      editor.chain().focus().setFontFamily(fontFamily).run();
    } else {
      editor.chain().focus().unsetFontFamily().run();
    }
  };

  const setHeading = (level: string) => {
    if (level === 'paragraph') {
      editor.chain().focus().setParagraph().run();
    } else if (level === 'heading1') {
      editor.chain().focus().setHeading({ level: 1 }).run();
    } else if (level === 'heading2') {
      editor.chain().focus().setHeading({ level: 2 }).run();
    } else if (level === 'heading3') {
      editor.chain().focus().setHeading({ level: 3 }).run();
    }
  };

  const setTextColor = (color: string) => {
    editor.chain().focus().setColor(color).run();
  };

  const setLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
  };

  return (
    <div className={`border ${selectBorder} rounded-t-md ${bgColor} p-2 space-y-2`}>
      {/* Row 1: Font family, size, and basic formatting */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Font Family */}
        <select
          onChange={(e) => setFontFamily(e.target.value)}
          className={`px-2 py-1 border ${selectBorder} rounded ${selectBg} ${selectText} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
          disabled={disabled}
        >
          {FONT_FAMILIES.map(font => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        {/* Heading Size */}
        <select
          onChange={(e) => setHeading(e.target.value)}
          className={`px-2 py-1 border ${selectBorder} rounded ${selectBg} ${selectText} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
          disabled={disabled}
          value={
            editor.isActive('heading', { level: 1 }) ? 'heading1' :
            editor.isActive('heading', { level: 2 }) ? 'heading2' :
            editor.isActive('heading', { level: 3 }) ? 'heading3' :
            'paragraph'
          }
        >
          {HEADING_SIZES.map(size => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>

        <div className={`w-px h-6 ${dividerColor}`} />

        {/* Bold */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded ${buttonHover} transition-colors ${
            editor.isActive('bold') ? buttonActive : buttonText
          }`}
          disabled={disabled}
          title="Bold"
        >
          <Bold size={18} />
        </button>

        {/* Italic */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded ${buttonHover} transition-colors ${
            editor.isActive('italic') ? buttonActive : buttonText
          }`}
          disabled={disabled}
          title="Italic"
        >
          <Italic size={18} />
        </button>

        {/* Underline */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded ${buttonHover} transition-colors ${
            editor.isActive('underline') ? buttonActive : buttonText
          }`}
          disabled={disabled}
          title="Underline"
        >
          <Underline size={18} />
        </button>

        <div className={`w-px h-6 ${dividerColor}`} />

        {/* Align Left */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-2 rounded ${buttonHover} transition-colors ${
            editor.isActive({ textAlign: 'left' }) ? buttonActive : buttonText
          }`}
          disabled={disabled}
          title="Align Left"
        >
          <AlignLeft size={18} />
        </button>

        {/* Align Center */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-2 rounded ${buttonHover} transition-colors ${
            editor.isActive({ textAlign: 'center' }) ? buttonActive : buttonText
          }`}
          disabled={disabled}
          title="Align Center"
        >
          <AlignCenter size={18} />
        </button>

        {/* Align Right */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-2 rounded ${buttonHover} transition-colors ${
            editor.isActive({ textAlign: 'right' }) ? buttonActive : buttonText
          }`}
          disabled={disabled}
          title="Align Right"
        >
          <AlignRight size={18} />
        </button>

        <div className={`w-px h-6 ${dividerColor}`} />

        {/* Bullet List */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded ${buttonHover} transition-colors ${
            editor.isActive('bulletList') ? buttonActive : buttonText
          }`}
          disabled={disabled}
          title="Bullet List"
        >
          <List size={18} />
        </button>

        {/* Numbered List */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded ${buttonHover} transition-colors ${
            editor.isActive('orderedList') ? buttonActive : buttonText
          }`}
          disabled={disabled}
          title="Numbered List"
        >
          <ListOrdered size={18} />
        </button>

        <div className={`w-px h-6 ${dividerColor}`} />

        {/* Link */}
        <button
          type="button"
          onClick={editor.isActive('link') ? removeLink : setLink}
          className={`p-2 rounded ${buttonHover} transition-colors ${
            editor.isActive('link') ? buttonActive : buttonText
          }`}
          disabled={disabled}
          title={editor.isActive('link') ? 'Remove Link' : 'Insert Link'}
        >
          <LinkIcon size={18} />
        </button>
      </div>

      {/* Row 2: Color pickers */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1">
          <Palette size={16} className={iconColor} />
          <span className={`text-xs ${textColor}`}>Text Color:</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {TEXT_COLORS.slice(0, 10).map(color => (
            <button
              key={color}
              type="button"
              onClick={() => setTextColor(color)}
              className={`w-6 h-6 rounded border ${selectBorder} hover:scale-110 transition-transform`}
              style={{ backgroundColor: color }}
              disabled={disabled}
              title={color}
            />
          ))}
        </div>
        <details className="relative">
          <summary className={`px-2 py-1 text-xs ${summaryBg} border ${selectBorder} rounded cursor-pointer ${summaryText}`}>
            More colors
          </summary>
          <div className={`absolute z-10 mt-1 p-2 ${dropdownBg} border ${selectBorder} rounded shadow-lg`}>
            <div className="grid grid-cols-10 gap-1">
              {TEXT_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    setTextColor(color);
                    // Close the details element
                    const details = document.activeElement?.closest('details');
                    if (details) details.removeAttribute('open');
                  }}
                  className={`w-6 h-6 rounded border ${selectBorder} hover:scale-110 transition-transform`}
                  style={{ backgroundColor: color }}
                  disabled={disabled}
                  title={color}
                />
              ))}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
