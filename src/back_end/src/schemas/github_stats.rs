use async_graphql::{ InputObject, SimpleObject };
use serde::{ Deserialize, Serialize };
use crate::types::graphql::DateTimeScalar;

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct Language {
    name: String,
    color: String,
}

#[derive(InputObject)]
pub struct LastUpdated {
    pub last_updated_at: DateTimeScalar,
}

#[derive(SimpleObject, Serialize, Deserialize)]
pub struct Repository {
    pub name: String,
    pub description: String,
    pub stargazer_count: u32,
    pub fork_count: u32,
    pub primary_language: String,
    pub last_updated_at: DateTimeScalar,
}
