use super::{external, write_atomic, App, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use jsonwebtoken::{decode, decode_header, jwk::JwkSet, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, fs, time::Duration};
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;
use tokio::{io::{AsyncReadExt, AsyncWriteExt}, net::TcpListener, time::timeout};
use uuid::Uuid;

const ISSUER: &str = "https://auth.openai.com";
const TOKEN: &str = "https://auth.openai.com/api/accounts/oauth/token";
const API: &str = "https://api.openai.com/v1";
const SHARE: &str = "chatgpt.tokens.use.direct";
const CALLBACK: &str = "/auth/callback";

#[derive(Default, Deserialize, Serialize)]
#[serde(default)]
pub struct Registration {
    host: String,
    client: String,
    subject: String,
    pub email: String,
}

#[derive(Deserialize)]
struct Claims {
    sub: String,
    nonce: String,
    iat: i64,
    email: Option<String>,
}

#[derive(Deserialize)]
struct Grant {
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
    scope: Option<String>,
    expires_in: i64,
}

#[derive(Serialize)]
struct Model {
    slug: String,
    name: String,
}

pub struct Session {
    client: String,
    pub email: String,
    access: String,
    refresh: Option<String>,
    expires: i64,
    models: Vec<Model>,
    selected: String,
}

fn grant_permission(grant: &Grant, inherited: bool) -> Result<()> {
    if grant.access_token.is_empty() || grant.expires_in <= 0 {
        return Err("ChatGPT 回傳的授權憑證無效。".into());
    }
    if !grant.scope.as_deref().map(|s| s.split_whitespace().any(|v| v == SHARE)).unwrap_or(inherited) {
        return Err("這個帳號尚未授權 App 使用 ChatGPT 訂閱。請重新登入並允許訂閱用量。".into());
    }
    Ok(())
}

async fn exchange(app: &App, form: &[(&str, &str)]) -> Result<Grant> {
    serde_json::from_value(external(app.http.post(TOKEN).form(form)).await?)
        .map_err(|_| "ChatGPT 回傳的登入資料無法辨識。".into())
}

async fn verified_identity(app: &App, token: &str, client: &str, nonce: &str) -> Result<Claims> {
    let invalid = || "無法驗證 ChatGPT 帳號身分。".to_string();
    let header = decode_header(token).map_err(|_| invalid())?;
    if header.alg != Algorithm::RS256 { return Err(invalid()); }
    let keys: JwkSet = serde_json::from_value(external(
        app.http.get(format!("{ISSUER}/.well-known/jwks.json"))
    ).await?).map_err(|_| invalid())?;
    let jwk = keys.find(header.kid.as_deref().ok_or_else(invalid)?).ok_or_else(invalid)?;
    let key = DecodingKey::from_jwk(jwk).map_err(|_| invalid())?;
    let mut check = Validation::new(Algorithm::RS256);
    check.set_issuer(&[ISSUER]);
    check.set_audience(&[client]);
    check.set_required_spec_claims(&["exp", "iss", "aud", "sub"]);
    check.validate_nbf = true;
    check.leeway = 5;
    let claims = decode::<Claims>(token, &key, &check).map_err(|_| invalid())?.claims;
    if claims.sub.trim().is_empty() || claims.nonce != nonce || claims.iat > chrono::Utc::now().timestamp() + 5 {
        return Err(invalid());
    }
    Ok(claims)
}

fn parse_callback(request: &str, origin: &str, state: &str) -> Option<BTreeMap<String, String>> {
    let mut request = request.lines().next()?.split_whitespace();
    if request.next()? != "GET" { return None; }
    let target = request.next()?;
    if !target.starts_with("/auth/callback?") { return None; }
    let url = reqwest::Url::parse(&format!("{origin}{target}")).ok()?;
    let mut params = BTreeMap::new();
    for (key, value) in url.query_pairs() {
        if params.insert(key.into_owned(), value.into_owned()).is_some() { return None; }
    }
    (url.path() == CALLBACK && params.get("state")? == state).then_some(params)
}

async fn browser_callback(listener: TcpListener, origin: &str, state: &str) -> Result<BTreeMap<String, String>> {
    timeout(Duration::from_secs(180), async {
        loop {
            let (mut stream, _) = listener.accept().await.map_err(|_| "登入回呼連線失敗。")?;
            let mut bytes = Vec::with_capacity(2048);
            let complete = timeout(Duration::from_secs(2), async {
                let mut buffer = [0; 2048];
                while bytes.len() < 16384 {
                    let count = stream.read(&mut buffer).await.ok()?;
                    if count == 0 { return None; }
                    bytes.extend_from_slice(&buffer[..count]);
                    if bytes.windows(4).any(|v| v == b"\r\n\r\n") { return Some(()); }
                }
                None
            }).await.ok().flatten().is_some();
            let params = complete.then(|| parse_callback(&String::from_utf8_lossy(&bytes), origin, state)).flatten();
            let (status, body) = if params.is_some() {
                ("200 OK", "Received. Return to Quantum Algorithm to see the sign-in result.")
            } else { ("400 Bad Request", "Invalid sign-in callback.") };
            let reply = format!("HTTP/1.1 {status}\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{body}", body.len());
            let _ = timeout(Duration::from_secs(2), stream.write_all(reply.as_bytes())).await;
            if let Some(params) = params { return Ok(params); }
        }
    }).await.map_err(|_| "等待 ChatGPT 登入逾時，請再試一次。".to_string())?
}

fn save_registration(app: &App, registration: &Registration) -> Result<()> {
    write_atomic(&app.dir.join("chatgpt-registration.json"),
        &serde_json::to_string(registration).map_err(|e| e.to_string())?)
}

pub fn registration(app: &App) -> Result<Registration> {
    match fs::read(app.dir.join("chatgpt-registration.json")) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|_| "ChatGPT 本機註冊資料無法讀取。".into()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Registration::default()),
        Err(e) => Err(super::io_error(e)),
    }
}

