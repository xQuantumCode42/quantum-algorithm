import { useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

export type TestCase = { input: string; expected: string | null };
export type GraphFormat = "edges" | "counted" | "matrix" | "adjacency";
type Edge = [string, string, string?];
type Check = { ok: boolean; diagnostics: string; results: { status: string; output: string; stderr: string }[] };

function parseGraph(text: string, format: GraphFormat) {
  const rows = text.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const nodes = new Set<string>();
  const edges: Edge[] = [];
  const fields = (line: string) => line.trim().split(/[\s,]+/).filter(Boolean);
  const edge = (a: string, b: string, weight?: string) => {
    nodes.add(a);
    nodes.add(b);
    edges.push([a, b, weight]);
  };
  if (format === "matrix" && rows.length) {
    const matrix = rows.map(fields);
    if (matrix.some(row => row.length !== rows.length || row.some(x => !Number.isFinite(Number(x))))) {
      throw Error("請輸入方形數字矩陣，0 代表沒有邊。");
    }
    matrix.forEach((row, i) => {
      nodes.add(String(i + 1));
      row.forEach((weight, j) => {
        if (Number(weight)) edge(String(i + 1), String(j + 1), Number(weight) === 1 ? undefined : weight);
      });
    });
  } else if (format === "adjacency") {
    rows.forEach(row => {
      const [from, ...rest] = row.split(":");
      if (!from.trim() || rest.length !== 1) throw Error("鄰接串列請用「起點: 終點1 終點2」。");
      nodes.add(from.trim());
      fields(rest[0]).forEach(to => edge(from.trim(), to));
    });
  } else {
    const pairs = rows.map(fields);
    if (format === "counted" && pairs.length) {
      const [n, m, extra] = pairs.shift()!;
      if (extra || !/^\d+$/.test(n) || Number(n) > 50 || Number(m) !== pairs.length) {
        throw Error("第一行請填節點數 n 和邊數 m，節點上限 50。");
      }
      const first = pairs.some(pair => pair.slice(0, 2).includes("0")) ? 0 : 1;
      for (let i = first; i < first + Number(n); i++) nodes.add(String(i));
      if (pairs.some(pair => pair.slice(0, 2).some(node => !nodes.has(node)))) throw Error("節點編號超出 n 的範圍。");
    }
    pairs.forEach(([from, to, weight, extra]) => {
      if (!to || extra) throw Error("每行請填起點、終點及可選權重。");
      edge(from, to, weight);
    });
  }
  if (nodes.size > 50 || edges.length > 200) throw Error("圖最多顯示 50 個節點、200 條邊。");
  return { nodes: [...nodes], edges };
}

export function Graph({ text, format = "edges", directed = true }: { text: string; format?: GraphFormat; directed?: boolean }) {
  if (!text.trim()) return null;
  try {
    const { nodes, edges } = parseGraph(text, format);
    const center = 210;
    const radius = nodes.length < 2 ? 0 : 158;
    const points = new Map(nodes.map((node, i) => [
      node, [center + radius * Math.sin(i * Math.PI * 2 / nodes.length), center - radius * Math.cos(i * Math.PI * 2 / nodes.length)],
    ]));
    const drawn = new Set<string>();
    return <svg className="practice-graph" viewBox="0 0 420 420" role="img" aria-label={directed ? "有向圖" : "無向圖"}>
      {edges.map(([from, to, weight], i) => {
        const key = JSON.stringify(directed ? [from, to, weight] : [...[from, to].sort(), weight]);
        if (drawn.has(key)) return null;
        drawn.add(key);
        const [x, y] = points.get(from)!;
        const [endX, endY] = points.get(to)!;
        const angle = Math.atan2(endY - y, endX - x);
        const a = endX - 16 * Math.cos(angle);
        const b = endY - 16 * Math.sin(angle);
        return <g key={i}>
          {from === to ? <path d={`M ${x - 8} ${y - 10} C ${x - 32} ${y - 49} ${x + 32} ${y - 49} ${x + 8} ${y - 10}`}/>
            : <line x1={x} y1={y} x2={a} y2={b}/>}
          {directed && (from === to ? <path d={`M ${x + 7} ${y - 20} L ${x + 8} ${y - 11} L ${x + 16} ${y - 17}`}/>
            : <path d={`M ${a - 8 * Math.cos(angle - .45)} ${b - 8 * Math.sin(angle - .45)} L ${a} ${b} L ${a - 8 * Math.cos(angle + .45)} ${b - 8 * Math.sin(angle + .45)}`}/>)}
          {weight && <text x={(x + endX) / 2} y={from === to ? y - 42 : (y + endY) / 2 - 6}>{weight}</text>}
        </g>;
      })}
      {nodes.map(node => {
        const [x, y] = points.get(node)!;
        return <g key={node}><circle cx={x} cy={y} r={15}/><text x={x} y={y + 4}>{node}</text></g>;
      })}
    </svg>;
  } catch (error) { return <p role="status">{String(error).replace(/^Error: /, "")}</p>; }
}

const cppTokens = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|^\s*#[^\n]*|\b(?:alignas|auto|bool|break|case|char|class|const|constexpr|continue|double|else|enum|false|float|for|if|int|long|namespace|nullptr|private|public|return|short|signed|size_t|static|struct|switch|template|true|typename|unsigned|using|void|while)\b|\b\d+(?:\.\d+)?\b)/gm;
function highlighted(code: string): ReactNode {
  return code.split(cppTokens).map((token, index) => {
    if (index % 2 === 0) return token;
    const kind = /^\//.test(token) ? "comment" : /^["']/.test(token) ? "string" : /^\d/.test(token) ? "number" : "keyword";
    return <span key={index} className={kind}>{token}</span>;
  });
}

export function CppEditor({ code, change, cases }: { code: string; change: (code: string) => void; cases: TestCase[] }) {
  const preview = useRef<HTMLPreElement>(null);
  const [lint, setLint] = useState("");
  const [report, setReport] = useState<Check>();
  const [runError, setRunError] = useState("");
  const [running, setRunning] = useState(false);
  useEffect(() => {
    let current = true;
    if (running || !code.trim()) { setLint(""); return; }
    const timer = window.setTimeout(() => {
      invoke<Check>("cpp_check", { code }).then(
        check => { if (current) setLint(check.diagnostics); },
        error => { if (current) setLint(String(error)); },
      );
    }, 650);
    return () => { current = false; window.clearTimeout(timer); };
  }, [code, running]);
  return <>
    <label className="field">C++ 編輯器<div className="cpp-editor">
      <pre ref={preview} aria-hidden="true">{highlighted(code)}{"\n"}</pre>
      <textarea value={code} maxLength={18000} spellCheck={false} wrap="off"
        onChange={e => { change(e.target.value); setReport(undefined); setRunError(""); }}
        onScroll={e => {
          if (!preview.current) return;
          preview.current.scrollTop = e.currentTarget.scrollTop;
          preview.current.scrollLeft = e.currentTarget.scrollLeft;
        }}/>
    </div></label>
    <button type="button" disabled={running || !code.trim()} onClick={async () => {
      setRunning(true);
      setReport(undefined);
      setRunError("");
      try { setReport(await invoke<Check>("cpp_check", { code, cases })); }
      catch (error) { setRunError(String(error)); }
      finally { setRunning(false); }
    }}>{running ? "執行中…" : cases.length ? "編譯並執行測資" : "編譯"}</button>
    {(report?.diagnostics || lint || runError) && <pre className="code-block">{runError || report?.diagnostics || lint}</pre>}
    {report && <p role="status">{report.ok ? "編譯成功" : "編譯失敗"}</p>}
    {report?.results.map((test, i) => <details key={i} open><summary>測資 {i + 1} · {test.status}</summary>
      <pre className="code-block">{test.output}{test.stderr && "\n" + test.stderr}</pre></details>)}
  </>;
}
