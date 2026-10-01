package com.halovault.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * 数据库初始化与版本迁移管理
 *
 * 设计思路：
 * - 应用启动时自动检查 schema_version 表，判断当前数据库版本
 * - 按版本号顺序依次执行迁移脚本，确保数据库结构始终与代码匹配
 * - 每个迁移步骤内使用 IF NOT EXISTS 保证幂等性
 * - 迁移失败时抛出异常阻止应用启动，避免数据结构不一致
 */
@Slf4j
@Component
public class DatabaseInitializer {

    private final JdbcTemplate jdbcTemplate;
    private final int targetSchemaVersion;

    public DatabaseInitializer(DataSource dataSource,
                               @Value("${halovault.db.schema-version:1}") int targetSchemaVersion) {
        this.jdbcTemplate = new JdbcTemplate(dataSource);
        this.targetSchemaVersion = targetSchemaVersion;
    }

    /**
     * 应用启动后执行数据库初始化与迁移
     * 首先设置 SQLite 关键 PRAGMA 参数
     */
    public void initialize() {
        log.info("Starting database initialization, target schema version: {}", targetSchemaVersion);
        // 启用外键约束（SQLite URL 参数已设置 foreign_keys=true，此处为二次保障）
        jdbcTemplate.execute("PRAGMA foreign_keys = ON");
        // 设置 WAL 模式提升并发读写性能
        jdbcTemplate.execute("PRAGMA journal_mode = WAL");

        ensureSchemaVersionTable();
        int currentVersion = getCurrentVersion();
        log.info("Current schema version: {}", currentVersion);

        for (int v = currentVersion + 1; v <= targetSchemaVersion; v++) {
            log.info("Applying migration v{}", v);
            applyMigration(v);
        }

        log.info("Database initialization complete, current version: {}", getCurrentVersion());
    }

    /**
     * 确保 schema_version 表存在（用于版本追踪）
     */
    private void ensureSchemaVersionTable() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """);
    }

    /**
     * 获取当前数据库 schema 版本号
     * - 若 schema_version 表为空（首次启动），返回 0
     */
    private int getCurrentVersion() {
        Integer version = jdbcTemplate.queryForObject(
                "SELECT MAX(version) FROM schema_version", Integer.class);
        return version != null ? version : 0;
    }

    /**
     * 按版本号执行迁移脚本
     * 每个版本对应一组 DDL 语句，使用 IF NOT EXISTS 保证幂等
     */
    private void applyMigration(int version) {
        try {
            switch (version) {
                case 1 -> applyV1();
                case 2 -> applyV2();
                case 3 -> applyV3();
                case 4 -> applyV4();
                default -> log.warn("Unknown schema version: {}, skipping", version);
            }
            // 记录迁移版本
            jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?)", version);
            log.info("Migration v{} applied successfully", version);
        } catch (Exception e) {
            log.error("Migration v{} failed: {}", version, e.getMessage(), e);
            throw new RuntimeException("Database migration v" + version + " failed: " + e.getMessage(), e);
        }
    }

    /**
     * V1: 基础表结构
     * - albums: 画册专辑
     * - artworks: 画作（属于某个专辑）
     * - checkin_records: 百日绘打卡记录
     */
    private void applyV1() {
        // 专辑表
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS albums (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT    NOT NULL,
                description TEXT    DEFAULT '',
                cover_seed  TEXT    DEFAULT '',
                created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
                updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            )
            """);

        // 画作表
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS artworks (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                album_id     INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
                title        TEXT    NOT NULL,
                seed         TEXT    DEFAULT '',
                image_url    TEXT    DEFAULT '',
                height       INTEGER DEFAULT 280,
                platform     TEXT    DEFAULT '',
                platform_url TEXT    DEFAULT '',
                highlights   TEXT    DEFAULT '',
                description  TEXT    DEFAULT '',
                sort_order   INTEGER DEFAULT 0,
                created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
                updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
            )
            """);

        // 打卡记录表
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS checkin_records (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                day        INTEGER NOT NULL UNIQUE,
                image_url  TEXT    DEFAULT '',
                note       TEXT    DEFAULT '',
                streak     INTEGER DEFAULT 0,
                created_at TEXT    NOT NULL DEFAULT (datetime('now'))
            )
            """);

        // 索引：提升查询性能
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_artworks_album_id ON artworks(album_id)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_checkin_records_day ON checkin_records(day)");

        log.info("V1 schema: albums, artworks, checkin_records tables created");
    }

    /**
     * V2: AI 点评数据持久化
     * - critique_artworks: 点评画作（含规则分析和自定义对话的 JSON 数据）
     */
    private void applyV2() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS critique_artworks (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                image_url       TEXT    NOT NULL,
                title           TEXT    DEFAULT '',
                rules_result    TEXT    DEFAULT '',
                custom_messages TEXT    DEFAULT '',
                created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
                updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
            )
            """);

        log.info("V2 schema: critique_artworks table created");
    }

    /**
     * V3: 情绪板图库数据持久化
     * - vault_images: 情绪板 THE VAULT 中的素材图片
     */
    private void applyV3() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS vault_images (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                url          TEXT    NOT NULL,
                name         TEXT    DEFAULT '',
                aspect_ratio REAL    DEFAULT 1.5,
                created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
            )
            """);

        log.info("V3 schema: vault_images table created");
    }

    /**
     * V4: 创作成长编年史数据持久化
     * - timeline_nodes: 时间轴节点（关联画廊专辑作为封面）
     */
    private void applyV4() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS timeline_nodes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT    NOT NULL,
                period      TEXT    DEFAULT '',
                cover_url   TEXT    DEFAULT '',
                analysis    TEXT    DEFAULT '',
                album_id    INTEGER REFERENCES albums(id) ON DELETE SET NULL,
                sort_order  INTEGER DEFAULT 0,
                created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            )
            """);

        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_timeline_nodes_sort ON timeline_nodes(sort_order)");

        log.info("V4 schema: timeline_nodes table created");
    }
}
