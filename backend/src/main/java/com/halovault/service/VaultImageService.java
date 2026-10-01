package com.halovault.service;

import com.halovault.entity.VaultImage;
import com.halovault.repository.VaultImageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * 情绪板图库服务层
 * 封装 THE VAULT 素材数据的 CRUD 操作与事务保障
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VaultImageService {

    private final VaultImageRepository vaultImageRepo;

    /** 获取所有图库素材 */
    public List<VaultImage> getAllImages() {
        return vaultImageRepo.findAll();
    }

    /** 获取单个素材 */
    public Optional<VaultImage> getImageById(Long id) {
        return vaultImageRepo.findById(id);
    }

    /** 创建新图库素材记录 */
    @Transactional
    public VaultImage createImage(String url, String name, Double aspectRatio) {
        VaultImage image = VaultImage.builder()
                .url(url)
                .name(name != null ? name : "")
                .aspectRatio(aspectRatio != null ? aspectRatio : 1.5)
                .build();
        Long id = vaultImageRepo.insert(image);
        image.setId(id);
        log.info("Created vault image id={}, url={}, name={}", id, url, name);
        return image;
    }

    /** 删除图库素材 */
    @Transactional
    public void deleteImage(Long id) {
        vaultImageRepo.deleteById(id);
        log.info("Deleted vault image id={}", id);
    }
}
