package com.halovault.controller;

import com.halovault.dto.ApiResponse;
import com.halovault.entity.VaultImage;
import com.halovault.service.VaultImageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 情绪板图库 REST 接口
 * 提供 THE VAULT 素材数据的 CRUD 操作
 */
@Slf4j
@RestController
@RequestMapping("/api/vault")
@RequiredArgsConstructor
public class VaultImageController {

    private final VaultImageService vaultImageService;

    /** 获取所有图库素材 */
    @GetMapping("/images")
    public ApiResponse<List<VaultImage>> getAllImages() {
        return ApiResponse.success(vaultImageService.getAllImages());
    }

    /** 获取单个素材 */
    @GetMapping("/images/{id}")
    public ApiResponse<VaultImage> getImage(@PathVariable Long id) {
        return vaultImageService.getImageById(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "素材不存在"));
    }

    /** 创建图库素材（上传图片后保存记录） */
    @PostMapping("/images")
    public ApiResponse<VaultImage> createImage(@RequestBody Map<String, Object> body) {
        String url = (String) body.get("url");
        String name = (String) body.getOrDefault("name", "");
        Double aspectRatio = null;
        Object arObj = body.get("aspectRatio");
        if (arObj instanceof Number) {
            aspectRatio = ((Number) arObj).doubleValue();
        }
        if (url == null || url.isBlank()) {
            return ApiResponse.error(400, "url 不能为空");
        }
        return ApiResponse.success(vaultImageService.createImage(url, name, aspectRatio));
    }

    /** 删除图库素材 */
    @DeleteMapping("/images/{id}")
    public ApiResponse<Void> deleteImage(@PathVariable Long id) {
        vaultImageService.deleteImage(id);
        return ApiResponse.success(null);
    }
}
