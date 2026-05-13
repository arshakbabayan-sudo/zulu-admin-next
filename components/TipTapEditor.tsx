"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
};

const TOOLBAR_BTN =
  "rounded border border-default bg-white px-2 py-1 text-xs font-medium text-fg-t7 hover:bg-figma-bg-1 disabled:opacity-40";
const TOOLBAR_BTN_ACTIVE = "rounded border border-violet-300 bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700";

export function TipTapEditor({
  value,
  onChange,
  placeholder = "Start typing…",
  minHeight = "180px",
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) {
    return (
      <div className="rounded border border-default bg-figma-bg-1 p-3 text-sm text-fg-t6" style={{ minHeight }}>
        Loading editor…
      </div>
    );
  }

  function btnClass(active: boolean) {
    return active ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN;
  }

  return (
    <div className="rounded border border-default bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-default p-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnClass(editor.isActive("bold"))}
          aria-label="Bold"
        >
          <span className="font-bold">B</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnClass(editor.isActive("italic"))}
          aria-label="Italic"
        >
          <span className="italic">I</span>
        </button>
        <span className="mx-1 h-4 w-px bg-default" aria-hidden />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btnClass(editor.isActive("heading", { level: 1 }))} aria-label="Heading 1">H1</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive("heading", { level: 2 }))} aria-label="Heading 2">H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnClass(editor.isActive("heading", { level: 3 }))} aria-label="Heading 3">H3</button>
        <span className="mx-1 h-4 w-px bg-default" aria-hidden />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive("bulletList"))} aria-label="Bullet list">• List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive("orderedList"))} aria-label="Numbered list">1. List</button>
        <span className="mx-1 h-4 w-px bg-default" aria-hidden />
        <button
          type="button"
          onClick={() => {
            const previous = editor.getAttributes("link").href as string | undefined;
            const url = window.prompt("Link URL (leave blank to remove)", previous ?? "https://");
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
          className={btnClass(editor.isActive("link"))}
          aria-label="Link"
        >
          🔗
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive("blockquote"))} aria-label="Quote">❝</button>
        <span className="mx-1 h-4 w-px bg-default" aria-hidden />
        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={btnClass(false)} aria-label="Undo">↶</button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={btnClass(false)} aria-label="Redo">↷</button>
      </div>
      <div className="p-3" style={{ minHeight }}>
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none text-sm focus:outline-none [&>div]:focus:outline-none [&_p]:my-2 [&_h1]:mb-2 [&_h1]:mt-3 [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:mb-1 [&_h3]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-violet-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-violet-300 [&_blockquote]:pl-3 [&_blockquote]:italic"
        />
      </div>
    </div>
  );
}
