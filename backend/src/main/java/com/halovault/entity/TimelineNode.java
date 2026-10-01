package com.halovault.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 创作成长编年史节点实体
 * 每条记录对应时间轴上的一个专辑节点
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimelineNode {

    private Long id;
    private String title;        // 节点标题（如 "VOL.1 霓虹初探"）
    private String period;       // 时间区间描述（如 "DAY 1 - DAY 30"）
    private String coverUrl;     // 封面图 URL（来自画廊画作）
    private String analysis;     // AI 分析文本
    private Long albumId;        // 关联的画廊专辑 ID（可选）
    private Integer sortOrder;   // 排序序号
    private String createdAt;
}
