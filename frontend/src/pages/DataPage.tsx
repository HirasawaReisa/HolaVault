import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FloatingNav } from '../components/layout/FloatingNav';
import { timelineApi, galleryApi, type TimelineNodeDTO, type AlbumDetail } from '../lib/api';

// ============================================================
// 前端 TimelineNode 类型
// ============================================================
interface TimelineNode {
  id: number;
  title: string;
  period: string;
  coverUrl: string;
  analysis: string;
  albumId: number | null;
  sortOrder: number;
}

/** DTO → 前端类型转换 */
function dtoToNode(dto: TimelineNodeDTO): TimelineNode {
  return {
    id: dto.id,
    title: dto.title,
    period: dto.period,
    coverUrl: dto.coverUrl,
    analysis: dto.analysis,
    albumId: dto.albumId,
    sortOrder: dto.sortOrder,
  };
}

// ============================================================
// 布局常量
// ============================================================
const NODE_SPACING = 360;     // 节点间距（px）
const START_OFFSET = 200;     // 第一个节点离左边缘的距离
const CONNECTOR_HEIGHT = 28;  // 连接线长度（px）
const CONNECTOR_GAP = 10;     // 连接线与内容间距（px）

// ============================================================
// DataLabel — 顶部 DATA 标题 + 悬停 "+" 按钮
// ============================================================
function DataLabel({ onAddClick }: { onAddClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className="fixed top-5"
      style={{ left: 76, zIndex: 50 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center gap-3">
        <h1
          className="font-heading font-black tracking-[0.3em] text-black"
          style={{ fontSize: '2.8rem' }}
        >
          DATA
        </h1>

        <AnimatePresence>
          {hovered && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5, x: -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.5, x: -8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              onClick={onAddClick}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
              style={{ border: '1px solid #000', backgroundColor: 'transparent' }}
              aria-label="添加节点"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#000" strokeWidth="1.5">
                <line x1="7" y1="2" x2="7" y2="12" />
                <line x1="2" y1="7" x2="12" y2="7" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ============================================================
// TimelineNode — 绝对定位，圆点精确对齐时间轴
// ============================================================
interface TimelineNodeProps {
  data: TimelineNode;
  index: number;
  left: number;
  isNew?: boolean;
  onDelete: (id: number) => void;
}

const TimelineNodeComponent = memo(function TimelineNodeComponent({ data, index, left, isNew, onDelete }: TimelineNodeProps) {
  const isEven = index % 2 === 0;
  const offsetBelow = CONNECTOR_HEIGHT + CONNECTOR_GAP;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className="absolute top-0"
      style={{ left, width: NODE_SPACING, height: '100vh' }}
      initial={isNew ? { opacity: 0, scale: 0.8 } : { opacity: 0 }}
      animate={isNew ? { opacity: 1, scale: 1 } : { opacity: 1 }}
      transition={
        isNew
          ? { type: 'spring', stiffness: 200, damping: 20 }
          : { delay: Math.min(index * 0.12, 0.48), duration: 0.5, ease: [0.22, 1, 0.36, 1] }
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ---- 圆点：精确在 50vh（时间轴位置） ---- */}
      <div
        className="absolute left-1/2 w-2.5 h-2.5 rounded-full bg-black"
        style={{ top: '50vh', transform: 'translate(-50%, -50%)', zIndex: 10 }}
      />

      {/* ---- 连接线 ---- */}
      <div
        className="absolute left-1/2 w-[1px] bg-black"
        style={{
          top: isEven ? `calc(50vh - ${CONNECTOR_HEIGHT}px)` : '50vh',
          height: CONNECTOR_HEIGHT,
          transform: 'translateX(-50%)',
          zIndex: 8,
        }}
      />

      {/* ---- 上方内容（偶数索引） ---- */}
      {isEven && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
          style={{ bottom: `calc(50vh + ${offsetBelow}px)` }}
          initial={isNew ? { opacity: 0, y: -20 } : { opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            isNew
              ? { delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }
              : { delay: Math.min(index * 0.12, 0.48) + 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }
          }
        >
          {/* 专辑封面 */}
          <div className="w-80 h-60 overflow-hidden shadow-sm mb-3">
            <img
              src={data.coverUrl}
              alt={data.title}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
          {/* 标题 + 删除按钮 */}
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-black tracking-wider text-[16px] text-black">
              {data.title}
            </h3>
            <AnimatePresence>
              {hovered && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  onClick={() => onDelete(data.id)}
                  whileHover={{ scale: 1.2, color: '#dc2626' }}
                  whileTap={{ scale: 0.8 }}
                  className="flex items-center justify-center cursor-pointer"
                  style={{ width: 14, height: 14 }}
                  aria-label="删除节点"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="2" y1="2" x2="8" y2="8" />
                    <line x1="8" y1="2" x2="2" y2="8" />
                  </svg>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <span className="font-light tracking-[0.2em] text-[16px] text-gray-500">
            {data.period}
          </span>
          {/* AI 分析文本 */}
          {data.analysis && (
            <p className="font-light text-[13px] leading-[1.9] text-gray-600 mt-3 max-w-[280px] text-center tracking-wide">
              {data.analysis}
            </p>
          )}
        </motion.div>
      )}

      {/* ---- 下方内容（奇数索引） ---- */}
      {!isEven && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
          style={{ top: `calc(50vh + ${offsetBelow}px)` }}
          initial={isNew ? { opacity: 0, y: 20 } : { opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            isNew
              ? { delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }
              : { delay: Math.min(index * 0.12, 0.48) + 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }
          }
        >
          {/* 标题 + 删除按钮 */}
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-black tracking-wider text-[16px] text-black">
              {data.title}
            </h3>
            <AnimatePresence>
              {hovered && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  onClick={() => onDelete(data.id)}
                  whileHover={{ scale: 1.2, color: '#dc2626' }}
                  whileTap={{ scale: 0.8 }}
                  className="flex items-center justify-center cursor-pointer"
                  style={{ width: 14, height: 14 }}
                  aria-label="删除节点"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="2" y1="2" x2="8" y2="8" />
                    <line x1="8" y1="2" x2="2" y2="8" />
                  </svg>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <span className="font-light tracking-[0.2em] text-[16px] text-gray-500 mb-3">
            {data.period}
          </span>
          {/* 专辑封面 */}
          <div className="w-80 h-60 overflow-hidden shadow-sm mb-3">
            <img
              src={data.coverUrl}
              alt={data.title}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
          {/* AI 分析文本 */}
          {data.analysis && (
            <p className="font-light text-[13px] leading-[1.9] text-gray-600 max-w-[280px] text-center tracking-wide">
              {data.analysis}
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
});

// ============================================================
// AddNodeModal — 添加节点弹窗（从画廊专辑中选择）
// ============================================================
function AddNodeModal({
  onClose,
  onSave,
  albums,
}: {
  onClose: () => void;
  onSave: (data: {
    title: string;
    period: string;
    coverUrl: string;
    analysis: string;
    albumId: number | null;
  }) => void;
  albums: AlbumDetail[];
}) {
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);

  // 根据选中的专辑获取封面图
  const selectedAlbum = albums.find((a) => a.album.id === selectedAlbumId);
  const coverUrl =
    selectedAlbum && selectedAlbum.artworks.length > 0
      ? selectedAlbum.artworks[0].imageUrl
      : '';

  // 自动填充标题
  useEffect(() => {
    if (selectedAlbum && !title.trim()) {
      setTitle(selectedAlbum.album.title);
    }
  }, [selectedAlbum, title]);

  const handleSave = useCallback(() => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      period: period.trim() || 'UNSPECIFIED',
      coverUrl: coverUrl || '',
      analysis: analysis.trim() || '',
      albumId: selectedAlbumId,
    });
  }, [title, period, analysis, coverUrl, selectedAlbumId, onSave]);

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9990 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* 模糊背景 */}
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(249,249,249,0.7)' }}
        onClick={onClose}
      />

      {/* 弹窗主体 */}
      <motion.div
        className="relative w-[380px] p-10"
        style={{ backgroundColor: '#FFFFFF' }}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {/* 标题 */}
        <h2 className="font-heading font-black tracking-[0.2em] text-[12px] text-black mb-8">
          ADD NODE
        </h2>

        {/* 极简输入框 */}
        <div className="space-y-6">
          {/* 专辑选择 */}
          <div>
            <label className="font-light tracking-[0.15em] text-[10px] text-gray-500 mb-2 block">
              ALBUM (COVER SOURCE)
            </label>
            <select
              value={selectedAlbumId ?? ''}
              onChange={(e) =>
                setSelectedAlbumId(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full bg-transparent border-b border-gray-300 pb-2 font-light text-sm text-black tracking-wider outline-none focus:border-black transition-colors duration-200 appearance-none cursor-pointer"
            >
              <option value="">-- 选择画廊专辑 --</option>
              {albums.map((a) => (
                <option key={a.album.id} value={a.album.id}>
                  {a.album.title} ({a.artworks.length} 画作)
                </option>
              ))}
            </select>
          </div>

          {/* 封面预览 */}
          {coverUrl && (
            <div className="w-full h-20 overflow-hidden shadow-sm">
              <img
                src={coverUrl}
                alt="封面预览"
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
          )}

          <div>
            <label className="font-light tracking-[0.15em] text-[10px] text-gray-500 mb-2 block">
              NODE TITLE
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VOL.4 望月之庭"
              className="w-full bg-transparent border-b border-gray-300 pb-2 font-light text-sm text-black tracking-wider outline-none focus:border-black transition-colors duration-200 placeholder:text-gray-300"
            />
          </div>

          <div>
            <label className="font-light tracking-[0.15em] text-[10px] text-gray-500 mb-2 block">
              TIME SPAN
            </label>
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="2024 JUL - SEP"
              className="w-full bg-transparent border-b border-gray-300 pb-2 font-light text-sm text-black tracking-wider outline-none focus:border-black transition-colors duration-200 placeholder:text-gray-300"
            />
          </div>

          <div>
            <label className="font-light tracking-[0.15em] text-[10px] text-gray-500 mb-2 block">
              AI EVALUATION
            </label>
            <textarea
              value={analysis}
              onChange={(e) => setAnalysis(e.target.value)}
              placeholder="情感基调、色彩趋势、技法评价..."
              rows={3}
              className="w-full bg-transparent border-b border-gray-300 pb-2 font-light text-sm text-black tracking-wider outline-none focus:border-black transition-colors duration-200 placeholder:text-gray-300 resize-none"
            />
          </div>
        </div>

        {/* SAVE 按钮 */}
        <motion.button
          onClick={handleSave}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          disabled={!title.trim()}
          className="mt-8 w-full py-2.5 font-heading tracking-[0.25em] text-[11px] text-black border border-black bg-transparent cursor-pointer transition-colors duration-200 hover:bg-black hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          SAVE
        </motion.button>

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-6 h-6 flex items-center justify-center cursor-pointer opacity-30 hover:opacity-60 transition-opacity"
          aria-label="关闭"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#000" strokeWidth="1.5">
            <line x1="1" y1="1" x2="11" y2="11" />
            <line x1="11" y1="1" x2="1" y2="11" />
          </svg>
        </button>
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// TimelineAnalytics — 创作成长编年史
// ============================================================
export function TimelineAnalytics() {
  const [timelineNodes, setTimelineNodes] = useState<TimelineNode[]>([]);
  const [albums, setAlbums] = useState<AlbumDetail[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newNodeId, setNewNodeId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载时间轴节点
  const loadNodes = useCallback(async () => {
    try {
      const dtos = await timelineApi.getAllNodes();
      setTimelineNodes(dtos.map(dtoToNode));
    } catch {
      setTimelineNodes([]);
    }
  }, []);

  // 加载画廊专辑列表
  const loadAlbums = useCallback(async () => {
    try {
      const data = await galleryApi.getAllAlbums();
      setAlbums(data);
    } catch {
      setAlbums([]);
    }
  }, []);

  useEffect(() => {
    loadNodes();
    loadAlbums();
  }, [loadNodes, loadAlbums]);

  // 添加节点回调
  const handleAddNode = useCallback(
    async (newNodeData: {
      title: string;
      period: string;
      coverUrl: string;
      analysis: string;
      albumId: number | null;
    }) => {
      try {
        const saved = await timelineApi.createNode(newNodeData);
        setTimelineNodes((prev) => [...prev, dtoToNode(saved)]);
        setNewNodeId(saved.id);
      } catch (err) {
        console.error('添加节点失败:', err);
      }
      setShowModal(false);
    },
    []
  );

  // 删除节点回调
  const handleDeleteNode = useCallback(
    async (id: number) => {
      try {
        await timelineApi.deleteNode(id);
        setTimelineNodes((prev) => prev.filter((n) => n.id !== id));
      } catch (err) {
        console.error('删除节点失败:', err);
      }
    },
    []
  );

  // 新节点添加后自动滚动到右侧
  useEffect(() => {
    if (newNodeId !== null && scrollRef.current) {
      const totalWidth =
        START_OFFSET + timelineNodes.length * NODE_SPACING + 200;
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            left: totalWidth - scrollRef.current.clientWidth,
            behavior: 'smooth',
          });
        }
      });
      setNewNodeId(null);
    }
  }, [newNodeId, timelineNodes.length]);

  const totalWidth =
    START_OFFSET + timelineNodes.length * NODE_SPACING + 200;

  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{ backgroundColor: '#F9F9F9' }}
    >
      {/* 悬浮导航 */}
      <FloatingNav />

      {/* DATA 标题 + 悬停 "+" 按钮 */}
      <DataLabel onAddClick={() => setShowModal(true)} />

      {/* ---- 左侧导航箭头 < ---- */}
      <motion.button
        onClick={() => {
          if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: -NODE_SPACING, behavior: 'smooth' });
          }
        }}
        whileHover={{ scale: 1.1, opacity: 0.7 }}
        whileTap={{ scale: 0.9 }}
        className="fixed flex items-center justify-center cursor-pointer"
        style={{
          left: 24,
          top: 'calc(50vh - 28px)',
          width: 36,
          height: 36,
          backgroundColor: 'transparent',
          zIndex: 40,
        }}
        aria-label="向左滚动时间轴"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="13 4 6 10 13 16" />
        </svg>
      </motion.button>

      {/* ---- 右侧导航箭头 > ---- */}
      <motion.button
        onClick={() => {
          if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: NODE_SPACING, behavior: 'smooth' });
          }
        }}
        whileHover={{ scale: 1.1, opacity: 0.7 }}
        whileTap={{ scale: 0.9 }}
        className="fixed flex items-center justify-center cursor-pointer"
        style={{
          right: 24,
          top: 'calc(50vh - 28px)',
          width: 36,
          height: 36,
          backgroundColor: 'transparent',
          zIndex: 40,
        }}
        aria-label="向右滚动时间轴"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="7 4 14 10 7 16" />
        </svg>
      </motion.button>

      {/* ---- 横向滚动容器 ---- */}
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: 'none', zIndex: 10 }}
      >
        <style>{`
          .timeline-scroll::-webkit-scrollbar { display: none; }
        `}</style>

        {/* 内部宽容器 */}
        <div
          className="relative timeline-scroll"
          style={{ minWidth: totalWidth, height: '100vh' }}
        >
          {/* ---- 时间轴黑线：精确在 50vh ---- */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: '50vh',
              height: '1px',
              backgroundColor: '#000',
              zIndex: 5,
            }}
          />

          {/* ---- ORIGIN 标记 ---- */}
          <motion.div
            className="absolute"
            style={{
              top: '50vh',
              left: 60,
              transform: 'translateY(-50%)',
              zIndex: 6,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <span className="font-light tracking-[0.2em] text-[10px] text-gray-400">
              ORIGIN
            </span>
          </motion.div>

          {/* ---- 专辑节点 ---- */}
          {timelineNodes.map((item, i) => (
            <TimelineNodeComponent
              key={item.id}
              data={item}
              index={i}
              left={START_OFFSET + i * NODE_SPACING}
              isNew={newNodeId === item.id}
              onDelete={handleDeleteNode}
            />
          ))}

          {/* ---- NOW 标记 ---- */}
          <motion.div
            className="absolute"
            style={{
              top: '50vh',
              left: START_OFFSET + timelineNodes.length * NODE_SPACING + 40,
              transform: 'translateY(-50%)',
              zIndex: 6,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{
              delay: timelineNodes.length * 0.25 + 0.5,
              duration: 0.6,
            }}
          >
            <span className="font-light tracking-[0.2em] text-[10px] text-gray-400">
              NOW →
            </span>
          </motion.div>
        </div>
      </div>

      {/* ---- 空状态提示 ---- */}
      {timelineNodes.length === 0 && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 20 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="font-light tracking-[0.15em] text-[12px] text-gray-400">
            悬停 DATA 标题并点击 + 添加第一个节点
          </p>
        </motion.div>
      )}

      {/* ---- 添加节点弹窗 ---- */}
      <AnimatePresence>
        {showModal && (
          <AddNodeModal
            onClose={() => setShowModal(false)}
            onSave={handleAddNode}
            albums={albums}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
