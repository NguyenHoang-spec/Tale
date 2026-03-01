import React, { useRef, useState, useEffect, useMemo } from 'react';
import { GameSession, Turn, RegistryEntry, GameGenre, GameMechanics, GalleryImage } from '../types';
import { db } from '../db';

interface LandingScreenProps {
  onNewGame: () => void;
  onLoadGame: (session: GameSession, turns: Turn[], encyclopedia?: RegistryEntry[], gallery?: GalleryImage[]) => void;
  onContinueSession: (sessionId: number) => void;
  onUseTemplate?: (session: GameSession) => void; 
}

interface SessionMeta {
    realm: string;
    turnCount: number;
    lastActive: string;
    lastActiveTimestamp: number; // Added for sorting
}

type SortOption = 'RECENT' | 'OLDEST' | 'PROGRESS';

// DATA: TECH SPECS
const TECH_SPECS = [
    {
        label: "Model (Mô Hình)",
        value: "Gemini 3.0 Pro / Flash",
        desc: "Bộ não của AI. Pro thông minh hơn, Flash nhanh hơn."
    },
    {
        label: "Temperature (Nhiệt Độ)",
        value: "0.4 - 0.9 (Dynamic)",
        desc: "Độ 'bay bổng'. Thấp = Logic/Cốt truyện chặt chẽ. Cao = Sáng tạo/Hội thoại tự nhiên. Game tự động điều chỉnh tùy tình huống."
    },
    {
        label: "Top K",
        value: "64",
        desc: "Giới hạn 64 từ vựng có xác suất cao nhất cho mỗi lần chọn từ tiếp theo. Giúp văn phong ổn định, tránh từ ngữ vô nghĩa."
    },
    {
        label: "Top P (Nucleus Sampling)",
        value: "0.95",
        desc: "Chỉ xem xét nhóm từ vựng có tổng xác suất tích lũy là 95%. Loại bỏ các từ quá hiếm hoặc không phù hợp ngữ cảnh."
    },
    {
        label: "Context Window (Bộ Nhớ)",
        value: "2000 Turns (High Mode)",
        desc: "Độ dài ngữ cảnh AI có thể nhớ. 2000 lượt tương đương một cuốn tiểu thuyết dài. (Standard Mode: 50 lượt)."
    },
    {
        label: "Thinking Budget",
        value: "32,768 Tokens (God Mode)",
        desc: "Dung lượng dành riêng cho 'Suy nghĩ nội tâm' (Thought Process). 32K là mức tối đa tuyệt đối của model Pro, giúp AI suy luận cực sâu như con người."
    },
    {
        label: "RAG (Vector Search)",
        value: "Cosine Similarity > 0.65",
        desc: "Cơ chế 'Hồi Tưởng'. Khi chơi, hệ thống tìm kiếm 15 đoạn ký ức cũ có nội dung tương đồng (Vector) để nhắc AI nhớ lại."
    }
];

