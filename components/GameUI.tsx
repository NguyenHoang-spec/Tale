import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Turn, GameSession, StoryLength, RegistryEntry, GameOption, GameStats, NSFWFocus, GalleryImage } from '../types';
import { db } from '../db';
import { geminiService } from '../services/geminiService';

interface GameUIProps {
  session: GameSession;
  turns: Turn[];
  currentStats: GameStats | null;
  currentOptions: GameOption[] | null;
  loading: boolean;
  onOptionClick: (action: string, lengthMode: StoryLength) => void;
  onRegenerate: (turnIndex: number, newPrompt: string, lengthMode: StoryLength) => void;
  onUndo: () => void;
  avatarUrl?: string;
  genre: string;
  onExit: () => void;
  onDelete: () => void;
  onExport: () => void;
  onSave: () => void; 
  onUpdateSession: (field: keyof GameSession, value: any) => void;
}

const FONTS = [
    { name: 'Mặc định (Serif)', value: "'Merriweather', serif", class: 'font-serif' },
    { name: 'Hiện đại (Sans)', value: "'Roboto', sans-serif", class: 'font-sans' },
    { name: 'Cổ điển (Display)', value: "'Playfair Display', serif", class: 'font-display' },
    { name: 'Máy đánh chữ', value: "'Source Code Pro', monospace", class: 'font-mono' },
    { name: 'Thư pháp', value: "'Dancing Script', cursive", class: 'font-cursive' },
];

const TEXT_COLORS = [
    { name: 'Giấy Cũ', value: '#fffbeb', bg: 'bg-[#fffbeb]' }, 
    { name: 'Vàng Kim', value: '#fde047', bg: 'bg-yellow-300' },
    { name: 'Trắng Tinh', value: '#ffffff', bg: 'bg-white' },
    { name: 'Xanh Matrix', value: '#4ade80', bg: 'bg-green-400' },
    { name: 'Hồng Phấn', value: '#f9a8d4', bg: 'bg-pink-300' },
    { name: 'Xám Bạc', value: '#cbd5e1', bg: 'bg-slate-300' },
];

const FONT_SIZES = [
    { name: 'Nhỏ', value: 'text-base' },
    { name: 'Vừa', value: 'text-lg' }, // Default (equivalent to prose-content ~1.125rem on desktop)
    { name: 'Lớn', value: 'text-xl' },
    { name: 'Rất Lớn', value: 'text-2xl' },
];

const LINE_HEIGHTS = [
    { name: 'Khít', value: 'leading-normal' },
    { name: 'Vừa', value: 'leading-relaxed' },
    { name: 'Thoáng', value: 'leading-loose' }, // Default
];

// --- HELPER FOR MAP ---
const getRoomIcon = (name: any) => {
    if (typeof name !== 'string') return 'fa-door-open';
    const n = name.toLowerCase();
    if (n.includes('ngủ') || n.includes('bed') || n.includes('phòng')) return 'fa-bed';
    if (n.includes('bếp') || n.includes('kitchen') || n.includes('ăn')) return 'fa-utensils';
    if (n.includes('tắm') || n.includes('bath')) return 'fa-bath';
    if (n.includes('vệ sinh') || n.includes('toilet') || n.includes('wc')) return 'fa-toilet';
    if (n.includes('khách') || n.includes('living') || n.includes('sảnh')) return 'fa-couch';
    if (n.includes('sách') || n.includes('thư') || n.includes('library') || n.includes('học')) return 'fa-book';
    if (n.includes('kho') || n.includes('storage')) return 'fa-boxes';
    if (n.includes('vườn') || n.includes('sân') || n.includes('garden')) return 'fa-tree';
    if (n.includes('thờ') || n.includes('đền') || n.includes('điện')) return 'fa-vihara';
    if (n.includes('đường') || n.includes('phố') || n.includes('chợ')) return 'fa-road';
    if (n.includes('cổng') || n.includes('gate')) return 'fa-torii-gate';
    return 'fa-door-open';
};

// --- USER MESSAGE COMPONENT (COLLAPSIBLE) ---
const UserMessage: React.FC<{ text: string }> = ({ text }) => {
    const [expanded, setExpanded] = useState(false);
    
    // Safety check for empty text
    const rawText = text || "";
    
    // REMOVE SYSTEM TAGS FROM DISPLAY (HIDE 1200 REQ)
    const displayText = rawText
        .replace(/\[YÊU CẦU ĐỘ DÀI\]:\s*\d+/gi, '') // Hide specific length tag
        .replace(/\[\w+\]:/g, (match) => {
             // Optional: You can hide prompt tags here too if desired, e.g. [HÀNH ĐỘNG]:
             return match; 
        })
        .trim();

    // Threshold length to decide if we need to truncate
    const THRESHOLD = 80; 
    const isLong = displayText.length > THRESHOLD;

    return (
        <div 
            onClick={() => isLong && setExpanded(!expanded)} 
            className={`text-parchment-100 text-lg font-display font-medium leading-relaxed italic text-center transition-all ${isLong ? 'cursor-pointer hover:text-gold-200' : ''}`}
            title={isLong ? (expanded ? "Thu gọn" : "Xem chi tiết") : ""}
        >
            {expanded || !isLong ? displayText : `${displayText.substring(0, THRESHOLD)}...`}
            
            {isLong && !expanded && (
                <div className="text-[10px] text-gold-500/70 mt-1 uppercase tracking-widest font-sans not-italic">
                    <i className="fas fa-chevron-down mr-1"></i> Nhấn để xem chi tiết
                </div>
            )}
        </div>
    );
};

