import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, increment, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart2, Check, Users } from 'lucide-react';

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface PollProps {
  pollId: string;
  question: string;
  options: PollOption[];
  isMultiple?: boolean;
  expiresAt?: number;
  onVote?: (optionIds: string[]) => void;
}

export function Poll({ pollId, question, options: initialOptions, isMultiple = false, expiresAt, onVote }: PollProps) {
  const { user } = useAuth();
  const [options, setOptions] = useState(initialOptions);
  const [userVotes, setUserVotes] = useState<string[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPoll = async () => {
      if (!db || !pollId) return;
      
      try {
        const pollRef = doc(db, 'polls', pollId);
        const pollSnap = await getDoc(pollRef);
        
        if (pollSnap.exists()) {
          const data = pollSnap.data();
          setOptions(data.options || initialOptions);
          setUserVotes(data.votes?.[user?.uid] || []);
          setHasVoted(Boolean(data.votes?.[user?.uid]?.length));
          setTotalVotes(data.totalVotes || 0);
        }
      } catch (error) {
        console.error('Error fetching poll:', error);
      }
    };

    fetchPoll();
  }, [pollId, user]);

  const handleVote = async (optionId: string) => {
    if (!user || hasVoted || loading) return;
    
    setLoading(true);

    try {
      const pollRef = doc(db, 'polls', pollId);
      const newUserVotes = isMultiple 
        ? (userVotes.includes(optionId) 
            ? userVotes.filter(id => id !== optionId)
            : [...userVotes, optionId])
        : [optionId];

      const updates: any = {
        [`votes.${user.uid}`]: newUserVotes,
        totalVotes: increment(1)
      };

      newUserVotes.forEach((id, idx) => {
        if (isMultiple) {
          const prevVoted = userVotes.includes(id);
          if (!prevVoted) {
            updates[`options.${idx}.votes`] = increment(1);
          }
        }
      });

      if (!isMultiple && userVotes.length === 0) {
        const optionIdx = options.findIndex(o => o.id === optionId);
        if (optionIdx >= 0) {
          updates[`options.${optionIdx}.votes`] = increment(1);
        }
      }

      await updateDoc(pollRef, updates);
      
      setUserVotes(newUserVotes);
      setHasVoted(true);
      setOptions(prev => prev.map(opt => ({
        ...opt,
        votes: newUserVotes.includes(opt.id) ? opt.votes + 1 : opt.votes
      })));
      setTotalVotes(prev => prev + 1);
      
      onVote?.(newUserVotes);
    } catch (error) {
      console.error('Error voting:', error);
    }

    setLoading(false);
  };

  const getPercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const isExpired = expiresAt && Date.now() > expiresAt;
  const canVote = !hasVoted && !isExpired && user;

  return (
    <div className="w-full rounded-2xl border border-vibe-line bg-[#111] p-4">
      <div className="mb-4 flex items-center space-x-2">
        <BarChart2 size={18} className="text-vibe-accent" />
        <h3 className="font-bold text-white">{question}</h3>
      </div>

      <div className="space-y-2">
        {options.map(option => {
          const percentage = getPercentage(option.votes);
          const isSelected = userVotes.includes(option.id);
          
          return (
            <button
              key={option.id}
              onClick={() => canVote && handleVote(option.id)}
              disabled={!canVote}
              className={`relative w-full overflow-hidden rounded-xl border transition-all ${
                hasVoted || isExpired
                  ? 'border-vibe-line bg-vibe-bg'
                  : isSelected
                    ? 'border-vibe-accent bg-vibe-accent/10'
                    : 'border-vibe-line hover:border-vibe-accent/50'
              } ${!canVote ? 'cursor-default' : ''}`}
            >
              {/* Progress Bar */}
              {(hasVoted || isExpired) && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="absolute inset-y-0 left-0 bg-vibe-accent/20"
                />
              )}
              
              <div className="relative flex items-center justify-between p-3">
                <div className="flex items-center space-x-2">
                  {hasVoted && (
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      isSelected ? 'border-vibe-accent bg-vibe-accent' : 'border-vibe-muted'
                    }`}>
                      {isSelected && <Check size={12} className="text-black" />}
                    </div>
                  )}
                  <span className={`text-sm font-medium ${
                    isSelected ? 'text-vibe-accent' : 'text-white'
                  }`}>
                    {option.text}
                  </span>
                </div>
                
                {(hasVoted || isExpired) && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">{percentage}%</span>
                    <span className="text-xs text-vibe-muted">({option.votes})</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-vibe-muted">
        <div className="flex items-center space-x-1">
          <Users size={14} />
          <span>{totalVotes} votes</span>
        </div>
        {isExpired && <span>Poll ended</span>}
        {!isExpired && isMultiple && <span>Select multiple</span>}
      </div>
    </div>
  );
}

export function CreatePoll({ onSubmit }: { onSubmit: (question: string, options: string[]) => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isMultiple, setIsMultiple] = useState(false);

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = () => {
    const validOptions = options.filter(o => o.trim());
    if (question.trim() && validOptions.length >= 2) {
      onSubmit(question.trim(), validOptions);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="Ask a question..."
        className="w-full bg-transparent border-b border-vibe-line py-2 text-lg font-bold text-white focus:outline-none focus:border-vibe-accent"
      />

      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center space-x-2">
            <input
              type="text"
              value={option}
              onChange={e => updateOption(index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              className="flex-1 bg-vibe-line rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-vibe-accent"
            />
            {options.length > 2 && (
              <button
                onClick={() => removeOption(index)}
                className="text-vibe-muted hover:text-red-400"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {options.length < 6 && (
        <button
          onClick={addOption}
          className="text-sm text-vibe-accent hover:underline"
        >
          + Add option
        </button>
      )}

      <label className="flex items-center space-x-2 text-sm text-vibe-muted">
        <input
          type="checkbox"
          checked={isMultiple}
          onChange={e => setIsMultiple(e.target.checked)}
          className="rounded border-vibe-line bg-vibe-bg text-vibe-accent focus:ring-vibe-accent"
        />
        <span>Allow multiple votes</span>
      </label>

      <button
        onClick={handleSubmit}
        disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
        className="w-full rounded-full bg-vibe-accent py-3 font-bold text-black disabled:opacity-50"
      >
        Create Poll
      </button>
    </div>
  );
}