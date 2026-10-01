package com.halovault.service;

import com.halovault.entity.Album;
import com.halovault.entity.Artwork;
import com.halovault.repository.AlbumRepository;
import com.halovault.repository.ArtworkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 画廊业务服务层
 * 封装专辑与画作的组合操作，提供事务保障
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GalleryService {

    private final AlbumRepository albumRepo;
    private final ArtworkRepository artworkRepo;

    // ── 专辑操作 ──

    /**
     * 获取所有专辑（附带画作列表）
     */
    public List<Album> getAllAlbums() {
        return albumRepo.findAll();
    }

    /**
     * 获取单个专辑详情（附带画作列表）
     */
    public AlbumDetail getAlbumDetail(Long albumId) {
        Album album = albumRepo.findById(albumId)
                .orElseThrow(() -> new IllegalArgumentException("专辑不存在: id=" + albumId));
        List<Artwork> artworks = artworkRepo.findByAlbumId(albumId);
        return new AlbumDetail(album, artworks);
    }

    /**
     * 创建新专辑（可同时添加画作）
     */
    @Transactional
    public AlbumDetail createAlbum(Album album, List<Artwork> artworks) {
        log.info("Creating album: {}", album.getTitle());
        Album savedAlbum = albumRepo.insert(album);

        List<Artwork> savedArtworks;
        if (artworks != null && !artworks.isEmpty()) {
            // 设置画作关联的专辑 ID 和排序
            for (int i = 0; i < artworks.size(); i++) {
                artworks.get(i).setAlbumId(savedAlbum.getId());
                artworks.get(i).setSortOrder(i);
            }
            savedArtworks = artworkRepo.batchInsert(artworks);
        } else {
            savedArtworks = List.of();
        }

        log.info("Album created: id={}, title={}, artworkCount={}",
                savedAlbum.getId(), savedAlbum.getTitle(), savedArtworks.size());
        return new AlbumDetail(savedAlbum, savedArtworks);
    }

    /**
     * 更新专辑信息
     */
    public boolean updateAlbum(Album album) {
        return albumRepo.update(album);
    }

    /**
     * 删除专辑（事务保障：同时删除关联画作）
     */
    @Transactional
    public boolean deleteAlbum(Long albumId) {
        log.info("Deleting album: id={}", albumId);
        // 先删除关联画作（虽然数据库有 CASCADE，但显式删除更明确）
        artworkRepo.deleteByAlbumId(albumId);
        return albumRepo.deleteById(albumId);
    }

    // ── 画作操作 ──

    /**
     * 获取某专辑下所有画作
     */
    public List<Artwork> getArtworksByAlbum(Long albumId) {
        return artworkRepo.findByAlbumId(albumId);
    }

    /**
     * 获取所有画作（跨专辑）
     */
    public List<Artwork> getAllArtworks() {
        return artworkRepo.findAll();
    }

    /**
     * 获取单幅画作详情
     */
    public Artwork getArtwork(Long artworkId) {
        return artworkRepo.findById(artworkId)
                .orElseThrow(() -> new IllegalArgumentException("画作不存在: id=" + artworkId));
    }

    /**
     * 新增画作到指定专辑
     */
    @Transactional
    public Artwork addArtworkToAlbum(Long albumId, Artwork artwork) {
        // 校验专辑存在
        albumRepo.findById(albumId)
                .orElseThrow(() -> new IllegalArgumentException("专辑不存在: id=" + albumId));

        artwork.setAlbumId(albumId);
        // 自动计算排序值（当前最大值 + 1）
        int maxOrder = getArtworksByAlbum(albumId).stream()
                .mapToInt(a -> a.getSortOrder() != null ? a.getSortOrder() : 0)
                .max().orElse(-1);
        artwork.setSortOrder(maxOrder + 1);

        return artworkRepo.insert(artwork);
    }

    /**
     * 更新画作信息
     */
    public boolean updateArtwork(Artwork artwork) {
        return artworkRepo.update(artwork);
    }

    /**
     * 删除画作
     */
    public boolean deleteArtwork(Long artworkId) {
        return artworkRepo.deleteById(artworkId);
    }

    // ── 批量查询 ──

    /**
     * 获取所有专辑及其画作（用于前端画廊页面一次性加载）
     */
    public List<AlbumDetail> getAllAlbumsWithArtworks() {
        List<Album> albums = albumRepo.findAll();
        List<Artwork> allArtworks = artworkRepo.findAll();

        // 按 album_id 分组
        Map<Long, List<Artwork>> artworksByAlbum = allArtworks.stream()
                .collect(Collectors.groupingBy(Artwork::getAlbumId));

        return albums.stream()
                .map(album -> new AlbumDetail(album,
                        artworksByAlbum.getOrDefault(album.getId(), List.of())))
                .toList();
    }

    // ── 内部 DTO ──

    /**
     * 专辑详情（包含画作列表）
     */
    public record AlbumDetail(Album album, List<Artwork> artworks) {}
}
