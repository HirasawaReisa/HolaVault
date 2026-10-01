package com.halovault.controller;

import com.halovault.dto.ApiResponse;
import com.halovault.entity.TimelineNode;
import com.halovault.service.TimelineNodeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 创作成长编年史 REST 接口
 * 提供时间轴节点数据的 CRUD 操作
 */
@Slf4j
@RestController
@RequestMapping("/api/timeline")
@RequiredArgsConstructor
public class TimelineNodeController {

    private final TimelineNodeService timelineNodeService;

    /** 获取所有时间轴节点 */
    @GetMapping("/nodes")
    public ApiResponse<List<TimelineNode>> getAllNodes() {
        return ApiResponse.success(timelineNodeService.getAllNodes());
    }

    /** 获取单个节点 */
    @GetMapping("/nodes/{id}")
    public ApiResponse<TimelineNode> getNode(@PathVariable Long id) {
        return timelineNodeService.getNodeById(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "节点不存在"));
    }

    /** 创建时间轴节点 */
    @PostMapping("/nodes")
    public ApiResponse<TimelineNode> createNode(@RequestBody Map<String, Object> body) {
        String title = (String) body.get("title");
        String period = (String) body.getOrDefault("period", "");
        String coverUrl = (String) body.getOrDefault("coverUrl", "");
        String analysis = (String) body.getOrDefault("analysis", "");
        Long albumId = null;
        Object albumIdObj = body.get("albumId");
        if (albumIdObj instanceof Number) {
            albumId = ((Number) albumIdObj).longValue();
        }
        if (title == null || title.isBlank()) {
            return ApiResponse.error(400, "title 不能为空");
        }
        return ApiResponse.success(timelineNodeService.createNode(title, period, coverUrl, analysis, albumId));
    }

    /** 删除时间轴节点 */
    @DeleteMapping("/nodes/{id}")
    public ApiResponse<Void> deleteNode(@PathVariable Long id) {
        timelineNodeService.deleteNode(id);
        return ApiResponse.success(null);
    }
}
