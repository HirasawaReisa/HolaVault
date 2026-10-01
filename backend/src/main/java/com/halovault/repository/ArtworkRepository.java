package com.halovault.repository;

import com.halovault.entity.Artwork;
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
 * 画作数据访问层
 * 使用 JdbcTemplate 操作 SQLite，封装 CRUD 和映射逻辑
 */
@Repository
@RequiredArgsConstructor
public class ArtworkRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final DateTimeFormatter DT_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final RowMapper<Artwork> rowMapper = (rs, rowNum) -> Artwork.builder()
            .id(rs.getLong("id"))
            .albumId(rs.getLong("album_id"))
            .title(rs.getString("title"))
            .seed(rs.getString("seed"))
            .imageUrl(rs.getString("image_url"))
            .height(rs.getInt("height"))
            .platform(rs.getString("platform"))
            .platformUrl(rs.getString("platform_url"))
            .highlights(rs.getString("highlights"))
            .description(rs.getString("description"))
            .sortOrder(rs.getInt("sort_order"))
            .createdAt(parseDateTime(rs.getString("created_at")))
            .updatedAt(parseDateTime(rs.getString("updated_at")))
            .build();

    /**
     * 根据专辑 ID 查询所有画作（按排序字段排列）
     */
    public List<Artwork> findByAlbumId(Long albumId) {
        return jdbcTemplate.query(
                "SELECT * FROM artworks WHERE album_id = ? ORDER BY sort_order ASC, id ASC",
                rowMapper, albumId);
    }

    /**
     * 根据 ID 查询单幅画作
     */
    public Optional<Artwork> findById(Long id) {
        List<Artwork> results = jdbcTemplate.query("SELECT * FROM artworks WHERE id = ?", rowMapper, id);
        return results.stream().findFirst();
    }

    /**
     * 查询所有画作
     */
    public List<Artwork> findAll() {
        return jdbcTemplate.query("SELECT * FROM artworks ORDER BY id ASC", rowMapper);
    }

    /**
     * 新增画作，返回带自增 ID 的对象
     */
    public Artwork insert(Artwork artwork) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(conn -> {
            var ps = conn.prepareStatement(
                    "INSERT INTO artworks (album_id, title, seed, image_url, height, platform, platform_url, highlights, description, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, artwork.getAlbumId());
            ps.setString(2, artwork.getTitle());
            ps.setString(3, artwork.getSeed() != null ? artwork.getSeed() : "");
            ps.setString(4, artwork.getImageUrl() != null ? artwork.getImageUrl() : "");
            ps.setInt(5, artwork.getHeight() != null ? artwork.getHeight() : 280);
            ps.setString(6, artwork.getPlatform() != null ? artwork.getPlatform() : "");
            ps.setString(7, artwork.getPlatformUrl() != null ? artwork.getPlatformUrl() : "");
            ps.setString(8, artwork.getHighlights() != null ? artwork.getHighlights() : "");
            ps.setString(9, artwork.getDescription() != null ? artwork.getDescription() : "");
            ps.setInt(10, artwork.getSortOrder() != null ? artwork.getSortOrder() : 0);
            ps.setString(11, formatDateTime(LocalDateTime.now()));
            ps.setString(12, formatDateTime(LocalDateTime.now()));
            return ps;
        }, keyHolder);

        artwork.setId(keyHolder.getKey().longValue());
        artwork.setCreatedAt(LocalDateTime.now());
        artwork.setUpdatedAt(LocalDateTime.now());
        return artwork;
    }

    /**
     * 批量新增画作
     */
    public List<Artwork> batchInsert(List<Artwork> artworks) {
        return artworks.stream().map(this::insert).toList();
    }

    /**
     * 更新画作信息
     */
    public boolean update(Artwork artwork) {
        int rows = jdbcTemplate.update(
                "UPDATE artworks SET title = ?, seed = ?, image_url = ?, height = ?, platform = ?, platform_url = ?, highlights = ?, description = ?, sort_order = ?, updated_at = ? WHERE id = ?",
                artwork.getTitle(),
                artwork.getSeed(),
                artwork.getImageUrl(),
                artwork.getHeight(),
                artwork.getPlatform(),
                artwork.getPlatformUrl(),
                artwork.getHighlights(),
                artwork.getDescription(),
                artwork.getSortOrder(),
                formatDateTime(LocalDateTime.now()),
                artwork.getId());
        return rows > 0;
    }

    /**
     * 删除画作
     */
    public boolean deleteById(Long id) {
        int rows = jdbcTemplate.update("DELETE FROM artworks WHERE id = ?", id);
        return rows > 0;
    }

    /**
     * 删除某专辑下所有画作
     */
    public int deleteByAlbumId(Long albumId) {
        return jdbcTemplate.update("DELETE FROM artworks WHERE album_id = ?", albumId);
    }

    /**
     * 统计某专辑下的画作数量
     */
    public int countByAlbumId(Long albumId) {
        Integer cnt = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM artworks WHERE album_id = ?", Integer.class, albumId);
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
