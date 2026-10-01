import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '../components/layout';
import { slideUp, staggerContainer, springGentle } from '../lib/motion';
import {
  galleryApi,
  type AlbumDetail,
  type Album as ApiAlbum,
  type Artwork as ApiArtwork,
} from '../lib/api';

/**
 * 画廊页面 (/gallery)
 * 专辑概念：3D 堆叠卡片 → 展开瀑布流
 * 画作卡片：原位展开 FLIP 动画
 * 删除模式：悬停标题出现 - 号，点击进入删除模式，再点目标即删除
 * 编辑模式：悬停专辑标题左侧弹出铅笔图标，点击可编辑标题与描述
 * 数据来源：后端 SQLite API（无 Mock 降级）
 */

// ======== 本地视图数据结构（合并 API 返回的 Album + Artworks） ========

interface Artwork {
  id: number;
  title: string;
  seed: string;
  imageUrl: string;
  height: number;
  platform: string;
  platformUrl: string;
  highlights: string;
  description: string;
}

interface Album {
  id: number;
  title: string;
  description: string;
  coverSeed: string;
  artworks: Artwork[];
}

/** 将 API AlbumDetail 转换为本地 Album 结构 */
function toLocalAlbum(detail: AlbumDetail): Album {
  return {
    id: detail.album.id,
    title: detail.album.title,
    description: detail.album.description,
    coverSeed: detail.album.coverSeed,
    artworks: detail.artworks.map(toLocalArtwork),
  };
}

function toLocalArtwork(art: ApiArtwork): Artwork {
  return {
    id: art.id,
    title: art.title,
    seed: art.seed,
    imageUrl: art.imageUrl,
    height: art.height,
    platform: art.platform,
    platformUrl: art.platformUrl,
    highlights: art.highlights,
    description: art.description,
  };
}

/** 构建画作图片 URL（优先使用 imageUrl，否则用 seed 构建 picsum URL） */
function getArtworkImageSrc(art: Artwork, width: number, height: number): string {
  if (art.imageUrl && art.imageUrl.startsWith('/uploads/')) {
    return art.imageUrl;
  }
  if (art.imageUrl && art.imageUrl.startsWith('http')) {
    return art.imageUrl;
  }
  return `https://picsum.photos/seed/${art.seed}/${width}/${height}`;
}

// 图片上传到后端，返回上传后的 URL
async function uploadImageFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload/image', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }

  const json = await res.json();
  if (json.code !== 200) {
    throw new Error(json.message || 'Upload error');
  }
  return json.data as string;
}

// ======== FLIP 动画通用过渡 ========

const layoutTransition = {
  type: 'spring' as const,
  stiffness: 250,
  damping: 30,
};

// ======== 悬停弹出操作按钮组件 ========

/** 弹簧弹出按钮的通用动画参数（右侧弹出） */
const popButtonTransition = {
  width: { type: 'spring', stiffness: 400, damping: 28 },
  opacity: { duration: 0.12 },
  marginLeft: { type: 'spring', stiffness: 400, damping: 28 },
};

/** 减号 SVG 图标 */
function MinusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/** 加号 SVG 图标 */
function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/** 铅笔 SVG 图标（无边框样式专用） */
function PencilIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 16.5 3 18l1.5-4.5L17 3z" />
      <line x1="15" y1="5" x2="19" y2="9" />
    </svg>
  );
}

/** 右侧弹出按钮（带边框） */
function PopButton({
  icon,
  onClick,
  accentColor,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  accentColor?: string;
}) {
  return (
    <motion.button
      initial={{ width: 0, opacity: 0, marginLeft: 0 }}
      animate={{ width: 32, opacity: 1, marginLeft: 12 }}
      exit={{ width: 0, opacity: 0, marginLeft: 0 }}
      transition={popButtonTransition}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 focus-ring"
      style={{
        height: 32,
        border: '1px solid var(--border-primary)',
        color: accentColor || 'var(--text-secondary)',
        backgroundColor: 'transparent',
      }}
      whileHover={{
        scale: 1.06,
        borderColor: accentColor || 'var(--ai-accent)',
        color: accentColor || 'var(--ai-accent)',
      }}
      whileTap={{ scale: 0.95 }}
    >
      {icon}
    </motion.button>
  );
}

