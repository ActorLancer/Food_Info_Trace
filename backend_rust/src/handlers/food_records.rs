use actix_web::{get, post, web, Responder, HttpResponse};
// use serde_json::Value as JsonValue;
use crate::models::{
    AppState, FoodRecordRequest, GenericResponse, PaginationParams, FoodRecordDetailResponse,
    // FoodListItem, RawFoodListItem, FoodRecordDetail,
    // PaginatedFoodListResponse
};
use crate::db;
use sqlx::Error as SqlxError; // 引入 sqlx::Error 以便模式匹配

#[post("/api/food-records")]
pub async fn create_food_record_handler(
    app_state: web::Data<AppState>,
    record_request: web::Json<FoodRecordRequest>,
) -> impl Responder {
    let request_data = record_request.into_inner(); // 获取内部数据，避免后续所有权问题

    match db::create_food_record_db(&app_state.db_pool, &request_data).await {
        Ok(rows_affected) if rows_affected > 0 => {
            HttpResponse::Created().json(GenericResponse {
                status: "success".to_string(),
                message: format!("食品记录 {} 已成功创建。", request_data.product_id),
            })
        }
        Ok(_) => { // rows_affected == 0 或其他非预期成功情况
            eprintln!("创建食品记录 {} 成功，但没有行受到影响。", request_data.product_id);
            HttpResponse::InternalServerError().json(GenericResponse {
                status: "error".to_string(),
                message: "创建食品记录失败，操作未修改任何数据。".to_string(),
            })
        }
        Err(e) => {
            eprintln!("创建食品记录 {} 数据库错误: {:?}", request_data.product_id, e);
            match e {
                SqlxError::Database(db_err) if db_err.is_unique_violation() => {
                    HttpResponse::Conflict().json(GenericResponse {
                        status: "error".to_string(),
                        message: format!("产品ID '{}' 已存在。", request_data.product_id),
                    })
                }
                // 可以根据需要添加对其他 db_err 类型的处理，如 is_foreign_key_violation 等
                SqlxError::Decode(_) => { // serde_json::to_string 失败时 db::create_food_record_db 会返回这个
                     HttpResponse::BadRequest().json(GenericResponse {
                        status: "error".to_string(),
                        message: "请求中的元数据格式无效。".to_string(),
                    })
                }
                _ => HttpResponse::InternalServerError().json(GenericResponse {
                    status: "error".to_string(),
                    message: "创建食品记录时发生内部错误。".to_string(),
                }),
            }
        }
    }
}

#[get("/api/food-records")]
pub async fn get_food_records_list_handler(
    app_state: web::Data<AppState>,
    query_params: web::Query<PaginationParams>,
) -> impl Responder {
    match db::get_food_records_list_db(&app_state.db_pool, &query_params.into_inner()).await {
        Ok(paginated_response) => HttpResponse::Ok().json(paginated_response),
        Err(e) => {
            eprintln!("获取食品列表数据库错误: {:?}", e);
            // 对于列表查询，大部分 sqlx::Error 可能都指示服务器端问题
            HttpResponse::InternalServerError().json(GenericResponse {
                status: "error".to_string(),
                message: "获取食品列表时发生内部错误。".to_string(),
            })
        }
    }
}

#[get("/api/food-records/{product_id}")]
pub async fn get_food_record_detail_handler(
    app_state: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let product_id = path.into_inner();
    match db::get_food_record_detail_db(&app_state.db_pool, &product_id).await {
        Ok(Some(record)) => {
            let response_payload = FoodRecordDetailResponse {
               product_id: record.product_id,
               metadata_json: record.metadata_json.0,
               onchain_metadata_hash: record.onchain_metadata_hash,
               blockchain_transaction_hash: record.blockchain_transaction_hash,
               created_at: record.created_at,
               updated_at: record.updated_at,
           };
           HttpResponse::Ok().json(response_payload)
        }
        Ok(None) => { // db::get_food_record_detail_db 使用 fetch_optional，所以 None 是正常情况
            HttpResponse::NotFound().json(GenericResponse {
                status: "error".to_string(),
                message: format!("未找到产品ID为 '{}' 的食品记录。", product_id),
            })
        }
        Err(e) => {
            eprintln!("获取产品ID {} 详情数据库错误: {:?}", product_id, e);
            // 这里也可以根据 e 的类型进行更细致的判断，但通常 RowNotFound 已被 Ok(None) 捕获
            // 其他错误很可能是服务器内部错误
            match e {
                SqlxError::Decode(_) => { // 如果 FoodRecordDetail 结构与数据库不匹配
                    HttpResponse::InternalServerError().json(GenericResponse {
                        status: "error".to_string(),
                        message: "服务器无法正确处理数据格式。".to_string(),
                    })
                }
                _ => HttpResponse::InternalServerError().json(GenericResponse {
                    status: "error".to_string(),
                    message: "获取食品详情时发生内部错误。".to_string(),
                }),
            }
        }
    }
}

