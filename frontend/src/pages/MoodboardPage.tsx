import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FloatingNav } from '../components/layout/FloatingNav';
import { vaultApi, aiApi, type VaultImageDTO } from '../lib/api';

/**
 * MoodboardStudio — 极简白板情绪板 (/moodboard)
 *
 * 设计系统：
 * - 极光白 #F9F9F9 / 深邃黑 #121212
 * - 黑白灰 UI，电光蓝 #2563EB 仅交互激活态
 * - spring(stiffness:260, damping:20) 物理动效
 *
 * 架构：
 * - 左侧 THE VAULT 标题 (fixed，不受侧边栏折叠影响) + 可折叠侧边栏
 * - 右侧 The Canvas — 双层叠加 (图片层 + 绘画层)
 * - 底部 Toolbar — 指针/画笔/马克笔/橡皮擦模式切换
 *
 * 数据持久化：
 * - 图库素材通过 vaultApi 从后端 SQLite vault_images 表加载
 * - 上传图片后自动保存到数据库并刷新图库
 * - API 不可用时自动降级为空列表
 */

// ============================================================
// 类型定义
// ============================================================

interface VaultImage {
  id: string;
  url: string;
  name: string;
  aspectRatio: number; // w/h
}

interface CanvasImage {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
}

type ToolMode = 'pointer' | 'pen' | 'brush' | 'eraser';
type CanvasBg = 'aurora' | 'void' | 'grid';

// ============================================================
// 工具常量
// ============================================================

const SIDEBAR_MIN = 250;
const SIDEBAR_MAX = 600;
const SIDEBAR_EXPANDED = 320;

const SPRING = { type: 'spring' as const, stiffness: 260, damping: 20 };
const SPRING_GENTLE = { type: 'spring' as const, stiffness: 150, damping: 18 };

let _imgIdCounter = 0;
function nextImageId() {
  return `canvas-img-${++_imgIdCounter}`;
}

/** 将后端 DTO 转换为前端 VaultImage（id 转 string 以兼容拖拽 JSON） */
function dtoToVaultImage(dto: VaultImageDTO): VaultImage {
  return {
    id: String(dto.id),
    url: dto.url,
    name: dto.name,
    aspectRatio: dto.aspectRatio,
  };
}

// ============================================================
// Sub-Component: VaultTitle (固定定位的 THE VAULT 标题 + 折叠按钮)
// ============================================================

