package com.halovault.repository;

import com.halovault.entity.VaultImage;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.Statement;
import java.util.List;
import java.util.Optional;

/**
 * 情绪板图库 Repository — JdbcTemplate 实现
 */
@Repository
@RequiredArgsConstructor
public class VaultImageRepository {

    private final JdbcTemplate jdbcTemplate;

    private final RowMapper<VaultImage> rowMapper = (rs, rowNum) -> VaultImage.builder()
            .id(rs.getLong("id"))
            .url(rs.getString("url"))
            .name(rs.getString("name"))
            .aspectRatio(rs.getDouble("aspect_ratio"))
            .createdAt(rs.getString("created_at"))
            .build();

    /** 查询所有图库素材 */
    public List<VaultImage> findAll() {
        return jdbcTemplate.query("SELECT * FROM vault_images ORDER BY created_at DESC", rowMapper);
    }

    /** 根据 ID 查询 */
    public Optional<VaultImage> findById(Long id) {
        return jdbcTemplate.query("SELECT * FROM vault_images WHERE id = ?", rowMapper, id)
                .stream().findFirst();
    }

    /** 插入新素材，返回自增 ID */
    public Long insert(VaultImage image) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(conn -> {
            var ps = conn.prepareStatement(
                    "INSERT INTO vault_images (url, name, aspect_ratio, created_at) VALUES (?, ?, ?, datetime('now'))",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, image.getUrl());
            ps.setString(2, image.getName() != null ? image.getName() : "");
            ps.setDouble(3, image.getAspectRatio() != null ? image.getAspectRatio() : 1.5);
            return ps;
        }, keyHolder);
        return keyHolder.getKey().longValue();
    }

    /** 根据 ID 删除 */
    public void deleteById(Long id) {
        jdbcTemplate.update("DELETE FROM vault_images WHERE id = ?", id);
    }

    /** 统计素材总数 */
    public int count() {
        Integer c = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM vault_images", Integer.class);
        return c != null ? c : 0;
    }
}
