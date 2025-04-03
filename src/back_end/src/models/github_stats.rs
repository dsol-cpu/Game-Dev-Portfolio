use chrono::{ DateTime, Utc };
use serde::{ Deserialize, Serialize };

#[derive(Serialize, Deserialize)]
pub struct Repository {
    pub name: String,
    pub updated_at: String,
    pub pushed_at: String,
    pub cached: String, // Added to indicate if data came from cache
    pub cache_age: DateTime<Utc>, // Optional: time since last cache update in seconds
}

#[derive(Serialize, Deserialize)]
pub struct CachedRepository {
    pub last_updated: DateTime<Utc>,
    pub stats: Repository,
}
