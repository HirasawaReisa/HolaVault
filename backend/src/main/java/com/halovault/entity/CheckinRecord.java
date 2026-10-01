package com.halovault.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 百日绘打卡记录实体
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckinRecord {
    private Long id;
    private Integer day;
    private String imageUrl;
    private String note;
    private Integer streak;
    private LocalDateTime createdAt;
}
