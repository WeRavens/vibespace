import { useAuth } from '../lib/AuthContext';
import { MOODS } from '../lib/types';
import { motion } from 'motion/react';
import { Command, Search, Bell, User, Ghost } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarLeftProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeMood?: string | null;
  setActiveMood?: (mood: string | null) => void;
}

export function SidebarLeft({ activeTab, setActiveTab, activeMood, setActiveMood }: SidebarLeftProps) {
  const { user } = useAuth();
  
  const navItems = [
    { icon: Command, label: 'Feed', id: 'Feed' },
    { icon: Search, label: 'Explore', id: 'Explore' },
    { icon: Bell, label: 'Notifications', id: 'Notifications' },
    { icon: User, label: 'Profile', id: 'Profile' },
    { icon: Ghost, label: 'Anonymous', id: 'Anonymous' },
  ];

  return (
    <aside className="hidden md:flex flex-col bg-vibe-bg p-6 h-full border-r border-vibe-line">
      <div className="mb-12 text-2xl font-black tracking-tighter text-vibe-accent uppercase">
        VibeSpace
      </div>

      <nav className="flex-1 space-y-4">
        {navItems.map((item) => (
          <div
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center space-x-3 cursor-pointer transition-colors hover:text-vibe-accent ${
              activeTab === item.id ? 'text-vibe-ink' : 'text-vibe-muted'
            }`}
          >
            <item.icon size={18} />
            <span className="text-sm font-bold uppercase tracking-wider">{item.label}</span>
          </div>
        ))}
      </nav>

      <button 
        onClick={() => {
          const btn = document.querySelector<HTMLButtonElement>('button[key="CreateVibeBtn"]');
          if (btn) btn.click();
          else document.dispatchEvent(new CustomEvent('openCreate'));
        }}
        className="mt-6 w-full py-4 rounded-full bg-vibe-accent text-vibe-bg font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-transform flex items-center justify-center space-x-2"
      >
        <Command size={18} />
        <span>Create Vibe</span>
      </button>

      <div className="mt-10 pt-10 border-t border-vibe-line">
        <div className="mb-6 text-[11px] font-bold uppercase tracking-[2px] text-vibe-muted">
          Your Vibe
        </div>
        <div className="flex flex-wrap gap-2">
          {MOODS.map(m => (
            <div 
              key={m.id}
              className="px-3 py-1.5 rounded-full border border-vibe-muted text-[10px] uppercase tracking-wider text-vibe-muted cursor-pointer hover:border-vibe-accent hover:text-vibe-accent transition-all"
            >
              {m.label}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
