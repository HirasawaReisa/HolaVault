import { useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

/**
 * 全屏平铺瀑布流背景 (Pinterest 风格)
 *
 * - 单层平铺：图片按列排布，互不重叠
 * - 各列独立缓慢流动（CSS @keyframes + translateY 无缝循环）
 * - 奇偶列方向交替 (up/down)，速度微差产生自然感
 * - 鼠标视差：反方向微移（最大 20px），Spring 物理阻尼
 * - 低透明度 + 灰度处理，不抢前景
 */

const IMAGE_SEEDS = [
  'painting1', 'art2', 'abstract3', 'watercolor4',
  'sketch5', 'illustration6', 'canvas7', 'portrait8',
  'gallery9', 'brush10', 'palette11', 'mural12',
  'ink13', 'color14', 'design15', 'creative16',
  'studio17', 'visual18', 'draw19', 'paint20',
  'ink21', 'color22', 'design23', 'creative24',
  'canvas29', 'portrait30',
];

// 每张卡片高度不同，产生 Pinterest 式错落感
const CARD_HEIGHTS = [160, 220, 180, 260, 200, 240, 280, 170, 230, 190];

interface ImageItem {
  id: number;
  seed: string;
  height: number;
}

function generateImages(count: number): ImageItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    seed: IMAGE_SEEDS[i % IMAGE_SEEDS.length],
    height: CARD_HEIGHTS[i % CARD_HEIGHTS.length],
  }));
}

// ======== 流动瀑布流列 ========

interface FlowingColumnProps {
  images: ImageItem[];
  columnWidth: string;
  speed: number;
  direction: 'up' | 'down';
  gap?: number;
  borderRadius?: number;
}

/**
 * 单列平铺流动瀑布流
 * - 图片之间有 gap，不重叠
 * - 渲染两份相同内容实现无缝循环
 * - CSS @keyframes + translateY 驱动
 */
function FlowingColumn({
  images,
  columnWidth,
  speed,
  direction,
  gap = 10,
  borderRadius = 10,
}: FlowingColumnProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // 唯一动画名
  const animName = `flow-col-${speed.toFixed(0)}-${images[0]?.id ?? 0}`;

  // 单份内容的总高度（所有图片 + gap 之和）
  const totalHeight = useMemo(() => {
    return images.reduce((sum, img) => sum + img.height + gap, 0);
  }, [images, gap]);

  return (
    <div
      style={{
        width: columnWidth,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <style>{`
        @keyframes ${animName} {
          0% { transform: translateY(0); }
          100% { transform: translateY(${direction === 'up' ? `-${totalHeight}px` : `${totalHeight}px`}); }
        }
      `}</style>
      <div
        ref={contentRef}
        style={{
          animation: `${animName} ${totalHeight / speed}s linear infinite`,
        }}
      >
        {/* 渲染两份相同内容实现无缝循环 */}
        {[0, 1].map((copy) => (
          <div key={copy}>
            {images.map((img) => (
              <div
                key={`${copy}-${img.id}`}
                style={{
                  marginBottom: gap,
                  borderRadius,
                  overflow: 'hidden',
                }}
              >
                <img
                  src={`https://picsum.photos/seed/${img.seed}/400/${img.height}`}
                  alt=""
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: img.height,
                    objectFit: 'cover',
                    filter: 'grayscale(100%)',
                    display: 'block',
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ======== 主组件 ========

export function ParallaxBackground() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { stiffness: 80, damping: 20, mass: 0.5 };
  const parallaxX = useSpring(mouseX, springConfig);
  const parallaxY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseX.set(-nx * 20);
      mouseY.set(-ny * 20);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  // 瀑布流列数和每列图片
  const columnCount = 7;
  const imagesPerColumn = 8;

  // 为每列生成独立的图片集合（不同起始偏移，避免视觉重复）
  const columns = useMemo(() => {
    return Array.from({ length: columnCount }, (_, colIdx) => {
      const startIdx = colIdx * imagesPerColumn;
      const imgs = generateImages(imagesPerColumn + 4); // 多生成几张确保高度足够循环
      // 每列取不同偏移的子集
      return imgs.slice(startIdx % imgs.length, (startIdx % imgs.length) + imagesPerColumn);
    });
  }, []);

  // 每列的速度和方向
  const columnConfigs = useMemo(() => {
    return Array.from({ length: columnCount }, (_, i) => ({
      speed: 15 + i * 3,                 // 15 ~ 33 px/s，各列速度递增
      direction: (i % 2 === 0 ? 'up' : 'down') as 'up' | 'down',
    }));
  }, []);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ pointerEvents: 'none' }}
    >
      {/* 单层平铺瀑布流 + 鼠标视差 */}
      <motion.div
        className="absolute inset-0 w-[105%] h-[105%] -left-[2.5%] -top-[2.5%]"
        style={{
          x: parallaxX,
          y: parallaxY,
        }}
      >
        <div
          style={{
            display: 'flex',
            height: '100%',
            gap: '6px',
            padding: '0 4px',
            opacity: 0.12,
          }}
        >
          {columns.map((colImages, colIdx) => (
            <FlowingColumn
              key={colIdx}
              images={colImages}
              columnWidth={`${100 / columnCount}%`}
              speed={columnConfigs[colIdx].speed}
              direction={columnConfigs[colIdx].direction}
              gap={8}
              borderRadius={8}
            />
          ))}
        </div>
      </motion.div>

      {/* 中心径向渐变遮罩 - 让前景标题可读 */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 15%, var(--bg-primary) 65%)',
        }}
      />

      {/* 顶部 + 底部线性渐变 */}
      <div
        className="absolute inset-x-0 top-0 h-28"
        style={{
          background: 'linear-gradient(to bottom, var(--bg-primary), transparent)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-28"
        style={{
          background: 'linear-gradient(to top, var(--bg-primary), transparent)',
        }}
      />
    </div>
  );
}

export default ParallaxBackground;
