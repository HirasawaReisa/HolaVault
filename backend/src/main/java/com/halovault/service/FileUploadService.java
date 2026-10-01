package com.halovault.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

/**
 * 文件上传服务
 */
@Slf4j
@Service
public class FileUploadService {

    @Value("${upload.path:./uploads}")
    private String uploadPath;

    /**
     * 上传图片文件，返回可访问的 URL
     *
     * @param file 上传的文件
     * @return 图片的相对 URL 路径
     */
    public String uploadImage(MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("文件不能为空");
        }

        // 验证文件类型
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("仅支持上传图片文件");
        }

        // 生成唯一文件名
        String originalName = file.getOriginalFilename();
        String ext = "";
        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf("."));
        }
        String fileName = UUID.randomUUID().toString().replace("-", "") + ext;

        // 将相对路径转为绝对路径，避免 MultipartFile.transferTo() 解析到 Tomcat 临时目录
        Path dirPath = Paths.get(uploadPath).toAbsolutePath();
        if (!Files.exists(dirPath)) {
            Files.createDirectories(dirPath);
        }

        // 保存文件（使用绝对路径）
        Path filePath = dirPath.resolve(fileName);
        file.transferTo(filePath.toFile());
        log.info("File uploaded to: {}", filePath.toAbsolutePath());

        // 返回相对 URL
        return "/uploads/" + fileName;
    }
}
