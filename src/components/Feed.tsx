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
  userFilter,
  onClose,
  isAdmin: propIsAdmin
}: {
  activeMood: string | null;
  initialVibeId?: string;
  onOpenProfile: (id: string) => void;
  userFilter?: string;
  onClose?: () => void;
  isAdmin?: boolean;
}) {
  const [pool, setPool] = useState<Vibe[]>([]);
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const { user } = useAuth();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  const isAdmin = propIsAdmin ?? ((user?.email || '').toLowerCase().includes('ikfah') || (user?.email || '').toLowerCase().includes('admin'));

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
    <div className="relative w-full h-full bg-black">
      {onClose && !isCommentOpen && (
        <div className="absolute left-0 right-0 top-0 z-[150] flex items-center justify-start p-4 md:justify-end pointer-events-none">
          <button
            onClick={onClose}
            className="p-3 bg-black/50 rounded-full text-white hover:text-vibe-accent border border-white/10 backdrop-blur-md pointer-events-auto shadow-2xl transition-all active:scale-90"
          >
            <X size={24} />
          </button>
        </div>
      )}

      <div className="w-full flex flex-col h-full overflow-y-auto snap-y snap-mandatory no-scrollbar select-none overscroll-y-contain bg-black feed-scroll">
        {vibes.map((vibe, index) => (
          <MemoizedFeedItem
            key={vibe.id}
            vibe={vibe}
            onReact={handleReact}
            onSave={handleSave}
            hasSaved={Boolean(vibe.savedBy?.[user?.uid || ''])}
            onOpenProfile={onOpenProfile}
            onToggleComments={setIsCommentOpen}
            isAdmin={isAdmin}
          />
        ))}
        {/* Sentinel for infinite loop */}
        <div ref={sentinelRef} className="h-px w-full flex-shrink-0" />
      </div>
    </div>
  );
}

const MemoizedFeedItem = React.memo(FeedItem, (prevProps, nextProps) => {
  return (
    prevProps.vibe.id === nextProps.vibe.id &&
    prevProps.vibe.viewsCount === nextProps.vibe.viewsCount &&
    prevProps.hasSaved === nextProps.hasSaved &&
    prevProps.isAdmin === nextProps.isAdmin &&
    JSON.stringify(prevProps.vibe.reactions) === JSON.stringify(nextProps.vibe.reactions) &&
    prevProps.vibe.comments?.length === nextProps.vibe.comments?.length
  );
});

