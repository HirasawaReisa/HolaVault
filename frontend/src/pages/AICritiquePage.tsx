import { useState, useRef, useEffect, useCallback } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';
import { AppLayout } from '../components/layout';
import { critiqueApi, aiApi, type CritiqueArtworkDTO } from '../lib/api';

/**
 * AI 点评工作台 (/ai-critique)
 * 极简画廊案头 · 扫描仪式感 · 空间联动交互
 *
 * 设计系统：
 * - 整体氛围：极简现代画廊案头，大面积留白
 * - 背景：极光白 #F9F9F9
 * - 色彩克制：日常仅黑白灰，AI 介入时电光蓝 #00D2FF
 * - 排版：标题 tracking-widest font-black，正文 font-light
 */

// ======== 类型定义 ========

interface Marker {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Advice {
  id: string;
  text: string;
  marker: Marker;
}

interface Dimension {
  id: string;
  dimension: string;
  title: string;
  advice: Advice[];
}

interface Artwork {
  id: string;        // 前端侧: "critique-{dbId}" 或临时 "temp-{timestamp}"
  dbId: number | null; // 后端数据库 ID，null 表示尚未保存
  src: string;
  title: string;
  savedRulesResult: Dimension[] | null;    // 已保存的规则分析
  savedCustomMessages: ChatMessage[] | null; // 已保存的自定义对话
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** 设置配置 */
interface AiSettings {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  rulesSystemPrompt: string;
  rulesUserPrompt: string;
  customSystemPrompt: string;
}

// ======== 默认配置与持久化 ========

const DEFAULT_SETTINGS: AiSettings = {
  apiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  apiKey: '',
  model: 'glm-4v-flash',
  rulesSystemPrompt: `你是一位世界级艺术评论家与AI美学分析引擎。你将根据五大维度对画作进行专业点评。

## 五大分析维度
1. **ANATOMY（骨架成型）**：构图、人体/物体比例、空间结构、透视准确性
2. **LIGHT（光影塑造）**：光源逻辑、明暗关系、光影氛围、体积感
3. **COLOR（色彩和谐）**：色温搭配、冷暖对比、饱和度平衡、色彩叙事
4. **TEXTURE（笔触肌理）**：笔触密度、材质表现、虚实层次、肌理节奏
5. **EMOTION（情感表达）**：情绪传达、叙事张力、视觉引导、观者共鸣

## 输出格式要求
你必须严格输出以下 JSON 格式，不要输出任何其他内容：
\`\`\`json
{
  "dimensions": [
    {
      "dimension": "ANATOMY",
      "title": "骨架成型",
      "advice": [
        {
          "text": "具体的改进建议",
          "marker": { "x": 42, "y": 20, "width": 16, "height": 22 }
        }
      ]
    }
  ]
}
\`\`\`

其中 marker 的 x, y, width, height 均为百分比值（0-100），表示建议关注区域在画作中的位置和大小。
每个维度至少1条建议，至多2条。分析应专业、具体、具有可操作性。`,
  rulesUserPrompt: '请对这幅画作进行五大维度的专业AI美学分析。',
  customSystemPrompt: `你是一位亲切而专业的AI艺术助手，正在与用户一对一交流关于画作的想法。

## 你的角色
- 你可以看到用户上传的画作
- 基于你对艺术的专业理解，回应用户的问题和想法
- 给出具体、有启发性的建议
- 语气友好但专业，像一位艺术导师

## 注意事项
- 回复应当自然流畅，不要使用 markdown 标题或列表格式
- 引用画作中的具体细节来支撑你的观点
- 如果用户的问题模糊，主动引导他们关注特定方面`,
};

const SETTINGS_KEY = 'halovault-ai-settings';

function loadSettings(): AiSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: AiSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// 打字机文本
const TYPING_LINES = [
  'Analyzing dimensions...',
  'Loading neural aesthetic vectors...',
  'Mapping spatial composition...',
  'Evaluating chromatic harmony...',
  'Assessing emotional resonance...',
];

// ======== 弹簧过渡预设 ========

const springMarker = {
  type: 'spring' as const,
  stiffness: 200,
  damping: 22,
  mass: 0.8,
};
const springGentle = {
  type: 'spring' as const,
  stiffness: 150,
  damping: 18,
  mass: 0.8,
};
const springAccordion = {
  type: 'spring' as const,
  stiffness: 220,
  damping: 26,
  mass: 0.7,
};
const springSnappy = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 28,
  mass: 0.6,
};

// ======== AI 服务函数 ========

/** 规则模式：发送图片，非流式获取完整结果后解析为五大维度 JSON */
async function fetchRulesAnalysis(
  imageUrl: string,
  settings: AiSettings
): Promise<Dimension[]> {
  const messages = [
    {
      role: 'system',
      content: settings.rulesSystemPrompt,
    },
    {
      role: 'user',
      contentParts: [
        { type: 'text', text: settings.rulesUserPrompt },
        { type: 'image_url', imageUrl: { url: imageUrl } },
      ],
    },
  ];

  // 将前端设置面板的 API 配置随请求透传给后端
  const body: Record<string, any> = { messages, stream: false };
  if (settings.apiKey) body.apiKey = settings.apiKey;
  if (settings.apiBaseUrl) body.apiBaseUrl = settings.apiBaseUrl;
  if (settings.model) body.model = settings.model;

  const res = await fetch('/api/chat/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    try {
      const errJson = await res.json();
      throw new Error(errJson.message || `API 返回 ${res.status}`);
    } catch {
      throw new Error(`API 返回 ${res.status}`);
    }
  }

  const json = await res.json();
  if (json.code !== 200) throw new Error(json.message || 'AI 请求失败');
  const text = json.data || json.content || JSON.stringify(json);
  return parseDimensionsFromAiResponse(text);
}

