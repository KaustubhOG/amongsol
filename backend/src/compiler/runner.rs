use std::fs;
use std::path::{Path, PathBuf};
use tokio::process::Command;

use crate::game::session::TestResult;

pub async fn run_tests(
    challenge_id: &str,
    function_name: &str,
    new_code: &str,
) -> Vec<TestResult> {
    let challenges_dir = Path::new("../challenges");
    let source_dir = challenges_dir.join(challenge_id);
    let temp_id = uuid::Uuid::new_v4().to_string();
    let temp_dir = Path::new("/tmp").join(&temp_id);

    if let Err(_) = copy_dir(&source_dir, &temp_dir) {
        return error_results();
    }

    let lib_path = temp_dir.join("src/lib.rs");
    let original = match fs::read_to_string(&lib_path) {
        Ok(s) => s,
        Err(_) => return error_results(),
    };

    let updated = replace_function(&original, function_name, new_code);
    if fs::write(&lib_path, updated).is_err() {
        return error_results();
    }

    let output = Command::new("cargo")
        .args(["test", "--color", "never"])
        .current_dir(&temp_dir)
        .output()
        .await;

    let _ = fs::remove_dir_all(&temp_dir);

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let stderr = String::from_utf8_lossy(&out.stderr);
            parse_results(&stdout, &stderr)
        }
        Err(_) => error_results(),
    }
}

fn replace_function(source: &str, fn_name: &str, new_code: &str) -> String {
    let marker = format!("pub fn {}(", fn_name);
    let start = match source.find(&marker) {
        Some(i) => i,
        None => return source.to_string(),
    };

    let mut depth = 0usize;
    let mut end = start;
    let mut opened = false;

    for (i, ch) in source[start..].char_indices() {
        match ch {
            '{' => {
                depth += 1;
                opened = true;
            }
            '}' => {
                if opened {
                    depth -= 1;
                    if depth == 0 {
                        end = start + i + 1;
                        break;
                    }
                }
            }
            _ => {}
        }
    }

    format!("{}{}{}", &source[..start], new_code, &source[end..])
}

fn parse_results(stdout: &str, _stderr: &str) -> Vec<TestResult> {
    let mut results = vec![];

    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("test ") {
            if trimmed.ends_with("... ok") {
                let name = trimmed
                    .trim_start_matches("test ")
                    .trim_end_matches(" ... ok")
                    .to_string();
                results.push(TestResult { name, passed: true });
            } else if trimmed.ends_with("... FAILED") {
                let name = trimmed
                    .trim_start_matches("test ")
                    .trim_end_matches(" ... FAILED")
                    .to_string();
                results.push(TestResult { name, passed: false });
            }
        }
    }

    if results.is_empty() {
        error_results()
    } else {
        results
    }
}

fn error_results() -> Vec<TestResult> {
    vec![
        TestResult { name: "test_runner_error".to_string(), passed: false },
    ]
}

fn copy_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let dst_path = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &dst_path)?;
        } else {
            fs::copy(entry.path(), dst_path)?;
        }
    }
    Ok(())
}