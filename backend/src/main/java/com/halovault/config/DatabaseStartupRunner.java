package com.halovault.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * 应用启动时自动执行数据库初始化
 * 使用 ApplicationRunner 确保在应用启动完成前执行迁移
 * 初始化失败会阻止应用启动，避免数据库结构不一致
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseStartupRunner implements ApplicationRunner {

    private final DatabaseInitializer databaseInitializer;

    @Override
    public void run(ApplicationArguments args) {
        log.info("Initializing database before application starts...");
        databaseInitializer.initialize();
    }
}
