import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { FloatingNav } from '../components/layout/FloatingNav';
import { aiApi } from '../lib/api';

// ============================================================
// 设置类型与持久化
// ============================================================

interface LoreSettings {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
}

const DEFAULT_LORE_SETTINGS: LoreSettings = {
  apiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  apiKey: '',
  model: 'glm-4v-flash',
  systemPrompt: `你是一位数字设定集构建引擎，能从一幅画作中提取出完整的世界观设定。

## 你的角色
- 你将收到一幅画作图片和用户的简短描述
- 从画作中解读出：世界观基调、人物侧写、隐秘纪事
- 文字风格应如同墨水渗入羊皮纸——古典、沉浸、细节丰富

## 输出格式
你必须严格输出以下 JSON 格式，不要输出任何其他内容：
[
  {
    "section": "WORLD.BKG",
    "title": "世界观基调",
    "content": "一段沉浸式的世界观描述文字..."
  },
  {
    "section": "CHAR.OBJ",
    "title": "人物侧写",
    "content": "一段生动的人物刻画文字..."
  },
  {
    "section": "STORY.ARC",
    "title": "隐秘纪事",
    "content": "一段叙事性故事片段文字..."
  }
]

每个 section 的 content 应不少于50字，风格统一，细节丰富。`,
};

const LORE_SETTINGS_KEY = 'halovault-lore-settings';

