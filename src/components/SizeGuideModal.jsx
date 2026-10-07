import React from 'react';
import { X } from 'lucide-react';
import { useModalBehavior } from '../hooks/useModalBehavior.js';

const MEASUREMENTS = [
  { size: 'XS', bust: '32', waist: '25', hip: '35' },
  { size: 'S', bust: '34', waist: '27', hip: '37' },
  { size: 'M', bust: '36', waist: '29', hip: '39' },
  { size: 'L', bust: '38', waist: '31', hip: '41' },
  { size: 'XL', bust: '40', waist: '33', hip: '43' },
];

export default function SizeGuideModal({ isOpen, onClose }) {
  useModalBehavior(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Size guide" className="relative w-full max-w-lg bg-white text-gray-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold">Size Guide</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded transition-colors" aria-label="Close size guide">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-4">Measurements in inches. All cuts run true-to-size.</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="py-2">Size</th>
                <th className="py-2">Bust</th>
                <th className="py-2">Waist</th>
                <th className="py-2">Hip</th>
              </tr>
            </thead>
            <tbody>
              {MEASUREMENTS.map((row) => (
                <tr key={row.size} className="border-b border-gray-50">
                  <td className="py-3 font-semibold">{row.size}</td>
                  <td className="py-3">{row.bust}"</td>
                  <td className="py-3">{row.waist}"</td>
                  <td className="py-3">{row.hip}"</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-gray-500 mt-6 pt-4 border-t border-gray-100">
            Sarees and half-sarees are Free Size — draped, not tailored — and fit most body types without alteration.
          </p>
        </div>
      </div>
    </div>
  );
}
