// food_traceability_platform/backend_rust/src/main.rs
use actix_web::{get, post, web, App, HttpServer, Responder, HttpResponse}; // 确保 post 和 web::Json 被导入
use dotenvy::dotenv;
use sqlx::mysql::MySqlPoolOptions;
use sqlx::MySqlPool;
use std::env;
use serde::{Deserialize, Serialize}; // 导入 Serialize 和 Deserialize
use serde_json::Value as JsonValue; // 用于处理任意 JSON 结构的元数据

// 用于共享数据库连接池的状态
pub struct AppState {
    db_pool: MySqlPool,
}
// 定义前端发送过来的请求体结构
#[derive(Deserialize, Debug)] // Debug 是为了方便打印
struct FoodRecordRequest {
    #[serde(rename = "productId")] // 对应前端JS的驼峰命名
    product_id: String,
    metadata: JsonValue, // 使用 serde_json::Value 来接收任意结构的JSON对象
    #[serde(rename = "metadataHashOnChain")]
    metadata_hash_on_chain: String,
    #[serde(rename = "transactionHash")]
    transaction_hash: String,
}

// (可选) 定义一个简单的响应结构体
#[derive(Serialize)]
struct GenericResponse {
    status: String,
    message: String,
}

// 用于食品列表项的结构体 (部分信息)
#[derive(Serialize, Debug, sqlx::FromRow)] // FromRow 用于从数据库行直接映射
struct FoodListItem {
    product_id: String,
    product_name: Option<String>,
    // 假设我们想从 metadata_json 中提取 productName
    // 注意: sqlx::FromRow 不能直接从 JSON 内部字段映射，我们需要在查询后手动处理或在查询中提取
    // 为简单起见，我们先只包含直接从表列获取的字段，productName 可以在 handler 中处理
    onchain_metadata_hash: String,
    created_at: chrono::DateTime<chrono::Utc>, // 使用 chrono 处理时间戳
}

// 用于食品详情的结构体 (完整信息)
#[derive(Serialize, Debug, sqlx::FromRow)] // FromRow 可以处理 sqlx::types::Json
struct FoodRecordDetail {
    product_id: String,
    // metadata_json 将直接从数据库 JSON 类型映射
    metadata_json: sqlx::types::Json<JsonValue>, // 使用 sqlx::types::Json
    onchain_metadata_hash: String,
    blockchain_transaction_hash: String,
    created_at: chrono::DateTime<chrono::Utc>, // 假设已通过上面的类型注解解决
    updated_at: chrono::DateTime<chrono::Utc>, // 假设已通过上面的类型注解解决
}

// 专门用于从数据库查询 metadata_json 字符串的结构体
#[derive(sqlx::FromRow, Debug)]
struct RawFoodRecord {
    product_id: String,
    
    onchain_metadata_hash: String,
    blockchain_transaction_hash: String,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(sqlx::FromRow, Debug)] // Debug 是为了方便打印，FromRow 用于映射
struct RawFoodListItem {
    product_id: String,
    metadata_json: String, // 这个字段是从 CAST(metadata_json AS CHAR) 获取的
    onchain_metadata_hash: String,
    created_at: chrono::DateTime<chrono::Utc>,
}


#[get("/health")]
async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(GenericResponse { // 返回JSON响应
        status: "success".to_string(),
        message: "API is UP".to_string(),
    })
}

