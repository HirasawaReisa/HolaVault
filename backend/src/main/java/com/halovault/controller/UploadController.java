package com.halovault.controller;

import com.halovault.dto.ApiResponse;
import com.halovault.service.FileUploadService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * 文件上传控制器
 * 处理画作图片的上传
 */
@Slf4j
@RestController
@RequestMapping("/api/upload")
@RequiredArgsConstructor
public class UploadController {

    private final FileUploadService fileUploadService;

    /**
     * 上传图片
     * 返回图片的访问 URL
     */
    @PostMapping("/image")
    public ApiResponse<String> uploadImage(@RequestParam("file") MultipartFile file) {
        try {
            String url = fileUploadService.uploadImage(file);
            return ApiResponse.success(url);
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        } catch (Exception e) {
            log.error("File upload failed", e);
            return ApiResponse.error(500, "上传失败: " + e.getMessage());
        }
    }
}
