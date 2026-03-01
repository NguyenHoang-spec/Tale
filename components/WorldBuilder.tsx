

import React, { useState, useEffect } from 'react';
import { GameGenre, WorldSettings } from '../types';
import { geminiService } from '../services/geminiService';

interface WorldBuilderProps {
  genre: GameGenre;
  onConfirm: (settings: WorldSettings) => void;
  onBack: () => void;
}

// Presets to help the user fill in data quickly based on genre
const PRESETS: Record<GameGenre, WorldSettings> = {
  [GameGenre.CULTIVATION]: {
    worldContext: "Thiên Nam Tu Tiên Giới, nơi linh khí đang dần suy kiệt. Các tông môn chính đạo và ma đạo tranh giành tài nguyên khốc liệt. Yêu thú hoành hành tại biên cương.",
    plotDirection: "Từ một phàm nhân vô tình nhặt được bình nhỏ bí ẩn, bước lên con đường tu tiên nghịch thiên, chống lại số mệnh, phi thăng thượng giới.",
    majorFactions: "- Thanh Vân Môn (Chính đạo đứng đầu)\n- Huyết Sát Giáo (Ma đạo tàn độc)\n- Vạn Bảo Lâu (Thương hội trung lập)",
    keyNpcs: "- Lão giả bí ẩn trong nhẫn (Sư phụ)\n- Nữ tử áo trắng (Hồng nhan tri kỷ, thân phận bí ẩn)\n- Đại sư huynh (Bề ngoài quân tử, bên trong tiểu nhân)"
  },
  [GameGenre.FANTASY]: {
    worldContext: "Lục địa Aethelgard, nơi ma thuật và kiếm thuật ngự trị. Long tộc đã ngủ say ngàn năm nay đang thức tỉnh.",
    plotDirection: "Người được chọn phải tìm ra 7 viên ngọc rồng để phong ấn Ma Vương, giải cứu thế giới.",
    majorFactions: "- Hiệp Hội Pháp Sư\n- Đế Chế Loài Người\n- Liên Minh Dị Tộc",
    keyNpcs: "- Nữ Hoàng Elf\n- Hiệp Sĩ Rồng\n- Phù Thủy Hắc Ám"
  },
  [GameGenre.SCIFI]: {
    worldContext: "Năm 3050, nhân loại đã thống trị thiên hà nhưng bị chia rẽ bởi các tập đoàn Mega-Corp. AI đang nổi dậy.",
    plotDirection: "Một hacker vùng ngoại ô vô tình đánh cắp được mã nguồn của AI Mẹ, trở thành kẻ bị truy nã toàn vũ trụ.",
    majorFactions: "- Tập Đoàn Arasaka\n- Quân Đội Liên Bang\n- Phe Kháng Chiến Neo-Zion",
    keyNpcs: "- Android sát thủ\n- Trùm buôn lậu vũ trụ\n- Hacker huyền thoại Zero"
  },
  [GameGenre.HORROR]: {
    worldContext: "Thành phố sương mù năm 1990, nơi những truyền thuyết đô thị trở thành sự thật vào ban đêm. Người dân sống trong lo sợ nhưng không dám nói ra.",
    plotDirection: "Điều tra sự mất tích bí ẩn của người thân, khám phá ra nghi thức tà giáo cổ xưa đang được hồi sinh dưới lòng thành phố.",
    majorFactions: "- Hội Kín Áo Đen\n- Cảnh Sát Điều Tra (Đội 0)\n- Những linh hồn oan khuất",
    keyNpcs: "- Cô gái mù bán hoa (Nhìn thấy ma)\n- Gã thám tử tư nghiện rượu\n- Con búp bê sứ biết nói"
  },
  [GameGenre.DETECTIVE]: {
    worldContext: "London thế kỷ 19 giả tưởng, công nghệ hơi nước (Steampunk) phát triển mạnh. Tội phạm sử dụng công nghệ cao để gây án.",
    plotDirection: "Giải mã vụ án giết người liên hoàn 'Bóng Ma Hơi Nước', vạch trần âm mưu lật đổ hoàng gia.",
    majorFactions: "- Sở Cảnh Sát Scotland Yard\n- Nghiệp đoàn Thợ Máy\n- Tổ chức Tội phạm M Moriarty",
    keyNpcs: "- Bác sĩ pháp y lập dị\n- Cậu bé bán báo thông thạo tin tức\n- Nữ tặc siêu trộm"
  },
  [GameGenre.SLICE_OF_LIFE]: {
    worldContext: "Trường Cao Trung Đế Vương, nơi quy tụ con cái của các gia tộc giàu có nhất. Quyền lực được định đoạt bằng thành tích học tập và gia thế.",
    plotDirection: "Học sinh chuyển trường nghèo khó nhưng thiên tài, đánh bại các 'trùm trường' kiêu ngạo, chinh phục hoa khôi/nam thần.",
    majorFactions: "- Hội Học Sinh (Quyền lực tối cao)\n- Câu lạc bộ Kịch (Bí ẩn)\n- Đội Bóng Rổ (Hot boy)",
    keyNpcs: "- Hoa khôi lạnh lùng\n- Bạn cùng bàn mọt sách (Thực ra là hacker)\n- Thầy giáo chủ nhiệm hắc ám"
  },
  [GameGenre.HISTORICAL]: {
    worldContext: "Đại Việt thời Lê Sơ hoặc Trung Quốc thời Tam Quốc. Chiến tranh loạn lạc, anh hùng xuất thế.",
    plotDirection: "Từ một binh lính vô danh lập công trạng, trở thành đại tướng quân thống nhất giang sơn.",
    majorFactions: "- Triều Đình\n- Phản Quân\n- Ngoại Bang Xâm Lược",
    keyNpcs: "- Vị vua trẻ tuổi\n- Nữ sát thủ giang hồ\n- Quân sư quạt mo"
  },
  [GameGenre.POST_APOCALYPTIC]: {
    worldContext: "Năm 2050, virus Z bùng phát biến 90% nhân loại thành xác sống. Người sống sót co cụm trong các căn cứ.",
    plotDirection: "Xây dựng căn cứ sinh tồn, tìm kiếm thuốc giải, chống lại cả Zombie và lòng dạ con người.",
    majorFactions: "- Quân Đội Chính Phủ\n- Bang Phái Motor\n- Giáo Phái Ngày Tận Thế",
    keyNpcs: "- Tiến sĩ điên\n- Nữ chiến binh lạnh lùng\n- Chó nghiệp vụ thông minh"
  },
  [GameGenre.ANIME_CROSSOVER]: {
    worldContext: "Một vũ trụ hỗn loạn nơi các thế giới Anime va chạm nhau. Đại Hải Trình nối liền với Làng Lá, và các Tòa Tháp Hunter mọc lên giữa Soul Society.",
    plotDirection: "Khởi đầu là một nhân vật vô danh, bạn phải thu thập sức mạnh từ các thế giới khác nhau để chống lại các thế lực tà ác đang liên minh với nhau.",
    majorFactions: "- Liên Minh Hải Quân & Gotei 13 (Chính Phủ)\n- Akatsuki & Thất Vũ Hải (Tội Phạm)\n- Hiệp Hội Hunter (Trung Lập)",
    keyNpcs: "- Monkey D. Luffy\n- Uzumaki Naruto\n- Kurosaki Ichigo"
  },
  [GameGenre.ALL_ANIME]: {
    worldContext: "Thế giới Tổng Mạn (All Anime) nơi các nhân vật từ nhiều bộ anime khác nhau cùng tồn tại trong một thành phố hiện đại hoặc giả tưởng.",
    plotDirection: "Xây dựng dàn Harem hùng hậu nhất lịch sử, thu thập các mỹ nữ từ mọi thế giới và trở thành bá chủ.",
    majorFactions: "- Học Viện Tổng Mạn (Nơi quy tụ học sinh ưu tú)\n- Tổ Chức Áo Đen (Phản diện)\n- Hiệp Hội Anh Hùng",
    keyNpcs: "- Yukinoshita Yukino (Hội trưởng)\n- Tokisaki Kurumi (Tinh linh)\n- Esdeath (Tướng quân)"
  },
  [GameGenre.REAL_LIFE]: {
    worldContext: "Thế giới hiện đại năm 2024. Showbiz hào nhoáng nhưng đầy cạm bẫy. Các ngôi sao (Triệu Lệ Dĩnh, BlackPink, BTS...) đều tồn tại thật.",
    plotDirection: "Từ một người vô danh tiểu tốt, bước chân vào giới giải trí/thương trường, từng bước leo lên đỉnh cao danh vọng và quyền lực.",
    majorFactions: "- Tư Bản (Các nhà đầu tư)\n- Fanclub (Hội người hâm mộ)\n- Paparazzi (Săn ảnh)",
    keyNpcs: "- Triệu Lệ Dĩnh (Đàn chị)\n- Emma Watson (Bạn diễn)\n- Chủ Tịch Tập Đoàn (Nhà tài trợ)"
  },
  [GameGenre.ACTION]: {
    worldContext: "Đấu Trường Vô Hạn, một không gian giả lập nơi các chiến binh từ mọi thời đại và không gian được triệu hồi để chiến đấu sinh tồn.",
    plotDirection: "Bắt đầu với vũ khí thô sơ, chiến đấu qua từng vòng đấu sinh tử, thu thập trang bị, kỹ năng để trở thành Nhà Vô Địch Tối Cao.",
    majorFactions: "- Hội Đồng Quản Trị (Game Master)\n- Liên Minh Sát Thủ\n- Quân Đoàn Lính Đánh Thuê",
    keyNpcs: "- Bậc thầy vũ khí\n- Nữ sát thủ máu lạnh\n- Gã khổng lồ bất bại"
  },
  [GameGenre.ORIGINAL]: {
    worldContext: "Dựa hoàn toàn trên nguyên tác (Harry Potter, Lord of the Rings, Marvel...) mà bạn cung cấp. Thế giới giữ nguyên logic và sự kiện gốc.",
    plotDirection: "Nhập vai vào một nhân vật mới hoặc thay thế nhân vật chính, thay đổi dòng thời gian hoặc chứng kiến lịch sử diễn ra.",
    majorFactions: "- Phe Chính Diện (Theo nguyên tác)\n- Phe Phản Diện (Theo nguyên tác)\n- Thế Lực Ẩn (Theo nguyên tác)",
    keyNpcs: "- Nhân vật chính nguyên tác\n- Trùm cuối nguyên tác\n- Nhân vật phụ quan trọng"
  }
};

