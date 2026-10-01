package com.halovault.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 聊天请求 DTO
 * 支持 OpenAI 兼容格式的多模态消息
 */
@Data
public class ChatRequest {

    /**
     * 消息列表，每条消息包含 role + content
     * content 可以是纯文本，也可以是多模态内容（文本+图片URL）
     */
    private List<MessageDto> messages;

    /**
     * 是否流式返回
     */
    private boolean stream = true;

    // ── 请求级 API 配置覆盖（可选，前端设置面板传入） ──

    /**
     * API Key — 如果前端传了，优先使用此值；否则用 application.yml 配置
     */
    private String apiKey;

    /**
     * API Base URL — 如果前端传了，优先使用此值；否则用 application.yml 配置
     */
    private String apiBaseUrl;

    /**
     * 模型名称 — 如果前端传了，优先使用此值；否则用 application.yml 配置
     */
    private String model;

    @Data
    public static class MessageDto {
        private String role;  // system / user / assistant
        private String content;  // 纯文本内容（简单模式）
        private List<ContentPart> contentParts;  // 多模态内容（高级模式）
    }

    @Data
    public static class ContentPart {
        private String type;  // text / image_url
        private String text;  // type=text 时的文本
        private ImageUrl imageUrl;  // type=image_url 时的图片

        public static ContentPart text(String text) {
            ContentPart part = new ContentPart();
            part.setType("text");
            part.setText(text);
            return part;
        }

        public static ContentPart imageUrl(String url) {
            ContentPart part = new ContentPart();
            part.setType("image_url");
            part.setImageUrl(new ImageUrl(url));
            return part;
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImageUrl {
        private String url;
    }
}
