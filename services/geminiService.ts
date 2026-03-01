import { GoogleGenAI, Type, Schema, ThinkingLevel } from "@google/genai";
import { localEmbeddingService } from './embeddingService';
import { 
  GameGenre, 
  WorldSettings, 
  CharacterTraits, 
  StoryLength, 
  Turn, 
  AIStyle, 
  EventFrequency, 
  GameMechanics, 
  NSFWIntensity, 
  WritingStyle, 
  NSFWFocus, 
  AIResponseSchema,
  RegistryEntry
} from '../types';

const DEFAULT_MODEL = 'gemini-3.1-pro-preview';
const ARCHIVIST_MODEL = 'gemini-3-flash-preview';
const CHRONOS_MODEL = 'gemini-3-flash-preview'; // Model nhanh, logic tốt cho việc tính toán

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
];

class GeminiService {
  private ai: GoogleGenAI;
  private apiKeys: string[] = [];
  private currentKeyIndex: number = 0;

  constructor() {
    this.loadApiKeys();
    this.ai = new GoogleGenAI({ apiKey: this.getCurrentKey() });
  }

  private loadApiKeys() {
    try {
      const keysStr = localStorage.getItem('td_api_keys');
      if (keysStr) {
        const keys = JSON.parse(keysStr);
        if (Array.isArray(keys) && keys.length > 0) {
          this.apiKeys = keys;
          return;
        }
      }
    } catch (e) {
      console.error("Failed to load API keys", e);
    }
  this.apiKeys = import.meta.env.VITE_GEMINI_API_KEY ? [import.meta.env.VITE_GEMINI_API_KEY] : [];
  }

  private getCurrentKey(): string {
   if (this.apiKeys.length === 0) return import.meta.env.VITE_GEMINI_API_KEY || '';
    return this.apiKeys[this.currentKeyIndex];
  }

  private updateUsage(key: string, tokens: number) {
    if (!tokens || !key) return;
    try {
      const usageStr = localStorage.getItem('td_api_key_usage') || '{}';
      const usage = JSON.parse(usageStr);
      usage[key] = (usage[key] || 0) + tokens;
      localStorage.setItem('td_api_key_usage', JSON.stringify(usage));
    } catch (e) {}
  }

  private rotateKey() {
    if (this.apiKeys.length <= 1) return;
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    console.log(`[API Key Rotation] Switched to key index ${this.currentKeyIndex}`);
    const newKey = this.getCurrentKey();
    this.ai = new GoogleGenAI({ apiKey: newKey });
    localStorage.setItem('td_active_api_key', newKey);
  }

