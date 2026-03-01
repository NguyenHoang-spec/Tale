import { GoogleGenAI, Type, Schema } from "@google/genai";
import { db } from '../db';
import { GameEvent } from '../types';

const EVENT_MODEL = 'gemini-3-flash-preview'; // Dùng bản Flash cho nhanh và rẻ

class EventService {
    private ai: GoogleGenAI;

    constructor() {
        this.ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    }

    // 1. CHẠY NGẦM: Trích xuất sự kiện từ câu chuyện và lưu vào Database
    async extractAndSaveEvents(sessionId: number, text: string, currentTimestamp: number): Promise<void> {
        if (!text || text.trim() === "") return;

        const systemPrompt = `
            ROLE: Hệ thống Trích xuất Sự kiện & Lịch trình (Event Extractor).
            NHIỆM VỤ: Phân tích đoạn văn bản và tìm ra các LỜI HỨA, CUỘC HẸN, hoặc LỊCH TRÌNH HÀNG NGÀY.
            
            THÔNG TIN THỜI GIAN HIỆN TẠI:
            - Timestamp hiện tại: ${currentTimestamp} (tính bằng phút).
            - Quy đổi: 1 giờ = 60 phút, 1 ngày = 1440 phút, 1 tháng (30 ngày) = 43200 phút, 1 năm = 525600 phút.
            
            QUY TẮC TÍNH TOÁN (RẤT QUAN TRỌNG):
            - Nếu văn bản nói "90 ngày sau", triggerTimestamp = ${currentTimestamp} + (90 * 1440).
            - Nếu văn bản nói "tối nay" hoặc "vài canh giờ nữa", cộng thêm khoảng 300 - 600 phút.
            - Nếu văn bản nói "mỗi ngày" (lịch lặp lại), isRecurring = true, recurrenceInterval = 1440.
            
            CHỈ trích xuất khi có sự kiện RÕ RÀNG. Nếu không có, trả về mảng rỗng [].
        `;

        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                events: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING, description: "Mô tả ngắn gọn sự kiện (VD: Hẹn ăn tối với Vân Vận)" },
                            triggerTimestamp: { type: Type.NUMBER, description: "Thời điểm xảy ra (tính bằng phút tuyệt đối)" },
                            isRecurring: { type: Type.BOOLEAN, description: "Có lặp lại không? (VD: Lịch hàng ngày)" },
                            recurrenceInterval: { type: Type.NUMBER, description: "Khoảng thời gian lặp lại (phút). Nếu không lặp thì để 0." }
                        },
                        required: ["description", "triggerTimestamp", "isRecurring"]
                    }
                }
            }
        };

        try {
            const response = await this.ai.models.generateContent({
                model: EVENT_MODEL,
                contents: [{ role: 'user', parts: [{ text: text }] }],
                config: {
                    systemInstruction: systemPrompt,
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                    temperature: 0.1 // Logic toán học cần chính xác cao
                }
            });

            const parsed = JSON.parse(response.text || "{}");
            if (parsed.events && Array.isArray(parsed.events) && parsed.events.length > 0) {
                const eventsToSave: GameEvent[] = parsed.events.map((e: any) => ({
                    sessionId,
                    description: e.description,
                    triggerTimestamp: e.triggerTimestamp,
                    isRecurring: e.isRecurring,
                    recurrenceInterval: e.recurrenceInterval || 0,
                    status: 'pending'
                }));
                
                // Lưu vào database
                await db.events.bulkAdd(eventsToSave);
                console.log("Đã lưu sự kiện mới vào tiềm thức:", eventsToSave);
            }
        } catch (e) {
            console.warn("Lỗi khi trích xuất sự kiện:", e);
        }
    }

    // 2. BÁO THỨC: Kiểm tra xem có sự kiện nào đến hạn không
    async checkAndGetTriggerPrompt(sessionId: number, currentTimestamp: number): Promise<string> {
        try {
            // Tìm các sự kiện 'pending' và đã đến giờ (triggerTimestamp <= currentTimestamp)
            const pendingEvents = await db.events
                .where('sessionId').equals(sessionId)
                .filter(e => e.status === 'pending' && e.triggerTimestamp <= currentTimestamp)
                .toArray();

            if (pendingEvents.length === 0) return "";

            let promptInjection = "\n\n[HỆ THỐNG SỰ KIỆN CHỦ ĐỘNG - ACTIVE MEMORY]: Đã đến thời điểm xảy ra các sự kiện sau:\n";
            
            for (const event of pendingEvents) {
                promptInjection += `- ${event.description}\n`;
                
                // Cập nhật trạng thái sự kiện
                if (event.isRecurring && event.recurrenceInterval) {
                    // Nếu lặp lại, cộng thêm thời gian cho lần sau
                    await db.events.update(event.id!, { 
                        triggerTimestamp: currentTimestamp + event.recurrenceInterval 
                    });
                } else {
                    // Nếu diễn ra 1 lần, đánh dấu hoàn thành
                    await db.events.update(event.id!, { status: 'completed' });
                }
            }

            promptInjection += `
            BẮT BUỘC: Tùy vào hoàn cảnh hiện tại của nhân vật, hãy lồng ghép sự kiện này vào cốt truyện một cách tự nhiên và kịch tính nhất. Bạn có thể chọn 1 trong các cách sau:
            - Cách 1: Nhân vật chính ĐỘT NHIÊN NHỚ RA (giật mình, vội vã, toát mồ hôi vì suýt quên).
            - Cách 2: NPC liên quan chủ động xuất hiện (gõ cửa, chặn đường, gửi thư, truyền âm).
            - Cách 3: Sự kiện tự động diễn ra (nếu là lịch trình sinh hoạt hàng ngày).
            - Cách 4 : Nhân vật có liên quan nhắc nhở.
            **ĐẶC BIỆT :KHÔNG THỂ HIỆN TRONG VĂN BẢN NHƯ :NHÌN VÀO ĐỒNG HỒ ,...
            Tuyệt đối không bỏ qua sự kiện này!`;

            return promptInjection;
        } catch (e) {
            console.error("Lỗi khi kiểm tra báo thức sự kiện:", e);
            return "";
        }
    }
}

export const eventService = new EventService();