// 新的 API 端点处理函数
#[post("/api/food-records")] // 定义路由为 POST /api/food-records
async fn create_food_record(
    app_state: web::Data<AppState>, // 注入应用状态 (包含数据库连接池)
    record_request: web::Json<FoodRecordRequest>, // 从请求体中提取并反序列化JSON数据
) -> impl Responder {
    println!("接收到创建食品记录的请求: {:?}", record_request); // 打印接收到的数据

    // 将 serde_json::Value 转换为字符串以便存储到数据库的 JSON 字段
    // MySQL 的 JSON 类型通常期望字符串形式的 JSON
    let metadata_string = match serde_json::to_string(&record_request.metadata) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("元数据序列化为字符串失败: {:?}", e);
            return HttpResponse::BadRequest().json(GenericResponse {
                status: "error".to_string(),
                message: "无效的元数据格式".to_string(),
            });
        }
    };

    // 执行数据库插入操作
    let query_result = sqlx::query!(
        r#"
        INSERT INTO traceability_data (product_id, metadata_json, onchain_metadata_hash, blockchain_transaction_hash)
        VALUES (?, ?, ?, ?)
        "#,
        record_request.product_id,
        metadata_string, // 存储字符串形式的JSON
        record_request.metadata_hash_on_chain,
        record_request.transaction_hash
    )
    .execute(&app_state.db_pool)
    .await;

    match query_result {
        Ok(result) => {
            if result.rows_affected() > 0 {
                println!("数据成功插入数据库，产品ID: {}", record_request.product_id);
                HttpResponse::Created().json(GenericResponse { // 201 Created
                    status: "success".to_string(),
                    message: format!("食品记录 {} 已成功创建。", record_request.product_id),
                })
            } else {
                eprintln!("数据插入失败，没有行受到影响。产品ID: {}", record_request.product_id);
                HttpResponse::InternalServerError().json(GenericResponse {
                    status: "error".to_string(),
                    message: "创建食品记录失败，请稍后再试。".to_string(),
                })
            }
        }
        Err(e) => {
            eprintln!("数据库插入错误: {:?}", e);
            // 可以根据具体的 sqlx::Error 类型返回更详细的错误信息
            // 例如，如果是唯一约束冲突 (e.g., product_id 已存在)
            if let Some(db_err) = e.as_database_error() {
                if db_err.is_unique_violation() {
                    return HttpResponse::Conflict().json(GenericResponse { // 409 Conflict
                        status: "error".to_string(),
                        message: format!("产品ID '{}' 已存在。", record_request.product_id),
                    });
                }
            }
            HttpResponse::InternalServerError().json(GenericResponse {
                status: "error".to_string(),
                message: "创建食品记录时发生数据库错误。".to_string(),
            })
        }
    }
}

