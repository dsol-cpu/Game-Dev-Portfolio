use serde::Serialize;

#[derive(Serialize)]
pub struct PageStats {
    pub times_visited: String,
    pub unique_visitors: String,
    pub country_visitors: String,
}
