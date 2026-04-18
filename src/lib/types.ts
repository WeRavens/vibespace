export const MOODS = [
  { id: 'happy', label: 'Happy', emoji: '😊', color: 'text-yellow-400' },
  { id: 'sad', label: 'Sad', emoji: '😢', color: 'text-blue-400' },
  { id: 'excited', label: 'Excited', emoji: '🔥', color: 'text-vibe-pink' },
  { id: 'chill', label: 'Chill', emoji: '🌊', color: 'text-vibe-cyan' },
  { id: 'angry', label: 'Angry', emoji: '😤', color: 'text-red-500' },
  { id: 'thinking', label: 'Thinking', emoji: '🤔', color: 'text-vibe-green' },
] as const;

export type MoodId = typeof MOODS[number]['id'];

export interface VibeComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: number;
}

export interface Vibe {
  id: string;
  userId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  type: 'photo' | 'video' | 'text';
  mood: MoodId;
  mediaUrl?: string;
  isAnonymous: boolean;
  createdAt: any;
  expiresAt: any;
  reactions: Record<string, number>;
  userReactions?: Record<string, string>;
  comments?: VibeComment[];
}