#[tauri::command]
pub async fn chatgpt_sign_in(window: AppHandle, app: State<'_, App>, new_account: bool) -> Result<()> {
    let mut active = app.chatgpt.try_lock().map_err(|_| "已有 ChatGPT 操作正在執行。")?;
    let mut saved = registration(&app)?;
    if saved.host.is_empty() {
        saved.host = format!("urn:uuid:{}", Uuid::new_v4());
        save_registration(&app, &saved)?;
    }
    let returning = !new_account && !saved.client.is_empty();
    let client = if returning { saved.client.as_str() } else { "dynamic_agent_client" };
    let verifier = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let state = Uuid::new_v4().to_string();
    let nonce = Uuid::new_v4().to_string();
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.map_err(super::io_error)?;
    let origin = format!("http://{}", listener.local_addr().map_err(super::io_error)?);
    let redirect = format!("{origin}{CALLBACK}");
    let mut authorization = reqwest::Url::parse(&format!("{ISSUER}/api/accounts/authorize")).unwrap();
    {
        let mut query = authorization.query_pairs_mut();
        query.extend_pairs([
            ("client_id",client), ("response_type","code"), ("redirect_uri",&redirect),
            ("scope","openid profile email offline_access resource.invoke chatgpt.tokens.use.direct"),
            ("resource",API), ("state",&state), ("nonce",&nonce), ("ext_agent_host_id",&saved.host),
            ("code_challenge",&challenge), ("code_challenge_method","S256"),
        ]);
        if !returning { query.append_pair("agent_name_hint", "Quantum Algorithm"); }
    }
    window.opener().open_url(authorization.as_str(), None::<&str>)
        .map_err(|_| "無法開啟系統瀏覽器。")?;
    let params = browser_callback(listener, &origin, &state).await?;
    if params.contains_key("error") { return Err("ChatGPT 登入取消或授權遭拒。".into()); }
    let code = params.get("code").filter(|s| !s.is_empty()).ok_or("缺少 ChatGPT 授權碼。")?;
    let issued = match params.get("client_id") {
        Some(id) if returning && id == client => id.as_str(),
        None if returning => client,
        Some(id) if !returning && id.starts_with("oaiapp_")
            && id.bytes().all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b)) => id.as_str(),
        _ => return Err("ChatGPT 回傳的註冊識別碼不符。".into()),
    };
    let grant = exchange(&app, &[("grant_type","authorization_code"),("client_id",issued),("code",code),
        ("code_verifier",&verifier),("redirect_uri",&redirect),("resource",API)]).await?;
    let identity = verified_identity(&app, grant.id_token.as_deref().ok_or("缺少 ChatGPT 身分憑證。")?,
        issued, &nonce).await?;
    if returning && saved.subject != identity.sub { return Err("登入帳號與上次的帳號不符。".into()); }
    grant_permission(&grant, false)?;
    let model_data = external(app.http.get(format!("{API}/models")).bearer_auth(&grant.access_token)).await?;
    let models: Vec<Model> = model_data["models"].as_array().into_iter().flatten()
        .filter(|m| m["visibility"] == "list")
        .filter_map(|m| Some(Model { slug: m["slug"].as_str()?.into(), name: m["display_name"].as_str()?.into() }))
        .collect();
    let selected = models.first().ok_or("這個 ChatGPT 帳號目前沒有可使用的模型。")?.slug.clone();
    saved.client = issued.into();
    saved.subject = identity.sub;
    saved.email = identity.email.unwrap_or_default();
    save_registration(&app, &saved)?;
    *active = Some(Session { client: saved.client, email: saved.email, access: grant.access_token,
        refresh: grant.refresh_token, expires: chrono::Utc::now().timestamp().saturating_add(grant.expires_in), models, selected });
    Ok(())
}