/** 自定义模式：发送图片+历史消息，流式接收回复 */
async function fetchCustomChatStream(
  imageUrl: string | null,
  userText: string,
  history: ChatMessage[],
  settings: AiSettings,
  onToken: (token: string) => void
): Promise<string> {
  const messages: any[] = [
    { role: 'system', content: settings.customSystemPrompt },
  ];

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.text });
  }

  if (imageUrl) {
    messages.push({
      role: 'user',
      contentParts: [
        { type: 'text', text: userText },
        { type: 'image_url', imageUrl: { url: imageUrl } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: userText });
  }

  const body: Record<string, any> = { messages, stream: true };
  if (settings.apiKey) body.apiKey = settings.apiKey;
  if (settings.apiBaseUrl) body.apiBaseUrl = settings.apiBaseUrl;
  if (settings.model) body.model = settings.model;

  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`API 返回 ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');

  const decoder = new TextDecoder();
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = line.slice(5);
        if (data && data !== '[DONE]') {
          fullContent += data;
          onToken(data);
        }
      }
    }
  }

  return fullContent;
}

/** 从 AI 返回文本中解析出五维度数据 */
function parseDimensionsFromAiResponse(text: string): Dimension[] {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ||
    text.match(/\{[\s\S]*"dimensions"[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      if (parsed.dimensions && Array.isArray(parsed.dimensions)) {
        return parsed.dimensions.map(
          (dim: any, index: number): Dimension => ({
            id: `dim-${index + 1}`,
            dimension: dim.dimension || 'UNKNOWN',
            title: dim.title || dim.dimension || '未知',
            advice: (dim.advice || []).map(
              (adv: any, advIdx: number): Advice => ({
                id: `adv-${index + 1}-${advIdx + 1}`,
                text: adv.text || '',
                marker: adv.marker || {
                  x: 10 + Math.random() * 60,
                  y: 10 + Math.random() * 60,
                  width: 15 + Math.random() * 15,
                  height: 15 + Math.random() * 20,
                },
              })
            ),
          })
        );
      }
    } catch {
      // JSON 解析失败
    }
  }

  // 解析失败返回空数组（不再回退到 Mock）
  return [];
}

/** 从数据库 DTO 转换为前端 Artwork 格式，并解析已保存的点评数据 */
function dtoToArtwork(dto: CritiqueArtworkDTO): Artwork {
  let savedRulesResult: Dimension[] | null = null;
  if (dto.rulesResult && dto.rulesResult.trim()) {
    try {
      savedRulesResult = JSON.parse(dto.rulesResult);
    } catch {
      savedRulesResult = null;
    }
  }

  let savedCustomMessages: ChatMessage[] | null = null;
  if (dto.customMessages && dto.customMessages.trim()) {
    try {
      savedCustomMessages = JSON.parse(dto.customMessages);
    } catch {
      savedCustomMessages = null;
    }
  }

  return {
    id: `critique-${dto.id}`,
    dbId: dto.id,
    src: dto.imageUrl,
    title: dto.title || '未命名',
    savedRulesResult,
    savedCustomMessages,
  };
}

// ======== 扫描激光线组件 ========

function ScanLaser({ topPercent }: { topPercent: ReturnType<typeof useTransform<string>> }) {
  return (
    <motion.div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: topPercent }}
    >
      <div
        className="w-full h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, #00D2FF 15%, #00D2FF 85%, transparent 100%)',
          boxShadow:
            '0 0 8px 2px rgba(0, 210, 255, 0.5), 0 0 24px 4px rgba(0, 210, 255, 0.15)',
        }}
      />
      <div
        className="w-full h-[12px] -mt-[6px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(0, 210, 255, 0.06) 15%, rgba(0, 210, 255, 0.06) 85%, transparent 100%)',
        }}
      />
    </motion.div>
  );
}

// ======== 标记框组件 ========

function MarkerOverlay({
  marker,
  activeMarkerId,
  adviceId,
}: {
  marker: Marker;
  activeMarkerId: string | null;
  adviceId: string;
}) {
  const isActive = activeMarkerId === adviceId;

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          layoutId="ai-marker"
          className="absolute rounded-xl pointer-events-none z-10"
          style={{
            left: `${marker.x}%`,
            top: `${marker.y}%`,
            width: `${marker.width}%`,
            height: `${marker.height}%`,
            border: '1.5px dashed #00D2FF',
            backgroundColor: 'rgba(0, 210, 255, 0.07)',
            boxShadow:
              '0 0 12px 2px rgba(0, 210, 255, 0.12), inset 0 0 12px 2px rgba(0, 210, 255, 0.04)',
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={springMarker}
        >
          {(
            [
              ['-top-1', '-left-1'],
              ['-top-1', '-right-1'],
              ['-bottom-1', '-left-1'],
              ['-bottom-1', '-right-1'],
            ] as const
          ).map(([y, x], i) => (
            <span
              key={i}
              className={`absolute ${y} ${x} w-2 h-2 rounded-full`}
              style={{
                backgroundColor: '#00D2FF',
                boxShadow: '0 0 4px rgba(0, 210, 255, 0.6)',
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ======== 打字机效果组件 ========

function TypingEffect({ lines, isPlaying }: { lines: string[]; isPlaying: boolean }) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentLineIdx, setCurrentLineIdx] = useState(0);
  const [currentCharIdx, setCurrentCharIdx] = useState(0);

  useEffect(() => {
    if (!isPlaying) {
      setDisplayedText('');
      setCurrentLineIdx(0);
      setCurrentCharIdx(0);
      return;
    }

    if (currentLineIdx >= lines.length) return;

    const line = lines[currentLineIdx];
    if (currentCharIdx < line.length) {
      const timer = setTimeout(() => {
        setDisplayedText((prev) => prev + line[currentCharIdx]);
        setCurrentCharIdx((prev) => prev + 1);
      }, 35 + Math.random() * 25);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setDisplayedText((prev) => prev + '\n');
        setCurrentLineIdx((prev) => prev + 1);
        setCurrentCharIdx(0);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, currentLineIdx, currentCharIdx, lines]);

  return (
    <div
      className="font-mono text-sm"
      style={{ color: '#00D2FF', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}
    >
      {displayedText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
        className="inline-block w-[2px] h-4 ml-0.5 align-middle"
        style={{ backgroundColor: '#00D2FF' }}
      />
    </div>
  );
}

// ======== 手风琴维度卡片 ========

function DimensionCard({
  dimension,
  index,
  isExpanded,
  onToggle,
  onAdviceHover,
  activeMarkerId,
}: {
  dimension: Dimension;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onAdviceHover: (adviceId: string | null) => void;
  activeMarkerId: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springGentle, delay: index * 0.08 }}
    >
      <div
        className="h-[0.5px] w-full"
        style={{ backgroundColor: 'var(--border-primary)' }}
      />

      <motion.button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 px-1 text-left group"
        whileTap={{ scale: 0.995 }}
      >
        <div className="flex items-center gap-4">
          <span
            className="font-heading text-xs tracking-widest"
            style={{ color: isExpanded ? '#00D2FF' : 'var(--text-muted)' }}
          >
            [{dimension.dimension}]
          </span>
          <span
            className="font-heading font-black text-base tracking-wide"
            style={{
              color: isExpanded ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {dimension.title}
          </span>
        </div>
        <motion.svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={springGentle}
          style={{ color: 'var(--text-muted)', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </motion.button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springAccordion}
            className="overflow-hidden"
          >
            <div className="pb-5 pl-1">
              {dimension.advice.map((adv) => (
                <motion.div
                  key={adv.id}
                  onMouseEnter={() => onAdviceHover(adv.id)}
                  onMouseLeave={() => onAdviceHover(null)}
                  className="flex items-start gap-3 py-3 px-3 -mx-3 rounded-lg cursor-default"
                  whileHover={{
                    backgroundColor: 'rgba(0, 210, 255, 0.04)',
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    className="w-[2px] rounded-full flex-shrink-0 mt-0.5"
                    style={{
                      backgroundColor:
                        activeMarkerId === adv.id
                          ? '#00D2FF'
                          : 'var(--border-primary)',
                      minHeight: 32,
                      boxShadow:
                        activeMarkerId === adv.id
                          ? '0 0 6px rgba(0, 210, 255, 0.4)'
                          : 'none',
                    }}
                    animate={{
                      opacity: activeMarkerId === adv.id ? 1 : 0.5,
                    }}
                    transition={springGentle}
                  />
                  <p
                    className="font-light text-sm leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {adv.text}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ======== 设置弹窗组件 ========

function SettingsModal({
  settings,
  onSave,
  onClose,
}: {
  settings: AiSettings;
  onSave: (s: AiSettings) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AiSettings>({ ...settings });
  const [activeTab, setActiveTab] = useState<'api' | 'rules' | 'custom'>('api');

  const handleSave = () => {
    saveSettings(form);
    onSave(form);
    onClose();
  };

  const updateField = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
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
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

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
        <div
          className="flex items-center justify-between px-8 py-5"
          style={{ borderBottom: '1px solid var(--border-primary)' }}
        >
          <h3
            className="font-heading font-black text-lg tracking-widest"
            style={{ color: 'var(--text-primary)' }}
          >
            SETTINGS
          </h3>
          <motion.button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--text-muted)' }}
            whileHover={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
            whileTap={{ scale: 0.9 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </motion.button>
        </div>

        <div
          className="flex gap-0 px-8 pt-5"
          style={{ borderBottom: '1px solid var(--border-primary)' }}
        >
          {(['api', '规则提示词', '自定义提示词'] as const).map((key, idx) => {
            const tabKey = idx === 0 ? 'api' : idx === 1 ? 'rules' : 'custom';
            const label = key === 'api' ? 'API 配置' : key;
            return (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey as any)}
                className="relative px-5 py-3 font-heading text-xs tracking-widest transition-colors"
                style={{
                  color: activeTab === tabKey ? '#00D2FF' : 'var(--text-muted)',
                }}
              >
                {label}
                {activeTab === tabKey && (
                  <motion.div
                    layoutId="settings-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ backgroundColor: '#00D2FF' }}
                    transition={springSnappy}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="px-8 py-6 max-h-[55vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'api' && (
              <motion.div key="api-tab" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
                <FieldGroup label="BASE URL">
                  <input type="text" value={form.apiBaseUrl} onChange={(e) => updateField('apiBaseUrl', e.target.value)} className="w-full px-4 py-3 rounded-lg text-sm font-light outline-none" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary, #F9F9F9)', color: 'var(--text-primary)' }} placeholder="https://open.bigmodel.cn/api/paas/v4" />
                </FieldGroup>
                <FieldGroup label="API KEY">
                  <input type="password" value={form.apiKey} onChange={(e) => updateField('apiKey', e.target.value)} className="w-full px-4 py-3 rounded-lg text-sm font-light outline-none" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary, #F9F9F9)', color: 'var(--text-primary)' }} placeholder="输入你的 API Key" />
                </FieldGroup>
                <FieldGroup label="MODEL">
                  <input type="text" value={form.model} onChange={(e) => updateField('model', e.target.value)} className="w-full px-4 py-3 rounded-lg text-sm font-light outline-none" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary, #F9F9F9)', color: 'var(--text-primary)' }} placeholder="glm-4v-flash" />
                </FieldGroup>
                <p className="font-light text-xs" style={{ color: 'var(--text-muted)' }}>
                  {form.apiKey ? '✓ API Key 已配置' : '⚠ 尚未配置 API Key，将使用 Mock 数据进行演示'}
                </p>
              </motion.div>
            )}

            {activeTab === 'rules' && (
              <motion.div key="rules-tab" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
                <FieldGroup label="SYSTEM PROMPT（系统提示词）">
                  <textarea value={form.rulesSystemPrompt} onChange={(e) => updateField('rulesSystemPrompt', e.target.value)} rows={12} className="w-full px-4 py-3 rounded-lg text-sm font-light outline-none resize-y" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary, #F9F9F9)', color: 'var(--text-primary)', minHeight: 200 }} />
                </FieldGroup>
                <FieldGroup label="USER PROMPT（用户提示词）">
                  <textarea value={form.rulesUserPrompt} onChange={(e) => updateField('rulesUserPrompt', e.target.value)} rows={3} className="w-full px-4 py-3 rounded-lg text-sm font-light outline-none resize-y" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary, #F9F9F9)', color: 'var(--text-primary)' }} />
                </FieldGroup>
                <p className="font-light text-xs" style={{ color: 'var(--text-muted)' }}>
                  规则模式：AI 接收画作图片，按系统提示词进行五大维度分析，返回结构化 JSON
                </p>
              </motion.div>
            )}

            {activeTab === 'custom' && (
              <motion.div key="custom-tab" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
                <FieldGroup label="SYSTEM PROMPT（系统提示词）">
                  <textarea value={form.customSystemPrompt} onChange={(e) => updateField('customSystemPrompt', e.target.value)} rows={10} className="w-full px-4 py-3 rounded-lg text-sm font-light outline-none resize-y" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary, #F9F9F9)', color: 'var(--text-primary)', minHeight: 160 }} />
                </FieldGroup>
                <p className="font-light text-xs" style={{ color: 'var(--text-muted)' }}>
                  自定义模式：AI 接收画作图片 + 用户文字，以对话方式交互。历史消息会自动附带在上下文中。
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          className="flex items-center justify-end gap-3 px-8 py-5"
          style={{ borderTop: '1px solid var(--border-primary)' }}
        >
          <motion.button onClick={onClose} className="px-6 py-2.5 font-heading text-xs tracking-widest rounded-lg" style={{ border: '1px solid var(--border-primary)', color: 'var(--text-muted)', backgroundColor: 'transparent' }} whileHover={{ borderColor: '#00D2FF', color: '#00D2FF' }} whileTap={{ scale: 0.97 }}>
            取消
          </motion.button>
          <motion.button onClick={handleSave} className="px-6 py-2.5 font-heading text-xs tracking-widest rounded-lg" style={{ backgroundColor: '#00D2FF', color: '#FFFFFF', boxShadow: '0 0 16px rgba(0, 210, 255, 0.15)' }} whileHover={{ boxShadow: '0 0 24px rgba(0, 210, 255, 0.25)' }} whileTap={{ scale: 0.97 }}>
            保存设置
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-heading text-[10px] tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ======== 画布区域 (左 45%) ========

function TheCanvas({
  artwork,
  artworkList,
  onSelectArtwork,
  isAnalyzing,
  analysisComplete,
  activeMarkerId,
  dimensions,
  onUpload,
  onDeleteArtwork,
}: {
  artwork: Artwork | null;
  artworkList: Artwork[];
  onSelectArtwork: (art: Artwork) => void;
  isAnalyzing: boolean;
  analysisComplete: boolean;
  activeMarkerId: string | null;
  dimensions: Dimension[];
  onUpload: (file: File) => void;
  onDeleteArtwork?: (art: Artwork) => void;
}) {
  const scanY = useMotionValue(0);
  const scanYSpring = useSpring(scanY, { stiffness: 50, damping: 25, mass: 1 });
  const grayscaleMv = useTransform(scanYSpring, [0, 100], [100, 0]);
  const scanTopPercent = useTransform(scanYSpring, (v: number) => `${v}%`);

  useEffect(() => {
    if (isAnalyzing) {
      const duration = 3000;
      const startTime = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        scanY.set(eased * 100);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } else if (analysisComplete) {
      scanY.set(100);
    } else {
      scanY.set(0);
    }
  }, [isAnalyzing, analysisComplete, scanY]);

  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const unsub = grayscaleMv.on('change', (v: number) => {
      if (imgRef.current) {
        imgRef.current.style.filter = `grayscale(${v}%)`;
      }
    });
    return unsub;
  }, [grayscaleMv]);

  const allAdvice = dimensions.flatMap((d) => d.advice);
  const initialGrayscale = analysisComplete ? 0 : 100;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  // 无图片状态 — 虚线框 + 加号
  if (!artwork) {
    return (
      <div className="w-[45%] h-full flex flex-col items-center justify-center p-8">
        <motion.div
          className="relative w-full max-w-lg flex items-center justify-center cursor-pointer"
          style={{
            aspectRatio: '3 / 4',
            border: '1.5px dashed var(--border-primary)',
            backgroundColor: 'transparent',
            transition: 'border-color 0.2s ease',
          }}
          whileHover={{ borderColor: '#00D2FF' }}
          onClick={() => fileInputRef.current?.click()}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springGentle, delay: 0.1 }}
        >
          <motion.svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }} whileHover={{ color: '#00D2FF' }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </motion.svg>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </motion.div>
        <p className="mt-4 font-light text-xl" style={{ color: 'var(--text-muted)' }}>
          点击上传画作
        </p>
      </div>
    );
  }

  // 有图片状态
  return (
    <div className="w-[45%] h-full flex flex-col items-center justify-center p-8">
      <motion.div
        className="relative w-full max-w-lg"
        style={{
          aspectRatio: '3 / 4',
          backgroundColor: '#FFFFFF',
          boxShadow: 'var(--shadow-sm)',
        }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springGentle, delay: 0.1 }}
      >
        <AnimatePresence mode="wait">
          <motion.div key={artwork.id} className="w-full h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <img ref={imgRef} src={artwork.src} alt={artwork.title} className="w-full h-full object-cover" style={{ filter: `grayscale(${initialGrayscale}%)` }} />
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {isAnalyzing && <ScanLaser topPercent={scanTopPercent} />}
        </AnimatePresence>

        <AnimatePresence>
          {analysisComplete && !isAnalyzing && (
            <motion.div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 30px rgba(0, 210, 255, 0.06)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} />
          )}
        </AnimatePresence>

        {allAdvice.map((adv) => (
          <MarkerOverlay key={adv.id} marker={adv.marker} activeMarkerId={activeMarkerId} adviceId={adv.id} />
        ))}

        {/* 底部图片切换栏 */}
        {artworkList.length > 0 && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 py-3 z-30"
            style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.35))' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {artworkList.map((art) => (
              <motion.button
                key={art.id}
                onClick={() => onSelectArtwork(art)}
                className="relative w-10 h-10 rounded overflow-hidden"
                style={{
                  border: art.id === artwork.id ? '2px solid #00D2FF' : '2px solid rgba(255,255,255,0.3)',
                  boxShadow: art.id === artwork.id ? '0 0 8px rgba(0, 210, 255, 0.3)' : 'none',
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <img src={art.src} alt={art.title} className="w-full h-full object-cover" />
              </motion.button>
            ))}

            {/* + 号上传按钮 */}
            <motion.button
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded flex items-center justify-center"
              style={{ border: '2px dashed rgba(255,255,255,0.3)', backgroundColor: 'rgba(0,0,0,0.2)' }}
              whileHover={{ borderColor: '#00D2FF', backgroundColor: 'rgba(0, 210, 255, 0.15)' }}
              whileTap={{ scale: 0.9 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </motion.button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

            {/* 删除当前画作按钮 */}
            {onDeleteArtwork && artworkList.length > 0 && (
              <motion.button
                onClick={() => onDeleteArtwork(artwork)}
                className="w-10 h-10 rounded flex items-center justify-center"
                style={{ border: '2px solid rgba(255,80,80,0.4)', backgroundColor: 'rgba(0,0,0,0.2)' }}
                whileHover={{ borderColor: '#ff5050', backgroundColor: 'rgba(255,80,80,0.15)' }}
                whileTap={{ scale: 0.9 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,80,80,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </motion.button>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ======== 自定义 AI 对话组件 ========

function CustomChatPanel({
  onSendMessage,
  currentImageUrl,
  settings,
  initialMessages,
  onMessagesSaved,
  artworkDbId,
}: {
  onSendMessage: (text: string) => void;
  currentImageUrl: string | null;
  settings: AiSettings;
  initialMessages?: ChatMessage[];
  onMessagesSaved?: (messages: ChatMessage[]) => void;
  artworkDbId: number | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || []);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // 同步 initialMessages 变化
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    setInputText('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    const newMessages: ChatMessage[] = [...messages, { role: 'user', text }];
    setMessages(newMessages);

    // 无 API Key → Mock 模式
    if (!settings.apiKey) {
      setIsStreaming(true);
      setStreamingText('');
      setTimeout(() => {
        const mockResponse =
          '我注意到你关注的是画作中「' +
          text.slice(0, 10) +
          '…」的部分。从构图角度看，这里的处理可以更加大胆一些——尝试用更宽的笔触来暗示体积关系，而非细致描绘每个细节。你觉得呢？';
        const finalMessages: ChatMessage[] = [...newMessages, { role: 'assistant', text: mockResponse }];
        setMessages(finalMessages);
        setIsStreaming(false);
        setStreamingText('');
        // 保存 Mock 对话到数据库
        if (artworkDbId) {
          critiqueApi.saveCustomMessages(artworkDbId, JSON.stringify(finalMessages)).catch(console.error);
        }
        onMessagesSaved?.(finalMessages);
      }, 1200);
      return;
    }

    // 真实 API 调用
    setIsStreaming(true);
    setStreamingText('');

    try {
      const fullResponse = await fetchCustomChatStream(
        currentImageUrl,
        text,
        messages,
        settings,
        (token) => {
          setStreamingText((prev) => prev + token);
        }
      );

      const finalMessages: ChatMessage[] = [...newMessages, { role: 'assistant', text: fullResponse }];
      setMessages(finalMessages);

      // 保存对话到数据库
      if (artworkDbId) {
        critiqueApi.saveCustomMessages(artworkDbId, JSON.stringify(finalMessages)).catch(console.error);
      }
      onMessagesSaved?.(finalMessages);
    } catch (err: any) {
      const finalMessages: ChatMessage[] = [...newMessages, { role: 'assistant', text: `[请求失败] ${err.message || '未知错误'}` }];
      setMessages(finalMessages);
      if (artworkDbId) {
        critiqueApi.saveCustomMessages(artworkDbId, JSON.stringify(finalMessages)).catch(console.error);
      }
      onMessagesSaved?.(finalMessages);
    } finally {
      setIsStreaming(false);
      setStreamingText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {hasMessages ? (
          <div className="space-y-3 py-4">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springGentle, delay: 0.05 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[80%] rounded-2xl px-5 py-3"
                  style={{
                    backgroundColor: msg.role === 'user' ? '#00D2FF' : 'var(--bg-secondary)',
                    color: msg.role === 'user' ? '#FFFFFF' : 'var(--text-secondary)',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border-primary)',
                  }}
                >
                  <p className="text-[15px] font-light leading-relaxed" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {msg.text}
                  </p>
                </div>
              </motion.div>
            ))}

            {isStreaming && streamingText && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-5 py-3" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }}>
                  <p className="text-[15px] font-light leading-relaxed" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {streamingText}
                    <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} className="inline-block w-[2px] h-4 ml-0.5 align-middle" style={{ backgroundColor: '#00D2FF' }} />
                  </p>
                </div>
              </motion.div>
            )}

            {isStreaming && !streamingText && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-5 py-3.5" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#00D2FF' }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <motion.p className="font-light text-lg" style={{ color: 'var(--text-muted)', letterSpacing: '0.02em' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              让AI自由点评画作
            </motion.p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-end gap-3 rounded-2xl px-5 py-3.5" style={{ border: '1px solid var(--border-primary)', backgroundColor: '#FFFFFF' }}>
        <textarea ref={inputRef} value={inputText} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="向 AI 提出你的问题…" rows={1} disabled={isStreaming} className="flex-1 resize-none bg-transparent outline-none text-[15px] font-light leading-relaxed" style={{ color: 'var(--text-primary)', maxHeight: 120, opacity: isStreaming ? 0.5 : 1, wordBreak: 'break-word' }} />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleSend} disabled={!inputText.trim() || isStreaming} className="flex-shrink-0 px-5 py-2 rounded-xl font-heading text-sm tracking-wider" style={{ backgroundColor: inputText.trim() && !isStreaming ? '#00D2FF' : 'var(--border-primary)', color: inputText.trim() && !isStreaming ? '#FFFFFF' : 'var(--text-muted)', opacity: inputText.trim() && !isStreaming ? 1 : 0.6, boxShadow: inputText.trim() && !isStreaming ? '0 0 16px rgba(0, 210, 255, 0.15)' : 'none' }}>
          发送
        </motion.button>
      </div>
    </div>
  );
}

// ======== 分析区域 (右 55%) ========

function TheAnalysis({
  hasArtwork,
  isAnalyzing,
  analysisComplete,
  onInitiateAnalysis,
  dimensions,
  expandedDimId,
  onToggleDim,
  onAdviceHover,
  activeMarkerId,
  currentImageUrl,
  settings,
  onOpenSettings,
  hasSavedRulesResult,
}: {
  hasArtwork: boolean;
  isAnalyzing: boolean;
  analysisComplete: boolean;
  onInitiateAnalysis: () => void;
  dimensions: Dimension[];
  expandedDimId: string | null;
  onToggleDim: (dimId: string) => void;
  onAdviceHover: (adviceId: string | null) => void;
  activeMarkerId: string | null;
  currentImageUrl: string | null;
  settings: AiSettings;
  onOpenSettings: () => void;
  hasSavedRulesResult: boolean;
}) {
  const [mode, setMode] = useState<'rules' | 'custom' | null>(null);
  const [titleHovered, setTitleHovered] = useState(false);

  if (!hasArtwork) {
    return (
      <div className="w-[55%] h-full flex flex-col items-center justify-center px-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-center">
          <p className="font-light text-2xl" style={{ color: 'var(--text-muted)' }}>
            请先在左侧添加画作
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`w-[55%] h-full flex flex-col px-12 py-8 ${mode === 'custom' ? '' : 'overflow-y-auto'}`}>
      <div className="flex items-center gap-3 mb-2 flex-shrink-0">
        <motion.h2
          className="font-heading font-black tracking-widest text-3xl cursor-default"
          style={{ color: 'var(--text-primary)' }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springGentle}
          onMouseEnter={() => setTitleHovered(true)}
          onMouseLeave={() => setTitleHovered(false)}
        >
          AI CRITIQUE
        </motion.h2>

        <AnimatePresence>
          {titleHovered && (
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={springSnappy}
              onMouseEnter={() => setTitleHovered(true)}
              onMouseLeave={() => setTitleHovered(false)}
            >
              <motion.button onClick={() => setMode(mode === 'rules' ? null : 'rules')} className="px-4 py-1.5 font-heading text-xs tracking-widest" style={{ border: '1px solid', borderColor: mode === 'rules' ? '#00D2FF' : 'var(--border-primary)', color: mode === 'rules' ? '#00D2FF' : 'var(--text-muted)', backgroundColor: mode === 'rules' ? 'rgba(0, 210, 255, 0.06)' : 'transparent', boxShadow: mode === 'rules' ? '0 0 12px rgba(0, 210, 255, 0.08)' : 'none' }} whileHover={{ borderColor: '#00D2FF', color: '#00D2FF' }} whileTap={{ scale: 0.97 }}>
                规则
              </motion.button>
              <motion.button onClick={() => setMode(mode === 'custom' ? null : 'custom')} className="px-4 py-1.5 font-heading text-xs tracking-widest" style={{ border: '1px solid', borderColor: mode === 'custom' ? '#00D2FF' : 'var(--border-primary)', color: mode === 'custom' ? '#00D2FF' : 'var(--text-muted)', backgroundColor: mode === 'custom' ? 'rgba(0, 210, 255, 0.06)' : 'transparent', boxShadow: mode === 'custom' ? '0 0 12px rgba(0, 210, 255, 0.08)' : 'none' }} whileHover={{ borderColor: '#00D2FF', color: '#00D2FF' }} whileTap={{ scale: 0.97 }}>
                自定义
              </motion.button>
              <motion.button onClick={onOpenSettings} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ border: '1px solid var(--border-primary)', color: 'var(--text-muted)' }} whileHover={{ borderColor: '#00D2FF', color: '#00D2FF', boxShadow: '0 0 12px rgba(0, 210, 255, 0.08)' }} whileTap={{ scale: 0.95 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.p className="font-light text-sm mb-6 flex-shrink-0" style={{ color: 'var(--text-muted)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
        Neural aesthetic analysis workspace
      </motion.p>

      {mode === 'custom' && (
        <CustomChatPanel
          onSendMessage={() => {}}
          currentImageUrl={currentImageUrl}
          settings={settings}
          artworkDbId={null}
        />
      )}

      {mode !== 'custom' && (
        <AnimatePresence mode="wait">
          {!isAnalyzing && !analysisComplete && !hasSavedRulesResult && (
            <motion.div key="initiate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="flex flex-col items-start">
              <motion.button onClick={onInitiateAnalysis} className="relative px-8 py-4 font-heading font-black text-sm tracking-widest" style={{ border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', backgroundColor: 'transparent', letterSpacing: '0.15em' }} whileHover={{ borderColor: '#00D2FF', color: '#00D2FF', boxShadow: '0 0 20px rgba(0, 210, 255, 0.1)' }} whileTap={{ scale: 0.98 }} transition={springGentle}>
                INITIATE AI ANALYSIS
              </motion.button>
              <p className="mt-4 font-light text-xs" style={{ color: 'var(--text-muted)' }}>
                {!settings.apiKey
                  ? '⚠ 未配置 API Key，将使用演示数据 · 在设置中配置'
                  : 'Click to begin neural aesthetic scanning'}
              </p>
            </motion.div>
          )}

          {/* 已有保存的规则结果 → 直接显示 */}
          {!isAnalyzing && hasSavedRulesResult && !analysisComplete && (
            <motion.div key="saved-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <p className="font-light text-xs mb-4" style={{ color: '#00D2FF' }}>
                ✓ 已有保存的分析结果 · 点击 INITIATE AI ANALYSIS 可重新分析
              </p>
              {dimensions.map((dim, index) => (
                <DimensionCard key={dim.id} dimension={dim} index={index} isExpanded={expandedDimId === dim.id} onToggle={() => onToggleDim(dim.id)} onAdviceHover={onAdviceHover} activeMarkerId={activeMarkerId} />
              ))}
              <div className="h-[0.5px] w-full" style={{ backgroundColor: 'var(--border-primary)' }} />

              <motion.button onClick={onInitiateAnalysis} className="mt-6 px-6 py-2.5 font-heading text-xs tracking-widest" style={{ border: '1px solid var(--border-primary)', color: 'var(--text-muted)', backgroundColor: 'transparent' }} whileHover={{ borderColor: '#00D2FF', color: '#00D2FF' }} whileTap={{ scale: 0.97 }}>
                RE-ANALYZE
              </motion.button>
            </motion.div>
          )}

          {isAnalyzing && !analysisComplete && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <TypingEffect lines={TYPING_LINES} isPlaying={isAnalyzing} />
            </motion.div>
          )}

          {analysisComplete && !isAnalyzing && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }}>
              {dimensions.map((dim, index) => (
                <DimensionCard key={dim.id} dimension={dim} index={index} isExpanded={expandedDimId === dim.id} onToggle={() => onToggleDim(dim.id)} onAdviceHover={onAdviceHover} activeMarkerId={activeMarkerId} />
              ))}
              <div className="h-[0.5px] w-full" style={{ backgroundColor: 'var(--border-primary)' }} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// ======== 页面主体 ========

export function AICritiquePage() {
  const [artworkList, setArtworkList] = useState<Artwork[]>([]);
  const [currentArtworkId, setCurrentArtworkId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [expandedDimId, setExpandedDimId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AiSettings>(loadSettings);
  const [isLoading, setIsLoading] = useState(true);

  const currentArtwork =
    artworkList.find((a) => a.id === currentArtworkId) ?? null;

  // ── 页面初始化：从数据库加载所有点评画作 ──
  useEffect(() => {
    const loadCritiques = async () => {
      try {
        const dtoList = await critiqueApi.getAllArtworks();
        const artworks = dtoList.map(dtoToArtwork);
        setArtworkList(artworks);
        if (artworks.length > 0) {
          setCurrentArtworkId(artworks[0].id);
          // 如果第一张画作有保存的规则结果，直接加载
          if (artworks[0].savedRulesResult && artworks[0].savedRulesResult.length > 0) {
            setDimensions(artworks[0].savedRulesResult);
            setAnalysisComplete(true);
            setExpandedDimId(artworks[0].savedRulesResult[0]?.id ?? null);
          }
        }
      } catch (err) {
        console.error('加载点评数据失败:', err);
        // API 不可用时显示空画廊
      } finally {
        setIsLoading(false);
      }
    };
    loadCritiques();
  }, []);

  // ── 切换画作：加载已保存的点评数据 ──
  const handleSelectArtwork = useCallback(
    (art: Artwork) => {
      if (art.id !== currentArtworkId) {
        setCurrentArtworkId(art.id);
        setIsAnalyzing(false);

        // 加载该画作已保存的规则分析
        if (art.savedRulesResult && art.savedRulesResult.length > 0) {
          setDimensions(art.savedRulesResult);
          setAnalysisComplete(true);
          setExpandedDimId(art.savedRulesResult[0]?.id ?? null);
        } else {
          setDimensions([]);
          setAnalysisComplete(false);
          setExpandedDimId(null);
        }
        setActiveMarkerId(null);
      }
    },
    [currentArtworkId]
  );

  // ── 上传图片：先上传到后端再保存到数据库 ──
  const handleUpload = useCallback(async (file: File) => {
    try {
      // 1. 上传图片到后端获取 URL
      const imageUrl = await aiApi.uploadImage(file);

      // 2. 创建点评画作记录
      const dto = await critiqueApi.createArtwork(imageUrl, file.name);
      const artwork = dtoToArtwork(dto);

      setArtworkList((prev) => [...prev, artwork]);
      setCurrentArtworkId(artwork.id);
      setIsAnalyzing(false);
      setAnalysisComplete(false);
      setExpandedDimId(null);
      setActiveMarkerId(null);
      setDimensions([]);
    } catch (err) {
      console.error('上传点评画作失败:', err);
      // 降级：本地 blob URL 创建临时记录
      const blobUrl = URL.createObjectURL(file);
      const tempArt: Artwork = {
        id: `temp-${Date.now()}`,
        dbId: null,
        src: blobUrl,
        title: file.name,
        savedRulesResult: null,
        savedCustomMessages: null,
      };
      setArtworkList((prev) => [...prev, tempArt]);
      setCurrentArtworkId(tempArt.id);
      setIsAnalyzing(false);
      setAnalysisComplete(false);
    }
  }, []);

  // ── 发起规则分析 ──
  const handleInitiateAnalysis = useCallback(async () => {
    const analysisStartTime = Date.now();
    setIsAnalyzing(true);
    setAnalysisComplete(false);
    setExpandedDimId(null);
    setActiveMarkerId(null);

    if (!currentArtwork) return;

    // 无 API Key → Mock 模式
    if (!settings.apiKey) {
      const mockDims = parseDimensionsFromAiResponse(JSON.stringify({
        dimensions: [
          { dimension: "ANATOMY", title: "骨架成型", advice: [{ text: "构图比例整体偏低，建议调整五官位置。", marker: { x: 42, y: 20, width: 16, height: 22 } }] },
          { dimension: "LIGHT", title: "光影塑造", advice: [{ text: "背景冷色月光与右肩暖光冲突，建议削弱高光。", marker: { x: 65, y: 30, width: 20, height: 40 } }] },
          { dimension: "COLOR", title: "色彩和谐", advice: [{ text: "暗部色温过于统一，引入互补色偏移增加深度。", marker: { x: 10, y: 55, width: 35, height: 30 } }] },
          { dimension: "TEXTURE", title: "笔触肌理", advice: [{ text: "前景与背景笔触密度相同，远景应更虚更薄。", marker: { x: 5, y: 5, width: 90, height: 40 } }] },
          { dimension: "EMOTION", title: "情感表达", advice: [{ text: "人物眼神方向与肢体动态矛盾，统一视线叙事性。", marker: { x: 44, y: 15, width: 12, height: 10 } }] },
        ]
      }));
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisComplete(true);
        setDimensions(mockDims);
        setExpandedDimId(mockDims[0]?.id ?? null);
        // 保存 Mock 结果到数据库
        if (currentArtwork.dbId) {
          critiqueApi.saveRulesResult(currentArtwork.dbId, JSON.stringify(mockDims)).catch(console.error);
        }
      }, 3200);
      return;
    }

    // 真实 API 调用
    try {
      const result = await fetchRulesAnalysis(currentArtwork.src, settings);
      const elapsed = Date.now() - analysisStartTime;
      const remaining = Math.max(0, 3200 - elapsed);
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisComplete(true);
        setDimensions(result);
        setExpandedDimId(result[0]?.id ?? null);
        // 保存结果到数据库
        if (currentArtwork.dbId) {
          critiqueApi.saveRulesResult(currentArtwork.dbId, JSON.stringify(result)).catch(console.error);
        }
        // 更新本地 artwork 的 savedRulesResult
        setArtworkList((prev) =>
          prev.map((a) =>
            a.id === currentArtwork.id
              ? { ...a, savedRulesResult: result }
              : a
          )
        );
      }, remaining);
    } catch (err) {
      console.error('规则模式 API 调用失败:', err);
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisComplete(true);
        setDimensions([]);
        setExpandedDimId(null);
      }, 3200);
    }
  }, [settings, currentArtwork]);

  // ── 删除画作 ──
  const handleDeleteArtwork = useCallback(async (art: Artwork) => {
    // 从数据库删除
    if (art.dbId) {
      try {
        await critiqueApi.deleteArtwork(art.dbId);
      } catch (err) {
        console.error('删除点评画作失败:', err);
      }
    }
    // 从本地列表移除
    setArtworkList((prev) => prev.filter((a) => a.id !== art.id));
    // 如果删除的是当前选中的，切换到下一张
    if (art.id === currentArtworkId) {
      const remaining = artworkList.filter((a) => a.id !== art.id);
      if (remaining.length > 0) {
        setCurrentArtworkId(remaining[0].id);
        if (remaining[0].savedRulesResult && remaining[0].savedRulesResult.length > 0) {
          setDimensions(remaining[0].savedRulesResult);
          setAnalysisComplete(true);
          setExpandedDimId(remaining[0].savedRulesResult[0]?.id ?? null);
        } else {
          setDimensions([]);
          setAnalysisComplete(false);
          setExpandedDimId(null);
        }
      } else {
        setCurrentArtworkId(null);
        setDimensions([]);
        setAnalysisComplete(false);
        setExpandedDimId(null);
      }
    }
    setActiveMarkerId(null);
    setIsAnalyzing(false);
  }, [currentArtworkId, artworkList]);

  // ── 自定义对话保存回调 ──
  const handleMessagesSaved = useCallback((messages: ChatMessage[], artworkId: string) => {
    setArtworkList((prev) =>
      prev.map((a) =>
        a.id === artworkId
          ? { ...a, savedCustomMessages: messages }
          : a
      )
    );
  }, []);

  const handleToggleDim = useCallback((dimId: string) => {
    setExpandedDimId((prev) => (prev === dimId ? null : dimId));
  }, []);

  const handleAdviceHover = useCallback((adviceId: string | null) => {
    setActiveMarkerId(adviceId);
  }, []);

  // 判断当前画作是否已有保存的规则结果
  const hasSavedRulesResult =
    currentArtwork?.savedRulesResult !== null &&
    currentArtwork?.savedRulesResult !== undefined &&
    currentArtwork.savedRulesResult.length > 0;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="h-screen flex items-center justify-center" style={{ backgroundColor: '#F9F9F9' }}>
          <motion.p className="font-light text-sm" style={{ color: 'var(--text-muted)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            Loading critique data...
          </motion.p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-screen flex" style={{ backgroundColor: '#F9F9F9' }}>
        <TheCanvas
          artwork={currentArtwork}
          artworkList={artworkList}
          onSelectArtwork={handleSelectArtwork}
          isAnalyzing={isAnalyzing}
          analysisComplete={analysisComplete}
          activeMarkerId={activeMarkerId}
          dimensions={dimensions}
          onUpload={handleUpload}
          onDeleteArtwork={handleDeleteArtwork}
        />

        <TheAnalysis
          hasArtwork={currentArtwork !== null}
          isAnalyzing={isAnalyzing}
          analysisComplete={analysisComplete}
          onInitiateAnalysis={handleInitiateAnalysis}
          dimensions={dimensions}
          expandedDimId={expandedDimId}
          onToggleDim={handleToggleDim}
          onAdviceHover={handleAdviceHover}
          activeMarkerId={activeMarkerId}
          currentImageUrl={currentArtwork?.src ?? null}
          settings={settings}
          onOpenSettings={() => setShowSettings(true)}
          hasSavedRulesResult={hasSavedRulesResult}
        />
      </div>

      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            settings={settings}
            onSave={setSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

export default AICritiquePage;
