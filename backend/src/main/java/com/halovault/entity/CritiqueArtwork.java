package com.halovault.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * AI 点评画作实体
 * 每条记录对应一张上传到点评页的画作，及其关联的分析结果
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CritiqueArtwork {

    private Long id;
    private String imageUrl;      // 图片 URL（后端上传路径 /uploads/xxx.jpg）
    private String title;         // 图片标题/文件名
    private String rulesResult;   // 规则模式分析结果 JSON（Dimension[] 序列化）
    private String customMessages; // 自定义模式对话历史 JSON（ChatMessage[] 序列化）
    private String createdAt;
    private String updatedAt;
}
