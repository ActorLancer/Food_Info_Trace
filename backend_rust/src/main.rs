mod models;
mod errors;
mod db;
mod handlers;

use sqlx::mysql::MySqlPoolOptions;
use std::env;
use dotenvy::dotenv; // 用于加载 .env 文件中的环境变量
use actix_web::{web, App, HttpServer};
use models::AppState;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set in env.file");
    let server_address = env::var("SERVER_ADDRESS").unwrap_or_else(|_| "127.0.0.1:8080".to_string());

    let pool = match MySqlPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
    {
        Ok(pool) => {
            println!("Successfully connected to the database.");
            pool
        }
        Err(e) => {
            eprintln!("Failed to connect to the database: {:?}", e);
            std::process::exit(1);
        }
    };

    println!("Starting HTTP server at http://{}", server_address);

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(AppState { db_pool: pool.clone() }))
            .service(handlers::health_check::health_check_handler)
            .service(handlers::food_records::create_food_record_handler)
            .service(handlers::food_records::get_food_records_list_handler)
            .service(handlers::food_records::get_food_record_detail_handler)
    })
    .bind(&server_address)?
    .run()
    .await
}






// #[actix_web::main]
// async fn main() -> std::io::Result<()> {
//     dotenv().ok();
//     let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set in .env file");
//     let server_address = env::var("SERVER_ADDRESS").unwrap_or_else(|_| "127.0.0.1:8080".to_string());

//     println!("Attempting to connect to database: {}", database_url.split_terminator(&[':', '/', '@']).next().unwrap_or("unknown"));

//     let pool = match MySqlPoolOptions::new()
//         .max_connections(10)
//         .connect(&database_url)
//         .await
//     {
//         Ok(pool) => {
//             println!("Successfully connected to the database.");
//             pool
//         }
//         Err(e) => {
//             eprintln!("Failed to connect to the database: {:?}", e);
//             std::process::exit(1);
//         }
//     };

//     println!("Starting HTTP server at http://{}", server_address);

//     HttpServer::new(move || {
//         App::new()
//             .app_data(web::Data::new(AppState { db_pool: pool.clone() }))
//             .service(health_check)
//             .service(create_food_record)
//             .service(get_food_records_list)
//             .service(get_food_record_detail)
//     })
//     .bind(&server_address)?
//     .run()
//     .await
// }
