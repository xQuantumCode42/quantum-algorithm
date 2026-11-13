import { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import ReactMarkdown from "react-markdown";
import "./style.css";

type Page = "practice" | "notes" | "settings";
type Mode = "hint" | "solution";
type Problem = { id: string; title: string; platform: "lc" | "cf"; topic: string; level: number; focus: string; rating?: number };
type Note = { problem: string; topic: string; language: string; date: string; result: string; focus: string; observation: string };
type AppState = {
  problems: Problem[]; topics: Record<string, { name: string; slug: string; cf: string }>; focuses: Record<string, string>;
  results: [string, string][]; languages: string[]; notes: [string, Note][]; path: string;
  lc: string; cf: string; synced: number; cf_catalog: number;
  ai: { connected: boolean; registered: boolean; email: string; selected: string; models: { slug: string; name: string }[] };
};
type Selection = { items: Problem[]; reason: string; source?: string };
type Exchange = { question: string; reply: string; source: string };

const platform = { lc: "LeetCode", cf: "Codeforces" };
const command = <T,>(name: string, data?: Record<string, unknown>) => invoke<T>(name, data);
const payload = <T,>(name: string, data: object) => command<T>(name, { data });
const stars = (level: number) => level + " ★ · " + ["Easy", "Medium", "Hard"][Math.floor((level - 1) / 3)];
const openJudge = (platform: string, action: string, topic = "") =>
  command<void>("open_judge", { platform, action, topic });
const empty: Selection = { items: [], reason: "" };

function Select({ label, options, value, change }: {
  label: string; options: [string, string][]; value: string; change: (value: string) => void;
}) {
  return <label className="field"><span>{label}</span>
    <select value={value} onChange={e => change(e.target.value)}>
      {options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
    </select>
  </label>;
}

function Markdown({ text }: { text: string }) {
  return <div className="markdown">
    <ReactMarkdown skipHtml components={{
      a: ({ children }) => <span>{children}</span>,
      img: ({ alt }) => <span>{alt}</span>,
      pre: ({ children }) => <pre className="code-block">{children}</pre>,
    }}>{text}</ReactMarkdown>
  </div>;
}

function App() {
  const [data, setData] = useState<AppState>();
  const [page, setPage] = useState<Page>("practice");
  const [topic, setTopic] = useState("binary");
  const [language, setLanguage] = useState("Python3");
  const [judge, setJudge] = useState("all");
  const [level, setLevel] = useState("2");
  const [practiceTopic, setPracticeTopic] = useState("binary");
  const [selection, setSelection] = useState(empty);
  const [problem, setProblem] = useState<Problem>();
  const [practiceLanguage, setPracticeLanguage] = useState("Python3");
  const [mode, setMode] = useState<Mode>("hint");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [question, setQuestion] = useState("");
  const [statement, setStatement] = useState("");
  const [code, setCode] = useState("");
  const [observation, setObservation] = useState("");
  const [focus, setFocus] = useState("boundary");
  const [result, setResult] = useState("stuck");
  const [showNote, setShowNote] = useState(false);
  const [viewNote, setViewNote] = useState("");
  const [aiPick, setAiPick] = useState(true);
  const [planWelcome, setPlanWelcome] = useState(false);
  const [busy, setBusy] = useState<{ label: string; location: "page" | "question" }>();
  const [status, setStatus] = useState<{ text: string; error: boolean }>();
  const [lc, setLc] = useState("");
  const [cf, setCf] = useState("");
  const [notesPath, setNotesPath] = useState("");
  const [find, setFind] = useState("");

  const notify = (text: string) => setStatus({ text, error: false });
  const error = (reason: unknown) => setStatus({ text: String(reason), error: true });

  function choose(next: Problem | undefined, lang: string, selectedTopic: string) {
    setProblem(next);
    setPracticeLanguage(lang);
    setPracticeTopic(selectedTopic);
    setMode("hint");
    setExchanges([]);
    setQuestion("");
    setCode("");
    setStatement("");
    setObservation("");
    setFocus(next?.focus || "boundary");
    setResult("stuck");
    setShowNote(false);
  }

  useEffect(() => {
    async function init() {
      const state = await command<AppState>("app_state");
      setData(state);
      setLc(state.lc);
      setCf(state.cf);
      setNotesPath(state.path);
      const picks = await payload<Selection>("recommend", { topic: "binary", platform: "all", language: "Python3", level: 2 });
      setSelection(picks);
      choose(picks.items[0], "Python3", "binary");
    }
    void init().catch(error);
  }, []);

  async function refresh() { setData(await command<AppState>("app_state")); }
  async function signIn(newAccount: boolean) {
    await command("chatgpt_sign_in", { newAccount });
    await refresh();
    if (!localStorage.getItem("quantum-chatgpt-plan-intro")) setPlanWelcome(true);
    notify("已連結 ChatGPT 訂閱。");
  }
  async function run(label: string, task: () => Promise<void>, location: "page" | "question" = "page") {
    if (busy) return;
    setBusy({ label, location });
    setStatus(undefined);
    try { await task(); } catch (reason) { error(reason); }
    finally { setBusy(undefined); }
  }
  function confirmSwitch() {
    return !(exchanges.length || observation.trim() || code.trim() || question.trim() || statement.trim())
      || window.confirm("換題會清除目前對話與未儲存的內容。確定換題？");
  }
  function recommend() {
    if (!confirmSwitch()) return;
    void run("正在選題…", async () => {
      const picks = await payload<Selection>("recommend", {
        topic, platform: judge, language, level: Number(level), ai: !!data?.ai.connected && aiPick,
      });
      setSelection(picks);
      choose(picks.items[0], language, topic);
    });
  }
  function coach(task: "chat" | "review" | "draft") {
    if (!problem) return;
    if (task === "draft" && observation.trim() && !window.confirm("用 AI 草稿取代目前的學習觀察？")) return;
    const waiting = task === "chat" ? "正在思考…" : task === "draft" ? "正在整理筆記…" : "教練正在回覆…";
    void run(waiting, async () => {
      const response = await payload<{ reply: string; source: string }>("coach", {
        problem: problem.id, language: practiceLanguage, mode, task, statement, code, question,
        history: exchanges.slice(-3).flatMap(exchange => [
          { role: "user", text: exchange.question.slice(0, 6000) },
          { role: "assistant", text: exchange.reply.slice(0, 6000) },
        ]),
      });
      if (task === "draft") {
        setObservation(response.reply.slice(0, 6000));
        return;
      }
      const prompt = task === "review" ? ["請審閱已貼上的程式碼。", question.trim()].filter(Boolean).join("\n") : question.trim();
      setExchanges(previous => [...previous, { question: prompt, ...response }]);
      setQuestion("");
    }, task === "chat" ? "question" : "page");
  }
  function saveNote() {
    if (!problem) return;
    void run("正在儲存筆記…", async () => {
      const file = await payload<string>("save_note", { problem: problem.id, language: practiceLanguage, topic: practiceTopic, focus, result, observation });
      setObservation("");
      setShowNote(false);
      await refresh();
      notify("筆記已儲存。下次選題會參考這次的學習觀察。");
      setViewNote(file);
    });
  }

  function deleteNote(file: string) {
    if (busy || !window.confirm("要刪除這份練習筆記嗎？檔案會移到筆記資料夾內的 .quantum-trash，可手動復原。")) return;
    void run("正在刪除筆記…", async () => {
      await command("delete_note", { file });
      setData(previous => previous && { ...previous, notes: previous.notes.filter(([name]) => name !== file) });
      setViewNote("");
      notify("筆記已移到 .quantum-trash。後續選題將略過這份筆記。");
    });
  }

  const pages: [Page, string, string][] = [["practice", "↗", "練習工作區"], ["notes", "≡", "練習筆記"], ["settings", "⚙", "設定"]];
  let content: ReactNode = <p className="muted">{status ? "無法載入工作區。" : "正在開啟工作區…"}</p>;
  if (data && page === "practice") content = <>
    <header className="heading"><div><h1>下一題，練哪裡？</h1><p>從上次卡住的地方出發，用一道題驗證自己的理解。</p></div>
      <span className="badge">{data.ai.connected ? "ChatGPT 已連結" : "本機模式"}</span></header>
    <form className="filters panel" onSubmit={e => { e.preventDefault(); recommend(); }}>
      <Select label="程式語言" options={data.languages.map(l => [l, l])} value={language} change={setLanguage}/>
      <Select label="主題" options={Object.entries(data.topics).map(([id, tag]) => [id, tag.name + " · " + tag.slug])} value={topic} change={setTopic}/>
      <Select label="平台" options={[["all", "全部平台"], ...Object.entries(platform)]} value={judge} change={setJudge}/>
      <Select label="起始難度" options={Array.from({ length: 9 }, (_, i) => [String(i + 1), stars(i + 1)])} value={level} change={setLevel}/>
      <button className="primary" disabled={!!busy}>推薦下一題</button>
      {data.ai.connected && <label className="check"><input type="checkbox" checked={aiPick} onChange={e => setAiPick(e.target.checked)}/> 讓 AI 參考近期筆記選題</label>}
    </form>
    <div className="practice-grid">
      <section className="panel shortlist">
        <h2>推薦題目</h2><p className="reason">{selection.reason}</p>
        {selection.items.map(p => <button key={p.id} type="button" className="candidate" aria-pressed={p.id === problem?.id}
          disabled={!!busy} onClick={() => { if (p.id !== problem?.id && confirmSwitch()) choose(p, practiceLanguage, practiceTopic); }}>
          <span>{p.title}</span><small>{platform[p.platform]} · {stars(p.level)}{p.rating && " (" + p.rating + ")"} · {data.focuses[p.focus]}</small>
        </button>)}
        <div className="row action-row">
          {judge !== "cf" && <button type="button" onClick={() => void run("正在開啟題庫…", () => openJudge("lc", "catalog", topic))}>LeetCode 主題題庫 ↗</button>}
          {judge !== "lc" && <button type="button" disabled={!!busy} onClick={() => void run("正在更新 Codeforces 題庫…", async () => {
            const count = await command<number>("refresh_codeforces_catalog");
            await refresh();
            notify("已更新 Codeforces 題庫：" + count + " 道可推薦題。請再點一次「推薦下一題」。");
          })}>更新 Codeforces 題庫</button>}
        </div>
      </section>
      {problem && <section className="panel workspace">
        <div className="row title-row"><div><h2>{problem.title}</h2>
          <p className="muted">{practiceLanguage} · {data.topics[practiceTopic].name} · {data.focuses[problem.focus]}</p></div>
          <button className="text-button" onClick={() => void run("正在開啟原題…", () => command("open_problem", { id: problem.id }))}>開啟原題 ↗</button></div>
        <div className="row mode-row"><div className="segment" aria-label="教練模式">
          <button aria-pressed={mode === "hint"} disabled={!!busy} onClick={() => setMode("hint")}>思路模式</button>
          <button aria-pressed={mode === "solution"} disabled={!!busy || !data.ai.connected} onClick={() => setMode("solution")}>解答模式</button>
        </div><small>{mode === "hint" ? (data.ai.connected ? "一次給一個方向" : "目前使用內建提示") : "完整程式碼與測例"}</small></div>
        <details className="section"><summary>補充題意或貼上程式碼</summary>
          <label className="field">題意、限制或函式簽名<textarea rows={3} value={statement} maxLength={10000} onChange={e => setStatement(e.target.value)}/></label>
          <label className="field">程式碼<textarea className="editor" rows={6} value={code} maxLength={18000} spellCheck={false} onChange={e => setCode(e.target.value)}/></label>
          <button disabled={!!busy || !data.ai.connected || !code.trim()} onClick={() => coach("review")}>審閱程式碼</button>
        </details>
        <form className="section" onSubmit={e => { e.preventDefault(); coach("chat"); }}>
          {data.ai.connected && <small>使用 ChatGPT 訂閱用量</small>}
          <label className="field">你卡在哪一步？<textarea placeholder="例如：我的搜尋區間什麼時候應該停止？" rows={2}
            value={question} maxLength={6000} onChange={e => setQuestion(e.target.value)}/></label>
          <div className="row action-row">
            <button className="primary" disabled={!!busy || !question.trim()}>送出問題</button>
            <span className="question-status" role="status">{busy?.location === "question" && busy.label}</span>
            {!showNote && <button type="button" onClick={() => setShowNote(true)}>記下這次練習</button>}
          </div>
        </form>
        {showNote && <form className="section" onSubmit={e => { e.preventDefault(); saveNote(); }}>
          <h3>記下這次練習</h3>
          <div className="note-grid"><Select label="練習結果" options={data.results} value={result} change={setResult}/>
            <Select label="要驗證的觀念" options={Object.entries(data.focuses)} value={focus} change={setFocus}/></div>
          <label className="field note-editor">學習觀察<textarea autoFocus rows={4} value={observation} maxLength={6000}
            placeholder="我在哪一步卡住？下一題想驗證什麼？" onChange={e => setObservation(e.target.value)}/></label>
          <div className="row action-row"><button className="primary" disabled={!!busy || !observation.trim()}>儲存 Markdown</button>
            <button type="button" disabled={!data.ai.connected || !!busy || !exchanges.length} onClick={() => coach("draft")}>用討論草擬</button>
            <button type="button" onClick={() => setShowNote(false)}>取消</button></div>
        </form>}
        <div className="chat" role="log" aria-label="對話紀錄，最新問答在上方">
          {exchanges.slice().reverse().map((exchange, index) =>
            <article className="exchange" key={exchanges.length - 1 - index}>
              <div className="turn user"><strong>你</strong><Markdown text={exchange.question}/></div>
              <div className="turn"><strong>{exchange.source}</strong><Markdown text={exchange.reply}/></div>
            </article>
          )}
        </div>
      </section>}
    </div>
  </>;

  if (data && page === "notes") {
    const notes = data.notes.filter(([, n]) => {
      const p = data.problems.find(p => p.id === n.problem);
      return [p?.title, n.observation, data.focuses[n.focus], n.language].join(" ").toLowerCase().includes(find.trim().toLowerCase());
    });
    const current = notes.find(([file]) => file === viewNote) || notes[0];
    content = <><header className="heading"><div><h1>練習筆記</h1><p className="path">{data.path}</p></div>
      <button onClick={() => void run("正在開啟資料夾…", () => command("open_notes"))}>開啟資料夾 ↗</button></header>
      <div className="practice-grid"><section className="panel">
        <label className="field">搜尋筆記<input value={find} onChange={e => setFind(e.target.value)} placeholder="題目、語言或卡點"/></label>
        {!notes.length && <p className="muted">{data.notes.length ? "沒有符合的筆記。" : "還沒有練習筆記。"}</p>}
        {notes.map(([file, n]) => <button key={file} className="candidate" aria-pressed={file === current?.[0]} onClick={() => setViewNote(file)}>
          <span>{data.problems.find(p => p.id === n.problem)?.title}</span><small>{n.date.slice(0, 10)} · {data.focuses[n.focus]}</small></button>)}
      </section>
      {current && <article className="panel"><div className="row title-row">
        <h2>{data.problems.find(p => p.id === current[1].problem)?.title}</h2>
        <button type="button" className="danger" disabled={!!busy} onClick={() => deleteNote(current[0])}>刪除筆記</button>
        </div>
        <p className="muted">{current[1].language} · {data.results.find(([id]) => id === current[1].result)?.[1]}</p>
        <Markdown text={current[1].observation}/></article>}</div></>;
  }

  if (data && page === "settings") content = <>
    <header className="heading"><div><h1>設定</h1><p>管理筆記路徑、刷題平台和 AI 教練。</p></div></header>
    <div className="settings-grid">
      <form className="panel" onSubmit={e => { e.preventDefault(); void run("正在儲存設定…", async () => {
        await payload("save_settings", { lc, cf, notes: notesPath });
        await refresh();
        notify("設定已儲存。");
      }); }}>
        <h2>刷題平台與筆記</h2>
        <label className="field">LeetCode 使用者名稱<input value={lc} onChange={e => setLc(e.target.value)} maxLength={50}/></label>
        <div className="row action-row">
          <button type="button" onClick={() => void run("正在開啟 LeetCode…", () => openJudge("lc", "account"))}>登入 LeetCode ↗</button>
          <button type="button" disabled={!data.lc} onClick={() => void run("正在開啟個人頁…", () => openJudge("lc", "profile"))}>開啟已儲存的個人頁 ↗</button>
        </div>
        <p className="muted">帳號登入在 LeetCode 網站完成。App 使用內建選題與官方主題頁，練習結果由筆記記錄。</p>
        <label className="field">Codeforces handle<input value={cf} onChange={e => setCf(e.target.value)} maxLength={50}/></label>
        <div className="row action-row">
          <button type="button" onClick={() => void run("正在開啟 Codeforces…", () => openJudge("cf", "account"))}>登入 Codeforces ↗</button>
          <button type="button" disabled={!data.cf} onClick={() => void run("正在開啟個人頁…", () => openJudge("cf", "profile"))}>開啟已儲存的個人頁 ↗</button>
        </div>
        <p className="muted">匿名題庫快取 {data.cf_catalog} 題。儲存 handle 後可同步最近 500 筆公開提交，目前記錄 {data.synced} 道 Accepted 題。</p>
        <label className="field">Markdown 資料夾<input value={notesPath} onChange={e => setNotesPath(e.target.value)} placeholder="留空使用預設位置"/></label>
        <p className="muted">可直接選擇舊版 notes/ 或 Obsidian vault。切換位置後會讀取該處的筆記。</p>
        <div className="row action-row"><button className="primary" disabled={!!busy}>儲存設定</button>
          <button type="button" disabled={!!busy} onClick={() => void run("正在選擇資料夾…", async () => {
            const path = await open({ directory: true, title: "選擇 Markdown 筆記資料夾" });
            if (typeof path === "string") setNotesPath(path);
          })}>瀏覽…</button>
          <button type="button" disabled={!!busy || !data.cf || cf !== data.cf} onClick={() => void run("正在同步 Codeforces…", async () => {
            const count = await command<number>("sync_codeforces");
            await refresh();
            notify("已同步 " + count + " 道 Accepted 題目。");
          })}>同步 Codeforces</button></div>
      </form>
      <section className="panel">
        <h2>ChatGPT 訂閱</h2>
        <p className="muted">{data.ai.connected ? "已連結 " + (data.ai.email || "ChatGPT 帳號") : "在系統瀏覽器登入並授權使用訂閱額度。"}</p>
        {data.ai.connected && <Select label="模型" options={data.ai.models.map(m => [m.slug, m.name])}
          value={data.ai.selected} change={model => void run("正在更新模型…", async () => {
            await command("chatgpt_model", { model });
            await refresh();
          })}/>}
        <div className="row action-row">
          {!data.ai.connected && <button data-oai-siwc-button className="primary" disabled={!!busy} onClick={() => void run("請在瀏覽器完成 ChatGPT 登入…", () => signIn(false))}>Continue with ChatGPT</button>}
          {data.ai.registered && <button disabled={!!busy} onClick={() => void run("請在瀏覽器選擇 ChatGPT 帳號…", () => signIn(true))}>使用其他 ChatGPT 帳號</button>}
          {data.ai.connected && <button disabled={!!busy} onClick={() => void run("正在登出 ChatGPT…", async () => {
            const revoked = await command<boolean>("chatgpt_sign_out");
            setMode("hint");
            await refresh();
            notify(revoked ? "已登出 ChatGPT。" : "已登出本機。未能確認遠端撤銷，可到 ChatGPT 設定管理授權。");
          })}>登出</button>}
          <button disabled={!!busy} onClick={() => void run("正在開啟 ChatGPT…", () => openJudge("chatgpt", "usage"))}>管理用量 ↗</button>
        </div>
        <p className="muted">連線憑證只保留在本次工作階段。AI 功能會把相關題目、對話或筆記送到 OpenAI。</p>
      </section>
    </div></>;

  return <div className="app">
    <aside className="sidebar"><div className="brand"><span className="logo" aria-hidden="true">Q</span><span>Quantum<br/>Algorithm</span></div>
      <nav aria-label="工作區">{pages.map(([id, icon, name]) => <button key={id} aria-current={page === id ? "page" : undefined}
        onClick={() => { setPage(id); if (id === "notes") void refresh().catch(error); }}><span aria-hidden="true">{icon}</span>{name}</button>)}</nav>
    </aside>
    <main><div className="status" aria-live="polite">{(busy?.location === "page" && busy.label) || (status && <span className={status.error ? "error" : "success"}>{status.text}</span>)}</div>
      {content}</main>
    {planWelcome && <div className="modal-backdrop"><section className="panel plan-dialog" role="dialog" aria-modal="true" aria-labelledby="plan-title">
      <h2 id="plan-title">已連結 ChatGPT 訂閱</h2>
      <p>符合資格的 AI 請求會使用你的 ChatGPT 訂閱用量，可在 ChatGPT 設定查看和管理授權。</p>
      <button autoFocus className="primary" onClick={() => {
        localStorage.setItem("quantum-chatgpt-plan-intro", "1");
        setPlanWelcome(false);
      }}>知道了</button>
    </section></div>}
  </div>;
}

createRoot(document.getElementById("root")!).render(<App/>);

