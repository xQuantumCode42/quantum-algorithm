use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    fs,
    io::Read,
    process::{Command, Stdio},
    time::{Duration, Instant},
};
use tauri::State;

use crate::{App, Result};

#[derive(Deserialize)]
pub struct Case {
    input: String,
    expected: Option<String>,
}

fn capture(
    mut command: Command,
    dir: &std::path::Path,
    seconds: u64,
) -> Result<(bool, bool, String, String)> {
    let stdout = tempfile::tempfile().map_err(crate::io_error)?;
    let stderr = tempfile::tempfile().map_err(crate::io_error)?;
    let mut child = command
        .current_dir(dir)
        .stdout(stdout.try_clone().map_err(crate::io_error)?)
        .stderr(stderr.try_clone().map_err(crate::io_error)?)
        .spawn()
        .map_err(|e| format!("無法執行：{e}"))?;
    let start = Instant::now();
    let (success, timeout) = loop {
        if let Some(status) = child.try_wait().map_err(crate::io_error)? {
            break (status.success(), false);
        }
        if start.elapsed() >= Duration::from_secs(seconds)
            || stdout.metadata().map_err(crate::io_error)?.len() > 128_000
            || stderr.metadata().map_err(crate::io_error)?.len() > 128_000
        {
            let _ = child.kill();
            let _ = child.wait();
            break (false, true);
        }
        std::thread::sleep(Duration::from_millis(20));
    };
    fn read(mut file: fs::File) -> Result<String> {
        use std::io::{Seek, SeekFrom};
        file.seek(SeekFrom::Start(0)).map_err(crate::io_error)?;
        let mut data = Vec::new();
        file.take(128_000)
            .read_to_end(&mut data)
            .map_err(crate::io_error)?;
        Ok(String::from_utf8_lossy(&data).into_owned())
    }
    Ok((success, timeout, read(stdout)?, read(stderr)?))
}

#[tauri::command]
pub async fn cpp_check(code: String, cases: Option<Vec<Case>>) -> Result<Value> {
    if code.len() > 72_000
        || cases.as_ref().is_some_and(|rows| {
            rows.len() > 12
                || rows.iter().any(|row| {
                    row.input.len() > 64_000
                        || row
                            .expected
                            .as_ref()
                            .is_some_and(|text| text.len() > 64_000)
                })
        })
    {
        return Err("程式碼或測資太長，或測資超過 12 組。".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let dir = tempfile::tempdir().map_err(crate::io_error)?;
        let path = dir.path();
        fs::write(path.join("main.cpp"), code).map_err(crate::io_error)?;
        let compiler = ["clang++", "g++"]
            .into_iter()
            .find(|name| {
                Command::new(name)
                    .arg("--version")
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .status()
                    .is_ok_and(|s| s.success())
            })
            .ok_or("找不到 clang++ 或 g++。請安裝 C++ 工具鏈並加入 PATH。")?;
        let mut compile = Command::new(compiler);
        compile.stdin(Stdio::null()).args([
            "-std=c++20",
            "-Wall",
            "-Wextra",
            "-pedantic",
            "main.cpp",
        ]);
        let binary = if cfg!(windows) {
            "solution.exe"
        } else {
            "solution"
        };
        if cases.is_some() {
            compile.args(["-o", binary]);
        } else {
            compile.arg("-fsyntax-only");
        }
        let (ok, limited, out, err) = capture(compile, path, 25)?;
        let diagnostics = if limited {
            format!("編譯超過時間或輸出上限。\n{err}{out}")
        } else {
            format!("{err}{out}")
        };
        let mut results = Vec::new();
        if ok {
            for case in cases.unwrap_or_default() {
                let input = path.join("input");
                fs::write(&input, case.input).map_err(crate::io_error)?;
                let mut run = Command::new(path.join(binary));
                run.stdin(fs::File::open(input).map_err(crate::io_error)?);
                let (passed, limited, output, stderr) = capture(run, path, 2)?;
                let status = if limited {
                    "超過時間或輸出上限"
                } else if !passed {
                    "執行錯誤"
                } else if let Some(expected) = case.expected {
                    if output.split_whitespace().eq(expected.split_whitespace()) {
                        "通過"
                    } else {
                        "輸出不符"
                    }
                } else {
                    "已執行"
                };
                results.push(json!({"status":status,"output":output,"stderr":stderr}));
            }
        }
        Ok(json!({"ok":ok,"diagnostics":diagnostics,"results":results}))
    })
    .await
    .map_err(|e| e.to_string())?
}

