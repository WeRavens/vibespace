import React, { useEffect, useState, useRef, useMemo } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Vibe, MOODS } from "../lib/types";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageCircle,
  Trash2,
  Clock,
  X,
  Send,
  ShieldAlert,
  Bookmark,
  Infinity as InfinityIcon,
  Volume2,
  VolumeX,
  Plus,
  Play,
  Pause,
  Share2,
  Eye,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../lib/AuthContext";
import { Share } from "@capacitor/share";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { cn } from "../lib/utils";
import { Avatar } from "./Avatar";

const REACTION_EMOJIS = ["😊", "😍", "😂", "😮", "😢", "😎", "👏", "🔥"];

export function Feed({ userFilter, initialVibeId, activeMood, onOpenProfile }: { userFilter?: string; initialVibeId?: string; activeMood?: string | null; onOpenProfile?: (id: string) => void }) {
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [fetchedInitialVibe, setFetchedInitialVibe] = useState<Vibe | null>(null);
  const { user } = useAuth();
  const [isExplicitAdmin, setIsExplicitAdmin] = useState(false);

  useEffect(() => {
    if (initialVibeId && db) {
      getDoc(doc(db, "vibes", initialVibeId)).then((snap) => {
        if (snap.exists()) {
          setFetchedInitialVibe({ id: snap.id, ...snap.data() } as Vibe);
        }
      });
    } else {
      setFetchedInitialVibe(null);
    }
  }, [initialVibeId]);

  useEffect(() => {
    if (user && db) {
      getDoc(doc(db, 'users', user.uid)).then(d => {
         if (d.exists() && d.data()?.overrideAdmin) {
            setIsExplicitAdmin(true);
         }
      }).catch(e => console.error(e));
    }
  }, [user]);

  useEffect(() => {
    if (!db) return;

    const q = query(
      collection(db, "vibes"),
      orderBy("createdAt", "desc"),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const vibesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Vibe[];

        // Filter out expired client-side for immediate feedback
        const validVibes = vibesData.filter((v) => {
          if ((v as any).isPermanent || !v.expiresAt) return true;
          const expiresAt =
            v.expiresAt?.toDate?.() || new Date(v.expiresAt as string);
          return expiresAt > new Date();
        });

        // Deterministic sorting to prevent "glitching" or jumping items
        // We sort primarily by creation date for stability
        const stableSorted = validVibes.sort((a, b) => {
          const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
          const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
          return timeB - timeA;
        });

        setVibes(stableSorted);
      },
      (error) => {
        console.warn(
          "Firestore listener failed, switching to demo mode",
          error,
        );
        // Fallback to sample data if Firebase fails or permission denied
        setVibes(SAMPLE_VIBES);
      },
    );

    return unsubscribe;
  }, []);

  const handleReact = async (vibeId: string, emoji: string) => {
    if (!db || !user) return;
    const vibe = vibes.find((v) => v.id === vibeId);
    if (!vibe) return;

    // Optimistic UI update for immediate feedback
    setVibes(prev => prev.map(v => {
      if (v.id !== vibeId) return v;
      const nextUserReactions = { ...(v.userReactions || {}) };
      const nextReactions = { ...(v.reactions || {}) };
      const existing = nextUserReactions[user.uid];

      if (existing === emoji) {
        delete nextUserReactions[user.uid];
        nextReactions[emoji] = Math.max(0, (nextReactions[emoji] || 1) - 1);
      } else {
        if (existing) {
          nextReactions[existing] = Math.max(0, (nextReactions[existing] || 1) - 1);
        }
        nextUserReactions[user.uid] = emoji;
        nextReactions[emoji] = (nextReactions[emoji] || 0) + 1;
      }
      return { ...v, userReactions: nextUserReactions, reactions: nextReactions };
    }));

    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }

    try {
      const { runTransaction, doc } = await import('firebase/firestore');
      await runTransaction(db, async (transaction) => {
        const vibeDoc = await transaction.get(doc(db, "vibes", vibeId));
        if (!vibeDoc.exists()) return;

        const data = vibeDoc.data();
        const userReactions = { ...(data.userReactions || {}) };
        const reactions = { ...(data.reactions || {}) };
        const existing = userReactions[user.uid];

        if (existing === emoji) {
          delete userReactions[user.uid];
          reactions[emoji] = Math.max(0, (reactions[emoji] || 1) - 1);
          if (reactions[emoji] === 0) delete reactions[emoji];
        } else {
          if (existing) {
            reactions[existing] = Math.max(0, (reactions[existing] || 1) - 1);
            if (reactions[existing] === 0) delete reactions[existing];
          }
          userReactions[user.uid] = emoji;
          reactions[emoji] = (reactions[emoji] || 0) + 1;
        }

        transaction.update(doc(db, "vibes", vibeId), {
          reactions,
          userReactions
        });

        // Notifications (non-blocking)
        if (data.userId !== user.uid && existing !== emoji) {
           addDoc(collection(db, "notifications"), {
             targetUserId: data.userId,
             actorId: user.uid,
             actorName: user.displayName || "Anonymous",
             type: 'react',
             vibeId: vibeId,
             text: emoji,
             createdAt: serverTimestamp(),
             read: false
           }).catch(() => {});
        }
      });
    } catch (e: any) {
      console.error("Emoji update failed:", e);
      // If it fails (like permission denied), the next onSnapshot will naturally revert the UI
      if (e.code === 'permission-denied') {
        alert("Permission denied: You can only react if logged in.");
      }
    }
  };

  const filteredVibes = vibes.filter((v) => {
    if (activeMood && v.mood !== activeMood) return false;
    if (userFilter && v.userId !== userFilter) return false;
    return true;
  });

  const [pageMultiplier, setPageMultiplier] = useState(1);
  const bottomBoundaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bottomBoundaryRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPageMultiplier((prev) => prev + 1);
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(bottomBoundaryRef.current);
    return () => observer.disconnect();
  }, []);

  const repeatedVibes = useMemo(() => {
    if (filteredVibes.length === 0 && !fetchedInitialVibe) return [];
    
    // Sort so initialVibeId is strictly placed as the first element of the first page!
    let firstPageVibes = [...filteredVibes];

    if (fetchedInitialVibe) {
      firstPageVibes = firstPageVibes.filter(v => v.id !== fetchedInitialVibe.id);
      firstPageVibes.unshift(fetchedInitialVibe);
    } else if (initialVibeId) {
      const idx = firstPageVibes.findIndex(v => v.id === initialVibeId);
      if (idx !== -1) {
        const [target] = firstPageVibes.splice(idx, 1);
        firstPageVibes.unshift(target);
      }
    }

    let result = firstPageVibes.map(v => ({ ...v, uniqueKey: v.id + '-0' }));
    
    for (let i = 1; i < pageMultiplier; i++) {
        // Use a more stable "shuffled" order for repeated pages
        // We sort by ID + index to keep it consistent between renders
        const stableRepeat = [...filteredVibes].sort((a, b) => a.id.localeCompare(b.id));
        result = result.concat(stableRepeat.map((v, index) => ({ ...v, uniqueKey: v.id + '-' + i + '-' + index })));
    }
    return result;
  }, [filteredVibes, pageMultiplier, initialVibeId, fetchedInitialVibe]);

  return (
    <div className="flex flex-col items-center space-y-0 sm:space-y-12 w-full pb-8 sm:pb-0">
      <AnimatePresence mode="popLayout">
        {repeatedVibes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="mb-4 h-16 w-16 opacity-20">
              <ZapIcon />
            </div>
            <h3 className="text-xl font-bold opacity-40 uppercase tracking-widest">
              The space is empty.
            </h3>
            <p className="text-vibe-muted">Be the first to share your vibe.</p>
          </motion.div>
        ) : (
          repeatedVibes.map((vibe) => (
            <VibeCard
              key={vibe.uniqueKey}
              vibe={vibe}
              onReact={handleReact}
              isOwner={user?.uid === vibe.userId}
              currentUser={user}
              isExplicitAdmin={isExplicitAdmin}
              onOpenProfile={onOpenProfile}
            />
          ))
        )}
      </AnimatePresence>
      {/* Extremely critical flex-shrink spacer to ensure the last snapped card can clear the bottom nav perfectly on tricky mobile viewports */}
      <div ref={bottomBoundaryRef} className="h-[80px] w-full flex-shrink-0 block pointer-events-none" />
    </div>
  );
}

