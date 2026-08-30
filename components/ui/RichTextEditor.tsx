'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CharacterCount from '@tiptap/extension-character-count';
import { Extension } from '@tiptap/core';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Indent,
  Outdent,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Quote,
  Minus,
  Link as LinkIcon,
  Unlink,
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
  Undo,
  Redo,
  RemoveFormatting,
  Smile,
  Loader2,
  UploadCloud,
  Check,
  X,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { isEmptyRichText } from '@/lib/html/sanitize-rich-text.server';
import './rich-text-editor.css';

// ── Custom FontSize TipTap Extension ──────────────────────────────
export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
      defaultSize: '14px',
      sizes: ['12px', '14px', '16px', '18px', '22px'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => {
              const style = element.style.fontSize;
              if (!style) return null;
              return style;
            },
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return {
                style: `font-size: ${attributes.fontSize}`,
                'data-font-size': attributes.fontSize,
              };
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
        ({ chain }: { chain: () => any }) => {
          return chain().setMark('textStyle', { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }: { chain: () => any }) => {
          return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
        },
      increaseFontSize:
        () =>
        ({ chain, editor }: { chain: () => any; editor: any }) => {
          const current = editor.getAttributes('textStyle').fontSize || '14px';
          const sizes = ['12px', '14px', '16px', '18px', '22px'];
          const currentIndex = sizes.indexOf(current);
          const nextSize = currentIndex >= 0 && currentIndex < sizes.length - 1 ? sizes[currentIndex + 1] : sizes[sizes.length - 1];
          return chain().setMark('textStyle', { fontSize: nextSize }).run();
        },
      decreaseFontSize:
        () =>
        ({ chain, editor }: { chain: () => any; editor: any }) => {
          const current = editor.getAttributes('textStyle').fontSize || '14px';
          const sizes = ['12px', '14px', '16px', '18px', '22px'];
          const currentIndex = sizes.indexOf(current);
          const prevSize = currentIndex > 0 ? sizes[currentIndex - 1] : sizes[0];
          return chain().setMark('textStyle', { fontSize: prevSize }).run();
        },
    };
  },
});

const FONT_SIZES = [
  { label: 'Small (12px)', value: '12px' },
  { label: 'Normal (14px)', value: '14px' },
  { label: 'Medium (16px)', value: '16px' },
  { label: 'Large (18px)', value: '18px' },
  { label: 'X-Large (22px)', value: '22px' },
];

const ListTabExtension = Extension.create({
  name: 'listTab',
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.sinkListItem('listItem'),
      'Shift-Tab': () => this.editor.commands.liftListItem('listItem'),
    };
  },
});

const EMOJI_OPTIONS = [
  '✅', '⚙️', '🔩', '📐', '🏭', '⚡', '🔧', '📦', '✨', '⭐', '💡', '🛠️', '🔒', '🛡️', '📏', '🎯',
  '✓', '★', '🏷️', '🔹', '▪', '✦', '▲', '●', '®', '™', '©', '°', '±', 'µ', 'Ø', '×', '÷', '≤', '≥', '≠', '≈', '∞'
];

const AI_OPTIONS = [
  { id: 'polish', label: 'Improve & Polish Tone', desc: 'Refine clarity and professional B2B flow' },
  { id: 'structure_specs', label: 'Structure as Specs & Features', desc: 'Format into Features, Specs table & Applications' },
  { id: 'fix_grammar', label: 'Fix Grammar & Spelling', desc: 'Correct typos and punctuation' },
  { id: 'shorten', label: 'Make Concise & Scannable', desc: 'Condense into high-impact bullet points' },
  { id: 'expand', label: 'Expand Technical Details', desc: 'Add industrial depth and applications' },
];

export type RichTextEditorProps = {
  value?: string | null;
  onChange: (html: string) => void;
  productName?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  minHeight?: string | number;
  maxCharacters?: number;
};

