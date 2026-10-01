package com.halovault.controller;

import com.halovault.dto.ApiResponse;
import com.halovault.entity.CheckinRecord;
import com.halovault.service.CheckinService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 百日绘打卡 API 控制器
 * 提供打卡记录的增删改查与统计接口
 */
@RestController
@RequestMapping("/api/checkin")
@RequiredArgsConstructor
public class CheckinController {

    private final CheckinService checkinService;

    // ── CRUD ──

    /**
     * 获取挑战状态汇总（前端初始化用）
     * 返回当前天数、连续天数、已完成天数、缺卡列表、所有记录
     */
    @GetMapping("/stats")
    public ApiResponse<CheckinService.ChallengeStats> getStats() {
        return ApiResponse.success(checkinService.getStats());
    }

    /**
     * 获取所有打卡记录
     */
    @GetMapping("/records")
    public ApiResponse<List<CheckinRecord>> getAllRecords() {
        return ApiResponse.success(checkinService.getAllRecords());
    }

    /**
     * 获取指定天数的打卡记录
     */
    @GetMapping("/records/{day}")
    public ApiResponse<CheckinRecord> getByDay(@PathVariable int day) {
        CheckinRecord record = checkinService.getByDay(day);
        if (record == null) {
            return ApiResponse.error(404, "第 " + day + " 天暂无打卡记录");
        }
        return ApiResponse.success(record);
    }

    /**
     * 打卡（新增或更新）
     * 如果该天数已有记录则更新，否则新增
     */
    @PostMapping("/records")
    public ApiResponse<CheckinRecord> checkin(@RequestBody CheckinRequest req) {
        try {
            return ApiResponse.success(checkinService.checkin(req.day(), req.imageUrl(), req.note()));
        } catch (Exception e) {
            return ApiResponse.error(500, "打卡失败: " + e.getMessage());
        }
    }

    /**
     * 删除指定天数的打卡记录
     */
    @DeleteMapping("/records/{day}")
    public ApiResponse<Boolean> deleteByDay(@PathVariable int day) {
        try {
            return ApiResponse.success(checkinService.deleteByDay(day));
        } catch (Exception e) {
            return ApiResponse.error(500, "删除记录失败: " + e.getMessage());
        }
    }

    /**
     * 查询指定天数范围内的打卡记录
     */
    @GetMapping("/records/range")
    public ApiResponse<List<CheckinRecord>> getByRange(
            @RequestParam int from,
            @RequestParam int to) {
        return ApiResponse.success(checkinService.getByDayRange(from, to));
    }

    // ── 请求 DTO ──

    public record CheckinRequest(
            int day,
            String imageUrl,
            String note
    ) {}
}
