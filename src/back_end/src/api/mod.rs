use std::env;

use actix_web::{ dev::AppConfig, get, web, HttpResponse, Responder };
use awc::Client;

use crate::{ constants::BACKEND_URL, types::error::ApiError };

mod github_stats;
mod page_stats;

#[get("/heartbeat")]
async fn heartbeat(_data: web::Data<AppConfig>) -> Result<HttpResponse, ApiError> {
    let client = Client::default();
    let backend_url = env::var(BACKEND_URL).map_err(|e| ApiError::Internal(e.to_string()))?;
    let heartbeat_url = format!("{}/heartbeat", backend_url);

    match client.get(&heartbeat_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                Ok(HttpResponse::Ok().body("Heartbeat successful!"))
            } else {
                Ok(
                    HttpResponse::InternalServerError().body(
                        format!("Backend returned non-success status: {}", response.status())
                    )
                )
            }
        }
        Err(err) => { Err(ApiError::Internal(format!("Failed to connect to backend: {}", err))) }
    }
}

#[get("/health_check")]
async fn health_check() -> impl Responder {
    HttpResponse::Ok().json({
        serde_json::json!({
            "status": "ok",
            "message": "Service is healthy"
        })
    })
}

fn api_config<F>(cfg: &mut web::ServiceConfig, service: F)
    where F: actix_web::dev::HttpServiceFactory + 'static
{
    cfg.service(web::scope("/api").service(service));
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(health_check);
    cfg.configure(|cfg| api_config(cfg, github_stats::get_user_repos));
    cfg.configure(|cfg| api_config(cfg, page_stats::get_page_stats));
}
