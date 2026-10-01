/**
 * HaloVault API 服务模块
 * 封装所有与后端交互的 fetch 请求
 * 基础路径通过 Vite 代理转发至 localhost:8080
 */

const API_BASE = '/api';

// ── 通用请求封装 ──

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    // 尝试从响应体获取具体错误信息
    try {
      const errJson = await res.json();
      throw new Error(errJson.message || `API Error ${res.status}: ${res.statusText}`);
    } catch {
      throw new Error(`API Error ${res.status}: ${res.statusText}`);
    }
  }

  const json = await res.json();
  // 后端统一用 ApiResponse<T> 包装: { code, message, data }
  // 全局异常处理器也通过此格式返回，HTTP 200 + code≠200
  if (json.code !== 200) {
    throw new Error(json.message || 'Unknown API error');
  }
  return json.data as T;
}

// ── 类型定义 ──

export interface Album {
  id: number;
  title: string;
  description: string;
  coverSeed: string;
  createdAt: string;
  updatedAt: string;
}

export interface Artwork {
  id: number;
  albumId: number;
  title: string;
  seed: string;
  imageUrl: string;
  height: number;
  platform: string;
  platformUrl: string;
  highlights: string;
  description: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlbumDetail {
  album: Album;
  artworks: Artwork[];
}

export interface CheckinRecord {
  id: number;
  day: number;
  imageUrl: string;
  note: string;
  streak: number;
  createdAt: string;
}

export interface ChallengeStats {
  currentDay: number;
  streak: number;
  completedDays: number;
  maxStreak: number;
  missedDays: number[];
  records: CheckinRecord[];
}

// ── Gallery API ──

export const galleryApi = {
  /** 获取所有专辑及其画作 */
  getAllAlbums: () => request<AlbumDetail[]>('/gallery/albums'),

  /** 获取单个专辑详情 */
  getAlbumDetail: (albumId: number) => request<AlbumDetail>(`/gallery/albums/${albumId}`),

  /** 创建新专辑 */
  createAlbum: (data: {
    title: string;
    description?: string;
    coverSeed?: string;
    artworks?: Partial<Artwork>[];
  }) =>
    request<AlbumDetail>('/gallery/albums', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 更新专辑信息 */
  updateAlbum: (albumId: number, data: Partial<Album>) =>
    request<boolean>(`/gallery/albums/${albumId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /** 删除专辑 */
  deleteAlbum: (albumId: number) =>
    request<boolean>(`/gallery/albums/${albumId}`, { method: 'DELETE' }),

  /** 获取某专辑下的画作 */
  getArtworksByAlbum: (albumId: number) =>
    request<Artwork[]>(`/gallery/albums/${albumId}/artworks`),

  /** 获取所有画作 */
  getAllArtworks: () => request<Artwork[]>('/gallery/artworks'),

  /** 新增画作到指定专辑 */
  addArtworkToAlbum: (albumId: number, data: Partial<Artwork>) =>
    request<Artwork>(`/gallery/albums/${albumId}/artworks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 更新画作 */
  updateArtwork: (artworkId: number, data: Partial<Artwork>) =>
    request<boolean>(`/gallery/artworks/${artworkId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /** 删除画作 */
  deleteArtwork: (artworkId: number) =>
    request<boolean>(`/gallery/artworks/${artworkId}`, { method: 'DELETE' }),
};

// ── AI API ──

export interface AiRequestConfig {
  apiKey?: string;
  apiBaseUrl?: string;
  model?: string;
}

export const aiApi = {
  /**
   * 非流式 AI 聊天 — 发送消息（含图片），获取完整文本回复
   * 用于设定集扩展等需要完整 JSON 结果的场景
   *
   * config 参数：前端设置面板的 API 配置，会随请求传给后端
   * 后端优先使用请求中的值；没传就用 application.yml 默认值
   */
  completeChat: async (
    messages: Array<{
      role: string;
      content?: string;
      contentParts?: Array<{
        type: string;
        text?: string;
        imageUrl?: { url: string };
      }>;
    }>,
    systemPrompt?: string,
    config?: AiRequestConfig
  ): Promise<string> => {
    // 如果提供了 systemPrompt，插入到 messages 首位
    const finalMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    // 构建请求体，包含可选的 API 配置覆盖
    const body: Record<string, any> = { messages: finalMessages, stream: false };
    if (config) {
      if (config.apiKey) body.apiKey = config.apiKey;
      if (config.apiBaseUrl) body.apiBaseUrl = config.apiBaseUrl;
      if (config.model) body.model = config.model;
    }

    const res = await fetch(`${API_BASE}/chat/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // 先检查 HTTP 状态码（网络层面错误）
    if (!res.ok) {
      // 尝试从响应体中获取更具体的错误信息
      try {
        const errJson = await res.json();
        throw new Error(errJson.message || `API 返回 ${res.status}: ${res.statusText}`);
      } catch {
        throw new Error(`API 返回 ${res.status}: ${res.statusText}`);
      }
    }

    const json = await res.json();
    // 后端 ApiResponse 包装: { code, message, data }
    // 全局异常处理器现在也通过 ApiResponse 格式返回错误，HTTP 状态码为 200
    if (json.code !== 200) throw new Error(json.message || 'AI 请求失败');
    return json.data as string;
  },

  /** 上传图片到后端，返回可访问的 URL */
  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/upload/image`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error(`上传失败 ${res.status}: ${res.statusText}`);

    const json = await res.json();
    if (json.code !== 200) throw new Error(json.message || '上传失败');
    return json.data as string;
  },
};

// ── Checkin API ──

export const checkinApi = {
  /** 获取挑战状态汇总 */
  getStats: () => request<ChallengeStats>('/checkin/stats'),

  /** 获取所有打卡记录 */
  getAllRecords: () => request<CheckinRecord[]>('/checkin/records'),

  /** 获取指定天数打卡记录 */
  getByDay: (day: number) => request<CheckinRecord>(`/checkin/records/${day}`),

  /** 打卡（新增或更新） */
  checkin: (day: number, imageUrl: string, note: string) =>
    request<CheckinRecord>('/checkin/records', {
      method: 'POST',
      body: JSON.stringify({ day, imageUrl, note }),
    }),

  /** 删除指定天数打卡记录 */
  deleteByDay: (day: number) =>
    request<boolean>(`/checkin/records/${day}`, { method: 'DELETE' }),

  /** 查询指定天数范围打卡记录 */
  getByRange: (from: number, to: number) =>
    request<CheckinRecord[]>(`/checkin/records/range?from=${from}&to=${to}`),
};

// ── Vault (Moodboard) API ──

export interface VaultImageDTO {
  id: number;
  url: string;
  name: string;
  aspectRatio: number;
  createdAt: string;
}

export const vaultApi = {
  /** 获取所有图库素材 */
  getAllImages: () => request<VaultImageDTO[]>('/vault/images'),

  /** 获取单个素材 */
  getImageById: (id: number) => request<VaultImageDTO>(`/vault/images/${id}`),

  /** 创建图库素材（上传图片后保存记录） */
  createImage: (url: string, name: string, aspectRatio: number) =>
    request<VaultImageDTO>('/vault/images', {
      method: 'POST',
      body: JSON.stringify({ url, name, aspectRatio }),
    }),

  /** 删除图库素材 */
  deleteImage: (id: number) =>
    request<void>(`/vault/images/${id}`, { method: 'DELETE' }),
};

// ── Timeline (Data) API ──

export interface TimelineNodeDTO {
  id: number;
  title: string;
  period: string;
  coverUrl: string;
  analysis: string;
  albumId: number | null;
  sortOrder: number;
  createdAt: string;
}

export const timelineApi = {
  /** 获取所有时间轴节点 */
  getAllNodes: () => request<TimelineNodeDTO[]>('/timeline/nodes'),

  /** 获取单个节点 */
  getNodeById: (id: number) => request<TimelineNodeDTO>(`/timeline/nodes/${id}`),

  /** 创建时间轴节点 */
  createNode: (data: {
    title: string;
    period?: string;
    coverUrl?: string;
    analysis?: string;
    albumId?: number | null;
  }) =>
    request<TimelineNodeDTO>('/timeline/nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 删除时间轴节点 */
  deleteNode: (id: number) =>
    request<void>(`/timeline/nodes/${id}`, { method: 'DELETE' }),
};

// ── Critique API ──

export interface CritiqueArtworkDTO {
  id: number;
  imageUrl: string;
  title: string;
  rulesResult: string;     // JSON string: Dimension[]
  customMessages: string;  // JSON string: ChatMessage[]
  createdAt: string;
  updatedAt: string;
}

export const critiqueApi = {
  /** 获取所有点评画作（含已保存的分析结果） */
  getAllArtworks: () => request<CritiqueArtworkDTO[]>('/critique/artworks'),

  /** 创建点评画作记录 */
  createArtwork: (imageUrl: string, title: string) =>
    request<CritiqueArtworkDTO>('/critique/artworks', {
      method: 'POST',
      body: JSON.stringify({ imageUrl, title }),
    }),

  /** 保存规则模式分析结果 */
  saveRulesResult: (id: number, rulesResultJson: string) =>
    request<void>(`/critique/artworks/${id}/rules`, {
      method: 'PUT',
      body: JSON.stringify({ rulesResult: rulesResultJson }),
    }),

  /** 保存自定义对话历史 */
  saveCustomMessages: (id: number, customMessagesJson: string) =>
    request<void>(`/critique/artworks/${id}/custom`, {
      method: 'PUT',
      body: JSON.stringify({ customMessages: customMessagesJson }),
    }),

  /** 删除点评画作 */
  deleteArtwork: (id: number) =>
    request<void>(`/critique/artworks/${id}`, { method: 'DELETE' }),
};
