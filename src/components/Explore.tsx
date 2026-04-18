import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Search } from 'lucide-react';
import { Vibe, MOODS } from '../lib/types';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../lib/LanguageContext';
import { Avatar } from './Avatar';
import { Play, X } from 'lucide-react';
import { Feed } from './Feed';

export function Explore({ onOpenProfile }: { onOpenProfile?: (id: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<{ users: any[], posts: Vibe[] }>({ users: [], posts: [] });
  const [loading, setLoading] = useState(true);
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const searchData = async () => {
      setLoading(true);
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), limit(50)));
        const allUsers = usersSnap.docs.map(d => d.data());

        if (!searchTerm.trim()) {
           setResults({ users: allUsers, posts: [] });
        } else {
           const matchedUsers = allUsers.filter(u => 
             (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
             (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
           );

           const vibesSnap = await getDocs(query(collection(db, 'vibes'), orderBy('createdAt', 'desc'), limit(100)));
           const allVibes = vibesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Vibe[];
           const matchedVibes = allVibes.filter(v => 
             (v.content || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
             (v.authorName || '').toLowerCase().includes(searchTerm.toLowerCase())
           );

           setResults({ users: matchedUsers, posts: matchedVibes });
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };

    const debounce = setTimeout(searchData, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-8 overflow-y-auto no-scrollbar">
      <div className="sticky top-0 bg-[#050505] z-10 pt-4 pb-6">
        <div className="relative max-w-xl mx-auto">
          <input 
            type="text" 
            placeholder={t('searchUsersOrVibes')} 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[#111] border border-vibe-line rounded-full py-4 pl-12 pr-6 text-white focus:outline-none focus:border-vibe-accent shadow-[0_0_20px_rgba(0,255,209,0.1)] transition-colors"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-vibe-muted" />
        </div>
      </div>

      <div className="max-w-xl mx-auto w-full space-y-8 pb-32">
        {loading && <div className="text-center font-mono text-vibe-muted animate-pulse">{t('searchingUniverse')}</div>}
        
        {!loading && searchTerm && results.users.length === 0 && results.posts.length === 0 && (
          <div className="text-center text-vibe-muted py-10 border border-vibe-line border-dashed rounded-3xl">
            {t('noVibesFound', { term: searchTerm })}
          </div>
        )}

        {!loading && results.users.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-vibe-muted font-bold mb-4">{!searchTerm ? t('suggestedUsers') : t('accounts')}</h3>
            <div className="space-y-4">
              {results.users.map((u, i) => (
                <div key={i} onClick={() => onOpenProfile?.(u.uid)} className="flex items-center space-x-4 p-4 rounded-2xl bg-[#111] border border-vibe-line cursor-pointer hover:border-vibe-accent transition-colors">
                  <Avatar
                    src={u.photoURL}
                    name={u.displayName}
                    alt="pfp"
                    className="h-12 w-12 shrink-0 border border-vibe-line bg-[#050505]"
                    textClassName="text-sm"
                  />
                  <div>
                    <div className="font-bold text-white">{u.displayName}</div>
                    <div className="text-xs font-mono text-vibe-muted">@{u.displayName?.toLowerCase().replace(/\s+/g, '') || u.uid.substring(0,6)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && results.posts.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-vibe-muted font-bold mb-4">{t('vibes')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {results.posts.map(post => (
                <div
                  key={post.id}
                  onClick={() => setSelectedVibe(post)}
                  className="relative aspect-[2/3] rounded-xl overflow-hidden border border-vibe-line bg-[#111] cursor-pointer hover:border-vibe-accent transition-all group"
                >
                  {post.mediaUrl ? (
                    post.type === 'video' ? (
                      <>
                        <video src={`${post.mediaUrl}#t=0.1`} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                           <Play size={20} className="text-white fill-current opacity-60 group-hover:opacity-100" />
                        </div>
                      </>
                    ) : (
                      <img src={post.mediaUrl} className="absolute inset-0 w-full h-full object-cover" />
                    )
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-3 text-center bg-[#0a0a0a]">
                      <p className="text-[10px] text-vibe-muted font-serif line-clamp-4 italic">"{post.content}"</p>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                     <p className="text-[10px] font-bold text-white truncate">{post.authorName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedVibe && (
           <motion.div
             initial={{ opacity: 0, y: 100 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: 100 }}
             className="fixed inset-0 z-[60] bg-vibe-bg overflow-hidden flex flex-col"
           >
             <div className="absolute left-0 right-0 top-0 z-[70] flex items-center justify-start p-4 md:justify-end">
                <button onClick={() => setSelectedVibe(null)} className="p-3 bg-black/50 rounded-full text-white hover:text-vibe-accent border border-vibe-line backdrop-blur-md">
                   <X size={24} />
                </button>
             </div>
             <div className="flex-1 w-full overflow-y-auto no-scrollbar snap-y snap-mandatory relative">
                <Feed activeMood={null} initialVibeId={selectedVibe.id} onOpenProfile={onOpenProfile || (() => {})} />
             </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
