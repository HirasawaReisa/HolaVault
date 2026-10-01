package com.halovault.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 画册专辑实体
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Album {
    private Long id;
    private String title;
    private String description;
    private String coverSeed;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
