import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { Vibe } from '../lib/types';
import { Feed } from './Feed';
import { Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ProfileGrid({ userId, mode = 'posts', onViewerStateChange }: { userId: string, mode?: 'posts' | 'saved', onViewerStateChange?: (isOpen: boolean) => void }) {
  const [userVibes, setUserVibes] = useState<Vibe[]>([]);
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const isNativeOrMobile =
    Capacitor.isNativePlatform() ||
    (typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  useEffect(() => {
    if (!userId || !db) return;

    const fetchVibes = async () => {
      try {
        const q = mode === 'saved'
          ? query(collection(db, 'vibes'), where(`savedBy.${userId}`, '==', true))
          : query(collection(db, 'vibes'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const vibesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Vibe[];
        
        // Sort client-side to avoid Firestore composite index requirement
        vibesData.sort((a, b) => {
           const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
           const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
           return timeB - timeA;
        });

        setUserVibes(vibesData);
      } catch (err) {
        console.error("Error fetching user vibes", err);
      }
    };

    fetchVibes();
  }, [userId, mode]);

  useEffect(() => {
    onViewerStateChange?.(Boolean(selectedVibe));
  }, [onViewerStateChange, selectedVibe]);

  return (
    <>
      <div className="w-full pb-32">
        <div className="grid grid-cols-3 gap-1 md:grid-cols-4 xl:grid-cols-5">
          {userVibes.map((vibe) => (
            <div 
              key={vibe.id} 
              onClick={() => setSelectedVibe(vibe)}
              className="aspect-[2/3] bg-[#111] overflow-hidden relative cursor-pointer group border border-vibe-line hover:border-vibe-accent transition-colors"
            >
              {vibe.mediaUrl ? (
                vibe.type === 'video' ? (
                   <>
                     <div className="absolute inset-0 bg-black" />
                     <video
                       src={`${vibe.mediaUrl}#t=0.1`}
                       muted
                       playsInline
                       preload="metadata"
                       className="absolute inset-0 w-full h-full object-contain"
                     />
                     <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                           <Play size={16} className="ml-0.5 fill-current" />
                        </div>
                     </div>
                     <div className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm">
                       <Play size={12} className="fill-current" />
                     </div>
                   </>
                ) : (
                   <>
                     <div className="absolute inset-0 bg-black" />
                     <img
                       src={vibe.mediaUrl}
                       alt="Thumbnail"
                       loading="lazy"
                       decoding="async"
                       className="absolute inset-0 w-full h-full object-contain"
                     />
                   </>
                )
              ) : (
                <div className="absolute inset-0 bg-[#050505] p-2 flex items-center justify-center text-center">
                  <p className="text-[8px] sm:text-[10px] text-vibe-muted font-serif line-clamp-4">{vibe.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedVibe && (
           <motion.div 
             initial={{ opacity: 0, y: 100 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: 100 }}
             className="fixed inset-0 z-50 bg-vibe-bg overflow-hidden flex flex-col"
           >
             <div className="absolute left-0 right-0 top-0 z-50 flex items-center justify-start p-4 md:justify-end">
                <button onClick={() => setSelectedVibe(null)} className="p-3 bg-black/50 rounded-full text-white hover:text-vibe-accent border border-vibe-line backdrop-blur-md">
                   <X size={24} />
                </button>
             </div>
             <div className="flex-1 w-full overflow-y-auto no-scrollbar relative z-20">
                {/* Reusing the Feed component directly so it handles the vertical swipe mechanics */}
                <Feed
                  userFilter={userId}
                  initialVibeId={selectedVibe.id}
                  activeMood={null}
                  onOpenProfile={(id) => {
                    setSelectedVibe(null);
                    onViewerStateChange?.(false);
                  }}
                />
             </div>
           </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
