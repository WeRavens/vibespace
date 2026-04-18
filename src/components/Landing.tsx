import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Zap, Shield, Mail, Lock, User as UserIcon, Loader } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useLanguage } from '../lib/LanguageContext';

export function Landing() {
  const { signIn } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      alert(t('enterEmailFirst'));
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      alert(t('resetPasswordSent'));
    } catch (error: any) {
      alert(`${t('resetPasswordFailed')} (${error.message})`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (!isLogin && !name) return;
    
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(res.user, { displayName: name });
      }
    } catch(err: any) {
      alert("Gagal memproses (" + err.message + ")");
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-auto bg-vibe-bg px-6 py-12 text-center">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-md">
        <button type="button" onClick={() => setLanguage('id')} className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[2px] ${language === 'id' ? 'bg-vibe-accent text-vibe-bg' : 'text-vibe-muted hover:text-white'}`}>ID</button>
        <button type="button" onClick={() => setLanguage('en')} className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[2px] ${language === 'en' ? 'bg-vibe-accent text-vibe-bg' : 'text-vibe-muted hover:text-white'}`}>EN</button>
      </div>
      {/* Decorative Blur */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-vibe-accent/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-vibe-accent/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 w-full max-w-sm flex flex-col items-center"
      >
        <h1 className="mb-2 text-6xl font-black tracking-tighter sm:text-7xl uppercase text-vibe-ink">
          Vibe<span className="text-vibe-accent" style={{ textShadow: '0 0 20px rgba(0, 255, 209, 0.4)' }}>Space</span>
        </h1>
        <p className="mb-8 text-xs font-bold uppercase tracking-[2px] text-vibe-muted">
          {t('expressionWithoutPerfection')}
        </p>

        <div className="w-full bg-[#050505] p-6 rounded-3xl border border-vibe-line shadow-2xl backdrop-blur-sm">
           <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
              <AnimatePresence mode="popLayout">
                {!isLogin && (
                   <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative">
                     <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-vibe-muted" size={16} />
                     <input type="text" placeholder={t('profileName')} value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#111] border border-vibe-line rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-vibe-accent transition-colors text-sm" required />
                   </motion.div>
                )}
              </AnimatePresence>

              <div className="relative">
                 <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-vibe-muted" size={16} />
                 <input type="email" placeholder={t('emailAddress')} value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#111] border border-vibe-line rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-vibe-accent transition-colors text-sm" required />
              </div>

              <div className="relative">
                 <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-vibe-muted" size={16} />
                 <input type="password" placeholder={t('passwordMin')} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111] border border-vibe-line rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-vibe-accent transition-colors text-sm" required minLength={6} />
              </div>

              {isLogin && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className="text-[11px] font-bold text-vibe-muted transition-colors hover:text-vibe-accent disabled:opacity-50"
                  >
                    {t('forgotPassword')}
                  </button>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-vibe-accent py-3 text-xs font-black uppercase tracking-[2px] text-vibe-bg transition-all hover:opacity-90 shadow-[0_0_15px_rgba(0,255,209,0.2)] disabled:opacity-50 flex justify-center items-center h-12 mt-2">
                 {loading ? <Loader className="animate-spin" size={18} /> : (isLogin ? t('logIn') : t('createAccount'))}
              </button>
           </form>

           <div className="mt-6 flex flex-col items-center space-y-3">
              <button onClick={() => setIsLogin(!isLogin)} type="button" className="text-xs font-bold text-vibe-muted hover:text-white transition-colors">
                 {isLogin ? t('dontHaveAccount') : t('alreadyHaveAccount')}
              </button>
              <div className="w-full h-px bg-vibe-line my-2" />
              <button type="button" onClick={signIn} className="w-full rounded-xl border border-vibe-accent/40 bg-vibe-accent/10 py-3 text-xs font-black uppercase tracking-[2px] text-vibe-accent transition-all hover:bg-vibe-accent/15 hover:border-vibe-accent">
                 {t('continueWithGoogle')}
              </button>
           </div>
        </div>
      </motion.div>

      <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3 opacity-50 pointer-events-none">
        {[
          { icon: Zap, title: t('realTime'), desc: t('postsLast24h') },
          { icon: Sparkles, title: t('moodBased'), desc: t('syncWithFeelings') },
          { icon: Shield, title: t('pureSpace'), desc: t('noPerfection') },
        ].map((item, i) => (
          <motion.div key={i} className="flex flex-col items-center space-y-2">
            <item.icon className="text-vibe-accent" size={20} />
            <h3 className="text-[9px] font-bold uppercase tracking-[2px] text-white">{item.title}</h3>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
