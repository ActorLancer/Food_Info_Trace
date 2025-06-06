use crate::models::GenericResponse;
use actix_web::{get, Responder, HttpResponse};

#[get("/health")]
async fn health_check_handler() -> impl Responder {
    HttpResponse::Ok().json(GenericResponse { // 返回JSON响应
        status: "success".to_string(),
        message: "API is UP and running!".to_string(),
    })
}
