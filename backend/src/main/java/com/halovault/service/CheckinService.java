package com.halovault.service;

import com.halovault.entity.CheckinRecord;
import com.halovault.repository.CheckinRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 百日绘打卡业务服务层
 * 封装打卡记录的增删改查、连续天数计算与统计功能
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CheckinService {

    private final CheckinRepository checkinRepo;

    // ── CRUD ──

    /**
     * 获取所有打卡记录（按天数排序）
     */
    public List<CheckinRecord> getAllRecords() {
        return checkinRepo.findAll();
    }

    /**
     * 根据天数获取打卡记录
     */
    public CheckinRecord getByDay(int day) {
        return checkinRepo.findByDay(day).orElse(null);
    }

    /**
     * 根据 ID 获取打卡记录
     */
    public CheckinRecord getById(Long id) {
        return checkinRepo.findById(id).orElse(null);
    }

    /**
     * 打卡（新增或更新）
     * - 如果该天数已有记录，则更新
     * - 如果该天数无记录，则新增并计算 streak
     */
    @Transactional
    public CheckinRecord checkin(int day, String imageUrl, String note) {
        log.info("Checkin for day {}", day);

        // 计算连续天数
        int streak = calculateStreak(day);

        var existing = checkinRepo.findByDay(day);
        if (existing.isPresent()) {
            // 更新已有记录
            CheckinRecord record = existing.get();
            record.setImageUrl(imageUrl);
            record.setNote(note);
            record.setStreak(streak);
            checkinRepo.update(record);
            return record;
        } else {
            // 新增记录
            CheckinRecord record = CheckinRecord.builder()
                    .day(day)
                    .imageUrl(imageUrl)
                    .note(note)
                    .streak(streak)
                    .build();
            return checkinRepo.insert(record);
        }
    }

    /**
     * 删除某天的打卡记录
     */
    @Transactional
    public boolean deleteByDay(int day) {
        log.info("Deleting checkin record for day {}", day);
        return checkinRepo.deleteByDay(day);
    }

    // ── 统计 ──

    /**
     * 计算从指定天数往回看的连续打卡天数
     * 使用范围查询避免 N+1 问题：一次获取所有历史记录，在内存中计算
     */
    private int calculateStreak(int day) {
        int streak = 1; // 当天算 1
        // 批量获取历史打卡天数，避免逐日查询
        Set<Integer> completedDays = checkinRepo.findByDayRange(1, day - 1)
                .stream()
                .map(CheckinRecord::getDay)
                .collect(Collectors.toSet());
        // 从 day-1 往回检查连续性
        for (int d = day - 1; d >= 1; d--) {
            if (completedDays.contains(d)) {
                streak++;
            } else {
                break;
            }
        }
        return streak;
    }

    /**
     * 获取挑战状态汇总（用于前端初始化）
     */
    public ChallengeStats getStats() {
        List<CheckinRecord> records = checkinRepo.findAll();
        int completedDays = records.size();
        int maxStreak = records.stream()
                .mapToInt(r -> r.getStreak() != null ? r.getStreak() : 0)
                .max().orElse(0);

        // 计算最新天数
        int currentDay = records.stream()
                .mapToInt(CheckinRecord::getDay)
                .max().orElse(0) + 1;
        if (currentDay > 100) currentDay = 100;

        // 计算缺卡天数
        List<Integer> completedDayNums = records.stream()
                .map(CheckinRecord::getDay).toList();
        List<Integer> missedDays = java.util.stream.IntStream.rangeClosed(1, currentDay - 1)
                .filter(d -> !completedDayNums.contains(d))
                .boxed().toList();

        // 当前连续天数
        int currentStreak = records.stream()
                .filter(r -> r.getStreak() != null)
                .mapToInt(CheckinRecord::getStreak)
                .max().orElse(0);

        return new ChallengeStats(currentDay, currentStreak, completedDays, maxStreak, missedDays, records);
    }

    /**
     * 查询指定范围打卡记录
     */
    public List<CheckinRecord> getByDayRange(int from, int to) {
        return checkinRepo.findByDayRange(from, to);
    }

    // ── 内部 DTO ──

    /**
     * 挑战统计汇总
     */
    public record ChallengeStats(
            int currentDay,
            int streak,
            int completedDays,
            int maxStreak,
            List<Integer> missedDays,
            List<CheckinRecord> records
    ) {}
}
