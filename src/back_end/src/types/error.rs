use std::fmt;
use actix_web::HttpResponse;
use awc::http::StatusCode;

// Custom error type
#[derive(Debug)]
pub enum ApiError {
    SerializationError(String),
    DatabaseError(String),
    ConfigError(String),
    AuthError(String),
    Internal(String),
    NotFound(String),
    Unauthorized(String),
    RateLimited(String),
    ExternalError(String),
    RedisError(String),
    GithubError(String),
    EnvError(String),
}

// Manual implementation of Error trait
impl std::error::Error for ApiError {}

// Manual implementation of Display trait
impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ApiError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
            ApiError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            ApiError::ConfigError(msg) => write!(f, "Configuration error: {}", msg),
            ApiError::AuthError(msg) => write!(f, "Authentication error: {}", msg),
            ApiError::NotFound(msg) => write!(f, "Not found: {}", msg),
            ApiError::Unauthorized(msg) => write!(f, "Unauthorized: {}", msg),
            ApiError::RateLimited(msg) => write!(f, "Rate limited: {}", msg),
            ApiError::Internal(msg) => write!(f, "Internal error: {}", msg),
            ApiError::ExternalError(msg) => write!(f, "External API: {}", msg),
            ApiError::RedisError(msg) => write!(f, "Redis API: {}", msg),
            ApiError::GithubError(msg) => write!(f, "Github API: {}", msg),
            ApiError::EnvError(msg) => write!(f, "Environmental variable error: {}", msg),
        }
    }
}

// Implement conversion from ApiError to actix_web::Error
impl actix_web::error::ResponseError for ApiError {
    fn error_response(&self) -> HttpResponse {
        match self {
            ApiError::SerializationError(_) => {
                HttpResponse::InternalServerError().json(
                    serde_json::json!({
                        "error": self.to_string()
                    })
                )
            }
            ApiError::DatabaseError(_) => {
                HttpResponse::InternalServerError().json(
                    serde_json::json!({
                        "error": self.to_string()
                    })
                )
            }
            ApiError::ConfigError(_) => {
                HttpResponse::InternalServerError().json(
                    serde_json::json!({
                        "error": "Internal server configuration error"
                    })
                )
            }
            ApiError::AuthError(_) | ApiError::Unauthorized(_) => {
                HttpResponse::Unauthorized().json(
                    serde_json::json!({
                        "error": self.to_string()
                    })
                )
            }
            ApiError::NotFound(msg) => {
                HttpResponse::NotFound().json(
                    serde_json::json!({
                        "error": msg
                    })
                )
            }
            ApiError::RateLimited(msg) => {
                HttpResponse::TooManyRequests().json(
                    serde_json::json!({
                        "error": msg
                    })
                )
            }
            ApiError::Internal(msg) => {
                HttpResponse::InternalServerError().json(
                    serde_json::json!({
                        "error": msg
                    })
                )
            }
            ApiError::ExternalError(_) => {
                HttpResponse::InternalServerError().json(
                    serde_json::json!({
                        "error": self.to_string()
                    })
                )
            }
            ApiError::RedisError(_) => {
                HttpResponse::InternalServerError().json(
                    serde_json::json!({
                        "error": self.to_string()
                    })
                )
            }
            ApiError::GithubError(_) => {
                HttpResponse::InternalServerError().json(
                    serde_json::json!({
                        "error": self.to_string()
                    })
                )
            }
            ApiError::EnvError(_) => {
                HttpResponse::InternalServerError().json(
                    serde_json::json!({
                        "error": self.to_string()
                    })
                )
            }
        }
    }

    fn status_code(&self) -> StatusCode {
        match self {
            ApiError::SerializationError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::DatabaseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::ConfigError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::AuthError(_) | ApiError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            ApiError::NotFound(_) => StatusCode::NOT_FOUND,
            ApiError::RateLimited(_) => StatusCode::TOO_MANY_REQUESTS,
            ApiError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::ExternalError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::RedisError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::GithubError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::EnvError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

// Optional: Add conversions from other error types
impl From<ApiError> for std::io::Error {
    fn from(err: ApiError) -> Self {
        std::io::Error::new(std::io::ErrorKind::Other, err.to_string())
    }
}

impl From<std::env::VarError> for ApiError {
    fn from(err: std::env::VarError) -> Self {
        ApiError::ConfigError(err.to_string())
    }
}

impl From<awc::error::SendRequestError> for ApiError {
    fn from(err: awc::error::SendRequestError) -> Self {
        ApiError::Internal(err.to_string())
    }
}

impl From<awc::error::JsonPayloadError> for ApiError {
    fn from(err: awc::error::JsonPayloadError) -> Self {
        ApiError::Internal(format!("JSON parsing error: {}", err))
    }
}