// -----------------------------------------------------------------------------

// // API 端点处理函数
// #[post("/api/food-records")]
// async fn create_food_record_handler(
//     app_state: web::Data<AppState>, // 注入应用状态 (包含数据库连接池)
//     record_request: web::Json<FoodRecordRequest>, // 从请求体中提取并反序列化JSON数据
// ) -> impl Responder {
//     println!("接收到创建食品记录的请求: {:?}", record_request); // 打印接收到的数据

//     // 将 serde_json::Value 转换为字符串以便存储到数据库的 JSON 字段
//     // MySQL 的 JSON 类型通常期望字符串形式的 JSON
//     let metadata_string = match serde_json::to_string(&record_request.metadata) {
//         Ok(s) => s,
//         Err(e) => {
//             eprintln!("元数据序列化为字符串失败: {:?}", e);
//             return HttpResponse::BadRequest().json(GenericResponse {
//                 status: "error".to_string(),
//                 message: "无效的元数据格式".to_string(),
//             });
//         }
//     };

//     // 执行数据库插入操作
//     let query_result = sqlx::query!(
//         r#"
//         INSERT INTO traceability_data (product_id, metadata_json, onchain_metadata_hash, blockchain_transaction_hash)
//         VALUES (?, ?, ?, ?)
//         "#,
//         record_request.product_id,
//         metadata_string, // 存储字符串形式的JSON
//         record_request.metadata_hash_on_chain,
//         record_request.transaction_hash
//     )
//     .execute(&app_state.db_pool)
//     .await;

//     match query_result {
//         Ok(result) => {
//             if result.rows_affected() > 0 {
//                 println!("数据成功插入数据库，产品ID: {}", record_request.product_id);
//                 HttpResponse::Created().json(GenericResponse { // 201 Created
//                     status: "success".to_string(),
//                     message: format!("食品记录 {} 已成功创建。", record_request.product_id),
//                 })
//             } else {
//                 eprintln!("数据插入失败，没有行受到影响。产品ID: {}", record_request.product_id);
//                 HttpResponse::InternalServerError().json(GenericResponse {
//                     status: "error".to_string(),
//                     message: "创建食品记录失败，请稍后再试。".to_string(),
//                 })
//             }
//         }
//         Err(e) => {
//             eprintln!("数据库插入错误: {:?}", e);
//             // TODO: 可以根据具体的 sqlx::Error 类型返回更详细的错误信息
//             if let Some(db_err) = e.as_database_error() {
//                 if db_err.is_unique_violation() {
//                     return HttpResponse::Conflict().json(GenericResponse { // 409 Conflict
//                         status: "error".to_string(),
//                         message: format!("产品ID '{}' 已存在。", record_request.product_id),
//                     });
//                 }
//             }
//             HttpResponse::InternalServerError().json(GenericResponse {
//                 status: "error".to_string(),
//                 message: "创建食品记录时发生数据库错误。".to_string(),
//             })
//         }
//     }
// }


// #[get("/api/food-records")]
// async fn get_food_records_list_handler(
//     app_state: web::Data<AppState>,
//     query_params: web::Query<PaginationParams>, // 从查询字符串中提取分页参数
// ) -> impl Responder {
//     println!("接收到获取食品列表的请求 (分页): {:?}", query_params);

//     let page = query_params.page.unwrap_or(1).max(1); // 默认第1页，最小为1
//     let page_size = query_params.page_size.unwrap_or(10).max(1); // 默认每页10条，最小为1
//     let offset = (page - 1) * page_size;

//     // 1. 查询总记录数
//     let total_items_result = sqlx::query_scalar!(
//         r#"SELECT COUNT(*) as "count!: i64" FROM traceability_data"#
//     )
//     .fetch_one(&app_state.db_pool)
//     .await;

//     let total_items = match total_items_result {
//         Ok(count) => count,
//         Err(e) => {
//             eprintln!("数据库查询总记录数错误: {:?}", e);
//             return HttpResponse::InternalServerError().json(GenericResponse {
//                 status: "error".to_string(),
//                 message: "获取食品列表数据失败 (无法获取总数)。".to_string(),
//             });
//         }
//     };

//     if total_items == 0 { // 如果没有记录，直接返回空列表和分页信息
//         println!("数据库中没有食品记录。");
//         return HttpResponse::Ok().json(PaginatedFoodListResponse {
//             items: Vec::new(),
//             total_items: 0,
//             page,
//             page_size,
//             total_pages: 0,
//         });
//     }

