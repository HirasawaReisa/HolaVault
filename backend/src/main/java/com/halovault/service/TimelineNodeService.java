package com.halovault.service;

import com.halovault.entity.TimelineNode;
import com.halovault.repository.TimelineNodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * 创作成长编年史服务层
 * 封装时间轴节点数据的 CRUD 操作与事务保障
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TimelineNodeService {

    private final TimelineNodeRepository timelineNodeRepo;

    /** 获取所有时间轴节点（按排序顺序） */
    public List<TimelineNode> getAllNodes() {
        return timelineNodeRepo.findAll();
    }

    /** 获取单个节点 */
    public Optional<TimelineNode> getNodeById(Long id) {
        return timelineNodeRepo.findById(id);
    }

    /** 创建新的时间轴节点 */
    @Transactional
    public TimelineNode createNode(String title, String period, String coverUrl,
                                   String analysis, Long albumId) {
        int nextOrder = timelineNodeRepo.getMaxSortOrder() + 1;
        TimelineNode node = TimelineNode.builder()
                .title(title)
                .period(period != null ? period : "")
                .coverUrl(coverUrl != null ? coverUrl : "")
                .analysis(analysis != null ? analysis : "")
                .albumId(albumId)
                .sortOrder(nextOrder)
                .build();
        Long id = timelineNodeRepo.insert(node);
        node.setId(id);
        log.info("Created timeline node id={}, title={}, albumId={}", id, title, albumId);
        return node;
    }

    /** 删除时间轴节点 */
    @Transactional
    public void deleteNode(Long id) {
        timelineNodeRepo.deleteById(id);
        log.info("Deleted timeline node id={}", id);
    }
}
