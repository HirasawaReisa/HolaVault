package com.halovault.config;

import com.halovault.dto.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 全局异常处理器
 * 将 Spring Boot 默认的 400/500 错误转为统一的 ApiResponse 格式
 * 方便前端获取具体错误原因
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 处理 JSON 反序列化失败（请求体格式错误）
     * 原本 Spring Boot 默认返回 400 状态码 + 空白 body
     * 现改为返回 200 状态码 + ApiResponse.error(400, 具体原因)
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<String>> handleNotReadable(HttpMessageNotReadableException ex) {
        log.warn("请求体解析失败: {}", ex.getMessage());
        String detail = ex.getMostSpecificCause().getMessage();
        String message = "请求体格式错误: " + (detail != null ? detail : ex.getMessage());
        return ResponseEntity.ok(ApiResponse.error(400, message));
    }

    /**
     * 处理其他未捕获异常
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<String>> handleGeneric(Exception ex) {
        log.error("未处理异常", ex);
        return ResponseEntity.ok(ApiResponse.error(500, "内部错误: " + ex.getMessage()));
    }
}
