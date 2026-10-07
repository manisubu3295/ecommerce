import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { THEME_PRESETS } from '../data/themePresets.js';

export default function ThemeAdminPanel() {
  const { theme, setTheme, isAdminOpen, setIsAdminOpen } = useTheme();
  const { admin } = useAdminAuth();

  if (!isAdminOpen || !admin) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-start">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsAdminOpen(false)} />
      <div className="relative w-full max-w-sm bg-white text-gray-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 border-r border-gray-100">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Theme Configurator</h2>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Admin Control</p>
          </div>
          <button onClick={() => setIsAdminOpen(false)} className="p-2 hover:bg-gray-200 rounded transition-colors" aria-label="Close theme panel">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8 flex-grow">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Master Presets</label>
            <div className="grid grid-cols-1 gap-3">
              {Object.values(THEME_PRESETS).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setTheme(preset)}
                  className={`p-4 text-left border transition-all ${theme.id === preset.id ? 'border-gray-900 shadow-md ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-400'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm">{preset.title}</span>
                    <div className="w-4 h-4 rounded-full shadow-inner border border-gray-200" style={{ backgroundColor: preset.accentColor }} />
                  </div>
                  <p className="text-xs text-gray-500 truncate">{preset.subtitle}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-8 space-y-5">
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Live Overrides</label>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Campaign Title</label>
              <input
                type="text"
                value={theme.title}
                onChange={(e) => setTheme({ ...theme, title: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-1 focus:ring-gray-900 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Accent Color</label>
              <div className="flex gap-3">
                <input
                  type="color"
                  value={theme.accentColor}
                  onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
                  className="h-10 w-12 p-0.5 border border-gray-200 cursor-pointer bg-white"
                />
                <input
                  type="text"
                  value={theme.accentColor}
                  onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
                  className="flex-grow px-4 py-2 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-1 focus:ring-gray-900 uppercase font-mono text-xs outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Heading Typography</label>
              <select
                value={theme.fontHeading}
                onChange={(e) => setTheme({ ...theme, fontHeading: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-1 focus:ring-gray-900 text-sm outline-none"
              >
                <option value="font-sans">Sans-Serif (Modern)</option>
                <option value="font-serif">Serif (Editorial/Vintage)</option>
                <option value="font-mono">Monospace (Technical/Edgy)</option>
                <option value="font-tradition">Temple Serif (Heritage/Traditional)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