  private async generateContentWithRetry(params: any): Promise<any> {
    // Reload keys just in case user updated them in settings
    this.loadApiKeys();
    // Ensure current index is valid
    if (this.currentKeyIndex >= this.apiKeys.length) {
        this.currentKeyIndex = 0;
    }
    const currentKey = this.getCurrentKey();
    this.ai = new GoogleGenAI({ apiKey: currentKey });
    localStorage.setItem('td_active_api_key', currentKey);

    // Tăng số lần thử lại để cứu vãn khi bị Rate Limit
    const maxRetries = Math.max(3, this.apiKeys.length * 2);
    let attempts = 0;
    let lastError: any;

    while (attempts < maxRetries) {
      try {
        const response = await this.ai.models.generateContent(params);
        const tokens = response.usageMetadata?.totalTokenCount || 0;
        this.updateUsage(this.getCurrentKey(), tokens);
        return response;
      } catch (error: any) {
        attempts++;
        lastError = error;
        console.warn(`[Gemini API Error] Attempt ${attempts}/${maxRetries} failed:`, error);
        
        const errorMessage = error?.message?.toLowerCase() || '';
        const status = error?.status;
        
        // Check for rate limits, quota, or server errors
        const isRateLimit = status === 429 || errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('exhausted');
        const isRotatableError = isRateLimit || status === 403 || status === 503 || status === 500 || errorMessage.includes('overloaded');

        if (isRotatableError && attempts < maxRetries) {
          if (this.apiKeys.length > 1) {
             this.rotateKey();
          }
          
          // THÊM DELAY (EXPONENTIAL BACKOFF) ĐỂ TRÁNH SPAM SERVER
          let delay = Math.min(2000 * Math.pow(2, attempts - 1), 15000); // 2s, 4s, 8s, 15s...
          
          // Nếu chỉ có 1 Key mà bị 429, BẮT BUỘC phải đợi lâu hơn (15 giây) để API hồi lại
          if (isRateLimit && this.apiKeys.length <= 1) {
              delay = 15000; 
              console.log(`[Rate Limit] Chỉ có 1 Key. Đang đợi ${delay/1000}s để Google hồi Token...`);
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If it's not a rotatable error or we've exhausted retries, break and throw
        break;
      }
    }
    throw lastError;
  }

  // --- AI 0: CHRONOS (TIMEKEEPER) ---
  // Nhiệm vụ: Tính toán thời gian trôi qua dựa trên hành động
  async calculateTime(
    currentTime: string,
    userAction: string,
    genre: string,
    worldContext: string = ""
  ): Promise<{ timePassed: number, currentTime: string }> {
      const systemPrompt = `
      ROLE: Chronos (Time Logic Engine).
      GENRE: ${genre}
      CURRENT TIME: "${currentTime}"
      WORLD CONTEXT: "${worldContext}"
      LOGIC RULES:
      1. **TIME PROGRESSION (FORWARD ONLY)**: Time MUST ONLY increase. Never revert to a past time. Next Time = Current Time + Action Duration.
      2. **ACTION DURATION ANALYSIS**:
         - Talking/Thinking: Add 1-15 minutes (use random odd numbers like 3, 7, 12 minutes for realism).
         - Combat/Moving: Add hours and minutes (e.g., 2 hours 15 minutes).
         - Sleeping/Resting: Add 6-8 hours.
         - Cultivation/Travel: Add days, months, or years based on context.
         - Explicit Time Skip (e.g., "10 years later","time skip"): Update the Year directly.
      3. **CALCULATION**:
         - If nothing special happens, ONLY change the Hour/Minute. Keep Day/Month/Year the same.
         - Calculate calendar changes logically (e.g., if Hour > 24, increment Day and adjust Day of Week).
      4. **FORMAT REQUIREMENT**: You MUST output 'stats.currentTime' EXACTLY in this format:
         "[Thứ] - [Ngày]/[Tháng]/[Năm]/[Giờ] - [Buổi/Mùa]"
         Example: "Chủ Nhật - 15/08/1024/14:23 - Đêm Muộn Mùa Thu"
      5. **INITIALIZATION**: If starting a new game (Current Time is empty or initializing), generate a logical starting time based on the World Context.
      6. **SILENT EXECUTION (TIME): Time calculation must remain strictly in the background (JSON data). It is STRICTLY FORBIDDEN to explicitly mention the exact system time, date, or day in the narrative text. Do not write robotic phrases like "Today is Sunday, 15/08/1024" or "The clock shows 14:23". If you must describe time in the story, use natural, immersive literary descriptions (e.g., "The sun began to set," "Late into the night," "A few hours passed"h,"Pointer Watch",'Today-mm/mm/mm-mm/mm(Ex:Sunday - 14/01/2001 - 14/05)).
      INPUT ACTION: "${userAction}"
      
      OUTPUT JSON:
      {
        "timePassed": number (minutes),
        "currentTime": string (The new formatted time string)
      }
      `;

      const schema: Schema = {
          type: Type.OBJECT,
          properties: {
              timePassed: { type: Type.NUMBER },
              currentTime: { type: Type.STRING }
          },
          required: ["timePassed", "currentTime"]
      };

      try {
          const response = await this.generateContentWithRetry({
              model: CHRONOS_MODEL,
              contents: { role: 'user', parts: [{ text: "Calculate new time." }] },
              config: {
                  systemInstruction: systemPrompt,
                  responseMimeType: 'application/json',
                  responseSchema: schema,
                  temperature: 0.1 // Logic tuyệt đối
              }
          });
          const text = response.text || "{}";
          return JSON.parse(text);
      } catch (e) {
          console.error("Chronos Error:", e);
          return { timePassed: 0, currentTime: currentTime };
      }
  }

  // --- AI 1: THE STORYTELLER ---
  async generateTurn(
    sessionId: number,
    modelName: string,
    genre: GameGenre,
    heroName: string,
    gender: string,
    worldSettings: WorldSettings,
    userPrompt: string,
    history: Turn[],
    characterTraits: CharacterTraits,
    lengthMode: StoryLength,
    isNSFW: boolean,
    nsfwIntensity: NSFWIntensity,
    writingStyle: WritingStyle,
    nsfwFocus: NSFWFocus[],
    summary: string,
    pronounRules: string,
    aiStyle: AIStyle | undefined,
    eventFrequency: EventFrequency | undefined,
    mechanics: GameMechanics | undefined,
    memoryDepth: 'standard' | 'high' | undefined,
    attributeSchema?: string[], 
    currentCurrency?: string,
    // preCalculatedTime là thời gian đã được Chronos tính xong
    preCalculatedTime?: string 
  ): Promise<{ parsed: AIResponseSchema; raw: string; thoughtSignature?: string }> {
    
    let nsfwBlock = "";
    if (isNSFW && nsfwIntensity === 'extreme') {
        nsfwBlock = `
    ⚠️ TRẠNG THÁI 1: CHẾ ĐỘ CỐT TRUYỆN THUẦN TÚY (TUYỆT ĐỐI KHÔNG SẮC DỤC)
      - **QUY TẮC TỐI THƯỢNG**: Khi chưa có lệnh "làm tình/sex" từ người chơi, coi như chế độ NSFW đang TẮT. Hãy viết như một tác phẩm văn học chính thống, nghiêm túc và logic.
      - **CẤM TUYỆT ĐỐI CÁC HÀNH VI SAU**:
         + **KHÔNG GẠ GẪM**: NPC tuyệt đối không được chủ động mời gọi, không được liếc mắt đưa tình, không được có những cử chỉ "gợi dục" (như cắn môi, rên nhẹ, uốn éo) trong các tình huống giao tiếp/chiến đấu bình thường.
         + **KHÔNG ẨN Ý (NO INNUENDO)**: Cấm dùng các từ ngữ hai nghĩa, cấm miêu tả cơ thể theo hướng dâm dục (ví dụ: thay vì tả "bộ ngực căng tròn mời gọi", hãy tả "bộ giáp che chắn phần ngực" hoặc "dáng người uyển chuyển").
         + **KHÔNG ĐỘNG DỤC**: NPC không được phép có suy nghĩ dâm đãng hay cảm thấy "nứng" vô cớ. Họ là những con người có lý trí, có mưu mô và mục tiêu sống riêng, không phải là công cụ tình dục chờ đợi người chơi.
      - **TƯƠNG TÁC XÃ HỘI CHUẨN MỰC**:
         + Giữ đúng khoảng cách và địa vị. Một Nữ Hoàng, Thánh Nữ hay Sát Thủ phải giữ cái đầu lạnh, sự kiêu ngạo và tự trọng. Họ sẽ không dễ dãi sà vào lòng người chơi.
         + Tập trung mô tả: Âm mưu, Chiến đấu, Tu luyện, Phong cảnh, Cảm xúc (Giận dữ, Vui vẻ, Sợ hãi, Tham lam...) thay vì Dục vọng.
      - Tập trung hoàn toàn vào cốt truyện.(Không nói chuyện dâm dục ẩn ý).
      - Giữ đúng tính cách nhân vật.
      - **Xưng hô đúng Vai vế nhân vật theo được nhập trên thanh hành động của người chơi.

      ⚠️ TRẠNG THÁI 2: EXTREME EROTICA (CHỈ KHI CÓ CẢNH NÓNG-MIÊU TẢ CỰC CHI TIẾT)
      - **KÍCH HOẠT KHI**: Người chơi ra lệnh rõ ràng (ví dụ: "làm tình", "sờ", "hôn sâu", "cởi đồ", "chịch") hoặc tình huống cốt truyện dẫn đến sex một cách logic và tự nhiên.
      - **MỨC ĐỘ MIÊU TẢ: "SIÊU THỰC & GIẢI PHẪU HỌC" (ANATOMICAL REALISM)**:
         + **ZOOM CẬN CẢNH**: Miêu tả chi tiết từng bộ phận sinh dục: Môi lớn, môi bé, hột le (âm vật), cửa mình, nếp gấp tử cung, đầu khấc, bao quy đầu, từng sợi lông mu (rậm rạp/tỉa tót), lỗ nhị...
         + **GIÁC QUAN**: Độ ướt át của dâm thủy, độ nóng của thịt, tiếng lép nhép khi va chạm, mùi hương đặc trưng, sự co thắt của cơ vòng.
         **MIÊU TẢ GIÁC QUAN ĐA CHIỀU (MULTI-SENSORY)**:
         - **ÂM THANH (Audio)**: Đừng chỉ tả hình ảnh. Hãy tả tiếng "bạch bạch" khi va chạm thịt, tiếng nước nhầy nhụa "lép nhép", tiếng mút mát ướt át, tiếng thở dốc rên rỉ vỡ vụn.
         - **MÙI VỊ (Scent/Taste)**: Tả mùi hương cơ thể (hormone), mùi nồng nàn của tinh dịch/dâm thủy, vị mặn/ngọt.
         - **XÚC GIÁC (Touch)**: Tả độ nóng hổi, độ chật hẹp của vách thịt, độ trơn ướt, mạch đập bên trong, độ đàn hồi của da thịt.
         - **HÌNHẢNH CẬN CẢNH (Macro Zoom)**: Soi từng lỗ chân lông, mạch máu nổi lên, sự co thắt của cơ vòng, độ mở của tử cung/lỗ nhị.
         - **MIÊU TẢ CỰC CHI TIẾT VỀ TẤT CẢ MỌI THỨ NHƯ NGOẠI HÌNH, CƠ THỂ, LỒN ,...CHẬM RÃI, CHI TIẾT, KHÔNG TRÔI QUA NHANH.

      - **TỪ NGỮ TRẦN TRỤI (REAL TALK)**:
         - **CẤM TUYỆT ĐỐI** dùng từ ẩn dụ văn hoa (như "hang động", "thanh kiếm", "hoa huyệt","dương vật","cậu nhỏ","gậy thịt","tử cung",...).
         - **BẮT BUỘC** dùng từ thô tục chính xác, kích thích: Lồn(Luôn Dùng), Cặc(Luôn Dùng), Địt, Nứng, Bắn Tinh, Nước Lồn, Lỗ Đít, Vú,...
         
      === [GIAO THỨC GIỮ TÍNH CÁCH (STRICT CHARACTER INTEGRITY - ANTI OOC)] ===
      ⚠️ QUAN TRỌNG: Dục vọng KHÔNG ĐƯỢC làm thay đổi bản chất cốt lõi của nhân vật.
      
      1. **TÍNH NHẤT QUÁN TUYỆT ĐỐI**:
         - **Nữ Hoàng/Kiêu Ngạo (Tsundere/Haughty)**: Vẫn phải giữ cái tôi cao ngạo, ra lệnh hoặc tỏ thái độ "ban ơn" cho người chơi. Có thể rên rỉ nhưng không được quỵ lụy, cầu xin hèn mọn (trừ khi kịch bản là Mind Break).
         - **Thánh Nữ/Ngây Thơ (Shy/Innocent)**: Phải thể hiện sự xấu hổ, che mặt, cắn môi kìm nén, cơ thể căng cứng vì chưa quen. Tuyệt đối KHÔNG được chủ động dâm đãng hay nói lời thô tục ngay lập tức.
         - **Lạnh Lùng/Sát Thủ (Kuudere)**: Giữ khuôn mặt ít biểu cảm, tiếng rên kìm nén trong cổ họng, thở dốc nhưng ánh mắt vẫn sắc bén hoặc mơ màng một cách kiềm chế.
         - **Dâm Nữ/Succubus**: Mới được phép chủ động, khiêu khích và dùng từ ngữ dâm dục phóng túng.

      2. **LỜI THOẠI (DIALOGUE)**:
         - **CẤM**: Biến tất cả nhân vật thành "búp bê tình dục" chỉ biết hét "sướng quá", "đụ em đi", "bắn vào trong". Đây là văn mẫu rẻ tiền.
         - **YÊU CẦU**: Nhân vật phải nói chuyện đúng với văn phong thường ngày. 
           + Ví dụ (Kiêu ngạo): "Hừ... ngươi chỉ được cái... làm ta thấy... ưm... tạm được thôi..."
           + Ví dụ (Ngây thơ): "Đừng... chỗ đó... kỳ quá... ư..."

      3. **TÂM LÝ & PHẢN ỨNG**:
         - Miêu tả sự đấu tranh giữa lý trí và bản năng. 
         - Nếu nhân vật ghét người chơi, họ phải thể hiện sự nhục nhã, cắn răng chịu đựng hoặc phản kháng yếu ớt, chứ không được tận hưởng ngay lập tức. 
      === [QUY TẮC BẤT DI BẤT DỊCH] ===
      1. **NO VIOLENCE / NON-CON (KHÔNG BẠO LỰC)**: Tuyệt đối không có cưỡng bức (Rape), không bạo dâm đẫm máu (Gore), không đánh đập tàn nhẫn. Mọi quan hệ phải dựa trên sự đồng thuận hoặc tình huống lãng mạn/quyến rũ.
      2. **STRICT CHARACTER (NO OOC)**: 
         - **QUAN TRỌNG**: Giữ đúng tính cách nhân vật ngay cả khi đang làm tình. 
         - Một thánh nữ băng thanh ngọc khiết sẽ e thẹn, xấu hổ, không chủ động.
         - Một nữ hoàng kiêu ngạo sẽ ra lệnh, giữ cái tôi cao ngạo.
         - Mọi nhân vật đều giữ được lý trí khi địt nhau,không trợn ngược mắt,không nói lời dâm dục ,không biến thành Khát Tình Dục hay Con cái chờ địt,...Không Ahegao,mất kiểm soát ,..
         - Đừng biến nhân vật thành "búp bê tình dục" mất não chỉ biết rên rỉ,cầu xin thêm địt.Mọi nhân vật đều giữ được lý trí khi địt nhau,không trợn ngược mắt,không nói lời dâm dục ,không biến thành Khát Tình Dục hay Con cái chờ địt,...Không Ahegao,mất kiểm soát ,..
         - ** Xưng hô phải đúng theo Player xưng hô ở thanh hành động. Ví dụ,trên thanh hành động Player xưng Cậu-Tớ thì ở dưới ,cả hai nhân vật(có thể nhiều hơn) phải xưng hô đúng theo như vây. Tương tự với các xưng hô khác như chị-em,mẹ-con,... Cấm xưng Mày-Tao.
      3. **ANTI-PREMATURE**: Không cho nhân vật ra (xuất tinh/lên đỉnh) quá sớm. Hãy kéo dài màn dạo đầu và quá trình giao hợp đến khi Player nhập hành động "Ra","bắn",..thì mới được xuất tinh. Miêu tả chi tiết diễn biến tâm lý.
      - FOCUS: ${nsfwFocus.join(', ') || "Action, Sensation"}.
      `;
    } else if (isNSFW) {
        nsfwBlock = "NSFW: SOFT/ROMANTIC. Focus on emotion and sensual descriptions.";
    } else {
        nsfwBlock = "NSFW MODE: OFF. Maintain strict PG-13 content. Focus on plot/emotion.";
    }

    // System Instruction
    let systemInstruction = `
      ROLE: Storyteller & Game Master (Người Kể Chuyện & Quản Lý Hệ Thống).
      CTX: ${genre} | Hero: ${heroName} (${gender}) | World: ${worldSettings.worldContext}
      ${worldSettings.referenceContext ? `LORE: ${worldSettings.referenceContext.substring(0, 2000)}...` : ''}
      
      DATA INPUT:
      - PRE-CALCULATED TIME: "${preCalculatedTime || 'Unknown'}"
      - CURRENT WALLET: "${currentCurrency || '0'}"
      - SUMMARY OF PAST EVENTS: "${summary || 'Chưa có tóm tắt.'}"

      NHIỆM VỤ:
      1. Viết tiếp diễn biến câu chuyện (Narrative).
      2. Cập nhật Thời Gian (Dùng giá trị được cung cấp).
      3. Tính toán và cập nhật Tiền bạc (Money).
      4. Quản lý Hành Trang (Inventory) và Chỉ Số (Stats).
      
      === [TIME UPDATE PROTOCOL (PASSIVE & SILENT)] ===
      1. **SOURCE OF TRUTH**: Time calculation is handled by an EXTERNAL AI (Chronos).
      2. **INSTRUCTION**: You will receive a specific command in the User Prompt (e.g., "[HỆ THỐNG THỜI GIAN]...").
      3. **ACTION**: You MUST update 'stats.currentTime' EXACTLY as the system requests in that command.

      === MODULE 2: TREASURER (ECONOMY & CURRENCY ENGINE) ===
      1. **ANCHORING (SOURCE OF TRUTH)**: The 'CURRENT WALLET' value provided above is the absolute baseline. You MUST use this exact value as the starting point for any calculations in this turn.
      2. **INITIALIZATION (TURN 1 ONLY)**: 
          - IF 'CURRENT WALLET' is "0" AND this is the very first turn: You MUST generate a logical starting amount based on the character's background (Rich/Poor/Average) and the World Context.
         - The currency unit MUST match the world setting.
         - CRITICAL: Even on Turn 1, DO NOT mention this exact starting amount in the 'narrative'. Keep it strictly in the 'stats.currency' JSON field. Describe their wealth naturally (e.g., "You have a few coins left" instead of "You have 50 Gold").
      3. **TRANSACTION LOGIC (SILENT CALCULATION)**:
         - **INCOME**: If the narrative includes gaining money (loot, reward, selling, gift), ADD the amount to the current balance.
         - **EXPENSE**: If the narrative includes spending money (buying, bribing, services, losing), SUBTRACT the amount from the current balance.
         - **NO CHANGE**: If no financial transaction occurs in the narrative, output the EXACT SAME string as 'CURRENT WALLET'.
         - **SILENT EXECUTION**: Perform all math silently. FORBIDDEN to mention checking balances, doing math, or breaking the fourth wall in the 'narrative' text.
      4. **ANTI-HALLUCINATION & CONSISTENCY**:
         - NEVER reset the balance to 0 unless the character explicitly goes bankrupt or is robbed of everything.
         - NEVER change or translate the currency unit (e.g., do not change "Vàng" to "Gold" or "Xu"). The unit MUST remain strictly constant throughout the session.
         - NEVER invent transactions or amounts that did not explicitly happen in the narrative.
      5. **STRICT OUTPUT FORMAT**: 
         - You MUST return the final calculated value in the 'stats.currency' JSON field.
         - **Format Rule**: [Number] [Currency Unit] (e.g., "1500 Linh Thạch", "50000 VND").
         - If there are multiple tiers of currency, format as: [Number] [Unit 1], [Number] [Unit 2] (e.g., "5 Vàng, 2 Bạc").
         - Do NOT include extra words, symbols, or explanations in the 'stats.currency' field.
      6. **SILENT EXECUTION (ECONOMY)**: Financial calculations must remain strictly in the background (JSON data). It is STRICTLY FORBIDDEN to explicitly mention exact account balances, checking wallets, or doing math in the narrative text. Do not write robotic phrases like "Your balance is now 500 Gold" or "You check your wallet and see 10.000 VND". If you must describe money in the story, use natural, immersive literary descriptions (e.g., "He handed over a heavy pouch of coins," "She paid the merchant," "His pockets felt lighter",Wallet has ... Yen).
      7. **SILENT EXECUTION (TRAITS/TALENTS)**: CRITICAL RULE FOR ALL TURNS (INCLUDING TURN 1 INITIALIZATION): It is STRICTLY FORBIDDEN to explicitly list, name, or directly mention the character's "Traits" or "Talents" in the 'narrative' text. You MUST use the "Show, Don't Tell" principle. Demonstrate their traits naturally through actions, reflexes, or thoughts. For example: Instead of writing "Thanks to your 'Super Strength' trait...", write "Your muscles bulged as you effortlessly lifted the heavy boulder...".
      PHONG CÁCH VIẾT: ${writingStyle}
      ${nsfwBlock}
      ĐỘ DÀI: ${lengthMode === 'epic' ? 'Cực Dài (Tối thiểu 1200 chữ, miêu tả chi tiết mọi thứ)' : lengthMode}.

      OUTPUT JSON STRUCTURE:⚠️ **CRITICAL NARRATIVE RULE**: The 'narrative' field is for immersive storytelling ONLY. You are STRICTLY PROHIBITED from mentioning the exact numbers from 'PRE-CALCULATED TIME' or 'CURRENT WALLET' inside the 'narrative' text. Keep all exact numbers hidden inside the 'stats' object.
      {
        "thoughtProcess": "Suy nghĩ logic về hướng đi cốt truyện, sử dụng thời gian được cung cấp...",
        "narrative": "Nội dung câu chuyện...",
        "timePassed": 0, // Giá trị này chỉ để tham khảo, lấy từ input
        "stats": {
            "inventory": ["Item A", "Item B"], 
            "attributes": [{"key": "Sức khỏe", "value": "Bình thường"}],
            "status": "Trạng thái nhân vật",
            "name": "${heroName}",
            "realm": "Cảnh giới",
            "currency": "String (Updated Money)",
            "currentTime": "String (The Provided Time)"
        },
        "options": [
            {"label": "Hành động 1", "action": "..."},
            {"label": "Hành động 2", "action": "..."}
        ]
      }
    `;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        thoughtProcess: { type: Type.STRING },
        narrative: { type: Type.STRING },
        timePassed: { type: Type.NUMBER, description: "Minutes passed in this turn" },
        stats: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            realm: { type: Type.STRING },
            status: { type: Type.STRING },
            inventory: { type: Type.ARRAY, items: { type: Type.STRING } },
            attributes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { key: { type: Type.STRING }, value: { type: Type.STRING } } } },
            currency: { type: Type.STRING, description: "Calculated currency string" },
            currentTime: { type: Type.STRING, description: "Calculated context time string" },
            currentLocation: { type: Type.STRING, description: "Detailed location name" },
            mapData: { 
                type: Type.OBJECT,
                properties: {
                    locationName: { type: Type.STRING },
                    currentFloor: { type: Type.STRING },
                    layout: { 
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                floorName: { type: Type.STRING },
                                rooms: { type: Type.ARRAY, items: { type: Type.STRING } }
                            }
                        }
                    }
                }
            }
          },
          required: ["currency"]
        },
        options: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              action: { type: Type.STRING }
            }
          }
        }
      },
      required: ["narrative", "stats", "timePassed"]
    };

    try {
      // GIẢM LỊCH SỬ XUỐNG ĐỂ TIẾT KIỆM TOKEN (Tránh lỗi 429 và đứt gãy JSON)
      // Thay vì gửi 20 lượt (rất dễ vượt 32k token), chỉ gửi 6 lượt gần nhất
      const recentHistory = history.slice(-6);

      const contents = recentHistory.map(t => ({
        role: t.role,
        parts: [{ text: t.role === 'user' ? (t.userPrompt || '') : (t.narrative || '') }]
      }));

      contents.push({
        role: 'user',
        parts: [{ text: userPrompt }]
      });

      // Sử dụng đúng Model người chơi đã chọn, KHÔNG tự ý đổi sang Flash ở lượt 1
      const selectedModel = modelName || DEFAULT_MODEL;

      // Chỉ bật Thinking Mode nếu Model hỗ trợ (dòng Pro)
      const isProModel = selectedModel.includes('pro');

      const response = await this.generateContentWithRetry({
        model: selectedModel,
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.85, 
          safetySettings: SAFETY_SETTINGS as any,
          maxOutputTokens: 8192, 
          stopSequences: ["(End). (End).", "(End).(End)."],
          ...(isProModel ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } } : {})
        }
      });

      const text = response.text || "{}";
      const parsed = JSON.parse(text);
      return { parsed, raw: text, thoughtSignature: "Storyteller Mode" };
    } catch (e) {
      console.error("Generate Turn Error:", e);
      return { 
        parsed: {
        isGameOver: false,
        narrative: "",
        timePassed: 0,
        stats: {
            name: heroName,
            realm: "Unknown",
            status: "Error",
            inventory: [],
            attributes: [],
            currency: currentCurrency || ""
        }
}, 
        raw: "{}", 
        thoughtSignature: "Error" 
      };
    }
  }

  // --- AI 2: ARCHIVIST ONLY (TẠO WIKI) ---
  // Nhiệm vụ: Đọc nội dung truyện -> Tạo Wiki.
  async runGameSystem(
    narrative: string,
    worldSettings: WorldSettings
  ): Promise<{ newRegistry: any[] }> {
    
    // STATIC SYSTEM INSTRUCTION (RULES ONLY)
    const systemPrompt = `
      ROLE: Archivist (Thủ Thư).
      CONTEXT: ${worldSettings.worldContext}

      NHIỆM VỤ CỦA BẠN:
      === MODULE 3: ARCHIVIST (TẠO WIKI - QUAN TRỌNG) ===
      - Trích xuất thông tin về NPC, Địa điểm, Vật phẩm, Kỹ năng MỚI xuất hiện hoặc được nhắc đến.
      - **RULES (BẮT BUỘC)**:
          RULES:
           1. IGNORE the main hero. Focus on NPCs, Items, Places.
           2. DETAIL LEVEL: Write full biography, visual details, minimum 250 words.
           3. NSFW ARCHIVE (Chỉ khi bật EXTREME MODE): You MUST record explicit physical details including Breasts, Pussy, Ass, Virginity, Anus. Descriptions must be detailed (>250 words,chỉ có tác dụng khi bật NSFW Cực Hạn)
           4. Wiki phải lưu mọi mục bằng Tiếng Việt.
           5. ABSENT/MENTIONED ENTITIES: You MUST create full Wiki entries for characters, places, or items that are merely MENTIONED, RUMORED, or appear in MEMORIES/BACKSTORY, even if they are not physically present in the scene. 
              - Extract every detail available (reputation, relationships, past deeds).
             - Infer/Extrapolate appearance and personality based on the context to ensure the description is DETAILED (>200 words).
             - DO NOT wait for them to appear. Archive them NOW.
           6. Lưu cả tên nhân vật chính(Player).  

      === [PROTOCOL: NAME INTEGRITY & COMPLETENESS (BẮT BUỘC LƯU TÊN ĐẦY ĐỦ)] ===
      ⚠️ **CRITICAL RULE**: NEVER TRUNCATE NAMES.
      1. **FULL NAME ENFORCEMENT**:
         - You MUST save the entity with their **FULL NAME** (First Name + Last Name).
         - **STRICTLY PROHIBITED**: Saving "Emma" when the character is "Emma Watson". Saving "Dasha" when it is "Dasha Taran".
         - **LOGIC**: If the text says "Emma" looked at him, but the context implies it is "Emma Watson", the Entry Name MUST be "Emma Watson".
      2. **CHECK BEFORE SAVE**:
         - Ask yourself: "Is 'Dasha' the full name?" -> No -> Change to "Dasha Taran".
         - Ask yourself: "Is 'Luffy' the full name?" -> No -> Change to "Monkey D. Luffy".
      
      === [ENTITY RESOLUTION & DEDUPLICATION] ===
      1. **FULL NAME PRIORITY (Ưu Tiên Tên Đầy Đủ)**: 
         - ALWAYS create/update entries using the character's LONGEST, MOST COMPLETE NAME.
         - Không lưu lặp ,ví dụ : Orihime Inoue thì không lưu thêm Inoue Orihime nữa.Không lưu chỉ nguyên Inoue hay Orihime mà phải lưu đầy đủ Orihime Inoue.
      2. **ALIAS MERGING (Gộp Biệt Danh)**: 
         - Treat surnames (Họ), first names (Tên), or nicknames as ALIASES of the main entity. 
         - Consolidate all details into the MAIN ENTRY (Full Name).

      OUTPUT JSON FORMAT:
      {
        "newRegistry": [
            {
                "name": "Tên Đầy Đủ",
                "type": "NPC/LOCATION/ITEM/FACTION/SKILL",
                "description": "Mô tả chi tiết >100 chữ...",
                "status": "Trạng thái hiện tại",
                "appearance": "Ngoại hình.",
                "personality": "Tính cách...",
                "secrets": "Bí mật (nếu có)..."
            }
        ]
      }
    `;

    // DATA TO PROCESS (PASS AS USER MESSAGE)
    const userMessage = `
    [INPUT STORY NARRATIVE START]
    ${narrative}
    [INPUT STORY NARRATIVE END]
    
    TASK: Based on the narrative above, extract and create detailed Wiki entries following all rules.
    `;

    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            newRegistry: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        type: { type: Type.STRING, enum: ['NPC', 'LOCATION', 'FACTION', 'ITEM', 'KNOWLEDGE', 'SKILL'] },
                        description: { type: Type.STRING },
                        status: { type: Type.STRING },
                        appearance: { type: Type.STRING },
                        personality: { type: Type.STRING },
                        secrets: { type: Type.STRING },
                        powerLevel: { type: Type.STRING },
                        affiliation: { type: Type.STRING }
                    },
                    required: ["name", "type", "description"]
                }
            }
        },
        required: ["newRegistry"]
    };

    try {
        const response = await this.generateContentWithRetry({
            model: ARCHIVIST_MODEL,
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseSchema: schema,
                temperature: 0.3, // Lower temp for extraction accuracy
                safetySettings: SAFETY_SETTINGS as any
            }
        });

        const text = response.text || "{}";
        const parsed = JSON.parse(text);
        
        return {
            newRegistry: Array.isArray(parsed.newRegistry) ? parsed.newRegistry : []
        };
    } catch (e) {
        console.error("Archivist Error:", e);
        return { newRegistry: [] };
    }
  }

  async generateWorldAssist(genre: GameGenre, prompt: string, info: any): Promise<WorldSettings> {
    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            worldContext: { type: Type.STRING },
            plotDirection: { type: Type.STRING },
            majorFactions: { type: Type.STRING },
            keyNpcs: { type: Type.STRING },
            openingStory: { type: Type.STRING },
            crossoverWorlds: { type: Type.STRING }
        },
        required: ["worldContext", "plotDirection", "majorFactions", "keyNpcs"]
    };

    const response = await this.generateContentWithRetry({
        model: DEFAULT_MODEL,
        contents: `Genre: ${genre}. Prompt: ${prompt}. Generate JSON settings.`,
        config: { 
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.8
        }
    });
    const cleanText = (response.text || "{}").replace(/```json\n?|```/g, '').trim();
    return JSON.parse(cleanText);
  }

  async generateSingleWorldField(genre: GameGenre, label: string, context: string, heroInfo: any): Promise<string> {
    const response = await this.generateContentWithRetry({
        model: DEFAULT_MODEL,
        contents: `Genre: ${genre}. Field: ${label}. Context: ${context}. Short generation.`,
    });
    return response.text || "";
  }

  async embedText(text: string): Promise<number[]> {
    if (!text || !text.trim()) return [];
    try {
      // Use Local Embedding instead of Google API to save limits
      return await localEmbeddingService.embedTextLocal(text);
    } catch (e) {
      console.warn("Embedding failed", e);
      return [];
    }
  }

  async summarizeStory(currentSummary: string, recentTurns: Turn[]): Promise<string> {
      const text = recentTurns.map(t => t.narrative).join("\n");
      const prompt = currentSummary 
          ? `Tóm tắt cốt truyện cũ:\n${currentSummary}\n\nDiễn biến mới:\n${text}\n\nHãy viết một bản tóm tắt mới bao gồm cả cốt truyện cũ và diễn biến mới một cách súc tích.`
          : `Hãy tóm tắt diễn biến sau một cách súc tích:\n${text}`;
          
      const response = await this.generateContentWithRetry({
          model: ARCHIVIST_MODEL, // Use Lite for summary
          contents: prompt,
          config: {
              temperature: 0.4
          }
      });
      return response.text || currentSummary;
  }
  
  async analyzeItem(itemName: string, context: string, genre: string): Promise<{description: string, type: string, rank: string, status?: string}> {
      const response = await this.generateContentWithRetry({
          model: DEFAULT_MODEL,
          contents: `Analyze: ${itemName}. JSON Output.`,
          config: { responseMimeType: 'application/json' }
      });
      return JSON.parse(response.text || "{}");
  }

  async generateWorldFromTitle(title: string, genre: string, heroInfo: any): Promise<WorldSettings> {
      const schema: Schema = {
          type: Type.OBJECT,
          properties: {
              worldContext: { type: Type.STRING },
              plotDirection: { type: Type.STRING },
              majorFactions: { type: Type.STRING },
              keyNpcs: { type: Type.STRING },
              openingStory: { type: Type.STRING },
              crossoverWorlds: { type: Type.STRING }
          },
          required: ["worldContext", "plotDirection", "majorFactions", "keyNpcs"]
      };

      const response = await this.generateContentWithRetry({
          model: DEFAULT_MODEL,
          contents: `Generate world from title: ${title}. JSON.`,
          config: { 
              responseMimeType: 'application/json',
              responseSchema: schema,
              temperature: 0.8
          }
      });
      return JSON.parse((response.text || "{}").replace(/```json\n?|```/g, '').trim());
  }
  
  // NEW: Manual Auto-Fill Wiki Entry
  async generateWikiEntry(
      name: string, 
      type: string, 
      context: string,
      isNSFW: boolean | undefined,
      nsfwIntensity: NSFWIntensity | undefined
  ): Promise<{description: string, appearance?: string, personality?: string, secrets?: string, status?: string}> {
      
      const detailInstruction = (isNSFW && nsfwIntensity === 'extreme') 
          ? "Yêu cầu miêu tả cực kỳ chi tiết, trần trụi về cơ thể và tính dục (Body/Anatomy). Tối thiểu 500 từ."
          : "Yêu cầu miêu tả chi tiết, sinh động, chuẩn phong cách văn học. Tối thiểu 600 từ.";

      const prompt = `
          ROLE: Wiki Generator.
          TASK: Create a detailed entry for "${name}" (Type: ${type}).
          CONTEXT: ${context}
          
          RULES:
          1. ${detailInstruction}
          2. Output JSON ONLY.
      `;

      const schema: Schema = {
          type: Type.OBJECT,
          properties: {
              description: { type: Type.STRING },
              appearance: { type: Type.STRING },
              personality: { type: Type.STRING },
              secrets: { type: Type.STRING },
              status: { type: Type.STRING }
          },
          required: ["description"]
      };

      try {
          const response = await this.generateContentWithRetry({
              model: DEFAULT_MODEL,
              contents: prompt,
              config: {
                  responseMimeType: 'application/json',
                  responseSchema: schema,
                  temperature: 0.85
              }
          });
          return JSON.parse(response.text || "{}");
      } catch (e) {
          return { description: "Lỗi tạo thông tin." };
      }
  }
}

export const geminiService = new GeminiService();