function VibeCard({
  vibe,
  onReact,
  isOwner,
  currentUser,
  isExplicitAdmin,
  onOpenProfile,
}: {
  vibe: Vibe;
  onReact: (id: string, e: string) => void;
  isOwner: boolean;
  currentUser: any;
  isExplicitAdmin?: boolean;
  key?: React.Key;
  onOpenProfile?: (id: string) => void;
}) {
  const [showMoodAnim, setShowMoodAnim] = useState(false);
  const moodEmoji = MOODS.find(m => m.id === vibe.mood)?.emoji;

  useEffect(() => {
    const hasSeenKey = `vibe-seen-${vibe.id}`;
    if (!localStorage.getItem(hasSeenKey)) {
      setShowMoodAnim(true);
      localStorage.setItem(hasSeenKey, 'true');
      const timer = setTimeout(() => setShowMoodAnim(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [vibe.id]);
  const timeStr = vibe.createdAt
    ? formatDistanceToNow(
        vibe.createdAt?.toDate?.() || new Date(vibe.createdAt),
      ) + " ago"
    : "Just now";
  const totalReactions = vibe.reactions
    ? Object.values(vibe.reactions).reduce((a, b) => a + b, 0)
    : 0;
  const viewsCount = (vibe as any).viewsCount || 0;
  const sortedReactions = Object.entries(vibe.reactions || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const visibleReactions = sortedReactions.slice(0, 5);
  const hiddenReactions = sortedReactions.slice(5);

  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showAllReactions, setShowAllReactions] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current || !db) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Count view after 2 seconds of being active
          const timer = setTimeout(async () => {
            const { increment } = await import('firebase/firestore');
            updateDoc(doc(db, "vibes", vibe.id), {
              viewsCount: increment(1)
            }).catch(() => {});
          }, 2000);
          return () => clearTimeout(timer);
        }
      },
      { threshold: 0.7 }
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [vibe.id]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUser || !db) return;

    const newComment = {
      id: Date.now().toString(),
      userId: currentUser.uid,
      userName: currentUser.displayName || "Anonymous",
      text: commentText.trim(),
      createdAt: Date.now(),
    };

    await updateDoc(doc(db, "vibes", vibe.id), {
      comments: [...(vibe.comments || []), newComment],
    });

    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    }

    setCommentText("");

    // Fire notification if not commenting on own post
    if (currentUser.uid !== vibe.userId) {
       try {
         await addDoc(collection(db, "notifications"), {
           targetUserId: vibe.userId,
           actorId: currentUser.uid,
           actorName: currentUser.displayName || "Anonymous",
           type: 'comment',
           vibeId: vibe.id,
           text: commentText.trim(),
           createdAt: serverTimestamp(),
           read: false
         });
       } catch (e) { console.error("Could not send comment notification", e); }
    }
  };

  const handleDelete = async () => {
    if (!db) return;
    if (confirm("Apakah kamu yakin ingin menghapus postingan ini?")) {
      try {
        await deleteDoc(doc(db, "vibes", vibe.id));
        alert("Postingan berhasil dihapus!");
      } catch (error) {
        console.error(error);
        alert(
          "Terjadi kesalahan saat menghapus. Pastikan aturan database mengizinkan.",
        );
      }
    }
  };

  const hasSaved = currentUser && (vibe as any).savedBy?.[currentUser.uid];

  const handleSave = async () => {
    if (!currentUser || !db) return;
    const currentSaves = { ...((vibe as any).savedBy || {}) };
    if (hasSaved) {
      delete currentSaves[currentUser.uid];
    } else {
      currentSaves[currentUser.uid] = true;
    }
    await updateDoc(doc(db, "vibes", vibe.id), {
      savedBy: currentSaves,
    });

    if (Capacitor.isNativePlatform()) {
      Haptics.notification({ type: ImpactStyle.Light as any }).catch(() => {});
    }
  };

  const handleShare = async () => {
    const shareUrl = `https://vibespace.app/vibe/${vibe.id}`;
    const shareText = `Check out this vibe by ${vibe.isAnonymous ? "SecretViber" : vibe.authorName} on VibeSpace!`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: 'VibeSpace',
          text: shareText,
          url: shareUrl,
          dialogTitle: 'Share this vibe',
        });
      } else if (navigator.share) {
        await navigator.share({
          title: 'VibeSpace',
          text: shareText,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link copied to clipboard!");
      }
    } catch (error) {
      console.error('Error sharing', error);
    }
  };

  const isAdmin =
    (currentUser?.email || "")?.toLowerCase()?.includes("ikfah") ||
    (currentUser?.email || "")?.toLowerCase()?.includes("admin") ||
    isExplicitAdmin;
  const canDelete = isOwner || isAdmin;

  const handleBanUser = async () => {
    if (!isAdmin || !db) return;
    if (confirm(`Apakah kamu yakin ingin memblokir/ban ${vibe.authorName}?`)) {
      try {
        await updateDoc(doc(db, "users", vibe.userId), {
          isBanned: true,
          bannedAt: Date.now(),
        });
        // We also record it in a banned list for safety
        const { setDoc } = await import("firebase/firestore");
        await setDoc(doc(db, "bannedUsers", vibe.userId), {
          bannedAt: Date.now(),
          reason: "Admin Action",
        });
        alert(`User ${vibe.authorName} telah di-banned!`);
      } catch (err) {
        console.error(err);
        alert("Gagal ban user");
      }
    }
  };

  return (
    <motion.div
      ref={cardRef}
      layout
      data-vibe-id={vibe.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative h-[calc(100dvh-72px)] md:h-[85vh] w-full max-w-4xl mx-auto snap-start sm:snap-center overflow-hidden sm:rounded-[40px] border-vibe-line sm:border bg-[#050505] shadow-[0_40px_100px_rgba(0,0,0,0.8)] group/card"
    >
      {vibe.mediaUrl ? (
        vibe.type === "video" ? (
          <VideoBackdrop src={vibe.mediaUrl} />
        ) : (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <img
              src={vibe.mediaUrl}
              alt="Vibe Content"
              loading="lazy"
              className="w-full h-full object-contain transition-transform duration-700 group-hover/card:scale-105"
            />
          </div>
        )
      ) : (
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#050505]" />
      )}

      <AnimatePresence>
        {showMoodAnim && moodEmoji && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
            <div className="text-9xl animate-melt select-none" style={{ textShadow: "0 0 60px rgba(0,255,209,0.4)" }}>
              {moodEmoji}
            </div>
          </div>
        )}
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

      {/* Premium Content Layout */}
      <div className="absolute inset-0 z-10 flex flex-col md:flex-row pointer-events-none">
        <div className="flex-1 flex flex-col justify-end p-6 md:p-14 sm:pb-8 pb-12">
          <div className="max-w-[90%] md:max-w-2xl">
            {/* User Header */}
            <div className="flex items-center space-x-4 mb-8">
               <Avatar
                src={!vibe.isAnonymous ? vibe.authorPhoto : undefined}
                name={vibe.isAnonymous ? "SecretViber" : vibe.authorName}
                className="h-12 w-12 border-2 border-white/20 shadow-xl"
                textClassName="text-base font-black"
              />
              <div className="flex-1">
                <div 
                  className="pointer-events-auto cursor-pointer font-extrabold text-white text-xl tracking-tight hover:text-vibe-accent transition-all active:scale-95"
                  onClick={(e) => { e.stopPropagation(); onOpenProfile?.(vibe.userId); }}
                >
                  {vibe.isAnonymous ? "SecretViber" : vibe.authorName}
                </div>
                <div className="text-[10px] text-white/40 font-black uppercase tracking-[0.25em] mt-0.5">
                  {timeStr}
                </div>
              </div>
            </div>

            {/* Content Text */}
            <div className="mb-8 pointer-events-auto">
              <h2
                onClick={() => vibe.content.length > 80 && setIsExpanded(!isExpanded)}
                className={cn(
                  "text-white leading-[1.3] font-bold tracking-tight drop-shadow-2xl selection:bg-vibe-accent/30 transition-all duration-300",
                  vibe.content.length > 60 ? "text-lg sm:text-2xl" : "text-2xl sm:text-3xl",
                  !isExpanded && vibe.content.length > 80 ? "line-clamp-3" : ""
                )}
              >
                 {vibe.content}
              </h2>
              {vibe.content.length > 80 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-2 text-vibe-accent text-[9px] font-bold uppercase tracking-[0.15em] opacity-80 hover:opacity-100 transition-opacity"
                >
                  {isExpanded ? "Show Less" : "Read More"}
                </button>
              )}
            </div>

            {/* Meta Info Badges */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2.5 text-xs text-vibe-accent font-black bg-vibe-accent/10 px-5 py-3 rounded-full border border-vibe-accent/20 backdrop-blur-2xl shadow-lg">
                <span className="h-1.5 w-1.5 rounded-full bg-vibe-accent animate-pulse shadow-[0_0_8px_rgba(0,255,209,0.8)]"></span>
                <span className="uppercase tracking-[0.1em]">{totalReactions} Vibes</span>
              </div>

              <div className="flex items-center space-x-2 text-xs text-white/90 font-bold bg-white/5 px-5 py-3 rounded-full border border-white/10 backdrop-blur-2xl">
                <Eye size={14} className="text-vibe-accent" />
                <span className="font-mono tracking-tighter">{viewsCount}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowComments(true)}
                className="pointer-events-auto flex items-center space-x-2.5 text-white/90 transition-all hover:bg-white/10 hover:border-white/20 bg-white/5 px-5 py-3 rounded-full border border-white/10 backdrop-blur-2xl group/btn"
              >
                <MessageCircle size={16} className="group-hover/btn:text-vibe-accent transition-colors" />
                <span className="text-xs font-black">{vibe.comments?.length || 0}</span>
              </button>

              {vibe.mood && (
                <div className="flex items-center space-x-2 text-[10px] text-white/80 font-bold bg-white/5 px-4 py-3 rounded-full border border-white/5 backdrop-blur-2xl uppercase tracking-widest">
                  <span className="w-1 h-1 rounded-full bg-vibe-accent/50"></span>
                  <span>{vibe.mood}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Floating Side Actions for Desktop */}
        <div className="hidden md:flex flex-col justify-end p-12 pb-14 space-y-4">
           <button
             onClick={handleSave}
             className={cn(
               "pointer-events-auto w-14 h-14 rounded-full flex items-center justify-center border transition-all hover:scale-110 active:scale-90 shadow-2xl backdrop-blur-xl",
               hasSaved ? "bg-vibe-accent/20 border-vibe-accent text-vibe-accent shadow-[0_0_20px_rgba(0,255,209,0.2)]" : "bg-white/5 border-white/10 text-white hover:bg-white/10"
             )}
           >
             <Bookmark size={24} className={hasSaved ? "fill-current" : ""} />
           </button>
           <button
             onClick={handleShare}
             className="pointer-events-auto w-14 h-14 rounded-full flex items-center justify-center border bg-white/5 border-white/10 text-white hover:bg-white/10 transition-all hover:scale-110 active:scale-90 shadow-2xl backdrop-blur-xl"
           >
             <Share2 size={24} />
           </button>
        </div>
      </div>

      <div className="absolute bottom-24 right-4 z-20 flex flex-col items-end gap-3">
        {/* Reaction List - Vertical Stack */}
        <div className="flex flex-col items-center gap-2 pointer-events-none">
          <AnimatePresence>
            {showAllReactions && sortedReactions.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                className="flex flex-col items-center gap-2 mb-1"
              >
                {sortedReactions.slice(1).reverse().map(([emoji, count]) => (
                  <button
                    key={`all-${emoji}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onReact(vibe.id, emoji);
                    }}
                    className={cn(
                      "pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/40 backdrop-blur-xl text-lg transition-all hover:scale-110 shadow-lg",
                      currentUser && vibe.userReactions?.[currentUser.uid] === emoji
                        ? "border-vibe-accent bg-vibe-accent/20"
                        : "",
                    )}
                  >
                    <span>{emoji}</span>
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[8px] font-black text-black">
                      {count}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Top Emoji & Toggle */}
          <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
             {sortedReactions.length > 1 && (
               <button
                 onClick={(e) => { e.stopPropagation(); setShowAllReactions(!showAllReactions); }}
                 className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 border border-white/10 text-white/70 hover:text-vibe-accent transition-all"
               >
                 {showAllReactions ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
               </button>
             )}

             {sortedReactions.length > 0 && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onReact(vibe.id, sortedReactions[0][0]);
                  }}
                  className={cn(
                    "relative flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-black/60 backdrop-blur-2xl text-2xl transition-all hover:scale-105 shadow-xl",
                    currentUser && vibe.userReactions?.[currentUser.uid] === sortedReactions[0][0]
                      ? "border-vibe-accent bg-vibe-accent/25 shadow-[0_0_20px_rgba(0,255,209,0.3)]"
                      : "",
                  )}
                >
                  <span>{sortedReactions[0][0]}</span>
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-black text-black shadow-md">
                    {sortedReactions[0][1]}
                  </span>
                </button>
             )}
          </div>
        </div>

        <AnimatePresence>
          {showReactionPicker && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.92 }}
              className="grid grid-cols-4 gap-2 rounded-3xl border border-white/15 bg-black/65 p-3 backdrop-blur-xl"
            >
              {REACTION_EMOJIS.map((emoji) => {
                const isActive =
                  currentUser && vibe.userReactions?.[currentUser.uid] === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onReact(vibe.id, emoji);
                      setShowReactionPicker(false);
                    }}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full border text-xl transition-all",
                      isActive
                        ? "border-vibe-accent bg-vibe-accent/20 scale-110"
                        : "border-white/10 bg-white/5 hover:scale-110",
                    )}
                    title={`Add ${emoji}`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setShowAllReactions(false);
            setShowReactionPicker((prev) => !prev);
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-black/75"
          title="Tambah emoji reaction"
        >
          <Plus size={18} />
        </button>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-20 flex flex-col bg-vibe-bg/95 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-vibe-line">
              <h3 className="text-sm font-bold uppercase tracking-widest text-vibe-ink">
                Comments
              </h3>
              <button
                onClick={() => setShowComments(false)}
                className="text-vibe-muted hover:text-vibe-accent"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              {!vibe.comments || vibe.comments.length === 0 ? (
                <div className="h-full flex items-center justify-center text-vibe-muted text-sm">
                  No comments yet. Start the conversation!
                </div>
              ) : (
                vibe.comments.map((comment) => (
                  <div key={comment.id} className="flex space-x-3">
                    <div className="h-8 w-8 rounded-full bg-vibe-line shrink-0 flex items-center justify-center text-xs font-bold text-vibe-muted uppercase">
                      {comment.userName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-sm font-bold text-vibe-ink">
                          {comment.userName}
                        </span>
                        <span className="text-[10px] text-vibe-muted font-mono">
                          {formatDistanceToNow(comment.createdAt)} ago
                        </span>
                      </div>
                      <p className="text-sm text-vibe-ink/80 mt-1">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={submitComment}
              className="p-4 border-t border-vibe-line bg-vibe-bg/80 relative"
            >
              <input
                type="text"
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="w-full bg-transparent border border-vibe-line rounded-full py-3 pl-4 pr-12 focus:outline-none focus:border-vibe-accent text-sm transition-colors text-vibe-ink placeholder:text-vibe-muted"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-vibe-accent disabled:opacity-30 disabled:text-vibe-muted transition-colors p-2"
              >
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function VideoBackdrop({ src }: { src: string }) {
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [playbackIndicator, setPlaybackIndicator] = useState<"play" | "pause" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting && entry.intersectionRatio >= 0.6);
      },
      { threshold: [0.25, 0.6, 0.9] },
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = isMuted;

    if (isVisible && isReady && !hasError && !isManuallyPaused) {
      void video.play().catch(() => {});

      // Increment view count if visible for more than 1s
      const timer = setTimeout(async () => {
         if (isVisible && db) {
            const { increment } = await import('firebase/firestore');
            const vibeId = (video as any).closest('[data-vibe-id]')?.getAttribute('data-vibe-id');
            if (vibeId) {
              updateDoc(doc(db, "vibes", vibeId), {
                viewsCount: increment(1)
              }).catch(() => {});
            }
         }
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      video.pause();
    }
  }, [hasError, isManuallyPaused, isMuted, isReady, isVisible]);

  useEffect(() => {
    if (!playbackIndicator) return;

    const timeout = window.setTimeout(() => {
      setPlaybackIndicator(null);
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [playbackIndicator]);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);

    if (!nextMuted) {
      void video.play().catch(() => {});
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video || !isReady || hasError) return;

    setIsManuallyPaused((prev) => {
      const nextPaused = !prev;
      setPlaybackIndicator(nextPaused ? "pause" : "play");
      if (nextPaused) {
        video.pause();
      } else {
        void video.play().catch(() => {});
      }
      return nextPaused;
    });
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-black"
      onClick={togglePlayback}
    >
      <video
        ref={videoRef}
        src={src}
        loop
        muted={isMuted}
        playsInline
        preload="metadata"
        className={cn(
          "absolute inset-0 h-full w-full object-contain transition-opacity duration-300",
          isReady ? "opacity-100" : "opacity-0",
        )}
        onLoadedData={() => setIsReady(true)}
        onCanPlay={() => setIsReady(true)}
        onError={() => setHasError(true)}
      />

      <AnimatePresence>
        {playbackIndicator && (
          <motion.div
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-[0_0_32px_rgba(0,0,0,0.3)] backdrop-blur-md">
              {playbackIndicator === "pause" ? (
                <Pause size={28} className="fill-current" />
              ) : (
                <Play size={28} className="translate-x-[2px] fill-current" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isReady && !hasError && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleMute();
          }}
          className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70"
          title={isMuted ? "Nyalakan suara" : "Matikan suara"}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      )}

      <AnimatePresence>
        {!isReady && !hasError && (
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-[#050505]"
          >
            <VibeVideoLoader />
          </motion.div>
        )}
      </AnimatePresence>

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#050505]">
          <div className="text-center">
            <VibeVideoLoader />
            <p className="mt-4 text-xs uppercase tracking-[2px] text-vibe-muted">
              Video unavailable
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function VibeVideoLoader() {
  return (
    <motion.div
      animate={{ scale: [1, 1.18, 1], opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      className="flex h-24 w-24 items-center justify-center rounded-full border border-vibe-accent/30 bg-vibe-accent/10 shadow-[0_0_40px_rgba(0,255,209,0.18)] backdrop-blur-md"
    >
      <span
        className="text-4xl font-black tracking-tight text-vibe-accent"
        style={{ textShadow: "0 0 24px rgba(0, 255, 209, 0.45)" }}
      >
        V
      </span>
    </motion.div>
  );
}

const SAMPLE_VIBES: Vibe[] = [
  {
    id: "demo-1",
    userId: "demo",
    authorName: "Aura",
    authorPhoto: "",
    content: "Just arrived at the beach. The vibes are immaculate! 🌊",
    type: "text",
    mood: "chill",
    isAnonymous: false,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
    reactions: { "🔥": 12, "❤️": 8 },
  },
  {
    id: "demo-2",
    userId: "demo-2",
    authorName: "Pixel",
    authorPhoto: "",
    content: "Coding VibeSpace is so fun! Can't wait to see everyone here.",
    type: "text",
    mood: "excited",
    isAnonymous: false,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
    reactions: { "😎": 5 },
  },
];

function ZapIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-zap h-full w-full"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
  );
}