/** 左侧弹出铅笔按钮（无边框，极简风格） */
function PencilPopButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ width: 0, opacity: 0, marginRight: 0 }}
      animate={{ width: 28, opacity: 0.5, marginRight: 8 }}
      exit={{ width: 0, opacity: 0, marginRight: 0 }}
      transition={{
        width: { type: 'spring', stiffness: 400, damping: 28 },
        opacity: { duration: 0.15 },
        marginRight: { type: 'spring', stiffness: 400, damping: 28 },
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{
        height: 28,
        border: 'none',
        color: 'var(--text-tertiary)',
        backgroundColor: 'transparent',
      }}
      whileHover={{
        opacity: 1,
        scale: 1.08,
        color: 'var(--text-primary)',
      }}
      whileTap={{ scale: 0.92 }}
    >
      <PencilIcon size={15} />
    </motion.button>
  );
}

// ======== 3D 堆叠卡片 ========

interface StackDeckProps {
  album: Album;
  onOpen: (id: number) => void;
  deleteMode?: boolean;
  onDelete?: (id: number) => void;
}

const StackDeck = memo(function StackDeck({ album, onOpen, deleteMode = false, onDelete }: StackDeckProps) {
  const [isHovered, setIsHovered] = useState(false);
  const stackImages = album.artworks.slice(0, 3);

  const stackLayers = [
    { rotate: -6, x: -12, y: 4, blur: 1.5, brightness: 0.8, opacity: 0.5 },
    { rotate: 4, x: 8, y: -2, blur: 0.8, brightness: 0.9, opacity: 0.7 },
    { rotate: 0, x: 0, y: 0, blur: 0, brightness: 1, opacity: 1 },
  ];

  const fanOffsets = [
    { rotate: -14, x: -36, y: 6 },
    { rotate: 14, x: 36, y: 6 },
    { rotate: 0, x: 0, y: -4 },
  ];

  const handleClick = () => {
    if (deleteMode && onDelete) {
      onDelete(album.id);
    } else {
      onOpen(album.id);
    }
  };

  return (
    <motion.div
      className={`relative select-none cursor-pointer`}
      style={{ width: '100%', aspectRatio: '3/4' }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={handleClick}
      whileTap={{ scale: deleteMode ? 0.95 : 0.97 }}
    >
      {/* 删除模式下：红色边框 + 顶部删除角标 */}
      {deleteMode && (
        <motion.div
          className="absolute inset-0 rounded-xl z-20 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            border: '2px solid #EF4444',
            boxShadow: '0 0 0 4px rgba(239,68,68,0.15)',
          }}
        />
      )}

      {deleteMode && (
        <motion.div
          className="absolute top-3 right-3 z-30"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#EF4444' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </motion.div>
      )}

      {/* 空专辑时显示占位图 */}
      {stackImages.length === 0 ? (
        <div
          className="absolute inset-0 rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className="flex flex-col items-center gap-2">
            <PlusIcon size={32} />
            <span className="font-light text-xs" style={{ color: 'var(--text-tertiary)' }}>
              添加画作
            </span>
          </div>
        </div>
      ) : (
        stackImages.map((art, i) => {
          const layer = stackLayers[i];
          const fan = fanOffsets[i];
          return (
            <motion.div
              key={art.id}
              className="absolute rounded-xl overflow-hidden"
              style={{
                willChange: 'transform, filter',
                inset: 0,
                boxShadow:
                  i === 2
                    ? '0 10px 30px rgba(0,0,0,0.12)'
                    : '0 4px 12px rgba(0,0,0,0.08)',
              }}
              animate={{
                rotate: isHovered ? fan.rotate : layer.rotate,
                x: isHovered ? fan.x : layer.x,
                y: isHovered ? fan.y : layer.y,
                filter: isHovered
                  ? 'blur(0px) brightness(1)'
                  : `blur(${layer.blur}px) brightness(${layer.brightness})`,
                opacity: isHovered ? 1 : layer.opacity,
                scale: isHovered ? (i === 2 ? 1.02 : 0.96) : 1,
              }}
              transition={{
                type: 'spring',
                stiffness: 220,
                damping: 22,
                mass: 0.7,
              }}
            >
              <img
                src={getArtworkImageSrc(art, 400, 520)}
                alt={art.title}
                loading="lazy"
                className="w-full h-full object-cover"
                style={{
                  filter: deleteMode
                    ? 'saturate(0.3) brightness(0.7)'
                    : 'saturate(0.3)',
                  transition: 'filter 0.4s ease',
                }}
              />
            </motion.div>
          );
        })
      )}

      <div className="absolute inset-0 flex flex-col justify-end p-5 z-10 pointer-events-none">
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            background:
              stackImages.length > 0
                ? 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)'
                : 'transparent',
          }}
        />
        <div className="relative z-10">
          <h3 className="font-heading font-black text-white text-lg leading-tight mb-1">
            {album.title}
          </h3>
          {album.description && (
            <p
              className="font-light text-xs leading-relaxed"
              style={{
                color: 'rgba(255,255,255,0.7)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {album.description}
            </p>
          )}
          <span
            className="inline-block mt-2 text-xs font-light"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            {album.artworks.length} 幅作品
          </span>
        </div>
      </div>
    </motion.div>
  );
});

