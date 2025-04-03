use actix_web::{ web, FromRequest, HttpRequest, HttpResponse };
use async_graphql::{ Context, Schema, Object, Result };
use std::sync::Arc;
use crate::{
    schemas::github_stats::{ LastUpdated, Repository },
    types::error::ApiError,
    types::graphql::DateTimeScalar,
};
use octocrab::Octocrab;

pub struct GithubClient {
    client: Octocrab,
    token: String,
}

impl GithubClient {
    pub async fn new(token: String) -> Result<Self, ApiError> {
        let client = Octocrab::builder()
            .personal_token(token.clone())
            .build()
            .map_err(|err|
                ApiError::ExternalError(format!("Failed to create Octocrab client: {}", err))
            )?;
        Ok(Self { client, token })
    }

    pub async fn get_repository(&self, owner: &str, name: &str) -> Result<Repository, ApiError> {
        let repo = self.client
            .repos(owner, name)
            .get().await
            .map_err(|err| ApiError::ExternalError(format!("Failed to get repository: {}", err)))?;

        let languages = self.client
            .repos(owner, name)
            .list_languages().await
            .map_err(|err| ApiError::ExternalError(format!("Failed to get languages: {}", err)))?;

        // Get the primary language (first in the list)
        let primary_language = languages
            .into_iter()
            .next()
            .map(|(name, _)| {
                Box::new(LastUpdated {
                    last_updated_at: DateTimeScalar(chrono::Utc::now()),
                })
            });

        Ok(Repository {
            name: repo.name,
            description: repo.description.unwrap_or_default(),
            stargazer_count: repo.stargazers_count.unwrap_or(0) as u32,
            fork_count: repo.forks_count.unwrap_or(0) as u32,
            primary_language: repo.language.unwrap_or_default().to_string(),
            last_updated_at: repo.updated_at
                .map(DateTimeScalar)
                .unwrap_or_else(|| DateTimeScalar(chrono::Utc::now())),
        })
    }
}

struct QueryRoot;

#[Object]
impl QueryRoot {
    async fn repository(
        &self,
        ctx: &Context<'_>,
        owner: String,
        name: String
    ) -> async_graphql::Result<Repository> {
        let github = ctx.data::<Arc<GithubClient>>()?;
        github
            .get_repository(&owner, &name).await
            .map_err(|e| async_graphql::Error::new(format!("{}", e)))
    }
}

type ApiSchema = Schema<QueryRoot, async_graphql::EmptyMutation, async_graphql::EmptySubscription>;

async fn graphql_handler(
    schema: web::Data<ApiSchema>,
    req: HttpRequest,
    payload: web::Payload
) -> actix_web::Result<HttpResponse> {
    let request = async_graphql_actix_web::GraphQLRequest
        ::from_request(&req, &mut payload.into_inner()).await?
        .into_inner();
    let response = schema.execute(request).await;
    Ok(HttpResponse::Ok().json(response))
}

pub async fn create_github_client(token: String) -> Result<Arc<GithubClient>, ApiError> {
    let client = GithubClient::new(token).await?;
    Ok(Arc::new(client))
}

pub fn create_graphql_schema(github_client: Arc<GithubClient>) -> ApiSchema {
    Schema::build(QueryRoot, async_graphql::EmptyMutation, async_graphql::EmptySubscription)
        .data(github_client)
        .finish()
}