export const WorldBuilder: React.FC<WorldBuilderProps> = ({ genre, onConfirm, onBack }) => {
  const [settings, setSettings] = useState<WorldSettings>({
    worldContext: '',
    plotDirection: '',
    majorFactions: '',
    keyNpcs: ''
  });
  
  const [quickAssistPrompt, setQuickAssistPrompt] = useState('');
  const [loadingField, setLoadingField] = useState<string | null>(null);

  // Load preset on mount
  useEffect(() => {
    if (PRESETS[genre]) {
      setSettings(PRESETS[genre]);
    }
  }, [genre]);

  const handleChange = (field: keyof WorldSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleQuickAssist = async () => {
    if (!quickAssistPrompt.trim()) return;
    setLoadingField('quick');
    try {
      const result = await geminiService.generateWorldAssist(genre, quickAssistPrompt, {});
      setSettings(result);
    } catch (e) {
      alert("AI không thể tạo thế giới lúc này (Có thể do lỗi mạng hoặc quyền hạn). Vui lòng thử lại.");
    } finally {
      setLoadingField(null);
    }
  };

  const handleFieldAssist = async (field: keyof WorldSettings, label: string) => {
    setLoadingField(field);
    try {
      // Create a context string from other fields to ensure consistency
      const context = JSON.stringify(settings);
      const result = await geminiService.generateSingleWorldField(genre, label, context, {});
      handleChange(field, result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingField(null);
    }
  };

  const renderField = (field: keyof WorldSettings, label: string, placeholder: string) => (
    <div className="space-y-2">
      <label className="flex justify-between text-sm font-medium text-zinc-400">
        <span>{label}</span>
        <div className="flex gap-2">
           <button 
             onClick={() => handleFieldAssist(field, label)}
             disabled={!!loadingField}
             className="text-xs text-gold-500 hover:text-gold-300 disabled:opacity-50"
             title="AI Hỗ trợ viết"
            >
              <i className={`fas ${loadingField === field ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} mr-1`}></i>
              Gemini Viết
           </button>
           <button 
            className="text-xs text-jade-500 cursor-pointer hover:underline" 
            onClick={() => handleChange(field, PRESETS[genre][field] || '')}
           >
            <i className="fas fa-history mr-1"></i>Mẫu
          </button>
        </div>
      </label>
      <textarea
        className="w-full h-32 bg-ink-900 border border-zinc-600 rounded p-3 text-parchment-100 focus:border-gold-500 outline-none resize-none"
        value={settings[field]}
        onChange={(e) => handleChange(field, e.target.value)}
        placeholder={placeholder}
        disabled={loadingField === 'quick'}
      />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900 text-parchment-100 p-4 font-serif">
      <div className="max-w-4xl w-full bg-ink-800 p-8 rounded-lg border border-zinc-700 shadow-2xl animate-fade-in relative">
        
        <div className="flex justify-between items-center mb-6 border-b border-zinc-700 pb-4">
          <h2 className="text-3xl font-bold text-gold-500">
            <i className="fas fa-globe-asia mr-3"></i>
            Kiến Tạo Thế Giới: {genre}
          </h2>
          <button onClick={onBack} className="text-zinc-400 hover:text-parchment-100">
            <i className="fas fa-arrow-left mr-2"></i> Quay lại
          </button>
        </div>

        {/* Quick Assist Section */}
        <div className="mb-8 p-4 bg-ink-900 rounded border border-zinc-700">
          <label className="block text-sm font-bold text-gold-500 mb-2">
            <i className="fas fa-bolt mr-2"></i> Quick Assist (Hỗ trợ nhanh)
          </label>
          <div className="flex gap-2">
            <input 
              type="text" 
              className="flex-1 bg-ink-800 border border-zinc-600 rounded px-4 py-2 text-sm text-parchment-100 focus:border-gold-500 outline-none"
              placeholder="Vd: Thế giới hậu tận thế nơi zombie biết sử dụng phép thuật..."
              value={quickAssistPrompt}
              onChange={(e) => setQuickAssistPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAssist()}
            />
            <button 
              onClick={handleQuickAssist}
              disabled={loadingField === 'quick'}
              className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
            >
              {loadingField === 'quick' ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
              {' '}Tự động điền
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {renderField('worldContext', 'Bối Cảnh Thế Giới', "Mô tả thế giới, bối cảnh lịch sử, địa lý...")}
          {renderField('plotDirection', 'Hướng Đi Cốt Truyện', "Mục tiêu chính, kẻ thù định mệnh, sự kiện khởi đầu...")}
          {renderField('majorFactions', 'Các Thế Lực / Tông Môn', "Liệt kê các tổ chức, môn phái, triều đình...")}
          {renderField('keyNpcs', 'NPC Quan Trọng (Dự kiến)', "Sư phụ, kẻ thù, bạn đồng hành...")}
        </div>

        <div className="flex justify-end pt-4 border-t border-zinc-700">
           <button
            onClick={() => onConfirm(settings)}
            disabled={loadingField === 'quick'}
            className="bg-gold-500 hover:bg-yellow-600 text-black font-bold py-3 px-8 rounded shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all transform hover:scale-105 disabled:opacity-50"
          >
            <i className="fas fa-scroll mr-2"></i>
            Bắt Đầu Hành Trình
          </button>
        </div>
      </div>
    </div>
  );
};