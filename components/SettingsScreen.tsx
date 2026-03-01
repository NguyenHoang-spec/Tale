import React, { useState, useEffect, useRef } from 'react';
import { GameGenre, WorldSettings, CharacterTraits, NSFWIntensity, WritingStyle, NSFWFocus, AIStyle, EventFrequency, GameMechanics } from '../types';
import { geminiService } from '../services/geminiService';

interface SettingsScreenProps {
  onConfirm: (
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
    world: WorldSettings, 
    traits: CharacterTraits,
    gameConfig: { autoCodex: boolean, livingWorld: boolean },
    openingLength: number // 0: Default, 400, 600, 1200 (Fixed), 1500 (Epic)
  ) => void;
  onBack: () => void;
  initialTemplate?: any; // NEW PROP
}

type GenreData = {
  rootLabel: string;
  talentLabel: string;
  roots: { name: string; color: string; rarity: string; weight: number }[];
  talents: string[];
  preset: WorldSettings;
};

const PERSONALITY_TRAITS = [
  "Lãnh khốc vô tình", "Hài hước lầy lội", "Chính trực quân tử", "Biến thái sắc lang",
  "Thông minh xảo quyệt", "Ngây thơ trong sáng", "Điên cuồng hiếu chiến", "Cẩn thận đa nghi",
  "Lười biếng thảnh thơi", "Tham lam tiền tài", "Kiêu ngạo bá đạo", "Trầm ổn ít nói",
  "Nhiệt huyết trượng nghĩa", "Hèn nhát sợ chết", "Trung thành tận tụy", "Bí ẩn khó đoán"
];

const FONTS = [
    { name: 'Mặc định (Serif)', value: "'Merriweather', serif", class: 'font-serif' },
    { name: 'Hiện đại (Sans)', value: "'Roboto', sans-serif", class: 'font-sans' },
    { name: 'Cổ điển (Display)', value: "'Playfair Display', serif", class: 'font-display' },
    { name: 'Máy đánh chữ', value: "'Source Code Pro', monospace", class: 'font-mono' },
    { name: 'Thư pháp', value: "'Dancing Script', cursive", class: 'font-cursive' },
];

