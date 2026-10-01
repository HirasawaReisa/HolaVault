package com.halovault.service;

import com.halovault.entity.CritiqueArtwork;
import com.halovault.repository.CritiqueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * AI 点评画作服务层
 * 封装点评数据的 CRUD 操作与事务保障
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CritiqueService {

    private final CritiqueRepository critiqueRepo;

    /** 获取所有点评画作（含分析结果） */
    public List<CritiqueArtwork> getAllArtworks() {
        return critiqueRepo.findAll();
    }

    /** 获取单个点评画作 */
    public Optional<CritiqueArtwork> getArtworkById(Long id) {
        return critiqueRepo.findById(id);
    }

    /** 创建新的点评画作记录 */
    @Transactional
    public CritiqueArtwork createArtwork(String imageUrl, String title) {
        CritiqueArtwork artwork = CritiqueArtwork.builder()
                .imageUrl(imageUrl)
                .title(title != null ? title : "")
                .rulesResult("")
                .customMessages("")
                .build();
        Long id = critiqueRepo.insert(artwork);
        artwork.setId(id);
        log.info("Created critique artwork id={}, imageUrl={}, title={}", id, imageUrl, title);
        return artwork;
    }

    /** 保存规则模式分析结果 */
    @Transactional
    public void saveRulesResult(Long id, String rulesResultJson) {
        critiqueRepo.updateRulesResult(id, rulesResultJson);
        log.info("Saved rules result for critique artwork id={}", id);
    }

    /** 保存自定义对话历史 */
    @Transactional
    public void saveCustomMessages(Long id, String customMessagesJson) {
        critiqueRepo.updateCustomMessages(id, customMessagesJson);
        log.info("Saved custom messages for critique artwork id={}", id);
    }

    /** 删除点评画作 */
    @Transactional
    public void deleteArtwork(Long id) {
        critiqueRepo.deleteById(id);
        log.info("Deleted critique artwork id={}", id);
    }
}
