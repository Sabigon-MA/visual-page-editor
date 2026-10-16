// 既存サイトの見た目調整：調整するプロジェクトの開発サーバー（Vite）を起動・停止し、
// そのプロジェクトのファイルを読み書きする。書き込むのは CSS と、エントリーファイルへの import 1行だけ（画面側で決める）。
use std::io::{BufRead, BufReader, Read};
use std::net::TcpListener;
use std::path::{Component, Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

const LOG_MAX: usize = 20_000;

#[derive(Default)]
pub struct Tune {
  child: Mutex<Option<Child>>,
  log: Arc<Mutex<String>>,
}

#[derive(serde::Serialize)]
pub struct TuneStatus {
  running: bool,
  log: String,
}

impl Tune {
  pub fn stop(&self) {
    if let Some(mut child) = self.child.lock().unwrap().take() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }
}

// プロセスの出力を、末尾 LOG_MAX 文字だけ残してためる
fn collect(stream: impl Read + Send + 'static, log: Arc<Mutex<String>>) {
  std::thread::spawn(move || {
    for line in BufReader::new(stream).lines().map_while(Result::ok) {
      let mut log = log.lock().unwrap();
      log.push_str(&line);
      log.push('\n');
      if log.len() > LOG_MAX {
        let mut cut = log.len() - LOG_MAX;
        while !log.is_char_boundary(cut) {
          cut += 1;
        }
        log.drain(..cut);
      }
    }
  });
}

// プロジェクトのフォルダの中の相対パスだけを許す（.. や絶対パスは不可）
fn inside(dir: &str, rel: &str) -> Result<PathBuf, String> {
  let rel_path = Path::new(rel);
  if rel.is_empty() || !rel_path.components().all(|c| matches!(c, Component::Normal(_))) {
    return Err(format!("プロジェクトの外のパスです: {rel}"));
  }
  Ok(Path::new(dir).join(rel_path))
}

#[tauri::command]
pub fn tune_start(state: tauri::State<Tune>, dir: String, runner: String, inspector: String) -> Result<u16, String> {
  state.stop();
  state.log.lock().unwrap().clear();
  let root = PathBuf::from(&dir);
  if !root.join("package.json").is_file() {
    return Err("package.json がないフォルダです。プロジェクトのフォルダ（package.json があるところ）を選んでください。".into());
  }
  let tmp = std::env::temp_dir().join("pageedit-tune");
  let runner_path = tmp.join("runner.mjs");
  let inspector_path = tmp.join("inspector.js");
  std::fs::create_dir_all(&tmp)
    .and_then(|_| std::fs::write(&runner_path, runner))
    .and_then(|_| std::fs::write(&inspector_path, inspector))
    .map_err(|e| format!("作業用のファイルを作れませんでした: {e}"))?;

  // 空いているポートを選ぶ
  let port = TcpListener::bind("127.0.0.1:0")
    .and_then(|l| l.local_addr())
    .map_err(|e| format!("ポートを確保できませんでした: {e}"))?
    .port();

  let mut cmd = Command::new("node");
  cmd
    .arg(&runner_path)
    .arg(&root)
    .arg(port.to_string())
    .arg(&inspector_path)
    .current_dir(&root)
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW：コンソールを出さない
  }
  let mut child = cmd
    .spawn()
    .map_err(|e| format!("Node.js を起動できませんでした（{e}）。Node.js をインストールしてから、もう一度開いてください。"))?;
  if let Some(out) = child.stdout.take() {
    collect(out, state.log.clone());
  }
  if let Some(err) = child.stderr.take() {
    collect(err, state.log.clone());
  }
  *state.child.lock().unwrap() = Some(child);
  Ok(port)
}

#[tauri::command]
pub fn tune_status(state: tauri::State<Tune>) -> TuneStatus {
  let mut child = state.child.lock().unwrap();
  let running = match child.as_mut() {
    Some(c) => matches!(c.try_wait(), Ok(None)),
    None => false,
  };
  TuneStatus { running, log: state.log.lock().unwrap().clone() }
}

#[tauri::command]
pub fn tune_stop(state: tauri::State<Tune>) {
  state.stop();
}

// ファイルがなければ None
#[tauri::command]
pub fn tune_read(dir: String, path: String) -> Result<Option<String>, String> {
  let p = inside(&dir, &path)?;
  if !p.is_file() {
    return Ok(None);
  }
  std::fs::read_to_string(&p).map(Some).map_err(|e| format!("{path} を読み込めませんでした: {e}"))
}

#[tauri::command]
pub fn tune_write(dir: String, path: String, content: String) -> Result<(), String> {
  let p = inside(&dir, &path)?;
  std::fs::write(&p, content).map_err(|e| format!("{path} に書き込めませんでした: {e}"))
}
