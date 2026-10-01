package com.halovault.config;

import org.sqlite.SQLiteDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * SQLite 数据源配置
 * - 使用 SQLiteDataSource（专为 SQLite 设计的数据源实现）
 * - 自动创建数据库文件所在目录
 * - 在 URL 中启用外键约束（SQLite 默认不强制外键）
 * - 显式声明事务管理器 Bean，确保 @Transactional 正常工作
 */
@Configuration
public class DataSourceConfig {

    @Value("${halovault.db.path:./data/halovault.db}")
    private String dbPath;

    @Bean
    @Primary
    public DataSource dataSource() {
        // 确保数据库文件目录存在
        try {
            Path parentDir = Paths.get(dbPath).toAbsolutePath().getParent();
            if (parentDir != null && !Files.exists(parentDir)) {
                Files.createDirectories(parentDir);
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to create database directory: " + e.getMessage(), e);
        }

        SQLiteDataSource ds = new SQLiteDataSource();
        // 在 URL 参数中启用外键约束 + WAL 模式，确保数据完整性
        String url = "jdbc:sqlite:" + Paths.get(dbPath).toAbsolutePath()
                + "?foreign_keys=true&journal_mode=WAL";
        ds.setUrl(url);
        return ds;
    }

    /**
     * 显式声明事务管理器
     * （排除 DataSourceAutoConfiguration 后，自动配置可能不创建此 Bean）
     */
    @Bean
    public PlatformTransactionManager transactionManager(DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }
}
