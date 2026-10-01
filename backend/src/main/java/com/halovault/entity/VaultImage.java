package com.halovault.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 情绪板图库素材实体
 * 每条记录对应 THE VAULT 侧边栏中的一张素材图片
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VaultImage {

    private Long id;
    private String url;          // 图片 URL（/uploads/xxx.jpg 或外部链接）
    private String name;         // 图片名称/文件名
    private Double aspectRatio;  // 宽高比 (w/h)，用于瀑布流布局
    private String createdAt;
}
