package com.halovault.repository;

import com.halovault.entity.CritiqueArtwork;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.Statement;
import java.util.List;
import java.util.Optional;

/**
 * AI 点评画作 Repository — JdbcTemplate 实现
 */
@Repository
@RequiredArgsConstructor
public class CritiqueRepository {

    private final JdbcTemplate jdbcTemplate;

    private final RowMapper<CritiqueArtwork> rowMapper = (rs, rowNum) -> CritiqueArtwork.builder()
            .id(rs.getLong("id"))
            .imageUrl(rs.getString("image_url"))
            .title(rs.getString("title"))
            .rulesResult(rs.getString("rules_result"))
            .customMessages(rs.getString("custom_messages"))
            .createdAt(rs.getString("created_at"))
            .updatedAt(rs.getString("updated_at"))
            .build();

    /** 查询所有点评画作 */
    public List<CritiqueArtwork> findAll() {
        return jdbcTemplate.query("SELECT * FROM critique_artworks ORDER BY created_at DESC", rowMapper);
    }

    /** 根据 ID 查询 */
    public Optional<CritiqueArtwork> findById(Long id) {
        return jdbcTemplate.query("SELECT * FROM critique_artworks WHERE id = ?", rowMapper, id)
                .stream().findFirst();
    }

    /** 插入新记录，返回自增 ID */
    public Long insert(CritiqueArtwork artwork) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(conn -> {
            var ps = conn.prepareStatement(
                    "INSERT INTO critique_artworks (image_url, title, rules_result, custom_messages, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, artwork.getImageUrl());
            ps.setString(2, artwork.getTitle() != null ? artwork.getTitle() : "");
            ps.setString(3, artwork.getRulesResult() != null ? artwork.getRulesResult() : "");
            ps.setString(4, artwork.getCustomMessages() != null ? artwork.getCustomMessages() : "");
            return ps;
        }, keyHolder);
        return keyHolder.getKey().longValue();
    }

    /** 更新规则分析结果 */
    public void updateRulesResult(Long id, String rulesResult) {
        jdbcTemplate.update(
                "UPDATE critique_artworks SET rules_result = ?, updated_at = datetime('now') WHERE id = ?",
                rulesResult, id
        );
    }

    /** 更新自定义对话历史 */
    public void updateCustomMessages(Long id, String customMessages) {
        jdbcTemplate.update(
                "UPDATE critique_artworks SET custom_messages = ?, updated_at = datetime('now') WHERE id = ?",
                customMessages, id
        );
    }

    /** 根据 ID 删除 */
    public void deleteById(Long id) {
        jdbcTemplate.update("DELETE FROM critique_artworks WHERE id = ?", id);
    }
}
