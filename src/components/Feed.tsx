import React, { useState, useRef, useEffect, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Heart,
  MessageCircle,
  Trash2,
  ShieldAlert,
  Eye,
  EyeOff,
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  Send,
  Bookmark,
  ChevronUp,
  ChevronDown,
  Plus,
  Ghost
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import {
  doc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  collection,
  query,
  where,
  limit,
  onSnapshot,
  getDoc,
  increment,
  deleteField
} from 'firebase/firestore';
import { cn } from '../lib/utils';

export interface Vibe {
  id: string;
  userId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  mediaUrl?: string;
  type: 'text' | 'photo' | 'video';
  mood?: string;
  isAnonymous: boolean;
  createdAt: any;
  expiresAt: any;
  reactions?: Record<string, number>;
  userReactions?: Record<string, string>;
  savedBy?: Record<string, boolean>;
  viewsCount?: number;
  comments?: {
    id: string;
    userId: string;
    userName: string;
    content: string;
    createdAt: any;
  }[];
}

interface FeedItemProps {
  vibe: Vibe;
  onReact: (vibeId: string, emoji: string) => void;
  onSave: (vibe: Vibe) => void;
  hasSaved?: boolean;
  onOpenProfile: (id: string) => void;
}

const REACTION_EMOJIS = ["🔥", "❤️", "🤣", "😢", "🙌", "✨", "💯", "🤯"];

function normalizeDate(value: any) {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function Feed({
  activeMood,
  initialVibeId,
  onOpenProfile,
  userFilter
}: {
  activeMood: string | null;
  initialVibeId?: string;
  onOpenProfile: (id: string) => void;
  userFilter?: string;
}) {
  const [pool, setPool] = useState<Vibe[]>([]);
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  // Helper to shuffle array
  const shuffle = (array: any[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    isInitialLoad.current = true;

    let q = query(collection(db, "vibes"), limit(100));

    if (userFilter) {
      q = query(collection(db, "vibes"), where("userId", "==", userFilter));
    } else if (activeMood) {
      q = query(collection(db, "vibes"), where("mood", "==", activeMood));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          content: data.content || "",
          createdAt: normalizeDate(data.createdAt),
          comments: (data.comments || []).map((c: any) => ({
            ...c,
            createdAt: normalizeDate(c.createdAt)
          }))
        };
      }) as Vibe[];

      if (snapshot.empty && !initialVibeId && !userFilter && !activeMood) {
        if (isInitialLoad.current) {
          const shuffled = shuffle(SAMPLE_VIBES);
          setVibes(shuffled);
          setPool(shuffled);
          isInitialLoad.current = false;
        }
        setLoading(false);
        return;
      }

      setPool(fetched);

      // CRITICAL FIX: Only shuffle on the very first data arrival
      if (isInitialLoad.current) {
        let shuffledOrder = shuffle(fetched);
        if (initialVibeId) {
          const idx = shuffledOrder.findIndex(v => v.id === initialVibeId);
          if (idx > -1) {
            const [v] = shuffledOrder.splice(idx, 1);
            shuffledOrder.unshift(v);
          }
        }
        setVibes(shuffledOrder);
        isInitialLoad.current = false;
      } else {
        // Update data ONLY, keep the same order
        setVibes(prevVibes => prevVibes.map(v => {
          const baseId = v.id.split('-repeat-')[0];
          const updated = fetched.find(f => f.id === baseId);
          return updated ? { ...updated, id: v.id } : v;
        }));
      }

      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeMood, userFilter, initialVibeId]);

  // Infinite Scroll Observer
  useEffect(() => {
    if (vibes.length === 0 || pool.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const extraVibes = shuffle(pool).map(v => ({
          ...v,
          id: `${v.id}-repeat-${Math.random().toString(36).substr(2, 5)}`
        }));
        setVibes(prev => [...prev, ...extraVibes]);
      }
    }, { threshold: 0.1 });

    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [pool, vibes.length]);

  const handleReact = async (vibeId: string, emoji: string) => {
    if (!user) return;
    // Extract original ID if it's a repeated item
    const originalId = vibeId.split('-repeat-')[0];
    const vibeRef = doc(db, "vibes", originalId);
    try {
      const snap = await getDoc(vibeRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const userReactions = data.userReactions || {};
      const oldEmoji = userReactions[user.uid];
      const updates: any = {};
      if (oldEmoji === emoji) {
        updates[`userReactions.${user.uid}`] = deleteField();
        updates[`reactions.${emoji}`] = increment(-1);
      } else {
        if (oldEmoji) updates[`reactions.${oldEmoji}`] = increment(-1);
        updates[`userReactions.${user.uid}`] = emoji;
        updates[`reactions.${emoji}`] = increment(1);
      }
      await updateDoc(vibeRef, updates);
    } catch (err) { console.error(err); }
  };

  const handleSave = async (vibe: Vibe) => {
    if (!user) return;
    const originalId = vibe.id.split('-repeat-')[0];
    try {
      const isSaved = vibe.savedBy?.[user.uid];
      await updateDoc(doc(db, "vibes", originalId), {
        [`savedBy.${user.uid}`]: isSaved ? deleteField() : true
      });
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-vibe-accent/20 border-t-vibe-accent" />
      </div>
    );
  }

  if (vibes.length === 0) {
    return (
      <div className="flex h-[80vh] w-full flex-col items-center justify-center space-y-4 text-center">
        <Ghost size={64} className="text-vibe-muted opacity-20" />
        <p className="text-xs font-bold uppercase tracking-widest text-vibe-muted">No vibes found here</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col h-full overflow-y-auto snap-y snap-mandatory no-scrollbar select-none overscroll-y-contain bg-black feed-scroll">
      {vibes.map((vibe, index) => (
        <MemoizedFeedItem
          key={vibe.id}
          vibe={vibe}
          onReact={handleReact}
          onSave={handleSave}
          hasSaved={Boolean(vibe.savedBy?.[user?.uid || ''])}
          onOpenProfile={onOpenProfile}
        />
      ))}
      {/* Sentinel for infinite loop */}
      <div ref={sentinelRef} className="h-px w-full flex-shrink-0" />
    </div>
  );
}

const MemoizedFeedItem = React.memo(FeedItem, (prevProps, nextProps) => {
  return (
    prevProps.vibe.id === nextProps.vibe.id &&
    prevProps.vibe.viewsCount === nextProps.vibe.viewsCount &&
    prevProps.hasSaved === nextProps.hasSaved &&
    JSON.stringify(prevProps.vibe.reactions) === JSON.stringify(nextProps.vibe.reactions) &&
    prevProps.vibe.comments?.length === nextProps.vibe.comments?.length
  );
});

export function FeedItem({ vibe, onReact, onSave, hasSaved, onOpenProfile }: FeedItemProps) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllReactions, setShowAllReactions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAdmin = (user?.email || '').toLowerCase().includes('ikfah') || (user?.email || '').toLowerCase().includes('admin');
  const isOwner = user?.uid === vibe.userId;
  const canDelete = isOwner || isAdmin;

  const content = vibe.content || "";
  const needsClamping = content.length > 120;

  // View Tracking Logic
  useEffect(() => {
    if (!containerRef.current) return;
    const originalId = vibe.id.split('-repeat-')[0];
    const vibeRef = doc(db, "vibes", originalId);

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        updateDoc(vibeRef, { viewsCount: increment(1) }).catch(err => console.error("View count error:", err));
        observer.disconnect();
      }
    }, { threshold: 0.7 });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [vibe.id]);

  const sortedReactions = useMemo(() => {
    if (!vibe.reactions) return [];
    return Object.entries(vibe.reactions).filter(([, c]) => c > 0).sort(([, a], [, b]) => b - a);
  }, [vibe.reactions]);

  const totalReactions = useMemo(() => {
    if (!vibe.reactions) return 0;
    return Object.values(vibe.reactions).reduce((acc, curr) => acc + (typeof curr === 'number' ? Math.max(0, curr) : 0), 0);
  }, [vibe.reactions]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;
    try {
      const newComment = {
        id: Math.random().toString(36).substr(2, 9),
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        content: commentText.trim(),
        createdAt: new Date()
      };
      await updateDoc(doc(db, "vibes", vibe.id), { comments: arrayUnion(newComment) });
      setCommentText('');
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Hapus postingan ini secara permanen?")) return;
    try { await deleteDoc(doc(db, "vibes", vibe.id)); } catch (err) { console.error(err); }
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full flex-shrink-0 snap-start bg-black overflow-hidden select-none"
      data-vibe-id={vibe.id}
    >
      {/* Background Media */}
      <div className="absolute inset-0 h-full w-full pointer-events-none">
        {vibe.type === 'video' && vibe.mediaUrl ? (
          <VideoBackdrop src={vibe.mediaUrl} />
        ) : vibe.type === 'photo' && vibe.mediaUrl ? (
          <img src={vibe.mediaUrl} alt="" className="h-full w-full object-cover opacity-100" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-vibe-accent/20 via-black to-vibe-bg" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
      </div>

      {/* Content Bottom Left */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col p-6 pb-28 md:pb-12 pointer-events-none">
        <div className="flex flex-col space-y-4 max-w-[85%]">
          {/* Profile Row */}
          <div className="flex items-center space-x-3 pointer-events-auto cursor-pointer" onClick={() => !vibe.isAnonymous && onOpenProfile(vibe.userId)}>
            <div className="h-11 w-11 overflow-hidden rounded-full border-2 border-vibe-accent/40 bg-vibe-line p-0.5">
              {vibe.isAnonymous ? (
                <div className="flex h-full w-full items-center justify-center bg-vibe-bg text-vibe-accent"><Ghost size={18} /></div>
              ) : (
                <img src={vibe.authorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${vibe.userId}`} alt="" className="h-full w-full rounded-full object-cover" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white drop-shadow-lg">{vibe.isAnonymous ? 'Someone Mysterious' : vibe.authorName}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-vibe-accent/70 drop-shadow-md">{formatDistanceToNow(normalizeDate(vibe.createdAt))} ago</span>
            </div>
          </div>

          {/* Text Content */}
          <div className="pointer-events-auto">
            <p className={cn(
              "font-bold text-white tracking-tight leading-snug drop-shadow-2xl transition-all",
              vibe.type === 'text' ? 'text-3xl' : 'text-base',
              !isExpanded && needsClamping && "line-clamp-3"
            )}>
              {content}
            </p>
            {needsClamping && (
              <button onClick={() => setIsExpanded(!isExpanded)} className="mt-2 text-[10px] font-black uppercase tracking-[2px] text-vibe-accent bg-black/20 px-2 py-1 rounded-md backdrop-blur-sm">
                {isExpanded ? "Show Less" : "Read More"}
              </button>
            )}
          </div>

          {/* Badge Row */}
          <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
             <div className="flex items-center space-x-2 text-[10px] text-vibe-accent font-bold bg-vibe-accent/10 px-3 py-1.5 rounded-full border border-vibe-accent/20 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-vibe-accent animate-pulse" />
                <span className="uppercase">{totalReactions} Vibes</span>
             </div>
             <div className="flex items-center space-x-1.5 text-[10px] text-white bg-white/10 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                <Eye size={12} className="text-vibe-accent" />
                <span>{vibe.viewsCount || 0}</span>
             </div>
             <button onClick={() => setShowComments(true)} className="flex items-center space-x-1.5 text-[10px] font-bold text-white bg-white/10 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md hover:bg-white/20 transition-all">
                <MessageCircle size={12} />
                <span>{vibe.comments?.length || 0}</span>
             </button>
             <button onClick={() => onSave(vibe)} className={cn("flex items-center space-x-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full border backdrop-blur-md transition-all", hasSaved ? "bg-vibe-accent/20 border-vibe-accent text-vibe-accent" : "bg-white/10 border-white/10 text-white")}>
                <Bookmark size={12} className={hasSaved ? "fill-current" : ""} />
                <span className="uppercase">{hasSaved ? 'Saved' : 'Save'}</span>
             </button>
             {vibe.mood && (
               <div className="flex items-center space-x-1.5 text-[9px] font-black text-white/70 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 uppercase tracking-widest">
                  <span className="h-1 w-1 rounded-full bg-vibe-accent/40" />
                  <span>{vibe.mood}</span>
               </div>
             )}

             {/* Inline Moderation */}
             {canDelete && (
                <button onClick={handleDelete} className="flex items-center space-x-1.5 text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20 backdrop-blur-md hover:bg-red-500/20">
                   <Trash2 size={10} />
                   <span>Hapus</span>
                </button>
             )}
             {isAdmin && !isOwner && (
                <button className="flex items-center space-x-1.5 text-[9px] font-black uppercase tracking-widest text-yellow-400 bg-yellow-500/10 px-3 py-1.5 rounded-full border border-yellow-500/20 backdrop-blur-md">
                   <ShieldAlert size={10} />
                   <span>Ban</span>
                </button>
             )}
          </div>
        </div>
      </div>

      {/* Floating Reactions Right */}
      <div className="absolute right-4 bottom-28 md:bottom-12 z-20 flex flex-col items-center space-y-4">
        <div className="flex flex-col items-center space-y-2">
           <AnimatePresence>
             {showAllReactions && sortedReactions.length > 1 && (
               <motion.div initial={{ opacity: 0, scale: 0.5, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.5, y: 20 }} className="flex flex-col space-y-2 mb-2">
                 {sortedReactions.slice(1).reverse().map(([emoji, count]) => (
                   <button key={emoji} onClick={() => onReact(vibe.id, emoji)} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 backdrop-blur-xl text-lg hover:scale-110 active:scale-90 transition-all">
                     <span>{emoji}</span>
                     <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[8px] font-black text-black">{count}</span>
                   </button>
                 ))}
               </motion.div>
             )}
           </AnimatePresence>

           {sortedReactions.length > 0 && (
             <button onClick={(e) => { e.stopPropagation(); onReact(vibe.id, sortedReactions[0][0]); }} className={cn("relative flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/60 backdrop-blur-2xl text-2xl shadow-xl transition-all active:scale-95", user && vibe.userReactions?.[user.uid] === sortedReactions[0][0] ? "border-vibe-accent bg-vibe-accent/20" : "")}>
               <span>{sortedReactions[0][0]}</span>
               <span className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-vibe-accent text-[10px] font-black text-vibe-bg shadow-md">{sortedReactions[0][1]}</span>
             </button>
           )}

           {sortedReactions.length > 1 && (
             <button onClick={() => setShowAllReactions(!showAllReactions)} className="h-6 w-6 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white transition-colors">
               {showAllReactions ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
             </button>
           )}
        </div>

        <button onClick={() => setShowReactionPicker(!showReactionPicker)} className={cn("flex h-12 w-12 items-center justify-center rounded-full border shadow-2xl transition-all backdrop-blur-xl", showReactionPicker ? "bg-vibe-accent border-vibe-accent text-vibe-bg rotate-45" : "bg-white/10 border-white/10 text-white hover:bg-white/20")}>
          <Plus size={24} />
        </button>

        <AnimatePresence>
          {showReactionPicker && (
            <motion.div initial={{ opacity: 0, x: -20, scale: 0.8 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20, scale: 0.8 }} className="absolute bottom-16 right-0 w-48 grid grid-cols-4 gap-2 rounded-2xl border border-white/15 bg-black/80 p-2 backdrop-blur-2xl">
              {REACTION_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => { onReact(vibe.id, emoji); setShowReactionPicker(false); }} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-xl">{emoji}</button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Comment Overlay */}
      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30 }} className="absolute inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-3xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-sm font-black uppercase tracking-[3px] text-vibe-accent">Comments</h3>
              <button onClick={() => setShowComments(false)} className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 text-white hover:bg-white/10"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              {(!vibe.comments || vibe.comments.length === 0) ? (
                <div className="flex h-full items-center justify-center text-vibe-muted text-xs uppercase tracking-widest">Quiet here... say something!</div>
              ) : (
                vibe.comments.map(c => (
                  <div key={c.id} className="flex space-x-3">
                    <div className="h-9 w-9 rounded-full bg-vibe-accent/10 border border-vibe-accent/20 flex items-center justify-center text-xs font-black text-vibe-accent uppercase">{c.userName.charAt(0)}</div>
                    <div className="flex-1">
                       <div className="flex items-center justify-between">
                         <span className="text-xs font-black text-white">{c.userName}</span>
                         <span className="text-[9px] text-vibe-muted font-mono uppercase">{formatDistanceToNow(normalizeDate(c.createdAt))}</span>
                       </div>
                       <p className="text-sm text-white/80 mt-1 leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={submitComment} className="p-4 bg-black/50 border-t border-white/10 flex items-center space-x-3">
               <input type="text" placeholder="Add a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-full py-3 px-5 text-sm text-white focus:outline-none focus:border-vibe-accent transition-all" />
               <button disabled={!commentText.trim()} type="submit" className="h-11 w-11 flex items-center justify-center rounded-full bg-vibe-accent text-vibe-bg disabled:opacity-30 active:scale-90 transition-transform"><Send size={18}/></button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VideoBackdrop({ src }: { src: string }) {
  const [isReady, setIsReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }, { threshold: 0.6 });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center">
      <video ref={videoRef} src={src} loop muted={isMuted} playsInline preload="metadata" onLoadedData={() => setIsReady(true)} className={cn("h-full w-full object-contain transition-opacity duration-500", isReady ? "opacity-100" : "opacity-0")} />
      <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="absolute top-6 right-6 z-30 h-12 w-12 flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-xl border border-white/10 hover:bg-black/60 transition-all pointer-events-auto">
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-vibe-bg">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-vibe-accent/20 border-t-vibe-accent" />
        </div>
      )}
    </div>
  );
}

const SAMPLE_VIBES: Vibe[] = [
  {
    id: "welcome",
    userId: "system",
    authorName: "VibeSpace",
    authorPhoto: "",
    content: "Selamat datang di VibeSpace! 🌊 Mulailah dengan membuat Vibe pertamamu hari ini.",
    type: "text",
    mood: "chill",
    isAnonymous: false,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
    reactions: { "✨": 1 }
  }
];
