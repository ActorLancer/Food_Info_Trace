use crate::models::GenericResponse;
use actix_web::{get, /* Responder,*/ HttpResponse};
use crate::errors::AppError;

// #[get("/health")]
// async fn health_check_handler() -> impl Responder {
//     HttpResponse::Ok().json(GenericResponse { // 返回JSON响应
//         status: "success".to_string(),
//         message: "API is UP and running!".to_string(),
//     })
// }
#[get("/health")]
async fn health_check_handler() -> Result<HttpResponse, AppError> {
    Ok(HttpResponse::Ok().json(GenericResponse { // 返回JSON响应
        status: "success".to_string(),
        message: "API is UP and running!".to_string(),
    }))
}