const UPDATE_LOGS = [
    {
         version: "v5.0 - Smart Wiki & Gallery",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "AI AUTO-FILL WIKI: Tính năng mới cho phép AI tự động viết thông tin chi tiết cho mục Wiki. Chỉ cần nhập tên, AI sẽ điền mô tả, ngoại hình, tính cách dựa trên cốt truyện.",
            "KHO ẢNH (GALLERY): Hệ thống quản lý hình nền mới. Lưu trữ ảnh yêu thích, tải ảnh từ URL và đổi hình nền nhanh chóng ngay trong game.",
            "SAVE CURRENT BG: Cho phép lưu nhanh ảnh nền hiện tại vào Kho Ảnh để dùng lại sau.",
            "GIAO DIỆN MỚI: Cải tiến modal Giao Diện với các tab riêng biệt cho Cài Đặt và Kho Ảnh."
        ]
    },
    {
        version: "v5.0 - Smart Wiki & Gallery",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "AI AUTO-FILL WIKI: Tính năng mới cho phép AI tự động viết thông tin chi tiết cho mục Wiki. Chỉ cần nhập tên, AI sẽ điền mô tả, ngoại hình, tính cách dựa trên cốt truyện.",
            "KHO ẢNH (GALLERY): Hệ thống quản lý hình nền mới. Lưu trữ ảnh yêu thích, tải ảnh từ URL và đổi hình nền nhanh chóng ngay trong game.",
            "SAVE CURRENT BG: Cho phép lưu nhanh ảnh nền hiện tại vào Kho Ảnh để dùng lại sau.",
            "GIAO DIỆN MỚI: Cải tiến modal Giao Diện với các tab riêng biệt cho Cài Đặt và Kho Ảnh."
        ]
    },
    {
        version: "v4.9 - Chronos Fix & Quick Wiki",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "CHRONOS ENGINE V2 (FIX): Sửa lỗi nghiêm trọng khiến thời gian nhảy vọt 1 ngày sau mỗi lượt. Giờ đây, mỗi hành động chỉ tốn 1-5 phút (hoặc 15 phút nếu di chuyển xa).",
            "QUICK WIKI CREATION: Tính năng mới cho phép bôi đen (chọn) bất kỳ đoạn văn bản nào trong truyện để tạo nhanh mục Wiki (NPC, Địa danh, Vật phẩm...).",
            "DATE LOCK: Khóa chặt ngày tháng, ngăn chặn AI tự ý chuyển sang ngày hôm sau trừ khi người chơi dùng lệnh ngủ/chờ."
        ]
    },
    {
        version: "v4.8 - Infinite Context Core",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "INFINITE CONTEXT ACTIVATED (2000 Turns): Chính thức kích hoạt khả năng xử lý ngữ cảnh thực tế lên tới 2000 lượt chơi (Có tác dụng 100%). AI giờ đây có thể xâu chuỗi sự kiện từ chương 1 đến chương 2000 mà không bị 'mất trí nhớ'.",
            "DEEP RECALL (Hồi Tưởng Sâu): Thuật toán RAG được tinh chỉnh để ưu tiên tìm kiếm các sự kiện quan trọng trong quá khứ xa khi người chơi nhắc lại.",
            "STABILITY OPTIMIZATION: Tối ưu hóa luồng dữ liệu khi xử lý bộ nhớ High Mode, đảm bảo game không bị crash dù file save cực nặng."
        ]
    },
    {
        version: "v4.7 - Logic Time Engine",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "LOGIC TIME ENGINE (Auto-Context): Loại bỏ cơ chế random ngày giờ cứng nhắc. AI sẽ tự động phân tích bối cảnh (Tu tiên, Mạt thế, Sci-fi...) để tạo ra mốc thời gian và tài sản ban đầu hợp lý nhất.",
            "SMART CHRONOS: AI sẽ tự động tua nhanh thời gian (Time Skip) một cách logic nếu cốt truyện yêu cầu (Vd: Bế quan, đi ngủ) thay vì giữ nguyên giờ giấc.",
            "HIGH MEMORY: Tối ưu hóa trí nhớ để theo dõi mạch truyện tốt hơn."
        ]
    },
    {
        version: "v4.6 - Memory Upgrade",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "HIGH MEMORY SCANNER (150 Turns): Khi bật chế độ High Memory, AI sẽ quét lại 150 lượt chơi gần nhất để lấy ngữ cảnh, thay vì chỉ 20 lượt như trước. Đảm bảo cốt truyện liền mạch hơn.",
            "RAG ENHANCEMENT (Deep Search): Tăng độ sâu tìm kiếm (RAG) lên 50 đơn vị kiến thức (Chunks) khi ở chế độ High Memory. Giúp AI nhớ chi tiết nhỏ nhặt tốt hơn.",
            "MAX THINKING BUDGET (32K): Mở khóa giới hạn suy nghĩ tối đa của model Pro (32,768 tokens) khi dùng High Memory.",
            "CHRONOS & ECONOMY STABILITY: Cải thiện độ ổn định của hệ thống thời gian và tiền tệ."
        ]
    },
    {
        version: "v4.3 - God Mode Intelligence",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "MAX INTELLIGENCE (32K Tokens): Tăng gấp đôi ngân sách suy luận (Thinking Budget) cho chế độ Super Memory (32k) và Standard (8k). AI thông minh hơn, nhớ sâu hơn.",
            "CHRONOS TIME ENGINE: Hệ thống thời gian Delta chính xác. AI tính toán thời gian trôi qua dựa trên hành động thực tế (Nói chuyện +5p, Di chuyển +1h...). Ngăn chặn việc nhảy ngày vô lý.",
            "EDGING PROTOCOL (Infinite Stamina): Nhân vật chính có thể lực vô hạn. AI không được quyền tự ý kết thúc/xuất tinh trừ khi người chơi ra lệnh."
        ]
    },
    {
        version: "v4.1 - Uncensored & Pacing Control",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "UNCENSORED MODE (Không Che): Bắt buộc hệ thống sử dụng từ ngữ trần trụi (Real Talk: Địt, Lồn, Vú...) thay vì các từ viết tắt hoặc ẩn dụ khi ở chế độ Extreme. Loại bỏ ký tự che (*).",
            "ANTI-PREMATURE (Chống Ra Sớm): Cấm tuyệt đối AI tự ý cho nhân vật chính 'kết thúc' (xuất tinh) trừ khi người chơi ra lệnh. Đảm bảo cảnh nóng kéo dài theo ý muốn.",
            "SAFETY UNLOCK: Vô hiệu hóa bộ lọc an toàn của AI để cho phép nội dung người lớn chi tiết."
        ]
    },
    {
        version: "v4.0 - Natural Dialogue & Consensual Realism",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "NATURAL FLOW (Văn phong Đời thường): AI được tinh chỉnh để viết thoại tự nhiên, bớt 'sượng trân' (Hán Việt/Văn mẫu) trong bối cảnh hiện đại. Xưng hô và câu cú linh hoạt hơn.",
            "HEALTHY NSFW (18+ Văn minh): Loại bỏ mặc định các yếu tố 'Chủ Nhân - Nô Lệ' (Master/Slave), 'Bạo Dâm' (Sadism) hay cưỡng ép. Chế độ Extreme giờ đây tập trung vào sự hòa hợp (Mutual Pleasure), đam mê và từ ngữ kích thích (Real Talk) thay vì bạo lực.",
            "CONTEXT AWARENESS: AI phân biệt rõ hơn giữa bối cảnh Cổ trang (Trang trọng) và Hiện đại (Đời thường) để điều chỉnh giọng văn."
        ]
    },
    {
        version: "v3.9 - Contextual NSFW Logic",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "FIX OOC (Out of Character): Khắc phục lỗi nhân vật nói chuyện thô tục bừa bãi trong chế độ Extreme. Giờ đây, từ ngữ trần trụi/thô tục CHỈ xuất hiện khi mô tả cảnh nóng hoặc cơ thể.",
            "CONTEXTUAL REALISM: Trong cốt truyện bình thường, các nhân vật (đặc biệt là vai vế cao như Thánh Nữ, Quý Tộc...) sẽ giữ đúng phong thái, xưng hô trang trọng. Chỉ khi 'lên giường', ngôn từ mới trở nên dâm dục.",
            "PRECISION DESCRIPTION: Tăng cường độ chi tiết khi miêu tả giải phẫu cơ thể nhưng vẫn giữ mạch truyện logic."
        ]
    },
    {
        version: "v3.8 - NSFW Engine Upgrade",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "NSFW EXTREME UPGRADE: Nâng cấp engine miêu tả 18+ cực hạn. AI được huấn luyện để sử dụng từ ngữ trần trụi, thô tục (Real Talk) và miêu tả chi tiết giải phẫu/cảm giác xác thịt khi có cảnh nóng.",
            "SOFT MODE BALANCING: Chế độ 'Vừa Phải' được tinh chỉnh để tập trung tối đa vào cảm xúc và cốt truyện. Ngăn chặn AI tự ý để nhân vật hành động sàm sỡ/biến thái nếu không phù hợp tính cách.",
            "NPC REACTION: Cải thiện phản ứng của NPC trong các tình huống nhạy cảm, đảm bảo chân thực và đúng thiết lập nhân vật (Anti-OOC)."
        ]
    },
    {
        version: "v3.7 - TTS & Audio Engine",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "TEXT-TO-SPEECH (Đọc Truyện): Tích hợp công cụ đọc văn bản. Hỗ trợ giọng đọc tiếng Việt và đa ngôn ngữ (Tùy thuộc trình duyệt).",
            "AUTO-READ (Rảnh Tay): Chế độ tự động đọc ngay khi AI trả lời xong. Không cần thao tác thủ công.",
            "SMART CLEANING: Tự động lọc bỏ các ký tự Markdown (*, #, []) và thẻ hệ thống (System Tags) giúp giọng đọc mượt mà, tự nhiên như người kể chuyện.",
            "CONTROLS: Tùy chỉnh tốc độ đọc (0.5x - 2.0x) và chọn giọng đọc yêu thích."
        ]
    },
    {
        version: "v3.5 - Knowledge Graph RAG",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "KNOWLEDGE GRAPH (Bộ Nhớ Dạng Lưới): Khi bật Super Memory, AI không chỉ nhớ tên NPC, mà còn nhớ MỐI QUAN HỆ CHẰNG CHỊT (Vd: A ghét B vì sự kiện C).",
            "TEMPORAL ANCHOR (Neo Thời Gian): Ép buộc AI ghi nhớ mốc thời gian tuyệt đối. Ngăn chặn triệt để việc 'sáng đi chiều đến' vô lý.",
            "Logic thời gian được siết chặt trong Prompt hệ thống."
        ]
    },
    {
        version: "v3.2 - AI Awakening",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "INNER MONOLOGUE (Độc thoại nội tâm): AI buộc phải suy nghĩ và lập kế hoạch logic trong trường 'thoughtProcess' trước khi viết truyện. Giảm thiểu tình tiết vô lý.",
            "DYNAMIC TEMPERATURE: Tự động điều chỉnh độ sáng tạo của AI. (Chiến đấu/Giải đố = Logic chặt chẽ; Kể chuyện/Hội thoại = Bay bổng).",
            "SMART LIVING WORLD: Cải thiện hệ thống mô phỏng thế giới nền, các phe phái tự hoạt động khi người chơi nghỉ ngơi.",
            "HIERARCHICAL MEMORY: Phân tầng bộ nhớ (Tóm tắt chương + Hồi ức + Wiki) giúp AI nhớ dai hơn."
        ]
    },
    {
        version: "v3.1 - Logic Fix & NSFW Upgrade",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "TIME LOGIC FIX: Khắc phục triệt để tình trạng nhảy thời gian vô lý. AI bắt buộc tính toán từng phút cho mỗi hành động (Nói chuyện +5p, Đi lại +10p...).",
            "ANTI-PREMATURE: Người chơi toàn quyền kiểm soát việc 'kết thúc' (xuất tinh) trong cảnh nóng. AI sẽ không tự ý cho nhân vật 'ra' sớm.",
            "NSFW DETAILED: Nâng cấp văn phong 18+ lên mức độ cực hạn (Extreme Details) cho các lựa chọn hành động.",
            "Ổn định hệ thống và sửa lỗi hiển thị."
        ]
    },
    {
        version: "v1.9 - Super Memory & Deep Wiki",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "Nâng cấp 'Siêu Trí Nhớ' (Super Memory): Tăng Top K lên 100, Thinking Budget 16k, quét sâu 100 lượt chơi quá khứ. AI thông minh hơn, nhớ chi tiết nhỏ nhất.",
            "Giao diện Wiki mới: Hiển thị chi tiết Cảnh giới, Căn cơ, Tài sản, Hành trang & Chỉ số nhân vật theo dạng thẻ bài.",
            "Cơ chế Database: Tối ưu hóa việc gộp thông tin Wiki, tự động cập nhật chỉ số mà không mất dữ liệu cũ.",
            "Fix lỗi hiển thị & Tối ưu hiệu năng RAG."
        ]
    },
    {
        version: "v1.8 - RAG & Map System",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "Hệ thống Bản Đồ (Map) trực quan với cơ chế di chuyển.",
            "Tích hợp RAG (Siêu Trí Nhớ) dùng Vector Search để nhớ lại chi tiết cũ.",
            "Thêm mô hình Gemini 3.0 Pro & Flash Lite.",
            "Cải thiện giao diện Wiki & Living World (Thế giới sống)."
        ]
    },
    {
        version: "v1.5 - Advanced Settings",
        date: "2024",
        author: "Nguyễn Hoàng",
        details: [
            "Tùy chỉnh sâu NSFW (Extreme/Soft).",
            "Thêm các Preset thế giới (Anime, Tu Tiên, Showbiz...).",
            "Cơ chế Import/Export file save & template.",
            "Tối ưu hóa prompt hệ thống để giữ đúng tính cách nhân vật (Anti-OOC)."
        ]
    },
    {
        version: "v1.0 - Genesis",
        date: "Khởi tạo",
        author: "Zesty",
        details: [
            "Core Framework (Game Loop, DB).",
            "Giao diện cơ bản & Hiệu ứng hình ảnh.",
            "Tích hợp Gemini API cơ bản.",
            "Nền tảng cho Thien Dao Simulator."
        ]
    }
];