#[get("/api/food-records")]
async fn get_food_records_list(
    app_state: web::Data<AppState>,
) -> impl Responder {
    println!("接收到获取食品列表的请求 (含产品名称)");

    let query_result = sqlx::query_as!(
        RawFoodListItem, // 查询结果映射到 RawFoodListItem
        r#"
        SELECT
            product_id as "product_id!", -- 断言 product_id 不为 NULL
            CAST(metadata_json AS CHAR) as "metadata_json!", -- 断言 CAST 结果不为 NULL
            onchain_metadata_hash as "onchain_metadata_hash!", -- 断言哈希不为 NULL
            created_at as "created_at!: chrono::DateTime<chrono::Utc>"
        FROM traceability_data
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(&app_state.db_pool)
    .await;

    match query_result {
        Ok(raw_records) => {
            let mut food_list_items: Vec<FoodListItem> = Vec::new();

            for raw_record in raw_records {
                let product_name: Option<String> = match serde_json::from_str::<JsonValue>(&raw_record.metadata_json) {
                    Ok(metadata_value) => {
                        metadata_value.get("productName").and_then(|v| v.as_str()).map(String::from)
                    }
                    Err(e) => {
                        eprintln!("解析产品ID {} 的元数据失败 (列表): {:?}", raw_record.product_id, e);
                        None
                    }
                };

                // 确保 FoodListItem 结构体定义包含 product_name
                food_list_items.push(FoodListItem {
                    product_id: raw_record.product_id,
                    product_name, // 这个 product_name 是 Option<String> 类型
                    onchain_metadata_hash: raw_record.onchain_metadata_hash,
                    created_at: raw_record.created_at,
                });
            }

            println!("成功从数据库获取 {} 条食品记录列表 (含产品名称)", food_list_items.len());
            HttpResponse::Ok().json(food_list_items)
        }
        Err(e) => {
            eprintln!("数据库查询食品列表错误 (含产品名称): {:?}", e);
            HttpResponse::InternalServerError().json(GenericResponse {
                status: "error".to_string(),
                message: "获取食品列表失败。".to_string(),
            })
        }
    }
}

#[get("/api/food-records/{product_id}")]
async fn get_food_record_detail(
    app_state: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let product_id = path.into_inner();
    println!("接收到获取食品详情的请求，产品ID: {}", product_id);

    let query_result = sqlx::query_as!(
        FoodRecordDetail, // 直接查询到 FoodRecordDetail
        r#"
        SELECT
            product_id,
            metadata_json, -- sqlx 会尝试将其映射到 sqlx::types::Json<JsonValue>
            onchain_metadata_hash,
            blockchain_transaction_hash,
            created_at as "created_at!: chrono::DateTime<chrono::Utc>",
            updated_at as "updated_at!: chrono::DateTime<chrono::Utc>"
        FROM traceability_data
        WHERE product_id = ?
        "#,
        product_id
    )
    .fetch_optional(&app_state.db_pool)
    .await;

    match query_result {
        Ok(Some(record)) => {
            // record.metadata_json 现在是 sqlx::types::Json<JsonValue>
            // 要在 HttpResponse::Ok().json() 中序列化，它内部的 JsonValue 可以被 serde 处理
            println!("成功从数据库获取产品ID {} 的详情", product_id);
            // 注意：FoodRecordDetail 的 metadata_json 字段是 sqlx::types::Json<JsonValue>
            // 为了让 serde 正确序列化为前端期望的普通 JSON 对象，我们需要将其解包
            // 或者修改 FoodRecordDetail 的 Serialize 实现，或者创建一个新的 DTO
            // 简单起见，我们创建一个临时的结构体或直接构建 JsonValue 进行响应

            // 创建一个用于响应的临时结构体，将 sqlx::types::Json<JsonValue> 转换为 JsonValue
            #[derive(Serialize)]
            struct FoodRecordDetailResponse {
                product_id: String,
                metadata_json: JsonValue, // 直接用 JsonValue
                onchain_metadata_hash: String,
                blockchain_transaction_hash: String,
                created_at: chrono::DateTime<chrono::Utc>,
                updated_at: chrono::DateTime<chrono::Utc>,
            }

            let response_payload = FoodRecordDetailResponse {
                product_id: record.product_id,
                metadata_json: record.metadata_json.0, // 解包 sqlx::types::Json
                onchain_metadata_hash: record.onchain_metadata_hash,
                blockchain_transaction_hash: record.blockchain_transaction_hash,
                created_at: record.created_at,
                updated_at: record.updated_at,
            };
            HttpResponse::Ok().json(response_payload)
        }
        Ok(None) => {
            println!("未找到产品ID {} 的记录", product_id);
            HttpResponse::NotFound().json(GenericResponse {
                status: "error".to_string(),
                message: format!("未找到产品ID为 {} 的食品记录。", product_id),
            })
        }
        Err(e) => {
            eprintln!("数据库查询产品ID {} 详情错误: {:?}", product_id, e);
            HttpResponse::InternalServerError().json(GenericResponse {
                status: "error".to_string(),
                message: "获取食品详情失败。".to_string(),
            })
        }
    }
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set in .env file");
    let server_address = env::var("SERVER_ADDRESS").unwrap_or_else(|_| "127.0.0.1:8080".to_string());

    println!("Attempting to connect to database: {}", database_url.split_terminator(&[':', '/', '@']).next().unwrap_or("unknown"));

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
            .service(health_check)
            .service(create_food_record)
            .service(get_food_records_list)   // <--- 注册列表查询服务
            .service(get_food_record_detail)  // <--- 注册详情查询服务
    })
    .bind(&server_address)?
    .run()
    .await
}