fn pre_text(html: &str) -> String {
    let mut text = String::new();
    let mut rest = html;
    while let Some((before, after)) = rest.split_once('<') {
        text.push_str(before);
        let Some((tag, next)) = after.split_once('>') else {
            break;
        };
        if tag.trim_end_matches('/').trim() == "br" || matches!(tag, "/div" | "/p" | "/li" | "/pre")
        {
            text.push('\n');
        }
        rest = next;
    }
    text.push_str(rest);
    for (encoded, decoded) in [
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&quot;", "\""),
        ("&#39;", "'"),
        ("&nbsp;", " "),
        ("&amp;", "&"),
    ] {
        text = text.replace(encoded, decoded);
    }
    text.trim().into()
}

fn pre_blocks(html: &str) -> impl Iterator<Item = String> + '_ {
    html.split("<pre").skip(1).filter_map(|part| {
        let (_, body) = part.split_once('>')?;
        Some(pre_text(body.split_once("</pre>")?.0))
    })
}

fn sample_cases(html: &str, codeforces: bool) -> Vec<Value> {
    if codeforces {
        return html
            .split("class=\"sample-test\"")
            .skip(1)
            .flat_map(|block| {
                block
                    .split("class=\"note\"")
                    .next()
                    .into_iter()
                    .flat_map(pre_blocks)
            })
            .collect::<Vec<_>>()
            .chunks_exact(2)
            .take(12)
            .map(|pair| json!({"input":pair[0],"expected":pair[1]}))
            .collect();
    }
    pre_blocks(html)
        .filter_map(|block| {
            let (_, input) = block
                .split_once("Input:")
                .or_else(|| block.split_once("輸入："))
                .or_else(|| block.split_once("输入："))?;
            let (input, output) = input
                .split_once("Output:")
                .or_else(|| input.split_once("輸出："))
                .or_else(|| input.split_once("输出："))?;
            let output = output
                .split("Explanation:")
                .next()?
                .split("解釋：")
                .next()?
                .split("解释：")
                .next()?;
            Some(json!({"input":input.trim(),"expected":output.trim()}))
        })
        .take(12)
        .collect()
}

async fn problem_page(link: &str) -> Result<String> {
    // Only the problem links recognized by the catalog are requested.
    let (_, _, url) = crate::problem_link(link).ok_or("不支援的題目網址。")?;
    fetch_page(url.trim_end_matches('/')).await
}

