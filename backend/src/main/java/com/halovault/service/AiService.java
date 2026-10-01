package com.halovault.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.halovault.config.AiApiConfig;
import com.halovault.dto.ChatRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * AI 服务 — 调用 OpenAI 兼容 API（智谱 GLM 系列）
 * 支持流式 SSE 返回
 * 支持请求级配置覆盖（前端可传入 apiKey / apiBaseUrl / model）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiService {

    private final AiApiConfig aiApiConfig;
    private final ObjectMapper objectMapper;

    @Value("${upload.path:./uploads}")
    private String uploadPath;

    private static final MediaType JSON_TYPE = MediaType.get("application/json; charset=utf-8");

    // ── 配置解析：优先用请求级覆盖，没传就用 application.yml 默认值 ──

    private String resolveApiKey(ChatRequest req) {
        return (req.getApiKey() != null && !req.getApiKey().isBlank())
                ? req.getApiKey() : aiApiConfig.getKey();
    }

    private String resolveBaseUrl(ChatRequest req) {
        return (req.getApiBaseUrl() != null && !req.getApiBaseUrl().isBlank())
                ? req.getApiBaseUrl() : aiApiConfig.getBaseUrl();
    }

    private String resolveModel(ChatRequest req) {
        return (req.getModel() != null && !req.getModel().isBlank())
                ? req.getModel() : aiApiConfig.getModel();
    }

    /**
     * 流式聊天 — 将 AI 回复通过 SseEmitter 逐 token 推送给前端
     *
     * @param chatRequest 聊天请求
     * @param emitter     SSE 发射器
     */
    public void streamChat(ChatRequest chatRequest, SseEmitter emitter) {
        try {
            String apiKey = resolveApiKey(chatRequest);
            String baseUrl = resolveBaseUrl(chatRequest);
            String model = resolveModel(chatRequest);

            // 构建 OpenAI 兼容请求体
            Map<String, Object> requestBody = buildOpenAiRequestBody(chatRequest, model);
            String jsonBody = objectMapper.writeValueAsString(requestBody);
            log.info("Sending stream request to AI API, model={}, messages={}, baseUrl={}", model, chatRequest.getMessages().size(), baseUrl);

            // OkHttp 客户端（长超时适配流式）
            OkHttpClient client = new OkHttpClient.Builder()
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(120, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .build();

            Request request = new Request.Builder()
                    .url(baseUrl + "/chat/completions")
                    .addHeader("Authorization", "Bearer " + apiKey)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Accept", "text/event-stream")
                    .post(RequestBody.create(jsonBody, JSON_TYPE))
                    .build();

            // 异步执行
            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, java.io.IOException e) {
                    log.error("AI API request failed", e);
                    try {
                        emitter.send(SseEmitter.event().name("error").data("[连接失败] " + e.getMessage()));
                        emitter.complete();
                    } catch (Exception ignored) {
                    }
                }

                @Override
                public void onResponse(Call call, Response response) {
                    try (ResponseBody body = response.body()) {
                        if (!response.isSuccessful() || body == null) {
                            String errorText = body != null ? body.string() : "Unknown error";
                            log.error("AI API returned error: {} - {}", response.code(), errorText);
                            emitter.send(SseEmitter.event().name("error").data("[API 错误] " + response.code()));
                            emitter.complete();
                            return;
                        }

                        BufferedReader reader = new BufferedReader(
                                new InputStreamReader(body.byteStream(), StandardCharsets.UTF_8));
                        String line;
                        StringBuilder fullContent = new StringBuilder();

                        while ((line = reader.readLine()) != null) {
                            if (line.startsWith("data: ")) {
                                String data = line.substring(6).trim();
                                if ("[DONE]".equals(data)) {
                                    // 流结束
                                    emitter.send(SseEmitter.event().name("done").data(""));
                                    emitter.complete();
                                    return;
                                }
                                try {
                                    JsonNode node = objectMapper.readTree(data);
                                    JsonNode choices = node.get("choices");
                                    if (choices != null && choices.isArray() && choices.size() > 0) {
                                        JsonNode delta = choices.get(0).get("delta");
                                        if (delta != null && delta.has("content")) {
                                            String content = delta.get("content").asText();
                                            if (content != null && !content.isEmpty()) {
                                                fullContent.append(content);
                                                emitter.send(SseEmitter.event().name("token").data(content));
                                            }
                                        }
                                    }
                                } catch (Exception parseEx) {
                                    log.warn("Failed to parse SSE chunk: {}", data, parseEx);
                                }
                            }
                        }

                        // 如果流自然结束（没有 [DONE]）
                        emitter.send(SseEmitter.event().name("done").data(""));
                        emitter.complete();
                    } catch (Exception e) {
                        log.error("Error processing AI response stream", e);
                        try {
                            emitter.send(SseEmitter.event().name("error").data("[流读取错误]"));
                            emitter.complete();
                        } catch (Exception ignored) {
                        }
                    }
                }
            });

        } catch (Exception e) {
            log.error("Failed to initiate AI chat stream", e);
            try {
                emitter.send(SseEmitter.event().name("error").data("[内部错误] " + e.getMessage()));
                emitter.complete();
            } catch (Exception ignored) {
            }
        }
    }

    /**
     * 非流式聊天 — 同步获取完整 AI 回复
     *
     * @param chatRequest 聊天请求（stream=false）
     * @return AI 完整回复文本
     */
    public String completeChat(ChatRequest chatRequest) throws Exception {
        String apiKey = resolveApiKey(chatRequest);
        String baseUrl = resolveBaseUrl(chatRequest);
        String model = resolveModel(chatRequest);

        Map<String, Object> requestBody = buildOpenAiRequestBody(chatRequest, model);
        String jsonBody = objectMapper.writeValueAsString(requestBody);
        log.info("Sending non-stream request to AI API, model={}, messages={}, baseUrl={}", model, chatRequest.getMessages().size(), baseUrl);

        OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(120, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();

        Request request = new Request.Builder()
                .url(baseUrl + "/chat/completions")
                .addHeader("Authorization", "Bearer " + apiKey)
                .addHeader("Content-Type", "application/json")
                .post(RequestBody.create(jsonBody, JSON_TYPE))
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                String errorText = response.body() != null ? response.body().string() : "Unknown error";
                throw new RuntimeException("AI API returned " + response.code() + ": " + errorText);
            }

            String responseBody = response.body().string();
            JsonNode node = objectMapper.readTree(responseBody);
            JsonNode choices = node.get("choices");
            if (choices != null && choices.isArray() && choices.size() > 0) {
                JsonNode message = choices.get(0).get("message");
                if (message != null && message.has("content")) {
                    return message.get("content").asText();
                }
            }
            throw new RuntimeException("Unexpected AI API response format");
        }
    }

    /**
     * 构建符合 OpenAI 格式的请求体
     * @param chatRequest 聊天请求
     * @param model 模型名称（已解析）
     */
    private Map<String, Object> buildOpenAiRequestBody(ChatRequest chatRequest, String model) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("stream", chatRequest.isStream());

        List<Map<String, Object>> messages = new ArrayList<>();
        for (ChatRequest.MessageDto msg : chatRequest.getMessages()) {
            Map<String, Object> messageMap = new HashMap<>();
            messageMap.put("role", msg.getRole());

            // 判断是多模态内容还是纯文本
            if (msg.getContentParts() != null && !msg.getContentParts().isEmpty()) {
                // 多模态内容
                List<Map<String, Object>> parts = new ArrayList<>();
                for (ChatRequest.ContentPart part : msg.getContentParts()) {
                    Map<String, Object> partMap = new HashMap<>();
                    partMap.put("type", part.getType());
                    if ("text".equals(part.getType())) {
                        partMap.put("text", part.getText());
                    } else if ("image_url".equals(part.getType())) {
                        Map<String, Object> imageUrlMap = new HashMap<>();
                        String originalUrl = part.getImageUrl().getUrl();
                        // 本地路径（/uploads/xxx.jpg）→ 转 base64 内联格式
                        // 智谱 GLM 不支持 localhost URL，需转为 data:image/{ext};base64,...
                        String resolvedUrl = resolveImageUrl(originalUrl);
                        imageUrlMap.put("url", resolvedUrl);
                        partMap.put("image_url", imageUrlMap);
                    }
                    parts.add(partMap);
                }
                messageMap.put("content", parts);
            } else {
                messageMap.put("content", msg.getContent());
            }

            messages.add(messageMap);
        }

        body.put("messages", messages);
        return body;
    }

    /**
     * 解析图片 URL：本地路径自动转为 base64 内联格式
     * 智谱 GLM API 无法访问 localhost URL，需要将本地图片转为 data URI
     *
     * @param url 原始 URL（可能是 /uploads/xxx.jpg 本地路径，也可能是公网 URL）
     * @return 可供 AI API 使用的 URL（公网 URL 原样返回，本地路径转为 base64）
     */
    private String resolveImageUrl(String url) {
        // 已经是 base64 data URI → 原样返回
        if (url.startsWith("data:")) {
            return url;
        }
        // 公网 URL → 原样返回
        if (url.startsWith("http://") || url.startsWith("https://")) {
            // 但如果是 localhost → 仍然无法被智谱访问，需要转 base64
            if (url.contains("localhost") || url.contains("127.0.0.1") || url.contains("0.0.0.0")) {
                log.warn("Image URL is localhost, cannot be accessed by AI API: {}", url);
                // 尝试从本地文件系统读取
                try {
                    String localPath = extractLocalPath(url);
                    return convertToBase64(localPath);
                } catch (Exception e) {
                    log.error("Failed to convert localhost URL to base64: {}", url, e);
                    return url; // 无法转换时原样返回（AI API 会报错）
                }
            }
            return url;
        }
        // 本地相对路径（如 /uploads/xxx.jpg）→ 转 base64
        try {
            return convertToBase64(url);
        } catch (Exception e) {
            log.error("Failed to convert local path to base64: {}", url, e);
            return url; // 无法转换时原样返回
        }
    }

    /**
     * 从 localhost URL 中提取本地路径部分
     * 如 http://localhost:8080/uploads/abc.jpg → /uploads/abc.jpg
     */
    private String extractLocalPath(String url) {
        // 去掉协议和 host 部分，只保留路径
        int pathStart = url.indexOf("//");
        if (pathStart >= 0) {
            int slashAfterHost = url.indexOf("/", pathStart + 2);
            if (slashAfterHost >= 0) {
                return url.substring(slashAfterHost);
            }
        }
        return url;
    }

    /**
     * 将本地文件路径转为 base64 data URI
     * 如 /uploads/abc.jpg → data:image/jpeg;base64,/9j/4AAQ...
     */
    private String convertToBase64(String relativePath) throws Exception {
        // 提取文件名（去掉前导 /uploads/ 或 / 等前缀）
        String fileName = relativePath;
        if (fileName.startsWith("/uploads/")) {
            fileName = fileName.substring("/uploads/".length());
        } else if (fileName.startsWith("/")) {
            fileName = fileName.substring(1);
        }

        // 拼接为绝对路径
        Path filePath = Paths.get(uploadPath).toAbsolutePath().resolve(fileName);

        if (!Files.exists(filePath)) {
            throw new RuntimeException("Local image file not found: " + filePath);
        }

        // 根据扩展名推断 MIME 类型
        String mimeType = guessMimeType(fileName);

        // 读取文件并转为 base64
        byte[] fileBytes = Files.readAllBytes(filePath);
        String base64 = Base64.getEncoder().encodeToString(fileBytes);

        log.info("Converted local image to base64: {} ({} bytes, mime={})", relativePath, fileBytes.length, mimeType);

        return "data:" + mimeType + ";base64," + base64;
    }

    /**
     * 根据文件扩展名推断 MIME 类型
     */
    private String guessMimeType(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".bmp")) return "image/bmp";
        // 默认 jpeg（覆盖 .jpg / .jpeg / 无扩展名等）
        return "image/jpeg";
    }
}
