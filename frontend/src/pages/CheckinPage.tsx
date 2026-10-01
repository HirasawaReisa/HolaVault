import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FloatingNav } from '../components/layout/FloatingNav';
import { springSnappy, springGentle } from '../lib/motion';
import { checkinApi, type CheckinRecord as ApiCheckinRecord, type ChallengeStats } from '../lib/api';

// ============================================================
// 数据类型（本地视图层）
// ============================================================
interface CheckinRecord {
  day: number;
  img: string;       // 图片 URL（可以是本地 blob 或后端 URL）
  note: string;
}

interface ChallengeState {
  currentDay: number;
  streak: number;
  records: CheckinRecord[];
  missedDays: number[];
}

// Mock 降级初始状态
const fallbackState: ChallengeState = {
  currentDay: 1,
  streak: 0,
  records: [],
  missedDays: [],
};

/** 将 API 返回的 ChallengeStats 转为本地 ChallengeState */
function toLocalState(stats: ChallengeStats): ChallengeState {
  return {
    currentDay: stats.currentDay,
    streak: stats.streak,
    records: stats.records.map(r => ({
      day: r.day,
      img: r.imageUrl || `https://picsum.photos/seed/checkin-${r.day}/200/200`,
      note: r.note || `Day ${r.day}`,
    })),
    missedDays: stats.missedDays,
  };
}

// ============================================================
// 图片上传辅助函数
// ============================================================
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

