package com.halovault.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 画作实体
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Artwork {
    private Long id;
    private Long albumId;
    private String title;
    private String seed;
    private String imageUrl;
    private Integer height;
    private String platform;
    private String platformUrl;
    private String highlights;
    private String description;
    private Integer sortOrder;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