// ======== 单张画作卡片（聚光灯 + 原位展开 + 删除模式） ========

interface ArtworkCardExpandableProps {
  artwork: Artwork;
  isExpanded: boolean;
  isHovered: boolean;
  isAnyHovered: boolean;
  onExpand: (id: number | null) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  deleteMode?: boolean;
  onDelete?: (id: number) => void;
}

const ArtworkCardExpandable = memo(function ArtworkCardExpandable({
  artwork,
  isExpanded,
  isHovered,
  isAnyHovered,
  onExpand,
  onHoverStart,
  onHoverEnd,
  deleteMode = false,
  onDelete,
}: ArtworkCardExpandableProps) {
  const isDimmed = isAnyHovered && !isHovered && !isExpanded;

  const handleClick = () => {
    if (deleteMode && onDelete) {
      onDelete(artwork.id);
    } else {
      onExpand(isExpanded ? null : artwork.id);
    }
  };

  return (
    <motion.div
      layout
      transition={layoutTransition}
      className={`relative overflow-hidden rounded-xl cursor-pointer ${
        isExpanded && !deleteMode
          ? 'col-span-2 row-span-2'
          : 'col-span-1'
      }`}
      style={{
        filter: isDimmed
          ? 'blur(2px) brightness(0.6)'
          : 'none',
        transition: 'filter 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        willChange: isDimmed ? 'filter' : 'auto',
      }}
      onClick={handleClick}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
    >
      {/* 删除模式下的红色边框 + 角标 */}
      {deleteMode && (
        <motion.div
          className="absolute inset-0 rounded-xl z-20 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            border: '2px solid #EF4444',
            boxShadow: '0 0 0 4px rgba(239,68,68,0.15)',
          }}
        />
      )}

      {deleteMode && (
        <motion.div
          className="absolute top-2 right-2 z-30"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#EF4444' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </motion.div>
      )}

      {isExpanded && !deleteMode ? (
        /* ====== 展开状态：左右分栏 ====== */
        <motion.div
          layout
          transition={layoutTransition}
          className="flex gap-5 p-4 rounded-xl"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            height: '100%',
            minHeight: 320,
          }}
        >
          {/* 左侧：图片 */}
          <motion.div
            layout
            transition={layoutTransition}
            className="flex-1 min-w-0 overflow-hidden rounded-lg"
            style={{ maxHeight: '100%' }}
          >
            <img
              src={getArtworkImageSrc(artwork, 600, artwork.height)}
              alt={artwork.title}
              loading="lazy"
              className="w-full h-full object-cover rounded-lg"
              style={{ filter: 'saturate(1)' }}
            />
          </motion.div>

          {/* 右侧：详情（延迟淡入） */}
          <motion.div
            layout
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 min-w-0 flex flex-col justify-between py-2 pr-1"
          >
            <div>
              {/* 标题 */}
              <h3
                className="font-heading font-black mb-2"
                style={{
                  fontSize: '1.25rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.2,
                }}
              >
                {artwork.title}
              </h3>

              {/* 平台链接 */}
              {artwork.platform && (
                <a
                  href={artwork.platformUrl}
                  className="inline-flex items-center gap-1.5 text-xs font-light mb-4 focus-ring"
                  style={{ color: 'var(--text-tertiary)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  {artwork.platform}
                </a>
              )}

              {/* 闪光点 */}
              {artwork.highlights && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="ai-pulse"
                      style={{ width: 6, height: 6, minWidth: 6 }}
                    />
                    <span
                      className="text-xs font-medium"
                      style={{ color: 'var(--ai-accent)' }}
                    >
                      AI 闪光点
                    </span>
                  </div>
                  <p
                    className="text-sm font-light leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {artwork.highlights}
                  </p>
                </div>
              )}
            </div>

            {/* AI 点评按钮 */}
            <motion.button
              className="ai-glow-border w-full py-2.5 px-4 rounded-lg font-heading font-medium text-sm flex items-center justify-center gap-2 focus-ring"
              style={{
                color: 'var(--ai-accent)',
                backgroundColor: 'transparent',
              }}
              whileHover={{
                backgroundColor: 'rgba(37, 99, 235, 0.06)',
                scale: 1.02,
              }}
              whileTap={{ scale: 0.97 }}
              onClick={(e) => {
                e.stopPropagation();
                // TODO: 接入 AI 点评功能
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                <line x1="9" y1="21" x2="15" y2="21" />
              </svg>
              AI 点评
            </motion.button>
          </motion.div>
        </motion.div>
      ) : (
        /* ====== 收起状态 / 删除模式：常规卡片 ====== */
        <>
          <motion.div
            layout
            transition={layoutTransition}
            className="relative overflow-hidden"
            animate={{ scale: isHovered && !deleteMode ? 1.03 : 1 }}
            whileHover={deleteMode ? { boxShadow: '0 8px 24px rgba(239,68,68,0.2)' } : { boxShadow: '0 16px 32px rgba(0,0,0,0.12)' }}
          >
            <img
              src={getArtworkImageSrc(artwork, 600, artwork.height)}
              alt={artwork.title}
              loading="lazy"
              className="w-full block"
              style={{
                height: artwork.height,
                objectFit: 'cover',
                filter: deleteMode
                  ? 'saturate(0.2) brightness(0.7)'
                  : isHovered ? 'saturate(1)' : 'saturate(0.3)',
                transition: 'filter 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />

            {/* 底部渐变遮罩 */}
            <div
              className="absolute inset-x-0 bottom-0 pointer-events-none"
              style={{
                height: '50%',
                background: isHovered
                  ? 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)'
                  : 'linear-gradient(to top, rgba(0,0,0,0) 0%, transparent 100%)',
                transition: 'background 0.4s ease',
              }}
            />

            {/* 画作信息 - 悬停时淡入上浮 */}
            <AnimatePresence>
              {isHovered && !deleteMode && (
                <motion.div
                  className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-8"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{
                    opacity: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
                    y: { type: 'spring', stiffness: 300, damping: 25 },
                  }}
                >
                  <h3 className="text-white font-heading font-bold text-sm leading-snug mb-1">
                    {artwork.title}
                  </h3>
                  {artwork.platform && (
                    <a
                      href={artwork.platformUrl}
                      className="inline-flex items-center gap-1 text-xs font-light"
                      style={{ color: 'rgba(255,255,255,0.7)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      {artwork.platform}
                    </a>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 展开提示角标（仅在非删除模式） */}
            {!deleteMode && (
              <motion.div
                className="absolute top-3 right-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered ? 0.6 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </div>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
});

// ======== 专辑标题组件：悬停弹出铅笔(左) + 加号/减号(右) + inline 编辑模式 ========

function TitleWithActions({
  title,
  subtitle,
  onAdd,
  onDelete,
  deleteMode,
  onSaveEdit,
}: {
  title: string;
  subtitle?: string;
  onAdd: () => void;
  onDelete: () => void;
  deleteMode: boolean;
  onSaveEdit: (newTitle: string, newDescription: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editDesc, setEditDesc] = useState(subtitle || '');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const enterEditMode = () => {
    setEditTitle(title);
    setEditDesc(subtitle || '');
    setIsEditing(true);
    setIsHovered(false);
    // 聚焦输入框
    setTimeout(() => titleInputRef.current?.focus(), 50);
  };

  const saveEdit = () => {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return; // 标题不允许为空
    onSaveEdit(trimmedTitle, editDesc.trim());
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  // 编辑模式：inline 输入框
  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <input
            ref={titleInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            className="font-heading font-black bg-transparent border-b-2 border-black outline-none pb-1"
            style={{
              fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
              color: 'var(--text-primary)',
              minWidth: 120,
            }}
            placeholder="Album title"
          />
          {/* 保存按钮 */}
          <motion.button
            onClick={saveEdit}
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
            whileHover={{ scale: 1.1, color: 'var(--ai-accent)' }}
            whileTap={{ scale: 0.9 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </motion.button>
          {/* 取消按钮 */}
          <motion.button
            onClick={cancelEdit}
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              border: '1px solid var(--border-primary)',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            whileHover={{ scale: 1.1, borderColor: '#EF4444', color: '#EF4444' }}
            whileTap={{ scale: 0.9 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </motion.button>
        </div>
        <textarea
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancelEdit();
          }}
          className="font-light bg-transparent border-b border-gray-300 outline-none pb-1 resize-none"
          style={{
            color: 'var(--text-tertiary)',
            maxWidth: '480px',
            width: '100%',
            fontSize: '0.875rem',
            lineHeight: 1.5,
            rows: 2,
          }}
          placeholder="Album description..."
        />
      </motion.div>
    );
  }

  // 展示模式：标题 + 悬停弹出按钮
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h2
          className="relative inline-flex items-center cursor-default select-none"
          style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', color: deleteMode ? '#EF4444' : 'var(--text-primary)' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* 铅笔图标：左侧弹出 */}
          <AnimatePresence>
            {isHovered && !deleteMode && (
              <PencilPopButton onClick={enterEditMode} />
            )}
          </AnimatePresence>

          {title}

          {/* + 号和 - 号：右侧弹出 */}
          <AnimatePresence>
            {isHovered && (
              <>
                <PopButton
                  icon={<PlusIcon />}
                  onClick={onAdd}
                />
                <PopButton
                  icon={<MinusIcon />}
                  onClick={onDelete}
                  accentColor={deleteMode ? '#EF4444' : 'var(--text-secondary)'}
                />
              </>
            )}
          </AnimatePresence>
        </h2>
      </div>
      {subtitle && (
        <p className="font-light" style={{ color: 'var(--text-tertiary)', maxWidth: '480px' }}>
          {subtitle}
        </p>
      )}
      {deleteMode && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-xs font-light"
          style={{ color: '#EF4444' }}
        >
          点击画作将其从数据库移除 — 再次点击 - 号退出删除模式
        </motion.p>
      )}
    </div>
  );
}

// ======== 上传画作的弹窗 ========

function ArtworkUploadModal({
  albumId,
  onClose,
  onAdded,
}: {
  albumId: number;
  onClose: () => void;
  onAdded: (art: ApiArtwork) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState('');
  const [platformUrl, setPlatformUrl] = useState('');
  const [height, setHeight] = useState<number>(280);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFilePick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0] ?? null;
      if (f) {
        setFile(f);
        setPreview(URL.createObjectURL(f));
      }
    };
    input.click();
  };

  const handleSubmit = async () => {
    try {
      setErrorMsg(null);
      setIsSaving(true);
      let imageUrl = '';
      let seed = `seed-${Date.now()}`;
      if (file) {
        imageUrl = await uploadImageFile(file);
      }

      const payload: Partial<ApiArtwork> = {
        title: title || `Untitled ${Date.now()}`,
        description,
        imageUrl,
        height,
        platform,
        platformUrl,
        seed,
      };

      console.log('[Gallery] Adding artwork to album:', albumId, payload);
      const created = await galleryApi.addArtworkToAlbum(albumId, payload);
      console.log('[Gallery] Artwork created:', created.id, 'albumId:', created.albumId);
      await onAdded(created);
      onClose();
    } catch (e) {
      console.error('[Gallery] Failed to add artwork:', e);
      setErrorMsg(e instanceof Error ? e.message : '添加画作失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 9990 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(249,249,249,0.65)' }}
          onClick={onClose}
        />

        <motion.div
          className="relative w-[380px] p-8"
          style={{ backgroundColor: '#FFFFFF' }}
          initial={{ opacity: 0, scale: 0.98, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 16 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <h2 className="font-heading font-black tracking-[0.2em] text-[12px] text-black mb-6">ADD ARTWORK</h2>

          <div className="space-y-4">
            <div>
              <label className="font-light tracking-[0.15em] text-[10px] text-gray-500 mb-2 block">TITLE</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Artwork title"
                className="w-full bg-transparent border-b border-gray-300 pb-2 font-light text-sm text-black outline-none focus:border-black transition-colors duration-200 placeholder:text-gray-300"
              />
            </div>

            <div>
              <label className="font-light tracking-[0.15em] text-[10px] text-gray-500 mb-2 block">DESCRIPTION</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
                rows={2}
                className="w-full bg-transparent border-b border-gray-300 pb-2 font-light text-sm text-black outline-none focus:border-black transition-colors duration-200 placeholder:text-gray-300 resize-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-28 h-20 bg-gray-100 rounded overflow-hidden flex items-center justify-center border border-gray-200">
                {preview ? (
                  <img src={preview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-400">No image</span>
                )}
              </div>

              <div className="flex-1">
                <label className="font-light tracking-[0.15em] text-[10px] text-gray-500 mb-2 block">IMAGE</label>
                <div className="flex items-center gap-2">
                  <button onClick={handleFilePick} className="px-3 py-2 border rounded text-sm">Choose file</button>
                  <span className="text-sm text-gray-600">{file ? file.name : '未选择图片'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-light tracking-[0.15em] text-[10px] text-gray-500 mb-2 block">PLATFORM</label>
                <input type="text" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="e.g. Pixiv" className="w-full bg-transparent border-b border-gray-300 pb-2 font-light text-sm outline-none focus:border-black" />
              </div>
              <div>
                <label className="font-light tracking-[0.15em] text-[10px] text-gray-500 mb-2 block">HEIGHT</label>
                <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full bg-transparent border-b border-gray-300 pb-2 font-light text-sm outline-none focus:border-black" />
              </div>
            </div>
          </div>

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 py-2 px-3 rounded text-xs font-light"
              style={{
                color: '#EF4444',
                backgroundColor: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              {errorMsg}
            </motion.div>
          )}

          <motion.button
            onClick={handleSubmit}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            disabled={!title.trim() && !file}
            className="mt-6 w-full py-2.5 font-heading tracking-[0.25em] text-[11px] text-black border border-black bg-transparent cursor-pointer transition-colors duration-200 hover:bg-black hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isSaving ? 'SAVING...' : 'SAVE'}
          </motion.button>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center cursor-pointer opacity-30 hover:opacity-60 transition-opacity"
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#000" strokeWidth="1.5">
              <line x1="1" y1="1" x2="11" y2="11" />
              <line x1="11" y1="1" x2="1" y2="11" />
            </svg>
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ======== 展开的专辑（Grid + FLIP） ========

interface ExpandedAlbumProps {
  album: Album;
  onBack: () => void;
  onOpenAddArtwork: (albumId: number) => void;
  deleteMode: boolean;
  onToggleDeleteMode: () => void;
  onDeleteArtwork: (artworkId: number) => void;
  onSaveEdit: (albumId: number, newTitle: string, newDescription: string) => void;
}

function ExpandedAlbum({ album, onBack, onOpenAddArtwork, deleteMode, onToggleDeleteMode, onDeleteArtwork, onSaveEdit }: ExpandedAlbumProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [expandedArtworkId, setExpandedArtworkId] = useState<number | null>(null);
  const isAnyHovered = hoveredId !== null;

  const handleExpand = (id: number | null) => {
    if (deleteMode) return;
    setExpandedArtworkId(id);
    if (id !== null) setHoveredId(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Back 按钮 */}
      <motion.button
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={springGentle}
        onClick={onBack}
        className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full font-heading font-medium text-sm focus-ring"
        style={{
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-primary)',
          backgroundColor: 'transparent',
        }}
        whileHover={{
          scale: 1.03,
          backgroundColor: 'rgba(128,128,128,0.06)',
        }}
        whileTap={{ scale: 0.97 }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Albums
      </motion.button>

      {/* 专辑标题 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, ...springGentle }}
        className="mb-10"
      >
        <TitleWithActions
          title={album.title}
          subtitle={album.description}
          onAdd={() => onOpenAddArtwork(album.id)}
          onDelete={onToggleDeleteMode}
          deleteMode={deleteMode}
          onSaveEdit={(newTitle, newDesc) => onSaveEdit(album.id, newTitle, newDesc)}
        />
      </motion.div>

      {/* CSS Grid 瀑布流 */}
      <style>{`
        .gallery-grid-flip {
          display: grid;
          gap: 16px;
          grid-auto-rows: minmax(120px, auto);
          grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 640px) {
          .gallery-grid-flip { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 1024px) {
          .gallery-grid-flip { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>

      <motion.div
        layout
        transition={layoutTransition}
        className="gallery-grid-flip max-w-7xl"
      >
        {album.artworks.map((artwork) => (
          <ArtworkCardExpandable
            key={artwork.id}
            artwork={artwork}
            isExpanded={expandedArtworkId === artwork.id}
            isHovered={hoveredId === artwork.id}
            isAnyHovered={isAnyHovered}
            onExpand={handleExpand}
            onHoverStart={() => setHoveredId(artwork.id)}
            onHoverEnd={() => setHoveredId(null)}
            deleteMode={deleteMode}
            onDelete={onDeleteArtwork}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

// ======== 画廊页面主体 ========

export function GalleryPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeAlbumId, setActiveAlbumId] = useState<number | null>(null);
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadAlbumId, setUploadAlbumId] = useState<number | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);

  const activeAlbum = albums.find((a) => a.id === activeAlbumId) ?? null;

  // 加载专辑数据
  const loadAlbums = useCallback(async () => {
    try {
      setIsLoading(true);
      const details = await galleryApi.getAllAlbums();
      setAlbums(details.map(toLocalAlbum));
    } catch (err) {
      console.warn('Gallery API unavailable:', err);
      setAlbums([]); // API 不可用时显示空画廊
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  const openAddArtworkForAlbum = (albumId: number) => {
    console.log('[Gallery] Opening add artwork modal for album:', albumId);
    setDeleteMode(false);
    setUploadAlbumId(albumId);
    setIsUploadOpen(true);
  };

  const handleArtworkAdded = async (apiArt: ApiArtwork) => {
    console.log('[Gallery] Artwork added:', apiArt.id, 'albumId:', apiArt.albumId);
    // 乐观更新：先在本地状态中加入新画作
    if (apiArt.albumId != null) {
      setAlbums(prev => prev.map(a => {
        if (a.id !== apiArt.albumId) return a;
        return { ...a, artworks: [...a.artworks, toLocalArtwork(apiArt)] };
      }));
    } else {
      console.warn('[Gallery] Added artwork has no albumId, cannot match to local album');
    }
    // 然后从 API 重新加载以确保与数据库完全一致
    try {
      const details = await galleryApi.getAllAlbums();
      setAlbums(details.map(toLocalAlbum));
    } catch (err) {
      console.warn('[Gallery] Re-fetch after add failed, keeping optimistic update:', err);
    }
  };

  // 删除专辑（通过 API）
  const handleDeleteAlbum = async (albumId: number) => {
    try {
      await galleryApi.deleteAlbum(albumId);
      setAlbums(prev => prev.filter(a => a.id !== albumId));
      if (activeAlbumId === albumId) {
        setActiveAlbumId(null);
        setDeleteMode(false);
      }
    } catch (err) {
      console.warn('Failed to delete album via API, removing locally:', err);
      setAlbums(prev => prev.filter(a => a.id !== albumId));
      if (activeAlbumId === albumId) {
        setActiveAlbumId(null);
        setDeleteMode(false);
      }
    }
  };

  // 删除画作（通过 API）
  const handleDeleteArtwork = async (artworkId: number) => {
    try {
      await galleryApi.deleteArtwork(artworkId);
      setAlbums(prev => prev.map(a => ({
        ...a,
        artworks: a.artworks.filter(art => art.id !== artworkId),
      })));
    } catch (err) {
      console.warn('Failed to delete artwork via API, removing locally:', err);
      setAlbums(prev => prev.map(a => ({
        ...a,
        artworks: a.artworks.filter(art => art.id !== artworkId),
      })));
    }
  };

  // 新建专辑（空专辑，标题 Untitled）
  const handleAddAlbum = async () => {
    setDeleteMode(false);
    try {
      const newDetail = await galleryApi.createAlbum({
        title: 'Untitled',
        description: '',
      });
      setAlbums((prev) => [...prev, toLocalAlbum(newDetail)]);
    } catch (err) {
      console.warn('Failed to create album via API:', err);
      // 降级：本地临时创建空专辑（无 API 持久化）
      const tempId = Date.now();
      setAlbums((prev) => [
        ...prev,
        {
          id: tempId,
          title: 'Untitled',
          description: '',
          coverSeed: `temp-${tempId}`,
          artworks: [],
        },
      ]);
    }
  };

  // 更新专辑标题与描述（通过 API）
  const handleUpdateAlbum = async (albumId: number, newTitle: string, newDescription: string) => {
    try {
      await galleryApi.updateAlbum(albumId, {
        title: newTitle,
        description: newDescription,
      });
      setAlbums(prev => prev.map(a => {
        if (a.id !== albumId) return a;
        return { ...a, title: newTitle, description: newDescription };
      }));
    } catch (err) {
      console.warn('Failed to update album via API, updating locally:', err);
      setAlbums(prev => prev.map(a => {
        if (a.id !== albumId) return a;
        return { ...a, title: newTitle, description: newDescription };
      }));
    }
  };

  return (
    <AppLayout>
      <div className="container-page section-gap pt-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* 页面标题 */}
          <AnimatePresence>
            {!activeAlbum && (
              <motion.div
                variants={slideUp}
                className="mb-16"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <h1
                    className="relative inline-flex items-center cursor-default select-none"
                    style={{
                      fontSize: 'clamp(2rem, 4vw, 3rem)',
                      color: deleteMode ? '#EF4444' : 'var(--text-primary)',
                    }}
                    onMouseEnter={() => setIsTitleHovered(true)}
                    onMouseLeave={() => setIsTitleHovered(false)}
                  >
                Gallery
                <AnimatePresence>
                  {isTitleHovered && (
                    <>
                      {/* + 号：添加空专辑 */}
                      <PopButton
                        icon={<PlusIcon />}
                        onClick={handleAddAlbum}
                      />
                      {/* - 号：切换删除模式 */}
                      <PopButton
                        icon={<MinusIcon />}
                        onClick={() => setDeleteMode(prev => !prev)}
                        accentColor={deleteMode ? '#EF4444' : 'var(--text-secondary)'}
                      />
                    </>
                  )}
                </AnimatePresence>
              </h1>
            </div>
            <p
              className="font-light"
              style={{
                color: deleteMode ? '#EF4444' : 'var(--text-tertiary)',
                maxWidth: '480px',
              }}
            >
              {deleteMode
                ? '点击专辑将其从数据库移除 — 再次点击 - 号退出删除模式'
                : isLoading
                  ? '正在加载...'
                  : albums.length === 0
                    ? '点击 + 号创建你的第一个专辑'
                    : '悬停探索每一幅作品 — 聚光灯下，色彩苏醒'
              }
            </p>
            </motion.div>
          )}
          </AnimatePresence>

          {/* 专辑切换区域 */}
          <div className="max-w-7xl">
            <AnimatePresence mode="wait">
              {!activeAlbum && (
                <motion.div
                  key="albums-grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: 30 }}
                  transition={{
                    duration: 0.35,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-10 gap-y-14">
                    {albums.map((album, i) => (
                      <motion.div
                        key={album.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          // stagger capped at 0.36s (6 items max) to avoid long delays
                          delay: Math.min(i * 0.06, 0.36),
                          duration: 0.5,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        <StackDeck
                          album={album}
                          onOpen={setActiveAlbumId}
                          deleteMode={deleteMode}
                          onDelete={handleDeleteAlbum}
                        />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeAlbum && (
                <ExpandedAlbum
                  key={`expanded-${activeAlbum.id}`}
                  album={activeAlbum}
                  onBack={() => { setActiveAlbumId(null); setDeleteMode(false); }}
                  onOpenAddArtwork={openAddArtworkForAlbum}
                  deleteMode={deleteMode}
                  onToggleDeleteMode={() => setDeleteMode(prev => !prev)}
                  onDeleteArtwork={handleDeleteArtwork}
                  onSaveEdit={handleUpdateAlbum}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
      {isUploadOpen && uploadAlbumId !== null && (
        <ArtworkUploadModal
          albumId={uploadAlbumId}
          onClose={() => setIsUploadOpen(false)}
          onAdded={(art) => {
            handleArtworkAdded(art);
          }}
        />
      )}
    </AppLayout>
  );
}

export default GalleryPage;
