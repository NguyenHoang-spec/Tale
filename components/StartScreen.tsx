
import React, { useState } from 'react';
import { GameGenre } from '../types';

interface StartScreenProps {
  onStart: (name: string, genre: GameGenre, gender: string) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState('Nam');
  const [genre, setGenre] = useState<GameGenre>(GameGenre.CULTIVATION);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onStart(name, genre, gender);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900 text-parchment-100 p-4 font-serif">
      <div className="max-w-md w-full space-y-8 bg-ink-800 p-8 rounded-lg border border-zinc-700 shadow-2xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gold-500 mb-2">Nhập Vai Simulator</h1>
          <p className="text-zinc-500">Bước vào thế giới huyễn tưởng, nghịch thiên cải mệnh.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Đạo Hiệu (Tên nhân vật)</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-ink-900 border border-zinc-600 rounded px-4 py-3 text-parchment-100 focus:ring-1 focus:ring-gold-500 focus:border-gold-500 outline-none"
              placeholder="Vd: Hàn Lập, Bạch Tiểu Thuần..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Giới Tính</label>
            <div className="flex space-x-4">
              {['Nam', 'Nữ'].map((g) => (
                <label key={g} className={`flex-1 cursor-pointer border rounded p-3 flex items-center justify-center transition-all ${
                  gender === g 
                    ? 'bg-zinc-700 border-gold-500 text-gold-500' 
                    : 'border-zinc-700 hover:border-zinc-500 text-zinc-400'
                }`}>
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={gender === g}
                    onChange={(e) => setGender(e.target.value)}
                    className="hidden"
                  />
                  <span>{g}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Thế Giới (Thể loại)</label>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(GameGenre).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenre(g)}
                  className={`p-3 rounded border text-sm transition-all ${
                    genre === g
                      ? 'bg-zinc-700 border-gold-500 text-gold-500'
                      : 'border-zinc-700 hover:border-zinc-500 text-zinc-400'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gold-500 hover:bg-yellow-600 text-black font-bold py-3 px-4 rounded transition-colors shadow-[0_0_10px_rgba(212,175,55,0.2)]"
          >
            Khởi Tạo Nhân Vật
          </button>
        </form>
        
        <div className="text-xs text-center text-zinc-700">
          <p>Lưu ý: Game sử dụng AI tạo sinh, nội dung có thể không đoán trước được.</p>
        </div>
      </div>
    </div>
  );
};