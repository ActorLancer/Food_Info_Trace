use sqlx::MySqlPool;
use crate::models::{
    FoodRecordRequest, FoodListItem, RawFoodListItem, FoodRecordDetail,
    PaginatedFoodListResponse, PaginationParams
};
use serde_json::Value as JsonValue;

pub async fn create_food_record_db(
    pool:&MySqlPool,
    record_data: &FoodRecordRequest
) -> Result<u64, sqlx::Error> { // 返回影响的行数或错误
    let metadata_string = serde_json::to_string(&record_data.metadata)
        .map_err(|e| sqlx::Error::Decode(Box::new(e)))?;    // 将 serde 错误转换为 sqlx::Error::Decode

    let result = sqlx::query!(
        r#"
        INSERT INTO traceability_data (product_id, metadata_json, onchain_metadata_hash, blockchain_transaction_hash) VALUES (?, ?, ?, ?)
        "#,
        record_data.product_id,
        metadata_string,
        record_data.metadata_hash_on_chain,
        record_data.transaction_hash
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

// 示例：获取食品列表的数据库逻辑
pub async fn get_food_records_list_db(
    pool: &MySqlPool,
    params: &PaginationParams,
) -> Result<PaginatedFoodListResponse, sqlx::Error> {
    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(10).max(1);
    let offset = (page - 1) * page_size;

    let total_items: i64 = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!: i64" FROM traceability_data"#
    )
    .fetch_one(pool)
    .await?;

    if total_items == 0 {
        return Ok(PaginatedFoodListResponse {
            items: Vec::new(), total_items: 0, page, page_size, total_pages: 0,
        });
    }

    let raw_records = sqlx::query_as!(
        RawFoodListItem,
        r#"
        SELECT product_id as "product_id!", CAST(metadata_json AS CHAR) as "metadata_json!",
               onchain_metadata_hash as "onchain_metadata_hash!", created_at as "created_at!: chrono::DateTime<chrono::Utc>"
        FROM traceability_data ORDER BY created_at DESC LIMIT ? OFFSET ?
        "#,
        page_size, offset
    )
    .fetch_all(pool)
    .await?;

    let mut food_list_items: Vec<FoodListItem> = Vec::new();
    for raw_record in raw_records {
        let product_name = serde_json::from_str::<JsonValue>(&raw_record.metadata_json)
            .ok() // Convert Result to Option
            .and_then(|val| val.get("productName").and_then(|v| v.as_str()).map(String::from));
        food_list_items.push(FoodListItem {
            product_id: raw_record.product_id, product_name,
            onchain_metadata_hash: raw_record.onchain_metadata_hash, created_at: raw_record.created_at,
        });
    }
    let total_pages = (total_items as f64 / page_size as f64).ceil() as i64;
    Ok(PaginatedFoodListResponse {
        items: food_list_items, total_items, page, page_size, total_pages,
    })
}

// 可以继续为 get_food_record_detail 创建类似的 _db 函数
pub async fn get_food_record_detail_db(
    pool: &MySqlPool,
    product_id: &str,
) -> Result<Option<FoodRecordDetail>, sqlx::Error> { // 返回 Option 因为可能找不到
    sqlx::query_as!(
        FoodRecordDetail,
        r#"
        SELECT product_id, metadata_json, onchain_metadata_hash, blockchain_transaction_hash,
               created_at as "created_at!: chrono::DateTime<chrono::Utc>",
               updated_at as "updated_at!: chrono::DateTime<chrono::Utc>"
        FROM traceability_data WHERE product_id = ?
        "#,
        product_id
    )
    .fetch_optional(pool)
    .await
}