pub async fn info(app: &App) -> Value {
    let session = app.chatgpt.lock().await;
    match session.as_ref() {
        Some(s) => json!({"connected":true,"registered":true,"email":s.email,"models":s.models,"selected":s.selected}),
        None => {
            let saved = registration(app).unwrap_or_default();
            json!({"connected":false,"registered":!saved.client.is_empty(),"email":saved.email,"models":[],"selected":""})
        },
    }
}

#[tauri::command]
pub async fn chatgpt_model(app: State<'_, App>, model: String) -> Result<()> {
    let mut guard = app.chatgpt.lock().await;
    let active = guard.as_mut().ok_or("請先登入 ChatGPT。")?;
    if !active.models.iter().any(|m| m.slug == model) { return Err("這個帳號沒有該模型。".into()); }
    active.selected = model;
    Ok(())
}

#[tauri::command]
pub async fn chatgpt_sign_out(app: State<'_, App>) -> Result<bool> {
    let mut guard = app.chatgpt.lock().await;
    let Some(active) = guard.take() else { return Ok(true); };
    let Some(refresh) = active.refresh else { return Ok(true); };
    let Ok(discovery) = external(app.http.get(format!("{ISSUER}/.well-known/openid-configuration"))).await else {
        return Ok(false);
    };
    let Some(endpoint) = discovery["revocation_endpoint"].as_str()
        .and_then(|v| reqwest::Url::parse(v).ok()).filter(|u| u.origin().ascii_serialization() == ISSUER)
        else { return Ok(false); };
    Ok(app.http.post(endpoint).form(&[("token",refresh.as_str()),("token_type_hint","refresh_token"),
        ("client_id",active.client.as_str())]).send().await.is_ok_and(|r| r.status().is_success()))
}

fn response_body(model: &str, instructions: &str, payload: Value) -> Value {
    json!({
        "model": model,
        "store": false,
        "stream": true,
        "instructions": instructions,
        "input": [{"role": "user", "content": payload.to_string()}]
    })
}

fn service_error(status: Option<u16>, body: &Value, request_id: Option<&str>) -> String {
    let error = body.get("error").or_else(|| body.pointer("/response/error")).unwrap_or(body);
    let code = error["code"].as_str().unwrap_or_default();
    let guidance = match (code, status) {
        ("subscription_sharing_user_not_eligible", _) => "此帳號或工作區無法使用 ChatGPT 訂閱用量。",
        ("subscription_sharing_usage_limit_exceeded", _) | (_, Some(429)) =>
            "已達 ChatGPT 使用限制。請到設定的「管理用量」查看。",
        ("model_not_found" | "model_not_supported" | "unsupported_model", _) =>
            "目前選用的模型無法處理此請求。請在設定切換模型。",
        ("subscription_sharing_unsupported_capability", _) | (_, Some(400)) =>
            "ChatGPT 不接受這個模型或請求格式。",
        ("subscription_sharing_invalid_user", _) | (_, Some(401)) =>
            "ChatGPT 未接受目前的登入授權。請在設定登出後重新登入。",
        ("subscription_sharing_usage_unavailable" | "subscription_sharing_user_unavailable", _) | (_, Some(503)) =>
            "ChatGPT 暫時無法處理訂閱請求，請稍後重試。",
        (_, Some(403)) => "ChatGPT 拒絕這次請求。請確認帳號或工作區已授權訂閱用量。",
        _ => "ChatGPT 未完成回覆，請稍後重試。",
    };
    // Only include diagnostic identifiers, never arbitrary server text that can echo the input.
    let safe = |value: &str| !value.is_empty() && value.len() <= 100
        && value.bytes().all(|b| b.is_ascii_alphanumeric() || b"_.-".contains(&b));
    let mut details = Vec::new();
    if let Some(status) = status { details.push(format!("HTTP {status}")); }
    if safe(code) { details.push(code.into()); }
    if let Some(param) = error["param"].as_str().filter(|value| safe(value)) {
        details.push(format!("欄位 {param}"));
    }
    if let Some(id) = request_id.filter(|value| safe(value)) { details.push(format!("請求 {id}")); }
    if details.is_empty() { guidance.into() }
    else { format!("{guidance}（{}）", details.join(" · ")) }
}

