use deadpool_postgres::tokio_postgres::Row;
use serde::Serialize;

// Response type for better type safety and serialization
#[derive(Serialize)]
pub struct PageStats {
    pub page_views: u64,
    pub unique_visitors: u64,
    pub average_time_spent: f64,
    pub bounce_rate: f64,
}

impl From<Row> for PageStats {
    fn from(row: Row) -> Self {
        Self {
            page_views: row.get::<_, i64>("page_views") as u64,
            unique_visitors: row.get::<_, i64>("unique_visitors") as u64,
            average_time_spent: row.get("average_time_spent"),
            bounce_rate: row.get("bounce_rate"),
        }
    }
}
