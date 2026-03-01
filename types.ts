

// Enums and Interfaces

export enum GameGenre {
  CULTIVATION = "Tu Tiên",
  FANTASY = "Huyền Huyễn",
  SCIFI = "Khoa Huyễn",
  HORROR = "Linh Dị",
  DETECTIVE = "Trinh Thám",
  SLICE_OF_LIFE = "Đời Thường",
  HISTORICAL = "Cổ Trang",
  POST_APOCALYPTIC = "Mạt Thế",
  ANIME_CROSSOVER = "Anime Đồng Nhân",
  ALL_ANIME = "Tổng Mạn",
  REAL_LIFE = "Đời Thực / Showbiz",
  ACTION = "Chiến Đấu",
  ORIGINAL = "Nguyên Tác (Gốc)",
}

export type StoryLength = 'short' | 'medium' | 'long' | 'epic';
export type NSFWIntensity = 'soft' | 'extreme';
export type WritingStyle = 'convert' | 'smooth' | 'anime';
export type NSFWFocus = 'body' | 'emotion' | 'dialogue' | 'action' | 'vulgar' | 'roleplay';

// NEW TYPES FOR WORLD GEN OPTIONS
export type AIStyle = 'balanced' | 'strict' | 'creative' | 'hardcore';
export type EventFrequency = 'none' | 'low' | 'medium' | 'high';

export interface GameMechanics {
  reputation: boolean;
  survival: boolean;
  crafting: boolean;
  combat: boolean;
  time: boolean;
  currency: boolean;
  backpack: boolean; // Advanced backpack logic
  autoCodex: boolean; // Auto update wiki
  livingWorld: boolean; // NEW: Enable/Disable Off-screen world simulation
}

export interface GameEvent {
  id?: number;
  sessionId: number;
  description: string;
  triggerTimestamp: number; // in minutes
  isRecurring: boolean;
  recurrenceInterval?: number; // in minutes
  status: 'pending' | 'completed';
}

export interface GameOption {
  label: string;
  action: string; 
  type: 'safe' | 'risky' | 'social' | 'custom';
}

// NEW MAP DATA STRUCTURE
export interface FloorLayout {
  floorName: string; // Vd: "Tầng 1", "Tầng 2", "Sân Thượng"
  rooms: string[]; // Vd: ["Phòng Khách", "Bếp", "Toilet"]
}

export interface MapData {
  locationName: string; // Tên khu vực lớn (Vd: Nhà Kasumigaoka, Trường Học)
  currentFloor: string; // Tên tầng/khu vực con hiện tại nhân vật đang đứng (Vd: Tầng 2)
  layout: FloorLayout[]; // Cấu trúc toàn bộ tòa nhà/khu vực
  isInterior: boolean; // Có phải là trong nhà (để vẽ bản đồ blueprint) hay ngoài trời
}

export interface GameStats {
  name: string;
  realm: string;
  status: string;
  inventory: string[];
  spiritualRoot?: string;
  talents?: string[];
  currentTime?: string;
  realTimestamp?: number; // NEW: Accurate time tracking (minutes from start)
  // NEW ATTRIBUTES & CURRENCY
  attributes?: { key: string; value: string | number }[]; // Sức mạnh, Tốc độ, v.v.
  currency?: string; // Tiền tệ (Vd: 100 Linh Thạch, 5000 Gold)
  // NEW MAP FIELDS
  currentLocation?: string; // Mô tả chi tiết phòng (Vd: Phòng Ngủ Tầng 2)
  nearbyLocations?: string[]; // Các phòng lân cận (Legacy support or quick move)
  mapData?: MapData; // Dữ liệu cấu trúc bản đồ
  visitedLocations?: string[]; // Danh sách các địa điểm lớn đã mở khóa (Fast Travel)
}

export interface RegistryEntry {
  id?: number;
  sessionId: number;
  name: string;
  type: 'NPC' | 'LOCATION' | 'FACTION' | 'ITEM' | 'KNOWLEDGE' | 'SKILL';
  description: string;
  status?: string;
  firstSeenTurn: number;
  lastUpdatedTurn?: number; // NEW: Track when the entry was last modified
  powerLevel?: string;
  affiliation?: string;
  appearance?: string;
  personality?: string;
  secrets?: string;
  embedding?: number[]; // ADDED: Vector embedding for semantic search
  realm?: string;
  root?: string;
  assets?: string;
  inventory?: string[];
  attributes?: { key: string; value: string }[];
}

export interface GalleryImage {
  id?: number;
  url: string;
  type: 'image' | 'video';
  addedAt: number;
  tags?: string[];
}

export interface AIResponseSchema {
  thoughtProcess?: string; // NEW: Inner Monologue logic
  narrative: string;
  worldEvents?: string[]; // NEW: For Living World simulation (Proposal 5)
  timePassed?: number; // NEW: AI returns minutes passed
  stats: GameStats;
  options?: GameOption[];
  isGameOver: boolean;
  newRegistry?: {
    name: string;
    type: 'NPC' | 'LOCATION' | 'FACTION' | 'ITEM' | 'KNOWLEDGE' | 'SKILL';
    description: string;
    status: string;
    powerLevel?: string;
    affiliation?: string;
    appearance?: string;
    personality?: string;
    secrets?: string;
    realm?: string;
    root?: string;
    assets?: string;
    inventory?: string[];
    attributes?: { key: string; value: string }[];
  }[];
}

export interface WorldSettings {
  worldContext: string;
  plotDirection: string;
  majorFactions: string;
  keyNpcs: string;
  openingStory?: string;
  crossoverWorlds?: string;
  referenceContext?: string; // NEW: Content from uploaded .txt file
}

export interface CharacterTraits {
  spiritualRoot: string;
  talents: string[];
  personality: string;
}

export interface GameSession {
  id?: number;
  heroName: string;
  customTitle?: string; // Tên tùy chỉnh cho file save
  gender: string;
  genre: GameGenre;
  worldSettings: WorldSettings;
  characterTraits?: CharacterTraits;
  avatarUrl?: string;
  backgroundImageUrl?: string;
  backgroundType?: 'image' | 'video'; 
  fontFamily?: string; 
  textColor?: string;
  // NEW DISPLAY SETTINGS
  fontSize?: string; // e.g. 'text-lg'
  lineHeight?: string; // e.g. 'leading-loose'
  createdAt: number;
  isNSFW?: boolean;
  nsfwIntensity: NSFWIntensity;
  writingStyle?: WritingStyle;
  nsfwFocus?: NSFWFocus[];
  pronounRules?: string;
  summary?: string;
  // NEW FIELDS
  aiStyle?: AIStyle;
  eventFrequency?: EventFrequency;
  mechanics?: GameMechanics;
  aiModel?: string; // e.g., 'gemini-3-pro-preview'
  memoryDepth?: 'standard' | 'high'; // NEW: Memory setting
}

export interface Turn {
  id?: number;
  sessionId: number;
  turnIndex: number;
  role: 'user' | 'model';
  userPrompt?: string;
  narrative?: string;
  rawResponseJSON?: string;
  embedding?: number[];
  thoughtSignature?: string;
}

export interface RagContext {
  text: string;
  relevance: number;
}

export interface TimelineEntry {
  id?: number;
  sessionId: number;
  title: string;
  description: string;
  timestamp: string;
  realTimestamp: number;
  associatedTurnIndex: number;
}

export interface TimekeeperResult {
  timePassed: string;
  newDate: string;
  timeOfDay: string;
  season?: string;
  environmentState: string;
}