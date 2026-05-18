import * as React from 'react';
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs, defaultStyleSpecs } from '@blocknote/core';
import { pt as ptLocale } from '@blocknote/core/locales';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import { useTheme } from '@/design-system/hooks';
import { sanitizeRichHtml } from '@/utils/sanitizeRichHtml';
import { cn } from '@/design-system/utils/tokens';

import '@blocknote/core/fonts/inter.css';
import '@blocknote/ariakit/style.css';

const {
  codeBlock: _omitCodeBlock,
  audio: _omitAudio,
  video: _omitVideo,
  file: _omitFile,
  image: _omitImage,
  ...slimBlockSpecs
} = defaultBlockSpecs;

const SLIM_SCHEMA = BlockNoteSchema.create({
  blockSpecs: slimBlockSpecs,
  inlineContentSpecs: defaultInlineContentSpecs,
  styleSpecs: defaultStyleSpecs,
});

function htmlToInitialContent(editor, html) {
  if (!html) return undefined;
  const trimmed = String(html).trim();
  if (!trimmed) return undefined;
  try {
    const parsed = editor.tryParseHTMLToBlocks(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    /* fall through */
  }
  return [{ type: 'paragraph', content: trimmed }];
}

function RichEditorCore({
  value,
  onChange,
  placeholder,
  disabled = false,
  ariaLabel,
  className,
}) {
  const { isDark } = useTheme();
  const lastEmittedRef = React.useRef(value || '');

  const editor = useCreateBlockNote({
    schema: SLIM_SCHEMA,
    dictionary: ptLocale,
    initialContent: undefined,
    trailingBlock: true,
  });

  React.useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (incoming === lastEmittedRef.current) return;
    const blocks = htmlToInitialContent(editor, incoming);
    if (blocks) {
      editor.replaceBlocks(editor.document, blocks);
      lastEmittedRef.current = incoming;
    }
  }, [editor, value]);

  const handleChange = React.useCallback(async () => {
    if (!editor) return;
    const html = await editor.blocksToHTMLLossy(editor.document);
    const safe = sanitizeRichHtml(html);
    lastEmittedRef.current = safe;
    onChange?.(safe);
  }, [editor, onChange]);

  return (
    <div
      data-slot="rich-editor"
      role="group"
      aria-label={ariaLabel || 'Editor de texto rico'}
      className={cn(
        'rounded-[16px] border bg-card transition-all duration-200',
        'border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        disabled && 'opacity-50 pointer-events-none',
        'min-h-[160px] px-2 py-2',
        className
      )}
    >
      <BlockNoteView
        editor={editor}
        editable={!disabled}
        onChange={handleChange}
        theme={isDark ? 'dark' : 'light'}
        data-placeholder={placeholder}
        className="bn-anest min-h-[140px]"
      />
    </div>
  );
}

export default RichEditorCore;
