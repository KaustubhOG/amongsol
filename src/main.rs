use clap::{Parser, Subcommand};
use todo::storage::{load_todo, save_todos};

use todo::todo_struct::Todo;

#[derive(Parser)]
#[command(name = "todo")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Add { title: String },
    List,
    Done { id: usize },
    Remove { id: usize },
}

fn main() {
    let args = Cli::parse();

    match args.command {
        Commands::Add { title } => {
            let mut todos = load_todo();
            let id = todos.len() + 1;
            let title = title;

            let new_todo = Todo {
                id: id,
                title: title.clone(),
                done: false,
            };
            todos.push(new_todo);
            save_todos(todos);

            println!("Added {}", title);
        }
        Commands::List => {
            let todos = load_todo();
            for a in todos {
                println!("{}. [{}] {}", a.id, if a.done { "x" } else { " " }, a.title);
            }
        }
        Commands::Done { id } => {
            let mut todos = load_todo();
            for a in todos.iter_mut() {
                if id == a.id {
                    a.done = true
                }
            }
            save_todos(todos);
            println!("Marked {} as done", id);
        }
        Commands::Remove { id } => {
            let mut todos = load_todo();
            todos.retain(|a| a.id != id);
            save_todos(todos);
            println!("Removed {}", id);
        }
    }
}
