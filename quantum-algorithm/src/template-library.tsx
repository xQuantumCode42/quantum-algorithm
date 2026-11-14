import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Graph } from "./practice";
import { builtInTemplates, type Template } from "./templates";

const storageKey = "quantum-cpp-templates-v1";
const allowedImage = /^(?:data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s]+)$/i;

function readTemplates(): Template[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(stored) ? stored.filter((item): item is Template => item && typeof item === "object"
      && ["id", "title", "category", "code", "guide"].every(key => typeof item[key] === "string")) : [];
  } catch { return []; }
}

export function TemplateLibrary() {
  const [custom, setCustom] = useState(readTemplates);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Template>();
  const [message, setMessage] = useState("");
  const popup = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [left, setLeft] = useState(0);
  const overrides = new Map(custom.map(template => [template.id, template]));
  const all = [...builtInTemplates.map(template => overrides.get(template.id) ?? template),
    ...custom.filter(template => !builtInTemplates.some(built => built.id === template.id))];
  const active = all.find(template => template.id === selected);
  const filter = query.trim().toLowerCase();
  const visible = all.filter(template => (template.title + " " + template.id + " " + template.category).toLowerCase().includes(filter));
  const categories = [...new Set(visible.map(template => template.category))];

  function close() {
    setDraft(undefined);
    setSelected("");
    setExpanded(false);
    setMessage("");
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!active && !draft) return;
    popup.current?.focus();
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    }
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [selected, expanded, !!draft]);

  function create(title = "", code = "") {
    setDraft({ id: crypto.randomUUID(), title, code, category: "自訂", guide: "" });
    setExpanded(true);
    setMessage("");
  }

  function save() {
    if (!draft?.title.trim() || !draft.category.trim() || !draft.code.trim()) return;
    const saved = { ...draft, title: draft.title.trim(), category: draft.category.trim() };
    const next = [...custom.filter(template => template.id !== saved.id), saved];
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setCustom(next);
      setSelected(saved.id);
      setDraft(undefined);
      setMessage("已儲存模板。");
    } catch { setMessage("儲存失敗。請縮小圖片或減少模板內容。"); }
  }

  async function attachImage(file?: File) {
    if (!draft || !file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 700_000) {
      setMessage("請選擇不超過 700 KB 的 PNG、JPEG、WebP 或 GIF。");
      return;
    }
    const id = draft.id;
    const reader = new FileReader();
    reader.onload = () => {
      setDraft(current => current?.id === id ? { ...current, guide: current.guide + "\n\n![說明圖片](" + reader.result + ")\n" } : current);
    };
    reader.onerror = () => setMessage("無法讀取圖片。");
    reader.readAsDataURL(file);
  }

  return <section className="template-library">
    <h2>C++ 模板</h2>
    <input aria-label="搜尋 C++ 模板" type="search" placeholder="搜尋模板" value={query} onChange={e => setQuery(e.target.value)}/>
    <div className="row template-actions">
      <button type="button" onClick={e => { trigger.current = e.currentTarget; create(); }}>新增</button>
      <label className="template-import">匯入 .cpp<input type="file" accept=".cpp,.cc,.cxx" onChange={async e => {
        const input = e.currentTarget;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        if (file.size > 180_000) { setMessage("模板檔不可超過 180 KB。"); return; }
        trigger.current = input;
        try { create(file.name.replace(/\.(cpp|cc|cxx)$/i, ""), await file.text()); }
        catch { setMessage("無法讀取模板檔。"); }
      }}/></label>
    </div>
    {categories.map(category => <details key={category} open={filter ? true : undefined}>
      <summary>{category} <small>{visible.filter(template => template.category === category).length}</small></summary>
      {visible.filter(template => template.category === category).map(template => <button type="button" key={template.id}
        aria-pressed={selected === template.id} onClick={e => {
          trigger.current = e.currentTarget;
          setLeft(e.currentTarget.closest("aside")?.getBoundingClientRect().right ?? 0);
          setSelected(template.id);
          setExpanded(false);
          setMessage("");
        }}>{template.title}</button>)}
    </details>)}
    {!categories.length && <p>沒有符合的模板。</p>}
    {!active && !draft && message && <p role="status">{message}</p>}
    {(active || draft) && <>{expanded && <div className="template-backdrop" onClick={close}/>}
      <section ref={popup} tabIndex={-1} role="dialog" aria-label={draft ? "編輯模板" : active?.title}
        className={expanded ? "panel template-expanded" : "panel template-popup"} style={expanded ? undefined : { left: left + 8 }}>
        <div className="row title-row"><h2>{draft ? "編輯模板" : active?.title}</h2><button type="button" onClick={close}>關閉</button></div>
        {draft ? <div className="practice-tools">
          <label className="field">名稱<input maxLength={100} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}/></label>
          <label className="field">分類<input maxLength={50} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}/></label>
          <label className="field">C++ 程式碼<textarea rows={12} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })}/></label>
          <label className="field">Markdown 解說<textarea rows={8} value={draft.guide} onChange={e => setDraft({ ...draft, guide: e.target.value })}/></label>
          <label className="field">加入圖片<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => {
            void attachImage(e.target.files?.[0]); e.target.value = "";
          }}/></label>
          <button type="button" disabled={!draft.title.trim() || !draft.category.trim() || !draft.code.trim()} onClick={save}>儲存模板</button>
        </div> : active && <>
          <div className="row template-actions">
            <button type="button" onClick={async () => {
              try { await navigator.clipboard.writeText(active.code); setMessage("已複製程式碼。"); }
              catch { setMessage("無法寫入剪貼簿。可以選取下方程式碼手動複製。"); }
            }}>複製程式碼</button>
            {!expanded && <button type="button" onClick={() => setExpanded(true)}>詳細解說</button>}
            <button type="button" onClick={() => { setDraft({ ...active }); setExpanded(true); }}>編輯</button>
          </div>
          {expanded && <div className="markdown"><ReactMarkdown skipHtml
            urlTransform={url => allowedImage.test(url) ? url : ""}
            components={{
              img: ({ src, alt }) => src ? <img src={src} alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer"/> : null,
              a: ({ children }) => <span>{children}</span>,
              code: ({ className, children }) => className === "language-graph" ? <Graph text={String(children)}/> : <code>{children}</code>,
            }}>{active.guide || "尚未填寫解說。"}</ReactMarkdown></div>}
          <pre className="code-block"><code>{active.code}</code></pre>
        </>}
        {message && <p role="status">{message}</p>}
      </section></>}
  </section>;
}
