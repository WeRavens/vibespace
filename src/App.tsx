/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Feed } from './components/Feed';
import { CreateVibe } from './components/CreateVibe';
import { SidebarLeft } from './components/SidebarLeft';
import { SidebarRight } from './components/SidebarRight';
import { Landing } from './components/Landing';
import { Explore } from './components/Explore';
import { Notifications } from './components/Notifications';
import { ProfileGrid } from './components/ProfileGrid';
import { Avatar } from './components/Avatar';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Command, Search, Bell, User, Ghost, LogOut, Edit2, Check, X, Camera, ShieldAlert } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, getDoc, collection, query, where, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import { UploadProvider, useUpload } from './lib/UploadContext';
import { LanguageProvider, useLanguage } from './lib/LanguageContext';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

function VibeSpace() {
  const { user, loading, logout } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('Feed');
  const [showCreate, setShowCreate] = useState(false);
  const [editNameMode, setEditNameMode] = useState(false);
  const [profileTab, setProfileTab] = useState<'posts'|'saved'>('posts');
  const [newName, setNewName] = useState('');
  const [activeMood, setActiveMood] = useState<string | null>(null);
  
  const [focusedVibeId, setFocusedVibeId] = useState<string | undefined>(undefined);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [showBioModal, setShowBioModal] = useState(false);
  const [editBioMode, setEditBioMode] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isExplicitAdmin, setIsExplicitAdmin] = useState(false);
  const [isProfileViewerOpen, setIsProfileViewerOpen] = useState(false);
  const bioMaxLength = 80;
  
  const [userStats, setUserStats] = useState({ video: 0, vibes: 0 });

  useEffect(() => {
    // Check web URL on mount
    const path = window.location.pathname;
    const match = path.match(/\/vibe\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      setFocusedVibeId(match[1]);
      setActiveTab('Feed');
    }

    if (!Capacitor.isNativePlatform()) return;

    const handleDeepLink = (data: { url: string }) => {
      console.log('Deep link received:', data.url);
      try {
        const url = new URL(data.url);
        let vibeId = '';

        if (url.protocol === 'vibespace:') {
          // vibespace://vibe/ID -> host is vibe, pathname is /ID
          if (url.host === 'vibe') {
            vibeId = url.pathname.replace(/^\//, '');
          }
        } else if (url.hostname.includes('vibespace.app')) {
          // https://vibespace.app/vibe/ID
          const match = url.pathname.match(/\/vibe\/([a-zA-Z0-9_-]+)/);
          if (match) vibeId = match[1];
        }

        if (vibeId) {
          setFocusedVibeId(vibeId);
          setActiveTab('Feed');
          // Force scroll to top of feed
          setTimeout(() => {
            const mainEl = document.querySelector('main');
            if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
          }, 100);
        }
      } catch (e) {
        console.error('Error parsing deep link', e);
      }
    };

    const urlListener = CapacitorApp.addListener('appUrlOpen', handleDeepLink);

    // Check for initial URL
    CapacitorApp.getLaunchUrl().then(urlData => {
      if (urlData) handleDeepLink(urlData);
    });

    return () => {
      urlListener.then(l => l.remove());
    };
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setIsExplicitAdmin(false);
      return;
    }

    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        setIsExplicitAdmin(Boolean(snap.exists() && snap.data()?.overrideAdmin));
      })
      .catch((error) => {
        console.error('Error checking admin access', error);
        setIsExplicitAdmin(false);
      });
  }, [user?.uid]);

  const isAdmin =
    (user?.email || '').toLowerCase().includes('ikfah') ||
    (user?.email || '').toLowerCase().includes('admin') ||
    isExplicitAdmin;
  const isViewingOwnProfile = viewingUser?.uid === user?.uid;
  const isViewingOtherProfile = Boolean(viewingUser?.uid && user?.uid && viewingUser.uid !== user.uid);

  // Fetch real statistics for profile
  useEffect(() => {
    if (!viewingUser?.uid || !db) return;
    const fetchStats = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'vibes'), where('userId', '==', viewingUser.uid)));
        let videoCount = snap.size;
        let vibesCount = 0;
        snap.forEach(doc => {
           const reactions = doc.data().reactions || {};
           vibesCount += Object.values(reactions).reduce((a: any, b: any) => a + b, 0) as number;
        });
        setUserStats({ video: videoCount, vibes: vibesCount });
      } catch (e) {
        console.error("Error fetching stats", e);
      }
    };
    fetchStats();
  }, [viewingUser?.uid]);

  useEffect(() => {
    const handleOpen = () => setShowCreate(true);
    document.addEventListener('openCreate', handleOpen);
    return () => document.removeEventListener('openCreate', handleOpen);
  }, []);

  const handleUpdateName = async () => {
    if (!newName.trim() || !auth?.currentUser) return;
    try {
      await updateProfile(auth.currentUser, { displayName: newName.trim() });
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { displayName: newName.trim() });
      setEditNameMode(false);
      window.location.reload();
    } catch (e) {
      alert(t('failedUpdateName'));
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser || !db) return;

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'zgsciaie');

      const res = await fetch('https://api.cloudinary.com/v1_1/df0sltu6v/auto/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error('Cloudinary upload failed');
      }

      const data = await res.json();

      if (data.secure_url) {
        await updateProfile(auth.currentUser, { photoURL: data.secure_url });
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { photoURL: data.secure_url });
        await auth.currentUser.reload();
        setViewingUser((current: any) => current ? { ...current, photoURL: data.secure_url } : current);
      } else {
        throw new Error('Photo URL was not returned');
      }

      e.target.value = '';
    } catch(err) {
      console.error('Failed to upload profile photo:', err);
      alert(t('uploadFailed'));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleUpdateBio = async () => {
    if (!auth?.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { bio: newBio.trim() });
      setViewingUser({ ...viewingUser, bio: newBio.trim() });
      setEditBioMode(false);
    } catch(e) { alert(t('failedUpdateDescription')); }
  };

  const handleOpenVibe = (id: string) => {
    setFocusedVibeId(id);
    setActiveTab('Feed');
  };

  const handleOpenProfile = async (targetId: string) => {
    if (targetId === user?.uid) {
       setViewingUser(user);
    } else {
       const snap = await getDoc(doc(db, 'users', targetId));
       if (snap.exists()) {
          setViewingUser({ uid: targetId, ...snap.data() });
       }
    }
    setActiveTab('Profile');
  };

  const handleToggleBlockUser = async () => {
    if (!isAdmin || !isViewingOtherProfile || !viewingUser?.uid || !db) return;

    const nextBlockedState = !viewingUser.isBanned;
    const actionLabel = nextBlockedState ? 'memblokir' : 'membuka blokir';
    const targetName = viewingUser.displayName || 'user ini';

    if (!confirm(`Apakah kamu yakin ingin ${actionLabel} ${targetName}?`)) {
      return;
    }

    try {
      if (nextBlockedState) {
        await updateDoc(doc(db, 'users', viewingUser.uid), {
          isBanned: true,
          bannedAt: Date.now(),
        });
        await setDoc(doc(db, 'bannedUsers', viewingUser.uid), {
          bannedAt: Date.now(),
          reason: 'Admin Action',
        });
      } else {
        await updateDoc(doc(db, 'users', viewingUser.uid), {
          isBanned: false,
          unbannedAt: Date.now(),
        });
        await deleteDoc(doc(db, 'bannedUsers', viewingUser.uid));
      }

      setViewingUser((current: any) =>
        current ? { ...current, isBanned: nextBlockedState } : current,
      );
      alert(
        nextBlockedState
          ? `${targetName} berhasil diblokir.`
          : `${targetName} berhasil dibuka blokirnya.`,
      );
    } catch (error) {
      console.error('Failed to update block state', error);
      alert('Gagal memperbarui status blokir user.');
    }
  };

  // Re-sync viewingUser if we switch to profile tab naturally
  useEffect(() => {
    if (activeTab === 'Profile' && !viewingUser) {
      setViewingUser(user);
    }
    if (activeTab !== 'Feed') {
      setFocusedVibeId(undefined);
    }
  }, [activeTab]);

  useEffect(() => {
    setEditNameMode(false);
    setEditBioMode(false);
    setShowBioModal(false);
    setIsProfileViewerOpen(false);
    setNewName('');
    setNewBio('');

    if (!user) {
      setViewingUser(null);
      return;
    }

    setViewingUser((current: any) => {
      if (!current) {
        return activeTab === 'Profile' ? user : null;
      }

      if (current.uid !== user.uid) {
        return activeTab === 'Profile' ? user : null;
      }

      return { ...current, ...user };
    });
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-vibe-bg">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-4xl font-extrabold tracking-tighter text-vibe-accent"
          style={{ textShadow: '0 0 20px rgba(0, 255, 209, 0.4)' }}
        >
          V
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <Landing />;
  }

  return (
    <div className="flex h-[100dvh] w-full bg-vibe-bg overflow-hidden flex-col md:flex-row">
      <FloatingUploadIndicator />
      <div className="flex-1 grid h-full w-full grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[280px_1fr_300px] gap-px bg-vibe-line">
        {/* Sidebar Left */}
        <SidebarLeft activeTab={activeTab} setActiveTab={setActiveTab} activeMood={activeMood} setActiveMood={setActiveMood} />
        
        {/* Main Feed Container */}
        <div className="relative w-full h-full bg-[#050505] overflow-hidden">
          
          {/* Desktop Logout Icon (Top Right of Feed Frame) */}
          <div className="hidden md:flex absolute top-6 right-6 lg:right-8 z-[60]">
             <button 
               onClick={logout} 
               className="p-3 text-red-500/80 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all flex items-center justify-center backdrop-blur-md border border-transparent hover:border-red-500/30 shadow-lg" 
               title={t('logOut')}
             >
                <LogOut size={20} />
             </button>
          </div>

          <main className="w-full h-full flex flex-col items-center justify-start overflow-y-auto no-scrollbar scroll-smooth snap-y snap-mandatory pb-[72px] md:pb-0">
            <div className={activeTab === 'Profile' ? 'w-full max-w-[1120px] min-h-full px-0 md:px-6 py-4 md:py-8 flex flex-col' : 'w-full sm:max-w-[480px] lg:max-w-[550px] sm:py-6 md:py-10 min-h-full flex flex-col'}>
            {activeTab === 'Feed' ? (
              <Feed activeMood={activeMood} initialVibeId={focusedVibeId} onOpenProfile={handleOpenProfile} />
            ) : activeTab === 'Profile' && viewingUser ? (
              <div className="flex flex-col items-start justify-start h-full sm:h-[100dvh] pt-10 px-4 md:px-6 lg:px-8 w-full relative">
                
                {/* Mobile Logout Icon Top Right */}
                {!isProfileViewerOpen && (
                <div className="absolute top-4 right-4 md:hidden z-20">
                  <button onClick={logout} className="p-3 text-red-500/80 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors flex items-center justify-center">
                    <LogOut size={24} />
                  </button>
                </div>
                )}

                {/* Ambient Glassmorphism Hero Banner */}
                {viewingUser.photoURL && (
                   <div className="absolute inset-x-0 top-0 h-[42vh] overflow-hidden pointer-events-none select-none z-0">
                      <img src={viewingUser.photoURL} alt="" className="w-full h-full object-cover blur-[120px] saturate-[1.6] scale-[1.35] opacity-55 transform-gpu" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,209,0.12),transparent_45%)]" />
                      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/8 via-[#03130f]/55 to-[#050505]" />
                      <div className="absolute inset-x-6 top-6 h-40 rounded-[36px] border border-white/8 bg-white/[0.03] backdrop-blur-2xl" />
                   </div>
                )}

                {/* Context Layer */}
                <div className="relative z-10 w-full flex flex-col">
                  {/* Profile Header Row (YouTube Style) */}
                  <div className="mb-6 mt-4 flex w-full flex-col gap-5 rounded-[32px] border border-white/8 bg-white/[0.03] p-5 backdrop-blur-2xl sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center space-x-4 sm:space-x-6 min-w-0">
                  <div className="w-20 h-20 sm:w-28 sm:h-28 shrink-0 relative group">
                     <Avatar
                       src={viewingUser.photoURL}
                       name={viewingUser.displayName}
                       alt="Profile"
                       className="h-full w-full border-2 border-vibe-muted bg-[#050505]"
                       textClassName="text-3xl sm:text-4xl"
                     />
                     {isViewingOwnProfile && (
                       <div 
                         className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                         onClick={() => !isUploadingPhoto && fileInputRef.current?.click()}
                       >
                         {isUploadingPhoto ? (
                           <span className="text-xs font-bold uppercase tracking-[2px] text-white">
                             Uploading
                           </span>
                         ) : (
                           <Camera className="text-white" size={24} />
                         )}
                       </div>
                     )}
                     <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploadingPhoto} />
                  </div>
                  
                  <div className="flex flex-col items-start justify-center flex-1 min-w-0 text-left">
                    <div className="flex items-center space-x-2 w-full">
                       <h2 className="text-xl sm:text-3xl lg:text-4xl font-bold tracking-tighter text-white truncate">
                         {viewingUser.displayName || t('anonymous')}
                       </h2>
                       {isViewingOwnProfile && (
                         <Edit2 size={14} className="text-vibe-muted hover:text-white cursor-pointer transition-colors shrink-0" onClick={() => { setNewName(viewingUser.displayName || ''); setEditNameMode(true); }} />
                       )}
                    </div>
                    <p className="text-vibe-muted font-bold text-sm sm:text-base mt-1 truncate drop-shadow-md">
                       @{viewingUser.email?.split('@')[0] || viewingUser.uid.substring(0,6)}
                    </p>
                    <p className="text-vibe-muted text-xs sm:text-sm mt-1 truncate drop-shadow-md">
                       <span className="text-white font-bold">{userStats.video}</span> {t('postCountLabel')} • <span className="text-white font-bold">{userStats.vibes}</span> {t('vibesLabel')}
                    </p>
                  </div>
                </div>

                  {isAdmin && isViewingOtherProfile && (
                    <div className="mb-6 flex w-full flex-col gap-3 sm:w-auto sm:min-w-[220px]">
                      <button
                        onClick={handleToggleBlockUser}
                        className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[2px] transition-all ${
                          viewingUser.isBanned
                            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20'
                            : 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                        }`}
                      >
                        <ShieldAlert size={16} />
                        {viewingUser.isBanned ? t('unblockUser') : t('blockUser')}
                      </button>
                      <p className="text-left text-[11px] uppercase tracking-[2px] text-vibe-muted">
                        {t('status')}: {viewingUser.isBanned ? t('blocked') : t('active')}
                      </p>
                    </div>
                  )}
                  </div>

                {/* Profile Description */}
                <div className="w-full text-left mb-6 text-sm text-vibe-muted rounded-[28px] border border-white/6 bg-black/20 p-4 sm:p-5">
                   {editBioMode && isViewingOwnProfile ? (
                      <div className="flex flex-col space-y-2 w-full sm:w-3/4">
                         <textarea 
                           value={newBio} 
                           onChange={e => setNewBio(e.target.value)} 
                           className="w-full bg-[#111] p-3 rounded-xl border border-vibe-line text-white focus:border-vibe-accent outline-none no-scrollbar resize-none" 
                           rows={3} 
                           placeholder={t('writeDescription')}
                         />
                         <div className="flex space-x-2">
                           <button onClick={handleUpdateBio} className="px-4 py-1.5 text-xs bg-vibe-accent text-vibe-bg font-bold rounded-lg hover:opacity-80 transition-opacity">{t('save')}</button>
                           <button onClick={() => setEditBioMode(false)} className="px-4 py-1.5 text-xs border border-vibe-line text-vibe-muted font-bold rounded-lg hover:text-white transition-colors">{t('cancel')}</button>
                         </div>
                      </div>
                   ) : (
                      <div className="relative group w-full">
                         <p className="whitespace-pre-wrap leading-relaxed inline">
                            {viewingUser.bio ? (
                               viewingUser.bio.length > bioMaxLength 
                                 ? viewingUser.bio.substring(0, bioMaxLength) + ' '
                                 : viewingUser.bio
                            ) : isViewingOwnProfile ? t('noProfileDescriptionSelf') : t('noProfileDescriptionOther')}
                         </p>
                         {viewingUser.bio && viewingUser.bio.length > bioMaxLength && (
                           <button onClick={() => setShowBioModal(true)} className="inline font-bold text-white hover:text-vibe-accent cursor-pointer ml-1">
                             {t('viewMore')}
                           </button>
                         )}
                         {isViewingOwnProfile && (
                           <button onClick={() => { setNewBio(viewingUser.bio || ''); setEditBioMode(true); }} className="ml-2 text-vibe-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-white items-center">
                              <Edit2 size={12} className="inline mb-1" />
                           </button>
                         )}
                      </div>
                   )}
                </div>
                
                {/* Modals for Editing Name & Viewing full Bio */}
                {editNameMode && isViewingOwnProfile && (
                   <div className="absolute inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
                      <div className="bg-[#111] p-6 rounded-3xl w-full max-w-sm border border-vibe-line space-y-4 shadow-2xl">
                         <h3 className="text-white font-bold text-lg">{t('editProfileName')}</h3>
                         <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-[#050505] border border-vibe-line p-3 rounded-xl text-white outline-none focus:border-vibe-accent" autoFocus />
                         <div className="flex justify-end space-x-2 mt-4">
                           <button onClick={() => setEditNameMode(false)} className="px-4 py-2 text-sm font-bold text-vibe-muted hover:text-white">{t('cancel')}</button>
                           <button onClick={handleUpdateName} className="px-4 py-2 text-sm font-bold bg-vibe-accent text-vibe-bg rounded-xl hover:scale-105 transition-transform">{t('save')}</button>
                         </div>
                      </div>
                   </div>
                )}
                
                <AnimatePresence>
                   {showBioModal && (
                      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-[70] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                         <motion.div initial={{scale:0.95}} animate={{scale:1}} exit={{scale:0.95}} className="bg-[#111] w-full max-w-md p-6 border border-vibe-line rounded-3xl relative max-h-[80vh] flex flex-col shadow-2xl">
                            <button onClick={() => setShowBioModal(false)} className="absolute top-4 right-4 p-2 text-vibe-muted hover:text-white bg-black/50 rounded-full"><X size={18}/></button>
                            <h3 className="text-white font-bold mb-4 border-b border-vibe-line pb-4 text-lg">{t('description')}</h3>
                            <div className="overflow-y-auto no-scrollbar flex-1 pb-4">
                              <p className="text-vibe-muted whitespace-pre-wrap leading-relaxed text-sm">
                                 {viewingUser.bio}
                              </p>
                            </div>
                         </motion.div>
                      </motion.div>
                   )}
                </AnimatePresence>
                
                <div className="pt-6 w-full flex-1 flex flex-col items-center">
                  <div className="w-full flex border-b border-vibe-line mb-4 pb-2">
                     <button 
                       className={`flex-1 text-[11px] font-bold uppercase tracking-[2px] transition-colors ${profileTab === 'posts' ? 'text-vibe-accent' : 'text-vibe-muted'}`}
                       onClick={() => setProfileTab('posts')}
                     >
                        {t('vibes')}
                     </button>
                     <button 
                       className={`flex-1 text-[11px] font-bold uppercase tracking-[2px] transition-colors ${profileTab === 'saved' ? 'text-vibe-accent' : 'text-vibe-muted'}`}
                       onClick={() => setProfileTab('saved')}
                     >
                        {t('saved')}
                     </button>
                  </div>
                  <div className="flex-1 w-full overflow-y-auto no-scrollbar">
                    <ProfileGrid userId={viewingUser.uid} mode={profileTab} onViewerStateChange={setIsProfileViewerOpen} />
                  </div>
                </div>
                </div>
              </div>
            ) : activeTab === 'Explore' ? (
              <Explore onOpenProfile={handleOpenProfile} />
            ) : activeTab === 'Notifications' ? (
              <Notifications onOpenVibe={handleOpenVibe} />
            ) : (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 px-4">
                <div className="w-16 h-16 rounded-full bg-vibe-line flex items-center justify-center text-vibe-muted">
                   <Ghost size={32} />
                </div>
                <h2 className="text-2xl font-bold tracking-tighter text-vibe-ink uppercase">{activeTab}</h2>
                <p className="text-vibe-muted">{t('appUnderConstruction')}</p>
              </div>
            )}
            </div>
          </main>
        </div>

        {/* Sidebar Right */}
        <SidebarRight />
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-vibe-bg border-t border-vibe-line flex items-center justify-around p-4 pb-6 z-40">
        {[
          { id: 'Feed', icon: Command },
          { id: 'Explore', icon: Search },
          { id: 'Create', icon: Plus, isCreate: true },
          { id: 'Notifications', icon: Bell },
          { id: 'Profile', icon: User },
        ].map((tab) => (
          tab.isCreate ? (
            <button
              key="CreateVibeBtn"
              onClick={() => {
                if (Capacitor.isNativePlatform()) {
                  Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
                }
                setShowCreate(true);
              }}
              className="p-3 bg-vibe-accent text-vibe-bg rounded-full -translate-y-4 shadow-[0_0_15px_rgba(0,255,209,0.4)] hover:scale-110 active:scale-90 transition-transform"
            >
              <Plus size={28} strokeWidth={3} />
            </button>
          ) : (
            <button
              key={tab.id}
              onClick={() => {
                if (Capacitor.isNativePlatform()) {
                  Haptics.selectionStart().catch(() => {});
                }
                setActiveTab(tab.id);
              }}
              className={`p-2 transition-colors ${activeTab === tab.id ? 'text-vibe-accent' : 'text-vibe-muted'}`}
            >
              <tab.icon size={24} />
            </button>
          )
        ))}
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateVibe onClose={() => setShowCreate(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function FloatingUploadIndicator() {
  const { activeUpload } = useUpload();

  if (!activeUpload) return null;

  const progress = Math.max(0, Math.min(activeUpload.progress, 100));
  const ringStyle = {
    background: `conic-gradient(#00FFD1 ${progress * 3.6}deg, rgba(255,255,255,0.12) 0deg)`,
  };

  return (
    <AnimatePresence>
      <motion.div
        key={activeUpload.id}
        initial={{ opacity: 0, scale: 0.85, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: -8 }}
        className="fixed right-4 top-4 z-[120] md:right-6 md:top-6"
      >
        <div className="rounded-full border border-vibe-line bg-black/70 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={ringStyle}
            title={
              activeUpload.status === 'error'
                ? activeUpload.errorMessage || 'Upload gagal'
                : activeUpload.status === 'success'
                  ? 'Upload selesai'
                  : `Uploading ${progress}%`
            }
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#050505] text-[10px] font-bold text-vibe-ink">
              {activeUpload.status === 'error'
                ? '!'
                : activeUpload.status === 'success'
                  ? '100'
                  : progress}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <UploadProvider>
          <VibeSpace />
        </UploadProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