async fn fetch_page(url: &str) -> Result<String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;
    let mut response = client.get(url).send().await.map_err(|_| "無法連到題庫。")?;
    if !response.status().is_success() {
        return Err(format!("題庫回傳 HTTP {}", response.status().as_u16()));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "無法讀取題目頁面。")? {
        if bytes.len() + chunk.len() > 4_000_000 {
            return Err("題目頁面過大。".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn mirror_content(html: &str, pid: &str) -> Option<(String, Vec<Value>)> {
    let (_, context) = html.split_once("id=\"lentille-context\"")?;
    let (_, context) = context.split_once('>')?;
    let data: Value = serde_json::from_str(context.split_once("</script>")?.0).ok()?;
    let problem = &data["data"]["problem"];
    if problem["pid"].as_str()? != pid {
        return None;
    }
    let content = &problem["content"];
    let description = content["description"].as_str()?.trim();
    if description.is_empty() {
        return None;
    }
    let statement = [
        ("背景", "background"),
        ("題意", "description"),
        ("輸入", "formatI"),
        ("輸出", "formatO"),
        ("限制與說明", "hint"),
    ]
    .into_iter()
    .filter_map(|(label, key)| {
        content[key]
            .as_str()
            .filter(|s| !s.trim().is_empty())
            .map(|value| format!("{label}\n{value}"))
    })
    .collect::<Vec<_>>()
    .join("\n\n");
    let samples = problem["samples"]
        .as_array()
        .into_iter()
        .flatten()
        .take(12)
        .filter_map(|row| Some(json!({"input":row[0].as_str()?,"expected":row[1].as_str()?})))
        .collect();
    Some((statement.chars().take(16000).collect(), samples))
}

async fn codeforces_content(id: &str, url: &str) -> Result<(String, Vec<Value>)> {
    if let Ok(html) = problem_page(url).await {
        if let Some((_, raw)) = html
            .split_once("class=\"problem-statement\"")
            .and_then(|(_, block)| block.split_once('>'))
        {
            let raw = raw.split_once("</form>").map_or(raw, |(before, _)| before);
            let statement: String = pre_text(raw).chars().take(16000).collect();
            let samples = sample_cases(raw, true);
            if !statement.is_empty() && !samples.is_empty() {
                return Ok((statement, samples));
            }
        }
    }
    let (contest, index) = id
        .strip_prefix("cf:")
        .and_then(|id| id.split_once('/'))
        .ok_or("Codeforces 題號無效。")?;
    let pid = format!("CF{contest}{index}");
    let page = fetch_page(&format!("https://www.luogu.com.cn/problem/{pid}"))
        .await
        .map_err(|reason| format!("Codeforces 題目頁無法讀取，洛谷備援也失敗（{reason}）。"))?;
    mirror_content(&page, &pid).ok_or_else(|| "Codeforces 與洛谷未提供可讀取的題面。".into())
}

pub async fn problem_statement(problem: &crate::Problem) -> Option<String> {
    let (id, platform, url) = crate::problem_link(&problem.url)?;
    if platform == "cf" {
        return codeforces_content(&id, &url)
            .await
            .ok()
            .map(|(statement, _)| statement);
    }
    let raw = {
        let host = reqwest::Url::parse(&url).ok()?.host_str()?.to_owned();
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(8))
            .build()
            .ok()?;
        let response = client.post(format!("https://{host}/graphql/")).json(&json!({
            "query": "query Statement($slug: String!) { question(titleSlug: $slug) { content } }",
            "variables": {"slug": id.strip_prefix("lc:")?}
        })).send().await.ok()?.error_for_status().ok()?;
        if response.content_length().is_some_and(|n| n > 1_000_000) {
            return None;
        }
        let mut response = response;
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.ok()? {
            if bytes.len() + chunk.len() > 1_000_000 {
                return None;
            }
            bytes.extend_from_slice(&chunk);
        }
        let body: Value = serde_json::from_slice(&bytes).ok()?;
        body["data"]["question"]["content"].as_str()?.to_owned()
    };
    let statement = pre_text(&raw).chars().take(16000).collect::<String>();
    (!statement.trim().is_empty()).then_some(statement)
}

#[tauri::command]
pub async fn import_samples(app: State<'_, App>, id: String) -> Result<Vec<Value>> {
    let problem = app.problem(&id)?;
    if problem.platform == "cf" {
        let (id, _, url) = crate::problem_link(&problem.url).ok_or("不支援的題目網址。")?;
        let (_, samples) = codeforces_content(&id, &url).await?;
        if samples.is_empty() {
            return Err("這道題沒有可匯入的範例。".into());
        }
        return Ok(samples);
    }
    let html = problem_page(&problem.url).await?;
    let mut cases = sample_cases(&html, false);
    if cases.is_empty() && problem.platform == "lc" {
        let decoded = html
            .replace("\\u003c", "<")
            .replace("\\u003e", ">")
            .replace("\\n", "\n")
            .replace("\\\"", "\"");
        cases = sample_cases(&decoded, false);
    }
    if cases.is_empty() {
        return Err("找不到可匯入的範例，可手動輸入。".into());
    }
    Ok(cases)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "macos")]
    #[test]
    fn compiles_and_compares_standard_io() {
        let result = tauri::async_runtime::block_on(cpp_check(
            "#include <iostream>\nint main() { int n; std::cin >> n; std::cout << n * 2; }".into(),
            Some(vec![
                Case {
                    input: "21".into(),
                    expected: Some("42\n".into()),
                },
                Case {
                    input: "1".into(),
                    expected: Some("3".into()),
                },
            ]),
        ))
        .unwrap();
        assert_eq!(result["ok"], true);
        assert_eq!(result["results"][0]["status"], "通過");
        assert_eq!(result["results"][1]["status"], "輸出不符");
    }

    #[test]
    fn mirror_validates_problem_and_extracts_statement_and_samples() {
        let html = r#"<script type="application/json" id="lentille-context">{"data":{"problem":{"pid":"CF474B","content":{"description":"Find the pile.","formatI":"An integer n.","formatO":"Print the index."},"samples":[["2\n","1\n"]]}}}</script>"#;
        let (statement, cases) = mirror_content(html, "CF474B").unwrap();
        assert!(statement.contains("Find the pile.") && statement.contains("An integer n."));
        assert_eq!(cases, vec![json!({"input":"2\n","expected":"1\n"})]);
        assert!(mirror_content(html, "CF474C").is_none());
    }

    #[test]
    #[ignore = "requires public problem-site network access"]
    fn reads_live_codeforces_statement_and_samples() {
        let (statement, cases) = tauri::async_runtime::block_on(codeforces_content(
            "cf:474/B",
            "https://codeforces.com/problemset/problem/474/B/",
        ))
        .unwrap();
        assert!(statement.contains("Marmot"));
        assert_eq!(cases[0]["expected"].as_str().unwrap().trim(), "1\n5\n3");
    }

    #[test]
    fn parses_samples_from_both_platforms() {
        let cf = r#"<div class="sample-test"><pre><div>1 &lt; 2</div><div>3</div></pre><pre>yes</pre></div>"#;
        assert_eq!(
            sample_cases(cf, true),
            vec![json!({"input":"1 < 2\n3","expected":"yes"})]
        );
        let lc = "<pre><strong>Input:</strong> a = [1,2]\n<strong>Output:</strong> 2\nExplanation: text</pre>";
        assert_eq!(
            sample_cases(lc, false),
            vec![json!({"input":"a = [1,2]","expected":"2"})]
        );
    }
}
