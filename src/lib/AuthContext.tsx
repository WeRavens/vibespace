import React, { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { 
  onAuthStateChanged, 
  getRedirectResult,
  signInWithCredential,
  signInWithPopup, 
  signInWithRedirect,
  GoogleAuthProvider, 
  signOut,
  User,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getAuthErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';
}

function shouldPreferRedirect() {
  if (typeof window === 'undefined') return false;

  const ua = window.navigator.userAgent || '';
  const isInAppBrowser = /fbav|instagram|line|wv/i.test(ua);
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches;

  return isInAppBrowser || isStandalone;
}

function isNativeGoogleAuthPlatform() {
  return Capacitor.isNativePlatform();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const bootstrapAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (error) {
        console.warn("Failed to set auth persistence:", error);
      }

      try {
        console.log("Checking for redirect result...");
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult?.user) {
          console.log("Redirect login completed for:", redirectResult.user.uid);
          setUser(redirectResult.user);
        } else {
          console.log("No redirect result found.");
        }
      } catch (e) {
        console.error("Redirect login failed (catch):", e);
        if (e instanceof Error) {
          console.error("Error message:", e.message);
          if ('code' in e) console.error("Error code:", (e as any).code);
        }
        alert("Login Google gagal diselesaikan setelah kembali ke aplikasi.");
      }

      unsubscribe = onAuthStateChanged(auth, async (u) => {
        console.log("Auth state changed - Raw user:", u ? { uid: u.uid, email: u.email, isAnonymous: u.isAnonymous } : "null");
        if (u) {
          setUser(u);
          try {
            if (!db) {
              console.error("Firestore DB not initialized during auth state change");
              setLoading(false);
              return;
            }

            console.log("Checking user document in Firestore for:", u.uid);
            // Ensure user doc exists
            const userRef = doc(db, 'users', u.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
              console.log("User doc does not exist, creating for:", u.uid);
              await setDoc(userRef, {
                uid: u.uid,
                displayName: u.displayName,
                photoURL: u.photoURL,
                email: u.email,
                bio: '',
                createdAt: serverTimestamp(),
              });
              console.log("User doc created successfully");
            } else {
              console.log("User doc exists:", userSnap.data());
              if (userSnap.data().isBanned) {
                alert('Maaf, akunmu telah di-banned oleh Admin karena melanggar pedoman komunitas.');
                await signOut(auth);
                setUser(null);
                setLoading(false);
                return;
              }
            }

            // Also check bannedUsers collection as a secondary safeguard
            const bannedRef = doc(db, 'bannedUsers', u.uid);
            const bannedSnap = await getDoc(bannedRef);
            if (bannedSnap.exists()) {
              console.log("User found in bannedUsers collection:", u.uid);
              alert('Maaf, akunmu telah di-banned oleh Admin karena melanggar pedoman komunitas.');
              await signOut(auth);
              setUser(null);
              setLoading(false);
              return;
            }

          } catch (error) {
            // Don't block a successful Firebase Auth sign-in just because
            // the profile bootstrap/read in Firestore failed.
            console.error("Critical error in Firestore user check:", error);
            if (error instanceof Error) {
              console.error("Error message:", error.message);
              console.error("Error stack:", error.stack);
            }
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      });
    };

    void bootstrapAuth();

    return () => {
      unsubscribe?.();
    };
  }, []);

  const signIn = async () => {
    if (!auth) return;

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      if (isNativeGoogleAuthPlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle({
          skipNativeAuth: true,
        });
        const idToken = result.credential?.idToken;

        if (!idToken) {
          throw new Error('Google login native tidak mengembalikan ID token.');
        }

        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
        return;
      }

      if (shouldPreferRedirect()) {
        await signInWithRedirect(auth, provider);
        return;
      }

      await signInWithPopup(auth, provider);
    } catch (e: any) {
      console.error("Login failed:", e);
      const code = getAuthErrorCode(e);

      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/web-storage-unsupported'
      ) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          console.error("Redirect fallback failed:", redirectError);
        }
      }

      alert("Gagal melakukan login dengan Google. Jika popup diblokir, coba buka lewat browser biasa lalu ulangi.");
    }
  };

  const signInGuest = async () => {
    if (!auth) return;
    try {
      const { signInAnonymously } = await import('firebase/auth');
      await signInAnonymously(auth);
    } catch(e) {
      console.error(e);
      alert("Guest login failed.");
    }
  };

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
    if (isNativeGoogleAuthPlatform()) {
      try {
        await FirebaseAuthentication.signOut();
      } catch (e) {
        console.warn('Native sign out failed:', e);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
