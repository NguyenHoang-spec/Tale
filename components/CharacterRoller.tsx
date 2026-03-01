import React, { useState, useEffect } from 'react';
import { CharacterTraits } from '../types';

interface CharacterRollerProps {
  heroName: string;
  onConfirm: (traits: CharacterTraits) => void;
  onBack: () => void;
}

const ROOTS = [
  { name: 'Hỗn Độn Linh Căn', color: 'text-purple-400', rarity: 'Truyền Thuyết', weight: 1 },
  { name: 'Thiên Linh Căn', color: 'text-gold-500', rarity: 'Cực Phẩm', weight: 5 },
  { name: 'Biến Dị Linh Căn (Lôi)', color: 'text-blue-400', rarity: 'Thượng Phẩm', weight: 10 },
  { name: 'Biến Dị Linh Căn (Băng)', color: 'text-cyan-300', rarity: 'Thượng Phẩm', weight: 10 },
  { name: 'Biến Dị Linh Căn (Phong)', color: 'text-emerald-300', rarity: 'Thượng Phẩm', weight: 10 },
  { name: 'Song Linh Căn', color: 'text-emerald-500', rarity: 'Trung Phẩm', weight: 20 },
  { name: 'Tam Linh Căn', color: 'text-zinc-300', rarity: 'Hạ Phẩm', weight: 30 },
  { name: 'Tứ Linh Căn', color: 'text-zinc-400', rarity: 'Tạp Căn', weight: 40 },
  { name: 'Ngũ Hành Phế Căn', color: 'text-zinc-500', rarity: 'Phế Căn', weight: 50 },
];

const TALENTS = [
  "Thân Thể Tiên Thiên", "Vận Khí Nghịch Thiên", "Sát Phạt Quyết Đoán", "Đào Hoa Kiếp",
  "Luyện Đan Kỳ Tài", "Trận Pháp Tông Sư", "Kiếm Tâm Thông Minh", "Tâm Ma Bất Xâm",
  "Thú Ngữ Giả", "Âm Dương Nhãn", "Trọng Sinh Giả", "Hệ Thống Phụ Trợ", "Huyết Mạch Cổ Đại",
  "Cẩu Đạo Trung Nhân", "Phản Phái Mệnh Cách", "Vô Sỉ Chi Đồ"
];

const PERSONALITY_TRAITS = [
  "Lãnh khốc vô tình", "Hài hước lầy lội", "Chính trực quân tử", "Biến thái sắc lang",
  "Thông minh xảo quyệt", "Ngây thơ trong sáng", "Điên cuồng hiếu chiến", "Cẩn thận đa nghi",
  "Lười biếng thảnh thơi", "Tham lam tiền tài", "Kiêu ngạo bá đạo", "Trầm ổn ít nói",
  "Nhiệt huyết trượng nghĩa", "Hèn nhát sợ chết", "Trung thành tận tụy", "Bí ẩn khó đoán"
];

