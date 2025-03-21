use std::{ env, sync::Arc };
use actix_web::{ get, HttpResponse, Responder };
use redis::{ Client as RedisClient, Commands };
use serde::{ Deserialize, Serialize };
use futures::future::try_join_all;

use crate::{
    constants::{ GITHUB_API_TOKEN, GITHUB_USERNAME, REDIS_URL, REPOSITORIES },
    types::error::ApiError,
    utils::github::{ create_github_client, GithubClient },
    schemas::github_stats,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedRepository {
    pub name: String,
    pub description: Option<String>,
    pub stars: u32,
    pub forks: u32,
    pub updated_at: String,
    #[serde(rename = "cached_at")]
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl From<github_stats::Repository> for CachedRepository {
    fn from(repo: github_stats::Repository) -> Self {
        Self {
            name: repo.name,
            description: Some(repo.description), // Fixed: Convert to Option<String>
            stars: repo.stargazer_count,
            forks: repo.fork_count,
            updated_at: repo.last_updated_at.to_string(), // Fixed: Proper conversion to String
            timestamp: chrono::Utc::now(),
        }
    }
}

pub struct GithubCache {
    redis: RedisClient,
    github: Arc<GithubClient>,
    username: String,
    cache_ttl: u64,
}

impl GithubCache {
    pub async fn new(
        redis_url: &str,
        github_token: &str,
        username: &str
    ) -> Result<Self, ApiError> {
        let redis = RedisClient::open(redis_url).map_err(|e| ApiError::RedisError(e.to_string()))?;
        let github = create_github_client(github_token.to_string()).await.map_err(|e|
            ApiError::GithubError(e.to_string())
        )?;

        Ok(Self {
            redis,
            github,
            username: username.to_string(),
            cache_ttl: 3600,
        })
    }

    async fn get_cached_repo(&self, repo: &str) -> Result<Option<CachedRepository>, ApiError> {
        let mut conn = self.redis
            .get_connection()
            .map_err(|e| ApiError::RedisError(e.to_string()))?;
        let key = self.cache_key(repo);

        match conn.get::<_, String>(&key) {
            Ok(data) => {
                serde_json
                    ::from_str(&data)
                    .map_err(|e| ApiError::SerializationError(e.to_string()))
                    .map(Some)
            }
            Err(_) => Ok(None),
        }
    }

    async fn fetch_and_cache_repo(&self, repo: &str) -> Result<CachedRepository, ApiError> {
        let github = self.github.as_ref();

        let repo_data = github
            .get_repository(&self.username, repo).await
            .map_err(|e| ApiError::GithubError(e.to_string()))?;

        let cached_repo = CachedRepository::from(repo_data);

        let mut conn = self.redis
            .get_connection()
            .map_err(|e| ApiError::RedisError(e.to_string()))?;
        let key = self.cache_key(repo);
        let json = serde_json
            ::to_string(&cached_repo)
            .map_err(|e| ApiError::SerializationError(e.to_string()))?;

        conn
            .set_ex::<_, _, ()>(&key, json, self.cache_ttl.try_into().unwrap()) // Fixed: proper type conversion
            .map_err(|e| ApiError::RedisError(e.to_string()))?;

        Ok(cached_repo)
    }

    fn cache_key(&self, repo: &str) -> String {
        format!("github_repo:{}:{}", self.username, repo)
    }

    pub async fn get_repository(&self, repo: &str) -> Result<CachedRepository, ApiError> {
        match self.get_cached_repo(repo).await? {
            Some(cached) => Ok(cached),
            None => self.fetch_and_cache_repo(repo).await,
        }
    }
}

#[get("/github-repos")]
pub async fn get_user_repos() -> Result<impl Responder, ApiError> {
    // let redis_url = env::var(REDIS_URL).map_err(|e| ApiError::RedisError(e.to_string()))?;
    // let github_token = env::var(GITHUB_API_TOKEN).map_err(|e| ApiError::EnvError(e.to_string()))?;

    // let cache = GithubCache::new(&redis_url, &github_token, GITHUB_USERNAME).await?;

    // let repo_futures: Vec<_> = REPOSITORIES.iter()
    //     .filter(|r| !r.is_empty())
    //     .map(|repo| cache.get_repository(repo))
    //     .collect();

    // let results = try_join_all(repo_futures).await?;

    // if results.is_empty() {
    //     Ok(
    //         HttpResponse::NotFound().json(
    //             serde_json::json!({
    //                 "error": "No repositories found"
    //             })
    //         )
    //     )
    // } else {
    Ok(HttpResponse::Ok().json("yay"))
    // }
}
