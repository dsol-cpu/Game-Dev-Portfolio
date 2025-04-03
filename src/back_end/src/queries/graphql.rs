use serde::Serialize;

// GraphQL query struct
#[derive(Serialize)]
pub struct Query {
    pub query: String,
    pub variables: Option<serde_json::Value>,
}
