use std::sync::Arc;

use deadpool_postgres::Pool;
use crate::{
    constants::{ GITHUB_USERNAME, REPOSITORIES },
    schemas::{ github_stats::Repository, page_stats::PageStats },
    types::error::ApiError,
};

use super::github::GithubClient;

pub async fn fetch_github_stats(
    client: impl std::future::Future<Output = Arc<GithubClient>>
) -> Vec<Repository> {
    let client = client.await;
    let mut repositories = Vec::new();

    for repo in REPOSITORIES.iter().filter(|r| !r.is_empty()) {
        match client.get_repository(GITHUB_USERNAME, repo).await {
            Ok(repo_data) => repositories.push(repo_data),
            Err(e) => eprintln!("Failed to fetch repository {}: {}", repo, e),
        }
    }

    repositories
}
