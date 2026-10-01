package com.halovault.repository;

import com.halovault.entity.Album;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.Statement;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

/**
 * 专辑数据访问层
 * 使用 JdbcTemplate 操作 SQLite，封装 CRUD 和映射逻辑
 */
@Repository
@RequiredArgsConstructor
public class AlbumRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final DateTimeFormatter DT_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final RowMapper<Album> rowMapper = (rs, rowNum) -> Album.builder()
            .id(rs.getLong("id"))
            .title(rs.getString("title"))
            .description(rs.getString("description"))
            .coverSeed(rs.getString("cover_seed"))
            .createdAt(parseDateTime(rs.getString("created_at")))
            .updatedAt(parseDateTime(rs.getString("updated_at")))
            .build();

    /**
     * 查询所有专辑
     */
    public List<Album> findAll() {
        return jdbcTemplate.query("SELECT * FROM albums ORDER BY created_at DESC", rowMapper);
    }

    /**
     * 根据 ID 查询专辑
     */
    public Optional<Album> findById(Long id) {
        List<Album> results = jdbcTemplate.query("SELECT * FROM albums WHERE id = ?", rowMapper, id);
        return results.stream().findFirst();
    }

    /**
     * 新建专辑，返回带自增 ID 的对象
     */
    public Album insert(Album album) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(conn -> {
            var ps = conn.prepareStatement(
                    "INSERT INTO albums (title, description, cover_seed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, album.getTitle());
            ps.setString(2, album.getDescription() != null ? album.getDescription() : "");
            ps.setString(3, album.getCoverSeed() != null ? album.getCoverSeed() : "");
            ps.setString(4, formatDateTime(LocalDateTime.now()));
            ps.setString(5, formatDateTime(LocalDateTime.now()));
            return ps;
        }, keyHolder);

        album.setId(keyHolder.getKey().longValue());
        album.setCreatedAt(LocalDateTime.now());
        album.setUpdatedAt(LocalDateTime.now());
        return album;
    }

    /**
     * 更新专辑信息
     */
    public boolean update(Album album) {
        int rows = jdbcTemplate.update(
                "UPDATE albums SET title = ?, description = ?, cover_seed = ?, updated_at = ? WHERE id = ?",
                album.getTitle(),
                album.getDescription(),
                album.getCoverSeed(),
                formatDateTime(LocalDateTime.now()),
                album.getId());
        return rows > 0;
    }

    /**
     * 删除专辑（CASCADE 会自动删除关联画作）
     */
    public boolean deleteById(Long id) {
        int rows = jdbcTemplate.update("DELETE FROM albums WHERE id = ?", id);
        return rows > 0;
    }

    /**
     * 统计专辑总数
     */
    public int count() {
        Integer cnt = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM albums", Integer.class);
        return cnt != null ? cnt : 0;
    }

    // ── 工具方法 ──

    private LocalDateTime parseDateTime(String text) {
        if (text == null || text.isEmpty()) return LocalDateTime.now();
        return LocalDateTime.parse(text, DT_FMT);
    }

    private String formatDateTime(LocalDateTime dt) {
        return dt.format(DT_FMT);
    }
}
