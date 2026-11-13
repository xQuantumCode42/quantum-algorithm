use super::{external, write_atomic, App, Problem, Result};
use serde::Deserialize;
use serde_json::Value;
use std::{collections::BTreeMap, fs, path::Path};
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

#[derive(Deserialize, serde::Serialize)]
pub struct Topic {
    pub name: String,
    slug: String,
    cf: String,
}

pub type Topics = BTreeMap<String, Topic>;

fn identifier(input: &str) -> bool {
    !input.is_empty() && input.len() <= 50 && input.bytes().all(|b|
        b.is_ascii_alphanumeric() || b"_.-".contains(&b)) && input != "." && input != ".."
}

#[tauri::command]
pub fn open_judge(window: AppHandle, app: State<App>, platform: String, action: String, topic: String) -> Result<()> {
    let url = match (platform.as_str(), action.as_str()) {
        ("lc", "account") => "https://leetcode.com/accounts/login/".to_string(),
        ("cf", "account") => "https://codeforces.com/enter".to_string(),
        ("lc", "profile") | ("cf", "profile") => {
            let config = app.settings.lock().unwrap();
            let handle = if platform == "lc" { &config.lc } else { &config.cf };
            if !identifier(handle) { return Err("請先儲存有效的使用者名稱。".into()); }
            let base = if platform == "lc" { "https://leetcode.com/u" } else { "https://codeforces.com/profile" };
            format!("{base}/{handle}/")
        }
        ("lc", "catalog") => {
            let tag = app.catalog.topics.get(&topic).ok_or("找不到這個主題。")?;
            format!("https://leetcode.com/tag/{}/", tag.slug)
        }
        ("cf", "catalog") => "https://codeforces.com/problemset".into(),
        ("chatgpt", "usage") => "https://chatgpt.com/settings/usage".into(),
        _ => return Err("不支援的網站操作。".into()),
    };
    window.opener().open_url(url, None::<&str>).map_err(|_| "無法開啟系統瀏覽器。".into())
}

fn stars(rating: u64) -> u8 {
    match rating {
        ..=800 => 1, 801..=1000 => 2, 1001..=1200 => 3,
        1201..=1400 => 4, 1401..=1600 => 5, 1601..=1800 => 6,
        1801..=2100 => 7, 2101..=2400 => 8, _ => 9,
    }
}

fn problem(row: &Value, topics: &Topics) -> Option<Problem> {
    let contest = row["contestId"].as_u64()?;
    let index = row["index"].as_str()?;
    if !identifier(index) { return None; }
    let rating = row["rating"].as_u64()?;
    let tags: Vec<String> = topics.iter().filter(|(_, t)| !t.cf.is_empty()
        && row["tags"].as_array().is_some_and(|tags| tags.iter().any(|tag| tag == &t.cf)))
        .map(|(id, _)| id.clone()).collect();
    let topic = tags.first()?.clone();
    Some(Problem {
        id: format!("cf:{contest}/{index}"), platform: "cf".into(), title: row["name"].as_str()?.into(),
        topic, level: stars(rating), focus: "implementation".into(), hint: String::new(),
        url: format!("https://codeforces.com/problemset/problem/{contest}/{index}"),
        tags, rating: Some(rating),
    })
}

pub fn load_cache(dir: &Path, topics: &Topics) -> Vec<Problem> {
    let Ok(file) = fs::File::open(dir.join("codeforces-catalog.json")) else { return Vec::new(); };
    let Ok(rows) = serde_json::from_reader::<_, Vec<Value>>(file) else { return Vec::new(); };
    rows.iter().filter_map(|r| problem(r, topics)).collect()
}

#[tauri::command]
pub async fn refresh_codeforces_catalog(app: State<'_, App>) -> Result<usize> {
    let data = external(app.http.get("https://codeforces.com/api/problemset.problems")).await?;
    let rows = data["result"]["problems"].as_array().filter(|_| data["status"] == "OK")
        .ok_or("Codeforces 沒有回傳題庫。")?;
    let problems: Vec<_> = rows.iter().filter_map(|r| problem(r, &app.catalog.topics)).collect();
    if problems.is_empty() { return Err("Codeforces 題庫沒有可用的分級題目。".into()); }
    let serialized = serde_json::to_string(rows).map_err(|e| e.to_string())?;
    write_atomic(&app.dir.join("codeforces-catalog.json"), &serialized)?;
    let count = problems.len();
    *app.remote.lock().unwrap() = problems;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rating_bands() {
        assert_eq!([800,1000,1200,1400,1600,1800,2100,2400,3500].map(stars), [1,2,3,4,5,6,7,8,9]);
    }
}

