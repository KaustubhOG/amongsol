use std::fs;

use crate::todo_struct::Todo;
use dirs;

pub fn load_todo() -> Vec<Todo> {
    let mut path = dirs::home_dir().unwrap();
    path.push(".todos.json");
    if !path.exists() {
        return Vec::new();
    }
    let your_string = fs::read_to_string(&path).unwrap();
    serde_json::from_str(&your_string).unwrap()
}

pub fn save_todos(todo: Vec<Todo>) {
    let mut path = dirs::home_dir().unwrap();
    path.push(".todos.json");
    let a = serde_json::to_string_pretty(&todo).unwrap();
    fs::write(path, a).unwrap();
}
