import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, getDocs, or, and, getCountFromServer } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Send, Image, Video, MoreVertical, ArrowLeft, Phone, Info, Plus, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressImage, validateMediaFile } from '../lib/imageUtils';

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: any;
    type: 'text' | 'image' | 'video';
  };
  unreadCount: Record<string, number>;
  updatedAt: any;
}

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'video';
  mediaUrl?: string;
  createdAt: any;
  readBy: string[];
}

export function Messages({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !db) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      setChats(chatsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const loadUsers = async () => {
      if (!db) return;
      setSearching(true);
      try {
        let q;
        if (searchQuery.trim()) {
          q = query(
            collection(db, 'users'),
            where('displayName', '>=', searchQuery),
            where('displayName', '<', searchQuery + '\uf8ff'),
            limit(20)
          );
        } else {
          q = query(collection(db, 'users'), limit(20));
        }
        const snapshot = await getDocs(q);
        const usersData: any[] = [];
        snapshot.docs.forEach((doc: any) => {
          const data = doc.data();
          if (data && data.id !== user?.uid) {
            usersData.push({ id: doc.id, ...data });
          }
        });
        setSearchUsers(usersData);
      } catch (error) {
        console.error('Error loading users:', error);
        setSearchUsers([]);
      }
      setSearching(false);
    };

    loadUsers();
  }, [searchQuery, user, showNewMessage]);

  useEffect(() => {
    if (!selectedChat || !db) return;

    const q = query(
      collection(db, 'chats', selectedChat.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
      
      // Mark as read
      msgs.forEach(msg => {
        if (msg.senderId !== user?.uid && !msg.readBy.includes(user?.uid || '')) {
          updateDoc(doc(db, 'chats', selectedChat.id, 'messages', msg.id), {
            readBy: [...msg.readBy, user?.uid]
          });
        }
      });
    });

    return () => unsubscribe();
  }, [selectedChat?.id, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !user) return;

    const otherUserId = selectedChat.participants.find(id => id !== user.uid);
    
    await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), {
      chatId: selectedChat.id,
      senderId: user.uid,
      content: newMessage.trim(),
      type: 'text',
      createdAt: serverTimestamp(),
      readBy: [user.uid]
    });

    await updateDoc(doc(db, 'chats', selectedChat.id), {
      lastMessage: {
        content: newMessage.trim(),
        senderId: user.uid,
        createdAt: serverTimestamp(),
        type: 'text'
      },
      [`unreadCount.${otherUserId}`]: 0,
      updatedAt: serverTimestamp()
    });

    setNewMessage('');
  };

  const startNewChat = async (targetUserId: string) => {
    if (!user || !db) {
      alert('Not logged in or database not ready');
      setCreatingChat(false);
      return;
    }

    console.log('=== Starting chat with:', targetUserId);
    console.log('User:', user.uid);
    setCreatingChat(true);

    try {
      console.log('db:', db);
      console.log('user.uid:', user.uid);
      console.log('targetUserId:', targetUserId);
      
      if (!db) {
        alert('Database not initialized');
        return;
      }
      
      // Create new chat directly
      const newChatRef = await addDoc(collection(db, 'chats'), {
        participants: [user.uid, targetUserId],
        unreadCount: { [user.uid]: 0, [targetUserId]: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const chatId = newChatRef.id;
      console.log('Chat created with ID:', chatId);

      // Set selected chat immediately
      setSelectedChat({
        id: chatId,
        participants: [user.uid, targetUserId],
        unreadCount: { [user.uid]: 0, [targetUserId]: 0 },
        updatedAt: null
      });
      setShowNewMessage(false);
      setSearchQuery('');
    } catch (error: any) {
      console.error('Error starting chat:', error);
      alert('Error: ' + error.message);
    } finally {
      setCreatingChat(false);
    }
  };

  const getOtherUser = (chat: Chat) => {
    const otherId = chat.participants.find(id => id !== user?.uid);
    return otherId;
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-50 flex bg-black"
    >
      {/* Chat List */}
      <div className={`flex w-full flex-col ${selectedChat || showNewMessage ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center justify-between border-b border-vibe-line p-4">
          <h2 className="text-lg font-bold text-white">Messages</h2>
          <div className="flex items-center space-x-2">
            <button onClick={() => setShowNewMessage(true)} className="text-vibe-accent hover:text-white">
              <Plus size={24} />
            </button>
<button onClick={onClose} className="text-vibe-muted hover:text-white">
              <ArrowLeft size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-vibe-accent/20 border-t-vibe-accent" />
            </div>
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <p className="text-sm text-vibe-muted">No messages yet</p>
              <p className="text-xs text-vibe-muted">Start a conversation from someone's profile</p>
            </div>
          ) : (
            chats.map(chat => (
              <button
                key={chat.id}
                onClick={() => setSelectedChat(chat)}
                className="flex w-full items-center space-x-3 p-4 text-left hover:bg-white/5 transition-colors border-b border-vibe-line"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vibe-accent/10">
                  <span className="text-lg font-bold text-vibe-accent">
                    {getOtherUser(chat)?.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-white truncate">User {getOtherUser(chat)?.slice(0, 6)}</p>
                    {chat.lastMessage && (
                      <span className="text-[10px] text-vibe-muted">
                        {formatDistanceToNow(chat.lastMessage.createdAt?.toDate?.() || new Date())}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-vibe-muted truncate">
                    {chat.lastMessage?.content || 'No messages yet'}
                  </p>
                </div>
                {chat.unreadCount[user?.uid || ''] > 0 && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-vibe-accent text-[10px] font-bold text-black">
                    {chat.unreadCount[user.uid]}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* New Message Modal */}
      <AnimatePresence>
        {showNewMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col bg-black"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-vibe-line p-4">
              <div className="flex items-center space-x-3">
                <button onClick={() => setShowNewMessage(false)} className="text-vibe-muted hover:text-white">
                  <ArrowLeft size={24} />
                </button>
                <h2 className="text-lg font-bold text-white">New Message</h2>
              </div>
            </div>

            {/* Search Input */}
            <div className="flex items-center space-x-2 border-b border-vibe-line p-4">
              <Search size={20} className="text-vibe-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="flex-1 bg-transparent text-white placeholder-vibe-muted focus:outline-none"
                autoFocus
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X size={18} className="text-vibe-muted" />
                </button>
              )}
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto">
              {searching ? (
                <div className="flex items-center justify-center p-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-vibe-accent/20 border-t-vibe-accent" />
                </div>
              ) : searchUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <p className="text-sm text-vibe-muted">
                    {searchQuery ? 'No users found' : 'No users yet. Be the first to start a conversation!'}
                  </p>
                </div>
              ) : (
                searchUsers.map(foundUser => (
                  <button
                    key={foundUser.id}
                    disabled={creatingChat}
                    onClick={async () => {
                      console.log('Click handler triggered for:', foundUser.id);
                      await startNewChat(foundUser.id);
                    }}
                    className={`flex w-full items-center space-x-3 p-4 text-left transition-colors border-b border-vibe-line ${
                      creatingChat ? 'opacity-50' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vibe-accent/10 overflow-hidden">
                      {foundUser.photoURL ? (
                        <img src={foundUser.photoURL} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-vibe-accent">
                          {foundUser.displayName?.charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-white">{foundUser.displayName || 'Anonymous'}</p>
                      <p className="text-sm text-vibe-muted">@{foundUser.displayName?.toLowerCase().replace(/\s+/g, '') || foundUser.id.slice(0, 6)}</p>
                    </div>
                    {creatingChat && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-vibe-accent/20 border-t-vibe-accent" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat View */}
      <AnimatePresence>
        {selectedChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 flex flex-col bg-black md:relative md:inset-auto ${selectedChat ? 'flex' : 'hidden'}`}
          >
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-vibe-line p-4">
              <div className="flex items-center space-x-3">
                <button onClick={() => setSelectedChat(null)} className="text-vibe-muted hover:text-white md:hidden">
                  <ArrowLeft size={24} />
                </button>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-vibe-accent/10">
                  <span className="font-bold text-vibe-accent">
                    {getOtherUser(selectedChat)?.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-white">User {getOtherUser(selectedChat)?.slice(0, 6)}</p>
                  <p className="text-xs text-vibe-muted">Online</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-vibe-muted hover:text-white">
                  <Phone size={20} />
                </button>
                <button className="p-2 text-vibe-muted hover:text-white">
                  <Info size={20} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-vibe-muted mb-2">Start the conversation!</p>
                  <p className="text-sm text-vibe-muted">Send a message below</p>
                </div>
              ) : (
                messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      msg.senderId === user?.uid
                        ? 'bg-vibe-accent text-black'
                        : 'bg-vibe-line text-white'
                    }`}
                  >
                    {msg.type !== 'text' && msg.mediaUrl && (
                      msg.type === 'image' ? (
                        <img src={msg.mediaUrl} alt="" className="mb-2 rounded-lg" />
                      ) : (
                        <video src={msg.mediaUrl} className="mb-2 rounded-lg" />
                      )
                    )}
                    <p>{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${msg.senderId === user?.uid ? 'text-black/60' : 'text-vibe-muted'}`}>
                      {formatDistanceToNow(msg.createdAt?.toDate?.() || new Date())}
                    </p>
                  </div>
                </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex items-center space-x-2 border-t border-vibe-line p-4">
              <button className="p-2 text-vibe-muted hover:text-white">
                <Image size={20} />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-vibe-line rounded-full px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-vibe-accent"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="p-2 text-vibe-accent disabled:opacity-50"
              >
                <Send size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}