pub async fn ask(app: &App, instructions: &str, payload: Value) -> Result<String> {
    let (access, model) = {
        let mut guard = app.chatgpt.lock().await;
        let active = guard.as_mut().ok_or("請到設定登入 ChatGPT。")?;
        if active.expires <= chrono::Utc::now().timestamp() + 60 {
            let refresh = active.refresh.as_deref().ok_or("授權已到期，請重新登入 ChatGPT。")?;
            let grant = exchange(app, &[("grant_type","refresh_token"),("client_id",&active.client),
                ("refresh_token",refresh),("resource",API)]).await
                .map_err(|e| format!("無法續期 ChatGPT 授權，請重新登入。{e}"))?;
            grant_permission(&grant, true)?;
            active.access = grant.access_token;
            if grant.refresh_token.is_some() { active.refresh = grant.refresh_token; }
            active.expires = chrono::Utc::now().timestamp().saturating_add(grant.expires_in);
        }
        (active.access.clone(), active.selected.clone())
    };
    let mut response = app.http.post(format!("{API}/responses")).bearer_auth(access)
        .timeout(Duration::from_secs(120))
        .json(&response_body(&model, instructions, payload))
        .send().await.map_err(|e| if e.is_timeout() { "等待 ChatGPT 回覆逾時。" } else { "無法連線到 ChatGPT。" })?;
    let request_id = response.headers().get("x-request-id")
        .and_then(|value| value.to_str().ok()).map(str::to_owned);
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.json::<Value>().await.unwrap_or_default();
        return Err(service_error(Some(status), &body, request_id.as_deref()));
    }
    let mut buffer = Vec::new();
    let mut result = String::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| {
        if e.is_timeout() { "等待 ChatGPT 回覆逾時。" } else { "ChatGPT 回覆連線中斷。" }
    })? {
        buffer.extend_from_slice(&chunk);
        if buffer.len() > 2_000_000 { return Err("ChatGPT 回覆過長。".into()); }
        while let Some(index) = buffer.iter().position(|b| *b == b'\n') {
            let line: Vec<_> = buffer.drain(..=index).collect();
            let Ok(line) = std::str::from_utf8(&line) else { continue; };
            let Some(data) = line.trim_end().strip_prefix("data:") else { continue; };
            let Ok(event) = serde_json::from_str::<Value>(data.trim()) else { continue; };
            match event["type"].as_str() {
                Some("response.output_text.delta") => {
                    result.push_str(event["delta"].as_str().unwrap_or_default());
                    if result.len() > 100_000 { return Err("ChatGPT 回覆過長。".into()); }
                }
                Some("response.completed") if !result.trim().is_empty() => return Ok(result),
                Some("response.failed" | "response.incomplete" | "error") => {
                    return Err(service_error(None, &event, request_id.as_deref()));
                }
                _ => (),
            }
        }
    }
    Err("ChatGPT 未完成文字回覆。".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subscription_request_uses_message_array() {
        let context = json!({"question": "How should I choose the midpoint?"});
        let body = response_body("test-model", "Give a hint.", context.clone());
        assert_eq!(body["input"], json!([{"role": "user", "content": context.to_string()}]));
        assert_eq!(body["store"], false);
        assert_eq!(body["stream"], true);
    }

    #[test]
    fn diagnostics_keep_status_and_safe_identifiers() {
        let error = json!({"error": {"code": "subscription_sharing_unsupported_capability",
            "param": "input", "message": "Private prompt text"}});
        let message = service_error(Some(400), &error, Some("req_example"));
        for value in ["HTTP 400", "subscription_sharing_unsupported_capability", "input", "req_example"] {
            assert!(message.contains(value));
        }
        assert!(!message.contains("Private prompt text"));
    }

    #[test]
    fn callback_accepts_only_the_pending_attempt() {
        let origin = "http://127.0.0.1:1455";
        let request = |query: &str| format!("GET /auth/callback?{query} HTTP/1.1\r\n\r\n");
        let matching = parse_callback(&request("state=pending&code=a%2Bb"), origin, "pending").unwrap();
        assert_eq!(matching["code"], "a+b");
        assert!(parse_callback(&request("state=other&code=abc"), origin, "pending").is_none());
        assert!(parse_callback(&request("state=pending&state=pending&code=abc"), origin, "pending").is_none());
    }
}