// --- WIKI DETAILED CARD ---
const WikiQuickCard: React.FC<{ entry: RegistryEntry; onClose: () => void; onDelete: (id: number) => void }> = ({ entry, onClose, onDelete }) => {
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (entry.id) onDelete(entry.id);
    };

    // Helper to detect virginity status from description text
    const detectVirginityStatus = (): 'VIRGIN' | 'NON_VIRGIN' | 'UNKNOWN' => {
        const fullText = (entry.description + " " + entry.appearance + " " + entry.status + " " + entry.secrets).toLowerCase();
        
        // Virgin Keywords
        if (fullText.includes("còn trinh") || fullText.includes("xử nữ") || fullText.includes("nguyên vẹn") || fullText.includes("thủ cung sa") || fullText.includes("thánh khiết") || fullText.includes("chưa trải sự đời") || fullText.includes("trong trắng")) {
            return 'VIRGIN';
        }
        // Non-Virgin Keywords
        if (fullText.includes("mất trinh") || fullText.includes("thất tiết") || fullText.includes("đã quan hệ") || fullText.includes("không còn nguyên") || fullText.includes("đã phá thân") || fullText.includes("dâm phụ") || fullText.includes("bị phá")) {
            return 'NON_VIRGIN';
        }
        return 'UNKNOWN';
    };

    const virginityStatus = detectVirginityStatus();

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={onClose}>
            <div 
                className="bg-ink-950/90 border border-gold-500/30 rounded-2xl w-full max-w-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col max-h-[85vh] animate-slide-up" 
                onClick={e => e.stopPropagation()}
            >
                <div className="h-32 bg-gradient-to-r from-ink-900 via-ink-800 to-ink-900 relative border-b border-white/10">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>
                    <div className="absolute -bottom-10 left-8 flex items-end">
                        <div className="w-24 h-24 rounded-xl bg-ink-950 border-2 border-gold-500 shadow-xl flex items-center justify-center text-gold-500 text-4xl overflow-hidden relative">
                             {entry.type === 'NPC' && <i className="fas fa-user-circle"></i>}
                             {entry.type === 'LOCATION' && <i className="fas fa-map-marked-alt"></i>}
                             {entry.type === 'FACTION' && <i className="fas fa-users"></i>}
                             {entry.type === 'ITEM' && <i className="fas fa-khanda"></i>}
                             {entry.type === 'KNOWLEDGE' && <i className="fas fa-book-dead"></i>}
                             {entry.type === 'SKILL' && <i className="fas fa-bolt"></i>}
                             
                             {entry.type === 'NPC' && virginityStatus !== 'UNKNOWN' && (
                                <div className={`absolute bottom-0 right-0 p-1 rounded-tl-lg border-t border-l ${virginityStatus === 'VIRGIN' ? 'bg-pink-600 border-pink-400' : 'bg-ink-800 border-ink-600'}`}>
                                    <i className={`fas ${virginityStatus === 'VIRGIN' ? 'fa-spa text-white' : 'fa-heart-broken text-crimson-500'} text-xs`}></i>
                                </div>
                             )}
                        </div>
                    </div>
                    
                    <div className="absolute top-4 right-4 flex gap-2">
                        <button 
                            onClick={handleDelete}
                            className="w-8 h-8 rounded-full bg-crimson-900/80 hover:bg-crimson-600 text-white transition-colors flex items-center justify-center border border-crimson-500"
                            title="Xóa mục này"
                        >
                            <i className="fas fa-trash-alt text-xs"></i>
                        </button>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/50 hover:bg-ink-700 text-white transition-colors flex items-center justify-center border border-white/10">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pt-12 px-8 pb-8 scrollbar-thin scrollbar-thumb-gold-500/20">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold-200 to-parchment-100 flex items-center gap-2">
                                {entry.name}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <span className="bg-ink-800 text-ink-400 text-[10px] font-bold px-2 py-0.5 rounded border border-ink-700 uppercase tracking-wider">{entry.type}</span>
                                {entry.powerLevel && (
                                    <span className="bg-crimson-900/30 text-crimson-300 text-[10px] font-bold px-2 py-0.5 rounded border border-crimson-500/30 uppercase tracking-wider flex items-center gap-1">
                                        <i className="fas fa-fist-raised text-[8px]"></i> {entry.powerLevel}
                                    </span>
                                )}
                                {entry.affiliation && (
                                    <span className="bg-blue-900/30 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/30 uppercase tracking-wider flex items-center gap-1">
                                        <i className="fas fa-flag text-[8px]"></i> {entry.affiliation}
                                    </span>
                                )}
                                
                                {/* EXPLICIT VIRGINITY BADGE (NPC ONLY) */}
                                {entry.type === 'NPC' && virginityStatus !== 'UNKNOWN' && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider flex items-center gap-1 shadow-lg animate-fade-in ${virginityStatus === 'VIRGIN' ? 'bg-pink-900/40 text-pink-300 border-pink-500/50' : 'bg-ink-950 text-ink-500 border-ink-700'}`}>
                                        <i className={`fas ${virginityStatus === 'VIRGIN' ? 'fa-spa' : 'fa-heart-broken'} text-[8px]`}></i> 
                                        {virginityStatus === 'VIRGIN' ? 'Còn Trinh (Nguyên Âm)' : 'Đã Thất Tiết'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {entry.status && (
                        <div className="mb-6 bg-gradient-to-r from-ink-900 to-ink-900/50 p-4 rounded-lg border-l-4 border-spirit-500 shadow-inner">
                            <h4 className="text-[10px] font-bold text-spirit-400 uppercase tracking-wider mb-1"><i className="fas fa-heart-pulse mr-1"></i> Trạng Thái / Cảm Xúc</h4>
                            <p className="text-parchment-100 italic font-serif leading-relaxed">{entry.status}</p>
                        </div>
                    )}

                    <div className="prose-content text-parchment-300 leading-loose text-justify mb-8 font-serif">
                        {entry.description || "Chưa có mô tả chi tiết."}
                    </div>

                    <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-6">
                        {/* APPEARANCE SECTION - FULL WIDTH FOR DETAILED NSFW */}
                        {entry.appearance && (
                            <div className="bg-ink-900/30 p-4 rounded-lg border border-white/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-5"><i className="fas fa-female text-4xl"></i></div>
                                <h5 className="text-gold-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                                    <i className="fas fa-eye"></i> Ngoại Hình / Đặc Điểm
                                </h5>
                                <p className="text-sm text-parchment-200 leading-relaxed whitespace-pre-wrap">{entry.appearance}</p>
                            </div>
                        )}
                        
                        {entry.personality && (
                            <div className="bg-ink-900/30 p-4 rounded-lg border border-white/5">
                                <h5 className="text-gold-500 text-xs font-bold uppercase mb-2"><i className="fas fa-brain mr-1"></i> Tính Cách</h5>
                                <p className="text-sm text-ink-300">{entry.personality}</p>
                            </div>
                        )}
                        
                        {entry.secrets && (
                            <div className="bg-ink-900/30 p-4 rounded-lg border border-arcane-500/20 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-black/90 flex items-center justify-center group-hover:opacity-0 transition-opacity duration-500 z-10 cursor-pointer">
                                    <span className="text-arcane-400 text-xs font-bold uppercase tracking-widest"><i className="fas fa-lock mr-2"></i> Bí Mật (Rê chuột để xem)</span>
                                </div>
                                <h5 className="text-arcane-400 text-xs font-bold uppercase mb-2"><i className="fas fa-key mr-1"></i> Bí Mật</h5>
                                <p className="text-sm text-parchment-200 italic">{entry.secrets}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- NARRATIVE DISPLAY ---
const NarrativeDisplay: React.FC<{ 
    text: string; 
    worldEvents?: string[]; 
    wikiEntries: RegistryEntry[]; 
    onWikiClick: (entry: RegistryEntry) => void; 
    style?: React.CSSProperties; 
    isLivingWorldEnabled: boolean;
    fontSize?: string;
    lineHeight?: string;
    turnsLength: number;
}> = ({ text, worldEvents, wikiEntries, onWikiClick, style, isLivingWorldEnabled, fontSize, lineHeight, turnsLength }) => {
  const [isEventsExpanded, setIsEventsExpanded] = useState(true);

  const validEntries = useMemo(() => {
     return wikiEntries
        .filter(e => e.name && e.name.trim().length > 0)
        .sort((a, b) => b.name.length - a.name.length);
  }, [wikiEntries]);

  const parseText = (content: string) => {
    if (!content || validEntries.length === 0) return content;
    
    try {
        const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(${validEntries.map(e => escapeRegExp(e.name)).join('|')})`, 'gi');
        const parts = content.split(pattern);
        
        return parts.map((part, index) => {
            const lowerPart = part.toLowerCase();
            const entry = validEntries.find(e => e.name.toLowerCase() === lowerPart);
            if (entry) {
                const isUpdatedRecently = entry.lastUpdatedTurn === turnsLength;

                return (
                    <span 
                        key={index} 
                        onClick={(e) => { e.stopPropagation(); onWikiClick(entry); }} 
                        className={`font-bold cursor-pointer transition-colors border-b px-0.5 rounded
                            ${isUpdatedRecently 
                                ? 'text-spirit-300 hover:text-spirit-200 bg-spirit-500/10 border-spirit-500/50 hover:border-spirit-400 animate-pulse-slow' 
                                : 'text-gold-400 hover:text-gold-200 hover:bg-gold-500/10 border-gold-500/30 hover:border-gold-500'}
                        `}
                        title={isUpdatedRecently ? "Thông tin mới cập nhật" : "Xem chi tiết"}
                    >
                        {part}
                    </span>
                );
            }
            return part;
        });
    } catch (e) {
        console.warn("Narrative parse failed, rendering raw text", e);
        return content;
    }
  };

  const paragraphs = text.split('\n\n').filter(p => p.trim());
  return (
    <div className={`prose-content text-justify whitespace-pre-wrap ${fontSize || 'text-lg'} ${lineHeight || 'leading-loose'}`} style={style}>
      {paragraphs.map((p, idx) => <p key={idx} className="mb-4 animate-fade-in drop-shadow-sm">{parseText(p)}</p>)}
      
      {isLivingWorldEnabled && Array.isArray(worldEvents) && worldEvents.length > 0 && (
          <div className="mt-8 mb-4 bg-ink-950/60 border-l-4 border-arcane-500 rounded-r-lg shadow-lg relative overflow-hidden transition-all group">
             <div 
                className="flex items-center justify-between p-3 bg-arcane-900/10 cursor-pointer hover:bg-arcane-900/20 transition-colors select-none"
                onClick={() => setIsEventsExpanded(!isEventsExpanded)}
             >
                 <div className="flex items-center gap-2">
                     <i className="fas fa-globe-americas text-arcane-500"></i>
                     <h4 className="text-arcane-400 font-bold text-xs uppercase">
                         Tin Tức Thế Giới (Living World)
                     </h4>
                 </div>
                 <div className="flex items-center gap-2">
                     <span className="text-[10px] text-ink-500 group-hover:text-arcane-400 transition-colors">
                        {isEventsExpanded ? 'Thu gọn' : 'Hiển thị'}
                     </span>
                     <button className="text-arcane-500 hover:text-arcane-300 transition-colors">
                         <i className={`fas ${isEventsExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                     </button>
                 </div>
             </div>

             {isEventsExpanded && (
                 <div className="p-4 pt-2 border-t border-arcane-500/10 animate-slide-up">
                     <ul className="space-y-2">
                        {worldEvents.map((event, idx) => {
                            let eventText = "";
                            if (typeof event === 'string') {
                                eventText = event;
                            } else if (typeof event === 'object' && event !== null) {
                                const e = event as any;
                                eventText = e.description || e.text || e.eventName || JSON.stringify(e);
                            } else {
                                eventText = String(event);
                            }
                            
                            return (
                                <li key={idx} className="text-sm text-parchment-200 flex items-start gap-2">
                                    <i className="fas fa-caret-right text-arcane-500 mt-1 flex-shrink-0"></i>
                                    <span className="italic">{parseText(eventText)}</span>
                                </li>
                            );
                        })}
                     </ul>
                 </div>
             )}
          </div>
      )}
    </div>
  );
};

export const GameUI: React.FC<GameUIProps> = ({ 
  session,
  turns, 
  currentStats, 
  currentOptions, 
  loading, 
  onOptionClick,
  onRegenerate,
  onUndo,
  avatarUrl,
  genre,
  onExit,
  onDelete,
  onExport,
  onSave, 
  onUpdateSession
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  
  // States
  const [showStatsMobile, setShowStatsMobile] = useState(false);
  const [showWiki, setShowWiki] = useState(false);
  const [wikiEntries, setWikiEntries] = useState<RegistryEntry[]>([]);
  const [wikiTab, setWikiTab] = useState<'NPC' | 'LOCATION' | 'FACTION' | 'ITEM' | 'SKILL' | 'ALL'>('ALL');
  const [showSummary, setShowSummary] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showGameConfig, setShowGameConfig] = useState(false); 
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedWikiIds, setSelectedWikiIds] = useState<Set<number>>(new Set());

  // QUICK WIKI STATES
  const [quickWikiBtn, setQuickWikiBtn] = useState<{x: number, y: number, text: string} | null>(null);
  const [showQuickWikiModal, setShowQuickWikiModal] = useState(false);
  const [newWikiName, setNewWikiName] = useState('');
  const [newWikiType, setNewWikiType] = useState<'NPC' | 'LOCATION' | 'ITEM' | 'FACTION' | 'SKILL'>('NPC');
  const [newWikiDesc, setNewWikiDesc] = useState('');
  const [isGeneratingWiki, setIsGeneratingWiki] = useState(false); // NEW: Auto-fill state

  // GALLERY STATES
  const [appearanceTab, setAppearanceTab] = useState<'SETTINGS' | 'GALLERY'>('SETTINGS');
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryInputUrl, setGalleryInputUrl] = useState('');
  const [galleryTab, setGalleryTab] = useState<'IMAGE' | 'VIDEO'>('IMAGE'); // NEW: Split Tab
  const [previewImage, setPreviewImage] = useState<string | null>(null); // NEW: Preview Image State

  const [confirmModal, setConfirmModal] = useState<{
      isOpen: boolean;
      message: React.ReactNode;
      onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  const [cinemaMode, setCinemaMode] = useState(false);
  const [inputMode, setInputMode] = useState<'action' | 'system'>('action');
  const [force1200, setForce1200] = useState(false);
  const [viewingFloor, setViewingFloor] = useState<string | null>(null);

  const [tempBgUrl, setTempBgUrl] = useState('');
  const [tempBgType, setTempBgType] = useState<'image' | 'video'>('image'); 
  const [tempFont, setTempFont] = useState(session.fontFamily || "'Merriweather', serif");
  const [tempColor, setTempColor] = useState(session.textColor || "#fffbeb");
  const [tempAiModel, setTempAiModel] = useState(session.aiModel || 'gemini-3-pro-preview');
  
  const [tempFontSize, setTempFontSize] = useState(session.fontSize || 'text-lg');
  const [tempLineHeight, setTempLineHeight] = useState(session.lineHeight || 'leading-loose');

  const [selectedWikiEntry, setSelectedWikiEntry] = useState<RegistryEntry | null>(null);
  const [lengthMode, setLengthMode] = useState<StoryLength>('medium');
  const [showSaveToast, setShowSaveToast] = useState(false);

  // --- BACKGROUND VISUAL STATES ---
  const [bgOpacity, setBgOpacity] = useState(0.4); // Less dark by default (was 0.6)
  const [bgBlur, setBgBlur] = useState(0); // No blur by default (was 2px)
  const [bgPosition, setBgPosition] = useState('center center'); // Object Position
  const [showFullBg, setShowFullBg] = useState(false); // Fullscreen Preview

  // --- AUDIO/VIDEO STATE ---
  const [isBgMuted, setIsBgMuted] = useState(true);

  // --- TTS STATE ---
  const [showTTS, setShowTTS] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [speechRate, setSpeechRate] = useState(1.0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoRead, setAutoRead] = useState(false); 

  const ITEMS_PER_PAGE = 6; 
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(turns.length / ITEMS_PER_PAGE) || 1;

  useEffect(() => {
      setCurrentPage(Math.ceil(turns.length / ITEMS_PER_PAGE) || 1);
  }, [turns.length]);

  useEffect(() => {
    if (session.id) {
        db.encyclopedia.where('sessionId').equals(session.id).toArray().then(setWikiEntries);
    }
  }, [session.id, turns.length, showWiki]); 

  // Load Gallery Images
  useEffect(() => {
      if (showAppearance) {
          db.imageGallery.orderBy('addedAt').reverse().toArray().then(setGalleryImages);
      }
  }, [showAppearance]);

  // Filter Gallery Images
  const filteredGalleryImages = useMemo(() => {
      return galleryImages.filter(img => {
          if (galleryTab === 'IMAGE') return img.type === 'image';
          if (galleryTab === 'VIDEO') return img.type === 'video';
          return false;
      });
  }, [galleryImages, galleryTab]);

  // --- QUICK WIKI SELECTION LISTENER ---
  useEffect(() => {
    const handleSelection = () => {
        if (showQuickWikiModal || showWiki || showSummary || showGameConfig || showMap) return;
        
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            const text = selection.toString().trim();
            if (text.length > 50) return; 

            // Calculate position relative to viewport (fixed)
            setQuickWikiBtn({
                x: rect.left + (rect.width / 2),
                y: rect.top - 40,
                text: text
            });
        } else {
            setQuickWikiBtn(null);
        }
    };

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, [showQuickWikiModal, showWiki, showSummary, showGameConfig, showMap]);

  // ... (TTS and other useEffects remain same)
  // --- TTS: LOAD VOICES ---
  useEffect(() => {
      const loadVoices = () => {
          const availableVoices = window.speechSynthesis.getVoices();
          setVoices(availableVoices);
          
          if (availableVoices.length > 0 && !selectedVoiceURI) {
              const viVoice = availableVoices.find(v => v.lang.includes('vi'));
              if (viVoice) {
                  setSelectedVoiceURI(viVoice.voiceURI);
              } else {
                  setSelectedVoiceURI(availableVoices[0].voiceURI);
              }
          }
      };

      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      
      return () => {
          window.speechSynthesis.cancel();
      };
  }, []);

  // --- TTS Logic ---
  const getLatestNarrative = () => {
      const lastModelTurn = [...turns].reverse().find(t => t.role === 'model');
      return lastModelTurn ? lastModelTurn.narrative : null;
  };

  const cleanTextForTTS = (text: string) => {
      if (!text) return "";
      return text
          .replace(/[*#_`]/g, '')
          .replace(/\[.*?\]/g, '')
          .replace(/^\s*[\r\n]/gm, '')
          .trim();
  };

  const speakText = (text: string) => {
      if (!text) return;
      
      window.speechSynthesis.cancel();
      setIsSpeaking(true);
      setIsPaused(false);

      const cleanText = cleanTextForTTS(text);
      const sentences = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
      
      let currentSentenceIndex = 0;

      const speakNextSentence = () => {
          if (currentSentenceIndex >= sentences.length) {
              setIsSpeaking(false);
              return;
          }

          const utterance = new SpeechSynthesisUtterance(sentences[currentSentenceIndex].trim());
          const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
          if (voice) utterance.voice = voice;
          utterance.rate = speechRate;
          
          utterance.onend = () => {
              currentSentenceIndex++;
              speakNextSentence();
          };

          utterance.onerror = (e) => {
              console.error("TTS Error", e);
              setIsSpeaking(false);
          };
          
          window.speechSynthesis.speak(utterance);
      };

      speakNextSentence();
  };

  const handleSpeak = () => {
      if (isPaused) {
          window.speechSynthesis.resume();
          setIsPaused(false);
          setIsSpeaking(true);
      } else {
          const text = getLatestNarrative();
          if (text) speakText(text);
          else alert("Không tìm thấy nội dung để đọc.");
      }
  };

  useEffect(() => {
      if (autoRead && !loading && turns.length > 0) {
          const lastTurn = turns[turns.length - 1];
          if (lastTurn.role === 'model' && lastTurn.narrative) {
              const timer = setTimeout(() => {
                  speakText(lastTurn.narrative!);
              }, 500);
              return () => clearTimeout(timer);
          }
      }
  }, [turns, autoRead, loading]);

  const handlePause = () => {
      if (isSpeaking && !isPaused) {
          window.speechSynthesis.pause();
          setIsPaused(true);
      }
  };

  const handleStop = () => {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
  };

  useEffect(() => {
      if (currentStats?.mapData) {
          if (currentStats.mapData.currentFloor) {
              setViewingFloor(currentStats.mapData.currentFloor);
          } else if (currentStats.mapData.layout && currentStats.mapData.layout.length > 0) {
              setViewingFloor(currentStats.mapData.layout[0].floorName);
          }
      }
  }, [currentStats?.mapData?.locationName]);

  const displayedTurns = turns.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
          setCurrentPage(newPage);
          if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = 0;
          }
      }
  };

  const requestConfirm = (message: React.ReactNode, action: () => void) => {
      setConfirmModal({ isOpen: true, message, onConfirm: action });
  };

  const closeConfirm = () => {
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleConfirmAction = () => {
      confirmModal.onConfirm();
      closeConfirm();
  };

  const toggleWikiSelection = (id: number) => {
      setSelectedWikiIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
          return newSet;
      });
  };

  const toggleSelectionMode = () => {
      setIsSelectionMode(!isSelectionMode);
      setSelectedWikiIds(new Set()); 
  };

  const handleBatchDelete = () => {
      if (selectedWikiIds.size === 0) return;
      requestConfirm(
          <span>Bạn có chắc muốn xóa vĩnh viễn <span className="text-crimson-400 font-bold">{selectedWikiIds.size}</span> mục đã chọn không?</span>,
          async () => {
               try {
                    const ids = Array.from(selectedWikiIds);
                    await db.encyclopedia.bulkDelete(ids);
                    setWikiEntries(prev => prev.filter(e => !selectedWikiIds.has(e.id!)));
                    setSelectedWikiIds(new Set());
                    setIsSelectionMode(false); 
               } catch (e) {
                    console.error("Batch delete failed", e);
                    alert("Lỗi khi xóa hàng loạt.");
               }
          }
      );
  };

  const handleDeleteWikiEntryRequest = (id: number, name: string) => {
      requestConfirm(
          <span>Bạn có chắc muốn xóa vĩnh viễn mục "<span className="text-gold-400 font-bold">{name}</span>" không?</span>,
          async () => {
              try {
                  await db.encyclopedia.delete(id);
                  setWikiEntries(prev => prev.filter(e => e.id !== id));
                  if (selectedWikiEntry?.id === id) {
                      setSelectedWikiEntry(null);
                  }
              } catch (e) {
                  console.error("Failed to delete wiki entry", e);
                  alert("Lỗi khi xóa mục Wiki.");
              }
          }
      );
  };

  // --- QUICK WIKI HANDLERS ---
  const handleOpenQuickWiki = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (quickWikiBtn) {
          setNewWikiName(quickWikiBtn.text);
          setNewWikiDesc(`Thông tin về ${quickWikiBtn.text}...`);
          setShowQuickWikiModal(true);
          setQuickWikiBtn(null); 
      }
  };

  // NEW: AI Auto Fill Handler
  const handleAutoFillWiki = async () => {
      if (!newWikiName) return;
      setIsGeneratingWiki(true);
      try {
          // Construct recent context from turns
          const recentTurns = turns.slice(-10);
          const context = recentTurns.map(t => `${t.role}: ${t.narrative || t.userPrompt}`).join('\n');
          
          const result = await geminiService.generateWikiEntry(
              newWikiName, 
              newWikiType, 
              context,
              session.isNSFW,
              session.nsfwIntensity
          );
          
          let generatedDesc = result.description || "";
          if (result.appearance) generatedDesc += `\n\n[Ngoại hình]: ${result.appearance}`;
          if (result.personality) generatedDesc += `\n\n[Tính cách]: ${result.personality}`;
          if (result.secrets) generatedDesc += `\n\n[Bí mật]: ${result.secrets}`;
          if (result.status) generatedDesc += `\n\n[Trạng thái]: ${result.status}`;
          
          setNewWikiDesc(generatedDesc);
      } catch (e) {
          console.error("Auto Fill Error", e);
          alert("Lỗi khi tự động điền.");
      } finally {
          setIsGeneratingWiki(false);
      }
  };

  const handleSaveQuickWiki = async () => {
      if (!newWikiName || !session.id) return;
      
      const newEntry: RegistryEntry = {
          sessionId: session.id,
          name: newWikiName,
          type: newWikiType,
          description: newWikiDesc,
          firstSeenTurn: turns.length,
          lastUpdatedTurn: turns.length,
          status: 'Created by Player'
      };

      try {
          // Add to DB
          await db.upsertWikiEntries(session.id, [newEntry], turns.length);
          
          // Update local state
          const updated = await db.encyclopedia.where('sessionId').equals(session.id).toArray();
          setWikiEntries(updated);
          
          setShowQuickWikiModal(false);
          alert("Đã tạo Wiki thành công!");
      } catch (e) {
          console.error("Wiki creation failed", e);
          alert("Lỗi khi tạo Wiki.");
      }
  };

  const handleUpdateAppearance = () => {
      if (onUpdateSession) {
          if (tempBgUrl !== '') {
              onUpdateSession('backgroundImageUrl', tempBgUrl);
              onUpdateSession('backgroundType', tempBgType);
          }
          onUpdateSession('fontFamily', tempFont);
          onUpdateSession('textColor', tempColor);
          onUpdateSession('aiModel', tempAiModel);
          onUpdateSession('fontSize', tempFontSize);
          onUpdateSession('lineHeight', tempLineHeight);
          
          setShowAppearance(false);
          setTempBgUrl('');
      }
  };

  const toggleNsfwFocus = (focus: NSFWFocus) => {
      const current = session.nsfwFocus || [];
      const updated = current.includes(focus) 
          ? current.filter(f => f !== focus) 
          : [...current, focus];
      onUpdateSession('nsfwFocus', updated);
  };

  const handleBgFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setTempBgUrl(reader.result as string);
              if (file.type.startsWith('video/')) {
                  setTempBgType('video');
              } else {
                  setTempBgType('image');
              }
          };
          reader.readAsDataURL(file);
      }
  };

  // --- GALLERY HANDLERS ---
  const handleAddToGallery = async () => {
      if (!galleryInputUrl) return;
      try {
          const isVideo = galleryInputUrl.endsWith('.mp4') || galleryInputUrl.endsWith('.webm');
          await db.imageGallery.add({
              url: galleryInputUrl,
              type: isVideo ? 'video' : 'image',
              addedAt: Date.now()
          });
          setGalleryInputUrl('');
          const updated = await db.imageGallery.orderBy('addedAt').reverse().toArray();
          setGalleryImages(updated);
      } catch (e) {
          alert("Lỗi khi thêm ảnh vào kho.");
      }
  };

  const handleGalleryFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      let addedCount = 0;
      // Iterate over FileList
      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const isImage = file.type.startsWith('image/');
          const isVideo = file.type.startsWith('video/');

          if (!isImage && !isVideo) continue;

          try {
              // Convert to Base64
              const base64 = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
              });

              // Add to DB
              await db.imageGallery.add({
                  url: base64,
                  type: isImage ? 'image' : 'video',
                  addedAt: Date.now() + i // Slight offset to keep order
              });
              addedCount++;
          } catch (err) {
              console.error("Error reading file", file.name, err);
          }
      }

      if (addedCount > 0) {
          // Refresh list
          const updated = await db.imageGallery.orderBy('addedAt').reverse().toArray();
          setGalleryImages(updated);
          // alert(`Đã thêm ${addedCount} file vào Kho Ảnh!`);
      }
      
      // Reset input
      e.target.value = '';
  };

  const handleSaveCurrentBgToGallery = async () => {
      if (session.backgroundImageUrl) {
          try {
              await db.imageGallery.add({
                  url: session.backgroundImageUrl,
                  type: session.backgroundType || 'image',
                  addedAt: Date.now()
              });
              const updated = await db.imageGallery.orderBy('addedAt').reverse().toArray();
              setGalleryImages(updated);
              alert("Đã lưu ảnh nền hiện tại vào Kho Ảnh!");
          } catch (e) {
              alert("Lỗi khi lưu ảnh.");
          }
      }
  };

  const handleDeleteFromGallery = async (id: number) => {
      if(window.confirm("Xóa ảnh này khỏi kho?")) {
          await db.imageGallery.delete(id);
          const updated = await db.imageGallery.orderBy('addedAt').reverse().toArray();
          setGalleryImages(updated);
      }
  };

  const handleSelectFromGallery = (img: GalleryImage) => {
      setTempBgUrl(img.url);
      setTempBgType(img.type);
  };

  const submitTurnWithModifiers = (basePrompt: string, selectedLength: StoryLength) => {
      let finalPrompt = basePrompt;
      let finalLength = selectedLength;

      if (force1200) {
          finalPrompt += `\n\n[YÊU CẦU ĐỘ DÀI]: 1500`;
          finalLength = 'epic'; 
      }

      onOptionClick(finalPrompt, finalLength);
  };

  const handleInputSubmit = (value: string) => {
    if (!value.trim()) return;
    
    let finalPrompt = value;
    
    if (value.trim().startsWith('*') && value.trim().endsWith('*') && value.trim().length > 2) {
        const commandContent = value.trim().slice(1, -1).trim();
        finalPrompt = `[HỆ THỐNG/MỆNH LỆNH TRỰC TIẾP]: ${commandContent}`;
    } 
    else if (inputMode === 'system') {
        finalPrompt = `[HỆ THỐNG/THIÊN ĐẠO]: ${value}`;
    } else {
        if (!value.startsWith('[')) {
            finalPrompt = `[HÀNH ĐỘNG]: ${value}`;
        }
    }

    submitTurnWithModifiers(finalPrompt, lengthMode);
  };

  const cycleLengthMode = () => {
    if (lengthMode === 'short') setLengthMode('medium');
    else if (lengthMode === 'medium') setLengthMode('long');
    else if (lengthMode === 'long') setLengthMode('epic');
    else setLengthMode('short');
  };
  
  const lengthInfo = (() => {
    switch (lengthMode) {
      case 'short': return { icon: 'fa-align-left', label: 'Ngắn' };
      case 'medium': return { icon: 'fa-align-justify', label: 'Vừa' };
      case 'long': return { icon: 'fa-align-center', label: 'Dài' };
      case 'epic': return { icon: 'fa-book-open', label: 'Cực Dài' };
    }
  })();

  const handleMoveLocation = (location: string) => {
      setShowMap(false);
      if(!loading) submitTurnWithModifiers(`[HÀNH ĐỘNG]: Di chuyển tới ${location}.`, lengthMode);
  };

  
  const handleContinue = () => {
      if (loading) return;
      submitTurnWithModifiers(`[TIẾP TỤC]: Viết tiếp...`, lengthMode);
  }

  const handleSaveGame = () => {
      if (onSave) {
          onSave();
          setShowSaveToast(true);
          setTimeout(() => setShowSaveToast(false), 3000);
      }
  }

  const toggleInputMode = () => {
      setInputMode(prev => prev === 'action' ? 'system' : 'action');
  }

  const getCurrentViewRooms = () => {
      if (!currentStats?.mapData?.layout) return [];
      const floorData = currentStats.mapData.layout.find(f => f.floorName === viewingFloor);
      if (!floorData && currentStats.mapData.layout.length > 0) return currentStats.mapData.layout[0].rooms;
      return floorData ? floorData.rooms : [];
  };

  const updateMechanics = (key: string, value: boolean) => {
      const currentMechanics = session.mechanics || {
          reputation: false, survival: false, crafting: false, combat: false, 
          time: false, currency: false, backpack: false, autoCodex: true, livingWorld: false
      };
      
      onUpdateSession('mechanics', { ...currentMechanics, [key]: value });
  };

  return (
    <div className="flex h-screen bg-transparent font-serif overflow-hidden relative selection:bg-gold-500/30 selection:text-gold-200"
         style={{
             backgroundImage: undefined, // REMOVED INLINE BG to use IMG tag for sharpening
             backgroundSize: 'cover',
             backgroundPosition: 'center',
             backgroundAttachment: 'fixed',
         }}
    >
      {/* GLOBAL BACKGROUND RENDERING (VIDEO OR IMAGE) */}
      {session.backgroundType === 'video' && session.backgroundImageUrl ? (
          <video 
            key={session.backgroundImageUrl} // FIXED: Added key for reliable re-rendering
            autoPlay 
            loop 
            muted={isBgMuted} 
            playsInline 
            // Add hardware acceleration (transform-gpu) and visual tweaks for sharpening feeling
            className="absolute inset-0 w-full h-full object-cover z-0 filter contrast-[1.1] saturate-[1.1] brightness-90 transform-gpu will-change-transform" 
            style={{ objectPosition: bgPosition }}
            src={session.backgroundImageUrl} 
          />
      ) : (!session.backgroundType || session.backgroundType === 'image') && session.backgroundImageUrl ? (
          <img 
             src={session.backgroundImageUrl}
             alt="Background"
             className="absolute inset-0 w-full h-full object-cover z-0 filter contrast-[1.15] saturate-[1.1] brightness-90"
             style={{ imageRendering: 'high-quality' as any, objectPosition: bgPosition }} // Browser upscaling hint
          />
      ) : null}

      <div 
          className="absolute inset-0 pointer-events-none overflow-hidden z-0 transition-all duration-1000"
          style={{ 
              backgroundColor: session.backgroundImageUrl && !cinemaMode ? `rgba(0,0,0,${bgOpacity})` : 'transparent',
              backdropFilter: session.backgroundImageUrl && !cinemaMode ? `blur(${bgBlur}px)` : 'none',
              WebkitBackdropFilter: session.backgroundImageUrl && !cinemaMode ? `blur(${bgBlur}px)` : 'none',
          }}
      >
        {!session.backgroundImageUrl && (
            <>
                <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-spirit-500/5 rounded-full blur-[120px] animate-pulse-slow"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-arcane-500/5 rounded-full blur-[100px] animate-pulse-slow" style={{animationDelay: '2s'}}></div>
            </>
        )}
      </div>

      {/* SHOW UI BUTTON IN CINEMA MODE */}
      {cinemaMode && (
          <div className="fixed top-6 right-6 z-[60] flex flex-col gap-3">
              {/* VIDEO AUDIO TOGGLE IN CINEMA MODE */}
              {session.backgroundType === 'video' && (
                  <button 
                      onClick={() => setIsBgMuted(!isBgMuted)}
                      className="w-12 h-12 bg-black/50 text-white rounded-full hover:bg-blue-500 hover:text-white transition-all animate-fade-in flex items-center justify-center border border-white/20 backdrop-blur-md shadow-lg group"
                      title={isBgMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                  >
                      <i className={`fas ${isBgMuted ? 'fa-volume-mute' : 'fa-volume-high'} text-xl group-hover:scale-110 transition-transform`}></i>
                  </button>
              )}

              <button 
                  onClick={() => setCinemaMode(false)}
                  className="w-12 h-12 bg-black/50 text-white rounded-full hover:bg-gold-500 hover:text-black transition-all animate-fade-in flex items-center justify-center border border-white/20 backdrop-blur-md shadow-lg group"
                  title="Hiện Giao Diện"
              >
                  <i className="fas fa-eye text-xl group-hover:scale-110 transition-transform"></i>
              </button>
          </div>
      )}

      {showSaveToast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-fade-in bg-ink-900/95 border border-gold-500/50 text-gold-300 px-6 py-3 rounded-full shadow-lg backdrop-blur flex items-center gap-2">
              <i className="fas fa-check-circle text-gold-500"></i>
              <span className="text-sm font-bold tracking-wide">Đã lưu thành công!</span>
          </div>
      )}

      {/* FLOATING QUICK WIKI BUTTON */}
      {quickWikiBtn && (
          <button
              onClick={handleOpenQuickWiki}
              className="fixed z-[9999] bg-ink-900 text-gold-400 border border-gold-500/50 rounded-full px-3 py-1.5 text-xs font-bold shadow-2xl animate-fade-in hover:bg-gold-500 hover:text-ink-950 transition-colors flex items-center gap-1 cursor-pointer transform -translate-x-1/2"
              style={{ left: quickWikiBtn.x, top: quickWikiBtn.y }}
              onMouseDown={(e) => e.preventDefault()} // Prevent clearing selection
          >
              <i className="fas fa-book-medical"></i> Tạo Wiki
          </button>
      )}

      {/* QUICK WIKI MODAL */}
      {showQuickWikiModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowQuickWikiModal(false)}>
              <div className="bg-ink-900 border border-gold-500/30 rounded-xl w-full max-w-md shadow-2xl p-6 relative animate-slide-up" onClick={e => e.stopPropagation()}>
                  <h3 className="text-xl font-bold text-gold-400 mb-4 flex items-center gap-2">
                      <i className="fas fa-feather-alt"></i> Thêm Tri Thức Mới
                  </h3>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="text-[10px] font-bold text-ink-500 uppercase block mb-1">Tên Mục</label>
                          <input 
                              type="text" 
                              value={newWikiName} 
                              onChange={(e) => setNewWikiName(e.target.value)} 
                              className="w-full bg-ink-950 border border-ink-700 rounded p-2 text-sm text-parchment-200 outline-none focus:border-gold-500"
                          />
                      </div>
                      
                      <div>
                          <label className="text-[10px] font-bold text-ink-500 uppercase block mb-1">Loại</label>
                          <div className="flex gap-2 flex-wrap">
                              {['NPC', 'LOCATION', 'ITEM', 'FACTION', 'SKILL'].map(t => (
                                  <button
                                      key={t}
                                      onClick={() => setNewWikiType(t as any)}
                                      className={`text-[10px] px-3 py-1.5 rounded border transition-colors ${newWikiType === t ? 'bg-gold-600 border-gold-400 text-ink-950 font-bold' : 'bg-ink-950 border-ink-700 text-ink-400'}`}
                                  >
                                      {t}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div>
                          <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] font-bold text-ink-500 uppercase">Mô tả</label>
                              <button 
                                  onClick={handleAutoFillWiki}
                                  disabled={isGeneratingWiki}
                                  className="text-[10px] font-bold text-arcane-400 hover:text-arcane-200 border border-arcane-500/50 px-2 py-0.5 rounded-full hover:bg-arcane-900/50 transition-colors flex items-center gap-1 disabled:opacity-50"
                              >
                                  {isGeneratingWiki ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
                                  AI Tự Viết
                              </button>
                          </div>
                          <textarea 
                              value={newWikiDesc} 
                              onChange={(e) => setNewWikiDesc(e.target.value)} 
                              className="w-full h-32 bg-ink-950 border border-ink-700 rounded p-2 text-sm text-parchment-200 outline-none focus:border-gold-500 resize-none font-serif"
                              placeholder="Nhập mô tả chi tiết..."
                          />
                      </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                      <button onClick={() => setShowQuickWikiModal(false)} className="px-4 py-2 rounded text-xs font-bold text-ink-400 hover:text-white">Hủy</button>
                      <button onClick={handleSaveQuickWiki} className="px-4 py-2 rounded bg-gold-600 text-ink-950 text-xs font-bold shadow-lg hover:bg-gold-500">Lưu Wiki</button>
                  </div>
              </div>
          </div>
      )}

      {/* APPEARANCE MODAL */}
      {showAppearance && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowAppearance(false)}>
              <div className="bg-ink-900 border border-pink-500/30 rounded-xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-4 md:p-6 border-b border-white/5 bg-ink-950/50">
                      <h3 className="text-lg md:text-xl font-display font-bold text-pink-400 flex items-center gap-2"><i className="fas fa-palette"></i> Giao Diện & Kho Ảnh</h3>
                      <button onClick={() => setShowAppearance(false)} className="text-ink-500 hover:text-white"><i className="fas fa-times"></i></button>
                  </div>
                  
                  {/* TABS */}
                  <div className="flex bg-ink-950/30 px-4 md:px-6 pt-4 gap-2 border-b border-white/5">
                      <button 
                          onClick={() => setAppearanceTab('SETTINGS')}
                          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${appearanceTab === 'SETTINGS' ? 'border-pink-500 text-pink-400 bg-pink-500/5' : 'border-transparent text-ink-500 hover:text-ink-300'}`}
                      >
                          <i className="fas fa-sliders-h"></i> Cài Đặt
                      </button>
                      <button 
                          onClick={() => setAppearanceTab('GALLERY')}
                          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${appearanceTab === 'GALLERY' ? 'border-pink-500 text-pink-400 bg-pink-500/5' : 'border-transparent text-ink-500 hover:text-ink-300'}`}
                      >
                          <i className="fas fa-images"></i> Kho Ảnh
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-ink-700">
                      {appearanceTab === 'SETTINGS' ? (
                          <div className="space-y-6">
                              <div>
                                  <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block mb-2">Hình Nền / Video URL (Hiện tại)</label>
                                  <div className="flex gap-2">
                                      <input 
                                          type="text" 
                                          value={tempBgUrl} 
                                          onChange={(e) => setTempBgUrl(e.target.value)} 
                                          placeholder="Nhập URL ảnh hoặc video..." 
                                          className="flex-1 bg-ink-950 border border-ink-700 rounded p-2 text-sm text-parchment-200 focus:border-pink-500 outline-none" 
                                      />
                                      <button onClick={() => bgInputRef.current?.click()} className="bg-ink-800 border border-ink-600 px-3 rounded text-ink-400 hover:text-pink-400"><i className="fas fa-upload"></i></button>
                                      <input type="file" ref={bgInputRef} onChange={handleBgFileChange} accept="image/*,video/*" className="hidden" />
                                  </div>
                                  <div className="flex gap-2 mt-2">
                                      <button onClick={() => setTempBgType('image')} className={`text-[10px] px-3 py-1 rounded border ${tempBgType === 'image' ? 'bg-pink-600 text-white border-pink-500' : 'bg-ink-950 text-ink-500 border-ink-700'}`}>Ảnh</button>
                                      <button onClick={() => setTempBgType('video')} className={`text-[10px] px-3 py-1 rounded border ${tempBgType === 'video' ? 'bg-pink-600 text-white border-pink-500' : 'bg-ink-950 text-ink-500 border-ink-700'}`}>Video</button>
                                  </div>
                              </div>

                              {/* NEW: BACKGROUND VISUAL SETTINGS */}
                              <div className="bg-ink-950/50 p-4 rounded-lg border border-ink-800 space-y-4">
                                  <label className="text-[10px] font-bold text-pink-400 uppercase tracking-wider block border-b border-pink-500/20 pb-2 mb-2">
                                      Tinh Chỉnh Hiển Thị Nền
                                  </label>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                      <div>
                                          <label className="text-[10px] text-ink-500 block mb-1">Độ Tối Lớp Phủ ({Math.round(bgOpacity * 100)}%)</label>
                                          <input 
                                              type="range" 
                                              min="0" 
                                              max="1" 
                                              step="0.1" 
                                              value={bgOpacity} 
                                              onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
                                              className="w-full h-1 bg-ink-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                          />
                                      </div>
                                      <div>
                                          <label className="text-[10px] text-ink-500 block mb-1">Độ Mờ (Blur) ({bgBlur}px)</label>
                                          <input 
                                              type="range" 
                                              min="0" 
                                              max="10" 
                                              step="1" 
                                              value={bgBlur} 
                                              onChange={(e) => setBgBlur(parseInt(e.target.value))}
                                              className="w-full h-1 bg-ink-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                          />
                                      </div>
                                  </div>

                                  <div>
                                      <label className="text-[10px] text-ink-500 block mb-2">Vị Trí Khung Hình (Crop Focus)</label>
                                      <div className="grid grid-cols-3 gap-1 w-32 mx-auto">
                                          {['top left', 'top center', 'top right', 'center left', 'center center', 'center right', 'bottom left', 'bottom center', 'bottom right'].map((pos) => (
                                              <button
                                                  key={pos}
                                                  onClick={() => setBgPosition(pos)}
                                                  className={`w-10 h-10 border rounded transition-all ${bgPosition === pos ? 'bg-pink-600 border-pink-400 text-white' : 'bg-ink-900 border-ink-700 text-ink-600 hover:bg-ink-800'}`}
                                                  title={pos}
                                              >
                                                  <div className={`w-2 h-2 bg-current rounded-full mx-auto ${bgPosition === pos ? 'opacity-100' : 'opacity-30'}`}></div>
                                              </button>
                                          ))}
                                      </div>
                                  </div>
                              </div>

                              <div>
                                  <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block mb-2">Font Chữ</label>
                                  <div className="grid grid-cols-2 gap-2">
                                      {FONTS.map(f => (
                                          <button 
                                              key={f.value} 
                                              onClick={() => setTempFont(f.value)} 
                                              style={{ fontFamily: f.value }}
                                              className={`p-2 rounded border text-xs ${tempFont === f.value ? 'bg-pink-900/30 border-pink-500 text-pink-300' : 'bg-ink-950 border-ink-700 text-ink-400'}`}
                                          >
                                              {f.name}
                                          </button>
                                      ))}
                                  </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block mb-2">Cỡ Chữ</label>
                                      <div className="grid grid-cols-2 gap-2">
                                          {FONT_SIZES.map(s => (
                                              <button 
                                                  key={s.value} 
                                                  onClick={() => setTempFontSize(s.value)} 
                                                  className={`p-2 rounded border text-[10px] font-bold transition-all ${tempFontSize === s.value ? 'bg-pink-900/30 border-pink-500 text-pink-300' : 'bg-ink-950 border-ink-700 text-ink-400'}`}
                                              >
                                                  {s.name}
                                              </button>
                                          ))}
                                      </div>
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block mb-2">Giãn Dòng</label>
                                      <div className="grid grid-cols-1 gap-2">
                                          {LINE_HEIGHTS.map(l => (
                                              <button 
                                                  key={l.value} 
                                                  onClick={() => setTempLineHeight(l.value)} 
                                                  className={`p-2 rounded border text-[10px] font-bold transition-all ${tempLineHeight === l.value ? 'bg-pink-900/30 border-pink-500 text-pink-300' : 'bg-ink-950 border-ink-700 text-ink-400'}`}
                                              >
                                                  {l.name}
                                              </button>
                                          ))}
                                      </div>
                                  </div>
                              </div>

                              <div>
                                  <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block mb-2">Màu Chữ Chính</label>
                                  <div className="flex flex-wrap gap-2">
                                      {TEXT_COLORS.map(c => (
                                          <button 
                                              key={c.value} 
                                              onClick={() => setTempColor(c.value)} 
                                              className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${c.bg} ${tempColor === c.value ? 'border-white shadow-lg scale-110' : 'border-transparent opacity-70'}`}
                                              title={c.name}
                                          />
                                      ))}
                                  </div>
                              </div>
                          </div>
                      ) : (
                          // GALLERY TAB
                          <div className="space-y-6">
                              <div className="bg-ink-950/50 p-4 rounded-lg border border-ink-800 space-y-4">
                                  <div className="flex flex-col md:flex-row gap-2">
                                      <input 
                                          type="text" 
                                          value={galleryInputUrl} 
                                          onChange={(e) => setGalleryInputUrl(e.target.value)} 
                                          placeholder="Dán URL ảnh/video..." 
                                          className="flex-1 bg-ink-900 border border-ink-700 rounded p-2 text-sm text-parchment-200 outline-none focus:border-pink-500" 
                                      />
                                      <div className="flex gap-2">
                                          <button 
                                              onClick={() => galleryFileInputRef.current?.click()}
                                              className="bg-ink-800 border border-ink-600 px-4 py-2 rounded text-ink-400 hover:text-pink-400 flex items-center justify-center flex-1 md:flex-none"
                                              title="Tải lên từ thiết bị"
                                          >
                                              <i className="fas fa-upload mr-2 md:mr-0"></i>
                                              <span className="md:hidden text-xs font-bold">Tải lên</span>
                                          </button>
                                          <button onClick={handleAddToGallery} className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded text-xs font-bold whitespace-nowrap flex items-center justify-center flex-1 md:flex-none">
                                              <i className="fas fa-plus mr-1"></i> Thêm
                                          </button>
                                      </div>
                                      <input 
                                          type="file" 
                                          ref={galleryFileInputRef} 
                                          onChange={handleGalleryFileUpload} 
                                          accept="image/*,video/*" 
                                          multiple 
                                          className="hidden" 
                                      />
                                  </div>
                                  <button 
                                      onClick={handleSaveCurrentBgToGallery}
                                      className="w-full py-3 bg-ink-800 border border-ink-700 hover:border-pink-500 text-pink-400 rounded text-xs font-bold transition-all"
                                  >
                                      <i className="fas fa-save mr-2"></i> Lưu ảnh nền hiện tại vào Kho
                                  </button>
                              </div>

                              {/* NEW: GALLERY FILTER TABS */}
                              <div className="flex bg-ink-900 rounded-lg p-1 border border-ink-700">
                                 {(['IMAGE', 'VIDEO'] as const).map(tab => (
                                     <button
                                         key={tab}
                                         onClick={() => setGalleryTab(tab)}
                                         className={`flex-1 px-4 py-2 rounded-md text-[10px] font-bold transition-all ${galleryTab === tab ? 'bg-pink-600 text-white shadow-md' : 'text-ink-500 hover:text-ink-300'}`}
                                     >
                                         {tab === 'IMAGE' ? 'Ảnh' : 'Video'}
                                     </button>
                                 ))}
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {filteredGalleryImages.map(img => (
                                      <div key={img.id} className="group relative aspect-video bg-ink-950 rounded-lg overflow-hidden border border-ink-800 hover:border-pink-500 transition-all cursor-pointer shadow-lg" onClick={() => handleSelectFromGallery(img)}>
                                          {img.type === 'image' ? (
                                              <img src={img.url} alt="Gallery" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                          ) : (
                                              <video src={img.url} className="w-full h-full object-cover opacity-80" muted />
                                          )}
                                          
                                          {/* CENTER SELECT OVERLAY */}
                                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                              <span className="text-white font-bold text-xs bg-pink-600 px-2 py-1 rounded-full shadow-lg"><i className="fas fa-check mr-1"></i> Chọn</span>
                                          </div>

                                          {/* ZOOM BUTTON (TOP LEFT) */}
                                          <button 
                                              onClick={(e) => { e.stopPropagation(); setPreviewImage(img.url); }}
                                              className="absolute top-1 left-1 bg-black/60 hover:bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 shadow-lg border border-white/20"
                                              title="Phóng to"
                                          >
                                              <i className="fas fa-search-plus text-[10px]"></i>
                                          </button>

                                          {/* DELETE BUTTON (TOP RIGHT) */}
                                          <button 
                                              onClick={(e) => { e.stopPropagation(); handleDeleteFromGallery(img.id!); }}
                                              className="absolute top-1 right-1 bg-crimson-600 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-crimson-500 z-10 shadow-lg"
                                          >
                                              <i className="fas fa-trash-alt text-[10px]"></i>
                                          </button>
                                          
                                          {img.url === tempBgUrl && (
                                              <div className="absolute bottom-1 left-1 bg-pink-600 text-white px-2 py-0.5 rounded text-[8px] font-bold shadow-lg">Đang chọn</div>
                                          )}
                                      </div>
                                  ))}
                                  {filteredGalleryImages.length === 0 && (
                                      <div className="col-span-full flex flex-col items-center justify-center py-10 text-ink-600">
                                          <i className="fas fa-images text-3xl mb-2 opacity-50"></i>
                                          <span className="text-xs italic">Không tìm thấy {galleryTab === 'IMAGE' ? 'ảnh' : 'video'} nào.</span>
                                      </div>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="p-4 border-t border-white/10 flex justify-end bg-ink-950/50">
                      <button onClick={handleUpdateAppearance} className="bg-pink-600 hover:bg-pink-500 text-white font-bold py-2 px-6 rounded shadow-lg transition-all text-sm">
                          <i className="fas fa-check mr-2"></i> Áp Dụng
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showMap && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowMap(false)}>
              <div className="bg-ink-900 border border-blue-500/30 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-white/10 flex justify-between items-center bg-ink-950/50">
                      <div>
                          <h3 className="text-xl font-display font-bold text-blue-400 flex items-center gap-2">
                              <i className="fas fa-map-marked-alt"></i> Bản Đồ Khu Vực
                          </h3>
                          <p className="text-xs text-ink-500 mt-1 uppercase tracking-widest">{currentStats?.mapData?.locationName || "Không rõ địa điểm"}</p>
                      </div>
                      <button onClick={() => setShowMap(false)} className="text-ink-500 hover:text-white"><i className="fas fa-times"></i></button>
                  </div>

                  <div className="flex flex-1 overflow-hidden">
                      <div className="w-48 bg-ink-950/50 border-r border-white/5 p-4 flex flex-col gap-2 overflow-y-auto">
                          <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider mb-2">Tầng / Khu Vực</label>
                          {currentStats?.mapData?.layout?.map((floor, idx) => (
                              <button 
                                  key={idx}
                                  onClick={() => setViewingFloor(floor.floorName)}
                                  className={`p-3 rounded-lg text-left text-sm font-bold transition-all border ${viewingFloor === floor.floorName ? 'bg-blue-900/30 border-blue-500 text-blue-300' : 'bg-ink-900 border-ink-800 text-ink-500 hover:text-ink-300'}`}
                              >
                                  {floor.floorName}
                                  {currentStats.mapData?.currentFloor === floor.floorName && (
                                      <i className="fas fa-map-pin float-right text-crimson-500 animate-bounce mt-1"></i>
                                  )}
                              </button>
                          ))}
                          {(!currentStats?.mapData?.layout || currentStats.mapData.layout.length === 0) && (
                              <div className="text-xs text-ink-600 italic">Chưa có dữ liệu bản đồ chi tiết.</div>
                          )}
                      </div>

                      <div className="flex-1 p-8 overflow-y-auto bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                              {getCurrentViewRooms().map((room, idx) => {
                                  const isCurrentRoom = currentStats?.currentLocation?.includes(room);
                                  return (
                                      <div 
                                          key={idx}
                                          onClick={() => handleMoveLocation(room)}
                                          className={`
                                              aspect-square rounded-xl border-2 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all hover:scale-105 hover:shadow-xl relative group
                                              ${isCurrentRoom ? 'bg-blue-900/20 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-ink-900 border-ink-700 hover:border-gold-500/50'}
                                          `}
                                      >
                                          {isCurrentRoom && (
                                              <div className="absolute top-2 right-2 w-3 h-3 bg-crimson-500 rounded-full animate-ping"></div>
                                          )}
                                          <i className={`fas ${getRoomIcon(room)} text-3xl mb-3 ${isCurrentRoom ? 'text-blue-400' : 'text-ink-600 group-hover:text-gold-400'}`}></i>
                                          <span className={`text-sm font-bold ${isCurrentRoom ? 'text-blue-200' : 'text-ink-400 group-hover:text-parchment-100'}`}>{room}</span>
                                          
                                          {!isCurrentRoom && (
                                              <span className="absolute bottom-2 text-[10px] text-gold-500 opacity-0 group-hover:opacity-100 transition-opacity">Nhấn để đi</span>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* WIKI ENTRY DETAILS CARD - ADDED */}
      {selectedWikiEntry && (
          <WikiQuickCard 
              entry={selectedWikiEntry} 
              onClose={() => setSelectedWikiEntry(null)} 
              onDelete={(id) => handleDeleteWikiEntryRequest(id, selectedWikiEntry.name)}
          />
      )}

      {/* WIKI MODAL (LIST) - ADDED */}
      {showWiki && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowWiki(false)}>
              <div className="bg-ink-900 border border-arcane-500/30 rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                  {/* Header & Tabs */}
                  <div className="bg-ink-950/50 border-b border-white/5">
                      <div className="flex justify-between items-center p-6 pb-2">
                          <h3 className="text-xl font-display font-bold text-arcane-400 flex items-center gap-2">
                              <i className="fas fa-book-dead"></i> Bách Khoa Toàn Thư (Wiki)
                          </h3>
                          <div className="flex gap-2">
                              <button onClick={toggleSelectionMode} className={`text-xs px-3 py-1.5 rounded border transition-colors ${isSelectionMode ? 'bg-crimson-600 border-crimson-500 text-white' : 'bg-ink-800 border-ink-700 text-ink-400'}`}>
                                  {isSelectionMode ? 'Hủy Chọn' : 'Chọn Nhiều'}
                              </button>
                              {isSelectionMode && selectedWikiIds.size > 0 && (
                                  <button onClick={handleBatchDelete} className="text-xs px-3 py-1.5 rounded bg-crimson-600 hover:bg-crimson-500 text-white border border-crimson-500 font-bold">
                                      Xóa ({selectedWikiIds.size})
                                  </button>
                              )}
                              <button onClick={() => setShowWiki(false)} className="text-ink-500 hover:text-white px-2"><i className="fas fa-times text-lg"></i></button>
                          </div>
                      </div>
                      <div className="flex gap-1 px-6 pb-4 overflow-x-auto scrollbar-thin">
                          {(['ALL', 'NPC', 'LOCATION', 'FACTION', 'ITEM', 'SKILL'] as const).map(tab => (
                              <button
                                  key={tab}
                                  onClick={() => setWikiTab(tab)}
                                  className={`px-4 py-2 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap ${wikiTab === tab ? 'bg-arcane-600 text-white shadow-lg' : 'bg-ink-900/50 text-ink-500 hover:bg-ink-800'}`}
                              >
                                  {tab === 'ALL' ? 'Tất cả' : tab}
                              </button>
                          ))}
                      </div>
                  </div>

                  {/* Content List */}
                  <div className="flex-1 overflow-y-auto p-6 bg-black/20 scrollbar-thin scrollbar-thumb-ink-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {wikiEntries
                              .filter(e => wikiTab === 'ALL' || e.type === wikiTab)
                              .map(entry => (
                                  <div 
                                      key={entry.id} 
                                      onClick={() => isSelectionMode ? (entry.id && toggleWikiSelection(entry.id)) : setSelectedWikiEntry(entry)}
                                      className={`p-3 rounded-lg border bg-ink-900/80 hover:bg-ink-800 cursor-pointer flex items-center gap-3 transition-all relative overflow-hidden group ${
                                          isSelectionMode && entry.id && selectedWikiIds.has(entry.id) 
                                          ? 'border-crimson-500 ring-1 ring-crimson-500/50' 
                                          : 'border-ink-700 hover:border-arcane-500/50'
                                      }`}
                                  >
                                      {/* Icon */}
                                      <div className={`w-10 h-10 rounded bg-ink-950 flex items-center justify-center flex-shrink-0 border border-white/5 text-lg ${
                                          entry.type === 'NPC' ? 'text-pink-400' :
                                          entry.type === 'LOCATION' ? 'text-blue-400' :
                                          entry.type === 'ITEM' ? 'text-gold-400' :
                                          'text-arcane-400'
                                      }`}>
                                          <i className={`fas ${
                                              entry.type === 'NPC' ? 'fa-user' :
                                              entry.type === 'LOCATION' ? 'fa-map-marker-alt' :
                                              entry.type === 'ITEM' ? 'fa-khanda' :
                                              entry.type === 'FACTION' ? 'fa-users' :
                                              entry.type === 'SKILL' ? 'fa-bolt' : 'fa-book'
                                          }`}></i>
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                          <div className="flex justify-between">
                                              <h4 className="font-bold text-parchment-200 text-sm truncate">{entry.name}</h4>
                                              <span className="text-[9px] text-ink-500 uppercase font-bold">{entry.type}</span>
                                          </div>
                                          <p className="text-[10px] text-ink-400 truncate">{entry.description}</p>
                                      </div>

                                      {/* Quick Delete Btn (Hover) */}
                                      {!isSelectionMode && (
                                          <button 
                                              onClick={(e) => { e.stopPropagation(); if(entry.id) handleDeleteWikiEntryRequest(entry.id, entry.name); }}
                                              className="w-8 h-8 flex items-center justify-center text-ink-600 hover:text-crimson-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                          >
                                              <i className="fas fa-trash-alt"></i>
                                          </button>
                                      )}
                                  </div>
                              ))}
                          {wikiEntries.filter(e => wikiTab === 'ALL' || e.type === wikiTab).length === 0 && (
                              <div className="col-span-full text-center py-10 text-ink-600 text-xs italic">
                                  Chưa có dữ liệu nào trong mục này.
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* SUMMARY MODAL - ADDED */}
      {showSummary && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowSummary(false)}>
              <div className="bg-ink-900 border border-spirit-500/30 rounded-xl w-full max-w-3xl h-[70vh] flex flex-col shadow-2xl relative" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-white/10 bg-ink-950/50 flex justify-between items-center">
                      <h3 className="text-xl font-display font-bold text-spirit-400 flex items-center gap-2">
                          <i className="fas fa-history"></i> Tóm Tắt Cốt Truyện
                      </h3>
                      <button onClick={() => setShowSummary(false)} className="text-ink-500 hover:text-white"><i className="fas fa-times"></i></button>
                  </div>
                  <div className="flex-1 p-8 overflow-y-auto font-serif text-parchment-200 leading-loose text-justify text-lg bg-ink-900/80">
                      {session.summary ? session.summary.split('\n').map((p, i) => <p key={i} className="mb-4">{p}</p>) : <div className="text-center text-ink-500 italic">Chưa có tóm tắt nào được tạo...</div>}
                  </div>
              </div>
          </div>
      )}

      {/* GAME CONFIG MODAL - RESTORED TO MATCH SCREENSHOT */}
      {showGameConfig && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowGameConfig(false)}>
              <div className="bg-ink-900 border border-gold-500/30 rounded-xl w-full max-w-lg shadow-2xl p-6 relative animate-slide-up max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                      <h3 className="text-xl font-bold text-gold-400 flex items-center gap-2">
                          <i className="fas fa-cogs"></i> Cấu Hình Trò Chơi
                      </h3>
                      <button onClick={() => setShowGameConfig(false)} className="text-ink-500 hover:text-white"><i className="fas fa-times"></i></button>
                  </div>

                  <div className="space-y-6">
                      {/* 1. EPIC MODE */}
                      <div className="flex items-center justify-between bg-ink-900/50 p-3 rounded-lg border border-ink-800">
                          <div>
                              <div className="text-sm font-bold text-parchment-200 flex items-center gap-2">
                                  <i className="fas fa-book-open text-blue-400"></i> Cố định 1200 từ (Epic Mode)
                              </div>
                              <div className="text-[10px] text-ink-500 mt-1">Luôn yêu cầu AI viết ít nhất 1200 chữ mỗi lượt (Bỏ qua chế độ Ngắn/Vừa).</div>
                          </div>
                          <button
                              onClick={() => setForce1200(!force1200)}
                              className={`w-12 h-6 rounded-full relative transition-colors ${force1200 ? 'bg-blue-600' : 'bg-ink-700'}`}
                          >
                              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${force1200 ? 'translate-x-7' : 'translate-x-1'}`}></div>
                          </button>
                      </div>

                      {/* 2. AI MODEL */}
                      <div className="bg-ink-900/50 p-3 rounded-lg border border-ink-800">
                          <div className="text-[10px] font-bold text-ink-500 uppercase tracking-wider mb-2">Mô Hình AI</div>
                          <div className="grid grid-cols-3 gap-2">
                               {[
                                   { id: 'gemini-3-pro-preview', label: 'Pro 3.0', sub: 'Mạnh Nhất', icon: 'fa-brain', color: 'text-purple-400' },
                                   { id: 'gemini-2.5-flash', label: 'Flash 3.0', sub: 'Nhanh', icon: 'fa-bolt', color: 'text-yellow-400' },
                                   { id: 'gemini-flash-lite-latest', label: 'Flash Lite', sub: 'Siêu Tốc', icon: 'fa-feather', color: 'text-blue-400' },
                               ].map((m) => (
                                   <button
                                       key={m.id}
                                       onClick={() => onUpdateSession('aiModel', m.id)}
                                       className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border transition-all ${
                                           (session.aiModel || 'gemini-3-pro-preview') === m.id
                                           ? 'bg-ink-800 border-gold-500/50 shadow-sm'
                                           : 'bg-ink-950/40 border-ink-700 hover:border-ink-500'
                                       }`}
                                   >
                                       <i className={`fas ${m.icon} ${m.color} text-sm mb-1`}></i>
                                       <span className={`text-[10px] font-bold ${(session.aiModel || 'gemini-3-pro-preview') === m.id ? 'text-parchment-100' : 'text-ink-500'}`}>{m.label}</span>
                                       <span className="text-[8px] text-ink-600">{m.sub}</span>
                                   </button>
                               ))}
                          </div>
                          <div className="text-[9px] text-ink-600 mt-2 italic">* Lưu ý: Pro 3.0 thông minh hơn nhưng phản hồi chậm hơn Flash.</div>
                      </div>

                      {/* 3. SUPER MEMORY */}
                      <div className="flex items-center justify-between bg-ink-900/50 p-3 rounded-lg border border-ink-800">
                          <div>
                              <div className="text-sm font-bold text-parchment-200 flex items-center gap-2">
                                  <i className="fas fa-microchip text-jade-400"></i> Siêu Trí Nhớ (Super Memory)
                              </div>
                              <div className="text-[10px] text-ink-500 mt-1">Đang Bật: AI quét toàn bộ lịch sử để nhớ lại chi tiết cũ (Tốn token hơn).</div>
                          </div>
                          <button
                              onClick={() => onUpdateSession('memoryDepth', session.memoryDepth === 'high' ? 'standard' : 'high')}
                              className={`w-12 h-6 rounded-full relative transition-colors ${session.memoryDepth === 'high' ? 'bg-jade-600' : 'bg-ink-700'}`}
                          >
                              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${session.memoryDepth === 'high' ? 'translate-x-7' : 'translate-x-1'}`}></div>
                          </button>
                      </div>

                      {/* 4. LIVING WORLD TOGGLE (NEW REQUEST) */}
                      <div className="flex items-center justify-between bg-ink-900/50 p-3 rounded-lg border border-ink-800">
                          <div>
                              <div className="text-sm font-bold text-parchment-200 flex items-center gap-2">
                                  <i className="fas fa-globe-americas text-arcane-400"></i> Thế Giới Sống (Living World)
                              </div>
                              <div className="text-[10px] text-ink-500 mt-1">
                                  {session.mechanics?.livingWorld 
                                      ? "Đang Bật: AI sẽ tạo sự kiện nền, tin đồn phe phái." 
                                      : "Đang Tắt: Tập trung hoàn toàn vào nhân vật chính."}
                              </div>
                          </div>
                          <button
                              onClick={() => updateMechanics('livingWorld', !session.mechanics?.livingWorld)}
                              className={`w-12 h-6 rounded-full relative transition-colors ${session.mechanics?.livingWorld ? 'bg-arcane-600' : 'bg-ink-700'}`}
                          >
                              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${session.mechanics?.livingWorld ? 'translate-x-7' : 'translate-x-1'}`}></div>
                          </button>
                      </div>

                      {/* 5. NSFW SECTION */}
                      <div className="bg-ink-900/50 p-3 rounded-lg border border-crimson-900/30">
                          <div className="flex items-center justify-between mb-3">
                              <div>
                                  <div className="text-sm font-bold text-parchment-200 flex items-center gap-2">
                                      <i className="fas fa-exclamation-triangle text-crimson-500"></i> Chế độ NSFW (18+)
                                  </div>
                                  <div className="text-[10px] text-ink-500 mt-1">Bật/Tắt nội dung người lớn.</div>
                              </div>
                              <button
                                  onClick={() => onUpdateSession('isNSFW', !session.isNSFW)}
                                  className={`w-12 h-6 rounded-full relative transition-colors ${session.isNSFW ? 'bg-crimson-600' : 'bg-ink-700'}`}
                              >
                                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${session.isNSFW ? 'translate-x-7' : 'translate-x-1'}`}></div>
                              </button>
                          </div>

                          {session.isNSFW && (
                              <div className="animate-slide-up space-y-3 pt-2 border-t border-crimson-900/30">
                                  <div>
                                      <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider mb-2 block">Mức Độ Chi Tiết</label>
                                      <div className="grid grid-cols-2 gap-2">
                                          <button
                                              onClick={() => onUpdateSession('nsfwIntensity', 'soft')}
                                              className={`py-2 rounded text-xs font-bold transition-all border ${session.nsfwIntensity === 'soft' ? 'bg-ink-800 text-crimson-300 border-crimson-500/50' : 'bg-ink-950/40 text-ink-500 border-ink-700'}`}
                                          >
                                              Vừa Phải (Soft)
                                          </button>
                                          <button
                                              onClick={() => onUpdateSession('nsfwIntensity', 'extreme')}
                                              className={`py-2 rounded text-xs font-bold transition-all border ${session.nsfwIntensity === 'extreme' ? 'bg-crimson-600 text-white border-crimson-400 shadow-[0_0_10px_rgba(220,38,38,0.4)]' : 'bg-ink-950/40 text-ink-500 border-ink-700'}`}
                                          >
                                              Cực Hạn (Extreme)
                                          </button>
                                      </div>
                                  </div>

                                  {session.nsfwIntensity === 'extreme' && (
                                      <div>
                                          <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider mb-2 block">Tùy Chọn Trọng Tâm (Chọn Nhiều)</label>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                              {[
                                                  { id: 'body', label: 'Miêu Tả Cơ Thể', icon: 'fa-venus' },
                                                  { id: 'action', label: 'Hành Động Trần Trụi', icon: 'fa-hand-rock' },
                                                  { id: 'emotion', label: 'Cảm Xúc/Khoái Cảm', icon: 'fa-heart-pulse' },
                                                  { id: 'dialogue', label: 'Lời Thoại Dâm Tục', icon: 'fa-comments' },
                                                  { id: 'vulgar', label: 'Từ Ngữ Thô Tục', icon: 'fa-pepper-hot' },
                                                  { id: 'roleplay', label: 'Giữ Đúng Tính Cách', icon: 'fa-user-check' },
                                              ].map((item) => (
                                                  <button 
                                                      key={item.id}
                                                      onClick={() => toggleNsfwFocus(item.id as any)}
                                                      className={`
                                                          p-2 rounded border text-[10px] font-bold flex items-center gap-2 transition-all text-left
                                                          ${(session.nsfwFocus || []).includes(item.id as any)
                                                              ? 'bg-crimson-900/40 border-crimson-500 text-crimson-200' 
                                                              : 'bg-ink-950/40 border-ink-800 text-ink-500 hover:text-crimson-300'}
                                                      `}
                                                  >
                                                      <i className={`fas ${item.icon} w-4`}></i>
                                                      {item.label}
                                                  </button>
                                              ))}
                                          </div>
                                          <div className="text-[9px] text-ink-500 mt-2 italic">*Lưu ý: Chọn "Giữ Đúng Tính Cách" để tránh AI biến nhân vật thành bạo dâm/tàn nhẫn vô lý.</div>
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>
                  </div>
                  
                  <div className="mt-6 flex justify-end sticky bottom-0 bg-ink-950 pt-2 border-t border-white/5">
                      <button onClick={() => setShowGameConfig(false)} className="w-full bg-gold-600 hover:bg-gold-500 text-ink-950 font-bold py-3 rounded-lg shadow-lg transition-all text-sm uppercase tracking-wide">Đóng & Áp Dụng</button>
                  </div>
              </div>
          </div>
      )}

      {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={closeConfirm}>
              <div className="bg-ink-900 border border-gold-500/30 rounded-xl w-full max-w-sm shadow-2xl p-6 relative animate-slide-up" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-gold-400 mb-4 text-center border-b border-white/5 pb-2">Xác Nhận</h3>
                  <div className="text-parchment-200 text-center mb-6 text-sm leading-relaxed">{confirmModal.message}</div>
                  <div className="flex justify-center gap-4">
                      <button onClick={closeConfirm} className="px-5 py-2 rounded bg-ink-800 text-ink-400 hover:text-white text-xs font-bold border border-ink-700 hover:border-ink-500 transition-all">Hủy</button>
                      <button onClick={handleConfirmAction} className="px-5 py-2 rounded bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold shadow-lg border border-crimson-400 transition-all">Xác Nhận</button>
                  </div>
              </div>
          </div>
      )}
      
      <div className={`flex-1 flex flex-col h-full relative z-10 transition-all duration-700 ${cinemaMode ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
        
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-ink-950/80 backdrop-blur-md z-50 shadow-sm relative">
          <div className="flex items-center gap-4">
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 via-crimson-500 to-arcane-600 flex items-center justify-center text-ink-950 shadow-[0_0_15px_rgba(234,179,8,0.3)]"><i className="fas fa-yin-yang fa-spin-slow text-sm text-white"></i></div>
             <div className="flex flex-col">
                 <h1 className="font-display font-bold text-lg md:text-xl text-transparent bg-clip-text bg-gradient-to-r from-gold-300 via-parchment-100 to-spirit-300 tracking-wide drop-shadow-sm truncate max-w-[200px] md:max-w-none">{currentStats?.name || "Nhập Vai Simulator"}</h1>
                 
                 {currentStats?.currentTime && (
                     <div className="flex items-center gap-2 text-xs md:text-sm text-gold-300/90 font-mono tracking-tight bg-ink-900/50 px-2 py-0.5 rounded border border-white/5 mt-0.5">
                         <i className="far fa-clock text-gold-500"></i>
                         <span className="font-bold">{currentStats.currentTime}</span>
                     </div>
                 )}
             </div>
          </div>
          <div className="flex gap-2">
            {/* New Mute Button */}
            {session.backgroundType === 'video' && (
                <button 
                    onClick={() => setIsBgMuted(!isBgMuted)}
                    className={`p-2 rounded-full transition-all duration-300 flex items-center gap-2 ${!isBgMuted ? 'bg-blue-500/20 text-blue-400' : 'text-ink-500 hover:text-parchment-100 hover:bg-ink-800/50'}`}
                    title={isBgMuted ? "Bật âm thanh nền" : "Tắt âm thanh nền"}
                >
                    <i className={`fas ${isBgMuted ? 'fa-volume-mute' : 'fa-volume-high'} text-lg`}></i>
                </button>
            )}

            {/* FULLSCREEN BACKGROUND TOGGLE */}
            {(session.backgroundImageUrl) && (
                <button 
                    onClick={() => setShowFullBg(true)}
                    className="p-2 rounded-full transition-all duration-300 flex items-center gap-2 text-ink-500 hover:text-parchment-100 hover:bg-ink-800/50" 
                    title="Phóng to ảnh nền (Xem Full)"
                >
                    <i className="fas fa-expand text-lg"></i>
                </button>
            )}

            <button 
                onClick={() => setShowTTS(!showTTS)} 
                className={`p-2 rounded-full transition-all duration-300 flex items-center gap-2 ${showTTS ? 'bg-gold-500/20 text-gold-400' : 'text-ink-500 hover:text-parchment-100 hover:bg-ink-800/50'}`} 
                title="Đọc truyện"
            >
                <i className="fas fa-volume-up text-lg"></i>
            </button>

            <button onClick={() => setCinemaMode(true)} className="p-2 rounded-full transition-all duration-300 flex items-center gap-2 text-ink-500 hover:text-parchment-100 hover:bg-ink-800/50" title="Chế độ Điện Ảnh (Ẩn UI)">
                <i className="fas fa-eye-slash text-lg"></i>
            </button>
            <button onClick={onExit} className="p-2 rounded-full transition-all duration-300 flex items-center gap-2 text-crimson-500/80 hover:text-crimson-400 hover:bg-ink-800/50" title="Về màn hình chính">
                <i className="fas fa-home text-lg"></i>
            </button>
            <button onClick={() => setShowStatsMobile(!showStatsMobile)} className="md:hidden text-parchment-400 p-2 w-10 hover:bg-ink-800/50 rounded-full transition-colors flex items-center justify-center relative z-50"><i className={`fas ${showStatsMobile ? 'fa-times' : 'fa-scroll'} text-xl`}></i></button>
          </div>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 md:px-20 lg:px-32 py-8 scroll-smooth scrollbar-thin scrollbar-thumb-gold-500/10 pb-[220px]">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {totalPages > 1 && (
                <div className="flex justify-center mb-6 animate-fade-in sticky top-0 z-20">
                    <div className="flex items-center gap-2 bg-ink-900/90 rounded-full px-2 py-1.5 border border-ink-700/50 backdrop-blur-md shadow-lg">
                        <button onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="w-8 h-8 rounded-full flex items-center justify-center text-ink-500 hover:text-gold-400 hover:bg-ink-800 transition-colors disabled:opacity-30"><i className="fas fa-angle-double-left text-xs"></i></button>
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="w-8 h-8 rounded-full flex items-center justify-center text-ink-500 hover:text-gold-400 hover:bg-ink-800 transition-colors disabled:opacity-30"><i className="fas fa-chevron-left text-xs"></i></button>
                        
                        <span className="text-[10px] font-bold text-gold-500 uppercase tracking-widest px-2 min-w-[80px] text-center">
                            Trang {currentPage} / {totalPages}
                        </span>
                        
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="w-8 h-8 rounded-full flex items-center justify-center text-ink-500 hover:text-gold-400 hover:bg-ink-800 transition-colors disabled:opacity-30"><i className="fas fa-chevron-right text-xs"></i></button>
                        <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="w-8 h-8 rounded-full flex items-center justify-center text-ink-500 hover:text-gold-400 hover:bg-ink-800 transition-colors disabled:opacity-30"><i className="fas fa-angle-double-right text-xs"></i></button>
                    </div>
                </div>
            )}

            {displayedTurns.map((turn, idx) => {
               let worldEvents: string[] | undefined = undefined;
               if (turn.role === 'model' && turn.rawResponseJSON) {
                   try {
                       const json = JSON.parse(turn.rawResponseJSON);
                       if (Array.isArray(json.worldEvents)) {
                           worldEvents = json.worldEvents;
                       }
                   } catch {}
               }

               return (
                  <div key={idx} className="relative group">
                    {turn.role === 'model' ? (
                        <div className="pl-4 md:pl-0 border-l-2 border-transparent md:border-none">
                          <NarrativeDisplay 
                            text={turn.narrative || ''} 
                            worldEvents={worldEvents} 
                            wikiEntries={wikiEntries} 
                            onWikiClick={setSelectedWikiEntry} 
                            style={{ fontFamily: session.fontFamily || "'Merriweather', serif", color: session.textColor || "#fffbeb" }} 
                            isLivingWorldEnabled={session.mechanics?.livingWorld ?? false} 
                            fontSize={session.fontSize}
                            lineHeight={session.lineHeight}
                            turnsLength={turns.length}
                          />
                        </div>
                    ) : (
                        <div className="flex justify-center my-8 animate-slide-up">
                          <div className="relative max-w-2xl w-full group">
                            <div className="px-8 py-6 rounded-xl border backdrop-blur-md relative overflow-hidden bg-ink-900/60 border-gold-500/20 shadow-xl">
                              <div className="absolute inset-0 bg-gradient-to-r pointer-events-none from-transparent via-gold-500/5 to-transparent"></div>
                              <i className="fas fa-pen absolute top-4 right-4 text-ink-600 text-xs"></i>
                              
                              <div className="text-[10px] font-bold mb-3 uppercase tracking-[0.2em] flex items-center gap-2 text-gold-500">
                                <i className="fas fa-comment-alt"></i> Mệnh Lệnh
                              </div>
                              <UserMessage text={turn.userPrompt || ''} />
                            </div>
                          </div>
                        </div>
                    )}
                  </div>
               );
            })}
            
            {loading && (
              <div className="flex flex-col items-center justify-center space-y-4 py-8 opacity-90">
                <div className="relative w-16 h-16"><div className="absolute inset-0 border-2 border-gold-500/10 rounded-full"></div><div className="absolute inset-0 border-2 border-t-gold-400 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div><div className="absolute inset-2 border-2 border-t-transparent border-r-crimson-400 border-b-transparent border-l-transparent rounded-full animate-spin-slow direction-reverse"></div><div className="absolute inset-0 flex items-center justify-center"><i className="fas fa-feather-alt text-gold-500/50 animate-pulse"></i></div></div>
                <span className="text-gold-400 text-xs tracking-[0.3em] uppercase animate-pulse font-display">Thiên Đạo Diễn Sinh...</span>
              </div>
            )}
            
            <div ref={bottomRef} className="h-6" />
          </div>
        </div>

        <div className={`fixed bottom-0 left-0 right-0 p-4 md:p-6 z-40 transition-all duration-500 border-t border-white/5 backdrop-blur-xl shadow-[0_-5px_30px_rgba(0,0,0,0.5)] ${inputMode === 'system' ? 'bg-indigo-950/95 border-t-purple-500/20' : 'bg-ink-900/95 border-t-gold-500/10'}`}>
          <div className="max-w-4xl mx-auto relative flex flex-col gap-3">
            
            <div className="flex gap-2 mb-1">
                <button onClick={onUndo} disabled={loading} className="px-4 py-2 bg-ink-900/50 border border-ink-700/50 rounded text-[10px] font-bold text-ink-400 hover:text-white hover:border-ink-500 uppercase tracking-wider flex items-center gap-2 transition-colors">
                    <i className="fas fa-undo"></i> Hoàn Tác
                </button>
                <button onClick={handleContinue} disabled={loading} className="px-4 py-2 bg-ink-900/50 border border-ink-700/50 rounded text-[10px] font-bold text-ink-400 hover:text-white hover:border-ink-500 uppercase tracking-wider flex items-center gap-2 transition-colors">
                    <i className="fas fa-forward"></i> Tiếp Tục
                </button>
                <div className="flex-1 text-right text-[10px] text-ink-500 italic pt-2">
                    {inputMode === 'system' ? 'Chế độ Thiên Đạo' : 'Chế độ Nhập Vai'} • {force1200 ? 'Epic 1200+ (Khóa)' : (lengthMode === 'epic' ? 'Cực Dài (1200+)' : lengthInfo.label)}
                </div>
            </div>

            <div className="flex gap-2 relative items-stretch">
                <button 
                    onClick={toggleInputMode}
                    className={`w-12 border rounded-xl flex items-center justify-center transition-all shadow-inner ${inputMode === 'system' ? 'bg-purple-900/40 border-purple-500 text-purple-300' : 'bg-gold-900/20 border-gold-500/30 text-gold-400 hover:text-white hover:bg-gold-900/40'}`}
                    title={inputMode === 'system' ? "Chuyển sang chế độ Hành Động" : "Chuyển sang chế độ Thiên Đạo"}
                >
                    <i className={`fas ${inputMode === 'system' ? 'fa-eye' : 'fa-user'} text-lg`}></i>
                </button>

                <div className={`flex-1 relative group flex items-center border rounded-xl overflow-hidden shadow-inner transition-all ${inputMode === 'system' ? 'bg-indigo-900/40 border-purple-500/50 focus-within:bg-indigo-900/60' : 'bg-ink-900/60 border-ink-700 focus-within:border-gold-500/50 focus-within:bg-ink-800/80'}`}>
                    
                    <button onClick={cycleLengthMode} disabled={force1200} className={`pl-4 pr-3 h-full transition-colors flex items-center gap-2 border-r border-white/5 min-w-[100px] ${inputMode === 'system' ? 'text-purple-300 hover:text-purple-200' : 'text-ink-400 hover:text-gold-400'} ${force1200 ? 'opacity-50 cursor-not-allowed' : ''}`} title="Độ dài câu chuyện">
                         <i className="fas fa-bars"></i>
                         <span className="text-xs font-bold whitespace-nowrap">{force1200 ? '1200+' : (lengthMode === 'epic' ? `Cực Dài` : lengthInfo.label)}</span>
                    </button>
                    
                    <input 
                        ref={inputRef} 
                        type="text" 
                        placeholder={inputMode === 'system' ? "Nhập ý chí của Thiên Đạo..." : "Nhập hành động (hoặc *Lệnh*)..."}
                        className={`flex-1 bg-transparent px-4 py-4 focus:outline-none font-serif h-full text-lg ${inputMode === 'system' ? 'text-purple-100 placeholder-purple-400/50' : 'text-parchment-100 placeholder-ink-600'}`}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !loading) { handleInputSubmit(e.currentTarget.value); e.currentTarget.value = ''; }}} 
                    />
                </div>
                
                <button onClick={() => { if(inputRef.current) { handleInputSubmit(inputRef.current.value); inputRef.current.value = ''; } }} disabled={loading} className={`w-16 rounded-xl flex items-center justify-center text-xl shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50 border ${inputMode === 'system' ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white border-purple-400/50 hover:shadow-[0_0_15px_rgba(147,51,234,0.4)]' : 'bg-gradient-to-br from-gold-500 to-amber-600 text-white border-gold-400/50 hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]'}`}>
                    <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
                </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`fixed inset-y-0 right-0 w-80 bg-ink-950/95 backdrop-blur-2xl border-l border-white/5 transform transition-transform duration-300 z-[60] shadow-2xl md:relative md:transform-none md:w-80 md:bg-ink-950/30 md:shadow-none md:z-20 ${showStatsMobile ? 'translate-x-0' : 'translate-x-full md:translate-x-0'} ${cinemaMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button onClick={() => setShowStatsMobile(false)} className="md:hidden absolute top-4 left-4 text-parchment-300 hover:text-white p-2"><i className="fas fa-times text-xl"></i></button>
        {currentStats ? (
          <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-ink-700 flex flex-col relative pb-[100px]">
            <div className="flex flex-col items-center mb-8 relative">
              <div className="relative group cursor-pointer animate-float">
                <div className="w-24 h-24 rounded-full p-[2px] bg-gradient-to-tr from-gold-400 via-crimson-500 to-spirit-500 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                   <div className="w-full h-full rounded-full overflow-hidden bg-ink-950 border-2 border-ink-900"><img src={avatarUrl || `https://ui-avatars.com/api/?name=${currentStats.name}&background=random`} alt="Avatar" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500 hover:scale-110" /></div>
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-ink-900 border border-gold-500/50 px-3 py-1 rounded-full text-[9px] font-bold text-gold-300 uppercase whitespace-nowrap shadow-lg tracking-widest font-display">{currentStats.realm?.split(' ')[0] || 'Phàm Nhân'}</div>
              </div>
              <h2 className="mt-6 text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-parchment-100 to-parchment-300 text-center drop-shadow">{currentStats.name}</h2>
              <div className="text-ink-500 text-[9px] uppercase tracking-[0.2em] mt-1 font-bold">Địa Vị</div>
              <div className="text-gold-300 text-sm mt-0.5 font-bold drop-shadow-sm font-display">{currentStats.realm}</div>
            </div>

            <div className="space-y-3">
              <div className="bg-ink-900/40 border border-ink-700/50 rounded-xl p-3 hover:border-crimson-500/30 transition-colors">
                <div className="flex items-center gap-2 mb-1"><i className="fas fa-heart-pulse text-crimson-400 text-xs"></i><span className="text-[9px] font-bold text-ink-500 uppercase tracking-wide">Trạng Thái</span></div>
                <div className="text-sm text-parchment-200 font-display">{currentStats.status}</div>
              </div>

              <div className="bg-ink-900/40 border border-ink-700/50 rounded-xl p-3 hover:border-blue-500/30 transition-colors">
                    <div className="flex items-center gap-2 mb-1"><i className="far fa-clock text-blue-400 text-xs"></i><span className="text-[9px] font-bold text-ink-500 uppercase tracking-wide">Thời Gian</span></div>
                    <div className="text-sm text-parchment-200 font-display">{currentStats.currentTime || <span className="text-ink-600 italic text-xs">...</span>}</div>
              </div>

              <div className="bg-ink-900/40 border border-ink-700/50 rounded-xl p-3 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-1 opacity-10"><i className="fas fa-atom text-4xl"></i></div>
                   <div className="flex items-center gap-2 mb-2"><i className="fas fa-dna text-gold-400 text-xs"></i><span className="text-[9px] font-bold text-ink-500 uppercase tracking-wide">Gia Thế / Căn Cơ</span></div>
                   <div className="text-sm font-bold text-gold-400 mb-2">{currentStats.spiritualRoot || currentStats.realm}</div>
                   
                   {Array.isArray(currentStats.talents) && (
                       <div className="flex flex-wrap gap-1.5">
                           {currentStats.talents.map((t, i) => (
                               <span key={i} className="text-[10px] bg-ink-950 border border-ink-700 px-2 py-0.5 rounded text-ink-400">{t}</span>
                           ))}
                       </div>
                   )}
              </div>
              
              <div className="bg-ink-900/40 border border-ink-700/50 rounded-xl p-3 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center gap-2">
                        <i className="fas fa-chart-bar text-jade-400 text-xs"></i>
                        <span className="text-[9px] font-bold text-ink-500 uppercase tracking-wide">Chỉ Số Cơ Bản</span>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                      {Array.isArray(currentStats.attributes) && currentStats.attributes.length > 0 ? (
                          currentStats.attributes.map((attr, idx) => (
                              <div key={idx} className="bg-ink-950/50 border border-ink-800 rounded px-2 py-1.5 flex flex-col items-center justify-center">
                                  <span className="text-[8px] text-ink-500 uppercase font-bold">{attr.key}</span>
                                  <span className="text-xs font-bold text-parchment-100">{attr.value}</span>
                              </div>
                          ))
                      ) : (
                          <div className="col-span-2 text-[10px] text-ink-600 italic text-center py-2">Chưa có dữ liệu...</div>
                      )}
                  </div>
                  
                  <div className="bg-ink-950/80 border border-gold-500/20 rounded px-3 py-2 flex items-center justify-between">
                       <span className="text-[9px] text-gold-500 uppercase font-bold"><i className="fas fa-coins mr-1"></i> Tài Sản</span>
                       <span className="text-xs font-bold text-gold-300">{currentStats.currency || "0"}</span>
                  </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="text-[10px] font-bold text-gold-500 uppercase tracking-wide"><i className="fas fa-box-open mr-1"></i> Hành Trang</h3>
                    <span className="text-[9px] text-ink-600 bg-ink-900 px-1.5 rounded">{currentStats.inventory?.length || 0}</span>
                </div>
                <ul className="space-y-1 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-ink-800 bg-ink-900/20 rounded-lg p-1">
                  {Array.isArray(currentStats.inventory) && currentStats.inventory.length > 0 ? currentStats.inventory.map((item, i) => <li key={i} className="flex items-center group p-2 rounded hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5"><div className="w-5 h-5 rounded bg-ink-950 border border-ink-800 flex items-center justify-center mr-2 text-ink-600 group-hover:text-gold-500"><i className="fas fa-cube text-[8px]"></i></div><span className="text-xs text-parchment-300 font-serif">{item}</span></li>) : <li className="text-center py-4 text-ink-700 italic text-[10px]">Trống</li>}
                </ul>
                
                <div className="grid grid-cols-2 gap-2 mt-4">
                    <button onClick={() => setShowWiki(true)} className="bg-ink-900 border border-ink-700 hover:border-arcane-500 hover:text-arcane-400 text-ink-500 rounded p-3 flex flex-col items-center justify-center gap-1 transition-all">
                        <i className="fas fa-book text-sm"></i>
                        <span className="text-[8px] font-bold uppercase">Wiki</span>
                    </button>
                    <button onClick={() => setShowSummary(true)} className="bg-ink-900 border border-ink-700 hover:border-spirit-500 hover:text-spirit-400 text-ink-500 rounded p-3 flex flex-col items-center justify-center gap-1 transition-all">
                        <i className="fas fa-list-alt text-sm"></i>
                        <span className="text-[8px] font-bold uppercase">Cốt Truyện</span>
                    </button>
                    <button onClick={handleSaveGame} className="bg-ink-900 border border-ink-700 hover:border-emerald-500 hover:text-emerald-400 text-ink-500 rounded p-3 flex flex-col items-center justify-center gap-1 transition-all">
                        <i className="fas fa-save text-sm"></i>
                        <span className="text-[8px] font-bold uppercase">Lưu</span>
                    </button>
                    <button onClick={() => setShowGameConfig(true)} className="bg-ink-900 border border-ink-700 hover:border-gold-500 hover:text-gold-400 text-ink-500 rounded p-3 flex flex-col items-center justify-center gap-1 transition-all">
                        <i className="fas fa-cog text-sm"></i>
                        <span className="text-[8px] font-bold uppercase">Cấu Hình</span>
                    </button>
                    <button onClick={() => setShowAppearance(true)} className="bg-ink-900 border border-ink-700 hover:border-pink-500 hover:text-pink-400 text-ink-500 rounded p-3 flex flex-col items-center justify-center gap-1 transition-all">
                        <i className="fas fa-pen-nib text-sm"></i>
                        <span className="text-[8px] font-bold uppercase">Giao Diện</span>
                    </button>
                    <button onClick={onExport} className="bg-ink-900 border border-ink-700 hover:border-jade-500 hover:text-jade-400 text-ink-500 rounded p-3 flex flex-col items-center justify-center gap-1 transition-all">
                        <i className="fas fa-file-export text-sm"></i>
                        <span className="text-[8px] font-bold uppercase">Xuất</span>
                    </button>
                    <button onClick={onDelete} className="bg-ink-900 border border-ink-700 hover:border-crimson-500 hover:text-crimson-400 text-ink-500 rounded p-3 flex flex-col items-center justify-center gap-1 transition-all">
                        <i className="fas fa-trash-alt text-sm"></i>
                        <span className="text-[8px] font-bold uppercase">Xóa</span>
                    </button>
                    
                    <button onClick={() => setShowMap(true)} className="bg-blue-900/20 border border-blue-700/50 hover:border-blue-400 hover:text-blue-300 text-blue-500 rounded p-3 flex flex-col items-center justify-center gap-1 transition-all col-span-1 mt-1">
                        <i className="fas fa-map-marked-alt text-sm"></i>
                        <span className="text-[8px] font-bold uppercase">Bản Đồ</span>
                    </button>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-ink-800">
                  <div className="text-[9px] font-bold text-ink-600 uppercase tracking-widest mb-2 text-center">Thông Tin Hệ Thống</div>
                  <div className="bg-ink-950/60 border border-ink-800 rounded-lg p-3 space-y-2">
                       <div className="flex justify-between items-center">
                           <span className="text-[10px] text-ink-500 font-bold">Model:</span>
                           <span className="text-[10px] text-parchment-300 font-mono bg-ink-900 px-1.5 py-0.5 rounded border border-ink-700">
                               {session.aiModel || 'gemini-3-pro-preview'}
                           </span>
                       </div>
                       <div className="flex justify-between items-center">
                           <span className="text-[10px] text-ink-500 font-bold">Memory:</span>
                           <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${session.memoryDepth === 'high' ? 'bg-jade-900/30 border-jade-500/30 text-jade-400' : 'bg-ink-900 border-ink-700 text-ink-500'}`}>
                               <div className={`w-1.5 h-1.5 rounded-full ${session.memoryDepth === 'high' ? 'bg-jade-500 animate-pulse' : 'bg-ink-600'}`}></div>
                               <span className="text-[9px] font-bold uppercase">{session.memoryDepth === 'high' ? 'HIGH' : 'STD'}</span>
                           </div>
                       </div>
                  </div>
              </div>
            </div>
            
            <div className="mt-auto pt-4 border-t border-white/5 text-center pb-2">
                <div className="text-[8px] text-ink-700 uppercase tracking-widest font-bold font-display opacity-50">Nhập Vai Simulator • By Zesty</div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-ink-600 p-6 text-center"><div className="w-16 h-16 rounded-full border-2 border-ink-800 flex items-center justify-center mb-4 opacity-50"><i className="fas fa-scroll text-2xl"></i></div><p className="text-xs mt-2 font-display uppercase tracking-widest">Đang tải dữ liệu...</p></div>
        )}
      </div>
      
      {showStatsMobile && <div className="fixed inset-0 bg-black/80 z-50 md:hidden backdrop-blur-sm" onClick={() => setShowStatsMobile(false)}/>}

      {/* FULLSCREEN BACKGROUND MODAL */}
      {showFullBg && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black animate-fade-in" onClick={() => setShowFullBg(false)}>
              <button className="absolute top-4 right-4 text-white text-2xl opacity-50 hover:opacity-100 transition-opacity z-50"><i className="fas fa-times"></i></button>
              {session.backgroundType === 'video' ? (
                  <video 
                      src={session.backgroundImageUrl} 
                      className="w-full h-full object-contain" 
                      autoPlay 
                      loop 
                      muted={false} 
                      controls
                  />
              ) : (
                  <img 
                      src={session.backgroundImageUrl} 
                      className="w-full h-full object-contain" 
                      alt="Full Background" 
                  />
              )}
          </div>
      )}

      {/* FULLSCREEN PREVIEW MODAL (GALLERY) */}
      {previewImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md animate-fade-in" onClick={() => setPreviewImage(null)}>
              <button className="absolute top-4 right-4 text-white/50 hover:text-white text-3xl transition-colors z-50">
                  <i className="fas fa-times"></i>
              </button>
              <div className="max-w-[95vw] max-h-[95vh] relative" onClick={e => e.stopPropagation()}>
                  {previewImage.endsWith('.mp4') || previewImage.endsWith('.webm') ? (
                      <video 
                          src={previewImage} 
                          className="max-w-full max-h-[90vh] rounded-lg shadow-2xl border border-white/10" 
                          controls 
                          autoPlay 
                      />
                  ) : (
                      <img 
                          src={previewImage} 
                          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-white/10" 
                          alt="Full Preview" 
                      />
                  )}
              </div>
          </div>
      )}
    </div>
  );
};