package com.halovault;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;

/**
 * HaloVault 后端入口
 * 排除 DataSourceAutoConfiguration —— 使用自定义 DataSourceConfig 配置 SQLite
 */
@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})
public class HaloVaultApplication {
    public static void main(String[] args) {
        SpringApplication.run(HaloVaultApplication.class, args);
    }
}
