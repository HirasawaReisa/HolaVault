package com.halovault.controller;

import com.halovault.dto.ApiResponse;
import com.halovault.entity.Album;
import com.halovault.entity.Artwork;
import com.halovault.service.GalleryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 画廊 API 控制器
 * 提供专辑与画作的 RESTful CRUD 接口
 */
@RestController
@RequestMapping("/api/gallery")
@RequiredArgsConstructor
public class GalleryController {

    private final GalleryService galleryService;

    // ── 专辑接口 ──

    /**
     * 获取所有专辑及其画作（一次性加载）
     */
    @GetMapping("/albums")
    public ApiResponse<List<GalleryService.AlbumDetail>> getAllAlbums() {
        return ApiResponse.success(galleryService.getAllAlbumsWithArtworks());
    }

    /**
     * 获取单个专辑详情（包含画作列表）
     */
    @GetMapping("/albums/{albumId}")
    public ApiResponse<GalleryService.AlbumDetail> getAlbumDetail(@PathVariable Long albumId) {
        try {
            return ApiResponse.success(galleryService.getAlbumDetail(albumId));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(404, e.getMessage());
        }
    }

    /**
     * 创建新专辑
     */
    @PostMapping("/albums")
    public ApiResponse<GalleryService.AlbumDetail> createAlbum(@RequestBody CreateAlbumRequest req) {
        try {
            Album album = Album.builder()
                    .title(req.title())
                    .description(req.description() != null ? req.description() : "")
                    .coverSeed(req.coverSeed() != null ? req.coverSeed() : "")
                    .build();

            List<Artwork> artworks = req.artworks() != null ? req.artworks().stream()
                    .map(a -> Artwork.builder()
                            .title(a.title())
                            .seed(a.seed() != null ? a.seed() : "")
                            .imageUrl(a.imageUrl() != null ? a.imageUrl() : "")
                            .height(a.height() != null ? a.height() : 280)
                            .platform(a.platform() != null ? a.platform() : "")
                            .platformUrl(a.platformUrl() != null ? a.platformUrl() : "")
                            .highlights(a.highlights() != null ? a.highlights() : "")
                            .description(a.description() != null ? a.description() : "")
                            .build())
                    .toList() : List.of();

            return ApiResponse.success(galleryService.createAlbum(album, artworks));
        } catch (Exception e) {
            return ApiResponse.error(500, "创建专辑失败: " + e.getMessage());
        }
    }

    /**
     * 更新专辑信息
     */
    @PutMapping("/albums/{albumId}")
    public ApiResponse<Boolean> updateAlbum(@PathVariable Long albumId, @RequestBody UpdateAlbumRequest req) {
        try {
            Album album = Album.builder()
                    .id(albumId)
                    .title(req.title())
                    .description(req.description())
                    .coverSeed(req.coverSeed())
                    .build();
            return ApiResponse.success(galleryService.updateAlbum(album));
        } catch (Exception e) {
            return ApiResponse.error(500, "更新专辑失败: " + e.getMessage());
        }
    }

    /**
     * 删除专辑（同时删除关联画作）
     */
    @DeleteMapping("/albums/{albumId}")
    public ApiResponse<Boolean> deleteAlbum(@PathVariable Long albumId) {
        try {
            return ApiResponse.success(galleryService.deleteAlbum(albumId));
        } catch (Exception e) {
            return ApiResponse.error(500, "删除专辑失败: " + e.getMessage());
        }
    }

    // ── 画作接口 ──

    /**
     * 获取某专辑下所有画作
     */
    @GetMapping("/albums/{albumId}/artworks")
    public ApiResponse<List<Artwork>> getArtworksByAlbum(@PathVariable Long albumId) {
        return ApiResponse.success(galleryService.getArtworksByAlbum(albumId));
    }

    /**
     * 获取所有画作（跨专辑）
     */
    @GetMapping("/artworks")
    public ApiResponse<List<Artwork>> getAllArtworks() {
        return ApiResponse.success(galleryService.getAllArtworks());
    }

    /**
     * 获取单幅画作详情
     */
    @GetMapping("/artworks/{artworkId}")
    public ApiResponse<Artwork> getArtwork(@PathVariable Long artworkId) {
        try {
            return ApiResponse.success(galleryService.getArtwork(artworkId));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(404, e.getMessage());
        }
    }

    /**
     * 新增画作到指定专辑
     */
    @PostMapping("/albums/{albumId}/artworks")
    public ApiResponse<Artwork> addArtworkToAlbum(@PathVariable Long albumId, @RequestBody CreateArtworkRequest req) {
        try {
            Artwork artwork = Artwork.builder()
                    .title(req.title())
                    .seed(req.seed() != null ? req.seed() : "")
                    .imageUrl(req.imageUrl() != null ? req.imageUrl() : "")
                    .height(req.height() != null ? req.height() : 280)
                    .platform(req.platform() != null ? req.platform() : "")
                    .platformUrl(req.platformUrl() != null ? req.platformUrl() : "")
                    .highlights(req.highlights() != null ? req.highlights() : "")
                    .description(req.description() != null ? req.description() : "")
                    .build();
            return ApiResponse.success(galleryService.addArtworkToAlbum(albumId, artwork));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(404, e.getMessage());
        } catch (Exception e) {
            return ApiResponse.error(500, "添加画作失败: " + e.getMessage());
        }
    }

    /**
     * 更新画作信息
     */
    @PutMapping("/artworks/{artworkId}")
    public ApiResponse<Boolean> updateArtwork(@PathVariable Long artworkId, @RequestBody CreateArtworkRequest req) {
        try {
            Artwork artwork = galleryService.getArtwork(artworkId);
            artwork.setTitle(req.title());
            artwork.setSeed(req.seed());
            artwork.setImageUrl(req.imageUrl());
            artwork.setHeight(req.height());
            artwork.setPlatform(req.platform());
            artwork.setPlatformUrl(req.platformUrl());
            artwork.setHighlights(req.highlights());
            artwork.setDescription(req.description());
            return ApiResponse.success(galleryService.updateArtwork(artwork));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(404, e.getMessage());
        } catch (Exception e) {
            return ApiResponse.error(500, "更新画作失败: " + e.getMessage());
        }
    }

    /**
     * 删除画作
     */
    @DeleteMapping("/artworks/{artworkId}")
    public ApiResponse<Boolean> deleteArtwork(@PathVariable Long artworkId) {
        try {
            return ApiResponse.success(galleryService.deleteArtwork(artworkId));
        } catch (Exception e) {
            return ApiResponse.error(500, "删除画作失败: " + e.getMessage());
        }
    }

    // ── 请求 DTO ──

    public record CreateAlbumRequest(
            String title,
            String description,
            String coverSeed,
            List<CreateArtworkRequest> artworks
    ) {}

    public record UpdateAlbumRequest(
            String title,
            String description,
            String coverSeed
    ) {}

    public record CreateArtworkRequest(
            String title,
            String seed,
            String imageUrl,
            Integer height,
            String platform,
            String platformUrl,
            String highlights,
            String description
    ) {}
}
