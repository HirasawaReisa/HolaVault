package com.halovault.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * AI API 配置属性
 * 对应 application.yml 中的 ai.api.* 配置
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "ai.api")
public class AiApiConfig {
    private String key;
    private String baseUrl;
    private String model;
}