//     // 2. 查询当前页的数据
//     let query_result = sqlx::query_as!(
//         RawFoodListItem,
//         r#"
//         SELECT
//             product_id as "product_id!",
//             CAST(metadata_json AS CHAR) as "metadata_json!",
//             onchain_metadata_hash as "onchain_metadata_hash!",
//             created_at as "created_at!: chrono::DateTime<chrono::Utc>"
//         FROM traceability_data
//         ORDER BY created_at DESC
//         LIMIT ? OFFSET ?
//         "#,
//         page_size, // LIMIT
//         offset     // OFFSET
//     )
//     .fetch_all(&app_state.db_pool)
//     .await;

//     match query_result {
//         Ok(raw_records) => {
//             let mut food_list_items: Vec<FoodListItem> = Vec::new();
//             for raw_record in raw_records {
//                 let product_name: Option<String> = match serde_json::from_str::<JsonValue>(&raw_record.metadata_json) {
//                     Ok(metadata_value) => metadata_value.get("productName").and_then(|v| v.as_str()).map(String::from),
//                     Err(e) => {
//                         eprintln!("解析产品ID {} 的元数据失败 (列表): {:?}", raw_record.product_id, e);
//                         None
//                     }
//                 };
//                 food_list_items.push(FoodListItem {
//                     product_id: raw_record.product_id,
//                     product_name,
//                     onchain_metadata_hash: raw_record.onchain_metadata_hash,
//                     created_at: raw_record.created_at,
//                 });
//             }

//             let total_pages = (total_items as f64 / page_size as f64).ceil() as i64;

//             println!("成功从数据库获取 {} 条食品记录列表 (分页)，总记录数: {}", food_list_items.len(), total_items);
//             HttpResponse::Ok().json(PaginatedFoodListResponse {
//                 items: food_list_items,
//                 total_items,
//                 page,
//                 page_size,
//                 total_pages,
//             })
//         }
//         Err(e) => {
//             eprintln!("数据库查询食品列表错误 (分页): {:?}", e);
//             HttpResponse::InternalServerError().json(GenericResponse {
//                 status: "error".to_string(),
//                 message: "获取食品列表数据失败。".to_string(),
//             })
//         }
//     }
// }


// #[get("/api/food-records/{product_id}")]
// async fn get_food_record_detail_handler(
//     app_state: web::Data<AppState>,
//     path: web::Path<String>,
// ) -> impl Responder {
//     let product_id = path.into_inner();
//     println!("接收到获取食品详情的请求，产品ID: {}", product_id);

//     let query_result = sqlx::query_as!(
//         FoodRecordDetail, // 直接查询到 FoodRecordDetail
//         r#"
//         SELECT
//             product_id,
//             metadata_json, -- sqlx 会尝试将其映射到 sqlx::types::Json<JsonValue>
//             onchain_metadata_hash,
//             blockchain_transaction_hash,
//             created_at as "created_at!: chrono::DateTime<chrono::Utc>",
//             updated_at as "updated_at!: chrono::DateTime<chrono::Utc>"
//         FROM traceability_data
//         WHERE product_id = ?
//         "#,
//         product_id
//     )
//     .fetch_optional(&app_state.db_pool)
//     .await;

//     match query_result {
//         Ok(Some(record)) => {
//             // record.metadata_json 现在是 sqlx::types::Json<JsonValue>
//             // 要在 HttpResponse::Ok().json() 中序列化，它内部的 JsonValue 可以被 serde 处理
//             println!("成功从数据库获取产品ID {} 的详情", product_id);

//             // TODO:

//             let response_payload = FoodRecordDetailResponse {
//                 product_id: record.product_id,
//                 metadata_json: record.metadata_json.0, // 解包 sqlx::types::Json
//                 onchain_metadata_hash: record.onchain_metadata_hash,
//                 blockchain_transaction_hash: record.blockchain_transaction_hash,
//                 created_at: record.created_at,
//                 updated_at: record.updated_at,
//             };
//             HttpResponse::Ok().json(response_payload)
//         }
//         Ok(None) => {
//             println!("未找到产品ID {} 的记录", product_id);
//             HttpResponse::NotFound().json(GenericResponse {
//                 status: "error".to_string(),
//                 message: format!("未找到产品ID为 {} 的食品记录。", product_id),
//             })
//         }
//         Err(e) => {
//             eprintln!("数据库查询产品ID {} 详情错误: {:?}", product_id, e);
//             HttpResponse::InternalServerError().json(GenericResponse {
//                 status: "error".to_string(),
//                 message: "获取食品详情失败。".to_string(),
//             })
//         }
//     }
// }
