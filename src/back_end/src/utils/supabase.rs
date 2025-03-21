use std::{ collections::HashSet, env };
use supabase_rs::SupabaseClient;

/// Loads trusted origins from the environment variable into a HashSet.
fn load_trusted_origins() -> HashSet<String> {
    dotenv::dotenv().ok();
    env::var("TRUSTED_ORIGINS")
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .collect()
}

/// Validates the given origin against trusted origins.
pub fn validate_origin(origin: &str) -> Result<(), String> {
    let trusted_origins = load_trusted_origins();
    if trusted_origins.contains(origin) {
        Ok(())
    } else {
        Err(format!("Origin '{}' is not allowed", origin))
    }
}

/// Initializes the Supabase client. Panics if credentials are missing.
pub async fn init_supabase_client() -> SupabaseClient {
    dotenv::dotenv().ok();
    let db_url = env::var("SUPABASE_DB_URL").expect("SUPABASE_DB_URL must be set");
    let db_key = env::var("SUPABASE_DB_KEY").expect("SUPABASE_DB_KEY must be set");

    SupabaseClient::new(db_url, db_key).expect("Failed to create Supabase client")
}