export const LandingScreen: React.FC<LandingScreenProps> = ({ onNewGame, onLoadGame, onContinueSession, onUseTemplate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const globalBgInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [sessionMetas, setSessionMetas] = useState<Record<number, SessionMeta>>({});
  const [showLibrary, setShowLibrary] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  
  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('RECENT');

  // Gallery / Bulk Update State
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  
  // API Key Management State
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKeysText, setApiKeysText] = useState('');
  const [apiKeysStatus, setApiKeysStatus] = useState<{message: string, type: 'success'|'error'|'info'} | null>(null);
  const [isTestingKeys, setIsTestingKeys] = useState(false);
  const [apiKeyUsage, setApiKeyUsage] = useState<Record<string, number>>({});
  const [activeApiKey, setActiveApiKey] = useState<string>('');
  
  // NEW: Confirmation Modal State
  const [confirmation, setConfirmation] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  // NEW: Advanced Gallery State
  const [galleryTab, setGalleryTab] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [gallerySort, setGallerySort] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [gallerySearch, setGallerySearch] = useState(''); // Tags or URL search
  const [inputTags, setInputTags] = useState('');

  // Global Interface State (Background + Logo)
  const [showGlobalSettingsModal, setShowGlobalSettingsModal] = useState(false);
  const [globalBgUrl, setGlobalBgUrl] = useState(localStorage.getItem('td_global_bg_url') || '');
  const [globalBgType, setGlobalBgType] = useState<'image' | 'video'>(
      (localStorage.getItem('td_global_bg_type') as 'image' | 'video') || 'image'
  );
  // UPDATED LOGO TO DRAGON
  const [globalLogoUrl, setGlobalLogoUrl] = useState(
      localStorage.getItem('td_global_logo_url') || 'https://cdn-icons-png.flaticon.com/512/12336/12336082.png'
  );

  // Updates Modal State
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  // Tech Specs Modal State (NEW)
  const [showTechSpecsModal, setShowTechSpecsModal] = useState(false);

  // Rename State
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [tempTitle, setTempTitle] = useState('');

  // Load sessions from DB on mount
  useEffect(() => {
    const loadSessions = async () => {
        const loadedSessions = await db.sessions.toArray(); // Load all, sort later
        setSessions(loadedSessions);

        // Fetch Meta Data (Realm, Turns) for each session
        const metas: Record<number, SessionMeta> = {};
        await Promise.all(loadedSessions.map(async (s) => {
            if (!s.id) return;
            
            // Get Turn Count (Fix: Total messages / 2 = Actual Rounds)
            const rawCount = await db.turns.where('sessionId').equals(s.id).count();
            const count = Math.floor(rawCount / 2);
            
            // Get Last Turn for Realm & Activity
            const lastTurn = await db.turns.where('sessionId').equals(s.id).reverse().first();
            let realm = "Khởi Nguyên";
            let lastActive = new Date(s.createdAt).toLocaleDateString('vi-VN');
            
            // Use session.createdAt as base timestamp (updated on save/load)
            let lastActiveTimestamp = s.createdAt; 

            if (lastTurn) {
                if (lastTurn.role === 'model' && lastTurn.rawResponseJSON) {
                    try {
                        const json = JSON.parse(lastTurn.rawResponseJSON);
                        if (json.stats?.realm) realm = json.stats.realm;
                    } catch {}
                }
            }
            
            metas[s.id] = { realm, turnCount: count, lastActive, lastActiveTimestamp };
        }));
        setSessionMetas(metas);
    };
    if (showLibrary) {
        loadSessions();
    } else {
        // Simple load for main screen count
        db.sessions.toArray().then(setSessions);
    }
  }, [showLibrary]); 

  // Load Gallery
  useEffect(() => {
      if (showGalleryModal) {
          db.imageGallery.orderBy('addedAt').reverse().toArray().then(setGalleryImages);
      }
  }, [showGalleryModal]);

  // Load API Keys
  useEffect(() => {
      if (showApiModal) {
          try {
              const keysStr = localStorage.getItem('td_api_keys');
              if (keysStr) {
                  const keys = JSON.parse(keysStr);
                  if (Array.isArray(keys)) {
                      setApiKeysText(keys.join('\n'));
                  }
              }
              const usageStr = localStorage.getItem('td_api_key_usage');
              if (usageStr) {
                  setApiKeyUsage(JSON.parse(usageStr));
              }
              const activeKey = localStorage.getItem('td_active_api_key');
              if (activeKey) {
                  setActiveApiKey(activeKey);
              }
          } catch (e) {
              console.error("Failed to load API keys", e);
          }
          setApiKeysStatus(null);
      }
  }, [showApiModal]);

  const handleSaveApiKeys = async () => {
      setIsTestingKeys(true);
      
      const keys = apiKeysText.split('\n').map(k => k.trim()).filter(k => k.length > 0);
      
      if (keys.length === 0) {
          localStorage.removeItem('td_api_keys');
          setApiKeysStatus({ message: 'Đã xóa toàn bộ API Key. Hệ thống sẽ dùng Key mặc định.', type: 'success' });
          setIsTestingKeys(false);
          return;
      }

      // Phương án 1: Lưu trực tiếp không cần test để tránh treo UI
      try {
          localStorage.setItem('td_api_keys', JSON.stringify(keys));
          setApiKeysStatus({ message: `Đã lưu thành công ${keys.length} API Key! Hệ thống sẽ tự động xoay vòng khi có lỗi.`, type: 'success' });
          setApiKeysText(keys.join('\n'));
      } catch (e) {
          setApiKeysStatus({ message: 'Lỗi khi lưu API Key vào bộ nhớ máy.', type: 'error' });
      }
      
      setIsTestingKeys(false);
  };

  // Process Gallery Images (Filter & Sort)
  const processedGalleryImages = useMemo(() => {
      let filtered = galleryImages.filter(img => {
          // Filter by Tab (Strict)
          if (galleryTab === 'IMAGE' && img.type !== 'image') return false;
          if (galleryTab === 'VIDEO' && img.type !== 'video') return false;
          
          // Filter by Search (URL or Tags)
          if (gallerySearch.trim()) {
              const query = gallerySearch.toLowerCase();
              const urlMatch = img.url.toLowerCase().includes(query);
              const tagMatch = img.tags?.some(t => t.toLowerCase().includes(query));
              return urlMatch || tagMatch;
          }
          return true;
      });

      // Sort
      filtered.sort((a, b) => {
          return gallerySort === 'NEWEST' 
              ? b.addedAt - a.addedAt 
              : a.addedAt - b.addedAt;
      });

      return filtered;
  }, [galleryImages, galleryTab, gallerySort, gallerySearch]);

  const filteredSessions = useMemo(() => {
      // 1. Filter
      let result = sessions.filter(s => {
          const matchSearch = (s.customTitle || s.heroName).toLowerCase().includes(searchQuery.toLowerCase());
          const matchGenre = filterGenre === 'ALL' || s.genre === filterGenre;
          return matchSearch && matchGenre;
      });

      // 2. Sort
      result = result.sort((a, b) => {
          const metaA = sessionMetas[a.id!] || { lastActiveTimestamp: a.createdAt, turnCount: 0 };
          const metaB = sessionMetas[b.id!] || { lastActiveTimestamp: b.createdAt, turnCount: 0 };

          if (sortBy === 'RECENT') {
              return metaB.lastActiveTimestamp - metaA.lastActiveTimestamp;
          } else if (sortBy === 'OLDEST') {
              return metaA.lastActiveTimestamp - metaB.lastActiveTimestamp;
          } else if (sortBy === 'PROGRESS') {
              return metaB.turnCount - metaA.turnCount;
          }
          return 0;
      });

      return result;
  }, [sessions, searchQuery, filterGenre, sortBy, sessionMetas]);

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const onRequestDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await (db as any).transaction('rw', db.sessions, db.turns, db.encyclopedia, async () => {
           await db.sessions.delete(id);
           await db.turns.where('sessionId').equals(id).delete();
           await db.encyclopedia.where('sessionId').equals(id).delete();
      });
      setSessions(prev => prev.filter(s => s.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Delete failed", err);
      alert("Lỗi khi xóa dữ liệu. Vui lòng thử lại.");
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirmId(null);
  };

  // --- QUICK UNDO LOGIC ---
  const handleQuickUndo = async (e: React.MouseEvent, sessionId: number) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!window.confirm("Thao tác này sẽ xóa 1 lượt chơi gần nhất để sửa lỗi Crash/Màn hình đen. Bạn có chắc chắn?")) return;

      try {
          const turns = await db.turns.where('sessionId').equals(sessionId).toArray();
          if (turns.length === 0) {
              alert("Chưa có lượt chơi nào để xóa!");
              return;
          }

          const sortedTurns = turns.sort((a, b) => a.turnIndex - b.turnIndex);
          let countToRemove = 0;
          const lastTurn = sortedTurns[sortedTurns.length - 1];

          // If last turn is model, remove model + user (2). If user (stuck), remove 1.
          if (lastTurn.role === 'model') countToRemove = 2;
          else countToRemove = 1;

          if (countToRemove > sortedTurns.length) countToRemove = sortedTurns.length;

          const turnsToRemove = sortedTurns.slice(-countToRemove);
          const idsToRemove = turnsToRemove.map(t => t.id!);

          await db.turns.bulkDelete(idsToRemove);

          // Refresh Meta
          const newRawCount = await db.turns.where('sessionId').equals(sessionId).count();
          const newCount = Math.floor(newRawCount / 2);
          setSessionMetas(prev => ({
              ...prev,
              [sessionId]: { ...prev[sessionId], turnCount: newCount }
          }));

          alert("Đã tua ngược thành công! Hãy thử vào lại game.");
      } catch (err) {
          console.error("Quick undo failed", err);
          alert("Lỗi khi tua ngược.");
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        
        // CASE 1: Standard App Format
        if (data.session && data.turns) {
           // Pass gallery if present in save file
           onLoadGame(data.session, data.turns, data.encyclopedia, data.gallery);
           return;
        }
        
        // CASE 2: "RAG Export" Format (gameData wrapper)
        if (data.gameData && data.gameData.settings) {
            console.log("Detected RAG Export format, mapping data...");
            const gd = data.gameData;
            const settings = gd.settings;
            
            // Map Mechanics
            const mechanics: GameMechanics = {
                reputation: !!settings.reputationSystemEnabled,
                survival: !!settings.survivalElementsEnabled,
                crafting: !!settings.craftingSystemEnabled,
                combat: !!settings.combatSystemEnabled,
                time: !!settings.timeSystemEnabled,
                currency: !!settings.currencySystemEnabled,
                backpack: !!settings.deepInventoryCustomizationEnabled,
                autoCodex: !!settings.autoCodexEnabled,
                livingWorld: false // Add default for missing property
            };

            // Map Session
            const mappedSession: GameSession = {
                heroName: settings.characterName || "Vô Danh",
                customTitle: settings.saveGameName || "RAG Imported",
                gender: settings.characterGender || "Nam",
                // Safe cast genre or default
                genre: (Object.values(GameGenre).includes(settings.genre as any) ? settings.genre : GameGenre.CULTIVATION) as GameGenre,
                worldSettings: {
                    worldContext: settings.initialWorldLore || "",
                    plotDirection: settings.initialPlot || "",
                    majorFactions: settings.factionInput || "",
                    keyNpcs: settings.keyNPCsInput || "",
                    openingStory: ""
                },
                characterTraits: {
                    spiritualRoot: "Không rõ (Imported)",
                    talents: [],
                    personality: settings.characterBackstory || "Bình thường"
                },
                createdAt: Date.now(),
                isNSFW: !!settings.allowNsfw,
                nsfwIntensity: settings.isHardcore ? 'extreme' : 'soft',
                writingStyle: 'convert', // Default
                nsfwFocus: [],
                pronounRules: settings.useConvertStylePronouns ? "Convert style (Huynh/Đệ/Tại hạ)" : "",
                aiModel: 'gemini-3-pro-preview',
                mechanics: mechanics,
                summary: "",
                memoryDepth: 'standard'
            };

            // Map Turns from History
            const mappedTurns: Turn[] = (gd.storyHistory || []).map((item: any, idx: number) => {
                let statsSnapshot = undefined;
                
                // Try to reconstruct stats for the raw JSON if available in snapshot
                if (item.characterStatsSnapshot || item.inventorySnapshot) {
                    const attributes = item.characterStatsSnapshot 
                        ? Object.entries(item.characterStatsSnapshot).map(([k, v]) => ({ key: k, value: String(v) }))
                        : [];
                    
                    const inventory = item.inventorySnapshot 
                        ? item.inventorySnapshot.map((i: any) => i.Name) 
                        : [];

                    statsSnapshot = {
                        name: mappedSession.heroName,
                        realm: "Unknown", 
                        status: "Active",
                        inventory: inventory,
                        attributes: attributes,
                        currentTime: item.currentTimeOfDaySnapshot || ""
                    };
                }

                return {
                    sessionId: 0, // Placeholder
                    turnIndex: item.originalIndex ?? idx,
                    role: item.type === 'user_custom_action' ? 'user' : 'model',
                    userPrompt: item.type === 'user_custom_action' ? item.content : undefined,
                    narrative: item.type === 'story' ? item.content : undefined,
                    // Reconstruct raw JSON for model turns to allow UI to show stats
                    rawResponseJSON: item.type === 'story' ? JSON.stringify({
                        narrative: item.content,
                        stats: statsSnapshot,
                        isGameOver: false
                    }) : undefined
                };
            });

            // *** CRITICAL UPDATE: FORCE UPDATE LATEST STATE FROM GLOBAL GAMEDATA ***
            const lastModelTurnIndex = mappedTurns.map(t => t.role).lastIndexOf('model');
            if (lastModelTurnIndex !== -1) {
                const targetTurn = mappedTurns[lastModelTurnIndex];
                
                let jsonBody: any = {};
                try {
                    jsonBody = targetTurn.rawResponseJSON ? JSON.parse(targetTurn.rawResponseJSON) : {};
                } catch {}

                // Map Global Inventory
                const currentInventory = gd.inventoryItems 
                    ? gd.inventoryItems.map((i: any) => i.Name) 
                    : (jsonBody.stats?.inventory || []);

                // Map Global Attributes
                const currentAttributes = gd.characterStats
                    ? Object.entries(gd.characterStats).map(([k, v]) => ({ key: k, value: String(v) }))
                    : (jsonBody.stats?.attributes || []);

                // Map Currency
                 const currentCurrency = (gd.currencies && gd.currencies.length > 0) 
                    ? `${gd.currencies[0].Amount} ${gd.currencies[0].Name}` 
                    : "";

                // Construct Latest Stats Object
                const latestStats = {
                    ...(jsonBody.stats || {}),
                    name: mappedSession.heroName,
                    inventory: currentInventory,
                    attributes: currentAttributes,
                    currentTime: gd.currentTimeOfDay || jsonBody.stats?.currentTime || "",
                    currency: currentCurrency,
                    status: "Active",
                    // Preserve map data if exists in history, else undefined
                    mapData: jsonBody.stats?.mapData
                };

                // Inject into the turn
                jsonBody.stats = latestStats;
                targetTurn.rawResponseJSON = JSON.stringify(jsonBody);
            }

            // Map Encyclopedia
            const mappedWiki: RegistryEntry[] = (gd.knowledgeBase || []).map((kb: any) => {
                const tags = Array.isArray(kb.tags) ? kb.tags : [];
                let type: any = 'KNOWLEDGE';
                if (tags.some((t: string) => t.toLowerCase().includes('nhân vật'))) type = 'NPC';
                else if (tags.some((t: string) => t.toLowerCase().includes('địa điểm'))) type = 'LOCATION';
                else if (tags.some((t: string) => t.toLowerCase().includes('vật phẩm'))) type = 'ITEM';
                else if (tags.some((t: string) => t.toLowerCase().includes('kỹ năng'))) type = 'SKILL';
                else if (tags.some((t: string) => t.toLowerCase().includes('thế lực'))) type = 'FACTION';

                return {
                    sessionId: 0,
                    name: kb.name,
                    type: type,
                    description: kb.description || "",
                    // Prefer details if description is empty, or append it
                    secrets: kb.details || "",
                    firstSeenTurn: 0,
                    status: "Imported"
                };
            });

            onLoadGame(mappedSession, mappedTurns, mappedWiki);
            return;
        }

        alert("File save không hợp lệ hoặc bị lỗi.");
      } catch (err) {
        console.error(err);
        alert("Không thể đọc file save.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCardClick = (sessionId: number) => {
      if (deleteConfirmId !== sessionId && editingTitleId !== sessionId) {
          onContinueSession(sessionId);
          setShowLibrary(false);
      }
  };

  // --- RENAME LOGIC ---
  const startEditingTitle = (e: React.MouseEvent, session: GameSession) => {
      e.preventDefault();
      e.stopPropagation();
      setEditingTitleId(session.id!);
      setTempTitle(session.customTitle || session.heroName);
  };

  const cancelEditingTitle = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setEditingTitleId(null);
      setTempTitle('');
  };

  const saveTitle = async (e: React.MouseEvent, id: number) => {
      e.preventDefault();
      e.stopPropagation();
      if (!tempTitle.trim()) return;

      try {
          await db.sessions.update(id, { customTitle: tempTitle });
          setSessions(prev => prev.map(s => s.id === id ? { ...s, customTitle: tempTitle } : s));
          setEditingTitleId(null);
      } catch (err) {
          console.error("Failed to rename", err);
          alert("Lỗi khi đổi tên.");
      }
  };

  // --- EXPORT LOGIC ---
  const handleExportSession = async (e: React.MouseEvent, session: GameSession) => {
      e.preventDefault();
      e.stopPropagation();
      try {
          const turnsToSave = await db.turns.where('sessionId').equals(session.id!).toArray();
          const wikiToSave = await db.encyclopedia.where('sessionId').equals(session.id!).toArray();
          const galleryToSave = await db.imageGallery.toArray(); // EXPORT GALLERY
          
          const data = {
              session: session,
              turns: turnsToSave,
              encyclopedia: wikiToSave,
              gallery: galleryToSave, // Add gallery to save file
              exportDate: new Date().toISOString(),
              version: "1.0"
          };
          
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const rawName = session.customTitle || session.heroName || 'nameless';
          const fileName = rawName.replace(/[^a-z0-9\u00C0-\u017F\s\-_]/gi, '_').replace(/_+/g, '_').trim();
          
          a.download = `${fileName}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (err) {
          console.error("Export failed", err);
          alert("Lỗi khi xuất file save.");
      }
  };

  // --- TEMPLATE LOGIC ---
  const handleTemplateClick = (e: React.MouseEvent, session: GameSession) => {
      e.preventDefault();
      e.stopPropagation();
      if (onUseTemplate) {
          onUseTemplate(session);
      }
  };

  // --- GALLERY LOGIC ---
  const handleGalleryFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      let addedCount = 0;
      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const isImage = file.type.startsWith('image/');
          const isVideo = file.type.startsWith('video/');

          if (!isImage && !isVideo) continue;

          try {
              const base64 = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
              });

              await db.imageGallery.add({
                  url: base64,
                  type: isImage ? 'image' : 'video',
                  addedAt: Date.now() + i,
                  tags: ['upload'] 
              });
              addedCount++;
          } catch (err) {
              console.error("Error reading file", file.name, err);
          }
      }

      if (addedCount > 0) {
          const updated = await db.imageGallery.orderBy('addedAt').reverse().toArray();
          setGalleryImages(updated);
          alert(`Đã thêm ${addedCount} file vào Kho Ảnh!`);
      }
      e.target.value = '';
  };

  const handleAddUrlToGallery = async () => {
      if(!newImageUrl) return;
      try {
          const isVideo = newImageUrl.endsWith('.mp4') || newImageUrl.endsWith('.webm');
          const tagsArray = inputTags.split(',').map(t => t.trim()).filter(Boolean);
          
          await db.imageGallery.add({
              url: newImageUrl,
              type: isVideo ? 'video' : 'image',
              addedAt: Date.now(),
              tags: tagsArray
          });
          setNewImageUrl('');
          setInputTags('');
          const updated = await db.imageGallery.orderBy('addedAt').reverse().toArray();
          setGalleryImages(updated);
      } catch(e) { alert("Lỗi khi thêm URL."); }
  };

  const handleDeleteGalleryImage = (id: number) => {
      setConfirmation({
          isOpen: true,
          title: "Xác Nhận Xóa",
          message: "Bạn có chắc chắn muốn xóa ảnh/video này khỏi kho không?",
          onConfirm: async () => {
              await db.imageGallery.delete(id);
              const updated = await db.imageGallery.orderBy('addedAt').reverse().toArray();
              setGalleryImages(updated);
              if(selectedImage?.id === id) setSelectedImage(null);
              setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
          }
      });
  };

  const handleSetGlobalBg = () => {
      if(!selectedImage) return;
      setGlobalBgUrl(selectedImage.url);
      setGlobalBgType(selectedImage.type);
      localStorage.setItem('td_global_bg_url', selectedImage.url);
      localStorage.setItem('td_global_bg_type', selectedImage.type);
      alert("Đã đổi nền Menu Chính!");
  };

  const handleSetGlobalLogo = () => {
      if(!selectedImage || selectedImage.type !== 'image') {
          alert("Vui lòng chọn một ảnh để làm Logo.");
          return;
      }
      setGlobalLogoUrl(selectedImage.url);
      localStorage.setItem('td_global_logo_url', selectedImage.url);
      alert("Đã đổi Logo ứng dụng!");
  };

  const handleApplyBulkBg = () => {
      if(!selectedImage) return;
      
      setConfirmation({
          isOpen: true,
          title: "Áp Dụng Hàng Loạt",
          message: "Bạn có chắc muốn đổi hình nền cho TẤT CẢ các file save không? Hành động này không thể hoàn tác.",
          onConfirm: async () => {
              setIsBulkUpdating(true);
              try {
                  await (db as any).transaction('rw', db.sessions, async () => {
                      await db.sessions.toCollection().modify({ 
                          backgroundImageUrl: selectedImage.url,
                          backgroundType: selectedImage.type
                      });
                  });
                  
                  const updatedSessions = await db.sessions.orderBy('createdAt').reverse().toArray();
                  setSessions(updatedSessions);
                  
                  alert("Đã cập nhật tất cả file save!");
                  setShowGalleryModal(false);
                  setSelectedImage(null);
              } catch (e) {
                  console.error("Bulk update failed", e);
                  alert("Lỗi khi cập nhật.");
              } finally {
                  setIsBulkUpdating(false);
                  setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
              }
          }
      });
  };

  // --- GLOBAL SETTINGS LOGIC ---
  const handleGlobalBgFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setGlobalBgUrl(reader.result as string);
              if (file.type.startsWith('video/')) {
                  setGlobalBgType('video');
              } else {
                  setGlobalBgType('image');
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setGlobalLogoUrl(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const saveGlobalSettings = () => {
      localStorage.setItem('td_global_bg_url', globalBgUrl);
      localStorage.setItem('td_global_bg_type', globalBgType);
      localStorage.setItem('td_global_logo_url', globalLogoUrl);
      setShowGlobalSettingsModal(false);
      window.location.reload(); 
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-transparent relative overflow-hidden font-serif selection:bg-gold-500/30 selection:text-gold-200"
         style={{
             backgroundImage: undefined, // Removed inline background image logic to use IMG tag instead
             backgroundSize: 'cover',
             backgroundPosition: 'center',
             backgroundAttachment: 'fixed',
         }}
    >
      
      {/* GLOBAL BACKGROUND RENDERING (VIDEO OR IMAGE) */}
      {globalBgType === 'video' && globalBgUrl ? (
          <video 
             key={globalBgUrl} // Force re-render on URL change
             autoPlay 
             loop 
             muted={true}
             playsInline 
             // Add hardware acceleration (transform-gpu) and visual tweaks
             className="absolute inset-0 w-full h-full object-cover z-0 filter contrast-[1.1] saturate-[1.1] brightness-90 transform-gpu will-change-transform" 
             src={globalBgUrl}
          />
      ) : globalBgType === 'image' && globalBgUrl ? (
          <img 
             src={globalBgUrl}
             alt="Background"
             className="absolute inset-0 w-full h-full object-cover z-0 filter contrast-[1.15] saturate-[1.1] brightness-90"
             style={{ imageRendering: 'high-quality' as any }} // Attempt browser-level upscaling
          />
      ) : null}

      {/* Background Effects / Overlay (Ensuring correct layering) */}
      <div className={`absolute inset-0 pointer-events-none z-0 ${globalBgUrl ? 'bg-black/60' : ''}`}>
        {!globalBgUrl && (
            <>
                <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-arcane-500/10 rounded-full blur-[150px] animate-pulse-slow"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-gold-500/5 rounded-full blur-[120px] animate-pulse-slow" style={{animationDelay: '2s'}}></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>
            </>
        )}
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
          {/* UPDATES BUTTON */}
          <button 
            onClick={() => setShowUpdatesModal(true)}
            className="group flex items-center gap-2 text-ink-500 hover:text-jade-400 p-2 rounded-full border border-transparent hover:border-jade-500/30 hover:bg-ink-900/50 transition-all"
            title="Nhật Ký Cập Nhật / Thông Tin Phiên Bản"
          >
              <i className="fas fa-bell text-xl animate-pulse-slow group-hover:animate-none"></i>
              <span className="hidden group-hover:inline text-xs font-bold text-jade-300 animate-slide-up">
                  v5.1 Info
              </span>
          </button>

          {/* TECH SPECS BUTTON (NEW) */}
          <button 
            onClick={() => setShowTechSpecsModal(true)}
            className="text-ink-500 hover:text-blue-400 p-2 rounded-full border border-transparent hover:border-blue-500/30 hover:bg-ink-900/50 transition-all"
            title="Thông Số Kỹ Thuật (Tech Specs)"
          >
              <i className="fas fa-microchip text-xl"></i>
          </button>

          {/* Global Config Button */}
          <button 
            onClick={() => setShowGlobalSettingsModal(true)}
            className="text-ink-500 hover:text-gold-400 p-2 rounded-full border border-transparent hover:border-gold-500/30 hover:bg-ink-900/50 transition-all"
            title="Cài đặt Giao Diện (Logo & Background)"
          >
              <i className="fas fa-cog text-xl"></i>
          </button>
      </div>

      <div className="relative z-10 w-full max-w-5xl px-6 flex flex-col items-center space-y-12 py-10">
        
        {/* Title Section with DYNAMIC LOGO */}
        <div className="space-y-4 animate-fade-in text-center">
            <div className="w-32 h-32 mx-auto mb-8 transform hover:scale-110 transition-transform duration-700 relative group cursor-pointer" onClick={() => setShowGlobalSettingsModal(true)} title="Nhấn để đổi Logo">
               <div className="absolute inset-0 bg-gold-500/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-700 animate-pulse-slow"></div>
               <img 
                 src={globalLogoUrl} 
                 alt="TAlE LOGO" 
                 className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_25px_rgba(234,179,8,0.4)]"
               />
               <div className="absolute -bottom-2 right-0 bg-ink-900 text-gold-500 text-[10px] p-1 rounded-full border border-gold-500/50 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                   <i className="fas fa-pen"></i>
               </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold-300 via-parchment-100 to-spirit-300 drop-shadow-[0_0_25px_rgba(234,179,8,0.3)] pb-2">
              Infinity Tale
            </h1>
            <h2 className="text-2xl md:text-3xl font-display text-gold-500/80 tracking-[0.4em] uppercase font-light border-t border-b border-gold-500/30 py-3 relative inline-block">
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gold-500 rotate-45"></span>
              Simulator
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-gold-500 rotate-45"></span>
            </h2>

            {/* VERSION DISPLAY */}
            <div className="text-3xl md:text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-jade-400 via-spirit-400 to-arcane-400 mt-2 mb-4 drop-shadow-lg animate-pulse-slow tracking-wider cursor-pointer hover:scale-105 transition-transform" onClick={() => setShowUpdatesModal(true)}>
                v5.1 - Infinity Tale
            </div>

            {/* NEW CREDIT LINE */}
            <div className="mt-2 text-xl md:text-3xl font-bold text-gold-400 font-display drop-shadow-[0_0_15px_rgba(234,179,8,0.6)] animate-pulse">
                Phát Triển: Nguyễn Hoàng - Cre; Zesty
            </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-lg space-y-4 animate-slide-up" style={{animationDelay: '0.2s'}}>
          <button 
            onClick={onNewGame}
            className="group w-full relative py-4 px-6 bg-ink-900/60 hover:bg-gold-900/20 border border-gold-500/40 hover:border-gold-400 rounded-xl backdrop-blur-md transition-all duration-300 overflow-hidden shadow-[0_0_20px_rgba(234,179,8,0.1)] hover:shadow-[0_0_30px_rgba(234,179,8,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-gold-500/0 via-gold-500/10 to-gold-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            <div className="flex items-center justify-center gap-4">
               <i className="fas fa-scroll text-gold-400 group-hover:scale-110 transition-transform text-xl"></i>
               <span className="text-xl font-bold text-parchment-100 group-hover:text-white tracking-wide font-display">Khởi Tạo Thế Giới Mới</span>
            </div>
          </button>

          {/* CONTINUE / LIBRARY BUTTON */}
          <button 
            onClick={() => setShowLibrary(true)}
            className="group w-full relative py-4 px-6 bg-ink-900/60 hover:bg-arcane-900/20 border border-arcane-500/30 hover:border-arcane-400 rounded-xl backdrop-blur-md transition-all duration-300 overflow-hidden shadow-lg hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]"
          >
             <div className="absolute inset-0 bg-gradient-to-r from-arcane-500/0 via-arcane-500/10 to-arcane-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
             <div className="flex items-center justify-center gap-4">
               <i className="fas fa-book-journal-whills text-arcane-400 group-hover:scale-110 transition-transform text-xl"></i>
               <div className="flex flex-col items-start">
                   <span className="text-lg font-bold text-parchment-100 group-hover:text-white tracking-wide font-display">Thư Viện Thiên Mệnh</span>
                   <span className="text-[10px] text-ink-400 uppercase tracking-widest group-hover:text-arcane-300 transition-colors">Tiếp tục hành trình ({sessions.length})</span>
               </div>
            </div>
          </button>

          <div className="flex gap-2">
              <button 
                onClick={handleLoadClick}
                className="flex-1 group relative py-3 px-6 bg-ink-900/60 hover:bg-spirit-900/20 border border-spirit-500/30 hover:border-spirit-400 rounded-xl backdrop-blur-md transition-all duration-300 overflow-hidden shadow-lg hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-spirit-500/0 via-spirit-500/10 to-spirit-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <div className="flex items-center justify-center gap-2">
                   <i className="fas fa-file-import text-spirit-400 group-hover:scale-110 transition-transform"></i>
                   <span className="text-xs font-bold text-parchment-300 group-hover:text-white tracking-wide">Nhập Save</span>
                </div>
              </button>

              <button 
                onClick={() => setShowGalleryModal(true)}
                className="flex-1 group relative py-3 px-6 bg-ink-900/60 hover:bg-pink-900/20 border border-pink-500/30 hover:border-pink-400 rounded-xl backdrop-blur-md transition-all duration-300 overflow-hidden shadow-lg hover:shadow-[0_0_20px_rgba(244,114,182,0.2)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-pink-500/0 via-pink-500/10 to-pink-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <div className="flex items-center justify-center gap-2">
                   <i className="fas fa-images text-pink-400 group-hover:scale-110 transition-transform"></i>
                   <span className="text-xs font-bold text-parchment-300 group-hover:text-white tracking-wide">Kho Ảnh</span>
                </div>
              </button>

              <button 
                onClick={() => setShowApiModal(true)}
                className="flex-1 group relative py-3 px-6 bg-ink-900/60 hover:bg-emerald-900/20 border border-emerald-500/30 hover:border-emerald-400 rounded-xl backdrop-blur-md transition-all duration-300 overflow-hidden shadow-lg hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <div className="flex items-center justify-center gap-2">
                   <i className="fas fa-key text-emerald-400 group-hover:scale-110 transition-transform"></i>
                   <span className="text-xs font-bold text-parchment-300 group-hover:text-white tracking-wide">API Keys</span>
                </div>
              </button>
          </div>
          
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
        </div>

        {/* Footer */}
        <div className="text-[10px] text-ink-500 uppercase tracking-widest font-bold flex flex-wrap justify-center gap-4 mt-auto">
           <span>v5.1 Pronoun Sync</span>
           <span className="text-gold-500/50 hidden md:inline">•</span>
           <span>Powered by Gemini 3.1</span>
        </div>
      </div>

      {/* LIBRARY MODAL */}
      {showLibrary && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowLibrary(false)}>
          <div className="bg-ink-900 border border-arcane-500/30 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
             {/* Header */}
             <div className="p-6 border-b border-white/10 bg-ink-950/50 flex justify-between items-center">
                 <h3 className="text-xl font-display font-bold text-arcane-400 flex items-center gap-2">
                     <i className="fas fa-book-journal-whills"></i> Tiếp Tục Hành Trình
                 </h3>
                 <button onClick={() => setShowLibrary(false)} className="text-ink-500 hover:text-white"><i className="fas fa-times"></i></button>
             </div>

             {/* Controls: Search, Filter, Sort */}
             <div className="p-4 bg-ink-950/30 border-b border-white/5 flex flex-col md:flex-row gap-4">
                 <input
                    type="text"
                    placeholder="Tìm kiếm đạo hiệu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-ink-900 border border-ink-700 rounded px-4 py-2 text-sm text-parchment-200 outline-none focus:border-arcane-500 flex-1"
                 />
                 <select
                    value={filterGenre}
                    onChange={(e) => setFilterGenre(e.target.value)}
                    className="bg-ink-900 border border-ink-700 rounded px-4 py-2 text-sm text-ink-400 outline-none"
                 >
                     <option value="ALL">Tất cả thể loại</option>
                     {Object.values(GameGenre).map(g => <option key={g} value={g}>{g}</option>)}
                 </select>
                 <div className="flex gap-1 bg-ink-900 rounded p-1 border border-ink-700">
                     {(['RECENT', 'PROGRESS', 'OLDEST'] as SortOption[]).map(opt => (
                         <button
                            key={opt}
                            onClick={() => setSortBy(opt)}
                            className={`px-3 py-1 rounded text-xs font-bold ${sortBy === opt ? 'bg-arcane-600 text-white' : 'text-ink-500 hover:text-ink-300'}`}
                         >
                             {opt === 'RECENT' ? 'Mới' : opt === 'PROGRESS' ? 'Tiến độ' : 'Cũ'}
                         </button>
                     ))}
                 </div>
             </div>

             {/* Session Grid */}
             <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-ink-700 bg-black/20">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {filteredSessions.map(session => {
                         const meta = sessionMetas[session.id!] || { realm: '...', turnCount: 0, lastActive: '...' };
                         return (
                             <div key={session.id} onClick={() => handleCardClick(session.id!)} className="group bg-ink-900/80 border border-ink-700 hover:border-arcane-500 rounded-xl p-4 cursor-pointer transition-all hover:bg-ink-800 relative overflow-hidden shadow-lg">
                                 {/* Background Image Overlay */}
                                 {session.backgroundImageUrl && (
                                     <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                                         {session.backgroundType === 'video' ? (
                                             <video src={session.backgroundImageUrl} className="w-full h-full object-cover" muted />
                                         ) : (
                                             <img src={session.backgroundImageUrl} className="w-full h-full object-cover" alt="bg" />
                                         )}
                                     </div>
                                 )}

                                 <div className="relative z-10">
                                     <div className="flex justify-between items-start mb-2">
                                         <div>
                                             {editingTitleId === session.id ? (
                                                 <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                     <input
                                                        autoFocus
                                                        type="text"
                                                        value={tempTitle}
                                                        onChange={e => setTempTitle(e.target.value)}
                                                        className="bg-ink-950 border border-gold-500 rounded px-1 py-0.5 text-xs text-parchment-100 outline-none w-32"
                                                     />
                                                     <button onClick={(e) => saveTitle(e, session.id!)} className="text-green-500 hover:text-green-400"><i className="fas fa-check"></i></button>
                                                     <button onClick={cancelEditingTitle} className="text-red-500 hover:text-red-400"><i className="fas fa-times"></i></button>
                                                 </div>
                                             ) : (
                                                 <h4 className="font-bold text-parchment-100 group-hover:text-gold-400 transition-colors truncate max-w-[180px] flex items-center gap-2">
                                                     {session.customTitle || session.heroName}
                                                     <button onClick={(e) => startEditingTitle(e, session)} className="text-ink-600 hover:text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-pen text-[10px]"></i></button>
                                                 </h4>
                                             )}
                                             <div className="text-[10px] text-ink-500 uppercase font-bold tracking-wider">{session.genre}</div>
                                         </div>
                                         {deleteConfirmId === session.id ? (
                                             <div className="flex gap-2 bg-ink-950 p-1 rounded border border-crimson-500/50" onClick={e => e.stopPropagation()}>
                                                 <span className="text-[10px] text-crimson-400 font-bold">Xóa?</span>
                                                 <button onClick={(e) => handleConfirmDelete(e, session.id!)} className="text-crimson-500 hover:text-crimson-300"><i className="fas fa-check"></i></button>
                                                 <button onClick={handleCancelDelete} className="text-ink-400 hover:text-white"><i className="fas fa-times"></i></button>
                                             </div>
                                         ) : (
                                             <button onClick={(e) => onRequestDelete(e, session.id!)} className="text-ink-600 hover:text-crimson-500 transition-colors p-1"><i className="fas fa-trash-alt"></i></button>
                                         )}
                                     </div>

                                     <div className="space-y-1 mb-4">
                                         <div className="flex justify-between text-xs text-ink-400">
                                             <span><i className="fas fa-scroll mr-1"></i> {meta.turnCount} lượt</span>
                                             <span><i className="far fa-clock mr-1"></i> {meta.lastActive}</span>
                                         </div>
                                         <div className="text-xs text-arcane-400 font-bold"><i className="fas fa-crown mr-1"></i> {meta.realm}</div>
                                     </div>

                                     <div className="flex gap-2 border-t border-white/5 pt-3" onClick={e => e.stopPropagation()}>
                                         <button onClick={() => onContinueSession(session.id!)} className="flex-1 bg-ink-800 hover:bg-arcane-600 text-ink-300 hover:text-white py-1.5 rounded text-[10px] font-bold uppercase transition-colors border border-ink-700 hover:border-arcane-500">
                                             Tiếp Tục
                                         </button>
                                         <button onClick={(e) => handleTemplateClick(e, session)} className="px-2 bg-ink-800 hover:bg-gold-600 text-ink-400 hover:text-black rounded border border-ink-700 hover:border-gold-500 transition-colors" title="Dùng làm mẫu (Clone)">
                                             <i className="fas fa-copy"></i>
                                         </button>
                                         <button onClick={(e) => handleExportSession(e, session)} className="px-2 bg-ink-800 hover:bg-blue-600 text-ink-400 hover:text-white rounded border border-ink-700 hover:border-blue-500 transition-colors" title="Xuất file">
                                             <i className="fas fa-file-export"></i>
                                         </button>
                                         <button onClick={(e) => handleQuickUndo(e, session.id!)} className="px-2 bg-ink-800 hover:bg-crimson-600 text-ink-400 hover:text-white rounded border border-ink-700 hover:border-crimson-500 transition-colors" title="Sửa lỗi kẹt (Xóa turn cuối)">
                                             <i className="fas fa-wrench"></i>
                                         </button>
                                     </div>
                                 </div>
                             </div>
                         );
                     })}
                     {filteredSessions.length === 0 && (
                         <div className="col-span-full text-center py-20 text-ink-600">
                             <i className="fas fa-box-open text-4xl mb-2 opacity-50"></i>
                             <p>Không tìm thấy thiên mệnh nào.</p>
                         </div>
                     )}
                 </div>
             </div>
          </div>
        </div>
      )}

      {/* TECH SPECS MODAL */}
      {showTechSpecsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowTechSpecsModal(false)}>
              <div className="bg-ink-900 border border-blue-500/30 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden relative" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-white/10 bg-ink-950/50 flex justify-between items-center">
                      <h3 className="text-xl font-display font-bold text-blue-400 flex items-center gap-2">
                          <i className="fas fa-microchip"></i> Thông Số Kỹ Thuật (Tech Specs)
                      </h3>
                      <button onClick={() => setShowTechSpecsModal(false)} className="text-ink-500 hover:text-white"><i className="fas fa-times"></i></button>
                  </div>

                  <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4 bg-ink-900/80">
                      {TECH_SPECS.map((spec, index) => (
                          <div key={index} className="bg-ink-950/50 p-4 rounded-lg border border-white/5 hover:border-blue-500/20 transition-colors">
                              <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-bold text-parchment-100">{spec.label}</span>
                                  <span className="text-xs font-mono font-bold text-blue-300 bg-blue-900/20 px-2 py-1 rounded border border-blue-500/30">
                                      {spec.value}
                                  </span>
                              </div>
                              <p className="text-xs text-ink-400 leading-relaxed">{spec.desc}</p>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* UPDATES MODAL */}
      {showUpdatesModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowUpdatesModal(false)}>
              <div className="bg-ink-900 border border-jade-500/30 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden relative" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-white/10 bg-ink-950/50 flex justify-between items-center">
                      <h3 className="text-xl font-display font-bold text-jade-400 flex items-center gap-2">
                          <i className="fas fa-scroll"></i> Thông Số Phiên Bản
                      </h3>
                      <button onClick={() => setShowUpdatesModal(false)} className="text-ink-500 hover:text-white"><i className="fas fa-times"></i></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6 bg-ink-900/80">
                      {UPDATE_LOGS.map((log, index) => (
                          <div key={index} className="relative pl-6 border-l-2 border-ink-700">
                              <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${index === 0 ? 'bg-jade-500 border-jade-300 animate-pulse' : 'bg-ink-800 border-ink-600'}`}></div>
                              <div className="mb-2">
                                  <span className={`text-sm font-bold ${index === 0 ? 'text-jade-400' : 'text-parchment-200'}`}>{log.version}</span>
                                  <span className="text-[10px] text-ink-500 ml-2">({log.date})</span>
                              </div>
                              <div className="bg-ink-950/50 p-3 rounded-lg border border-white/5">
                                  <div className="text-[10px] font-bold text-gold-500 uppercase mb-2 tracking-wider flex items-center gap-1">
                                      <i className="fas fa-user-edit"></i> {log.author === "Zesty" ? "Nguồn: Zesty" : "Phát triển: Nguyễn Hoàng"}
                                  </div>
                                  <ul className="list-disc list-inside space-y-1">
                                      {log.details.map((d, i) => (
                                          <li key={i} className="text-xs text-ink-300 leading-relaxed">{d}</li>
                                      ))}
                                  </ul>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* GLOBAL SETTINGS MODAL */}
      {showGlobalSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
             <div className="bg-ink-900 border border-gold-500/30 rounded-xl w-full max-w-md shadow-2xl p-6">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-display font-bold text-gold-400 flex items-center gap-2">
                        <i className="fas fa-tools"></i> Cài đặt Giao Diện
                    </h3>
                    <button onClick={() => setShowGlobalSettingsModal(false)} className="text-ink-500 hover:text-white"><i className="fas fa-times"></i></button>
                 </div>
                 
                 <div className="space-y-6 mb-6">
                     <div>
                        <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block mb-2">Hình Nền Menu Chính</label>
                        <div className="flex gap-2">
                            <input type="text" value={globalBgUrl} onChange={(e) => setGlobalBgUrl(e.target.value)} placeholder="URL..." className="flex-1 w-full bg-ink-950 border border-ink-700 rounded p-2 text-sm text-parchment-200" />
                            <button onClick={() => globalBgInputRef.current?.click()} className="bg-ink-800 border border-ink-600 px-3 rounded"><i className="fas fa-upload text-ink-400"></i></button>
                            <input type="file" ref={globalBgInputRef} onChange={handleGlobalBgFileChange} accept="image/*,video/*" className="hidden" />
                        </div>
                        <div className="mt-2 flex gap-2">
                             <button onClick={() => setGlobalBgType('image')} className={`text-[10px] px-2 py-1 rounded ${globalBgType === 'image' ? 'bg-gold-600 text-black' : 'bg-ink-800 text-ink-500'}`}>Ảnh</button>
                             <button onClick={() => setGlobalBgType('video')} className={`text-[10px] px-2 py-1 rounded ${globalBgType === 'video' ? 'bg-gold-600 text-black' : 'bg-ink-800 text-ink-500'}`}>Video</button>
                        </div>
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block mb-2">Logo Ứng Dụng</label>
                        <div className="flex gap-2">
                            <input type="text" value={globalLogoUrl} onChange={(e) => setGlobalLogoUrl(e.target.value)} placeholder="URL..." className="flex-1 w-full bg-ink-950 border border-ink-700 rounded p-2 text-sm text-parchment-200" />
                            <button onClick={() => logoInputRef.current?.click()} className="bg-ink-800 border border-ink-600 px-3 rounded"><i className="fas fa-upload text-ink-400"></i></button>
                            <input type="file" ref={logoInputRef} onChange={handleLogoFileChange} accept="image/*" className="hidden" />
                        </div>
                     </div>
                 </div>
                 <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                     <button onClick={() => setShowGlobalSettingsModal(false)} className="px-4 py-2 rounded text-xs font-bold text-ink-400">Hủy</button>
                     <button onClick={saveGlobalSettings} className="px-4 py-2 rounded bg-gold-600 text-black text-xs font-bold shadow-lg">Lưu Cài Đặt</button>
                 </div>
             </div>
          </div>
      )}

      {/* GALLERY / BULK UPDATE MODAL */}
      {showGalleryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
             <div className="bg-ink-900 border border-pink-500/30 rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
                 {/* Header */}
                 <div className="flex justify-between items-center p-6 border-b border-white/5 bg-ink-950/50">
                     <h3 className="text-xl font-display font-bold text-pink-400 flex items-center gap-2"><i className="fas fa-images"></i> Kho Ảnh (Global Gallery)</h3>
                     <button onClick={() => { setShowGalleryModal(false); setSelectedImage(null); }} className="text-ink-500 hover:text-white"><i className="fas fa-times"></i></button>
                 </div>

                 {/* Filters Bar */}
                 <div className="p-4 bg-ink-950/30 border-b border-white/5 flex flex-col gap-4">
                     <div className="flex justify-between items-center">
                         {/* Tabs */}
                         <div className="flex bg-ink-900 rounded-lg p-1 border border-ink-700">
                             {(['IMAGE', 'VIDEO'] as const).map(tab => (
                                 <button
                                     key={tab}
                                     onClick={() => setGalleryTab(tab)}
                                     className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${galleryTab === tab ? 'bg-pink-600 text-white shadow-md' : 'text-ink-500 hover:text-ink-300'}`}
                                 >
                                     {tab === 'IMAGE' ? 'Ảnh' : 'Video'}
                                 </button>
                             ))}
                         </div>

                         {/* Sort */}
                         <button
                             onClick={() => setGallerySort(prev => prev === 'NEWEST' ? 'OLDEST' : 'NEWEST')}
                             className="flex items-center gap-2 text-[10px] font-bold text-ink-400 hover:text-pink-400 transition-colors"
                         >
                             <i className={`fas ${gallerySort === 'NEWEST' ? 'fa-sort-amount-down' : 'fa-sort-amount-up'}`}></i>
                             {gallerySort === 'NEWEST' ? 'Mới nhất' : 'Cũ nhất'}
                         </button>
                     </div>

                     {/* Search */}
                     <div className="relative">
                         <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 text-xs"></i>
                         <input
                             type="text"
                             value={gallerySearch}
                             onChange={(e) => setGallerySearch(e.target.value)}
                             placeholder="Tìm kiếm theo tag hoặc URL..."
                             className="w-full bg-ink-900 border border-ink-700 rounded-lg pl-9 pr-3 py-2 text-xs text-parchment-200 outline-none focus:border-pink-500"
                         />
                     </div>
                 </div>

                 <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-ink-700 flex flex-col gap-6">
                     {/* Upload Section */}
                     <div className="bg-ink-950/50 p-4 rounded-lg border border-ink-800 space-y-4">
                          <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block mb-2">Thêm Mới</label>
                          <div className="flex gap-2 flex-col md:flex-row">
                              <div className="flex-1 flex gap-2">
                                  <input 
                                      type="text" 
                                      value={newImageUrl} 
                                      onChange={(e) => setNewImageUrl(e.target.value)} 
                                      placeholder="Dán URL ảnh/video..." 
                                      className="flex-1 bg-ink-900 border border-ink-700 rounded p-2 text-sm text-parchment-200 outline-none focus:border-pink-500" 
                                  />
                                  <input 
                                      type="text"
                                      value={inputTags}
                                      onChange={(e) => setInputTags(e.target.value)}
                                      placeholder="Tags (vd: bg, dark)..."
                                      className="w-1/3 bg-ink-900 border border-ink-700 rounded p-2 text-sm text-parchment-200 outline-none focus:border-pink-500"
                                  />
                              </div>
                              <div className="flex gap-2 justify-end">
                                  <button 
                                      onClick={() => galleryFileInputRef.current?.click()}
                                      className="bg-ink-800 border border-ink-600 px-3 rounded text-ink-400 hover:text-pink-400"
                                      title="Tải lên từ thiết bị (Hỗ trợ chọn nhiều)"
                                  >
                                      <i className="fas fa-upload"></i>
                                  </button>
                                  <input 
                                      type="file" 
                                      ref={galleryFileInputRef} 
                                      onChange={handleGalleryFileUpload} 
                                      accept="image/*,video/*" 
                                      multiple 
                                      className="hidden" 
                                  />
                                  <button onClick={handleAddUrlToGallery} className="bg-pink-600 hover:bg-pink-500 text-white px-3 rounded text-xs font-bold whitespace-nowrap">
                                      <i className="fas fa-plus mr-1"></i> Thêm
                                  </button>
                              </div>
                          </div>
                     </div>

                     {/* Grid */}
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {processedGalleryImages.map(img => (
                              <div 
                                  key={img.id} 
                                  className={`group relative aspect-video bg-ink-950 rounded-lg overflow-hidden border transition-all cursor-pointer shadow-lg ${selectedImage?.id === img.id ? 'border-pink-500 ring-2 ring-pink-500/30' : 'border-ink-800 hover:border-pink-500/50'}`} 
                                  onClick={() => setSelectedImage(img)}
                              >
                                  {img.type === 'image' ? (
                                      <img src={img.url} alt="Gallery" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                  ) : (
                                      <video src={img.url} className="w-full h-full object-cover opacity-80" muted />
                                  )}
                                  
                                  {/* Tags Overlay */}
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 transform translate-y-full group-hover:translate-y-0 transition-transform flex flex-wrap gap-1">
                                      {img.tags?.map((t, i) => (
                                          <span key={i} className="text-[8px] bg-ink-700 text-ink-300 px-1 rounded">{t}</span>
                                      ))}
                                  </div>

                                  {/* Selection Overlay */}
                                  {selectedImage?.id === img.id && (
                                      <div className="absolute inset-0 bg-pink-500/20 flex items-center justify-center">
                                          <div className="bg-pink-600 text-white rounded-full p-2 shadow-lg animate-bounce">
                                              <i className="fas fa-check"></i>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          ))}
                          {processedGalleryImages.length === 0 && (
                              <div className="col-span-full text-center text-ink-600 text-xs italic py-8">
                                  {galleryImages.length === 0 ? "Chưa có ảnh nào trong kho." : "Không tìm thấy kết quả phù hợp."}
                              </div>
                          )}
                     </div>
                 </div>

                 {/* Action Bar */}
                 <div className="p-4 border-t border-white/10 bg-ink-950/50 flex justify-between items-center">
                     {selectedImage ? (
                         <div className="flex gap-2 w-full justify-end animate-slide-up">
                             <button 
                                 onClick={() => handleDeleteGalleryImage(selectedImage.id!)} 
                                 className="px-4 py-2 bg-ink-900 border border-ink-700 text-crimson-400 hover:bg-crimson-900/20 hover:border-crimson-500 rounded text-xs font-bold transition-all"
                             >
                                 <i className="fas fa-trash-alt mr-1"></i> Xóa
                             </button>
                             <div className="h-8 w-px bg-white/10 mx-2"></div>
                             
                             {/* NEW BUTTON: SET LOGO */}
                             <button 
                                 onClick={handleSetGlobalLogo} 
                                 className="px-4 py-2 bg-ink-900 border border-ink-700 text-jade-400 hover:bg-jade-900/20 hover:border-jade-500 rounded text-xs font-bold transition-all"
                             >
                                 <i className="fas fa-dragon mr-1"></i> Đặt làm Logo
                             </button>

                             <button 
                                 onClick={handleSetGlobalBg} 
                                 className="px-4 py-2 bg-ink-900 border border-ink-700 text-gold-400 hover:bg-gold-900/20 hover:border-gold-500 rounded text-xs font-bold transition-all"
                             >
                                 <i className="fas fa-desktop mr-1"></i> Đặt nền Menu Chính
                             </button>
                             <button 
                                 onClick={handleApplyBulkBg} 
                                 disabled={isBulkUpdating}
                                 className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded text-xs font-bold shadow-lg transition-all"
                             >
                                 <i className="fas fa-layer-group mr-1"></i> Áp dụng cho MỌI Save ({isBulkUpdating ? '...' : 'Bulk'})
                             </button>
                         </div>
                     ) : (
                         <div className="text-xs text-ink-500 italic w-full text-center">Chọn một ảnh để thao tác</div>
                     )}
                 </div>
             </div>
          </div>
      )}

      {/* API KEY MANAGEMENT MODAL */}
      {showApiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
             <div className="bg-ink-900 border border-emerald-500/30 rounded-xl w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col">
                 <div className="flex justify-between items-center p-6 border-b border-white/5 bg-ink-950/50">
                     <h3 className="text-xl font-display font-bold text-emerald-400 flex items-center gap-2">
                         <i className="fas fa-key"></i> Quản lý API Keys (Xoay vòng)
                     </h3>
                     <button onClick={() => setShowApiModal(false)} className="text-ink-500 hover:text-white"><i className="fas fa-times"></i></button>
                 </div>
                 
                 <div className="p-6 flex-1 overflow-y-auto">
                     <p className="text-sm text-parchment-300 mb-4">
                         Nhập danh sách Gemini API Key của bạn vào đây, <strong>mỗi Key nằm trên 1 dòng</strong>. 
                         Hệ thống sẽ tự động dùng Key đầu tiên. Nếu Key đó bị lỗi (quá tải, hết hạn mức), nó sẽ tự động chuyển sang Key tiếp theo mà không làm gián đoạn game.
                     </p>
                     
                     <textarea
                         value={apiKeysText}
                         onChange={(e) => setApiKeysText(e.target.value)}
                         placeholder="AIzaSy...&#10;AIzaSy...&#10;AIzaSy..."
                         className="w-full h-48 bg-ink-950/50 border border-ink-700/50 rounded-lg p-4 text-sm text-parchment-200 font-mono focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
                     />
                     
                     {apiKeysStatus && (
                         <div className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
                             apiKeysStatus.type === 'success' ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/30' : 
                             apiKeysStatus.type === 'error' ? 'bg-red-900/20 text-red-400 border border-red-500/30' : 
                             'bg-blue-900/20 text-blue-400 border border-blue-500/30'
                         }`}>
                             <i className={`fas ${apiKeysStatus.type === 'success' ? 'fa-check-circle' : apiKeysStatus.type === 'error' ? 'fa-exclamation-circle' : 'fa-spinner fa-spin'}`}></i>
                             {apiKeysStatus.message}
                         </div>
                     )}

                     {Object.keys(apiKeyUsage).length > 0 && (
                         <div className="mt-6 border-t border-white/10 pt-4">
                             <h4 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
                                 <i className="fas fa-chart-bar"></i> Thống kê Token đã dùng (Nội bộ)
                             </h4>
                             <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                 {Object.entries(apiKeyUsage).sort((a, b) => b[1] - a[1]).map(([key, tokens]) => {
                                     const isCurrent = key === activeApiKey;
                                     const maskedKey = key.length > 15 ? `${key.substring(0, 8)}...${key.substring(key.length - 4)}` : key;
                                     return (
                                         <div key={key} className={`flex justify-between items-center p-2 rounded ${isCurrent ? 'bg-emerald-900/30 border border-emerald-500/30' : 'bg-ink-900/50 border border-ink-700/30'}`}>
                                             <div className="flex items-center gap-2">
                                                 <span className="font-mono text-xs text-parchment-300">{maskedKey}</span>
                                                 {isCurrent && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Đang dùng</span>}
                                             </div>
                                             <span className="text-xs font-bold text-gold-400">{tokens.toLocaleString()} tokens</span>
                                         </div>
                                     );
                                 })}
                             </div>
                         </div>
                     )}
                 </div>
                 
                 <div className="p-4 border-t border-white/5 bg-ink-950/50 flex justify-end gap-3">
                     <button 
                         onClick={() => setShowApiModal(false)}
                         className="px-4 py-2 bg-ink-800 hover:bg-ink-700 text-parchment-300 rounded-lg text-sm font-bold transition-colors"
                     >
                         Đóng
                     </button>
                     <button 
                         onClick={handleSaveApiKeys}
                         disabled={isTestingKeys}
                         className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
                     >
                         {isTestingKeys ? <><i className="fas fa-spinner fa-spin"></i> Đang lưu...</> : <><i className="fas fa-save"></i> Lưu API Keys</>}
                     </button>
                 </div>
             </div>
          </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmation.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setConfirmation({ ...confirmation, isOpen: false })}>
              <div className="bg-ink-900 border border-gold-500/30 rounded-xl w-full max-w-sm shadow-2xl p-6 relative animate-slide-up" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-gold-400 mb-4 text-center border-b border-white/5 pb-2">{confirmation.title}</h3>
                  <div className="text-parchment-200 text-center mb-6 text-sm leading-relaxed">{confirmation.message}</div>
                  <div className="flex justify-center gap-4">
                      <button 
                          onClick={() => setConfirmation({ ...confirmation, isOpen: false })} 
                          className="px-5 py-2 rounded bg-ink-800 text-ink-400 hover:text-white text-xs font-bold border border-ink-700 hover:border-ink-500 transition-all"
                      >
                          Hủy
                      </button>
                      <button 
                          onClick={confirmation.onConfirm} 
                          className="px-5 py-2 rounded bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold shadow-lg border border-crimson-400 transition-all"
                      >
                          Xác Nhận
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
