use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub trust_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelProviderConfig {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexConfig {
    #[serde(default)]
    pub projects: HashMap<String, ProjectConfig>,
    #[serde(default)]
    pub model_providers: HashMap<String, ModelProviderConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub path: String,
    pub trust_level: String,
}

pub fn get_config_path() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    Ok(home_dir.join(".codex").join("config.toml"))
}

fn load_codex_config() -> Result<CodexConfig, String> {
    let config_path = get_config_path()?;

    if !config_path.exists() {
        return Ok(CodexConfig {
            projects: HashMap::new(),
            model_providers: HashMap::new(),
        });
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    toml::from_str(&content).map_err(|e| format!("Failed to parse config file: {}", e))
}

#[command]
pub async fn read_codex_config() -> Result<Vec<Project>, String> {
    let config = load_codex_config()?;

    let projects: Vec<Project> = config
        .projects
        .into_iter()
        .map(|(path, project_config)| Project {
            path,
            trust_level: project_config.trust_level,
        })
        .collect();

    Ok(projects)
}

#[command]
pub async fn read_providers() -> Result<HashMap<String, ModelProviderConfig>, String> {
    let config = load_codex_config()?;
    Ok(config.model_providers)
}
