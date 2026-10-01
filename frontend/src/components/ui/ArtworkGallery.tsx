import { motion, AnimatePresence } from 'framer-motion';

/**
 * 单张画作卡片组件（ArtworkCard）
 *
 * 保留聚光灯效应：
 * - 默认低饱和度，悬停恢复鲜艳色彩 + 放大 1.05 + 阴影
 * - 其余卡片模糊 + 降亮度
 * - 画作信息（标题、平台链接）悬停时从底部淡入上浮
 */

export interface Artwork {
  id: number;
  title: string;
  seed: string;
  height: number;
  platform?: string;
  platformUrl?: string;
}

interface ArtworkCardProps {
  artwork: Artwork;
  isHovered: boolean;
  isAnyHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

export function ArtworkCard({
  artwork,
  isHovered,
  isAnyHovered,
  onHoverStart,
  onHoverEnd,
}: ArtworkCardProps) {
  const isDimmed = isAnyHovered && !isHovered;

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl break-inside-avoid mb-4"
      style={{
        filter: isDimmed
          ? 'blur(2px) brightness(0.6)'
          : 'blur(0px) brightness(1)',
        transition: 'filter 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      animate={{ scale: isHovered ? 1.05 : 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, mass: 0.6 }}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      whileHover={{ boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
    >
      <div className="relative overflow-hidden">
        <img
          src={`https://picsum.photos/seed/${artwork.seed}/600/${artwork.height}`}
          alt={artwork.title}
          loading="lazy"
          className="w-full block"
          style={{
            height: artwork.height,
            objectFit: 'cover',
            filter: isHovered ? 'saturate(1)' : 'saturate(0.3)',
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
          {isHovered && (
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
      </div>
    </motion.div>
  );
}

export default ArtworkCard;