export const CharacterRoller: React.FC<CharacterRollerProps> = ({ heroName, onConfirm, onBack }) => {
  const [currentRoot, setCurrentRoot] = useState(ROOTS[ROOTS.length - 1]);
  const [currentTalents, setCurrentTalents] = useState<string[]>([]);
  const [currentPersonality, setCurrentPersonality] = useState<string>(PERSONALITY_TRAITS[0]);
  const [isRolling, setIsRolling] = useState(false);
  const [rollCount, setRollCount] = useState(0);

  const weightedRandomRoot = () => {
    const totalWeight = ROOTS.reduce((acc, r) => acc + r.weight, 0);
    let random = Math.random() * totalWeight;
    for (const root of ROOTS) {
      if (random < root.weight) return root;
      random -= root.weight;
    }
    return ROOTS[ROOTS.length - 1];
  };

  const randomTalents = () => {
    const shuffled = [...TALENTS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.floor(Math.random() * 2) + 1); // 1-2 talents
  };

  const handleRoll = () => {
    setIsRolling(true);
    let steps = 0;
    const maxSteps = 20;
    const interval = setInterval(() => {
      setCurrentRoot(ROOTS[Math.floor(Math.random() * ROOTS.length)]);
      setCurrentTalents(randomTalents());
      setCurrentPersonality(PERSONALITY_TRAITS[Math.floor(Math.random() * PERSONALITY_TRAITS.length)]);
      steps++;
      if (steps > maxSteps) {
        clearInterval(interval);
        setCurrentRoot(weightedRandomRoot());
        setCurrentTalents(randomTalents());
        setCurrentPersonality(PERSONALITY_TRAITS[Math.floor(Math.random() * PERSONALITY_TRAITS.length)]);
        setIsRolling(false);
        setRollCount(p => p + 1);
      }
    }, 50);
  };

  // Initial roll on mount
  useEffect(() => {
    handleRoll();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900 text-parchment-100 p-4 font-serif">
      <div className="max-w-2xl w-full bg-ink-800 p-8 rounded-lg border border-gold-500 shadow-[0_0_30px_rgba(212,175,55,0.15)] relative overflow-hidden">
        
        {/* Background Decorations */}
        <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-gold-500 opacity-20 rounded-tl-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-gold-500 opacity-20 rounded-br-3xl pointer-events-none"></div>

        <h2 className="text-3xl font-bold text-center text-gold-500 mb-2">Trắc Nghiệm Thiên Phú</h2>
        <p className="text-center text-zinc-500 mb-8">Kiểm tra căn cơ của đạo hữu {heroName}</p>

        <div className="space-y-8 mb-10">
          {/* Root Display */}
          <div className="text-center p-6 bg-ink-900 rounded-lg border border-zinc-700 relative">
            <div className="text-sm text-zinc-500 uppercase tracking-widest mb-2">Linh Căn</div>
            <div className={`text-4xl font-bold ${isRolling ? 'blur-sm' : ''} ${currentRoot.color} transition-all duration-300`}>
              {currentRoot.name}
            </div>
            <div className={`mt-2 text-sm inline-block px-3 py-1 rounded border border-zinc-700 ${currentRoot.color}`}>
              {currentRoot.rarity}
            </div>
          </div>

          {/* Talents Display */}
          <div className="text-center p-6 bg-ink-900 rounded-lg border border-zinc-700">
            <div className="text-sm text-zinc-500 uppercase tracking-widest mb-4">Thiên Phú</div>
            <div className="flex flex-wrap justify-center gap-3">
              {currentTalents.map((talent, idx) => (
                <span key={idx} className={`px-4 py-2 rounded bg-ink-800 border border-zinc-600 text-parchment-200 ${isRolling ? 'opacity-50' : 'animate-fade-in'}`}>
                  {talent}
                </span>
              ))}
            </div>
          </div>
          
          {/* Personality Display */}
          <div className="text-center p-6 bg-ink-900 rounded-lg border border-zinc-700">
            <div className="text-sm text-zinc-500 uppercase tracking-widest mb-2">Tính Cách</div>
            <div className={`text-xl font-bold text-parchment-200 ${isRolling ? 'opacity-50' : 'animate-fade-in'}`}>
              {currentPersonality}
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 justify-center">
           <button 
             onClick={handleRoll}
             disabled={isRolling}
             className="px-8 py-3 rounded border border-zinc-600 text-zinc-400 hover:text-white hover:border-white transition-all disabled:opacity-50"
           >
             <i className="fas fa-dice mr-2"></i>
             Đoán lại mệnh ({rollCount})
           </button>

           <button 
             onClick={() => onConfirm({ spiritualRoot: currentRoot.name, talents: currentTalents, personality: currentPersonality })}
             disabled={isRolling}
             className="px-8 py-3 rounded bg-gold-500 text-black font-bold hover:bg-yellow-600 shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all transform hover:scale-105"
           >
             <i className="fas fa-check mr-2"></i>
             Chấp nhận số phận
           </button>
        </div>
      </div>
    </div>
  );
};