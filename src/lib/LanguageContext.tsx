import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "id" | "en";

type TranslationValue = Record<Language, string>;

const translations = {
  appUnderConstruction: {
    id: "Bagian ini sedang dalam pengembangan. Cek lagi nanti untuk vibe berikutnya!",
    en: "This section is currently under construction. Check back soon for more vibes!",
  },
  logOut: { id: "Keluar", en: "Log Out" },
  uploadFailed: { id: "Gagal mengunggah foto.", en: "Failed to upload photo." },
  failedUpdateName: { id: "Gagal mengubah nama", en: "Failed to update name" },
  failedUpdateDescription: { id: "Gagal mengubah deskripsi", en: "Failed to update description" },
  profile: { id: "Profil", en: "Profile" },
  posts: { id: "Postingan", en: "Posts" },
  saved: { id: "Tersimpan", en: "Saved" },
  description: { id: "Deskripsi", en: "Description" },
  writeDescription: { id: "Tulis deskripsi...", en: "Write a description..." },
  save: { id: "Simpan", en: "Save" },
  cancel: { id: "Batal", en: "Cancel" },
  viewMore: { id: "...selengkapnya", en: "...more" },
  noProfileDescriptionSelf: {
    id: "Belum ada deskripsi profil. Tambahkan deskripsi...",
    en: "No profile description yet. Add one...",
  },
  noProfileDescriptionOther: {
    id: "Belum ada deskripsi profil.",
    en: "No profile description yet.",
  },
  editProfileName: { id: "Ubah Nama Profil", en: "Edit Profile Name" },
  uploading: { id: "Mengunggah", en: "Uploading" },
  postCountLabel: { id: "post", en: "posts" },
  vibesLabel: { id: "vibes", en: "vibes" },
  unblockUser: { id: "Buka Blokir", en: "Unblock User" },
  blockUser: { id: "Blokir User", en: "Block User" },
  status: { id: "Status", en: "Status" },
  blocked: { id: "Diblokir", en: "Blocked" },
  active: { id: "Aktif", en: "Active" },
  homeFeed: { id: "Feed", en: "Feed" },
  explore: { id: "Eksplor", en: "Explore" },
  notifications: { id: "Notifikasi", en: "Notifications" },
  anonymous: { id: "Anonim", en: "Anonymous" },
  createVibe: { id: "Buat Vibe", en: "Create Vibe" },
  yourVibe: { id: "Vibe Kamu", en: "Your Vibe" },
  trendingVibes: { id: "Vibe Tren", en: "Trending Vibes" },
  noTrendingData: { id: "Belum ada data trending.", en: "No trending data yet." },
  liveFeed: { id: "Feed Langsung", en: "Live Feed" },
  noIncomingBroadcast: { id: "Belum ada siaran masuk.", en: "No incoming broadcast." },
  searchUsersOrVibes: { id: "Cari user atau vibe...", en: "Search users or vibes..." },
  searchingUniverse: { id: "Mencari di semesta...", en: "Searching the universe..." },
  noVibesFound: { id: 'Tidak ada vibe untuk "{term}"', en: 'No vibes found for "{term}"' },
  suggestedUsers: { id: "User Rekomendasi", en: "Suggested Users" },
  accounts: { id: "Akun", en: "Accounts" },
  vibes: { id: "Vibes", en: "Vibes" },
  notificationsTitle: { id: "Notifikasi", en: "Notifications" },
  noNotifications: {
    id: "Belum ada pemberitahuan baru.",
    en: "No recent activity yet.",
  },
  activityBy: { id: "Aktivitas baru dari {name}", en: "New activity from {name}" },
  reactedToPost: { id: "{name} memberikan reaksi {text} pada postinganmu.", en: "{name} reacted with {text} to your post." },
  commentedOnPost: { id: '{name} baru saja berkomentar: "{text}"', en: '{name} just commented: "{text}"' },
  justNow: { id: "baru saja", en: "just now" },
  expressionWithoutPerfection: { id: "Ekspresi tanpa harus sempurna.", en: "Expression without perfection." },
  profileName: { id: "Nama Profil", en: "Profile Name" },
  emailAddress: { id: "Alamat Email", en: "Email Address" },
  passwordMin: { id: "Password (Min. 6 Karakter)", en: "Password (Min. 6 Characters)" },
  logIn: { id: "Masuk", en: "Log In" },
  createAccount: { id: "Buat Akun Baru", en: "Create Account" },
  dontHaveAccount: { id: "Belum punya akun? Daftar", en: "Don't have an account? Sign up" },
  alreadyHaveAccount: { id: "Sudah punya akun? Masuk", en: "Already have an account? Log in" },
  continueWithGoogle: { id: "Lanjut Dengan Google", en: "Continue With Google" },
  forgotPassword: { id: "Lupa Password?", en: "Forgot Password?" },
  enterEmailFirst: { id: "Masukkan email terlebih dulu.", en: "Please enter your email first." },
  resetPasswordSent: { id: "Email reset password sudah dikirim. Cek inbox kamu.", en: "Password reset email has been sent. Check your inbox." },
  resetPasswordFailed: { id: "Gagal mengirim email reset password.", en: "Failed to send password reset email." },
  realTime: { id: "Real-Time", en: "Real-Time" },
  postsLast24h: { id: "Postingan 24 jam", en: "Posts last 24h" },
  moodBased: { id: "Berdasarkan Mood", en: "Mood-Based" },
  syncWithFeelings: { id: "Sinkron dengan perasaan", en: "Sync with feelings" },
  pureSpace: { id: "Ruang Murni", en: "Pure Space" },
  noPerfection: { id: "Tanpa tuntutan sempurna", en: "No perfection" },
  newVibe: { id: "Vibe Baru", en: "New Vibe" },
  whatsYourVibe: { id: "Apa vibe kamu sekarang?", en: "What's your vibe right now?" },
  uploadingMedia: { id: "Mengunggah media {progress}%", en: "Uploading media {progress}%" },
  chooseMood: { id: "Pilih mood kamu", en: "Choose your mood" },
  addImageOrVideo: { id: "Tambah gambar atau video", en: "Add image or video" },
  anonymousMode: { id: "Mode Anonim", en: "Anonymous Mode" },
  postAnonymously: { id: "Posting Anonim", en: "Post Anonymously" },
  permanentPost: { id: "Posting Permanen", en: "Permanent Post" },
  disappearsIn24h: { id: "Hilang dalam 24 jam", en: "Disappears in 24h" },
  permanent: { id: "Permanen", en: "Permanent" },
  status24h: { id: "Status 24 Jam", en: "24h Status" },
} satisfies Record<string, TranslationValue>;

type TranslationKey = keyof typeof translations;

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("id");

  useEffect(() => {
    const stored = window.localStorage.getItem("vibespace-language");
    if (stored === "id" || stored === "en") {
      setLanguage(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("vibespace-language", language);
  }, [language]);

  const value = useMemo<LanguageContextType>(() => ({
    language,
    setLanguage,
    t: (key, vars) => {
      let text = translations[key][language];
      if (vars) {
        Object.entries(vars).forEach(([varKey, varValue]) => {
          text = text.replaceAll(`{${varKey}}`, String(varValue));
        });
      }
      return text;
    },
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
