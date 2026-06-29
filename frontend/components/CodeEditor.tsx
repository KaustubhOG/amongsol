"use client";

import { ReactNode, useMemo, useRef } from "react";

// A production code editor built with the proven overlay technique: a syntax
// highlighted <pre> sits beneath a transparent <textarea> that owns all input.
// Because the two layers share *identical* typography (font, size, line-height,
// padding, tab-size, white-space) the highlighted glyphs line up perfectly with
// the caret, and a sibling gutter rendered with the same metrics keeps line
// numbers locked to their lines - no internal scroll desync, no wrapping drift.

const KEYWORDS = new Set([
  "as", "async", "await", "break", "const", "continue", "crate", "dyn", "else",
  "enum", "extern", "fn", "for", "if", "impl", "in", "let", "loop", "match",
  "mod", "move", "mut", "pub", "ref", "return", "self", "static", "struct",
  "super", "trait", "type", "unsafe", "use", "where", "while", "default", "macro",
]);

const TYPES = new Set([
  "u8", "u16", "u32", "u64", "u128", "usize", "i8", "i16", "i32", "i64", "i128",
  "isize", "f32", "f64", "bool", "char", "str", "String", "Vec", "Option",
  "Result", "Box", "Self", "Rc", "Arc", "HashMap", "BTreeMap", "Pubkey",
  "Account", "Context", "Signer", "Program", "ProgramResult",
]);

// Each spec is tried in order at the current scan position. The `y` (sticky)
// flag forces a match only at lastIndex, so we can walk the source linearly.
const SPECS: Array<[RegExp, string | null]> = [
  [/\/\/[^\n]*/y, "tok-com"],
  [/\/\*[\s\S]*?\*\//y, "tok-com"],
  [/r#*"[\s\S]*?"#*/y, "tok-str"],
  [/"(?:\\.|[^"\\])*"/y, "tok-str"],
  [/'(?:\\.|[^'\\])'/y, "tok-str"],
  [/'[a-zA-Z_][a-zA-Z0-9_]*/y, "tok-life"],
  [/#!?\[[^\]]*\]/y, "tok-attr"],
  [/\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?(?:[iuf](?:8|16|32|64|128|size))?\b/y, "tok-num"],
  [/[a-zA-Z_][a-zA-Z0-9_]*!/y, "tok-macro"],
  [/[a-zA-Z_][a-zA-Z0-9_]*/y, "IDENT"],
  [/\s+/y, null],
  [/[{}()[\]<>;,.:+\-*/%=&|!?@^~]/y, "tok-punct"],
];

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function classifyIdent(word: string, source: string, nextPos: number) {
  if (KEYWORDS.has(word)) return `<span class="tok-kw">${word}</span>`;
  if (word === "true" || word === "false") return `<span class="tok-bool">${word}</span>`;
  if (TYPES.has(word) || /^[A-Z]/.test(word)) return `<span class="tok-type">${word}</span>`;
  let cursor = nextPos;
  while (cursor < source.length && (source[cursor] === " " || source[cursor] === "\t")) cursor += 1;
  if (source[cursor] === "(") return `<span class="tok-fn">${word}</span>`;
  return word;
}

function highlightRust(source: string) {
  let out = "";
  let i = 0;
  const n = source.length;

  while (i < n) {
    let matched = false;
    for (const [re, cls] of SPECS) {
      re.lastIndex = i;
      const m = re.exec(source);
      if (m) {
        const text = m[0];
        if (cls === null) out += escapeHtml(text);
        else if (cls === "IDENT") out += classifyIdent(text, source, i + text.length);
        else out += `<span class="${cls}">${escapeHtml(text)}</span>`;
        i += text.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += escapeHtml(source[i]);
      i += 1;
    }
  }

  // A bare trailing newline (or empty source) renders no final line box, which
  // would leave the gutter one number taller than the code. A zero-width space
  // gives that last line height so the two columns stay in lockstep.
  if (source === "" || source.endsWith("\n")) out += "\u200B";
  return out;
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string, selectionStart: number) => void;
  onCursor?: (selectionStart: number) => void;
  disabled?: boolean;
  minLines?: number;
  ariaLabel?: string;
  overlay?: ReactNode;
}

export default function CodeEditor({
  value,
  onChange,
  onCursor,
  disabled = false,
  minLines = 8,
  ariaLabel = "code editor",
  overlay,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const html = useMemo(() => highlightRust(value), [value]);
  const lineCount = useMemo(() => Math.max(value.split("\n").length, 1), [value]);
  const minHeight = minLines * 22 + 32; // line-height 22px + 16px padding top & bottom

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab" || disabled) return;
    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const next = `${value.slice(0, start)}  ${value.slice(end)}`;
    onChange(next, start + 2);
    // Restore the caret after React commits the controlled value.
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = start + 2;
        textareaRef.current.selectionEnd = start + 2;
      }
    });
  }

  return (
    <div className="ce-shell" data-disabled={disabled || undefined}>
      <div className="ce-gutter" style={{ minHeight }} aria-hidden>
        {Array.from({ length: lineCount }, (_, index) => (
          <div key={index} className="ce-line">
            {index + 1}
          </div>
        ))}
      </div>
      <div className="ce-body" style={{ minHeight }}>
        <pre className="ce-pre" aria-hidden dangerouslySetInnerHTML={{ __html: html }} />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value, event.target.selectionStart ?? value.length)}
          onSelect={(event) => onCursor?.(event.currentTarget.selectionStart ?? 0)}
          onKeyUp={(event) => onCursor?.(event.currentTarget.selectionStart ?? 0)}
          onClick={(event) => onCursor?.(event.currentTarget.selectionStart ?? 0)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="ce-input"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          wrap="off"
          aria-label={ariaLabel}
        />
      </div>
      {overlay ? <div className="ce-overlay">{overlay}</div> : null}
    </div>
  );
}
