use actix_web::{error::ResponseError, guard::fn_guard, http::StatusCode, HttpResponse};
use serde::Serialize;
use std::fmt;
use sqlx::Error as SqlxError;

#[derive(Debug)]
pub enum AppError {
    DatabaseError(SqlxError),
    NotFound(String),       // 例如 Product with ID not found
    InvalidInput(String),   // 例如 Metadata format is invalid
    Conflict(String),       // 例如 Product ID X already exists
    InternalError(String),  // 通用内部错误
    // 可以根据需要添加更多错误变体，例如：
    // SerializationError(serde_json::Error),
    // Unauthorized,
    // Forbidden,
}

// 定义一个简单的 JSON 错误响应结构
#[derive(Serialize)]
struct ErrorResponse {
    status: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")] // 只有在 debug 模式或特定条件下才显示详情
    detail: Option<String>,
}

// 为自定义错误类型实现 std::fmt::Display，用于错误消息的文本表示
impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::DatabaseError(e) => write!(f, "Database error: {}", e),
            AppError::NotFound(msg) => write!(f, "Not Found: {}", msg),
            AppError::InvalidInput(msg) => write!(f, "Invalid Input: {}", msg),
            AppError::Conflict(msg) => write!(f, "Conflict: {}", msg),
            AppError::InternalError(msg) => write!(f, "Internal Server Error: {}", msg),
        }
    }
}

// 为自定义错误类型实现 std::error::Error trait，使其成为一个标准的 Rust 错误
impl std::error::Error for AppError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            AppError::DatabaseError(e) => Some(e),  // 将稍微底层的 sqlx::Error 作为 source
            _ => None,  // 其他错误类型目前没有底层 source
        }
    }
}

// KEY: 为 AppError 实现 Actix Web 的 ResponseError trait
impl ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::DatabaseError(_) => StatusCode::INTERNAL_SERVER_ERROR, // 默认数据库错误为 500
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::InvalidInput(_) => StatusCode::BAD_REQUEST,
            AppError::InternalError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Conflict(_) => StatusCode::CONFLICT,
        }
    }

    fn error_response(&self) -> HttpResponse {
        let status_code = self.status_code();
        let error_message = self.to_string(); // 使用 Display impl 获取消息

        // 对于生产环境，可能不希望暴露详细的数据库错误给客户端
        // 可以根据 AppError 的变体决定 detail 的内容
        let detail_message = match self {
            AppError::DatabaseError(e) if cfg!(debug_assertions) => Some(e.to_string()), // Debug 模式下显示详细DB错误
            _ => None,
        };

        // 使用我们之前定义的 GenericResponse 也可以，或者专门的 ErrorResponse
        // 这里用 GenericResponse 简化
        // crate::models::GenericResponse {
        //     status: "error".to_string(),
        //     message: error_message,
        // }.respond_to_somehow(); // 需要找到一个方法将 GenericResponse 转换为 HttpResponse
        //                        // 或者直接构建 HttpResponse

        // 直接构建 HttpResponse:
        HttpResponse::build(status_code).json(crate::models::GenericResponse {
            status: "error".to_string(),
            // 对于客户端，我们可能只想显示一个通用的消息，而不是 Display trait 生成的详细消息
            // message: self.client_message(), // 可以为 AppError 实现一个 client_message() 方法
            message: match self { // 更友好的客户端消息
                AppError::DatabaseError(_) => "数据库操作失败。".to_string(),
                AppError::NotFound(m) => m.clone(),
                AppError::InvalidInput(m) => m.clone(),
                AppError::Conflict(m) => m.clone(),
                AppError::InternalError(m) => m.clone(),
            },
            // detail: detail_message, // 如果使用上面的 ErrorResponse 结构
        })
    }
}

// 实现从 sqlx::Error 到 AppError 的转换，方便在 db 层使用 `?` 操作符
impl From<SqlxError> for AppError {
    fn from(err: SqlxError) -> Self {
        // 在这里，我们可以根据 sqlx::Error 的具体类型来映射到更具体的 AppError 变体
        match &err {
            SqlxError::RowNotFound => AppError::NotFound("请求的记录未找到。".to_string()),
            SqlxError::Database(db_err) if db_err.is_unique_violation() => {
                // 注意：这里可能需要更具体的错误信息，比如哪个字段冲突了
                // 但从 From trait 内部很难获取上下文，所以通常返回一个通用的冲突错误
                AppError::Conflict("记录已存在或违反唯一约束。".to_string())
            }
            // 可以添加更多对特定数据库错误的映射
            _ => AppError::DatabaseError(err), // 其他数据库错误都归为 AppError::DatabaseError
        }
    }
}

// (可选) 实现从 serde_json::Error 到 AppError 的转换
impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::InvalidInput(format!("JSON 解析或序列化错误: {}", err))
    }
}