export function FeedItem({ vibe, onReact, onSave, hasSaved, onOpenProfile, onToggleComments, isAdmin: propIsAdmin }: FeedItemProps & { onToggleComments?: (open: boolean) => void, isAdmin?: boolean }) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllReactions, setShowAllReactions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAdmin = propIsAdmin ?? ((user?.email || '').toLowerCase().includes('ikfah') || (user?.email || '').toLowerCase().includes('admin'));
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

  useEffect(() => {
    onToggleComments?.(showComments);
  }, [showComments, onToggleComments]);

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
        {vibe.mediaUrl ? (
          <>
            {/* Blurred Background Layer */}
            <div className="absolute inset-0 z-0">
               <img src={vibe.mediaUrl} alt="" className="h-full w-full object-cover opacity-30 blur-3xl scale-125" />
            </div>
            {/* Main Content Layer */}
            <div className="relative z-10 h-full w-full flex items-center justify-center">
               {vibe.type === 'video' ? (
                 <VideoBackdrop src={vibe.mediaUrl} />
               ) : (
                 <img src={vibe.mediaUrl} alt="" className="h-full w-full object-contain opacity-100" />
               )}
            </div>
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-vibe-accent/20 via-black to-vibe-bg" />
        )}
        <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
      </div>

      {/* Content Bottom Left */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col p-6 pb-28 md:pb-12 pointer-events-none">
        <div className="flex flex-col space-y-4 max-w-[85%]">
          {/* Profile Row */}
          <div className="flex items-center space-x-3 pointer-events-auto cursor-pointer" onClick={() => !vibe.isAnonymous && onOpenProfile(vibe.userId)}>
            <div className="h-11 w-11 overflow-hidden rounded-full border-2 border-vibe-accent/60 bg-vibe-line p-0.5 shadow-lg">
              {vibe.isAnonymous ? (
                <div className="flex h-full w-full items-center justify-center bg-vibe-bg text-vibe-accent"><Ghost size={18} /></div>
              ) : (
                <img src={vibe.authorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${vibe.userId}`} alt="" className="h-full w-full rounded-full object-cover" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{vibe.isAnonymous ? 'Someone Mysterious' : vibe.authorName}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-vibe-accent drop-shadow-md">{formatDistanceToNow(normalizeDate(vibe.createdAt))} ago</span>
            </div>
          </div>

          {/* Text Content */}
          <div className="pointer-events-auto">
            <p className={cn(
              "font-bold text-white tracking-tight leading-snug drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] transition-all",
              vibe.type === 'text' ? 'text-3xl' : 'text-base',
              !isExpanded && needsClamping && "line-clamp-3"
            )}>
              {content}
            </p>
            {needsClamping && (
              <button onClick={() => setIsExpanded(!isExpanded)} className="mt-2 text-[10px] font-black uppercase tracking-[2px] text-vibe-accent bg-black/40 px-3 py-1.5 rounded-md backdrop-blur-md border border-white/10">
                {isExpanded ? "Show Less" : "Read More"}
              </button>
            )}
          </div>

          {/* Badge Row */}
          <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
             <div className="flex items-center space-x-2 text-[10px] text-vibe-accent font-bold bg-vibe-accent/20 px-3 py-1.5 rounded-full border border-vibe-accent/30 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-vibe-accent animate-pulse" />
                <span className="uppercase">{totalReactions} Vibes</span>
             </div>
             <div className="flex items-center space-x-1.5 text-[10px] text-white bg-white/20 px-3 py-1.5 rounded-full border border-white/20 backdrop-blur-md">
                <Eye size={12} className="text-vibe-accent" />
                <span className="font-bold">{vibe.viewsCount || 0}</span>
             </div>
             <button onClick={() => setShowComments(true)} className="flex items-center space-x-1.5 text-[10px] font-bold text-white bg-white/20 px-3 py-1.5 rounded-full border border-white/20 backdrop-blur-md hover:bg-white/30 transition-all">
                <MessageCircle size={12} />
                <span>{vibe.comments?.length || 0}</span>
             </button>
             <button onClick={() => onSave(vibe)} className={cn("flex items-center space-x-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full border backdrop-blur-md transition-all", hasSaved ? "bg-vibe-accent/30 border-vibe-accent text-vibe-accent" : "bg-white/20 border-white/20 text-white")}>
                <Bookmark size={12} className={hasSaved ? "fill-current" : ""} />
                <span className="uppercase">{hasSaved ? 'Saved' : 'Save'}</span>
             </button>
             {vibe.mood && (
               <div className="flex items-center space-x-1.5 text-[9px] font-black text-white bg-white/10 px-3 py-1.5 rounded-full border border-white/10 uppercase tracking-widest shadow-lg">
                  <span className="h-1 w-1 rounded-full bg-vibe-accent" />
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
      <div className="absolute right-4 bottom-28 md:bottom-12 z-30 flex flex-col items-center space-y-4">
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
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30 }}
            className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-3xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/10 pt-12 md:pt-6">
              <h3 className="text-sm font-black uppercase tracking-[3px] text-vibe-accent">Comments</h3>
              <button onClick={() => setShowComments(false)} className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 text-white hover:bg-white/10"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-32">
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
            <form onSubmit={submitComment} className="p-4 bg-black/80 border-t border-white/10 flex items-center space-x-3 pb-10 md:pb-4 backdrop-blur-md">
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
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [feedback, setFeedback] = useState<'play' | 'pause' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const feedbackTimeout = useRef<any>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!isDragging) video.play().catch(() => {});
        setIsPlaying(true);
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }, { threshold: 0.6 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [isDragging]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isDragging) {
      const currentProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(currentProgress);
    }
  };

  const handleSeek = (e: React.MouseEvent | React.TouchEvent) => {
    if (!progressBarRef.current || !videoRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;

    setHoverX(x);
    const newTime = (percentage / 100) * videoRef.current.duration;
    setHoverTime(newTime);

    if (isDragging || e.type === 'click') {
      setProgress(percentage);
      videoRef.current.currentTime = newTime;
    }
  };

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    handleSeek(e);
  };

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (isDragging) {
        const rect = progressBarRef.current?.getBoundingClientRect();
        if (!rect || !videoRef.current) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const percentage = (x / rect.width) * 100;

        setHoverX(x);
        const newTime = (percentage / 100) * videoRef.current.duration;
        setHoverTime(newTime);

        setProgress(percentage);
        videoRef.current.currentTime = newTime;
      }
    };

    const handleGlobalUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setHoverTime(null);
        if (isPlaying) videoRef.current?.play().catch(() => {});
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('touchmove', handleGlobalMove);
      window.addEventListener('mouseup', handleGlobalUp);
      window.addEventListener('touchend', handleGlobalUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [isDragging, isPlaying]);

  const togglePlay = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDragging) return;
    e.stopPropagation();
    if (!videoRef.current) return;

    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);

    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      setFeedback('play');
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setFeedback('pause');
    }

    // Hide feedback icon after 500ms
    feedbackTimeout.current = setTimeout(() => {
      setFeedback(null);
    }, 500);
  };

  return (
    <div className="h-full w-full flex items-center justify-center relative pointer-events-auto cursor-pointer" onClick={togglePlay}>
      <video
        ref={videoRef}
        src={src}
        loop
        muted={isMuted}
        playsInline
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedData={() => setIsReady(true)}
        className={cn("max-h-full max-w-full object-contain transition-opacity duration-500", isReady ? "opacity-100" : "opacity-0")}
      />

      {/* Interactive Video Progress Bar */}
      {isReady && (
        <div
          ref={progressBarRef}
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          onMouseMove={handleSeek}
          onMouseLeave={() => !isDragging && setHoverTime(null)}
          className="absolute bottom-[110px] md:bottom-0 left-0 right-0 h-6 flex items-end z-[100] cursor-ew-resize group pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Time Preview Overlay */}
          <AnimatePresence>
            {hoverTime !== null && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                className="absolute bottom-8 px-2 py-1 rounded bg-black/80 border border-white/20 text-white text-[10px] font-mono pointer-events-none whitespace-nowrap z-[60]"
                style={{
                  left: hoverX,
                  transform: 'translateX(-50%)'
                }}
              >
                {formatTime(hoverTime)} / {videoRef.current ? formatTime(videoRef.current.duration) : '00:00'}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full h-1 bg-white/20 group-hover:h-1.5 transition-all">
            <motion.div
              className="h-full bg-vibe-accent relative shadow-[0_0_12px_rgba(0,255,209,0.8)]"
              style={{ width: `${progress}%` }}
              transition={{ type: "tween", ease: "linear", duration: 0.1 }}
            >
               {/* Scrubbing Handle (Visible when dragging or hovering) */}
               <div className={cn(
                 "absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-vibe-accent shadow-[0_0_15px_rgba(0,255,209,1)] scale-0 group-hover:scale-100 transition-transform",
                 isDragging && "scale-125"
               )} />
            </motion.div>
          </div>
        </div>
      )}

      {/* Dynamic Feedback Overlay (Play/Pause Pop) */}
      <AnimatePresence mode="popLayout">
        {feedback && (
          <motion.div
            key={feedback + Math.random()}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.8, scale: 1.2 }}
            exit={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
          >
             <div className="h-20 w-20 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-sm border border-white/10 text-white shadow-2xl">
                {feedback === 'play' ? <Play size={40} className="fill-current ml-1" /> : <Pause size={40} className="fill-current" />}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="absolute top-6 right-6 z-30 h-10 w-10 flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-xl border border-white/10 hover:bg-black/60 transition-all pointer-events-auto">
        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center">
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
