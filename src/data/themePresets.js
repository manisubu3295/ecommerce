// Theme presets — the entire app derives its look from whichever preset is active.
export const THEME_PRESETS = {
  '90s-cinema': {
    id: '90s-cinema',
    title: 'THE 90s ARCHIVE',
    subtitle: 'Iconic looks from the silver screen. Reimagined for today.',
    accentColor: '#e11d48', // Rose 600
    secondaryColor: '#fbcfe8', // Rose 200
    bgColor: '#ffffff',
    textColor: '#111827',
    fontHeading: 'font-serif',
    heroImg: 'https://images.unsplash.com/photo-1534349762230-e0cadf78f5da?auto=format&fit=crop&q=80&w=1600',
    navStyle: 'bg-white/80 backdrop-blur-md border-b border-gray-100',
  },
  'matrix-core': {
    id: 'matrix-core',
    title: 'NEO NOIR',
    subtitle: 'Sleek leather, dark shades, and cyberpunk aesthetics.',
    accentColor: '#10b981', // Emerald 500
    secondaryColor: '#134e4a', // Teal 900
    bgColor: '#0f172a',
    textColor: '#f8fafc',
    fontHeading: 'font-mono',
    heroImg: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=1600',
    navStyle: 'bg-slate-900/80 backdrop-blur-md border-b border-slate-800 text-white',
  },
  'minimalist': {
    id: 'minimalist',
    title: 'ESSENTIALS',
    subtitle: 'Clean lines, neutral tones. The modern wardrobe.',
    accentColor: '#000000', // Black
    secondaryColor: '#e5e5e5', // Neutral 200
    bgColor: '#fafafa',
    textColor: '#0a0a0a',
    fontHeading: 'font-sans',
    heroImg: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=1600',
    navStyle: 'bg-transparent text-gray-900',
  },
  'rust-beige': {
    id: 'rust-beige',
    title: 'RUST & RELIC',
    subtitle: 'Warm rust leather tones grounded in soft, sun-baked beige.',
    accentColor: '#A0522D', // Sienna / rust brown
    secondaryColor: '#e6d5bc', // Beige 300
    bgColor: '#F5E9DA', // Beige
    textColor: '#3B2A1A', // Deep brown
    fontHeading: 'font-serif',
    heroImg: 'https://images.unsplash.com/photo-1604176354204-9268737828e4?auto=format&fit=crop&q=80&w=1600',
    navStyle: 'bg-[#F5E9DA]/80 backdrop-blur-md border-b border-[#e6d5bc]',
  },
  'temple-silk': {
    id: 'temple-silk',
    title: 'TEMPLE SILK',
    subtitle: 'Kanjeevaram drapes and temple-gold zari, for the 90s Tamil screen icon.',
    // Same palette as the Maadhavi Bridal Studio design system, for a
    // consistent look across both Barani's Couture and Maadhavi.
    accentColor: '#5C1A2B', // Oxblood — kumkumam, Kanjeevaram silk. Primary.
    secondaryColor: '#C8A24A', // Temple gold — gopuram gilding. Accent only.
    bgColor: '#F6EFE6', // Warm ivory — jasmine, mull kasavu. Page ground.
    textColor: '#241A1C',
    fontHeading: 'font-tradition',
    heroImg: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1600',
    navStyle: 'bg-[#F6EFE6]/80 backdrop-blur-md border-b border-[#E0CBAE]',
  },
};

export const DEFAULT_THEME_ID = '90s-cinema';