// ============================================================
// Toggle 切换组件
// ============================================================
function ViewToggle({ isToday, onChange }: { isToday: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="fixed top-5 right-8 z-50">
      <div className="flex items-center gap-1">
        <motion.button
          onClick={() => onChange(true)}
          className="px-4 py-2 font-heading tracking-[0.2em] text-[16px] cursor-pointer transition-colors duration-200"
          style={{
            color: isToday ? '#000' : '#9CA3AF',
            borderBottom: isToday ? '2px solid #000' : '2px solid transparent',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          TODAY
        </motion.button>
        <motion.button
          onClick={() => onChange(false)}
          className="px-4 py-2 font-heading tracking-[0.2em] text-[16px] cursor-pointer transition-colors duration-200"
          style={{
            color: !isToday ? '#000' : '#9CA3AF',
            borderBottom: !isToday ? '2px solid #000' : '2px solid transparent',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          MATRIX
        </motion.button>
      </div>
    </div>
  );
}

// ============================================================
// TODAY 视角 — 今日聚焦打卡
// ============================================================
function TodayView({
  currentDay,
  onStamp,
}: {
  currentDay: number;
  onStamp: (file: File, previewUrl: string, note: string) => void;
}) {
  const [draggedImage, setDraggedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isStamping, setIsStamping] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      setSelectedFile(files[0]);
      setDraggedImage(URL.createObjectURL(files[0]));
    }
  }, []);

  const handleFileSelect = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files[0]) {
        setSelectedFile(files[0]);
        setDraggedImage(URL.createObjectURL(files[0]));
      }
    };
    input.click();
  }, []);

  const handleStamp = () => {
    if (!selectedFile || !draggedImage) return;
    setIsStamping(true);
    // 等动画完成后触发回调
    setTimeout(() => {
      onStamp(selectedFile, draggedImage, noteText || `Day ${currentDay} — 记录`);
    }, 1200);
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <motion.div
        animate={isStamping ? {
          scale: 0.15,
          x: window.innerWidth / 2 - 48,
          y: -(window.innerHeight / 2 - 80),
          opacity: 0,
        } : { scale: 1, x: 0, y: 0, opacity: 1 }}
        transition={isStamping ? {
          type: 'spring',
          stiffness: 120,
          damping: 18,
          mass: 0.8,
        } : springGentle}
        className="w-96 bg-white shadow-lg overflow-hidden"
        style={{ border: '1px solid rgba(0,0,0,0.06)' }}
      >
        {/* 巨大数字排版 */}
        <div className="px-8 pt-10 pb-6">
          <div className="flex items-baseline gap-2">
            <span
              className="font-heading font-black tracking-[0.05em] leading-none"
              style={{ fontSize: '4.5rem', color: '#000' }}
            >
              {currentDay}
            </span>
            <span
              className="font-heading font-light tracking-[0.15em]"
              style={{ fontSize: '1.2rem', color: '#9CA3AF' }}
            >
              / 100
            </span>
          </div>
          <div
            className="font-heading font-light tracking-[0.2em] text-[11px] mt-2"
            style={{ color: '#9CA3AF' }}
          >
            DAY
          </div>
        </div>

        {/* 核心交互区 */}
        {!draggedImage ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleFileSelect}
            className="mx-8 mb-6 border-2 border-dashed cursor-pointer flex items-center justify-center transition-colors duration-200"
            style={{
              borderColor: isDraggingOver ? '#000' : '#D1D5DB',
              height: '240px',
              backgroundColor: isDraggingOver ? 'rgba(0,0,0,0.02)' : 'transparent',
            }}
          >
            <div className="text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="font-light text-sm mt-3" style={{ color: '#9CA3AF', letterSpacing: '0.05em' }}>
                Drop today&apos;s artwork here
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-8 mb-4">
            {/* 图片预览 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={springSnappy}
              className="relative overflow-hidden"
              style={{ height: '240px' }}
            >
              <img
                src={draggedImage}
                alt="Today's artwork"
                className="w-full h-full object-cover"
                draggable={false}
              />
            </motion.div>

            {/* 一句话总结输入框 */}
            <div className="mt-4">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="一句话总结今天的练习…"
                className="w-full bg-transparent text-sm font-light px-0 py-2 outline-none"
                style={{
                  color: '#000',
                  borderBottom: '1px solid #D1D5DB',
                  letterSpacing: '0.02em',
                }}
                onFocus={(e) => {
                  (e.target as HTMLElement).style.borderBottomColor = '#000';
                }}
                onBlur={(e) => {
                  (e.target as HTMLElement).style.borderBottomColor = '#D1D5DB';
                }}
              />
            </div>
          </div>
        )}

        {/* STAMP 按钮 */}
        {draggedImage && !isStamping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSnappy}
            className="mx-8 mb-8"
          >
            <motion.button
              onClick={handleStamp}
              whileHover={{ scale: 1.02, backgroundColor: '#000' }}
              whileTap={{ scale: 0.97 }}
              className="w-full py-3 bg-transparent text-black font-heading tracking-[0.25em] text-[11px] border border-black cursor-pointer transition-colors duration-200"
            >
              [ STAMP TO ARCHIVE ]
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ============================================================
// 打卡详情面板
// ============================================================
function DetailPanel({
  record,
  onClose,
}: {
  record: CheckinRecord;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: '40%', opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 28, mass: 0.8 }}
      className="h-full flex flex-col items-center justify-center p-8 overflow-hidden"
      style={{ backgroundColor: '#F9F9F9' }}
    >
      {/* 关闭按钮 */}
      <motion.button
        onClick={onClose}
        className="absolute top-6 right-4 z-40 p-2 cursor-pointer"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        style={{ color: '#9CA3AF' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </motion.button>

      {/* 画作展示 */}
      <motion.div
        className="relative w-full max-w-lg flex items-center justify-center overflow-hidden"
        style={{
          aspectRatio: '3 / 4',
          backgroundColor: '#F9F9F9',
          top: '20px',
        }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springGentle, delay: 0.15 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={record.day}
            className="w-full h-full flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <img
              src={record.img}
              alt={`Day ${record.day}`}
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* 文字信息 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springGentle, delay: 0.3 }}
        className="mt-6 w-full max-w-lg text-center"
      >
        <div className="flex items-baseline justify-center gap-2">
          <span
            className="font-heading font-black tracking-[0.05em] leading-none"
            style={{ fontSize: '1.8rem', color: '#000'}}
          >
            {record.day}
          </span>
          <span
            className="font-heading font-light tracking-[0.15em]"
            style={{ fontSize: '0.8rem', color: '#9CA3AF' }}
          >
            / 100
          </span>
        </div>
        <div
          className="font-heading font-light tracking-[0.2em] text-[9px] mt-1"
          style={{ color: '#9CA3AF' }}
        >
          DAY
        </div>
        <p
          className="mt-3 font-light text-sm leading-relaxed"
          style={{ color: '#000', letterSpacing: '0.02em' }}
        >
          {record.note}
        </p>
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// MATRIX 视角 — 百日矩阵全景墙
// ============================================================
function MatrixView({
  state,
  selectedDay,
  onSelectDay,
}: {
  state: ChallengeState;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
}) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [isMatrixFading, setIsMatrixFading] = useState(false);

  const recordsMap = new Map(state.records.map(r => [r.day, r]));
  const totalCompleted = state.records.length;

  const getCellType = (day: number): 'completed' | 'missed' | 'future' | 'today' => {
    if (recordsMap.has(day)) return 'completed';
    if (state.missedDays.includes(day)) return 'missed';
    if (day === state.currentDay) return 'today';
    if (day > state.currentDay) return 'future';
    return 'missed';
  };

  const handleCellHover = (day: number, e: React.MouseEvent) => {
    if (getCellType(day) !== 'completed') return;
    setHoveredDay(day);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
  };

  const handleCellLeave = () => {
    setHoveredDay(null);
  };

  const handleCloseDetail = () => {
    setIsMatrixFading(true);
    window.setTimeout(() => {
      onSelectDay(null);
      setIsMatrixFading(false);
    }, 240);
  };

  const handleCellClick = (day: number) => {
    if (getCellType(day) !== 'completed') return;
    if (selectedDay === day) {
      handleCloseDetail();
      return;
    }
    if (selectedDay !== null) {
      onSelectDay(day);
      return;
    }
    setIsMatrixFading(true);
    window.setTimeout(() => {
      onSelectDay(day);
      setIsMatrixFading(false);
    }, 240);
  };

  const isExpanded = selectedDay !== null && recordsMap.has(selectedDay);
  const selectedRecord = isExpanded ? recordsMap.get(selectedDay)! : null;

  return (
    <div className="flex-1 min-h-screen flex items-center justify-center overflow-hidden">
      {/* 左侧详情面板 */}
      <AnimatePresence>
        {isExpanded && selectedRecord && (
          <DetailPanel
            record={selectedRecord}
            onClose={handleCloseDetail}
          />
        )}
      </AnimatePresence>

      {/* 右侧 — 矩阵网格 + 统计 */}
      <motion.div
        animate={{
          width: isExpanded ? '60%' : '100%',
          opacity: isMatrixFading ? 0 : 1,
        }}
        transition={{ type: 'spring', stiffness: 200, damping: 28, mass: 0.8, duration: 0.24 }}
        className="flex min-h-[72vh] flex-col items-center justify-center px-8"
        style={{ maxWidth: '860px', width: '100%' }}
      >
        {/* 10 x 10 网格 — 用 CSS animation 代替 motion.div stagger 减少初始渲染负担 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...springGentle, delay: 0.1 }}
          className="grid grid-cols-10 gap-[2px] mx-auto matrix-grid"
          style={{ width: isExpanded ? '560px' : '680px', maxWidth: '100%', margin: '0 auto' }}
        >
          {/* CSS keyframes for cell fade-in — 轻量替代 framer-motion stagger */}
          <style>{`
            .matrix-cell {
              animation: matrixCellIn 0.4s ease-out both;
              animation-delay: calc(var(--cell-i) * 8ms);
            }
            @keyframes matrixCellIn {
              from { opacity: 0; transform: scale(0.85); }
              to { opacity: 1; transform: scale(1); }
            }
            .matrix-cell-completed:hover {
              transform: scale(1.1);
              z-index: 10;
              transition: transform 0.2s ease-out;
            }
            .matrix-cell {
              transition: transform 0.2s ease-out;
            }
          `}</style>

          {Array.from({ length: 100 }, (_, i) => {
            const day = i + 1;
            const cellType = getCellType(day);
            const record = recordsMap.get(day);
            const isSelected = selectedDay === day;

            return (
              <div
                key={day}
                className={`aspect-square relative matrix-cell ${cellType === 'completed' ? 'matrix-cell-completed' : ''}`}
                style={{
                  '--cell-i': i,
                  cursor: cellType === 'completed' ? 'pointer' : 'default',
                } as React.CSSProperties}
                onMouseEnter={(e) => handleCellHover(day, e)}
                onMouseLeave={handleCellLeave}
                onClick={() => handleCellClick(day)}
              >
                {cellType === 'completed' && record && (
                  <div
                    className="w-full h-full overflow-hidden"
                    style={{
                      backgroundColor: '#000',
                      outline: isSelected ? '2px solid #00D2FF' : 'none',
                      outlineOffset: '-1px',
                    }}
                  >
                    <img
                      src={record.img}
                      alt={`Day ${day}`}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </div>
                )}

                {cellType === 'missed' && (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ backgroundColor: '#FFFFFF' }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 20 20" className="opacity-30">
                        <line x1="3" y1="3" x2="17" y2="17" stroke="#DC2626" strokeWidth="1" />
                        <line x1="17" y1="3" x2="3" y2="17" stroke="#DC2626" strokeWidth="1" />
                      </svg>
                    </div>
                    <span
                      className="font-heading font-light text-[10px] tracking-wider"
                      style={{ color: '#9CA3AF' }}
                    >
                      {day}
                    </span>
                  </div>
                )}

                {cellType === 'today' && (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      backgroundColor: '#000',
                    }}
                  >
                    <span className="font-heading font-black text-[10px] tracking-wider text-white">
                      {day}
                    </span>
                  </div>
                )}

                {cellType === 'future' && (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ backgroundColor: '#EEEEEE' }}
                  >
                    <span
                      className="font-heading font-light text-[10px] tracking-wider"
                      style={{ color: '#D1D5DB' }}
                    >
                      {day}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </motion.div>

        {/* Tooltip */}
        <AnimatePresence>
          {hoveredDay !== null && recordsMap.has(hoveredDay) && hoveredDay !== selectedDay && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: -12 }}
              exit={{ opacity: 0, y: -4 }}
              transition={springSnappy}
              className="fixed px-3 py-2 max-w-[200px] pointer-events-none"
              style={{
                left: tooltipPos.x,
                top: tooltipPos.y,
                transform: 'translateX(-50%)',
                backgroundColor: '#000',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 300,
                letterSpacing: '0.02em',
                lineHeight: '1.4',
                zIndex: 999,
              }}
            >
              <div className="font-heading tracking-[0.15em] text-[9px] mb-1" style={{ color: '#9CA3AF' }}>
                DAY {hoveredDay}
              </div>
              {recordsMap.get(hoveredDay)?.note}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 数据统计面板 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springGentle, delay: 0.5 }}
          className="mt-10 flex items-center gap-8"
        >
          <div className="text-center">
            <div className="font-heading font-light tracking-[0.2em] text-[10px]" style={{ color: '#9CA3AF' }}>
              CURRENT STREAK
            </div>
            <div className="font-heading font-black mt-1" style={{ fontSize: '1.8rem', color: '#000' }}>
              {state.streak} <span className="font-light text-[11px] tracking-wider" style={{ color: '#9CA3AF' }}>DAYS</span>
            </div>
          </div>

          <div className="h-10 w-[1px]" style={{ backgroundColor: '#D1D5DB' }} />

          <div className="text-center">
            <div className="font-heading font-light tracking-[0.2em] text-[10px]" style={{ color: '#9CA3AF' }}>
              TOTAL
            </div>
            <div className="font-heading font-black mt-1" style={{ fontSize: '1.8rem', color: '#000' }}>
              {totalCompleted} <span className="font-light text-[11px] tracking-wider" style={{ color: '#9CA3AF' }}>/ 100</span>
            </div>
          </div>

          <div className="h-10 w-[1px]" style={{ backgroundColor: '#D1D5DB' }} />

          <div className="text-center">
            <div className="font-heading font-light tracking-[0.2em] text-[10px]" style={{ color: '#9CA3AF' }}>
              MISS
            </div>
            <div className="font-heading font-black mt-1" style={{ fontSize: '1.8rem', color: '#DC2626' }}>
              {state.missedDays.length}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ============================================================