// FULL GENRE DATA TO PREVENT CRASH
const GENRE_DATA: Record<GameGenre, GenreData> = {
  [GameGenre.CULTIVATION]: {
    rootLabel: "Linh Căn / Thể Chất",
    talentLabel: "Thiên Phú / Cơ Duyên",
    roots: [
      { name: 'Hồng Mông Đạo Thể', color: 'text-arcane-400 text-glow-purple', rarity: 'Chí Tôn', weight: 1 },
      { name: 'Hỗn Độn Linh Căn', color: 'text-purple-400', rarity: 'Truyền Thuyết', weight: 2 },
      { name: 'Tiên Thiên Đạo Thai', color: 'text-gold-300', rarity: 'Truyền Thuyết', weight: 3 },
      { name: 'Hoang Cổ Thánh Thể', color: 'text-gold-500 text-glow-gold', rarity: 'Thần Thoại', weight: 3 },
      { name: 'Thiên Linh Căn', color: 'text-spirit-400', rarity: 'Cực Phẩm', weight: 10 },
      { name: 'Biến Dị Lôi Linh Căn', color: 'text-blue-400', rarity: 'Thượng Phẩm', weight: 12 },
      { name: 'Ngũ Hành Linh Căn', color: 'text-teal-400', rarity: 'Đặc Biệt', weight: 15 },
      { name: 'Tạp Linh Căn', color: 'text-zinc-500', rarity: 'Phế Vật', weight: 25 },
      { name: 'Người Bình Thường (Phàm Nhân)', color: 'text-zinc-600', rarity: 'Phổ Thông', weight: 50 },
    ],
    talents: [
      "Hệ Thống (System)", "Trọng Sinh Giả", "Xuyên Việt Giả", "Lão Gia Gia Trong Nhẫn", "Khí Vận Chi Tử", 
      "Ngộ Tính Nghịch Thiên", "Bất Tử Chi Thân", "Thao Túng Thời Gian", "Thôn Phệ Vạn Vật", "Ngôn Xuất Pháp Tùy",
      "Ký Ức Kiếp Trước", "Biết Trước Tương Lai", "Con Cưng Của Thiên Đạo", "Vô Hạn Tài Nguyên", "Bất Hoại Kim Thân",
      "Sát Phạt Quyết Đoán", "Tâm Ma Bất Xâm", "Cẩu Đạo Trung Nhân", "Vô Sỉ Chi Đồ", "Phản Phái Mệnh Cách"
    ],
    preset: {
      worldContext: "Thiên Nam Tu Tiên Giới, linh khí suy kiệt. Các tông môn chính đạo và ma đạo tranh giành tài nguyên khốc liệt.",
      plotDirection: "Từ một phàm nhân vô tình nhặt được bình nhỏ bí ẩn, bước lên con đường tu tiên nghịch thiên.",
      majorFactions: "- Thanh Vân Môn (Chính)\n- Huyết Sát Giáo (Ma)\n- Vạn Bảo Lâu (Trung lập)",
      keyNpcs: "- Lão giả bí ẩn (Sư phụ)\n- Nữ tử áo trắng (Hồng nhan)\n- Đại sư huynh (Tiểu nhân)",
      openingStory: "Tỉnh dậy trong thân xác một tên tạp dịch đệ tử vừa bị đánh chết vì làm vỡ bình ngọc của trưởng lão."
    }
  },
  [GameGenre.FANTASY]: {
    rootLabel: "Chủng Tộc / Huyết Mạch",
    talentLabel: "Kỹ Năng / Chúc Phúc",
    roots: [
      { name: 'Thần Tộc (Godborn)', color: 'text-gold-400 text-glow-gold', rarity: 'Tối Cao', weight: 2 },
      { name: 'Chúa Quỷ (Demon Lord)', color: 'text-crimson-500 text-glow-crimson', rarity: 'Tối Cao', weight: 2 },
      { name: 'Cổ Long (Ancient Dragon)', color: 'text-orange-500', rarity: 'Huyền Thoại', weight: 3 },
      { name: 'High Elf Hoàng Gia', color: 'text-jade-400', rarity: 'Cao Quý', weight: 5 },
      { name: 'Dũng Giả (Hero)', color: 'text-blue-400', rarity: 'Được Chọn', weight: 5 },
      { name: 'Thú Nhân', color: 'text-amber-600', rarity: 'Chiến Binh', weight: 10 },
      { name: 'Nhân Tộc', color: 'text-parchment-300', rarity: 'Phổ Thông', weight: 20 },
      { name: 'Người Bình Thường (Dân Làng)', color: 'text-stone-500', rarity: 'Cơ Bản', weight: 50 },
    ],
    talents: [
      "Thẩm Định (Appraise)", "Kho Đồ Không Gian", "Dịch Chuyển Tức Thời", "Hồi Phục Siêu Tốc", "Bất Tử Tái Sinh",
      "Nhân Đôi Kinh Nghiệm", "Cướp Đoạt Kỹ Năng", "Sức Mạnh Của Tình Bạn", "Miễn Nhiễm Ma Thuật", "Hào Quang Nhân Vật Chính",
      "Ma Pháp Vô Hạn", "Niệm Chú Cấp Tốc", "Thao Túng Nguyên Tố", "Necromancy", "Thánh Quang Chữa Lành"
    ],
    preset: {
      worldContext: "Lục địa Aethelgard, nơi ma thuật và kiếm thuật ngự trị. Long tộc đã ngủ say ngàn năm nay đang thức tỉnh.",
      plotDirection: "Người được chọn phải tìm ra 7 viên ngọc rồng để phong ấn Ma Vương, giải cứu thế giới.",
      majorFactions: "- Hiệp Hội Pháp Sư\n- Đế Chế Loài Người\n- Liên Minh Dị Tộc",
      keyNpcs: "- Nữ Hoàng Elf\n- Hiệp Sĩ Rồng\n- Phù Thủy Hắc Ám",
      openingStory: "Bạn là một học sinh trung học bị triệu hồi làm Dũng Giả nhưng bị nhà vua đuổi đi vì chỉ số thấp."
    }
  },
  [GameGenre.SCIFI]: {
    rootLabel: "Genotype / Nguồn Gốc",
    talentLabel: "Mô-đun / Công Nghệ",
    roots: [
      { name: 'AI Siêu Việt', color: 'text-spirit-400 text-glow', rarity: 'Vượt Trội', weight: 2 },
      { name: 'Cyborg S-Class', color: 'text-crimson-500', rarity: 'Vũ Khí', weight: 5 },
      { name: 'Newtype', color: 'text-blue-500', rarity: 'Phi Công', weight: 8 },
      { name: 'Người Sao Hỏa', color: 'text-orange-500', rarity: 'Quý Tộc', weight: 10 },
      { name: 'Dân Khu Ổ Chuột', color: 'text-stone-600', rarity: 'Đáy Xã Hội', weight: 20 },
      { name: 'Người Bình Thường (Công Dân)', color: 'text-stone-500', rarity: 'Phổ Thông', weight: 50 },
    ],
    talents: [
      "Bộ Não Lượng Tử", "Hacker Thần Sầu", "Kết Nối Neural", "Điều Khiển Drone", "AI Trợ Lý Cá Nhân",
      "Lái Mecha Cấp Thần", "Vũ Khí Plasma", "Giáp Năng Lượng", "Thích Khách Vô Hình", "Làm Chậm Thời Gian"
    ],
    preset: {
      worldContext: "Năm 3050, nhân loại đã thống trị thiên hà nhưng bị chia rẽ bởi các tập đoàn Mega-Corp. AI đang nổi dậy.",
      plotDirection: "Một hacker vùng ngoại ô vô tình đánh cắp được mã nguồn của AI Mẹ, trở thành kẻ bị truy nã toàn vũ trụ.",
      majorFactions: "- Tập Đoàn Arasaka\n- Quân Đội Liên Bang\n- Phe Kháng Chiến Neo-Zion",
      keyNpcs: "- Android sát thủ\n- Trùm buôn lậu vũ trụ\n- Hacker huyền thoại Zero",
      openingStory: "Bạn tỉnh dậy trong một con hẻm ở Neo-Tokyo, tay cầm một con chip dữ liệu mà cả thiên hà đang săn lùng."
    }
  },
  [GameGenre.HORROR]: {
    rootLabel: "Thể Chất / Lời Nguyền",
    talentLabel: "Năng Lực Sinh Tồn",
    roots: [
      { name: 'Đứa Con Của Cthulhu', color: 'text-jade-600 text-glow', rarity: 'Cổ Thần', weight: 2 },
      { name: 'Người Âm Dương', color: 'text-arcane-400', rarity: 'Tâm Linh', weight: 10 },
      { name: 'Thợ Săn Quỷ', color: 'text-amber-500', rarity: 'Chuyên Gia', weight: 8 },
      { name: 'Kẻ Sống Sót Cuối Cùng', color: 'text-blue-400', rarity: 'May Mắn', weight: 15 },
      { name: 'Nạn Nhân Hiến Tế', color: 'text-crimson-400', rarity: 'Xui Xẻo', weight: 10 },
      { name: 'Người Bình Thường', color: 'text-stone-500', rarity: 'Phổ Thông', weight: 50 },
    ],
    talents: [
      "Nhìn Thấy Ma", "Trừ Tà Diệt Quỷ", "Cảm Nhận Sát Khí", "Biết Trước Cái Chết", "Miễn Nhiễm Sợ Hãi",
      "Chạy Nhanh Hơn Bạn Bè", "Ẩn Nấp Tuyệt Đối", "Giả Chết", "Nín Thở Siêu Lâu", "Giác Quan Nhạy Bén"
    ],
    preset: {
      worldContext: "Thành phố sương mù Arkham, nơi những Cổ Thần đang thì thầm trong giấc mơ của con người.",
      plotDirection: "Điều tra bí ẩn về trại thương điên bỏ hoang, nơi được cho là cánh cổng dẫn đến địa ngục.",
      majorFactions: "- Giáo Phái Cthulhu\n- Hội Kín Mắt Bạc\n- Cảnh Sát Địa Phương",
      keyNpcs: "- Bác sĩ tâm thần điên loạn\n- Cô bé ôm gấu bông dính máu\n- Vị mục sư mất đức tin",
      openingStory: "Bạn nhận được lá thư cầu cứu từ người chị gái đã mất tích 5 năm trước, địa chỉ là Dinh thự Blackwood."
    }
  },
  [GameGenre.DETECTIVE]: {
    rootLabel: "Xuất Thân / Nghề Nghiệp",
    talentLabel: "Kỹ Năng Nghiệp Vụ",
    roots: [
      { name: 'Sherlock Holmes Tái Thế', color: 'text-gold-400', rarity: 'Thiên Tài', weight: 2 },
      { name: 'Bác Sĩ Pháp Y', color: 'text-cyan-400', rarity: 'Chuyên Gia', weight: 8 },
      { name: 'Cảnh Sát Hình Sự', color: 'text-blue-600', rarity: 'Chính Quy', weight: 12 },
      { name: 'Thám Tử Tư', color: 'text-zinc-400', rarity: 'Kinh Nghiệm', weight: 10 },
      { name: 'Người Qua Đường', color: 'text-gray-500', rarity: 'Bình Thường', weight: 20 },
      { name: 'Người Bình Thường', color: 'text-stone-500', rarity: 'Phổ Thông', weight: 50 },
    ],
    talents: [
      "Cung Điện Ký Ức", "Suy Luận Logic", "Tâm Lý Học Tội Phạm", "Quan Sát Chi Tiết", "Pháp Y Tái Tạo",
      "Võ Thuật Cận Chiến", "Bắn Súng", "Phá Khóa", "Cải Trang", "Hacker"
    ],
    preset: {
      worldContext: "London thế kỷ 19 giả tưởng (Steampunk). Tội phạm sử dụng công nghệ hơi nước để gây án.",
      plotDirection: "Giải mã vụ án 'Bóng Ma Hơi Nước', vạch trần âm mưu lật đổ hoàng gia.",
      majorFactions: "- Scotland Yard\n- Nghiệp đoàn Thợ Máy\n- Tổ chức M",
      keyNpcs: "- Bác sĩ pháp y lập dị\n- Cậu bé bán báo\n- Nữ tặc",
      openingStory: "Một thi thể người máy được phát hiện bên bờ sông Thames, trên tay cầm huy hiệu của Hoàng gia."
    }
  },
  [GameGenre.SLICE_OF_LIFE]: {
    rootLabel: "Gia Thế / Xuất Thân",
    talentLabel: "Tài Lẻ / Vận May",
    roots: [
      { name: 'Con Trai Tỷ Phú', color: 'text-emerald-400 text-glow', rarity: 'Siêu Cấp', weight: 2 },
      { name: 'Học Bá (Thủ Khoa)', color: 'text-indigo-400', rarity: 'Ưu Tú', weight: 8 },
      { name: 'Hot Boy / Hot Girl', color: 'text-rose-400', rarity: 'Nổi Tiếng', weight: 10 },
      { name: 'Con Nhà Nghèo', color: 'text-parchment-400', rarity: 'Nghị Lực', weight: 15 },
      { name: 'NEET', color: 'text-gray-400', rarity: 'Ở Ẩn', weight: 10 },
      { name: 'Người Bình Thường', color: 'text-stone-400', rarity: 'Phổ Thông', weight: 50 },
    ],
    talents: [
      "Nhan Sắc Cực Phẩm", "Học Bá", "Nấu Ăn Ngon", "Kiếm Tiền Giỏi", "May Mắn",
      "Lãnh Đạo", "Giao Tiếp Tốt", "Chơi Thể Thao", "Hát Hay", "Mặt Dày"
    ],
    preset: {
      worldContext: "Tokyo năm 2024, nhịp sống hối hả. Bạn là một nhân viên văn phòng/học sinh bình thường.",
      plotDirection: "Tìm kiếm ý nghĩa cuộc sống, xây dựng các mối quan hệ lãng mạn và sự nghiệp.",
      majorFactions: "- Công Ty Đen\n- Hội Phụ Huynh\n- Câu Lạc Bộ Trường",
      keyNpcs: "- Cô hàng xóm xinh đẹp\n- Sếp khó tính\n- Bạn thân từ nhỏ",
      openingStory: "Ngày đầu tiên nhập học tại trường cấp 3 Đế Vương, bạn đã lỡ đắc tội với Hội trưởng Hội học sinh."
    }
  },
  [GameGenre.HISTORICAL]: {
    rootLabel: "Thân Phận / Tước Vị",
    talentLabel: "Văn Võ Nghệ",
    roots: [
      { name: 'Hoàng Đế', color: 'text-gold-500 text-glow', rarity: 'Cửu Ngũ Chí Tôn', weight: 2 },
      { name: 'Đại Tướng Quân', color: 'text-crimson-500', rarity: 'Quyền Lực', weight: 6 },
      { name: 'Quân Sư', color: 'text-purple-400', rarity: 'Trí Tuệ', weight: 6 },
      { name: 'Nông Dân Khởi Nghĩa', color: 'text-jade-500', rarity: 'Anh Hùng', weight: 10 },
      { name: 'Lính Tốt', color: 'text-stone-500', rarity: 'Bình Thường', weight: 15 },
      { name: 'Người Bình Thường (Dân Đen)', color: 'text-stone-500', rarity: 'Phổ Thông', weight: 50 },
    ],
    talents: [
      "Binh Pháp Tôn Tử", "Võ Công Cái Thế", "Cung Mã Thành Thạo", "Bách Bộ Xuyên Dương", "Thương Pháp Như Rồng",
      "Mưu Lược Thâm Sâu", "Khẩu Tài Hùng Biện", "Thu phục Nhân Tâm", "Trị Quốc Bình Thiên Hạ", "Cầm Kỳ Thi Họa"
    ],
    preset: {
      worldContext: "Đại Việt thời Lê Sơ hoặc Trung Quốc thời Tam Quốc. Chiến tranh loạn lạc, anh hùng xuất thế.",
      plotDirection: "Từ một binh lính vô danh lập công trạng, trở thành đại tướng quân thống nhất giang sơn.",
      majorFactions: "- Triều Đình\n- Phản Quân\n- Ngoại Bang Xâm Lược",
      keyNpcs: "- Vị vua trẻ tuổi\n- Nữ sát thủ giang hồ\n- Quân sư quạt mo",
      openingStory: "Bạn là một người lính đào ngũ đang bị truy nã, trốn trong một ngôi miếu hoang giữa rừng."
    }
  },
  [GameGenre.POST_APOCALYPTIC]: {
    rootLabel: "Dị Năng / Đột Biến",
    talentLabel: "Kỹ Năng Sinh Tồn",
    roots: [
      { name: 'Vua Xác Sống', color: 'text-crimson-600 text-glow', rarity: 'Độc Nhất', weight: 2 },
      { name: 'Dị Năng Giả Hệ Lôi', color: 'text-gold-400', rarity: 'S-Class', weight: 6 },
      { name: 'Người Đột Biến', color: 'text-lime-500', rarity: 'Biến Dị', weight: 10 },
      { name: 'Bác Sĩ Quân Y', color: 'text-emerald-400', rarity: 'Cần Thiết', weight: 15 },
      { name: 'Kẻ Sống Sót', color: 'text-gray-500', rarity: 'Sinh Tồn', weight: 20 },
      { name: 'Người Bình Thường', color: 'text-stone-500', rarity: 'Phổ Thông', weight: 50 },
    ],
    talents: [
      "Kho Đồ Không Gian", "Trồng Trọt Đất Chết", "Lọc Nước Sạch", "Sơ Cứu", "Kỹ Năng Săn Bắn",
      "Bắn Tỉa Thần Sầu", "Điều Khiển Drone", "Biến Hình", "Lãnh Đạo", "Chế Tạo Vũ Khí"
    ],
    preset: {
      worldContext: "Năm 2050, virus Z bùng phát biến 90% nhân loại thành xác sống. Người sống sót co cụm trong các căn cứ.",
      plotDirection: "Xây dựng căn cứ sinh tồn, tìm kiếm thuốc giải, chống lại cả Zombie và lòng dạ con người.",
      majorFactions: "- Quân Đội Chính Phủ\n- Bang Phái Motor\n- Giáo Phái Ngày Tận Thế",
      keyNpcs: "- Tiến sĩ điên\n- Nữ chiến binh lạnh lùng\n- Chó nghiệp vụ thông minh",
      openingStory: "Bạn tỉnh dậy trong phòng thí nghiệm hoang tàn, trên tay có vết cắn nhưng chưa biến đổi."
    }
  },
  [GameGenre.ANIME_CROSSOVER]: {
    rootLabel: "Hệ Thống Sức Mạnh / Huyết Thống",
    talentLabel: "Tuyệt Chiêu / Bàn Tay Vàng",
    roots: [
        { name: 'Huyết Kế Giới Hạn (Sharingan/Rinnegan)', color: 'text-crimson-500', rarity: 'Thần Cấp', weight: 3 },
        { name: 'Trái Ác Quỷ (Hệ Logia)', color: 'text-gold-500', rarity: 'Hiếm', weight: 4 },
        { name: 'Trái Ác Quỷ (Hệ Zoan Thần Thoại)', color: 'text-cyan-400', rarity: 'Thần Thoại', weight: 3 },
        { name: 'Saiyan Huyết Thống', color: 'text-yellow-400', rarity: 'Vũ Trụ', weight: 2 },
        { name: 'Quincy (Diệt Khước Sư)', color: 'text-blue-200', rarity: 'Hiếm', weight: 5 },
        { name: 'Shinigami (Tử Thần)', color: 'text-ink-400', rarity: 'Linh Hồn', weight: 5 },
        { name: 'Sát Long Nhân (Dragon Slayer)', color: 'text-rose-400', rarity: 'Cổ Đại', weight: 5 },
        { name: 'Vua Trò Chơi (Yugi)', color: 'text-purple-500', rarity: 'Hack Bài', weight: 3 },
        { name: 'Niệm Nhân (Hunter x Hunter)', color: 'text-emerald-400', rarity: 'Đa Dạng', weight: 6 },
        { name: 'Stand User (JoJo)', color: 'text-fuchsia-400', rarity: 'Bí Ẩn', weight: 6 },
        { name: 'Quirk (Học Viện Anh Hùng)', color: 'text-orange-400', rarity: 'Siêu Năng', weight: 8 },
        { name: 'Titan Shifter', color: 'text-red-700', rarity: 'Khổng Lồ', weight: 4 },
        { name: 'Pháp Sư (Fairy Tail)', color: 'text-pink-300', rarity: 'Ma Pháp', weight: 10 },
        { name: 'Hải Quân (One Piece)', color: 'text-blue-600', rarity: 'Chính Nghĩa', weight: 10 },
        { name: 'Ninja Làng Lá', color: 'text-green-500', rarity: 'Cơ Bản', weight: 15 },
        { name: 'Hải Tặc Tép Riu', color: 'text-stone-500', rarity: 'Yếu', weight: 10 },
        { name: 'Người Bình Thường', color: 'text-stone-500', rarity: 'Phổ Thông', weight: 50 },
    ],
    talents: [
        "Talk no Jutsu (Thông Não Chi Thuật)", "Nakama Power (Sức Mạnh Tình Bạn)", "Hồi Tưởng Power Up", "Hào Quang Nhân Vật Chính",
        "Triệu Hồi Thuật", "Haki Bá Vương", "Bát Môn Độn Giáp", "Bankai", "Gear 5 (Nika)", "Siêu Saiyan",
        "Hệ Thống Gacha Anime", "Sao Chép Chiêu Thức", "Bất Tử", "Đấm Nghiêm Túc (Saitama)", "Death Note",
        "Du Hành Thời Gian", "Ăn Bao Nhiêu Cũng Không Béo", "Biến Hình Sexy", "Triệu Hồi Waifu", "Kamehameha"
    ],
    preset: {
        worldContext: "Thế giới hỗn loạn nơi Đại Hải Trình nối liền với Làng Lá, và các Tòa Tháp Hunter mọc lên giữa Soul Society.",
        plotDirection: "Trở thành Vua của thế giới mới, thống nhất các hệ thống sức mạnh.",
        majorFactions: "- Liên Minh Hải Quân & Gotei 13\n- Akatsuki & Thất Vũ Hải\n- Hiệp Hội Hunter",
        keyNpcs: "- Monkey D. Luffy\n- Uzumaki Naruto\n- Kurosaki Ichigo",
        openingStory: "Tỉnh dậy trên tàu Moby Dick của Râu Trắng, nhưng lại mặc áo của Akatsuki.",
        crossoverWorlds: "One Piece x Naruto x Bleach"
    }
  },
  [GameGenre.ALL_ANIME]: {
      rootLabel: "Hệ Thống / Năng Lực",
      talentLabel: "Kỹ Năng / Cheat Code",
      roots: [
          { name: 'Hệ Thống Tổng Mạn (Gacha)', color: 'text-gold-500', rarity: 'SSR', weight: 5 },
          { name: 'Trái Ác Quỷ (Hệ Logia)', color: 'text-crimson-500', rarity: 'Hiếm', weight: 5 },
          { name: 'Vô Hạn Kiếm Chế (Fate)', color: 'text-red-400', rarity: 'S-Rank', weight: 5 },
          { name: 'Con Mắt Geass', color: 'text-purple-500', rarity: 'Thần Bí', weight: 5 },
          { name: 'Siêu Năng Lực (Toaru)', color: 'text-blue-400', rarity: 'Esper', weight: 10 },
          { name: 'Thợ Săn Quỷ (Kimetsu)', color: 'text-cyan-400', rarity: 'Kiếm Sĩ', weight: 10 },
          { name: 'Pháp Sư (Jujutsu)', color: 'text-ink-400', rarity: 'Nguyền Sư', weight: 10 },
          { name: 'Người Bình Thường', color: 'text-gray-400', rarity: 'Phổ Thông', weight: 50 },
      ],
      talents: [
          "Bất Tử", "Quyến Rũ Tuyệt Đối", "Sao Chép Năng Lực", "Dừng Thời Gian", "Xuyên Không",
          "Triệu Hồi Waifu", "Hào Quang Nhân Vật Chính", "Thông Não Chi Thuật", "Haki Bá Vương",
          "Sung Mãn Vô Hạn", "Đọc Suy Nghĩ", "Tàng Hình", "Biến Hình"
      ],
      preset: {
          worldContext: "Thế giới Tổng Mạn (All Anime) nơi các nhân vật từ nhiều bộ anime khác nhau cùng tồn tại trong một thành phố hiện đại hoặc giả tưởng. Các sự kiện cốt truyện đan xen lẫn nhau.",
          plotDirection: "Xây dựng dàn Harem hùng hậu nhất lịch sử, thu thập các mỹ nữ từ mọi thế giới và trở thành bá chủ.",
          majorFactions: "- Học Viện Tổng Mạn (Nơi quy tụ học sinh ưu tú)\n- Tổ Chức Áo Đen (Phản diện)\n- Hiệp Hội Anh Hùng",
          keyNpcs: "- Yukinoshita Yukino (Hội trưởng)\n- Tokisaki Kurumi (Tinh linh)\n- Esdeath (Tướng quân)",
          openingStory: "Bạn vừa chuyển trường đến Học Viện Tổng Mạn, và người ngồi cạnh bạn chính là cô gái nổi tiếng nhất trường."
      }
  },
  [GameGenre.REAL_LIFE]: {
      rootLabel: "Xuất Thân / Địa Vị",
      talentLabel: "Tài Năng / Scandal",
      roots: [
          { name: 'Con Nhà Nòi (Nepo Baby)', color: 'text-gold-500 text-glow-gold', rarity: 'Kim Thìa', weight: 2 },
          { name: 'Tài Phiệt Đời 2 (Chaebol)', color: 'text-emerald-400 text-glow', rarity: 'Quyền Lực', weight: 2 },
          { name: 'Thần Đồng (Thiên Tài)', color: 'text-blue-400', rarity: 'Hiếm', weight: 5 },
          { name: 'Hot Boy/Girl Mạng', color: 'text-rose-400', rarity: 'Nổi Tiếng', weight: 8 },
          { name: 'Thực Tập Sinh', color: 'text-purple-300', rarity: 'Cần Cù', weight: 10 },
          { name: 'Diễn Viên Quần Chúng', color: 'text-stone-400', rarity: 'Bình Thường', weight: 15 },
          { name: 'Người Bình Thường', color: 'text-gray-500', rarity: 'Phổ Thông', weight: 50 },
      ],
      talents: [
          "Nhan Sắc Thần Tiên", "Diễn Xuất Ảnh Hậu/Ảnh Đế", "Giọng Ca Vàng", "Vũ Đạo Thần Sầu",
          "Bậc Thầy Tạo Drama", "EQ Vô Cực", "Gia Thế Khủng", "Hacker", "Đại Gia Ngầm",
          "Khuôn Mặt Meme", "Thánh Livestream", "Nữ Hoàng Quảng Cáo", "Sát Trai/Gái"
      ],
      preset: {
          worldContext: "Thế giới hiện đại năm 2024. Showbiz hào nhoáng nhưng đầy cạm bẫy. Các ngôi sao (Triệu Lệ Dĩnh, BlackPink, BTS...) đều tồn tại thật.",
          plotDirection: "Từ một người vô danh tiểu tốt, bước chân vào giới giải trí/thương trường, từng bước leo lên đỉnh cao danh vọng và quyền lực.",
          majorFactions: "- Tư Bản (Các nhà đầu tư)\n- Fanclub (Hội người hâm mộ)\n- Paparazzi (Săn ảnh)",
          keyNpcs: "- Triệu Lệ Dĩnh (Đàn chị)\n- Emma Watson (Bạn diễn)\n- Chủ Tịch Tập Đoàn (Nhà tài trợ)",
          openingStory: "Bạn đang đứng xếp hàng chờ casting cho một bộ phim bom tấn, xung quanh là hàng trăm trai xinh gái đẹp."
      }
  },
  [GameGenre.ACTION]: {
      rootLabel: "Sức Mạnh / Kỹ Năng Gốc",
      talentLabel: "Vũ Khí / Đặc Quyền",
      roots: [
          { name: 'Thần Lực (Super Strength)', color: 'text-crimson-500 text-glow', rarity: 'SSR', weight: 2 },
          { name: 'Phản Xạ Cực Hạn', color: 'text-blue-400', rarity: 'SR', weight: 5 },
          { name: 'Cơ Thể Sinh Học (Bio-Weapon)', color: 'text-emerald-400', rarity: 'SR', weight: 5 },
          { name: 'Đặc Nhiệm SAS', color: 'text-stone-400', rarity: 'Chuyên Nghiệp', weight: 10 },
          { name: 'Võ Sư', color: 'text-orange-400', rarity: 'Cao Thủ', weight: 15 },
          { name: 'Người Bình Thường', color: 'text-gray-500', rarity: 'Phổ Thông', weight: 50 },
      ],
      talents: [
          "Bắn Súng Bách Phát Bách Trúng", "Cận Chiến CQC", "Sát Thủ Vô Hình", "Bất Tử Tạm Thời", 
          "Hồi Máu Cấp Tốc", "Giác Quan Thứ 6", "Combo Bất Tận", "Bullet Time (Ngưng Đọng Thời Gian)",
          "Vũ Khí Hạng Nặng", "Triệu Hồi Drone"
      ],
      preset: {
          worldContext: "Đấu Trường Vô Hạn, nơi quy tụ các chiến binh mạnh nhất từ đa vũ trụ để chém giết lẫn nhau.",
          plotDirection: "Chiến đấu, sinh tồn, thu thập trang bị và trở thành Nhà Vô Địch Tối Cao.",
          majorFactions: "- Ban Tổ Chức (GM)\n- Liên Minh Sát Thủ\n- Quân Đoàn Đánh Thuê",
          keyNpcs: "- Trọng Tài AI\n- Nhà Vô Địch Mùa Trước\n- Kẻ Bán Vũ Khí Chợ Đen",
          openingStory: "Bạn bị dịch chuyển đến một hòn đảo hoang, trên tay chỉ có một con dao găm và tiếng loa thông báo bắt đầu trò chơi sinh tử."
      }
  },
  [GameGenre.ORIGINAL]: {
      rootLabel: "Vai Trò / Xuất Thân",
      talentLabel: "Ưu Thế / Kịch Bản",
      roots: [
          { name: 'Nhân Vật Chính (Main Character)', color: 'text-gold-500 text-glow', rarity: 'Định Mệnh', weight: 2 },
          { name: 'Trùm Cuối (Final Boss)', color: 'text-crimson-500', rarity: 'Bá Đạo', weight: 2 },
          { name: 'Nhân Vật Phụ Quan Trọng', color: 'text-blue-400', rarity: 'Hỗ Trợ', weight: 10 },
          { name: 'Phản Diện Phụ (Cannon Fodder)', color: 'text-stone-400', rarity: 'Nguy Hiểm', weight: 15 },
          { name: 'Người Qua Đường A', color: 'text-gray-500', rarity: 'Mờ Nhạt', weight: 50 },
      ],
      talents: [
          "Biết Trước Cốt Truyện", "Hào Quang Nhân Vật Chính", "Hệ Thống Thay Đổi Kịch Bản", 
          "Giàu Nứt Đố Đổ Vách", "Sức Mạnh Của Tình Bạn", "Bất Tử", "Hồi Sinh", "Hack Game"
      ],
      preset: {
          worldContext: "Thế giới dựa hoàn toàn trên nguyên tác (Harry Potter, Marvel, LOTR...) mà bạn mong muốn. Giữ nguyên logic gốc.",
          plotDirection: "Nhập vai vào thế giới gốc, thay đổi các sự kiện bi kịch hoặc trở thành bá chủ.",
          majorFactions: "- Phe Chính Diện\n- Phe Phản Diện\n- Thế Lực Trung Lập",
          keyNpcs: "- Nhân vật chính nguyên tác\n- Trùm cuối nguyên tác\n- Nhân vật yêu thích",
          openingStory: "Bạn tỉnh dậy và nhận ra mình đang ở trong thế giới của bộ truyện yêu thích, nhưng lại là nhân vật sẽ chết ở tập 1."
      }
  }
};

