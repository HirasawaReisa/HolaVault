package com.halovault.repository;

import com.halovault.entity.CheckinRecord;
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
 * 打卡记录数据访问层
 * 使用 JdbcTemplate 操作 SQLite，封装 CRUD 和映射逻辑
 */
@Repository
@RequiredArgsConstructor
public class CheckinRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final DateTimeFormatter DT_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final RowMapper<CheckinRecord> rowMapper = (rs, rowNum) -> CheckinRecord.builder()
            .id(rs.getLong("id"))
            .day(rs.getInt("day"))
            .imageUrl(rs.getString("image_url"))
            .note(rs.getString("note"))
            .streak(rs.getInt("streak"))
            .createdAt(parseDateTime(rs.getString("created_at")))
            .build();

    /**
     * 查询所有打卡记录（按天数排序）
     */
    public List<CheckinRecord> findAll() {
        return jdbcTemplate.query("SELECT * FROM checkin_records ORDER BY day ASC", rowMapper);
    }

    /**
     * 根据天数查询打卡记录
     */
    public Optional<CheckinRecord> findByDay(int day) {
        List<CheckinRecord> results = jdbcTemplate.query(
                "SELECT * FROM checkin_records WHERE day = ?", rowMapper, day);
        return results.stream().findFirst();
    }

    /**
     * 根据 ID 查询打卡记录
     */
    public Optional<CheckinRecord> findById(Long id) {
        List<CheckinRecord> results = jdbcTemplate.query(
                "SELECT * FROM checkin_records WHERE id = ?", rowMapper, id);
        return results.stream().findFirst();
    }

    /**
     * 新增打卡记录，返回带自增 ID 的对象
     */
    public CheckinRecord insert(CheckinRecord record) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(conn -> {
            var ps = conn.prepareStatement(
                    "INSERT INTO checkin_records (day, image_url, note, streak, created_at) VALUES (?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, record.getDay());
            ps.setString(2, record.getImageUrl() != null ? record.getImageUrl() : "");
            ps.setString(3, record.getNote() != null ? record.getNote() : "");
            ps.setInt(4, record.getStreak() != null ? record.getStreak() : 0);
            ps.setString(5, formatDateTime(LocalDateTime.now()));
            return ps;
        }, keyHolder);

        record.setId(keyHolder.getKey().longValue());
        record.setCreatedAt(LocalDateTime.now());
        return record;
    }

    /**
     * 更新打卡记录
     */
    public boolean update(CheckinRecord record) {
        int rows = jdbcTemplate.update(
                "UPDATE checkin_records SET image_url = ?, note = ?, streak = ? WHERE day = ?",
                record.getImageUrl(),
                record.getNote(),
                record.getStreak(),
                record.getDay());
        return rows > 0;
    }

    /**
     * 删除某天的打卡记录
     */
    public boolean deleteByDay(int day) {
        int rows = jdbcTemplate.update("DELETE FROM checkin_records WHERE day = ?", day);
        return rows > 0;
    }

    /**
     * 统计已打卡天数
     */
    public int countCompleted() {
        Integer cnt = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM checkin_records", Integer.class);
        return cnt != null ? cnt : 0;
    }

    /**
     * 计算最大连续打卡天数（从数据库层面统计）
     */
    public int calculateMaxStreak() {
        // 直接取 streak 字段的最大值（每次打卡时已计算并存储 streak）
        try {
            Integer maxStreak = jdbcTemplate.queryForObject(
                    "SELECT MAX(streak) FROM checkin_records", Integer.class);
            return maxStreak != null ? maxStreak : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * 查询最近一次打卡记录
     */
    public Optional<CheckinRecord> findLatest() {
        List<CheckinRecord> results = jdbcTemplate.query(
                "SELECT * FROM checkin_records ORDER BY day DESC LIMIT 1", rowMapper);
        return results.stream().findFirst();
    }

    /**
     * 查询指定范围内的打卡记录
     */
    public List<CheckinRecord> findByDayRange(int fromDay, int toDay) {
        return jdbcTemplate.query(
                "SELECT * FROM checkin_records WHERE day BETWEEN ? AND ? ORDER BY day ASC",
                rowMapper, fromDay, toDay);
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
