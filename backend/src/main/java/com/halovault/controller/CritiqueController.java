package com.halovault.controller;

import com.halovault.dto.ApiResponse;
import com.halovault.entity.CritiqueArtwork;
import com.halovault.service.CritiqueService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * AI 点评画作 REST 接口
 * 提供点评数据的 CRUD 和分析结果的持久化保存
 */
@Slf4j
@RestController
@RequestMapping("/api/critique")
@RequiredArgsConstructor
public class CritiqueController {

    private final CritiqueService critiqueService;

    /** 获取所有点评画作（含已保存的分析结果） */
    @GetMapping("/artworks")
    public ApiResponse<List<CritiqueArtwork>> getAllArtworks() {
        return ApiResponse.success(critiqueService.getAllArtworks());
    }

    /** 获取单个点评画作 */
    @GetMapping("/artworks/{id}")
    public ApiResponse<CritiqueArtwork> getArtwork(@PathVariable Long id) {
        return critiqueService.getArtworkById(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "点评画作不存在"));
    }

    /** 创建点评画作（上传图片后保存记录） */
    @PostMapping("/artworks")
    public ApiResponse<CritiqueArtwork> createArtwork(@RequestBody Map<String, String> body) {
        String imageUrl = body.get("imageUrl");
        String title = body.getOrDefault("title", "");
        if (imageUrl == null || imageUrl.isBlank()) {
            return ApiResponse.error(400, "imageUrl 不能为空");
        }
        return ApiResponse.success(critiqueService.createArtwork(imageUrl, title));
    }

    /** 保存规则模式分析结果 */
    @PutMapping("/artworks/{id}/rules")
    public ApiResponse<Void> saveRulesResult(
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        String rulesResult = body.get("rulesResult");
        if (rulesResult == null) {
            return ApiResponse.error(400, "rulesResult 不能为空");
        }
        critiqueService.saveRulesResult(id, rulesResult);
        return ApiResponse.success(null);
    }

    /** 保存自定义对话历史 */
    @PutMapping("/artworks/{id}/custom")
    public ApiResponse<Void> saveCustomMessages(
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        String customMessages = body.get("customMessages");
        if (customMessages == null) {
            return ApiResponse.error(400, "customMessages 不能为空");
        }
        critiqueService.saveCustomMessages(id, customMessages);
        return ApiResponse.success(null);
    }

    /** 删除点评画作 */
    @DeleteMapping("/artworks/{id}")
    public ApiResponse<Void> deleteArtwork(@PathVariable Long id) {
        critiqueService.deleteArtwork(id);
        return ApiResponse.success(null);
    }
}