const DEFAULT_GENRE_DATA = GENRE_DATA[GameGenre.CULTIVATION];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onConfirm, onBack, initialTemplate }) => {
  // --- Basic Info State ---
  const [name, setName] = useState('');
  const [customTitle, setCustomTitle] = useState(''); 
  const [gender, setGender] = useState('Nam');
  const [genre, setGenre] = useState<GameGenre>(GameGenre.CULTIVATION);
  // Avatar Removed
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>('');
  const [backgroundType, setBackgroundType] = useState<'image' | 'video'>('image');
  const [fontFamily, setFontFamily] = useState(FONTS[0].value); // NEW FONT STATE

  const [isNSFW, setIsNSFW] = useState(false);
  const [nsfwIntensity, setNsfwIntensity] = useState<NSFWIntensity>('soft');
  const [writingStyle, setWritingStyle] = useState<WritingStyle>('convert');
  const [nsfwFocus, setNsfwFocus] = useState<NSFWFocus[]>([]);
  const [autoPronouns, setAutoPronouns] = useState(true);
  
  // Set default model to Gemini 3.0 Pro
  const [aiModel, setAiModel] = useState('gemini-3-pro-preview');
  
  // Custom Genre State
  const [isCustomGenre, setIsCustomGenre] = useState(false);
  const [customGenreName, setCustomGenreName] = useState('');

  // --- Gameplay Config State (Simplified) ---
  const [autoCodex, setAutoCodex] = useState(true);
  const [livingWorld, setLivingWorld] = useState(true); // NEW: Enable Living World by default
  const [memoryDepth, setMemoryDepth] = useState<'standard' | 'high'>('standard'); // NEW MEMORY STATE
  
  // --- Opening Config ---
  const [openingLength, setOpeningLength] = useState<number>(0); // 0: Default, 400, 600, 1200 (Fixed), 1500 (Epic)

  // --- Character State ---
  // Initialize with the last root (Normal) instead of the first
  const defaultRoots = GENRE_DATA[GameGenre.CULTIVATION].roots;
  const [currentRoot, setCurrentRoot] = useState(defaultRoots[defaultRoots.length - 1]);
  const [currentTalents, setCurrentTalents] = useState<string[]>([]);
  const [currentPersonality, setCurrentPersonality] = useState("Bình thường");
  const [isEditingAttributes, setIsEditingAttributes] = useState(false);

  // --- World State ---
  const [settings, setSettings] = useState<WorldSettings>(GENRE_DATA[GameGenre.CULTIVATION].preset);
  const [workTitlePrompt, setWorkTitlePrompt] = useState(''); // NEW: Work Title Prompt
  const [loadingField, setLoadingField] = useState<string | null>(null);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [trainingDataSize, setTrainingDataSize] = useState<number>(0);

  const bgInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null); // NEW: Reference File Input

  const getGenreData = (g: GameGenre) => GENRE_DATA[g] || DEFAULT_GENRE_DATA;

  const generateRandomDefaults = (g: GameGenre) => {
      const data = getGenreData(g);
      // Pick random defaults instantly
      if (data.roots && data.roots.length > 0) {
          // ALWAYS PICK THE LAST ITEM (LOWEST TIER/NORMAL) AS DEFAULT
          setCurrentRoot(data.roots[data.roots.length - 1]);
      }
      if (data.talents && data.talents.length > 0) {
          const shuffled = [...data.talents].sort(() => 0.5 - Math.random());
          setCurrentTalents(shuffled.slice(0, Math.floor(Math.random() * 2) + 1));
      } else {
          setCurrentTalents(["Kỹ năng cơ bản"]);
      }
      setCurrentPersonality(PERSONALITY_TRAITS[Math.floor(Math.random() * PERSONALITY_TRAITS.length)]);
  };

  useEffect(() => {
    // 1. Check if Initial Template is passed via Prop
    if (initialTemplate) {
         if (initialTemplate.basicInfo) {
             setName(initialTemplate.basicInfo.name || '');
             setCustomTitle(initialTemplate.basicInfo.customTitle || '');
             setGender(initialTemplate.basicInfo.gender || 'Nam');
             if (initialTemplate.basicInfo.genre) {
                 setGenre(initialTemplate.basicInfo.genre);
             }
             setIsNSFW(initialTemplate.basicInfo.isNSFW || false);
             setNsfwIntensity(initialTemplate.basicInfo.nsfwIntensity || 'soft');
             setWritingStyle(initialTemplate.basicInfo.writingStyle || 'convert');
             setNsfwFocus(initialTemplate.basicInfo.nsfwFocus || []);
             setAutoPronouns(!!initialTemplate.basicInfo.pronounRules);
             setAiModel(initialTemplate.basicInfo.aiModel || 'gemini-3-pro-preview');
             if (initialTemplate.basicInfo.backgroundImageUrl) setBackgroundImageUrl(initialTemplate.basicInfo.backgroundImageUrl);
             if (initialTemplate.basicInfo.backgroundType) setBackgroundType(initialTemplate.basicInfo.backgroundType);
             if (initialTemplate.basicInfo.fontFamily) setFontFamily(initialTemplate.basicInfo.fontFamily);
             if (initialTemplate.basicInfo.memoryDepth) setMemoryDepth(initialTemplate.basicInfo.memoryDepth);
         }
         if (initialTemplate.worldSettings) setSettings(initialTemplate.worldSettings);
         if (initialTemplate.characterTraits) {
             setCurrentRoot({ name: initialTemplate.characterTraits.spiritualRoot, color: 'text-white', rarity: 'Unknown', weight: 0 });
             setCurrentTalents(initialTemplate.characterTraits.talents);
             setCurrentPersonality(initialTemplate.characterTraits.personality || "Bình thường");
         }
         if (initialTemplate.gameConfig) {
             setAutoCodex(initialTemplate.gameConfig.autoCodex ?? true);
             setLivingWorld(initialTemplate.gameConfig.livingWorld ?? true);
         }
         return; // Skip other checks if template provided
    }

    // 2. Check for Local Storage Draft
    const draft = localStorage.getItem('td_settings_draft');
    if (draft) {
      if (window.confirm("Phát hiện bản nháp đã lưu. Bạn có muốn tải lại không?")) {
        try {
          const data = JSON.parse(draft);
          if (data.basicInfo) {
             setName(data.basicInfo.name || '');
             setCustomTitle(data.basicInfo.customTitle || '');
             setGender(data.basicInfo.gender || 'Nam');
             if (data.basicInfo.genre) {
                 setGenre(data.basicInfo.genre);
             }
             setIsNSFW(data.basicInfo.isNSFW || false);
             setNsfwIntensity(data.basicInfo.nsfwIntensity || 'soft');
             setWritingStyle(data.basicInfo.writingStyle || 'convert');
             setNsfwFocus(data.basicInfo.nsfwFocus || []);
             setAutoPronouns(!!data.basicInfo.pronounRules);
             setAiModel(data.basicInfo.aiModel || 'gemini-3-pro-preview');
             if (data.basicInfo.backgroundImageUrl) setBackgroundImageUrl(data.basicInfo.backgroundImageUrl);
             if (data.basicInfo.backgroundType) setBackgroundType(data.basicInfo.backgroundType);
             if (data.basicInfo.fontFamily) setFontFamily(data.basicInfo.fontFamily);
             if (data.basicInfo.memoryDepth) setMemoryDepth(data.basicInfo.memoryDepth);
          }
          if (data.worldSettings) setSettings(data.worldSettings);
          if (data.characterTraits) {
             setCurrentRoot({ name: data.characterTraits.spiritualRoot, color: 'text-white', rarity: 'Unknown', weight: 0 });
             setCurrentTalents(data.characterTraits.talents);
             setCurrentPersonality(data.characterTraits.personality || "Bình thường");
         }
          if (data.gameConfig) {
              setAutoCodex(data.gameConfig.autoCodex ?? true);
              setLivingWorld(data.gameConfig.livingWorld ?? true);
          }
          return; 
        } catch (e) { console.error("Error loading draft", e); }
      }
    }
    
    // 3. Defaults
    generateRandomDefaults(genre);
  }, [initialTemplate]); // Added initialTemplate dependency

  const handleGenreChange = (newGenre: GameGenre) => {
    setIsCustomGenre(false);
    setGenre(newGenre);
    const data = getGenreData(newGenre);
    setSettings(prev => ({ ...data.preset, referenceContext: prev.referenceContext })); // Keep uploaded file
    generateRandomDefaults(newGenre);
  };
  
  const handleCustomGenreSelect = () => {
      setIsCustomGenre(true);
  };

  const handleBgClick = () => bgInputRef.current?.click();
  
  const handleBgFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setBackgroundImageUrl(reader.result as string);
              if (file.type.startsWith('video/')) {
                  setBackgroundType('video');
              } else {
                  setBackgroundType('image');
              }
          };
          reader.readAsDataURL(file);
      }
  };

  // UPDATED: Handle Deep Training File Upload
  const handleTrainingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          const content = ev.target?.result as string;
          if (content) {
              // Increased Limit: 60,000 chars (~15k tokens) for Gemini 1.5/Pro context
              if (content.length > 60000) {
                  alert("File quá lớn! Giới hạn 60,000 ký tự. Hệ thống sẽ cắt bớt phần sau.");
              }
              const trimmedContent = content.substring(0, 60000);
              setSettings(prev => ({ ...prev, referenceContext: trimmedContent }));
              setTrainingDataSize(trimmedContent.length);
              alert("Đã nạp dữ liệu Training thành công! AI sẽ học phong cách viết và bối cảnh từ file này.");
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleClearTrainingData = () => {
      setSettings(prev => ({ ...prev, referenceContext: undefined }));
      setTrainingDataSize(0);
  };

  const handleSaveDraft = () => {
     const data = {
         basicInfo: { name, customTitle, gender, genre, isNSFW, nsfwIntensity, writingStyle, nsfwFocus, backgroundImageUrl, backgroundType, pronounRules: autoPronouns ? "AUTO" : "", aiModel, fontFamily, memoryDepth },
         worldSettings: settings,
         characterTraits: { spiritualRoot: currentRoot.name, talents: currentTalents, personality: currentPersonality },
         gameConfig: { autoCodex, livingWorld }
     };
     localStorage.setItem('td_settings_draft', JSON.stringify(data));
     
     // Silent Toast Notification
     setShowSaveToast(true);
     setTimeout(() => setShowSaveToast(false), 3000);
  };

  const handleExportTemplate = () => {
     const data = {
         type: "TEMPLATE",
         basicInfo: { name, customTitle, gender, genre, isNSFW, nsfwIntensity, writingStyle, nsfwFocus, backgroundImageUrl, backgroundType, pronounRules: autoPronouns ? "AUTO" : "", aiModel, fontFamily, memoryDepth },
         worldSettings: settings,
         characterTraits: { spiritualRoot: currentRoot.name, talents: currentTalents, personality: currentPersonality },
         gameConfig: { autoCodex, livingWorld }
     };
     const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     
     // CHANGED: File name logic
     const rawName = customTitle || name || 'template';
     const fileName = rawName.replace(/[^a-z0-9\u00C0-\u017F\s\-_]/gi, '_').replace(/_+/g, '_').trim();
     a.download = `${fileName}_Temp.json`;
     
     a.click();
     URL.revokeObjectURL(url);
  };

  const handleImportClick = () => importInputRef.current?.click();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
             const data = JSON.parse(ev.target?.result as string);
             if (data.type === "TEMPLATE") {
                 if(data.basicInfo) {
                     setName(data.basicInfo.name || '');
                     setCustomTitle(data.basicInfo.customTitle || '');
                     setGender(data.basicInfo.gender || 'Nam');
                     setGenre(data.basicInfo.genre || GameGenre.CULTIVATION);
                     setIsNSFW(data.basicInfo.isNSFW || false);
                     setNsfwIntensity(data.basicInfo.nsfwIntensity || 'soft');
                     setWritingStyle(data.basicInfo.writingStyle || 'convert');
                     setNsfwFocus(data.basicInfo.nsfwFocus || []);
                     setAutoPronouns(!!data.basicInfo.pronounRules);
                     setAiModel(data.basicInfo.aiModel || 'gemini-3-pro-preview');
                     if (data.basicInfo.backgroundImageUrl) setBackgroundImageUrl(data.basicInfo.backgroundImageUrl);
                     if (data.basicInfo.backgroundType) setBackgroundType(data.basicInfo.backgroundType);
                     if (data.basicInfo.fontFamily) setFontFamily(data.basicInfo.fontFamily);
                     if (data.basicInfo.memoryDepth) setMemoryDepth(data.basicInfo.memoryDepth);
                 }
                 if(data.worldSettings) setSettings(data.worldSettings);
                 if(data.characterTraits) {
                     setCurrentRoot({ name: data.characterTraits.spiritualRoot, color: 'text-white', rarity: 'Unknown', weight: 0 });
                     setCurrentTalents(data.characterTraits.talents);
                     setCurrentPersonality(data.characterTraits.personality || "Bình thường");
                 }
                 if (data.gameConfig) {
                    setAutoCodex(data.gameConfig.autoCodex ?? true);
                    setLivingWorld(data.gameConfig.livingWorld ?? true);
                 }
                 alert("Đã nhập File Temp thành công!");
             } else {
                 alert("File Temp không hợp lệ!");
             }
          } catch (err) {
              console.error(err);
              alert("Lỗi đọc file!");
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleWorldChange = (field: keyof WorldSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const getHeroInfo = () => ({
    name: name,
    gender: gender,
    root: currentRoot.name,
    talents: currentTalents
  });

  // NEW: Handler for Work Title Assist
  const handleWorkTitleAssist = async () => {
      if (!workTitlePrompt.trim()) {
          alert("Vui lòng nhập tên tác phẩm hoặc ý tưởng!");
          return;
      }
      setLoadingField('workTitle');
      try {
          const result = await geminiService.generateWorldFromTitle(workTitlePrompt, genre, getHeroInfo());
          setSettings(prev => ({ ...result, referenceContext: prev.referenceContext })); // Preserve file context
      } catch (e) {
          alert("Lỗi kết nối Gemini. Vui lòng thử lại.");
      } finally {
          setLoadingField(null);
      }
  };

  const handleFieldAssist = async (field: keyof WorldSettings, label: string) => {
    setLoadingField(field);
    try {
      const context = JSON.stringify(settings);
      const result = await geminiService.generateSingleWorldField(genre, label, context, getHeroInfo());
      handleWorldChange(field, result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingField(null);
    }
  };

  const toggleNsfwFocus = (focus: NSFWFocus) => {
      setNsfwFocus(prev => 
          prev.includes(focus) 
          ? prev.filter(f => f !== focus) 
          : [...prev, focus]
      );
  };

  const handleStart = () => {
    if (!name.trim()) {
      alert("Vui lòng nhập Đạo Hiệu (Tên nhân vật)!");
      return;
    }
    
    if (isCustomGenre && !customGenreName.trim()) {
        alert("Vui lòng nhập tên Thể Loại Tùy Chỉnh!");
        return;
    }

    // Force save draft before starting
    handleSaveDraft();
    
    const finalGenre = isCustomGenre ? (customGenreName as GameGenre) : genre;
    const finalPronounRule = autoPronouns 
        ? "Hệ thống tự động xác định xưng hô phù hợp dựa trên ngữ cảnh, quan hệ và địa vị của nhân vật (Vd: Sư đồ, Huynh đệ, Kẻ thù...)."
        : "";

    onConfirm(
      { name, customTitle, genre: finalGenre, gender, avatarUrl: undefined, backgroundImageUrl: backgroundImageUrl || undefined, backgroundType, fontFamily, isNSFW, nsfwIntensity, writingStyle, nsfwFocus, pronounRules: finalPronounRule, aiModel, memoryDepth },
      settings,
      { spiritualRoot: currentRoot.name, talents: currentTalents, personality: currentPersonality },
      { autoCodex, livingWorld },
      openingLength 
    );
  };

  const renderWorldField = (field: keyof WorldSettings, label: string, placeholder: string, extra?: React.ReactNode) => (
    <div className="space-y-2 group">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
            <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider group-focus-within:text-gold-400 transition-colors">{label}</label>
            {extra}
        </div>
        <button 
          onClick={() => handleFieldAssist(field, label)}
          disabled={!!loadingField}
          className="text-[10px] flex items-center gap-1 text-gold-500 hover:text-gold-300 disabled:opacity-30 transition-colors border border-gold-500/30 px-2 py-0.5 rounded-full hover:bg-gold-500/10"
        >
          {loadingField === field ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
          AI Viết
        </button>
      </div>
      <textarea
        className="w-full h-24 bg-ink-900/40 border border-ink-700 rounded-lg p-3 text-sm text-parchment-200 focus:border-gold-500 focus:bg-ink-950/60 outline-none resize-none placeholder-ink-700 transition-all font-serif leading-relaxed shadow-inner"
        value={settings[field]}
        onChange={(e) => handleWorldChange(field, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  const currentData = getGenreData(genre);

  return (
    <div className="min-h-screen bg-transparent text-parchment-100 font-serif flex flex-col selection:bg-gold-500/30 selection:text-gold-200">
      
      {/* HEADER - Keep existing */}
      <header className="border-b border-white/5 bg-ink-950/80 backdrop-blur-md p-4 sticky top-0 z-30 shadow-2xl">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
             <button onClick={onBack} className="text-ink-400 hover:text-white transition-colors">
                <i className="fas fa-arrow-left text-lg"></i>
             </button>
             <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold-400 to-amber-600 flex items-center justify-center text-ink-950 shadow-[0_0_20px_rgba(234,179,8,0.4)] ring-2 ring-gold-500/20">
                  <i className="fas fa-yin-yang fa-spin-slow text-lg"></i>
                </div>
                <h1 className="text-xl md:text-2xl font-display font-bold text-parchment-100 tracking-wide hidden md:block">
                  Kiến Tạo <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-300 to-amber-500">Nhân Vật</span>
                </h1>
             </div>
          </div>
          <div className="flex gap-3">
             <div className="flex gap-2">
                 <button 
                    onClick={handleSaveDraft} 
                    className="text-xs text-ink-400 hover:text-jade-400 border border-ink-700 hover:border-jade-500/50 w-9 h-9 md:w-auto md:h-auto md:px-3 md:py-2 rounded-full transition-all flex items-center justify-center relative" 
                    title="Lưu Nháp Trình Duyệt (Save Local)"
                 >
                    {showSaveToast && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-jade-600 text-white text-[10px] px-2 py-1 rounded shadow animate-fade-in whitespace-nowrap">
                            Đã Lưu!
                        </div>
                    )}
                    <i className="fas fa-save md:mr-1"></i> 
                    <span className="hidden md:inline">Lưu</span>
                 </button>

                 <button 
                    onClick={handleExportTemplate} 
                    className="text-xs text-ink-400 hover:text-gold-400 border border-ink-700 hover:border-gold-500/50 w-9 h-9 md:w-auto md:h-auto md:px-3 md:py-2 rounded-full transition-all flex items-center justify-center" 
                    title="Xuất File Temp (.json)"
                 >
                    <i className="fas fa-file-export md:mr-1"></i> 
                    <span className="hidden md:inline">Xuất Temp</span>
                 </button>
                 <input type="file" ref={importInputRef} onChange={handleImportFile} accept=".json" className="hidden" />
                 <button 
                    onClick={handleImportClick} 
                    className="text-xs text-ink-400 hover:text-spirit-400 border border-ink-700 hover:border-spirit-500/50 w-9 h-9 md:w-auto md:h-auto md:px-3 md:py-2 rounded-full transition-all flex items-center justify-center" 
                    title="Nhập File Temp (.json)"
                 >
                    <i className="fas fa-file-import md:mr-1"></i> 
                    <span className="hidden md:inline">Nhập Temp</span>
                 </button>
             </div>

             <button
                onClick={handleStart}
                className="group bg-gradient-to-r from-gold-600 to-amber-600 hover:from-gold-500 hover:to-amber-500 text-white font-bold py-2 px-6 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all transform hover:scale-105 flex items-center gap-2 border border-gold-400/50"
             >
                <span className="text-sm tracking-wide">Bắt Đầu</span>
                <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8 space-y-8 animate-fade-in pb-20">
        
        {/* SECTION 1: IDENTITY */}
        {/* ... (Giữ nguyên Section 1) ... */}
        <section className="glass-panel rounded-2xl p-6 md:p-10 shadow-xl relative overflow-hidden border-t border-white/5">
           <div className="absolute top-0 right-0 p-40 bg-gold-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
           
           <h2 className="text-xl font-display font-bold text-parchment-100 mb-8 border-b border-white/5 pb-4 flex items-center gap-3">
              <i className="fas fa-user-astronaut text-gold-400"></i>
              Hồ Sơ Luân Hồi
           </h2>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {/* COL 1: Basic Info & BG */}
                 <div className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">Đạo Hiệu</label>
                            <div className="relative">
                                <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-ink-950/40 border border-ink-700 rounded-lg pl-3 pr-3 py-3 text-parchment-100 focus:border-gold-500 focus:bg-ink-950/60 outline-none transition-all placeholder-ink-600 font-display shadow-inner"
                                placeholder="Tên nhân vật..."
                                />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">Tên File Save (Tùy chọn)</label>
                            <div className="relative">
                                <input
                                type="text"
                                value={customTitle}
                                onChange={(e) => setCustomTitle(e.target.value)}
                                className="w-full bg-ink-950/40 border border-ink-700 rounded-lg pl-3 pr-3 py-3 text-parchment-100 focus:border-gold-500 focus:bg-ink-950/60 outline-none transition-all placeholder-ink-600 font-display shadow-inner"
                                placeholder="Vd: Thế giới One Piece..."
                                />
                            </div>
                         </div>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">Giới Tính</label>
                        <div className="flex bg-ink-950/40 p-1 rounded-lg border border-ink-700 shadow-inner">
                          {['Nam', 'Nữ'].map((g) => (
                            <button
                              key={g}
                              onClick={() => setGender(g)}
                              className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
                                gender === g 
                                  ? 'bg-ink-800 text-gold-400 shadow-sm border border-ink-600' 
                                  : 'text-ink-600 hover:text-ink-300'
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                     </div>

                     <div className="space-y-2">
                         <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block mb-1">Hình Nền / Video (Tùy chọn)</label>
                         <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <input 
                                    type="text" 
                                    placeholder="URL Ảnh/Video..." 
                                    value={backgroundImageUrl}
                                    onChange={(e) => setBackgroundImageUrl(e.target.value)}
                                    className="w-full bg-ink-950 border border-ink-700 rounded-lg px-3 py-2 text-xs text-parchment-200 outline-none focus:border-gold-500 pr-12"
                                />
                                <div className="absolute right-0 top-0 h-full flex items-center pr-1">
                                    <button 
                                        onClick={() => setBackgroundType(prev => prev === 'image' ? 'video' : 'image')}
                                        className={`text-[8px] font-bold px-1 py-0.5 rounded ${backgroundType === 'video' ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/50' : 'bg-ink-800 text-ink-500 border border-ink-700'}`}
                                        title={backgroundType === 'video' ? "Đang chọn chế độ Video" : "Đang chọn chế độ Ảnh"}
                                    >
                                        {backgroundType === 'video' ? 'VID' : 'IMG'}
                                    </button>
                                </div>
                            </div>
                            <button 
                                onClick={handleBgClick}
                                className="bg-ink-800 border border-ink-700 text-ink-400 px-3 rounded-lg hover:text-gold-400 hover:border-gold-500 transition-colors"
                            >
                                <i className="fas fa-upload text-xs"></i>
                            </button>
                            <input type="file" ref={bgInputRef} onChange={handleBgFileChange} accept="image/*,video/*" className="hidden" />
                         </div>
                     </div>

                      {/* --- FONT SELECTION --- */}
                     <div className="space-y-2">
                         <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block mb-1">Font Chữ Hiển Thị</label>
                         <div className="grid grid-cols-2 gap-2">
                             {FONTS.map(f => (
                                 <button 
                                     key={f.value} 
                                     onClick={() => setFontFamily(f.value)} 
                                     className={`p-2 rounded-lg border text-xs text-left transition-all ${fontFamily === f.value ? 'bg-ink-800 border-gold-500 text-gold-400 shadow-sm' : 'bg-ink-950/40 border-ink-700 text-ink-400 hover:border-ink-500'} ${f.class}`} 
                                     style={{ fontFamily: f.value }}
                                 >
                                     {f.name}
                                 </button>
                             ))}
                         </div>
                     </div>

                      {/* --- AI MODEL & MEMORY SELECTION --- */}
                     <div className="space-y-2 mt-2">
                         <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block mb-1">Cấu Hình AI</label>
                         <div className="grid grid-cols-3 gap-2">
                             {[
                                 { id: 'gemini-3-pro-preview', label: 'Pro 3.0', sub: 'Thông Minh Nhất', icon: 'fa-brain', color: 'text-purple-400' },
                                 { id: 'gemini-2.5-flash', label: 'Flash 2.5', sub: 'Cân Bằng', icon: 'fa-bolt', color: 'text-yellow-400' },
                                 { id: 'gemini-flash-lite-latest', label: 'Flash Lite', sub: 'Siêu Tốc', icon: 'fa-feather', color: 'text-blue-400' },
                             ].map((m) => (
                                 <button
                                     key={m.id}
                                     onClick={() => setAiModel(m.id)}
                                     className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border transition-all ${
                                         aiModel === m.id
                                         ? 'bg-ink-800 border-gold-500/50 shadow-sm'
                                         : 'bg-ink-950/40 border-ink-700 hover:border-ink-500'
                                     }`}
                                 >
                                     <i className={`fas ${m.icon} ${m.color} text-sm mb-1`}></i>
                                     <span className={`text-[10px] font-bold ${aiModel === m.id ? 'text-parchment-100' : 'text-ink-500'}`}>{m.label}</span>
                                     <span className="text-[8px] text-ink-600">{m.sub}</span>
                                 </button>
                             ))}
                         </div>

                         {/* SUPER MEMORY TOGGLE */}
                         <div className={`mt-3 flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${memoryDepth === 'high' ? 'bg-jade-900/30 border-jade-500/50 shadow-[0_0_15px_rgba(34,197,94,0.15)]' : 'bg-ink-950/40 border-ink-700'}`}>
                             <div>
                                 <div className={`text-xs font-bold flex items-center gap-2 transition-colors ${memoryDepth === 'high' ? 'text-jade-400' : 'text-parchment-200'}`}>
                                     <i className="fas fa-microchip"></i> 
                                     SIÊU TRÍ NHỚ (SUPER MEMORY)
                                 </div>
                                 <div className="text-[9px] text-ink-500 mt-1 leading-relaxed">
                                     {memoryDepth === 'high' 
                                        ? "AI sẽ nhớ lại chi tiết từ quá khứ rất xa (tăng độ chính xác & nhất quán)." 
                                        : "Chế độ tiêu chuẩn. AI chỉ nhớ các sự kiện gần đây."}
                                 </div>
                             </div>
                             <button
                                 onClick={() => setMemoryDepth(prev => prev === 'standard' ? 'high' : 'standard')}
                                 className={`w-10 h-5 rounded-full relative transition-colors ${memoryDepth === 'high' ? 'bg-jade-500' : 'bg-ink-700'}`}
                             >
                                 <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${memoryDepth === 'high' ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                             </button>
                         </div>
                     </div>
                 </div>

                 {/* COL 2: Genre & Style */}
                 {/* ... (rest of the file remains similar) */}
                 <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider flex justify-between">
                            <span>Thế Giới Khởi Đầu / Thể Loại</span>
                            <span className="text-[8px] italic text-ink-500">Cuộn để xem thêm</span>
                        </label>
                        {/* Compact Scrollable List */}
                        <div className="flex overflow-x-auto gap-2.5 pb-2 scrollbar-thin scrollbar-thumb-ink-700 scrollbar-track-transparent">
                          {Object.values(GameGenre).map(g => (
                             <button
                               key={g}
                               onClick={() => handleGenreChange(g)}
                               className={`px-4 py-2 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap flex-shrink-0 ${
                                 genre === g && !isCustomGenre
                                 ? 'border-gold-500/50 bg-gold-500/10 text-gold-300 shadow-[0_0_15px_rgba(234,179,8,0.1)]' 
                                 : 'border-ink-800 bg-ink-950/40 text-ink-500 hover:border-ink-600 hover:text-ink-300'
                               }`}
                             >
                               {g}
                             </button>
                          ))}
                          {/* Custom Button */}
                          <button
                               onClick={handleCustomGenreSelect}
                               className={`px-4 py-2 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-2 ${
                                 isCustomGenre
                                 ? 'border-arcane-500/50 bg-arcane-500/10 text-arcane-300 shadow-[0_0_15px_rgba(168,85,247,0.1)]' 
                                 : 'border-ink-800 bg-ink-950/40 text-ink-500 hover:border-arcane-600 hover:text-arcane-300'
                               }`}
                             >
                               <i className="fas fa-edit"></i> Tùy Chỉnh
                           </button>
                        </div>

                        {/* Custom Genre Input */}
                        {isCustomGenre && (
                             <div className="mt-2 animate-slide-up">
                                 <input 
                                    type="text"
                                    value={customGenreName}
                                    onChange={(e) => setCustomGenreName(e.target.value)}
                                    placeholder="Nhập tên thể loại mong muốn... (Vd: Cyberpunk x Tu Tiên, Harry Potter...)"
                                    className="w-full bg-ink-950/40 border border-arcane-500/50 rounded-lg px-4 py-2 text-sm text-parchment-100 focus:bg-ink-950/60 outline-none placeholder-ink-600 font-serif"
                                    autoFocus
                                 />
                                 <p className="text-[9px] text-ink-500 mt-1 italic">
                                     *Hệ thống dữ liệu (Căn cơ, Thiên phú) sẽ dựa trên Preset: <span className="text-gold-500 font-bold">{genre}</span>. Hãy chọn Preset gần giống nhất trước khi Tùy Chỉnh.
                                 </p>
                             </div>
                        )}
                     </div>
                     
                     {/* COMPACT WRITING STYLE SELECTION */}
                     <div className="space-y-2">
                         <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">Phong Cách Viết</label>
                         <div className="flex bg-ink-950/40 p-1 rounded-lg border border-ink-700 shadow-inner">
                             {[
                                 { id: 'convert', label: 'Convert (Hán Việt)' },
                                 { id: 'smooth', label: 'Văn Dịch' },
                                 { id: 'anime', label: 'Anime / Light Novel' }
                             ].map((s) => (
                                 <button
                                     key={s.id}
                                     onClick={() => setWritingStyle(s.id as WritingStyle)}
                                     className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                                         writingStyle === s.id 
                                         ? 'bg-ink-800 text-gold-400 shadow-sm border border-ink-600' 
                                         : 'text-ink-600 hover:text-ink-300'
                                     }`}
                                 >
                                     {s.label}
                                 </button>
                             ))}
                         </div>
                     </div>

                     {/* PRONOUN RULES TOGGLE */}
                     <div className="space-y-2">
                         <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider flex justify-between items-center">
                             <span>Thống Nhất Xưng Hô (AI Tự Động)</span>
                         </label>
                         <div className="flex items-center justify-between bg-ink-950/40 p-3 rounded-lg border border-ink-700">
                             <div className="text-xs text-ink-400 italic">
                                 {autoPronouns ? "AI sẽ tự xác định xưng hô dựa trên ngữ cảnh và quan hệ." : "Sử dụng xưng hô mặc định của hệ thống."}
                             </div>
                             <button 
                                 onClick={() => setAutoPronouns(!autoPronouns)}
                                 className={`w-12 h-6 rounded-full border transition-all relative flex-shrink-0 ${
                                     autoPronouns ? 'bg-gold-600 border-gold-400' : 'bg-ink-900 border-ink-600'
                                 }`}
                             >
                                 <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${
                                     autoPronouns ? 'left-7' : 'left-1'
                                 }`}></div>
                             </button>
                         </div>
                     </div>
                 </div>

                 {/* NSFW Toggle (Full Width) */}
                 <div className="md:col-span-2 pt-4 border-t border-white/5">
                     <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-crimson-400 flex items-center gap-2">
                                <i className="fas fa-exclamation-triangle"></i>
                                Chế độ 18+ (NSFW)
                            </span>
                            <span className="text-[10px] text-ink-500">Bật nội dung người lớn, ngôn từ thô tục và cảnh nóng.</span>
                        </div>
                        <button
                            onClick={() => setIsNSFW(!isNSFW)}
                            className={`w-14 h-8 rounded-full border transition-all relative ${
                                isNSFW 
                                ? 'bg-crimson-900 border-crimson-500' 
                                : 'bg-ink-950 border-ink-700'
                            }`}
                        >
                            <div className={`w-6 h-6 rounded-full absolute top-1 transition-all ${
                                isNSFW 
                                ? 'left-7 bg-crimson-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' 
                                : 'left-1 bg-ink-600'
                            }`}></div>
                        </button>
                     </div>
                     
                     {/* NSFW INTENSITY SELECTOR */}
                     {isNSFW && (
                         <div className="mt-4 bg-crimson-900/10 border border-crimson-500/20 rounded-lg p-3 animate-slide-up">
                             <div className="text-[10px] font-bold text-crimson-300 uppercase tracking-wider mb-2">Mức độ chi tiết</div>
                             <div className="grid grid-cols-2 gap-2 mb-3">
                                 <button
                                     onClick={() => setNsfwIntensity('soft')}
                                     className={`py-2 px-3 rounded text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                                         nsfwIntensity === 'soft' 
                                         ? 'bg-crimson-500/20 text-crimson-200 border-crimson-500/50' 
                                         : 'bg-ink-900/50 text-ink-500 border-transparent hover:text-crimson-300'
                                     }`}
                                 >
                                     <i className="fas fa-feather-alt"></i> Vừa phải (Romantic)
                                 </button>
                                 <button
                                     onClick={() => setNsfwIntensity('extreme')}
                                     className={`py-2 px-3 rounded text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                                         nsfwIntensity === 'extreme' 
                                         ? 'bg-crimson-600 text-white border-crimson-400 shadow-[0_0_10px_rgba(220,38,38,0.4)]' 
                                         : 'bg-ink-900/50 text-ink-500 border-transparent hover:text-crimson-300'
                                     }`}
                                 >
                                     <i className="fas fa-fire"></i> Cực hạn (Hardcore)
                                 </button>
                             </div>

                             {/* NSFW FOCUS CHECKBOXES */}
                             {nsfwIntensity === 'extreme' && (
                                <div className="mt-3 pt-3 border-t border-crimson-500/20">
                                    <div className="text-[9px] font-bold text-crimson-300 uppercase tracking-wider mb-2">Trọng tâm miêu tả (Chọn nhiều)</div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {[
                                            { id: 'body', label: 'Cơ Thể', icon: 'fa-venus' },
                                            { id: 'emotion', label: 'Cảm Xúc', icon: 'fa-heart-pulse' },
                                            { id: 'dialogue', label: 'Lời Thoại', icon: 'fa-comments' },
                                            { id: 'action', label: 'Hành Động', icon: 'fa-hand-rock' },
                                            { id: 'vulgar', label: 'Cực Dâm & Trần Trụi', icon: 'fa-pepper-hot' },
                                            { id: 'roleplay', label: 'Giữ Đúng Tính Cách', icon: 'fa-user-check' },
                                        ].map((item) => (
                                            <div 
                                                key={item.id}
                                                onClick={() => toggleNsfwFocus(item.id as NSFWFocus)}
                                                className={`
                                                    cursor-pointer p-2 rounded border text-xs font-bold flex items-center justify-center gap-2 transition-all
                                                    ${nsfwFocus.includes(item.id as NSFWFocus) 
                                                        ? 'bg-crimson-500/30 border-crimson-400 text-crimson-100' 
                                                        : 'bg-ink-900/50 border-ink-800 text-ink-500 hover:text-crimson-300'}
                                                `}
                                            >
                                                <i className={`fas ${item.icon}`}></i>
                                                {item.label}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 text-[10px] text-ink-500 italic text-center">
                                       *Chọn "Giữ Đúng Tính Cách" để AI không biến nhân vật thành bạo dâm/tàn nhẫn vô lý.
                                    </div>
                                </div>
                             )}

                             <div className="mt-2 text-[10px] text-crimson-400/80 italic text-center leading-relaxed pt-2">
                                 {nsfwIntensity === 'extreme' 
                                    ? "⚠️ CẢNH BÁO: Dùng từ lóng thô tục (l*n, c*c, đ*t...), mô tả giải phẫu chi tiết. Người chơi kiểm soát hoàn toàn việc kết thúc (xuất tinh)." 
                                    : "Tập trung vào cốt truyện hơn (mô tả rõ cảnh nóng nhưng tập trung vào cảm xúc và cốt truyện)."}
                             </div>
                         </div>
                     )}
                 </div>
           </div>
        </section>

        {/* SECTION 2 & 3 (Attributes & World - Same as before) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
               <div className="glass-panel rounded-2xl p-6 shadow-xl sticky top-24 border-t border-white/5">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                     <h2 className="text-lg font-display font-bold text-parchment-200">
                        Thiên Phú & Tính Cách
                     </h2>
                     <div className="flex gap-2">
                        <button 
                           onClick={() => setIsEditingAttributes(!isEditingAttributes)}
                           className={`text-[10px] uppercase tracking-wider font-bold border px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 ${isEditingAttributes ? 'bg-gold-500 text-ink-950 border-gold-500' : 'text-gold-400 border-gold-500/30 hover:bg-gold-500/10'}`}
                           title="Tự nhập tay các chỉ số"
                        >
                           <i className={`fas ${isEditingAttributes ? 'fa-check' : 'fa-pen'}`}></i>
                           {isEditingAttributes ? 'Xong' : 'Tự Chỉnh'}
                        </button>
                     </div>
                  </div>

                  <div className="space-y-4">
                     {/* Personality Card */}
                     <div className={`
                        p-6 rounded-xl border relative overflow-hidden group transition-all shadow-lg
                        bg-gradient-to-br from-ink-900 to-ink-950 border-ink-800 hover:border-crimson-500/40
                     `}>
                        <div className="text-[9px] text-ink-500 uppercase tracking-widest mb-2 font-bold">Tính Cách</div>
                        
                        {isEditingAttributes ? (
                             <input 
                               value={currentPersonality}
                               onChange={(e) => setCurrentPersonality(e.target.value)}
                               className="w-full bg-ink-950/50 border border-ink-700 rounded p-2 text-center font-bold font-display text-lg text-crimson-400 focus:border-crimson-500 outline-none placeholder-ink-700 relative z-20"
                               placeholder="Nhập tính cách..."
                            />
                        ) : (
                            <div className="text-lg font-bold font-display text-crimson-400 transition-all leading-tight">
                               {currentPersonality}
                            </div>
                        )}
                     </div>

                     {/* Talents Card */}
                     <div className={`
                        p-6 rounded-xl border relative overflow-hidden group transition-all shadow-lg
                        bg-gradient-to-br from-ink-900 to-ink-950 border-ink-800 hover:border-arcane-500/40
                     `}>
                        <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                            <i className="fas fa-star text-6xl text-arcane-500"></i>
                        </div>

                        <div className="text-[9px] text-ink-500 uppercase tracking-widest mb-4 font-bold">{currentData.talentLabel}</div>
                        
                        {isEditingAttributes ? (
                             <textarea 
                               value={currentTalents.join(", ")}
                               onChange={(e) => setCurrentTalents(e.target.value.split(",").map(t => t.trim()))}
                               className="w-full h-24 bg-ink-950/50 border border-ink-700 rounded p-2 text-sm text-arcane-300 focus:border-arcane-500 outline-none placeholder-ink-700 resize-none relative z-20 font-medium leading-relaxed"
                               placeholder="Nhập các thiên phú, cách nhau bởi dấu phẩy..."
                            />
                        ) : (
                            <div className="flex flex-wrap gap-2">
                               {currentTalents.map((t, i) => (
                                  <span key={i} className="text-[10px] px-2.5 py-1.5 bg-ink-950 border border-ink-700 rounded text-arcane-300 font-medium">
                                     {t}
                                  </span>
                               ))}
                            </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
               <div className="glass-panel rounded-2xl p-6 shadow-xl border-t border-white/5">
                   <div className="mb-6 pb-4 border-b border-white/5">
                       <h2 className="text-xl font-display font-bold text-parchment-200">
                          <i className="fas fa-globe-asia text-gold-500 mr-3"></i> Kiến Tạo Thế Giới
                       </h2>
                       <p className="text-xs text-ink-500 mt-1 pl-8">Thiết lập bối cảnh cho hành trình của bạn.</p>
                   </div>

                   {/* NEW: DEEP TRAINING MODULE */}
                   <div className="bg-ink-950/60 border border-arcane-500/30 rounded-xl p-5 mb-8 relative overflow-hidden group shadow-lg">
                      <div className="absolute top-0 right-0 p-20 bg-arcane-500/5 rounded-full blur-2xl pointer-events-none"></div>
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-arcane-400 to-spirit-400"></div>
                      
                      <div className="flex justify-between items-start mb-4">
                          <div>
                              <h3 className="text-sm font-bold text-arcane-300 uppercase tracking-widest flex items-center gap-2">
                                  <i className="fas fa-brain animate-pulse"></i> Module Train AI Chuyên Sâu
                              </h3>
                              <p className="text-[10px] text-ink-400 mt-1 max-w-md">
                                  Nạp dữ liệu văn bản lớn (Lore, Truyện mẫu, Bối cảnh chi tiết...) để AI học theo phong cách viết và ghi nhớ thông tin thế giới.
                              </p>
                          </div>
                          
                          {settings.referenceContext && (
                              <span className="bg-arcane-500/20 text-arcane-300 px-2 py-1 rounded text-[9px] font-bold border border-arcane-500/30 flex items-center gap-1">
                                  <i className="fas fa-check-circle"></i> Đã Nạp
                              </span>
                          )}
                      </div>

                      <div className="bg-ink-900/50 rounded-lg p-3 border border-white/5 flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                             <input 
                                type="file" 
                                accept=".txt"
                                ref={refFileInputRef}
                                onChange={handleTrainingFileChange}
                                className="hidden"
                             />
                             <button 
                                onClick={() => refFileInputRef.current?.click()}
                                className="bg-arcane-900/50 hover:bg-arcane-800 text-arcane-200 px-4 py-2 rounded border border-arcane-700 hover:border-arcane-500 font-bold transition-all flex items-center gap-2 text-xs shadow-md group-hover:shadow-arcane-500/10"
                             >
                                <i className="fas fa-file-upload"></i>
                                {settings.referenceContext ? "Chọn File Khác" : "Tải File .txt (Max 60k ký tự)"}
                             </button>
                             
                             {settings.referenceContext && (
                                 <button onClick={handleClearTrainingData} className="text-crimson-400 hover:text-white transition-colors text-xs px-2">
                                     <i className="fas fa-trash-alt"></i> Xóa
                                 </button>
                             )}
                          </div>

                          {/* Data Usage Bar */}
                          <div className="w-full bg-ink-800 rounded-full h-1.5 mt-1 overflow-hidden relative">
                              <div 
                                  className={`h-full transition-all duration-500 ${trainingDataSize > 50000 ? 'bg-crimson-500' : 'bg-arcane-500'}`} 
                                  style={{ width: `${Math.min((trainingDataSize / 60000) * 100, 100)}%` }}
                              ></div>
                          </div>
                          <div className="flex justify-between text-[8px] text-ink-500 font-bold uppercase tracking-wider">
                              <span>Dữ liệu: {trainingDataSize.toLocaleString()} / 60,000 ký tự</span>
                              <span>{trainingDataSize > 0 ? "Sẵn sàng train" : "Chưa có dữ liệu"}</span>
                          </div>
                      </div>
                   </div>
                   
                   {/* NEW: Work Title Assist */}
                   <div className="bg-ink-950/40 border border-spirit-500/30 rounded-xl p-5 mb-8 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-spirit-500/50"></div>
                      <label className="block text-[10px] font-bold text-spirit-400 uppercase tracking-wider mb-3">
                         <i className="fas fa-film mr-2"></i> Nhập Tên Tác Phẩm / Anime / Game (+ Ý tưởng)
                      </label>
                      <div className="flex gap-2">
                         <input 
                            type="text"
                            value={workTitlePrompt}
                            onChange={(e) => setWorkTitlePrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleWorkTitleAssist()}
                            placeholder="Vd: Naruto (Main là thành viên Akatsuki), Harry Potter, One Piece..."
                            className="flex-1 bg-ink-900/80 border border-ink-700 rounded-lg px-4 py-2 text-sm focus:border-spirit-500/50 outline-none text-parchment-200 placeholder-ink-600 transition-colors font-serif shadow-inner"
                         />
                         <button 
                            onClick={handleWorkTitleAssist}
                            disabled={loadingField === 'workTitle'}
                            className="bg-ink-800 hover:bg-spirit-900/30 text-parchment-200 px-5 rounded-lg border border-ink-700 font-bold transition-colors disabled:opacity-50 min-w-[100px] flex items-center justify-center gap-2"
                         >
                            {loadingField === 'workTitle' ? <i className="fas fa-spinner fa-spin text-spirit-400"></i> : <i className="fas fa-robot text-spirit-400"></i>}
                            <span className="hidden md:inline text-xs">AI Tái Hiện</span>
                         </button>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="col-span-1 md:col-span-2">
                           {renderWorldField('worldContext', 'Bối Cảnh & Địa Lý', 'Mô tả không gian, thời gian, lịch sử...')}
                       </div>
                       
                       {genre === GameGenre.ANIME_CROSSOVER && (
                           <div className="col-span-1 md:col-span-2 bg-purple-900/20 p-4 rounded-xl border border-purple-500/30">
                               {renderWorldField('crossoverWorlds', 'Các Thế Giới Muốn Gộp', 'Vd: Naruto x One Piece x Bleach, Attack on Titan x Gundam...')}
                           </div>
                       )}

                       {renderWorldField('openingStory', 'Cốt Truyện Khởi Đầu', 'Mô tả cụ thể hoàn cảnh bắt đầu của nhân vật (Ví dụ: Tỉnh dậy trong một ngôi miếu hoang...)', 
                           <div className="flex flex-wrap items-center gap-2 mt-2">
                               <span className="text-[10px] font-bold text-ink-500 uppercase mr-2">Độ dài mở đầu:</span>
                               {[
                                   { val: 0, label: 'Mặc định' },
                                   { val: 400, label: '400 chữ' },
                                   { val: 600, label: '600 chữ' },
                                   { val: 1200, label: '1200 chữ (Cố định)' },
                                   { val: 1500, label: 'Đại Tự Sự (1500+)' }
                               ].map(opt => (
                                   <button
                                       key={opt.val}
                                       onClick={() => setOpeningLength(opt.val)}
                                       className={`text-[9px] px-2 py-1 rounded border transition-all font-bold ${
                                           openingLength === opt.val 
                                           ? 'bg-gold-500 text-black border-gold-500' 
                                           : 'bg-ink-900 text-ink-400 border-ink-700 hover:text-gold-400'
                                       }`}
                                   >
                                       {opt.label}
                                   </button>
                               ))}
                           </div>
                       )}
                       {renderWorldField('plotDirection', 'Hướng Đi Cốt Truyện', 'Mục tiêu chính, kẻ thù định mệnh...')}
                       {renderWorldField('majorFactions', 'Các Thế Lực Lớn', 'Tông môn, Triều đình, Tổ chức...')}
                       {renderWorldField('keyNpcs', 'Nhân Vật Quan Trọng', 'Sư phụ, hồng nhan, kẻ thù...')}
                   </div>

                   {/* --- NEW SECTION: AUTO CODEX TOGGLE ONLY --- */}
                   <div className="mt-8 pt-6 border-t border-white/5">
                        <div className="bg-ink-900/30 border border-ink-700/50 rounded-xl p-5 flex items-center justify-between">
                            <div>
                                <div className="text-sm font-bold text-parchment-200 flex items-center gap-2">
                                    <i className="fas fa-book-open text-gold-500"></i> Tự động ghi Wiki (Auto Codex)
                                </div>
                                <div className="text-[10px] text-ink-500 mt-1">
                                    Hệ thống sẽ tự động phát hiện NPC/Địa danh mới và lưu vào Bách khoa toàn thư.
                                </div>
                            </div>
                            <button
                                onClick={() => setAutoCodex(!autoCodex)}
                                className={`w-12 h-6 rounded-full relative transition-colors ${autoCodex ? 'bg-gold-500' : 'bg-ink-700'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${autoCodex ? 'translate-x-7' : 'translate-x-1'}`}></div>
                            </button>
                        </div>
                   </div>

               </div>
            </div>
        </div>

      </main>
    </div>
  );
};