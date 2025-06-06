use sqlx::MySqlPool;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use chrono::{Utc, DateTime};

// 用于共享数据库连接池的状态
pub struct AppState {
    pub db_pool: MySqlPool,
}
// 定义前端发送过来的请求体结构
#[derive(Deserialize, Debug)]
pub struct FoodRecordRequest {
    #[serde(rename = "productId")] // 对应前端JS的驼峰命名
    pub product_id: String,
    pub metadata: JsonValue, // 使用 serde_json::Value 来接收任意结构的JSON对象
    #[serde(rename = "metadataHashOnChain")]
    pub metadata_hash_on_chain: String,
    #[serde(rename = "transactionHash")]
    pub transaction_hash: String,
}

// 定义一个简单的响应结构体
#[derive(Serialize)]
pub struct GenericResponse {
    pub status: String,
    pub message: String,
}

// 用于食品列表项的结构体 (部分信息)
#[derive(Serialize, Debug, sqlx::FromRow)] // FromRow 用于从数据库行直接映射
pub struct FoodListItem {
    pub product_id: String,
    pub product_name: Option<String>,
    // 从 metadata_json 中提取 productName
    // sqlx::FromRow 不能直接从 JSON 内部字段映射，需要在查询后手动处理或在查询中提取
    pub onchain_metadata_hash: String,
    pub created_at: DateTime<Utc>, // 使用 chrono 处理时间戳
}

// 用于食品详情的结构体 (完整信息)
#[derive(Serialize, Debug, sqlx::FromRow)] // FromRow 可以处理 sqlx::types::Json
pub struct FoodRecordDetail {
    pub product_id: String,
    // metadata_json 将直接从数据库 JSON 类型映射
    pub metadata_json: sqlx::types::Json<JsonValue>, // 使用 sqlx::types::Json
    pub onchain_metadata_hash: String,
    pub blockchain_transaction_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// FoodRecordDetail 的 metadata_json 字段是 sqlx::types::Json<JsonValue>
// 为了让 serde 正确序列化为前端期望的普通 JSON 对象，需要将其解包
// 或者修改 FoodRecordDetail 的 Serialize 实现，或者创建一个新的 DTO
// 简单起见，创建一个临时的结构体(或直接构建 JsonValue 进行响应)
// 创建一个用于响应的临时结构体，将 sqlx::types::Json<JsonValue> 转换为 JsonValue
// 用于API响应的详情结构 (解包 sqlx::types::Json)
#[derive(Serialize, Debug)]
pub struct FoodRecordDetailResponse {
    pub product_id: String,
    pub metadata_json: JsonValue,
    pub onchain_metadata_hash: String,
    pub blockchain_transaction_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}


// 专门用于从数据库查询 metadata_json 字符串的结构体
#[derive(sqlx::FromRow, Debug)]
pub struct RawFoodRecord {
    pub product_id: String,
    pub onchain_metadata_hash: String,
    pub blockchain_transaction_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(sqlx::FromRow, Debug)] // FromRow 用于映射
pub struct RawFoodListItem {
    pub product_id: String,
    pub metadata_json: String, // 这个字段是从 CAST(metadata_json AS CHAR) 获取的
    pub onchain_metadata_hash: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Debug)]
pub struct PaginatedFoodListResponse {
    pub items: Vec<FoodListItem>, // 当前页的数据项
    pub total_items: i64,         // 总记录数
    pub page: i64,                // 当前页码
    pub page_size: i64,           // 每页大小
    pub total_pages: i64,         // 总页数
}

// 定义分页查询参数的结构体
#[derive(Deserialize, Debug)]
pub struct PaginationParams {
    pub page: Option<i64>,     // 当前页码
    pub page_size: Option<i64>, // 每页大小
}