function VaultTitle({
  isExpanded,
  onToggle,
}: {
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="fixed top-0 left-0 flex items-center gap-3"
      style={{ zIndex: 60, paddingLeft: 76, paddingTop: 24 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 标题文字 */}
      <h2
        className="font-heading font-black tracking-widest text-sm select-none"
        style={{ color: 'var(--text-primary)' }}
      >
        THE VAULT
      </h2>

      {/* 展开/折叠按钮 — hover 时滑出 */}
      <AnimatePresence>
        {hovered && (
          <motion.button
            initial={{ opacity: 0, x: -8, width: 0 }}
            animate={{ opacity: 1, x: 0, width: 24 }}
            exit={{ opacity: 0, x: -8, width: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={onToggle}
            className="flex items-center justify-center h-6 rounded-md cursor-pointer flex-shrink-0 overflow-hidden"
            style={{
              backgroundColor: isExpanded ? 'rgba(37,99,235,0.08)' : 'rgba(0,0,0,0.05)',
              color: isExpanded ? '#2563EB' : 'var(--text-muted)',
            }}
            whileHover={{ backgroundColor: 'rgba(37,99,235,0.12)' }}
            whileTap={{ scale: 0.92 }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                transform: isExpanded ? 'rotate(0deg)' : 'rotate(180deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <path
                d="M8 2L4 6L8 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Sub-Component: SidebarContent (侧边栏内容，不含标题)
// ============================================================

function SidebarContent({
  width,
  onWidthChange,
  onDragStart,
  vaultImages,
  uploading,
  onUpload,
}: {
  width: number;
  onWidthChange: (w: number) => void;
  onDragStart: (e: React.DragEvent, img: VaultImage) => void;
  vaultImages: VaultImage[];
  uploading: boolean;
  onUpload: (files: FileList) => void;
}) {
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleResizeDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      startX.current = e.clientX;
      startWidth.current = width;

      const onMove = (ev: MouseEvent) => {
        if (!isResizing.current) return;
        const delta = ev.clientX - startX.current;
        const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth.current + delta));
        onWidthChange(next);
      };
      const onUp = () => {
        isResizing.current = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [width, onWidthChange]
  );

  // 响应式列数
  const columns = width < 320 ? 2 : width < 460 ? 3 : 4;

  return (
    <div
      className="relative h-full flex flex-col"
      style={{
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid var(--border-primary)',
        userSelect: 'none',
      }}
    >
      {/* 顶部留白 — 给 THE VAULT 标题让位 */}
      <div className="h-14 flex-shrink-0" />

      {/* 副标题 */}
      <div className="pb-3 px-5 text-right" style={{ marginTop: 4 }}>
        <p className="font-light text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Drag to canvas →
        </p>
      </div>

      {/* 分割线 */}
      <div className="mx-5 h-[0.5px] mb-3" style={{ backgroundColor: 'var(--border-primary)' }} />

      {/* 瀑布流图库 */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {vaultImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-40">
            <p className="font-light text-[11px]" style={{ color: 'var(--text-muted)' }}>
              暂无素材
            </p>
          </div>
        ) : (
          <div
            style={{
              columnCount: columns,
              columnGap: '8px',
            }}
          >
            {vaultImages.map((img) => (
              <VaultCard key={img.id} image={img} onDragStart={onDragStart} />
            ))}
          </div>
        )}
      </div>

      {/* 上传按钮 */}
      <div className="px-3 pb-3 pt-1 flex-shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onUpload(e.target.files);
              e.target.value = ''; // 重置以便再次选择同一文件
            }
          }}
        />
        <motion.button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-colors duration-100"
          style={{
            backgroundColor: uploading ? 'rgba(37,99,235,0.04)' : 'rgba(37,99,235,0.06)',
            border: '1px dashed rgba(37,99,235,0.3)',
            color: uploading ? 'var(--text-muted)' : '#2563EB',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
          }}
          whileHover={!uploading ? { backgroundColor: 'rgba(37,99,235,0.10)' } : {}}
          whileTap={!uploading ? { scale: 0.97 } : {}}
        >
          {uploading ? (
            <motion.div
              className="w-3.5 h-3.5 rounded-full border-[1.5px]"
              style={{ borderColor: 'rgba(37,99,235,0.3)', borderTopColor: '#2563EB' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V13M1 7H13" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
          <span className="text-[11px] font-light">
            {uploading ? '上传中...' : '上传素材'}
          </span>
        </motion.button>
      </div>

      {/* 右侧拖拽手柄 */}
      <div
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize group"
        style={{ zIndex: 10 }}
        onMouseDown={handleResizeDown}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[3px] h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ backgroundColor: 'var(--color-electric-blue)' }}
        />
      </div>
    </div>
  );
}

/** 瀑布流内的单张图片卡片 */
function VaultCard({
  image,
  onDragStart,
}: {
  image: VaultImage;
  onDragStart: (e: React.DragEvent, img: VaultImage) => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.div
      draggable
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, image)}
      className="mb-2 rounded-md overflow-hidden cursor-grab active:cursor-grabbing break-inside-avoid group"
      style={{
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid transparent',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      whileHover={{
        borderColor: 'rgba(37, 99, 235, 0.3)',
        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)',
      }}
      transition={{ duration: 0.15 }}
    >
      <div className="relative">
        {!loaded && (
          <div
            className="w-full"
            style={{
              aspectRatio: image.aspectRatio,
              backgroundColor: 'var(--color-gray-100)',
            }}
          />
        )}
        <img
          src={image.url}
          alt={image.name}
          className="w-full block"
          style={{
            aspectRatio: image.aspectRatio,
            objectFit: 'cover',
            position: loaded ? 'relative' : 'absolute',
            opacity: loaded ? 1 : 0,
            inset: loaded ? undefined : 0,
          }}
          onLoad={() => setLoaded(true)}
          draggable={false}
        />
        {/* Hover 浮层 */}
        <div
          className="absolute inset-x-0 bottom-0 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{
            background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
          }}
        >
          <p className="text-[10px] font-light text-white truncate">{image.name}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Sub-Component: InteractiveImage (可拖拽/缩放/旋转)
// ============================================================

function InteractiveImage({
  image,
  isSelected,
  onSelect,
  onChange,
  toolMode,
}: {
  image: CanvasImage;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (update: Partial<CanvasImage>) => void;
  toolMode: ToolMode;
}) {
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeState = useRef<{ startX: number; startY: number; origW: number; origH: number; corner: string } | null>(null);
  const rotateState = useRef<{ startX: number; startY: number; origRot: number; cx: number; cy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPointer = toolMode === 'pointer';

  // --- 拖拽 ---
  const handleDragDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isPointer) return;
      e.stopPropagation();
      e.preventDefault();
      onSelect();
      dragState.current = { startX: e.clientX, startY: e.clientY, origX: image.x, origY: image.y };

      const onMove = (ev: MouseEvent) => {
        if (!dragState.current) return;
        const dx = ev.clientX - dragState.current.startX;
        const dy = ev.clientY - dragState.current.startY;
        onChange({ x: dragState.current.origX + dx, y: dragState.current.origY + dy });
      };
      const onUp = () => {
        dragState.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [image.x, image.y, isPointer, onSelect, onChange]
  );

  // --- 缩放 ---
  const handleResizeDown = useCallback(
    (e: React.MouseEvent, corner: string) => {
      e.stopPropagation();
      e.preventDefault();
      resizeState.current = { startX: e.clientX, startY: e.clientY, origW: image.width, origH: image.height, corner };

      const onMove = (ev: MouseEvent) => {
        if (!resizeState.current) return;
        const dx = ev.clientX - resizeState.current.startX;
        const dy = ev.clientY - resizeState.current.startY;
        let factor = 1;
        if (corner.includes('e')) factor = 1 + dx / resizeState.current.origW;
        else if (corner.includes('w')) factor = 1 - dx / resizeState.current.origW;
        if (corner.includes('s')) factor = factor * (1 + dy / resizeState.current.origH);
        else if (corner.includes('n')) factor = factor * (1 - dy / resizeState.current.origH);

        const newW = Math.max(60, resizeState.current.origW * factor);
        const newH = Math.max(40, resizeState.current.origH * factor);
        onChange({ width: newW, height: newH });
      };
      const onUp = () => {
        resizeState.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [image.width, image.height, onChange]
  );

  // --- 旋转 ---
  const handleRotateDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      rotateState.current = { startX: e.clientX, startY: e.clientY, origRot: image.rotation, cx, cy };

      const onMove = (ev: MouseEvent) => {
        if (!rotateState.current) return;
        const { cx: rcx, cy: rcy } = rotateState.current;
        const angle = Math.atan2(ev.clientY - rcy, ev.clientX - rcx);
        const startAng = Math.atan2(rotateState.current.startY - rcy, rotateState.current.startX - rcx);
        const delta = ((angle - startAng) * 180) / Math.PI;
        onChange({ rotation: rotateState.current.origRot + delta });
      };
      const onUp = () => {
        rotateState.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [image.rotation, onChange]
  );

  // 缩放把手位置
  const handles = [
    { pos: 'nw', style: { top: -4, left: -4, cursor: 'nw-resize' } },
    { pos: 'ne', style: { top: -4, right: -4, cursor: 'ne-resize' } },
    { pos: 'sw', style: { bottom: -4, left: -4, cursor: 'sw-resize' } },
    { pos: 'se', style: { bottom: -4, right: -4, cursor: 'se-resize' } },
    { pos: 'n', style: { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' } },
    { pos: 's', style: { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' } },
    { pos: 'w', style: { top: '50%', left: -4, transform: 'translateY(-50%)', cursor: 'w-resize' } },
    { pos: 'e', style: { top: '50%', right: -4, transform: 'translateY(-50%)', cursor: 'e-resize' } },
  ];

  return (
    <div
      ref={containerRef}
      className="absolute"
      style={{
        left: image.x,
        top: image.y,
        width: image.width,
        height: image.height,
        transform: `rotate(${image.rotation}deg)`,
        zIndex: image.zIndex,
      }}
    >
      {/* 图片本体 */}
      <div
        className="w-full h-full overflow-hidden"
        style={{
          cursor: isPointer ? (isSelected ? 'move' : 'pointer') : 'default',
          boxShadow: isSelected
            ? '0 0 0 1.5px #2563EB, 0 4px 16px rgba(37,99,235,0.12)'
            : '0 2px 8px rgba(0,0,0,0.08)',
          borderRadius: '2px',
          transition: 'box-shadow 0.15s ease',
        }}
        onMouseDown={handleDragDown}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <img
          src={image.url}
          alt=""
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      </div>

      {/* 选中态：旋转把手 + 缩放把手 */}
      <AnimatePresence>
        {isSelected && isPointer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {/* 旋转把手 — 顶部居中上方 */}
            <div
              className="absolute"
              style={{
                top: -28,
                left: '50%',
                transform: 'translateX(-50%)',
                cursor: 'grab',
                zIndex: 50,
              }}
              onMouseDown={handleRotateDown}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: '#2563EB',
                  boxShadow: '0 0 0 2px #fff, 0 2px 6px rgba(37,99,235,0.3)',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M5 1A4 4 0 1 1 1 5"
                    stroke="#fff"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                  <path d="M5 0L6.2 1.5H3.8L5 0Z" fill="#fff" />
                </svg>
              </div>
            </div>

            {/* 旋转连接线 */}
            <div
              className="absolute"
              style={{
                top: -12,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 1,
                height: 12,
                backgroundColor: '#2563EB',
              }}
            />

            {/* 缩放把手 */}
            {handles.map((h) => (
              <div
                key={h.pos}
                className="absolute w-2.5 h-2.5 rounded-sm"
                style={{
                  ...h.style,
                  backgroundColor: '#fff',
                  border: '1.5px solid #2563EB',
                  cursor: h.cursor,
                  zIndex: 50,
                }}
                onMouseDown={(e) => handleResizeDown(e, h.pos)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Sub-Component: DrawingCanvas (HTML5 Canvas 绘画层)
// ============================================================

function DrawingCanvas({
  mode,
  color,
  brushSize,
  canvasWidth,
  canvasHeight,
  visible,
}: {
  mode: ToolMode;
  color: string;
  brushSize: number;
  canvasWidth: number;
  canvasHeight: number;
  visible: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // 确保 canvas 尺寸匹配容器
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
  }, [canvasWidth, canvasHeight]);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  const getPos = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (mode === 'pointer') return;
      e.preventDefault();
      isDrawing.current = true;
      lastPos.current = getPos(e);

      const ctx = getContext();
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
    },
    [mode, getPos, getContext]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing.current || mode === 'pointer') return;
      e.preventDefault();
      const ctx = getContext();
      if (!ctx) return;

      const pos = getPos(e);

      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.globalAlpha = 1;
      } else if (mode === 'brush') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      if (lastPos.current) {
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
      }
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();

      lastPos.current = pos;
    },
    [mode, brushSize, color, getPos, getContext]
  );

  const handlePointerUp = useCallback(() => {
    isDrawing.current = false;
    lastPos.current = null;
    const ctx = getContext();
    if (ctx) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  }, [getContext]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{
        width: canvasWidth,
        height: canvasHeight,
        zIndex: 20,
        pointerEvents: visible ? 'auto' : 'none',
        cursor: mode === 'pen' ? 'crosshair' : mode === 'brush' ? 'crosshair' : mode === 'eraser' ? 'cell' : 'default',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}

// ============================================================
// Sub-Component: BackgroundSwitcher (画布背景切换)
// ============================================================

function BackgroundSwitcher({
  current,
  onChange,
}: {
  current: CanvasBg;
  onChange: (bg: CanvasBg) => void;
}) {
  const options: { key: CanvasBg; label: string; color: string; border?: string }[] = [
    { key: 'aurora', label: '极光白', color: '#F9F9F9', border: '#E5E5E5' },
    { key: 'void', label: '深邃黑', color: '#121212' },
    { key: 'grid', label: '网格', color: '#F9F9F9', border: '#E5E5E5' },
  ];

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
      style={{
        backgroundColor: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        border: '1px solid var(--border-primary)',
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className="relative flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors duration-100"
          style={{
            backgroundColor: current === opt.key ? 'rgba(37,99,235,0.08)' : 'transparent',
          }}
          title={opt.label}
        >
          <div
            className="w-4 h-4 rounded-sm"
            style={{
              backgroundColor: opt.color,
              border: `1.5px solid ${current === opt.key ? '#2563EB' : opt.border || 'transparent'}`,
              backgroundImage:
                opt.key === 'grid'
                  ? 'linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)'
                  : undefined,
              backgroundSize: opt.key === 'grid' ? '4px 4px' : undefined,
              boxShadow: current === opt.key ? '0 0 0 1px #2563EB' : undefined,
            }}
          />
          <span
            className="text-[10px] font-light"
            style={{ color: current === opt.key ? '#2563EB' : 'var(--text-muted)' }}
          >
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Sub-Component: Toolbar (底部悬浮工具栏)
// ============================================================

function Toolbar({
  activeTool,
  onToolChange,
  penColor,
  onPenColorChange,
  brushSize,
  onBrushSizeChange,
}: {
  activeTool: ToolMode;
  onToolChange: (t: ToolMode) => void;
  penColor: string;
  onPenColorChange: (c: string) => void;
  brushSize: number;
  onBrushSizeChange: (s: number) => void;
}) {
  const tools: { key: ToolMode; label: string; icon: JSX.Element }[] = [
    {
      key: 'pointer',
      label: '指针',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 2L6 14L8 9L13 7L3 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: 'pen',
      label: '画笔',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 14L5 11L12 4L13 3L11 5L4 12L2 14Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M11 5L12 4" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      ),
    },
    {
      key: 'brush',
      label: '马克笔',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="6" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6 11H10V13C10 14 9 15 8 15C7 15 6 14 6 13V11Z" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      ),
    },
    {
      key: 'eraser',
      label: '橡皮擦',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 12L8 4L14 8L10 16L4 12Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M2 14H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <motion.div
      className="flex items-center gap-1 px-1.5 py-1 rounded-xl"
      style={{
        backgroundColor: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
      }}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={SPRING}
    >
      {tools.map((tool) => (
        <button
          key={tool.key}
          onClick={() => onToolChange(tool.key)}
          className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors duration-100"
          style={{
            backgroundColor: activeTool === tool.key ? 'rgba(37,99,235,0.08)' : 'transparent',
            color: activeTool === tool.key ? '#2563EB' : 'var(--text-muted)',
          }}
          title={tool.label}
        >
          {tool.icon}
          <span className="text-[11px] font-light">{tool.label}</span>
          {activeTool === tool.key && (
            <motion.div
              className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-[2px] rounded-full"
              style={{ backgroundColor: '#2563EB', width: '60%' }}
              layoutId="toolbar-indicator"
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            />
          )}
        </button>
      ))}

      {/* 绘画模式下的附加控件 */}
      {(activeTool === 'pen' || activeTool === 'brush' || activeTool === 'eraser') && (
        <>
          <div className="w-[0.5px] h-6 mx-1" style={{ backgroundColor: 'var(--border-primary)' }} />

          {/* 颜色选择 */}
          {activeTool !== 'eraser' && (
            <div className="flex items-center gap-1.5 px-2">
              {['#0A0A0A', '#F5F5F5', '#2563EB', '#EF4444'].map((c) => (
                <button
                  key={c}
                  onClick={() => onPenColorChange(c)}
                  className="w-4 h-4 rounded-full transition-transform duration-100"
                  style={{
                    backgroundColor: c,
                    border: penColor === c ? '2px solid #2563EB' : `1.5px solid ${c === '#F5F5F5' ? '#D4D4D4' : 'transparent'}`,
                    transform: penColor === c ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: penColor === c ? '0 0 0 2px rgba(37,99,235,0.2)' : 'none',
                  }}
                />
              ))}
            </div>
          )}

          {/* 粗细滑块 */}
          <div className="flex items-center gap-2 px-2">
            <input
              type="range"
              min={1}
              max={activeTool === 'brush' ? 24 : 8}
              value={brushSize}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))}
              className="w-16 h-1 appearance-none rounded-full cursor-pointer"
              style={{
                backgroundColor: 'var(--color-gray-200)',
                accentColor: '#2563EB',
              }}
            />
            <span className="text-[10px] font-light" style={{ color: 'var(--text-muted)', minWidth: 20 }}>
              {brushSize}px
            </span>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ============================================================
// Main Component: MoodboardStudio
// ============================================================

export function MoodboardStudio() {
  // --- 侧边栏 ---
  const [sidebarExpanded, setSidebarExpanded] = useState(false); // 默认折叠
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_EXPANDED);

  // --- 图库素材 (从后端加载) ---
  const [vaultImages, setVaultImages] = useState<VaultImage[]>([]);
  const [uploading, setUploading] = useState(false);

  // --- 画布图片 ---
  const [canvasImages, setCanvasImages] = useState<CanvasImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const nextZIndex = useRef(1);

  // --- 工具模式 ---
  const [toolMode, setToolMode] = useState<ToolMode>('pointer');

  // --- 画布背景 ---
  const [canvasBg, setCanvasBg] = useState<CanvasBg>('aurora');

  // --- 绘画参数 ---
  const [penColor, setPenColor] = useState('#0A0A0A');
  const [brushSize, setBrushSize] = useState(2);

  // --- 画布容器 ---
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 });

  // --- 加载图库数据 ---
  const loadVaultImages = useCallback(async () => {
    try {
      const dtos = await vaultApi.getAllImages();
      setVaultImages(dtos.map(dtoToVaultImage));
    } catch {
      // API 不可用时降级为空列表
      setVaultImages([]);
    }
  }, []);

  useEffect(() => {
    loadVaultImages();
  }, [loadVaultImages]);

  // --- 上传图片处理 ---
  const handleUpload = useCallback(async (files: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        // 1. 上传图片文件到后端，获取 URL
        const imageUrl = await aiApi.uploadImage(file);

        // 2. 计算图片宽高比
        const aspectRatio = await new Promise<number>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.width / img.height);
          img.onerror = () => resolve(1.5); // 默认宽高比
          img.src = imageUrl;
        });

        // 3. 保存到 vault_images 数据库
        const name = file.name.replace(/\.[^.]+$/, ''); // 去掉扩展名作为名称
        await vaultApi.createImage(imageUrl, name, aspectRatio);
      }
      // 4. 刷新图库列表
      await loadVaultImages();
    } catch (err) {
      console.error('上传素材失败:', err);
    } finally {
      setUploading(false);
    }
  }, [loadVaultImages]);

  // 监听画布容器尺寸
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasDims({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // --- 从素材库拖入画布 ---
  const handleVaultDragStart = useCallback(
    (e: React.DragEvent, img: VaultImage) => {
      e.dataTransfer.setData('application/json', JSON.stringify(img));
      e.dataTransfer.effectAllowed = 'copy';
    },
    []
  );

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const json = e.dataTransfer.getData('application/json');
      if (!json) return;

      try {
        const vaultImg: VaultImage = JSON.parse(json);
        const rect = canvasContainerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left - 75;
        const y = e.clientY - rect.top - 60;
        const w = 200;
        const h = w / vaultImg.aspectRatio;
        const z = nextZIndex.current++;

        setCanvasImages((prev) => [
          ...prev,
          {
            id: nextImageId(),
            url: vaultImg.url,
            x: Math.max(0, x),
            y: Math.max(0, y),
            width: w,
            height: h,
            rotation: (Math.random() - 0.5) * 4,
            zIndex: z,
          },
        ]);
      } catch {
        // ignore parse errors
      }
    },
    []
  );

  // --- 画布点击取消选中 ---
  const handleCanvasClick = useCallback(() => {
    if (toolMode === 'pointer') {
      setSelectedImageId(null);
    }
  }, [toolMode]);

  // --- 更新画布图片属性 ---
  const handleImageChange = useCallback(
    (id: string, update: Partial<CanvasImage>) => {
      setCanvasImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, ...update } : img))
      );
    },
    []
  );

  const handleImageSelect = useCallback((id: string) => {
    setSelectedImageId(id);
    setCanvasImages((prev) => {
      const z = nextZIndex.current++;
      return prev.map((img) => (img.id === id ? { ...img, zIndex: z } : img));
    });
  }, []);

  // --- 画布背景样式 ---
  const canvasBgStyle = (() => {
    switch (canvasBg) {
      case 'aurora':
        return { backgroundColor: '#F9F9F9' };
      case 'void':
        return { backgroundColor: '#121212' };
      case 'grid':
        return {
          backgroundColor: '#F9F9F9',
          backgroundImage:
            'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        };
    }
  })();

  // 是否处于绘画模式
  const isDrawingMode = toolMode !== 'pointer';

  // 侧边栏动画宽度
  const currentSidebarWidth = sidebarExpanded ? sidebarWidth : 0;

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F9F9F9' }}>
      {/* 悬浮导航 */}
      <FloatingNav />

      {/* THE VAULT 固定标题 — 不受侧边栏折叠影响 */}
      <VaultTitle
        isExpanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded((prev) => !prev)}
      />

      {/* ======== 左侧：可折叠侧边栏 ======== */}
      <motion.div
        className="flex-shrink-0 overflow-hidden"
        animate={{ width: currentSidebarWidth }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ originX: 0 }}
      >
        {sidebarExpanded && (
          <SidebarContent
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
            onDragStart={handleVaultDragStart}
            vaultImages={vaultImages}
            uploading={uploading}
            onUpload={handleUpload}
          />
        )}
      </motion.div>

      {/* ======== 右侧：The Canvas ======== */}
      <div
        ref={canvasContainerRef}
        className="flex-1 relative overflow-hidden"
        style={canvasBgStyle}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
        onClick={handleCanvasClick}
      >
        {/* ---- 图片层 ---- */}
        <div
          className="absolute inset-0"
          style={{
            zIndex: 5,
            pointerEvents: isDrawingMode ? 'none' : 'auto',
          }}
        >
          {canvasImages.map((img) => (
            <InteractiveImage
              key={img.id}
              image={img}
              isSelected={selectedImageId === img.id}
              onSelect={() => handleImageSelect(img.id)}
              onChange={(update) => handleImageChange(img.id, update)}
              toolMode={toolMode}
            />
          ))}
        </div>

        {/* ---- 绘画层 ---- */}
        <DrawingCanvas
          mode={toolMode}
          color={penColor}
          brushSize={brushSize}
          canvasWidth={canvasDims.w}
          canvasHeight={canvasDims.h}
          visible={isDrawingMode}
        />

        {/* ---- 空画布提示 ---- */}
        {canvasImages.length === 0 && !isDrawingMode && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="text-center">
              <p
                className="font-heading font-black tracking-widest text-xl mb-2"
                style={{ color: 'var(--text-muted)', opacity: 0.35 }}
              >
                THE CANVAS
              </p>
              <p
                className="font-light text-sm"
                style={{ color: 'var(--text-muted)', opacity: 0.25 }}
              >
                Drag items from the vault to start
              </p>
            </div>
          </motion.div>
        )}

        {/* ---- 顶部悬浮：画布背景切换 ---- */}
        <div className="absolute top-4 right-4" style={{ zIndex: 40 }}>
          <BackgroundSwitcher current={canvasBg} onChange={setCanvasBg} />
        </div>

        {/* ---- 底部悬浮：工具栏 ---- */}
        <div
          className="absolute bottom-5 left-1/2 -translate-x-1/2"
          style={{ zIndex: 40 }}
        >
          <Toolbar
            activeTool={toolMode}
            onToolChange={setToolMode}
            penColor={penColor}
            onPenColorChange={setPenColor}
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
          />
        </div>

        {/* ---- 模式提示 ---- */}
        <AnimatePresence>
          {isDrawingMode && (
            <motion.div
              className="absolute top-4 left-4 px-3 py-1.5 rounded-lg"
              style={{
                zIndex: 40,
                backgroundColor: 'rgba(37,99,235,0.06)',
                border: '1px solid rgba(37,99,235,0.15)',
              }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <p className="text-[11px] font-light" style={{ color: '#2563EB' }}>
                绘画模式 — 图片拖拽已禁用
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default MoodboardStudio;
