package com.halovault.repository;

import com.halovault.entity.TimelineNode;
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
 * 创作成长编年史节点 Repository — JdbcTemplate 实现
 */
@Repository
@RequiredArgsConstructor
public class TimelineNodeRepository {

    private final JdbcTemplate jdbcTemplate;

    private final RowMapper<TimelineNode> rowMapper = (rs, rowNum) -> TimelineNode.builder()
            .id(rs.getLong("id"))
            .title(rs.getString("title"))
            .period(rs.getString("period"))
            .coverUrl(rs.getString("cover_url"))
            .analysis(rs.getString("analysis"))
            .albumId(rs.getObject("album_id") != null ? rs.getLong("album_id") : null)
            .sortOrder(rs.getObject("sort_order") != null ? rs.getInt("sort_order") : null)
            .createdAt(rs.getString("created_at"))
            .build();

    /** 查询所有节点（按 sort_order 升序） */
    public List<TimelineNode> findAll() {
        return jdbcTemplate.query(
                "SELECT * FROM timeline_nodes ORDER BY sort_order ASC, id ASC",
                rowMapper);
    }

    /** 根据 ID 查询 */
    public Optional<TimelineNode> findById(Long id) {
        return jdbcTemplate.query("SELECT * FROM timeline_nodes WHERE id = ?", rowMapper, id)
                .stream().findFirst();
    }

    /** 插入新节点，返回自增 ID */
    public Long insert(TimelineNode node) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(conn -> {
            var ps = conn.prepareStatement(
                    "INSERT INTO timeline_nodes (title, period, cover_url, analysis, album_id, sort_order, created_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, node.getTitle());
            ps.setString(2, node.getPeriod() != null ? node.getPeriod() : "");
            ps.setString(3, node.getCoverUrl() != null ? node.getCoverUrl() : "");
            ps.setString(4, node.getAnalysis() != null ? node.getAnalysis() : "");
            if (node.getAlbumId() != null) {
                ps.setLong(5, node.getAlbumId());
            } else {
                ps.setNull(5, java.sql.Types.INTEGER);
            }
            if (node.getSortOrder() != null) {
                ps.setInt(6, node.getSortOrder());
            } else {
                // 默认排序：当前最大 sort_order + 1
                Integer maxOrder = jdbcTemplate.queryForObject(
                        "SELECT MAX(sort_order) FROM timeline_nodes", Integer.class);
                ps.setInt(6, maxOrder != null ? maxOrder + 1 : 1);
            }
            return ps;
        }, keyHolder);
        return keyHolder.getKey().longValue();
    }

    /** 根据 ID 删除 */
    public void deleteById(Long id) {
        jdbcTemplate.update("DELETE FROM timeline_nodes WHERE id = ?", id);
    }

    /** 获取当前最大排序号 */
    public int getMaxSortOrder() {
        Integer max = jdbcTemplate.queryForObject(
                "SELECT MAX(sort_order) FROM timeline_nodes", Integer.class);
        return max != null ? max : 0;
    }
}
