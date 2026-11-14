# Quantum Algorithm Desktop

Windows x64 桌面版。雙擊 **Quantum Algorithm.exe** 開啟。系統需要 Microsoft Edge WebView2 Runtime。Windows 版使用 Tauri、React、TypeScript 和 Rust。

- 下拉選單收錄 LeetCode 官方列出的語言及題庫標籤。每個標籤可開啟官方主題頁。內建 LeetCode 題目是精選子集。
- 難度為 1–9 星。LeetCode 的 Easy／Medium／Hard 分別對應 1–3／4–6／7–9 星，內建題目使用 App 評級。Codeforces 使用官方 rating 分段。
- Codeforces 題庫可在練習區匿名下載，下載後可離線選題。設定區可登入平台網站、開啟已儲存的公開個人頁，並以 Codeforces handle 同步最近 500 筆公開提交的 Accepted 題。LeetCode 練習結果在本機筆記記錄。
- 到「設定 → ChatGPT 訂閱」點 Continue with ChatGPT，使用系統瀏覽器登入並同意訂閱用量。App 使用該帳號提供的模型。登入續期憑證由系統憑證庫保存，重開 App 時會自動恢復授權。
- 筆記預設放在 App 的本機資料目錄下。可在設定切換到 Obsidian vault 或專案既有的 notes/。
- 從「練習筆記」刪除的檔案會移到筆記資料夾內的 .quantum-trash。要復原時，把 Markdown 檔移回筆記資料夾即可。

## 從原始碼建置

安裝 Node.js、Rust，以及對應平台的 Tauri [建置工具](https://v2.tauri.app/start/prerequisites/)。

```powershell
npm ci
npm run typecheck
npm run build
cargo build --locked --release --manifest-path src-tauri/Cargo.toml
```

Windows x64 的可執行檔位於 `src-tauri/target/release/quantum-algorithm.exe`。macOS 與 Linux 可沿用同一份原始碼，正式發佈前需各自建置和測試。

## 專案結構

- src/ 包含 React／TypeScript 介面。
- src-tauri/ 包含 Rust 應用邏輯、題庫和 Tauri 設定。
- Quantum Algorithm.exe 是現成的 Windows x64 執行檔，可直接從根目錄開啟。
