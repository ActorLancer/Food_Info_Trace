mod models;
mod errors;
mod db;
mod handlers;

use sqlx::mysql::MySqlPoolOptions;
use std::env;
use dotenvy::dotenv; // 用于加载 .env 文件中的环境变量
use actix_web::{web, App, HttpServer, http};
use models::AppState;
use log::info; // 引入 info! 宏等
use actix_cors::Cors; // 引入 Cors

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // 初始化日志记录器，应该尽早调用
    // 可以通过设置 RUST_LOG 环境变量来控制日志级别，例如：
    // RUST_LOG=info,my_app=debug (全局 info，my_app 模块 debug)
    // RUST_LOG=actix_web=info,backend_rust=debug (actix_web info, 我们的应用 debug)
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info")); // 默认级别为 info

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

    info!("数据库连接池已创建，最大连接数: {}", 10); // 示例日志
    info!("HTTP 服务器正在启动于 http://{}", server_address);

    HttpServer::new(move || {
        // 配置 CORS
        // 这里的配置非常宽松，仅用于开发或特定场景
        // 生产环境应配置更严格的来源 (allowed_origin, allowed_origin_fn)
        let cors = Cors::default()
            .allowed_origin_fn(|origin, _req_head| { // 动态允许来源
                // 示例：简单地允许所有 localhost (不同端口) 或特定前端域
                let origin_str = origin.to_str().unwrap_or("");
                origin_str.starts_with("http://localhost") || // 允许所有 localhost
                origin_str == "https://your-frontend-domain.com" // 允许您的生产前端域
            })
            // .allowed_origin("http://localhost:5173") // 开发时允许 Vite 前端
            // .allowed_origin("https://your-production-frontend.com") // 生产时允许部署的前端
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"]) // 允许的方法
            .allowed_headers(vec![http::header::AUTHORIZATION, http::header::ACCEPT, http::header::CONTENT_TYPE])
            .max_age(3600); // 预检请求 (OPTIONS) 的缓存时间

        App::new()
            .wrap(actix_web::middleware::Logger::default()) // 请求日志
            .wrap(cors) // 应用 CORS 中间件
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
