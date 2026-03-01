import React, { useState } from 'react';
import { db, findRelevantContext, findRelevantWiki } from './db';
import { geminiService } from './services/geminiService';
import { eventService } from './services/eventService';
import { GameSession, Turn, GameGenre, AIResponseSchema, WorldSettings, CharacterTraits, StoryLength, RegistryEntry, NSFWIntensity, WritingStyle, NSFWFocus, AIStyle, EventFrequency, GameMechanics, GalleryImage } from './types';
import { SettingsScreen } from './components/SettingsScreen';
import { GameUI } from './components/GameUI';
import { LandingScreen } from './components/LandingScreen';
import { ErrorBoundary } from './components/ErrorBoundary';

type AppStep = 'landing' | 'settings' | 'game';

function App() {
  const [step, setStep] = useState<AppStep>('landing');

  const [session, setSession] = useState<GameSession | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  
  // NEW: State to hold template data when cloning a session
  const [pendingTemplate, setPendingTemplate] = useState<any>(null);

  // Derived state from the latest model turn
  const [currentStats, setCurrentStats] = useState<AIResponseSchema['stats'] | null>(null);
  const [currentOptions, setCurrentOptions] = useState<AIResponseSchema['options'] | null>(null);

  // 1. Settings (Character + World) Handler -> Start Game
  const startGame = async (
    basicInfo: { 
        name: string;
        customTitle: string; 
        genre: GameGenre; 
        gender: string; 
        avatarUrl?: string;
        backgroundImageUrl?: string; 
        backgroundType?: 'image' | 'video'; 
        fontFamily: string; // NEW
        isNSFW: boolean; 
        nsfwIntensity: NSFWIntensity; 
        writingStyle: WritingStyle; 
        nsfwFocus: NSFWFocus[]; 
        pronounRules: string;
        aiModel: string;
        memoryDepth: 'standard' | 'high'; // NEW
    },
    worldSettings: WorldSettings, 
    traits: CharacterTraits,
    gameConfig: { autoCodex: boolean, livingWorld: boolean },
    openingLength: number 
  ) => {
    
    // Construct default mechanics object based on autoCodex toggle
    const mechanics: GameMechanics = {
        reputation: false,
        survival: false,
        crafting: false,
        combat: false,
        time: false,
        currency: false,
        backpack: false,
        autoCodex: gameConfig.autoCodex,
        livingWorld: gameConfig.livingWorld
    };

    const newSession: GameSession = {
      heroName: basicInfo.name,
      customTitle: basicInfo.customTitle, // Save custom title
      gender: basicInfo.gender,
      genre: basicInfo.genre,
      worldSettings: worldSettings,
      characterTraits: traits,
      avatarUrl: basicInfo.avatarUrl,
      backgroundImageUrl: basicInfo.backgroundImageUrl,
      backgroundType: basicInfo.backgroundType || 'image',
      // Default styles
      fontFamily: basicInfo.fontFamily, // USE SELECTED FONT
      textColor: "#fffbeb", // parchment-100
      fontSize: "text-base", // DEFAULT FONT SIZE (MATCHES CURRENT UI)
      lineHeight: "leading-loose", // DEFAULT LINE HEIGHT (MATCHES CURRENT UI)
      createdAt: Date.now(),
      isNSFW: basicInfo.isNSFW,
      nsfwIntensity: basicInfo.nsfwIntensity,
      writingStyle: basicInfo.writingStyle,
      nsfwFocus: basicInfo.nsfwFocus,
      pronounRules: basicInfo.pronounRules,
      summary: "",
      // Default hidden config
      aiStyle: 'balanced',
      eventFrequency: 'medium',
      mechanics: mechanics,
      // DEFAULT MODEL IS PRO IF NOT SET
      aiModel: basicInfo.aiModel || 'gemini-3.1-pro-preview',
      memoryDepth: basicInfo.memoryDepth // USE MEMORY SETTING
    };
    
    try {
        const id = await db.sessions.add(newSession);
        const sessionWithId = { ...newSession, id: id as number };
        
        // Critical: Set state synchronously where possible or ensure order
        setSession(sessionWithId);
        setTurns([]); 
        
        // Only set step to game after session is set
        setStep('game');
        
        const traitsDesc = `Căn cơ: ${traits.spiritualRoot}, Thiên phú: ${traits.talents.join(', ')}. Tính cách: ${traits.personality}.` 
          
        // CRITICAL FIX: Explicitly append worldSettings.openingStory to the prompt
        let initialPrompt = `[HÀNH ĐỘNG]: Khởi tạo nhân vật giới tính ${basicInfo.gender} tên là ${basicInfo.name}. ${traitsDesc} Bắt đầu cốt truyện.
        
        [QUAN TRỌNG - BỐI CẢNH KHỞI ĐẦU]: Hãy bắt đầu câu chuyện ngay tại bối cảnh sau đây (bắt buộc): "${worldSettings.openingStory || 'Theo thiết lập thế giới'}"`;

        // Handle Opening Length Logic
        let requestedLengthMode: StoryLength = 'medium';
        if (openingLength === 400) {
            initialPrompt += `\n\n[YÊU CẦU ĐỘ DÀI]: Viết khoảng 400 từ.`;
            requestedLengthMode = 'medium';
        } else if (openingLength === 600) {
            initialPrompt += `\n\n[YÊU CẦU ĐỘ DÀI]: Viết khoảng 600 từ, chi tiết hơn mức trung bình.`;
            requestedLengthMode = 'long';
        } else if (openingLength >= 1000) {
            initialPrompt += `\n\n[CHẾ ĐỘ ĐẠI TỰ SỰ - OPENING]: Hãy viết chương mở đầu này thật DÀI và CHI TIẾT (tối thiểu 1500 chữ). Hãy đi sâu vào mô tả cảm giác, không khí, suy nghĩ nội tâm của nhân vật và bối cảnh xung quanh. Đừng vội vàng đẩy nhanh cốt truyện, hãy tận hưởng việc miêu tả thế giới.`;
            requestedLengthMode = 'epic';
        }
        
        // v5.0 SYSTEM LOGIC UPGRADE
        initialPrompt += `\n\n[HỆ THỐNG YÊU CẦU - KHỞI TẠO THẾ GIỚI LOGIC]: 
        1. XÁC ĐỊNH TÀI SẢN (stats.currency):
           - Tự xác định số tiền ban đầu dựa trên XUẤT THÂN nhân vật (Giàu/Nghèo/Bình thường) và bối cảnh.
           - [ECONOMY ENGINE]: Đây là tài sản gốc. Hãy tự động cộng/trừ số tiền này dựa trên hành động trong game.

        2. XỬ LÝ DỮ LIỆU NHÂN VẬT (ẨN TRONG JSON):
           - Hãy ngay lập tức phân tích và cập nhật thông tin CHI TIẾT về **Thiên Phú/Kỹ Năng** (${traits.talents.join(', ')}) của nhân vật vào mảng JSON \`newRegistry\`.
           - Phân loại chúng là 'SKILL' hoặc 'KNOWLEDGE'.
           - Mô tả công dụng, nguồn gốc, hoặc tiềm năng của chúng một cách chi tiết và "ngầu" trong JSON.
           - **TUYỆT ĐỐI KHÔNG** in danh sách kỹ năng, chỉ số, hay hồ sơ nhân vật ra phần văn bản (\`narrative\`). Phần \`narrative\` chỉ dành cho kể chuyện. Mọi dữ liệu hệ thống phải nằm trong JSON.`;

        // Init stats with 0 timestamp
        setCurrentStats({
             name: basicInfo.name,
             realm: "Khởi Nguyên",
             status: "Active",
             inventory: [],
             attributes: [],
             currency: "0",
             realTimestamp: 0,
             currentTime: "Đang khởi tạo dòng thời gian..."
        });

        // FIX: Pass explicit overrides to prevent stale state from previous sessions
        handleTurn(
            sessionWithId, 
            initialPrompt, 
            [], 
            requestedLengthMode,
            { currentTime: "Đang khởi tạo...", currency: "0" } 
        ); 
    } catch (e) {
        console.error("Failed to start game session", e);
        alert("Có lỗi xảy ra khi tạo thế giới. Vui lòng thử lại.");
        setStep('landing');
    }
  };

  // 1b. Restore Game Session (Load Game from JSON File)
  const restoreSession = async (savedSession: GameSession, savedTurns: Turn[], savedWiki?: RegistryEntry[], savedGallery?: GalleryImage[]) => {
    console.group("📂 Restoring Session from File");
    try {
        const newSessionId = await db.importSession(savedSession, savedTurns, savedWiki || [], savedGallery || []);
        const sessionWithId = { ...savedSession, id: newSessionId, createdAt: Date.now() };
        const turnsWithNewId = savedTurns.map(t => ({ ...t, id: undefined, sessionId: newSessionId }));
        setSession(sessionWithId);
        setTurns(turnsWithNewId);
        restoreDerivedState(turnsWithNewId);
        setStep('game');
    } catch (e) {
        console.error("Failed to restore session", e);
        alert("Lỗi khi nhập file save.");
    }
    console.groupEnd();
  };

  // 1c. Continue Existing Session (Load Game from DB)
  const continueSession = async (sessionId: number) => {
    setLoading(true);
    try {
      const savedSession = await db.sessions.get(sessionId);
      if (!savedSession) { alert("Không tìm thấy dữ liệu thiên mệnh này."); return; }
      await db.sessions.update(sessionId, { createdAt: Date.now() });
      savedSession.createdAt = Date.now();
      const savedTurns = await db.turns.where('sessionId').equals(sessionId).sortBy('turnIndex');
      setSession(savedSession);
      setTurns(savedTurns);
      restoreDerivedState(savedTurns);
      setStep('game');
    } catch (e) { console.error(e); alert("Lỗi khi hồi sinh thiên mệnh."); } finally { setLoading(false); }
  };

  // 1d. Use Session as Template
  const handleUseAsTemplate = (session: GameSession) => {
      const templateData = {
          basicInfo: { 
              name: session.heroName,
              customTitle: session.customTitle,
              gender: session.gender,
              genre: session.genre,
              isNSFW: session.isNSFW,
              nsfwIntensity: session.nsfwIntensity,
              writingStyle: session.writingStyle,
              nsfwFocus: session.nsfwFocus,
              pronounRules: session.pronounRules,
              aiModel: session.aiModel,
              backgroundImageUrl: session.backgroundImageUrl,
              backgroundType: session.backgroundType,
              fontFamily: session.fontFamily,
              memoryDepth: session.memoryDepth
          },
          worldSettings: session.worldSettings,
          characterTraits: session.characterTraits,
          gameConfig: { 
              autoCodex: session.mechanics?.autoCodex ?? true,
              livingWorld: session.mechanics?.livingWorld ?? true
          }
      };
      setPendingTemplate(templateData);
      setStep('settings');
  };

  const updateSessionField = async (field: keyof GameSession, value: any) => {
      if (!session) return;
      try {
          const updatedSession = { ...session, [field]: value };
          await db.sessions.update(session.id!, { [field]: value });
          setSession(updatedSession);
      } catch (e) {
          console.error("Failed to update session field", e);
      }
  };

  // Helper to restore stats from last turn
  const restoreDerivedState = (history: Turn[]) => {
    const lastModelTurn = [...history].reverse().find(t => t.role === 'model');
    if (lastModelTurn && lastModelTurn.rawResponseJSON) {
        try {
            const parsed = JSON.parse(lastModelTurn.rawResponseJSON);
            
            // --- CRITICAL FIX: SANITIZE DATA ON LOAD TO PREVENT CRASH ---
            let newStats: any = (parsed.stats && typeof parsed.stats === 'object') ? { ...parsed.stats } : {};
            
            // Ensure Arrays
            if (!Array.isArray(newStats.inventory)) newStats.inventory = [];
            if (!Array.isArray(newStats.attributes)) newStats.attributes = [];
            if (!newStats.name) newStats.name = "Unknown";
            
            setCurrentStats(newStats);
            setCurrentOptions(parsed.options);
        } catch(e) { console.error("Failed to parse last turn state", e); }
    } else {
      setCurrentStats(null);
      setCurrentOptions(null);
    }
  };

  const onDeleteCurrentSession = async () => {
    if (!session) return;
    if (window.confirm(`Bạn có chắc muốn xóa thiên mệnh "${session.heroName}"? Dữ liệu sẽ mất vĩnh viễn.`)) {
        try {
          await (db as any).transaction('rw', db.sessions, db.turns, db.encyclopedia, async () => {
             await db.sessions.delete(session.id!);
             await db.turns.where('sessionId').equals(session.id!).delete();
             await db.encyclopedia.where('sessionId').equals(session.id!).delete();
          });
          setSession(null);
          setTurns([]);
          setStep('landing');
        } catch (e) {
          console.error("Failed to delete session", e);
          alert("Lỗi khi xóa dữ liệu.");
        }
    }
  };

  // Manual Save (No File Download)
  const handleManualSave = async () => {
      if (!session) return;
      const now = Date.now();
      await db.sessions.update(session.id!, { createdAt: now });
      setSession(prev => prev ? ({ ...prev, createdAt: now }) : null);
  };

  // Export Save File (Download)
  const handleExportSave = async () => {
    if (!session) return;
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
    } catch (e) {
        console.error("Export failed", e);
        alert("Lỗi khi xuất file save.");
    }
  };

  const handleTurn = async (
    currentSession: GameSession, 
    userPrompt: string, 
    history: Turn[],
    lengthMode: StoryLength,
    overrideStats?: { currentTime?: string, currency?: string } // NEW PARAM to prevent stale state
  ) => {
    setLoading(true);

    try {
      const turnIndex = history.length;

      // 1. Add User Turn to State (Optimistic UI) & DB
      const userTurn: Turn = {
        sessionId: currentSession.id!,
        turnIndex: turnIndex,
        role: 'user',
        userPrompt: userPrompt
      };
      
      // Save User Turn
      await db.turns.add(userTurn);
      
      // Update UI state with user message
      const updatedHistory = [...history, userTurn];
      setTurns(updatedHistory);

      // Resolve Base State (Override > Current > Default)
      // This fixes the bug where Time/Money is carried over from previous session state in React
      const baseTime = overrideStats?.currentTime ?? currentStats?.currentTime ?? "Ngày 1 - 08:00 - Sáng";
      const baseCurrency = overrideStats?.currency ?? currentStats?.currency ?? "0";

      // --- STEP 1: CHRONOS (CALCULATE TIME FIRST) ---
      let timePassed = 0;
      let calculatedTime = baseTime;
      
      // TỐI ƯU HÓA: Bỏ qua Chronos ở Turn đầu tiên (Khởi tạo) để tránh gọi API thừa thãi gây chậm/lỗi 429
      if (history.length > 0) {
          try {
              const chronosResult = await geminiService.calculateTime(
                  calculatedTime,
                  userPrompt,
                  currentSession.genre,
                  currentSession.worldSettings.worldContext
              );
              timePassed = chronosResult.timePassed;
              calculatedTime = chronosResult.currentTime;
          } catch (chronoErr) {
              console.error("Chronos failed, falling back to old time", chronoErr);
          }
      } else {
          calculatedTime = "Ngày 1 - 08:00 - Sáng"; // Mặc định khi mới tạo thế giới
      }

      // --- RAG: LOCAL EMBEDDING & RETRIEVAL (ONLY FROM TURN 2) ---
      let ragContextString = "";
      if (turnIndex > 0) {
          let userPromptEmbedding: number[] = [];
          try {
              userPromptEmbedding = await geminiService.embedText(userPrompt);
          } catch (err) {
              console.warn("Failed to embed user prompt", err);
          }

          if (userPromptEmbedding.length > 0) {
              const relevantTurns = await findRelevantContext(currentSession.id!, userPromptEmbedding, turnIndex, 3, 0.5);
              const relevantWiki = await findRelevantWiki(currentSession.id!, userPromptEmbedding, userPrompt, 3, 0.5);

              if (relevantTurns.length > 0 || relevantWiki.length > 0) {
                  ragContextString = "\n\n[HỆ THỐNG TRÍ NHỚ (RAG CONTEXT)]:\n";
                  if (relevantWiki.length > 0) {
                      ragContextString += "- THÔNG TIN WIKI LIÊN QUAN:\n" + relevantWiki.map(w => `  + ${w.name} (${w.type}): ${w.description}`).join("\n") + "\n";
                  }
                  if (relevantTurns.length > 0) {
                      ragContextString += "- KÝ ỨC CŨ LIÊN QUAN:\n" + relevantTurns.map(t => `  + Turn ${t.turn.turnIndex}: ${t.turn.narrative?.substring(0, 200)}...`).join("\n") + "\n";
                  }
                  ragContextString += "(Sử dụng các thông tin trên nếu phù hợp với ngữ cảnh hiện tại).";
              }
          }
      }

      // --- ACTIVE MEMORY: EVENT SCHEDULER TRIGGER ---
      // Get previous realTimestamp (default to 0 if new)
      const previousTimestamp = currentStats?.realTimestamp ?? 0;
      // Calculate new total minutes
      const newTimestamp = previousTimestamp + timePassed;

      let eventTriggerString = "";
      // TỐI ƯU HÓA: Bỏ qua kiểm tra sự kiện ở Turn đầu tiên
      if (history.length > 0) {
          try {
              eventTriggerString = await eventService.checkAndGetTriggerPrompt(currentSession.id!, newTimestamp);
          } catch (err) {
              console.warn("Failed to check events", err);
          }
      }

      // Inject Time Command, RAG Context, and Event Trigger into User Prompt for Storyteller
      // If history is empty (First Turn), we skip this because the Initial Prompt already has the instruction.
      let promptWithTime = userPrompt;
      if (history.length > 0) {
           promptWithTime = `${userPrompt}\n\n[HỆ THỐNG THỜI GIAN]: Thời gian hiện tại là "${calculatedTime}". (Đã trôi qua ${timePassed} phút). Hãy cập nhật vào stats.currentTime.${ragContextString}${eventTriggerString}`;
      } else {
           promptWithTime = `${userPrompt}\n\n[HỆ THỐNG THỜI GIAN]: Thời gian khởi đầu là "${calculatedTime}". Hãy cập nhật vào stats.currentTime. TUYỆT ĐỐI KHÔNG viết thời gian chính xác này vào phần 'narrative', chỉ miêu tả thời gian một cách văn học (ví dụ: "Trời vừa sáng...").${ragContextString}${eventTriggerString}`;
      }

      // --- STEP 2: STORYTELLER AI (Writes narrative + Money + Inventory) ---
      const { parsed, raw, thoughtSignature } = await geminiService.generateTurn(
        currentSession.id!,
        currentSession.aiModel, 
        currentSession.genre,
        currentSession.heroName,
        currentSession.gender,
        currentSession.worldSettings,
        promptWithTime, // Use modified prompt
        history,
        currentSession.characterTraits,
        lengthMode,
        currentSession.isNSFW, 
        currentSession.nsfwIntensity,
        currentSession.writingStyle,
        currentSession.nsfwFocus,
        currentSession.summary, 
        currentSession.pronounRules, 
        currentSession.aiStyle,
        currentSession.eventFrequency,
        currentSession.mechanics,
        currentSession.memoryDepth,
        undefined,
        baseCurrency, // Pass the clean currency
        calculatedTime // Pass the clean time
      );

      // --- LOGIC: TIME CALCULATION SYNC ---
      // Force update stats with computed values to be safe
      parsed.stats.realTimestamp = newTimestamp;
      parsed.stats.currentTime = calculatedTime;
      parsed.timePassed = timePassed;
      
      // Persist Location if AI didn't return it
      const currentLocationName = parsed.stats.currentLocation || parsed.stats.mapData?.locationName || currentStats?.currentLocation || "Không rõ";
      if (!parsed.stats.currentLocation) parsed.stats.currentLocation = currentLocationName;

      // Re-serialize for DB storage (now including the computed time)
      const finalRawJSON = JSON.stringify(parsed);

      // Create Model Turn (Tạm thời để embedding rỗng để UI cập nhật ngay lập tức)
      const modelTurn: Turn = {
        sessionId: currentSession.id!,
        turnIndex: turnIndex + 1,
        role: 'model',
        narrative: parsed.narrative,
        rawResponseJSON: finalRawJSON, 
        embedding: [], // Sẽ cập nhật ngầm sau
        thoughtSignature: thoughtSignature
      };

      // Save Model Turn
      const newTurnId = await db.turns.add(modelTurn);

      // Update UI NGAY LẬP TỨC
      const finalHistory = [...updatedHistory, modelTurn];
      setTurns(finalHistory);
      
      // Update Current Stats State
      setCurrentStats(prev => {
          let newStats: any = (parsed.stats && typeof parsed.stats === 'object') ? { ...parsed.stats } : {};
          
          // Fallback logic for stability
          if ((!Array.isArray(newStats.inventory) || newStats.inventory.length === 0) && prev?.inventory && prev.inventory.length > 0) {
              newStats.inventory = prev.inventory;
          }
          if ((!Array.isArray(newStats.attributes) || newStats.attributes.length === 0) && prev?.attributes && prev.attributes.length > 0) {
              newStats.attributes = prev.attributes;
          }
          if (!newStats.mapData && prev?.mapData) newStats.mapData = prev.mapData;
          if (!newStats.visitedLocations && prev?.visitedLocations) newStats.visitedLocations = prev.visitedLocations;
          
          return newStats;
      });
      
      setCurrentOptions(parsed.options);

      // CHẠY NGẦM: Tạo Embedding cho lượt này (Không block UI)
      geminiService.embedText(parsed.narrative).then(async (emb) => {
          if (emb && emb.length > 0) {
              await db.turns.update(newTurnId, { embedding: emb });
          }
      }).catch(embErr => console.warn("Lỗi chạy ngầm embedding:", embErr));

      // --- STEP 3: ARCHIVIST (TẠO WIKI) - BACKGROUND PROCESS (ONLY FROM TURN 2) ---
      if (currentSession.mechanics?.autoCodex && turnIndex > 0) {
          // DELAY 3 GIÂY TRƯỚC KHI CHẠY NGẦM ĐỂ TRÁNH SPAM API CÙNG LÚC
          setTimeout(() => {
              // 1. Chạy ngầm tạo Wiki
              geminiService.runGameSystem(
                  parsed.narrative,
                  currentSession.worldSettings
              ).then(async (systemResult) => {
                   if (systemResult.newRegistry && systemResult.newRegistry.length > 0) {
                      const wikiData = systemResult.newRegistry;
                      const validRegistry = wikiData.filter((entry: any) => 
                          entry && typeof entry.name === 'string' && entry.name.trim().length > 0 && entry.name.toLowerCase() !== 'unknown'
                      );
    
                      if (validRegistry.length > 0) {
                          const entriesToUpsert = await Promise.all(validRegistry.map(async (entry: any) => {
                              const normalizedName = entry.name.trim();
                              let vector: number[] = [];
                              try { 
                                  const textToEmbed = `${normalizedName} (${entry.type}): ${entry.description}`;
                                  vector = await geminiService.embedText(textToEmbed); 
                              } catch (err) { 
                                  console.warn(`Failed to embed wiki entry: ${entry.name}`, err); 
                              }
    
                              return {
                                  ...entry,
                                  name: normalizedName,
                                  type: entry.type || 'KNOWLEDGE',
                                  description: entry.description,
                                  sessionId: currentSession.id!,
                                  firstSeenTurn: turnIndex + 1,
                                  embedding: vector
                              } as RegistryEntry;
                          }));
                          
                          await db.upsertWikiEntries(currentSession.id!, entriesToUpsert, turnIndex + 1);
                          console.log("Wiki updated with", entriesToUpsert.length, "entries.");
                      }
                  }
              });
          }, 3000); // Đợi 3s sau khi Storyteller chạy xong

          // 2. Chạy ngầm trích xuất Sự kiện/Lịch hẹn (Active Memory)
          setTimeout(() => {
              eventService.extractAndSaveEvents(
                  currentSession.id!, 
                  `[HÀNH ĐỘNG CỦA TÔI]: ${userPrompt}\n[KẾT QUẢ]: ${parsed.narrative}`, 
                  newTimestamp
              ).catch(err => console.warn("Lỗi khi chạy ngầm Event Extractor", err));
          }, 6000); // Đợi 6s để tách biệt hoàn toàn với Archivist
      }

      // Check for Automatic Summarization (Keep existing)
      const turnCount = finalHistory.length;
      if (turnCount > 0 && turnCount % 10 === 0) {
          const recentTurns = finalHistory.slice(-10);
          const newSummary = await geminiService.summarizeStory(currentSession.summary || "", recentTurns);
          if (newSummary !== currentSession.summary) {
              const updatedSession = { ...currentSession, summary: newSummary };
              await db.sessions.update(currentSession.id!, { summary: newSummary });
              setSession(updatedSession);
          }
      }

    } catch (error) {
      console.error("Game Loop Error:", error);
      alert("Hệ thống gặp trục trặc (API Error). Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const onOptionClick = (action: string, lengthMode: StoryLength) => {
    if (session) {
      handleTurn(session, action, turns, lengthMode);
    }
  };

  const onRegenerate = async (index: number, newPrompt: string, lengthMode: StoryLength) => {
    if (!session) return;
    const keptTurns = turns.slice(0, index); 
    await db.turns.where('sessionId').equals(session.id!).and(t => t.turnIndex >= index).delete();
    setTurns(keptTurns);
    handleTurn(session, newPrompt, keptTurns, lengthMode);
  };

  const onUndo = async () => {
    if (!session || turns.length === 0) return;
    const newTurns = [...turns];
    let itemsToRemove = 0;
    if (newTurns.length > 0) {
        const last = newTurns[newTurns.length - 1];
        if (last.role === 'model') itemsToRemove = 2; else itemsToRemove = 1;
    }
    if (itemsToRemove === 0 || newTurns.length < itemsToRemove) return;
    const keptTurns = newTurns.slice(0, newTurns.length - itemsToRemove);
    await db.turns.where('sessionId').equals(session.id!).and(t => t.turnIndex >= keptTurns.length).delete();
    setTurns(keptTurns);
    restoreDerivedState(keptTurns);
  };

  // --- RENDER LOGIC WITH TRANSITION WRAPPER ---
  return (
    <div key={step} className="w-full min-h-screen page-enter-active">
        {step === 'landing' && (
          <LandingScreen 
            onNewGame={() => {
                setPendingTemplate(null); 
                setStep('settings');
            }}
            onLoadGame={restoreSession}
            onContinueSession={continueSession}
            onUseTemplate={handleUseAsTemplate} 
          />
        )}

        {step === 'settings' && (
          <SettingsScreen 
            onConfirm={startGame}
            onBack={() => {
                setPendingTemplate(null);
                setStep('landing');
            }}
            initialTemplate={pendingTemplate} 
          />
        )}

        {step === 'game' && session && (
          <ErrorBoundary onReset={onUndo}>
              <GameUI 
                session={session}
                turns={turns}
                currentStats={currentStats}
                currentOptions={currentOptions}
                loading={loading}
                onOptionClick={onOptionClick}
                onRegenerate={onRegenerate}
                onUndo={onUndo}
                avatarUrl={session.avatarUrl}
                genre={session.genre}
                onExit={() => {
                  setStep('landing');
                  setSession(null);
                }}
                onDelete={onDeleteCurrentSession}
                onExport={handleExportSave}
                onSave={handleManualSave} 
                onUpdateSession={updateSessionField}
              />
          </ErrorBoundary>
        )}
    </div>
  );
}

export default App;
