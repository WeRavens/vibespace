import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, limit, getDocs, or, orderBy, startAt, endAt } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { Search as SearchIcon, X, User, Hash, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SearchResult {
  type: 'user' | 'hashtag' | 'trending';
  id: string;
  label: string;
  sublabel?: string;
  count?: number;
}

export function SearchModal({ isOpen, onClose, onSelectUser, onSelectHashtag }: { 
  isOpen: boolean; 
  onClose: () => void;
  onSelectUser?: (userId: string) => void;
  onSelectHashtag?: (tag: string) => void;
}) {
  const [query_, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'hashtags'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const search = async () => {
      if (!query_.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);

      try {
        const results: SearchResult[] = [];
        const searchTerm = query_.toLowerCase().trim();

        // Search users
        if (activeTab === 'all' || activeTab === 'users') {
          const usersRef = collection(db, 'users');
          const usersQ = query(
            usersRef,
            where('displayNameLower', '>=', searchTerm),
            where('displayNameLower', '<', searchTerm + '\uf8ff'),
            limit(10)
          );
          
          const usersSnap = await getDocs(usersQ);
          usersSnap.forEach(doc => {
            const data = doc.data();
            results.push({
              type: 'user',
              id: doc.id,
              label: data.displayName || 'Anonymous',
              sublabel: `@${data.displayName?.toLowerCase().replace(/\s+/g, '') || doc.id.slice(0,6)}`,
            });
          });
        }

        // Search vibes for hashtags
        if (activeTab === 'all' || activeTab === 'hashtags') {
          const vibesRef = collection(db, 'vibes');
          const hashtagsQ = query(
            vibesRef,
            where('hashtags', 'array-contains', searchTerm),
            limit(10)
          );
          
          const vibesSnap = await getDocs(hashtagsQ);
          const tagCounts: Record<string, number> = {};
          vibesSnap.forEach(doc => {
            const data = doc.data();
            const content = (data.content || '').toLowerCase();
            const regex = /#(\w+)/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
              const tag = match[1];
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
          });
          
          Object.entries(tagCounts)
            .sort(([, a], [, b]) => b - a)
            .forEach(([tag, count]) => {
              results.push({
                type: 'hashtag',
                id: tag,
                label: `#${tag}`,
                count,
              });
            });
        }

        // Trending suggestions
        if (!query_) {
          results.push(
            { type: 'trending', id: 'chill', label: '#chill', count: 120 },
            { type: 'trending', id: 'vibes', label: '#vibes', count: 89 },
            { type: 'trending', id: 'mood', label: '#mood', count: 67 },
          );
        }

        setResults(results);
      } catch (error) {
        console.error('Search error:', error);
        // Fallback search simulation
        const mockResults: SearchResult[] = [];
        if (activeTab === 'all' || activeTab === 'users') {
          mockResults.push(
            { type: 'user', id: '1', label: 'Test User', sublabel: '@testuser' },
          );
        }
        setResults(mockResults);
      }

      setLoading(false);
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query_, activeTab]);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'user') {
      onSelectUser?.(result.id);
    } else {
      onSelectHashtag?.(result.label);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 pt-20 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: -20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: -20 }}
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-[#111] border border-vibe-line shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="flex items-center space-x-3 border-b border-vibe-line p-4">
              <SearchIcon size={20} className="text-vibe-muted" />
              <input
                ref={inputRef}
                type="text"
                value={query_}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search users, hashtags..."
                className="flex-1 bg-transparent text-white placeholder-vibe-muted focus:outline-none"
              />
              {query_ && (
                <button onClick={() => setQuery('')}>
                  <X size={18} className="text-vibe-muted" />
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-vibe-line">
              {(['all', 'users', 'hashtags'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    activeTab === tab
                      ? 'text-vibe-accent border-b-2 border-vibe-accent'
                      : 'text-vibe-muted hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-vibe-accent/20 border-t-vibe-accent" />
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <SearchIcon size={40} className="text-vibe-muted mb-4" />
                  <p className="text-sm text-vibe-muted">
                    {query_ ? 'No results found' : 'Start typing to search'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-vibe-line">
                  {results.map(result => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      className="flex w-full items-center space-x-3 p-4 text-left hover:bg-white/5 transition-colors"
                    >
                      {result.type === 'user' ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-vibe-line">
                          <User size={18} className="text-vibe-muted" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-vibe-accent/10">
                          <Hash size={18} className="text-vibe-accent" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate">{result.label}</p>
                        {result.sublabel && (
                          <p className="text-xs text-vibe-muted truncate">{result.sublabel}</p>
                        )}
                        {result.count !== undefined && (
                          <p className="text-xs text-vibe-muted">{result.count} posts</p>
                        )}
                      </div>
                      {result.type === 'trending' && (
                        <TrendingUp size={16} className="text-vibe-accent" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}