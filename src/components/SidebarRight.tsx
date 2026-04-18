import { useLanguage } from '../lib/LanguageContext';

export function SidebarRight() {
  const { t } = useLanguage();

  return (
    <aside className="hidden lg:flex flex-col bg-vibe-bg p-6 h-full border-l border-vibe-line">
      <div className="mb-6 text-[11px] font-bold uppercase tracking-[2px] text-vibe-muted">
        {t('trendingVibes')}
      </div>

      <div className="space-y-6">
         <div className="py-10 text-center text-xs text-vibe-muted font-mono rounded-xl bg-[#0a0a0a] border border-vibe-line border-dashed">
             {t('noTrendingData')}
         </div>
      </div>

      <div className="pt-2">
        <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[2px] text-vibe-muted">
          {t('liveFeed')}
        </h3>
        <div className="space-y-4">
           <div className="py-10 text-center text-xs text-vibe-muted font-mono rounded-xl bg-[#0a0a0a] border border-vibe-line border-dashed">
             {t('noIncomingBroadcast')}
           </div>
        </div>
      </div>
    </aside>
  );
}