// Challenge100Days — 百日绘打卡 主组件
// ============================================================
export function Challenge100Days() {
  const [isTodayView, setIsTodayView] = useState(true);
  const [challengeState, setChallengeState] = useState<ChallengeState>(fallbackState);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialized = useRef(false);

  // 加载挑战状态（从后端 API）
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const loadStats = async () => {
      try {
        setIsLoading(true);
        const stats = await checkinApi.getStats();
        if (stats) {
          setChallengeState(toLocalState(stats));
        }
      } catch (err) {
        console.warn('Checkin API unavailable, using fallback data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  // 打卡处理：上传图片 → 调用 checkin API → 更新本地状态
  const handleStamp = useCallback(async (file: File, previewUrl: string, note: string) => {
    const day = challengeState.currentDay;

    try {
      // 1. 上传图片到后端
      const imageUrl = await uploadImageFile(file);

      // 2. 调用打卡 API
      const result = await checkinApi.checkin(day, imageUrl, note);

      // 3. 更新本地状态
      setChallengeState(prev => {
        const newRecord: CheckinRecord = {
          day: result.day,
          img: imageUrl,
          note: result.note,
        };
        const newStreak = result.streak;
        const newCurrentDay = prev.currentDay + 1;

        return {
          currentDay: newCurrentDay > 100 ? 100 : newCurrentDay,
          streak: newStreak,
          records: [...prev.records, newRecord],
          missedDays: prev.missedDays,
        };
      });
    } catch (err) {
      console.warn('Checkin API failed, saving locally:', err);
      // 降级：本地保存（使用预览 URL）
      setChallengeState(prev => {
        const newRecord: CheckinRecord = {
          day: prev.currentDay,
          img: previewUrl,
          note,
        };
        return {
          currentDay: prev.currentDay + 1 > 100 ? 100 : prev.currentDay + 1,
          streak: prev.streak + 1,
          records: [...prev.records, newRecord],
          missedDays: prev.missedDays,
        };
      });
    }

    // 打卡完成后自动切换到 Matrix 视角
    setIsTodayView(false);
  }, [challengeState.currentDay]);

  // 切换到 TODAY 视角时清空选中
  const handleViewChange = (v: boolean) => {
    setIsTodayView(v);
    if (v) setSelectedDay(null);
  };

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col" style={{ backgroundColor: '#F9F9F9' }}>
      {/* 悬浮导航 */}
      <FloatingNav />

      {/* Toggle 切换 */}
      <ViewToggle isToday={isTodayView} onChange={handleViewChange} />

      {/* 页面标题 */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={springGentle}
        className="fixed top-5 left-20 z-50 flex items-center gap-2"
      >
        <h1
          className="font-heading font-black tracking-[0.15em] leading-none"
          style={{ fontSize: '2.5rem', color: '#000' }}
        >
          100 DAYS
        </h1>
        <div
          className="font-heading font-light tracking-[0.2em] text-[9px] mt-[2px]"
          style={{ color: '#9CA3AF' }}
        >
          CHALLENGE
        </div>
      </motion.div>

      {/* 主内容区 */}
      <AnimatePresence mode="wait">
        {isTodayView ? (
          <motion.div
            key="today"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex items-center justify-center"
          >
            <TodayView currentDay={challengeState.currentDay} onStamp={handleStamp} />
          </motion.div>
        ) : (
          <motion.div
            key="matrix"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={springGentle}
            className="flex-1"
          >
            <MatrixView state={challengeState} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
