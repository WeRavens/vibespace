import React, { useState, useEffect } from 'react';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { Send, MessageCircle, Ghost } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SidebarRightProps {
  activeVibe: any;
}

export function SidebarRight({ activeVibe }: SidebarRightProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');

  const isIndonesian = language === 'id';

  useEffect(() => {
    if (!db || !activeVibe) {
      setComments([]);
      return;
    }

    const originalId = activeVibe.id.split('-repeat-')[0];
    const unsub = onSnapshot(doc(db, "vibes", originalId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const rawComments = data.comments || [];
        const formatted = rawComments.map((c: any) => ({
          ...c,
          createdAt: c.createdAt ? (typeof c.createdAt.toDate === 'function' ? c.createdAt.toDate() : new Date(c.createdAt)) : new Date()
        }));
        setComments(formatted);
      }
    });

    return () => unsub();
  }, [activeVibe?.id]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !user || !activeVibe || !db) return;

    const originalId = activeVibe.id.split('-repeat-')[0];
    try {
      const newComment = {
        id: Math.random().toString(36).substr(2, 9),
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        content: commentText.trim(),
        createdAt: new Date()
      };
      await updateDoc(doc(db, "vibes", originalId), {
        comments: arrayUnion(newComment)
      });
      setCommentText('');
    } catch (err) {
      console.error("Error submitting comment from sidebar:", err);
    }
  };

  return (
    <aside className="hidden lg:flex flex-col bg-vibe-bg w-[320px] h-full border-l border-vibe-line overflow-hidden">
      {activeVibe ? (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-5 border-b border-vibe-line flex items-center gap-2">
            <MessageCircle size={18} className="text-vibe-accent" />
            <h3 className="text-xs font-black uppercase tracking-[2px] text-white">
              {isIndonesian ? "Komentar" : "Comments"}
            </h3>
            <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-full text-white/80">
              {comments.length}
            </span>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-center space-y-2 opacity-50">
                <Ghost size={32} className="text-vibe-muted animate-pulse shrink-0" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-vibe-muted">
                  {isIndonesian ? "Sunyi di sini..." : "Quiet here..."}
                </p>
                <p className="text-xs text-vibe-muted">
                  {isIndonesian ? "Jadilah yang pertama berkomentar!" : "Be the first to comment!"}
                </p>
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex space-x-3 text-left">
                  <div className="h-8 w-8 rounded-full bg-vibe-accent/10 border border-vibe-accent/20 flex items-center justify-center text-xs font-black text-vibe-accent uppercase shrink-0">
                    {c.userName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-white truncate">{c.userName}</span>
                      <span className="text-[9px] text-vibe-muted shrink-0">
                        {formatDistanceToNow(c.createdAt instanceof Date ? c.createdAt : new Date())} ago
                      </span>
                    </div>
                    <p className="text-xs text-white/80 mt-1 leading-relaxed break-words">{c.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmitComment}
            className="p-4 border-t border-vibe-line bg-black/40 flex items-center gap-2 backdrop-blur-md"
          >
            <input
              type="text"
              placeholder={isIndonesian ? "Tambah komentar..." : "Add a comment..."}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-full py-2.5 px-4 text-xs text-white placeholder-vibe-muted focus:outline-none focus:border-vibe-accent transition-all"
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-vibe-accent text-vibe-bg disabled:opacity-30 hover:scale-105 active:scale-95 transition-transform shrink-0 cursor-pointer"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-vibe-line flex items-center justify-center text-vibe-muted">
            <MessageCircle size={24} />
          </div>
          <h4 className="text-xs font-bold uppercase tracking-[2px] text-white">
            {isIndonesian ? "Komentar Konten" : "Content Comments"}
          </h4>
          <p className="text-xs text-vibe-muted leading-relaxed">
            {isIndonesian
              ? "Pilih atau lihat postingan di Feed untuk melihat dan menulis komentar."
              : "Select or watch a post in the Feed to view and write comments."}
          </p>
        </div>
      )}
    </aside>
  );
}
