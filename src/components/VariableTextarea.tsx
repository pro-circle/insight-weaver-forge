import { useRef, FormEvent, DragEvent, MouseEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { TEMPLATE_VARS } from "@/lib/templates";

const VAR_RE = /\{\{\s*\w+\s*\}\}/g;

/** Indexes of all `{{var}}` spans in `text`. */
function findVarSpans(text: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  for (const m of text.matchAll(VAR_RE)) {
    if (m.index === undefined) continue;
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** True if [a, b) intersects a variable span without fully covering it. */
function touchesLockedRange(
  spans: Array<{ start: number; end: number }>,
  a: number,
  b: number,
): boolean {
  for (const s of spans) {
    // selection covers the whole span → allow (full delete)
    if (a <= s.start && b >= s.end) continue;
    // strict overlap with span interior → block
    if (a < s.end && b > s.start) return true;
  }
  return false;
}

/**
 * Multiline editor with draggable variable chips. Users insert variables by
 * clicking a chip or dragging it into the textarea; manual typing inside an
 * existing `{{var}}` block is prevented so the template stays renderable.
 */
export function VariableTextarea({
  id,
  name,
  value,
  onChange,
  rows = 4,
  vars = TEMPLATE_VARS,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  vars?: string[];
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function insertAtCursor(token: string) {
    const el = ref.current;
    if (!el) {
      onChange(value + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function onBeforeInput(e: FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const a = el.selectionStart ?? 0;
    const b = el.selectionEnd ?? 0;
    const spans = findVarSpans(el.value);
    if (touchesLockedRange(spans, a, b)) {
      e.preventDefault();
    }
  }

  function onDrop(e: DragEvent<HTMLTextAreaElement>) {
    const token = e.dataTransfer.getData("text/plain");
    if (!token) return;
    e.preventDefault();
    insertAtCursor(token);
  }

  function chipDragStart(varName: string) {
    return (e: DragEvent<HTMLSpanElement>) => {
      e.dataTransfer.setData("text/plain", `{{${varName}}}`);
      e.dataTransfer.effectAllowed = "copy";
    };
  }

  function chipClick(varName: string) {
    return (e: MouseEvent<HTMLSpanElement>) => {
      e.preventDefault();
      insertAtCursor(`{{${varName}}}`);
    };
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {vars.map((v) => (
          <span
            key={v}
            draggable
            onDragStart={chipDragStart(v)}
            onClick={chipClick(v)}
            className="cursor-grab select-none rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800 hover:bg-blue-700 hover:text-white active:cursor-grabbing"
            title={`Drag or click to insert {{${v}}}`}
          >
            {`{{${v}}}`}
          </span>
        ))}
      </div>
      <Textarea
        id={id}
        name={name}
        ref={ref}
        rows={rows}
        value={value}
        onBeforeInput={onBeforeInput}
        onChange={(e) => onChange(e.target.value)}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
      />
      <p className="text-[11px] text-muted-foreground">
        Drag a chip into the box or click it to insert. Variables are locked — select
        the whole <code>{`{{name}}`}</code> to remove it.
      </p>
    </div>
  );
}
