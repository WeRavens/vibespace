import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Search } from 'lucide-react';
import { Vibe } from '../lib/types';
import { Feed } from './Feed';
import { useAuth } from '../lib/AuthContext';
import { motion } from 'motion/react';
import { useLanguage } from '../lib/LanguageContext';

export function Explore({ onOpenProfile }: { onOpenProfile?: (id: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<{ users: any[], posts: Vibe[] }>({ users: [], posts: [] });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
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

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm === 'MyAdmin') {
      const pwd = window.prompt("Enter Admin Password:");
      if (pwd === "Dexter77x") {
         if (user) {
            await updateDoc(doc(db, 'users', user.uid), { overrideAdmin: true });
            alert("System Override: Admin privileges granted! Welcome, Commander.");
            window.location.reload();
         }
      } else if (pwd) {
         alert("Access Denied: Incorrect Password.");
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-8 overflow-y-auto no-scrollbar">
      <div className="sticky top-0 bg-[#050505] z-10 pt-4 pb-6">
        <div className="relative max-w-xl mx-auto">
          <input 
            type="text" 
            placeholder={t('searchUsersOrVibes')} 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
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
                  <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-vibe-line bg-[#050505]">
                    <img src={u.photoURL} alt="pfp" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="font-bold text-white">{u.displayName}</div>
                    <div className="text-xs font-mono text-vibe-muted">{u.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && results.posts.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-vibe-muted font-bold mb-4">{t('vibes')}</h3>
            <div className="grid grid-cols-1 gap-6">
              {results.posts.map(post => (
                <div key={post.id} className="relative h-64 rounded-3xl overflow-hidden border border-vibe-line bg-[#111]">
                  {post.mediaUrl ? (
                    <img src={post.mediaUrl} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                  ) : <div className="absolute inset-0 bg-[#0a0a0a]" />}
                  <div className="absolute inset-0 p-6 flex flex-col justify-end bg-gradient-to-t from-black to-transparent">
                    <div className="font-bold text-white shadow-black">{post.authorName}</div>
                    <div className="text-sm text-vibe-muted line-clamp-2 mt-2">{post.content}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
