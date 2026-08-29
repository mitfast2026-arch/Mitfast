'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';
import {
  Bold,
  Heading2,
  Heading3,
  List,
  Pilcrow,
  Smile,
  Underline as UnderlineIcon,
} from 'lucide-react';
import './rich-text-editor.css';

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: { chain: () => any }) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }: { chain: () => any }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

const EMOJI_OPTIONS = ['✅', '⚙️', '🔩', '📐', '🏭', '⚡', '🔧', '📦', '✨', '⭐', '💡', '🛠️'];

const FONT_SIZES = [
  { label: 'Small', value: '12px' },
  { label: 'Normal', value: '14px' },
  { label: 'Large', value: '18px' },
  { label: 'XL', value: '22px' },
];

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
};

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rte-toolbar-btn ${active ? 'rte-toolbar-btn--active' : ''}`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Brief technical description for buyers…',
  disabled = false,
  readOnly = false,
  className = '',
}: RichTextEditorProps) {
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const isLocked = disabled || readOnly;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Underline,
      TextStyle,
      FontSize,
    ],
    content: value || '',
    editable: !isLocked,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
    editorProps: {
      attributes: {
        class: 'rte-content prose prose-invert max-w-none focus:outline-none',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const normalized = value || '';
    const normalizedCurrent = current === '<p></p>' ? '' : current;
    if (normalized !== normalizedCurrent) {
      editor.commands.setContent(normalized || '', { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isLocked);
  }, [editor, isLocked]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const setFontSize = useCallback(
    (size: string) => {
      if (!editor) return;
      (editor.chain().focus() as any).setFontSize(size).run();
    },
    [editor]
  );

  if (!editor) {
    return (
      <div className={`rte-editor rte-editor--loading ${className}`}>
        <div className="rte-toolbar" />
        <div className="rte-body rte-body--placeholder">Loading editor…</div>
      </div>
    );
  }

  return (
    <div className={`rte-editor ${isLocked ? 'rte-editor--disabled' : ''} ${className}`}>
      {!isLocked && (
        <div className="rte-toolbar">
          <ToolbarButton
            title="Bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Underline"
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 2"
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 3"
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Paragraph"
            active={editor.isActive('paragraph')}
            onClick={() => editor.chain().focus().setParagraph().run()}
          >
            <Pilcrow className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Bullet list"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="w-3.5 h-3.5" />
          </ToolbarButton>

          <select
            className="rte-font-size"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) setFontSize(e.target.value);
            }}
            title="Font size"
          >
            <option value="" disabled>
              Size
            </option>
            {FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <div className="relative" ref={emojiRef}>
            <ToolbarButton title="Insert emoji" onClick={() => setShowEmoji((v) => !v)}>
              <Smile className="w-3.5 h-3.5" />
            </ToolbarButton>
            {showEmoji && (
              <div className="rte-emoji-picker">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rte-emoji-btn"
                    onClick={() => {
                      editor.chain().focus().insertContent(emoji).run();
                      setShowEmoji(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rte-body">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
