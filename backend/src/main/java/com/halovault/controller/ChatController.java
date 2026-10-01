package com.halovault.controller;

import com.halovault.dto.ApiResponse;
import com.halovault.dto.ChatRequest;
import com.halovault.service.AiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * AI 聊天控制器
 * 处理与 AI 大模型的交互请求（SSE 流式返回 / 非流式 JSON 返回）
 */
@Slf4j
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final AiService aiService;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    /**
     * 流式聊天接口
     * 前端通过 EventSource 接收 SSE 事件
     * 事件类型：token（文本片段）、done（结束）、error（错误）
     */
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChat(@RequestBody ChatRequest chatRequest) {
        // 强制流式
        chatRequest.setStream(true);
        SseEmitter emitter = new SseEmitter(180_000L); // 3 分钟超时

        emitter.onCompletion(() -> log.debug("SSE connection completed"));
        emitter.onTimeout(() -> {
            log.warn("SSE connection timed out");
            emitter.complete();
        });
        emitter.onError(e -> log.warn("SSE connection error", e));

        executor.submit(() -> aiService.streamChat(chatRequest, emitter));

        return emitter;
    }

    /**
     * 非流式聊天接口
     * 前端直接获取完整 JSON 响应（用于规则模式等需要完整结果的场景）
     */
    @PostMapping(value = "/complete", produces = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<String> completeChat(@RequestBody ChatRequest chatRequest) {
        // 强制非流式
        chatRequest.setStream(false);
        try {
            String content = aiService.completeChat(chatRequest);
            return ApiResponse.success(content);
        } catch (Exception e) {
            log.error("Complete chat failed", e);
            return ApiResponse.error(500, "AI 请求失败: " + e.getMessage());
        }
    }
}
