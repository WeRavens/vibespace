import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Play, Plus, X, Image, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressImage, validateMediaFile } from '../lib/imageUtils';

interface Story {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  mediaUrl: string;
  type: 'image' | 'video';
  createdAt: any;
  expiresAt: number;
  views: string[];
}

export function Stories() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!db) return;
    
    const q = query(
      collection(db, 'stories'),
      where('expiresAt', '>', Date.now()),
      orderBy('expiresAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const storiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      setStories(storiesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateStory = async (file: File) => {
    if (!user) return;
    
    const validation = validateMediaFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setIsCreating(true);
    setUploadProgress(10);

    try {
      let mediaUrl = file;
      
      if (file.type.startsWith('image/')) {
        setUploadProgress(30);
        mediaUrl = await compressImage(file) as any;
      }

      setUploadProgress(60);

      const formData = new FormData();
      formData.append('file', mediaUrl);
      formData.append('upload_preset', 'zgsciaie6');

      const res = await fetch('https://api.cloudinary.com/v1_1/df0sltu6v/auto/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      
      setUploadProgress(80);

      await addDoc(collection(db, 'stories'), {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhoto: user.photoURL || '',
        mediaUrl: data.secure_url,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        createdAt: serverTimestamp(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        views: []
      });

      setUploadProgress(100);
      setIsCreating(false);
    } catch (error) {
      console.error('Error creating story:', error);
      alert('Failed to create story. Please try again.');
      setIsCreating(false);
    }
  };

  const handleViewedStory = async (story: Story) => {
    if (!user || story.views.includes(user.uid)) return;
    
    try {
      const storyRef = doc(db, 'stories', story.id);
      await updateDoc(storyRef, {
        views: arrayUnion(user.uid)
      });
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  };

  const groupedStories = useMemo(() => {
    const groups: Record<string, Story[]> = {};
    if (stories) {
      (stories as Story[]).forEach((story: Story) => {
        if (!groups[story.userId]) {
          groups[story.userId] = [];
        }
        groups[story.userId].push(story);
      });
    }
    return groups;
  }, [stories]);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 overflow-hidden p-4">
        <div className="h-16 w-16 animate-pulse rounded-full bg-vibe-line" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 w-16 animate-pulse rounded-full bg-vibe-line" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center space-x-2 overflow-x-auto p-4 no-scrollbar">
        {/* Add Story Button */}
        {user && (
          <div className="relative flex-shrink-0 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="h-16 w-16 rounded-full border-2 border-vibe-accent bg-vibe-bg p-0.5">
              <img 
                src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                alt="Your story"
                className="h-full w-full rounded-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-vibe-accent">
              <Plus size={14} className="text-black" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCreateStory(file);
              }}
            />
          </div>
        )}

        {/* Story Rings */}
        {(Object.entries(groupedStories) as [string, Story[]][]).slice(0, 10).map(([userId, userStoriesArr]) => {
          const firstStory = userStoriesArr[0];
          const hasMultiple = (userStoriesArr as Story[]).length > 1;
          return (
          <div 
            key={userId}
            className="relative flex-shrink-0 cursor-pointer"
            onClick={() => {
              setSelectedStory(firstStory);
              setCurrentIndex(0);
            }}
          >
            <div className="h-16 w-16 rounded-full border-2 border-vibe-accent bg-transparent p-0.5">
              <img 
                src={firstStory?.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} 
                alt={firstStory?.userName}
                className="h-full w-full rounded-full object-cover"
              />
            </div>
            {hasMultiple && (
              <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-vibe-accent text-[10px] font-bold text-black">
                {userStoriesArr.length}
              </div>
            )}
            <p className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-vibe-muted truncate w-16 text-center">
              {firstStory?.userName?.slice(0, 8) || 'User'}
            </p>
          </div>
        )})}
      </div>

      {/* Story Viewer Modal */}
      <AnimatePresence>
        {selectedStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          >
            <button
              onClick={() => setSelectedStory(null)}
              className="absolute top-6 right-6 z-10 p-2 text-white hover:bg-white/10 rounded-full"
            >
              <X size={24} />
            </button>

            <div className="relative h-full w-full max-w-md">
              <StoryMedia 
                story={selectedStory} 
                onNext={() => {
                  const userStoryList = groupedStories[selectedStory.userId];
                  const idx = userStoryList.findIndex(s => s.id === selectedStory.id);
                  if (idx < userStoryList.length - 1) {
                    setCurrentIndex(idx + 1);
                    setSelectedStory(userStoryList[idx + 1]);
                  } else {
                    setSelectedStory(null);
                  }
                }}
                onPrev={() => {
                  const userStoryList = groupedStories[selectedStory.userId];
                  const idx = userStoryList.findIndex(s => s.id === selectedStory.id);
                  if (idx > 0) {
                    setCurrentIndex(idx - 1);
                    setSelectedStory(userStoryList[idx - 1]);
                  }
                }}
              />
              
              {/* Story Info */}
              <div className="absolute top-6 left-6 right-20 z-10">
                <div className="flex items-center space-x-3">
                  <img 
                    src={selectedStory.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStory.userId}`}
                    alt={selectedStory.userName}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <span className="text-sm font-bold text-white">{selectedStory.userName}</span>
                  <span className="text-xs text-white/60">{formatDistanceToNow(selectedStory.createdAt?.toDate?.() || new Date())}</span>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="absolute top-14 left-6 right-6 z-10 flex space-x-1">
                {groupedStories[selectedStory.userId]?.map((_, idx) => (
                  <div key={idx} className="flex-1 h-0.5 rounded-full bg-white/30">
                    <div 
                      className="h-full rounded-full bg-white transition-all"
                      style={{ width: idx < currentIndex ? '100%' : idx === currentIndex ? '50%' : '0%' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Progress */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          >
            <div className="text-center">
              <div className="mb-4 h-16 w-16 rounded-full border-4 border-vibe-accent/20 border-t-vibe-accent animate-spin" />
              <p className="text-sm font-bold text-white">Uploading Story...</p>
              <p className="mt-2 text-xs text-vibe-muted">{uploadProgress}%</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StoryMedia({ story, onNext, onPrev }: { story: Story; onNext: () => void; onPrev: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (story.type === 'video' && videoRef.current) {
      videoRef.current.play();
    }
  }, [story.id]);

  return (
    <div 
      className="absolute inset-0 flex items-center justify-center"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const isLeft = x < rect.width / 3;
        const isRight = x > (rect.width / 3) * 2;
        
        if (isLeft) onPrev();
        else if (isRight) onNext();
        else onNext();
      }}
    >
      {story.type === 'video' ? (
        <video
          ref={videoRef}
          src={story.mediaUrl}
          className="h-full w-full object-contain"
          playsInline
          muted
          onEnded={onNext}
        />
      ) : (
        <img
          src={story.mediaUrl}
          alt="Story"
          className="h-full w-full object-contain"
        />
      )}
    </div>
  );
}