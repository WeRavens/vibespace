import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { Heart, MessageCircle, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '../lib/LanguageContext';

export function Notifications({ onOpenVibe }: { onOpenVibe?: (id: string) => void }) {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<any[]>([]);
  const { t } = useLanguage();

  useEffect(() => {
    if (!user || !db) return;
    
    // Sort client-side to avoid composite index requirements in Firestore
    const q = query(
      collection(db, 'notifications'),
      where('targetUserId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      data.sort((a: any, b: any) => {
         const tA = a.createdAt?.toDate?.()?.getTime() || 0;
         const tB = b.createdAt?.toDate?.()?.getTime() || 0;
         return tB - tA;
      });
      
      setNotifs(data);
    });

    return unsubscribe;
  }, [user]);

  const renderIcon = (type: string) => {
    if (type === 'react') return <Heart size={16} className="text-vibe-accent" />;
    if (type === 'comment') return <MessageCircle size={16} className="text-white" />;
    return <Info size={16} className="text-vibe-muted" />;
  };

  const renderText = (n: any) => {
     if (n.type === 'react') return <span>{t('reactedToPost', { name: n.actorName, text: n.text })}</span>;
     if (n.type === 'comment') return <span>{t('commentedOnPost', { name: n.actorName, text: n.text })}</span>;
     return <span>{t('activityBy', { name: n.actorName })}</span>;
  };

  return (
    <div className="w-full h-full p-4 md:p-8 overflow-y-auto no-scrollbar pb-32">
       <div className="max-w-xl mx-auto space-y-6">
         <h2 className="text-2xl font-black uppercase tracking-tighter text-white mb-8 border-b border-vibe-line pb-4">{t('notificationsTitle')}</h2>
         
         <div className="space-y-4">
           {notifs.length > 0 ? notifs.map(n => (
             <div 
               key={n.id} 
               onClick={() => onOpenVibe?.(n.vibeId)}
               className={`flex items-center space-x-4 p-4 rounded-2xl border transition-all group cursor-pointer ${n.read ? 'bg-[#111] border-vibe-line/50' : 'bg-[#1a1a1a] border-vibe-accent/30'}`}
             >
               <div className="w-12 h-12 rounded-full border border-vibe-line bg-[#050505] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                 {renderIcon(n.type)}
               </div>
               <div className="flex-1">
                 <div className="text-sm text-vibe-muted">{renderText(n)}</div>
                 <div className="text-xs font-mono text-vibe-muted/50 mt-1">
                    {n.createdAt ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true }) : t('justNow')}
                 </div>
               </div>
             </div>
           )) : (
             <div className="py-20 text-center text-sm text-vibe-muted font-mono border border-dashed border-vibe-line rounded-3xl bg-[#0a0a0a]">
               {t('noNotifications')}
             </div>
           )}
         </div>
       </div>
    </div>
  );
}
