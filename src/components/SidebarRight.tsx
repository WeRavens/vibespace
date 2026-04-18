export function SidebarRight() {
  return (
    <aside className="hidden lg:flex flex-col bg-vibe-bg p-6 h-full border-l border-vibe-line">
      <div className="mb-6 text-[11px] font-bold uppercase tracking-[2px] text-vibe-muted">
        Trending Vibes
      </div>

      <div className="space-y-6">
         <div className="py-10 text-center text-xs text-vibe-muted font-mono rounded-xl bg-[#0a0a0a] border border-vibe-line border-dashed">
             No trending data yet.
         </div>
      </div>

      <div className="pt-2">
        <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[2px] text-vibe-muted">
          LIVE FEED
        </h3>
        <div className="space-y-4">
           <div className="py-10 text-center text-xs text-vibe-muted font-mono rounded-xl bg-[#0a0a0a] border border-vibe-line border-dashed">
             No incoming broadcast.
           </div>
        </div>
      </div>
    </aside>
  );
}
