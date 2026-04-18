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
import { Vibe } from "../lib/types";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../lib/AuthContext";
import { cn } from "../lib/utils";

const REACTION_EMOJIS = ["😊", "😍", "😂", "😮", "😢", "😎", "👏", "🔥"];

export function Feed({ userFilter, initialVibeId, activeMood, onOpenProfile }: { userFilter?: string; initialVibeId?: string; activeMood?: string | null; onOpenProfile?: (id: string) => void }) {
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const { user } = useAuth();
  const [isExplicitAdmin, setIsExplicitAdmin] = useState(false);

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

        // Simple engagement/randomized algorithm
        // Instead of completely chronological, we mix in pseudo-randomness simulating an algorithm
        const algorithmSorted = validVibes.sort((a, b) => {
          const scoreA =
            (a.reactions ? Object.keys(a.reactions).length : 0) +
            Math.random() * 5;
          const scoreB =
            (b.reactions ? Object.keys(b.reactions).length : 0) +
            Math.random() * 5;
          return scoreB - scoreA;
        });

        setVibes(algorithmSorted);
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

    const currentUserReactions = { ...(vibe.userReactions || {}) };
    const currentReactions = { ...(vibe.reactions || {}) };

    const existingReact = currentUserReactions[user.uid];

    if (existingReact === emoji) {
      // Undo react
      delete currentUserReactions[user.uid];
      const nextCount = Math.max(0, (currentReactions[emoji] || 1) - 1);
      if (nextCount === 0) {
        delete currentReactions[emoji];
      } else {
        currentReactions[emoji] = nextCount;
      }
    } else {
      // Change or add react
      if (existingReact) {
        const previousCount = Math.max(
          0,
          (currentReactions[existingReact] || 1) - 1,
        );
        if (previousCount === 0) {
          delete currentReactions[existingReact];
        } else {
          currentReactions[existingReact] = previousCount;
        }
      }
      currentUserReactions[user.uid] = emoji;
      currentReactions[emoji] = (currentReactions[emoji] || 0) + 1;
      
      // Fire notification if not reacting to own post
      if (vibe.userId !== user.uid) {
        try {
           await addDoc(collection(db, "notifications"), {
             targetUserId: vibe.userId,
             actorId: user.uid,
             actorName: user.displayName || "Anonymous",
             type: 'react',
             vibeId: vibe.id,
             text: emoji,
             createdAt: serverTimestamp(),
             read: false
           });
        } catch (e) { console.error("Could not send notification", e); }
      }
    }

    await updateDoc(doc(db, "vibes", vibeId), {
      reactions: currentReactions,
      userReactions: currentUserReactions,
    });
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
    if (filteredVibes.length === 0) return [];
    
    // Sort so initialVibeId is strictly placed as the first element of the first page!
    let firstPageVibes = [...filteredVibes];
    if (initialVibeId) {
      const idx = firstPageVibes.findIndex(v => v.id === initialVibeId);
      if (idx !== -1) {
        const [target] = firstPageVibes.splice(idx, 1);
        firstPageVibes.unshift(target);
      }
    }

    let result = firstPageVibes.map(v => ({ ...v, uniqueKey: v.id + '-0' }));
    
    for (let i = 1; i < pageMultiplier; i++) {
        // Pseudo-random shuffle based on engagement + pure chaos
        const shuffled = [...filteredVibes].sort(() => Math.random() - 0.5);
        result = result.concat(shuffled.map((v, index) => ({ ...v, uniqueKey: v.id + '-' + i + '-' + index })));
    }
    return result;
  }, [filteredVibes, pageMultiplier, initialVibeId]);

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
  const timeStr = vibe.createdAt
    ? formatDistanceToNow(
        vibe.createdAt?.toDate?.() || new Date(vibe.createdAt),
      ) + " ago"
    : "Just now";
  const totalReactions = vibe.reactions
    ? Object.values(vibe.reactions).reduce((a, b) => a + b, 0)
    : 0;
  const sortedReactions = Object.entries(vibe.reactions || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const visibleReactions = sortedReactions.slice(0, 5);
  const hiddenReactions = sortedReactions.slice(5);

  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showAllReactions, setShowAllReactions] = useState(false);

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
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative h-[calc(100dvh-72px)] md:h-[85vh] w-full snap-start sm:snap-center overflow-hidden sm:rounded-2xl border-vibe-line sm:border bg-[#111] shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
    >
      {vibe.mediaUrl ? (
        vibe.type === "video" ? (
          <VideoBackdrop src={vibe.mediaUrl} />
        ) : (
          <div className="absolute inset-0 bg-black">
            <img
              src={vibe.mediaUrl}
              alt="Vibe Content"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-contain"
            />
          </div>
        )
      ) : (
        <div className="absolute inset-0 w-full h-full bg-[#111]" />
      )}

      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end p-8 sm:pb-8 pb-10">
        <div className="md:w-3/4 flex max-h-full flex-col">
          {vibe.isAnonymous && (
            <div className="pointer-events-auto mb-4 inline-flex self-start rounded bg-vibe-muted/30 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-sm">
              Anonymous Vibe
            </div>
          )}

          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 overflow-hidden rounded-full border border-vibe-ink bg-vibe-accent">
                {!vibe.isAnonymous && vibe.authorPhoto && (
                  <img src={vibe.authorPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div 
                  className="pointer-events-auto block cursor-pointer truncate font-serif font-bold tracking-tight text-white transition-colors hover:text-vibe-accent"
                  onClick={(e) => { e.stopPropagation(); onOpenProfile?.(vibe.userId); }}
                >
                  {vibe.isAnonymous ? "SecretViber" : vibe.authorName}
                </div>
                <div className="text-[10px] text-vibe-muted uppercase tracking-widest font-mono">
                  {timeStr}
                </div>
              </div>
            </div>

            <div className="text-vibe-muted font-bold tracking-tight bg-black/40 backdrop-blur-md rounded-full p-2 border border-white/10">
              {(vibe as any).isPermanent ? <InfinityIcon size={16} title="Permanent" /> : <Clock size={16} title="24h Left" />}
            </div>
          </div>

          <h2 className="caption-serif mb-6 text-vibe-ink">{vibe.content}</h2>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-vibe-ink font-bold">
                <span className="neon-dot"></span>
                <span>{totalReactions} Vibes</span>
              </div>
              <button
                type="button"
                onClick={() => setShowComments(true)}
                className="pointer-events-auto flex flex-col items-center justify-center text-vibe-muted transition-colors hover:text-vibe-accent"
                title="Comments"
              >
                <MessageCircle size={22} className="mb-0.5" />
                <span className="text-[10px] font-bold">
                  {vibe.comments?.length || 0}
                </span>
              </button>
            </div>

            <div className="pointer-events-auto flex space-x-2">
              <button
                type="button"
                onClick={handleSave}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border transition-all",
                  hasSaved
                    ? "border-vibe-accent bg-vibe-accent/20 text-vibe-accent shadow-[0_0_15px_rgba(0,255,209,0.3)]"
                    : "border-vibe-line bg-vibe-ink/5 text-vibe-muted hover:text-white",
                )}
                title={hasSaved ? "Unsave Post" : "Save Post"}
              >
                <Bookmark
                  size={16}
                  className={hasSaved ? "fill-current" : ""}
                />
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-red-900 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-md hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                  title="Hapus Postingan"
                >
                  <Trash2 size={16} />
                </button>
              )}
              {isAdmin && !isOwner && (
                <button
                  type="button"
                  onClick={handleBanUser}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-vibe-line bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-white transition-all shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                  title="Ban User"
                >
                  <ShieldAlert size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-24 right-4 z-20 flex flex-col items-end gap-2">
        <AnimatePresence>
          {showAllReactions && sortedReactions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="flex max-w-[75vw] flex-wrap justify-end gap-2 rounded-3xl border border-white/15 bg-black/70 p-3 backdrop-blur-xl"
            >
              {sortedReactions.map(([emoji, count]) => (
                <button
                  key={`all-${emoji}`}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onReact(vibe.id, emoji);
                    setShowAllReactions(false);
                  }}
                  className={cn(
                    "relative flex min-w-[44px] items-center justify-center rounded-full border border-white/15 bg-black/55 px-3 py-2 text-lg text-white backdrop-blur-md transition-transform hover:scale-105",
                    currentUser && vibe.userReactions?.[currentUser.uid] === emoji
                      ? "border-vibe-accent bg-vibe-accent/20 shadow-[0_0_18px_rgba(0,255,209,0.22)]"
                      : "",
                  )}
                  title={`React with ${emoji}`}
                >
                  <span>{emoji}</span>
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black">
                    {count}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex max-w-[75vw] flex-wrap justify-end gap-2">
          {visibleReactions.map(([emoji, count]) => (
            <button
              key={emoji}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onReact(vibe.id, emoji);
              }}
              className={cn(
                "relative flex min-w-[42px] items-center justify-center rounded-full border border-white/15 bg-black/55 px-3 py-2 text-base text-white backdrop-blur-md transition-transform hover:scale-105",
                currentUser && vibe.userReactions?.[currentUser.uid] === emoji
                  ? "border-vibe-accent bg-vibe-accent/20 shadow-[0_0_18px_rgba(0,255,209,0.22)]"
                  : "",
              )}
              title={`React with ${emoji}`}
            >
              <span>{emoji}</span>
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black">
                {count}
              </span>
            </button>
          ))}
          {hiddenReactions.length > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowAllReactions((prev) => !prev);
              }}
              className="flex h-10 min-w-[42px] items-center justify-center rounded-full border border-white/15 bg-black/55 px-3 text-sm font-bold tracking-[0.2em] text-white backdrop-blur-md transition-transform hover:scale-105"
              title="Lihat semua emoji"
            >
              ...
            </button>
          )}
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