function ToolbarButton({
  active = false,
  disabled = false,
  onClick,
  title,
  ariaLabel,
  children,
  className = '',
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel || title}
      disabled={disabled}
      onMouseDown={(e) => {
        // Prevent button click from stealing focus from editor selection
        e.preventDefault();
      }}
      onClick={onClick}
      className={`rte-toolbar-btn ${active ? 'rte-toolbar-btn--active' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value = '',
  onChange,
  productName = '',
  placeholder = 'Describe the product, key features, specifications, applications, benefits, and included items…',
  disabled = false,
  readOnly = false,
  className = '',
  minHeight = '180px',
  maxCharacters = 20000,
}: RichTextEditorProps) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [activeHeading, setActiveHeading] = useState<'p' | 'h1' | 'h2' | 'h3'>('p');
  const [activeFontSize, setActiveFontSize] = useState('14px');

  const emojiRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<HTMLDivElement>(null);
  const linkModalRef = useRef<HTMLDivElement>(null);
  const imageModalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInternalUpdateRef = useRef(false);

  const isLocked = disabled || readOnly;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          HTMLAttributes: { class: 'rte-bullet-list' },
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          HTMLAttributes: { class: 'rte-ordered-list' },
          keepMarks: true,
          keepAttributes: false,
        },
        blockquote: {
          HTMLAttributes: { class: 'rte-blockquote' },
        },
        horizontalRule: {
          HTMLAttributes: { class: 'rte-hr' },
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Underline,
      TextStyle,
      FontSize,
      ListTabExtension,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left',
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'rte-link',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          loading: 'lazy',
          class: 'rte-img',
        },
      }),
      CharacterCount.configure({
        limit: maxCharacters,
      }),
    ],
    content: value || '',
    editable: !isLocked,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      isInternalUpdateRef.current = true;
      const html = ed.getHTML();
      if (isEmptyRichText(html)) {
        onChange('');
      } else {
        onChange(html);
      }
      setTimeout(() => {
        isInternalUpdateRef.current = false;
      }, 0);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      if (ed.isActive('heading', { level: 1 })) setActiveHeading('h1');
      else if (ed.isActive('heading', { level: 2 })) setActiveHeading('h2');
      else if (ed.isActive('heading', { level: 3 })) setActiveHeading('h3');
      else setActiveHeading('p');

      const size = ed.getAttributes('textStyle').fontSize || '14px';
      setActiveFontSize(size);
    },
    editorProps: {
      attributes: {
        class: 'rte-content prose prose-invert max-w-none focus:outline-none',
        style: `min-height: ${typeof minHeight === 'number' ? `${minHeight}px` : minHeight}`,
      },
    },
  });

  // Synchronize incoming value changes safely (without clobbering active cursor)
  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdateRef.current) return;

    const currentHtml = editor.getHTML();
    const incoming = value || '';

    const currentIsEmpty = isEmptyRichText(currentHtml);
    const incomingIsEmpty = isEmptyRichText(incoming);

    if (currentIsEmpty && incomingIsEmpty) return;

    if (currentHtml !== incoming) {
      editor.commands.setContent(incoming || '', { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isLocked);
  }, [editor, isLocked]);

  // Handle outside click popovers
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (emojiRef.current && !emojiRef.current.contains(target)) {
        setShowEmoji(false);
      }
      if (aiRef.current && !aiRef.current.contains(target)) {
        setShowAiMenu(false);
      }
      if (linkModalRef.current && !linkModalRef.current.contains(target)) {
        setShowLinkModal(false);
      }
      if (imageModalRef.current && !imageModalRef.current.contains(target)) {
        setShowImageModal(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openLinkModal = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href || '';
    setLinkUrl(previousUrl);
    setShowLinkModal(true);
  }, [editor]);

  const saveLink = useCallback(() => {
    if (!editor) return;
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setShowLinkModal(false);
      return;
    }

    let formattedUrl = trimmed;
    if (!/^https?:\/\//i.test(formattedUrl) && !/^mailto:/i.test(formattedUrl) && !/^tel:/i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: formattedUrl, target: '_blank' })
      .run();
    setShowLinkModal(false);
    toast.success('Link added');
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
    setShowLinkModal(false);
    toast.success('Link removed');
  }, [editor]);

  const handleImageFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;

      setImageUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/products/description-image', {
          method: 'POST',
          body: formData,
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'Failed to upload image');
        }

        const url = json.data.url;
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
        setShowImageModal(false);
        setImageUrl('');
        toast.success('Image inserted into description');
      } catch (err: any) {
        toast.error(err?.message || 'Image upload failed');
      } finally {
        setImageUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [editor]
  );

  const insertImageUrl = useCallback(() => {
    if (!editor || !imageUrl.trim()) return;
    const url = imageUrl.trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
      toast.error('Please enter a valid HTTP or HTTPS image URL');
      return;
    }
    editor.chain().focus().setImage({ src: url }).run();
    setShowImageModal(false);
    setImageUrl('');
    toast.success('Image inserted');
  }, [editor, imageUrl]);

  const handleAiRefine = useCallback(
    async (action: string) => {
      if (!editor) return;
      const currentHtml = editor.getHTML();
      if (isEmptyRichText(currentHtml)) {
        toast.error('Enter some description content first to refine with AI');
        return;
      }

      setAiLoading(true);
      setShowAiMenu(false);
      const loadingToastId = toast.loading('Refining product description with Groq AI…');

      try {
        const res = await fetch('/api/ai/refine-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: currentHtml,
            productName,
            action,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'AI refinement failed');
        }

        const refined = json.data.refinedHtml;
        editor.commands.setContent(refined, { emitUpdate: true });
        toast.success('Description refined successfully with AI!', { id: loadingToastId });
      } catch (err: any) {
        toast.error(err?.message || 'Failed to refine description', { id: loadingToastId });
      } finally {
        setAiLoading(false);
      }
    },
    [editor, productName]
  );

  if (!editor) {
    return (
      <div className={`rte-editor rte-editor--loading ${className}`}>
        <div className="rte-toolbar flex items-center gap-2 p-2.5">
          <Loader2 className="w-4 h-4 animate-spin text-accent-primary" />
          <span className="text-xs text-muted-foreground">Loading description editor…</span>
        </div>
        <div className="rte-body rte-body--placeholder p-4">Loading editor…</div>
      </div>
    );
  }

  const charCount = editor.storage.characterCount?.characters() ?? 0;
  const wordCount = editor.storage.characterCount?.words() ?? 0;

  return (
    <div className={`rte-editor ${isLocked ? 'rte-editor--disabled' : ''} ${className}`}>
      {!isLocked && (
        <div className="rte-toolbar" role="toolbar" aria-label="Text formatting toolbar">
          {/* History Group */}
          <div className="rte-toolbar-group">
            <ToolbarButton
              title="Undo (Ctrl+Z)"
              disabled={!editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
              disabled={!editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo className="w-3.5 h-3.5" />
            </ToolbarButton>
          </div>

          <div className="rte-divider" />

          {/* Heading / Style Selector */}
          <div className="rte-toolbar-group">
            <select
              className="rte-select rte-select--heading"
              value={activeHeading}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
                else if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
                else if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
                else editor.chain().focus().setParagraph().run();
              }}
              title="Text structure"
            >
              <option value="p">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
            </select>

            <select
              className="rte-select rte-select--fontsize"
              value={activeFontSize}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  (editor.chain().focus() as any).setFontSize(val).run();
                }
              }}
              title="Font size"
            >
              {FONT_SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rte-divider" />

          {/* Inline Text Marks */}
          <div className="rte-toolbar-group">
            <ToolbarButton
              title="Bold (Ctrl+B)"
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Italic (Ctrl+I)"
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Underline (Ctrl+U)"
              active={editor.isActive('underline')}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Strikethrough (Ctrl+Shift+X)"
              active={editor.isActive('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Clear formatting"
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            >
              <RemoveFormatting className="w-3.5 h-3.5" />
            </ToolbarButton>
          </div>

          <div className="rte-divider" />

          {/* Text Alignment */}
          <div className="rte-toolbar-group">
            <ToolbarButton
              title="Align left"
              active={editor.isActive({ textAlign: 'left' })}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Align center"
              active={editor.isActive({ textAlign: 'center' })}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Align right"
              active={editor.isActive({ textAlign: 'right' })}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
            >
              <AlignRight className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Justify"
              active={editor.isActive({ textAlign: 'justify' })}
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </ToolbarButton>
          </div>

          <div className="rte-divider" />

          {/* Lists & Indentation */}
          <div className="rte-toolbar-group">
            <ToolbarButton
              title="Bullet list"
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Numbered list"
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Indent list item (Tab)"
              disabled={!editor.can().sinkListItem('listItem')}
              onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
            >
              <Indent className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Outdent list item (Shift+Tab)"
              disabled={!editor.can().liftListItem('listItem')}
              onClick={() => editor.chain().focus().liftListItem('listItem').run()}
            >
              <Outdent className="w-3.5 h-3.5" />
            </ToolbarButton>
          </div>

          <div className="rte-divider" />

          {/* Blocks & Separators */}
          <div className="rte-toolbar-group">
            <ToolbarButton
              title="Blockquote"
              active={editor.isActive('blockquote')}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Horizontal divider"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
            >
              <Minus className="w-3.5 h-3.5" />
            </ToolbarButton>
          </div>

          <div className="rte-divider" />

          {/* Links & Media */}
          <div className="rte-toolbar-group relative">
            <ToolbarButton
              title="Insert or edit link"
              active={editor.isActive('link')}
              onClick={openLinkModal}
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </ToolbarButton>

            {showLinkModal && (
              <div className="rte-popover rte-link-popover" ref={linkModalRef}>
                <div className="rte-popover-title">Insert / Edit Link</div>
                <div className="flex gap-1.5 mt-2">
                  <input
                    type="url"
                    className="rte-input flex-1"
                    placeholder="https://example.com/spec-sheet.pdf"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveLink();
                      }
                    }}
                    autoFocus
                  />
                  <button type="button" className="rte-btn-action rte-btn-action--primary" onClick={saveLink}>
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  {editor.isActive('link') && (
                    <button type="button" className="rte-btn-action rte-btn-action--danger" title="Remove link" onClick={removeLink}>
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {linkUrl && (
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <a
                      href={linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-primary hover:underline flex items-center gap-1"
                    >
                      Test link <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                )}
              </div>
            )}

            <ToolbarButton
              title="Insert image (URL or upload)"
              onClick={() => setShowImageModal((v) => !v)}
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </ToolbarButton>

            {showImageModal && (
              <div className="rte-popover rte-image-popover" ref={imageModalRef}>
                <div className="rte-popover-title">Insert Description Image</div>
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Direct upload from device:</label>
                    <label className={`rte-upload-btn ${imageUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={handleImageFileChange}
                        disabled={imageUploading}
                      />
                      {imageUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-primary" />
                          <span>Uploading image…</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-3.5 h-3.5 text-accent-primary" />
                          <span>Choose file (Max 5MB)</span>
                        </>
                      )}
                    </label>
                  </div>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="flex-shrink mx-2 text-[10px] text-muted-foreground uppercase">or URL</span>
                    <div className="flex-grow border-t border-white/10"></div>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="url"
                      className="rte-input flex-1"
                      placeholder="https://.../photo.webp"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          insertImageUrl();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="rte-btn-action rte-btn-action--primary"
                      onClick={insertImageUrl}
                      disabled={!imageUrl.trim()}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rte-divider" />

          {/* Emoji */}
          <div className="rte-toolbar-group relative" ref={emojiRef}>
            <ToolbarButton title="Insert symbol / emoji" onClick={() => setShowEmoji((v) => !v)}>
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

          {/* Groq AI Refine Assistant */}
          <div className="rte-toolbar-group ml-auto relative" ref={aiRef}>
            <button
              type="button"
              className={`rte-ai-btn ${aiLoading ? 'rte-ai-btn--loading' : ''}`}
              title="Refine description with AI (Groq)"
              disabled={aiLoading}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowAiMenu((v) => !v)}
            >
              {aiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="text-[11px] font-semibold text-amber-300">AI Refine</span>
            </button>

            {showAiMenu && (
              <div className="rte-popover rte-ai-popover">
                <div className="rte-popover-title flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Sparkles className="w-3.5 h-3.5" /> AI Description Refinement
                  </span>
                  <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">Groq AI Engine</span>
                </div>
                <div className="mt-2 space-y-1">
                  {AI_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="rte-ai-option"
                      onClick={() => handleAiRefine(opt.id)}
                    >
                      <div className="font-medium text-white text-[12px]">{opt.label}</div>
                      <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor Body */}
      <div className="rte-body">
        <EditorContent editor={editor} />
      </div>

      {/* Status Bar / Character Count */}
      <div className="rte-statusbar">
        <div className="flex items-center gap-3">
          <span>{wordCount} words</span>
          <span>•</span>
          <span className={charCount > maxCharacters ? 'text-destructive font-semibold' : ''}>
            {charCount.toLocaleString()} / {maxCharacters.toLocaleString()} chars
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground hidden sm:block">
          Tab / Shift+Tab to indent lists • Clean ecommerce HTML preserved
        </div>
      </div>
    </div>
  );
}