function loadLoreSettings(): LoreSettings {
  try {
    const saved = localStorage.getItem(LORE_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_LORE_SETTINGS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_LORE_SETTINGS };
}

function saveLoreSettings(settings: LoreSettings) {
  localStorage.setItem(LORE_SETTINGS_KEY, JSON.stringify(settings));
}

// ============================================================
// Mock 数据
// ============================================================
const mockLoreData = [
  { section: 'WORLD.BKG', title: '世界观基调', content: '2077年，新底特律。永远被霓虹灯和酸雨笼罩的下城区。这里没有阳光，只有全息广告牌提供的虚假紫外线。' },
  { section: 'CHAR.OBJ', title: '人物侧写', content: "代号 'K'。她不是为了拯救世界而生，只是为了能在黑市换取足够的滤芯芯片。她左臂的机械义肢来自于一个废弃的家政机器人。" },
  { section: 'STORY.ARC', title: '隐秘纪事', content: '雨水打在她的机械臂上，溅出微弱的蓝色火花。那只流浪猫躲在垃圾桶后，似乎是她在这个冰冷城市里唯一的锚点...' },
];

// ============================================================
// 从 AI 返回文本中解析设定集 JSON
// ============================================================
interface LoreItem {
  section: string;
  title: string;
  content: string;
}

function parseLoreFromAiResponse(text: string): LoreItem[] | null {
  // 尝试提取 JSON（AI 可能包裹在 ```json ... ``` 中）
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)```/) ||
    text.match(/\[[\s\S]*"section"[\s\S]*\]/);

  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed.map(
          (item: any): LoreItem => ({
            section: item.section || 'UNKNOWN',
            title: item.title || item.section || '未知',
            content: item.content || '',
          })
        );
      }
    } catch {
      // JSON 解析失败
    }
  }

  // 尝试直接 JSON.parse 整段文本
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map(
        (item: any): LoreItem => ({
          section: item.section || 'UNKNOWN',
          title: item.title || item.section || '未知',
          content: item.content || '',
        })
      );
    }
  } catch {
    // 无法解析
  }

  return null;
}

// ============================================================
// 效预设
// ============================================================
const inkReveal = {
  hidden: { opacity: 0.2, color: '#A3A3A3' },
  visible: (i: number) => ({
    opacity: 1,
    color: '#1A1A1A',
    transition: {
      delay: i * 0.35,
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const sealSpring = {
  type: 'spring',
  stiffness: 500,
  damping: 18,
  mass: 0.6,
};

const springSnappy = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 28,
  mass: 0.7,
};

const springGentle = {
  type: 'spring' as const,
  stiffness: 150,
  damping: 18,
  mass: 0.8,
};

// ============================================================
// 设置弹窗 — 参考 AI 点评页 SettingsModal 样式
// ============================================================

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block font-heading text-[10px] tracking-widest mb-2"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function LoreSettingsModal({
  settings,
  onSave,
  onClose,
}: {
  settings: LoreSettings;
  onSave: (s: LoreSettings) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<LoreSettings>({ ...settings });

  const handleSave = () => {
    saveLoreSettings(form);
    onSave(form);
    onClose();
  };

  const updateField = <K extends keyof LoreSettings>(key: K, value: LoreSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* 遮罩 */}
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* 弹窗主体 */}
      <motion.div
        className="relative z-10 w-full max-w-2xl mx-4 rounded-2xl overflow-hidden"
        style={{
          backgroundColor: '#FFFFFF',
          boxShadow: '0 25px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        }}
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ ...springGentle, stiffness: 200 }}
      >
        {/* 顶部标题栏 */}
        <div
          className="flex items-center justify-between px-8 py-5"
          style={{ borderBottom: '1px solid var(--border-primary)' }}
        >
          <h3
            className="font-heading font-black text-lg tracking-widest"
            style={{ color: 'var(--text-primary)' }}
          >
            LORE SETTINGS
          </h3>
          <motion.button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--text-muted)' }}
            whileHover={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
            whileTap={{ scale: 0.9 }}
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </motion.button>
        </div>

        {/* 标签切换 */}
        <div
          className="flex gap-0 px-8 pt-5"
          style={{ borderBottom: '1px solid var(--border-primary)' }}
        >
          {(
            [
              ['api', 'API 配置'],
              ['prompt', '设定提示词'],
            ] as const
          ).map(([key, label]) => {
            // 用局部 state 管理内部标签（简化版只有两个 tab）
            const [activeTab, setActiveTab] = useState<'api' | 'prompt'>('api');
            // 注意：useState 在 map callback 中不适合，改为顶层管理
            // 这里用重构方式
            return null; // placeholder, 实际实现见下方
          })}
        </div>

        {/* 实际标签切换 + 内容区 */}
        <LoreSettingsContent form={form} updateField={updateField} />

        {/* 底部操作栏 */}
        <div
          className="flex items-center justify-end gap-3 px-8 py-5"
          style={{ borderTop: '1px solid var(--border-primary)' }}
        >
          <motion.button
            onClick={onClose}
            className="px-6 py-2.5 font-heading text-xs tracking-widest rounded-lg"
            style={{
              border: '1px solid var(--border-primary)',
              color: 'var(--text-muted)',
              backgroundColor: 'transparent',
            }}
            whileHover={{ borderColor: '#00D2FF', color: '#00D2FF' }}
            whileTap={{ scale: 0.97 }}
          >
            取消
          </motion.button>
          <motion.button
            onClick={handleSave}
            className="px-6 py-2.5 font-heading text-xs tracking-widest rounded-lg"
            style={{
              backgroundColor: '#00D2FF',
              color: '#FFFFFF',
              boxShadow: '0 0 16px rgba(0, 210, 255, 0.15)',
            }}
            whileHover={{ boxShadow: '0 0 24px rgba(0, 210, 255, 0.25)' }}
            whileTap={{ scale: 0.97 }}
          >
            保存设置
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** 设置弹窗内容区（标签切换 + 表单） */
function LoreSettingsContent({
  form,
  updateField,
}: {
  form: LoreSettings;
  updateField: <K extends keyof LoreSettings>(key: K, value: LoreSettings[K]) => void;
}) {
  const [activeTab, setActiveTab] = useState<'api' | 'prompt'>('api');

  return (
    <>
      {/* 标签切换 */}
      <div
        className="flex gap-0 px-8 pt-5"
        style={{ borderBottom: '1px solid var(--border-primary)' }}
      >
        {(
          [
            ['api', 'API 配置'],
            ['prompt', '设定提示词'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="relative px-5 py-3 font-heading text-xs tracking-widest transition-colors"
            style={{
              color: activeTab === key ? '#00D2FF' : 'var(--text-muted)',
            }}
          >
            {label}
            {activeTab === key && (
              <motion.div
                layoutId="lore-settings-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{ backgroundColor: '#00D2FF' }}
                transition={springSnappy}
              />
            )}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="px-8 py-6 max-h-[55vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* API 配置 */}
          {activeTab === 'api' && (
            <motion.div
              key="api-tab"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <FieldGroup label="BASE URL">
                <input
                  type="text"
                  value={form.apiBaseUrl}
                  onChange={(e) => updateField('apiBaseUrl', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm font-light outline-none"
                  style={{
                    border: '1px solid var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary, #F9F9F9)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="https://open.bigmodel.cn/api/paas/v4"
                />
              </FieldGroup>
              <FieldGroup label="API KEY">
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => updateField('apiKey', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm font-light outline-none"
                  style={{
                    border: '1px solid var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary, #F9F9F9)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="输入你的 API Key"
                />
              </FieldGroup>
              <FieldGroup label="MODEL">
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => updateField('model', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm font-light outline-none"
                  style={{
                    border: '1px solid var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary, #F9F9F9)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="glm-4v-flash"
                />
              </FieldGroup>
              <p className="font-light text-xs" style={{ color: 'var(--text-muted)' }}>
                {form.apiKey
                  ? '✓ API Key 已配置'
                  : '⚠ 尚未配置 API Key，将使用 Mock 数据进行演示'}
              </p>
            </motion.div>
          )}

          {/* 设定提示词 */}
          {activeTab === 'prompt' && (
            <motion.div
              key="prompt-tab"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <FieldGroup label="SYSTEM PROMPT（系统提示词）">
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) => updateField('systemPrompt', e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 rounded-lg text-sm font-light outline-none resize-y"
                  style={{
                    border: '1px solid var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary, #F9F9F9)',
                    color: 'var(--text-primary)',
                    minHeight: 200,
                  }}
                />
              </FieldGroup>
              <p className="font-light text-xs" style={{ color: 'var(--text-muted)' }}>
                设定扩展：AI 接收画作图片 + 用户描述文字，按系统提示词生成世界观、人物侧写、隐秘纪事三段设定
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// ============================================================
// LoreSection — 墨水显影区块
// ============================================================
function LoreSection({
  section,
  title,
  content,
  index,
  isLast,
}: {
  section: string;
  title: string;
  content: string;
  index: number;
  isLast: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      custom={index}
      variants={inkReveal}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      className={isLast ? 'pt-10' : 'border-t border-gray-200 pt-10 pb-12'}
    >
      {/* 区段标记 */}
      <div className="flex items-baseline gap-3 mb-4">
        <span
          className="font-heading font-black tracking-[0.25em] text-[10px]"
          style={{ color: '#00D2FF' }}
        >
          {section}
        </span>
        <span className="text-gray-300 text-[10px]">—</span>
        <span className="font-heading font-black text-base tracking-wide" style={{ color: 'inherit' }}>
          {title}
        </span>
      </div>

      {/* 正文 */}
      <p className="font-light leading-[2] text-[15px] text-gray-800" style={{ color: 'inherit', wordBreak: 'break-word' }}>
        {content}
      </p>
    </motion.div>
  );
}

// ============================================================
// WaxSealButton — 火漆保存印章
// ============================================================
function WaxSealButton() {
  const [saved, setSaved] = useState(false);

  const handleClick = useCallback(() => {
    if (saved) return;
    setSaved(true);
  }, [saved]);

  return (
    <motion.button
      onClick={handleClick}
      className="flex items-center gap-2 cursor-pointer focus-ring select-none"
      initial={{ opacity: 0.6 }}
      animate={{ opacity: 1 }}
      whileHover={!saved ? { scale: 1.03 } : {}}
      whileTap={!saved ? { scale: 0.97 } : {}}
    >
      <AnimatePresence mode="wait">
        {saved ? (
          <motion.div
            key="seal"
            initial={{ scale: 2.2, opacity: 0 }}
            animate={{ scale: [2.2, 0.85, 1.05, 1], opacity: 1 }}
            transition={sealSpring}
            className="flex items-center gap-2"
          >
            {/* 火漆印章 SVG */}
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" fill="#8B2252" stroke="#5A1535" strokeWidth="1" />
              <circle cx="14" cy="14" r="9" fill="#A0324B" />
              <path d="M10 10L14 6L18 10L14 14L10 10Z" fill="#C4505A" opacity="0.7" />
              <path d="M10 18L14 14L18 18L14 22L10 18Z" fill="#C4505A" opacity="0.7" />
            </svg>
            <span
              className="font-heading font-black tracking-[0.2em] text-[11px]"
              style={{ color: '#8B2252' }}
            >
              SAVED
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="default"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            <span className="font-heading tracking-[0.2em] text-[10px] text-gray-400">
              SAVE TO ARCHIVE
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ============================================================
// LoreHeader — 标题组件（含悬停上传按钮 + 设置按钮）
// ============================================================
function LoreHeader({ onUpload, onOpenSettings }: { onUpload: () => void; onOpenSettings: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative"
    >
      <div>
        <h1
          className="font-heading font-black tracking-[0.15em] leading-[1.1]"
          style={{ fontSize: 'clamp(3rem, 6vw, 5rem)', color: '#0A0A0A' }}
        >
          LORE
        </h1>
        <div className="flex items-baseline gap-4 mt-1">
          <h1
            className="font-heading font-black tracking-[0.15em] leading-[1.1]"
            style={{ fontSize: 'clamp(3rem, 6vw, 5rem)', color: '#0A0A0A' }}
          >
            & ARCHIVES
          </h1>

          {/* 悬停时弹出：上传按钮 + 设置按钮 */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={springSnappy}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
              >
                {/* 上传按钮 */}
                <motion.button
                  onClick={onUpload}
                  whileHover={{ opacity: 1, scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  className="flex items-center gap-2 cursor-pointer flex-shrink-0"
                  style={{ opacity: 0.5 }}
                  aria-label="上传画作"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span className="font-heading tracking-[0.15em] text-[10px] text-gray-500">
                    UPLOAD
                  </span>
                </motion.button>

                {/* 设置按钮 — 齿轮图标 */}
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSettings();
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-muted)',
                  }}
                  whileHover={{
                    borderColor: '#00D2FF',
                    color: '#00D2FF',
                    boxShadow: '0 0 12px rgba(0, 210, 255, 0.08)',
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 品牌色极细下划线 */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '120px' }}
          transition={{ delay: 0.5, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="h-[1px] mt-6"
          style={{ backgroundColor: '#00D2FF' }}
        />
      </div>
    </motion.div>
  );
}

// ============================================================
// LoreBuilderSpread — 数字设定集扩展室
// ============================================================
export function LoreBuilderSpread() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');
  const [loreData, setLoreData] = useState<LoreItem[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState<LoreSettings>(loadLoreSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 上传图片 — 本地预览 + 保留原始 File 对象用于后端上传
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setImageUrl(localUrl);
    setUploadedFile(file);
    setUploadedImageUrl(null); // 之前上传的 URL 已失效
    setErrorMsg(null);
  }, []);

  // 生成设定 — 真实 AI 调用 + 降级 Mock
  const handleGenerate = useCallback(async () => {
    if (!imageUrl && !promptText) return;
    setIsGenerating(true);
    setLoreData(null);
    setErrorMsg(null);

    // ── 无 API Key → Mock 模式 ──
    if (!settings.apiKey) {
      setTimeout(() => {
        setLoreData(mockLoreData);
        setIsGenerating(false);
        setErrorMsg('⚠ 未配置 API Key，显示 Mock 示例数据');
      }, 1500);
      return;
    }

    // ── 真实 API 调用 ──
    try {
      // 1. 如果有本地文件且尚未上传，先上传到后端获取可访问 URL
      let aiImageUrl: string | null = uploadedImageUrl;
      if (uploadedFile && !aiImageUrl) {
        try {
          aiImageUrl = await aiApi.uploadImage(uploadedFile);
          setUploadedImageUrl(aiImageUrl);
        } catch (uploadErr) {
          console.error('图片上传失败:', uploadErr);
          // 上传失败不阻断，尝试直接用 picsum 占位图 URL
          aiImageUrl = 'https://picsum.photos/seed/lore-expand/800/1200';
        }
      }
      // 如果没有上传文件，使用 picsum 默认图（如果 imageUrl 是本地 blob 则用默认 picsum）
      if (!aiImageUrl && imageUrl && imageUrl.startsWith('blob:')) {
        aiImageUrl = 'https://picsum.photos/seed/lore-expand/800/1200';
      } else if (!aiImageUrl) {
        aiImageUrl = imageUrl || 'https://picsum.photos/seed/lore-expand/800/1200';
      }

      // 2. 构建 OpenAI 兼容请求
      const userMessage: any = imageUrl
        ? {
            role: 'user',
            contentParts: [
              { type: 'text', text: promptText || '请为这幅画作生成完整的世界观设定集。' },
              { type: 'image_url', imageUrl: { url: aiImageUrl } },
            ],
          }
        : {
            role: 'user',
            content: promptText || '请生成一个赛博朋克世界观设定集。',
          };

      // 3. 调用非流式 AI API，将前端设置面板的配置随请求透传给后端
      const aiResponseText = await aiApi.completeChat(
        [userMessage],
        settings.systemPrompt,
        {
          apiKey: settings.apiKey,
          apiBaseUrl: settings.apiBaseUrl,
          model: settings.model,
        }
      );

      // 4. 解析 JSON
      const parsed = parseLoreFromAiResponse(aiResponseText);
      if (parsed && parsed.length > 0) {
        setLoreData(parsed);
      } else {
        // AI 返回的 JSON 无法解析 → 尝试将整段文本拆为单个 section
        setLoreData([
          {
            section: 'AI.RAW',
            title: 'AI 原始回复',
            content: aiResponseText,
          },
        ]);
        setErrorMsg('⚠ AI 返回格式不符合预期，显示原始文本');
      }
    } catch (err: any) {
      console.error('AI 生成失败，降级到 Mock 数据:', err);
      setLoreData(mockLoreData);
      setErrorMsg(`⚠ AI 请求失败: ${err.message || '未知错误'}，显示 Mock 示例数据`);
    } finally {
      setIsGenerating(false);
    }
  }, [imageUrl, promptText, uploadedFile, uploadedImageUrl, settings]);

  const displayImage = imageUrl || 'https://picsum.photos/seed/lore-expand/800/1200';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 悬浮导航 */}
      <FloatingNav />

      {/* ============================================================
          左侧页：双层自适应画布 (Left Page)
          ============================================================ */}
      <div className="relative w-1/2 h-full overflow-hidden bg-[#121212] flex items-center justify-center flex-shrink-0">

        {/* 1. 底层：高斯模糊环境光衬底（负责无缝撑满） */}
        <img
          src={displayImage}
          alt="Background Blur"
          className="absolute inset-0 w-full h-full object-cover filter blur-2xl scale-120 opacity-100 select-none pointer-events-none"
          draggable={false}
        />

        {/* 2. 装饰层：极简的微弱网格，增加细节质感 */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255, 255, 255, 0.03)_1px,transparent_0)] bg-[size:16px_16px] pointer-events-none" />

        {/* 3. 表层：原图完整悬浮展示（不裁剪、带阴影） */}
        <div className="relative w-full h-full p-12 flex items-center justify-center z-10">
          <img
            src={displayImage}
            alt="Artwork Original"
            className="max-w-full max-h-full object-contain rounded-sm border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            draggable={false}
          />
        </div>

        {/* 4. 底部输入框与渐变遮罩层 */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-20 p-8 flex flex-col justify-end">
          {/* 隐藏的文件上传 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex items-end gap-3">
            {/* 极简白色输入框 */}
            <input
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="赛博朋克，雨夜…"
              className="flex-1 bg-white/10 backdrop-blur-md text-white placeholder-white/40 font-light text-sm px-4 py-2.5 border border-white/20 rounded-none outline-none focus:border-white/50 transition-colors duration-200"
              style={{ letterSpacing: '0.02em' }}
            />
            {/* GENERATE LORE 按钮 */}
            <motion.button
              onClick={handleGenerate}
              whileHover={{ scale: 1.02, borderColor: 'rgba(0,210,255,0.6)' }}
              whileTap={{ scale: 0.97 }}
              disabled={isGenerating}
              className="flex-shrink-0 bg-transparent text-white font-heading tracking-[0.25em] text-[11px] px-5 py-2.5 border border-white/30 rounded-none cursor-pointer transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'GENERATING…' : 'GENERATE LORE'}
            </motion.button>
          </div>
        </div>
      </div>

      {/* ============================================================
          右侧页：设定集文字展示区
          ============================================================ */}
      <div className="w-1/2 h-full bg-[#FCFCFC] p-16 overflow-y-auto flex flex-col justify-between flex-shrink-0 relative"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* 隐藏滚动条 (WebKit) */}
        <style>{`
          .lore-scroll::-webkit-scrollbar { display: none; }
        `}</style>

        {/* 上半区：标题 + 内容 */}
        <div className="flex-1">
          {/* 标题组件（含悬停上传按钮 + 设置按钮） */}
          <LoreHeader
            onUpload={() => fileInputRef.current?.click()}
            onOpenSettings={() => setShowSettings(true)}
          />

          {/* 生成中状态 */}
          <AnimatePresence>
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-16 flex items-center gap-3 text-gray-400"
              >
                <div className="ai-pulse" />
                <span className="font-heading tracking-[0.2em] text-[11px]">
                  RECONSTRUCTING LORE…
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 错误提示 */}
          <AnimatePresence>
            {errorMsg && !isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="mt-4 px-4 py-2.5 rounded-lg text-xs font-light"
                style={{
                  backgroundColor: 'rgba(0, 210, 255, 0.08)',
                  color: '#00D2FF',
                  border: '1px solid rgba(0, 210, 255, 0.2)',
                }}
              >
                {errorMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 设定文本卡片 */}
          <AnimatePresence>
            {loreData && !isGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="mt-16"
              >
                {loreData.map((item, i) => (
                  <LoreSection
                    key={item.section}
                    section={item.section}
                    title={item.title}
                    content={item.content}
                    index={i}
                    isLast={i === loreData.length - 1}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 空状态提示 */}
          {!loreData && !isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="mt-20"
            >
              <p className="font-light text-sm leading-[2] text-gray-400">
                Upload your artwork on the left, describe the world you envision, then hit GENERATE LORE.
              </p>
              <p className="font-light text-sm leading-[2] mt-3 text-gray-400">
                The AI will unfold a complete lorebook — world background, character profiles, hidden story arcs — as if ink bleeding through parchment.
              </p>
            </motion.div>
          )}
        </div>

        {/* 下半区：火漆保存印章 */}
        <div className="flex justify-end pt-8">
          {loreData && !isGenerating && <WaxSealButton />}
        </div>
      </div>

      {/* 设置弹窗 */}
      <AnimatePresence>
        {showSettings && (
          <LoreSettingsModal
            settings={settings}
            onSave={setSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default LoreBuilderSpread;
