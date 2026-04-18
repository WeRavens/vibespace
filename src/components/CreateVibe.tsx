import React, { useState } from "react";
import { motion } from "motion/react";
import {
  X,
  Camera,
  Send,
  Ghost,
  Clock,
  Infinity as InfinityIcon,
} from "lucide-react";
import { MOODS, MoodId } from "../lib/types";
import { useAuth } from "../lib/AuthContext";
import { useUpload } from "../lib/UploadContext";
import { cn } from "../lib/utils";
import { useLanguage } from "../lib/LanguageContext";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

interface CreateVibeProps {
  onClose: () => void;
}

export function CreateVibe({ onClose }: CreateVibeProps) {
  const { user } = useAuth();
  const { startVibeUpload, maxMediaSizeMb, activeUpload } = useUpload();
  const { t } = useLanguage();
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<MoodId>("chill");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPermanent, setIsPermanent] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setErrorMessage(null);

      if (file.size > maxMediaSizeMb * 1024 * 1024) {
        setMediaFile(null);
        setMediaPreview(null);
        setErrorMessage(
          `Ukuran file terlalu besar. Maksimum ${maxMediaSizeMb}MB agar upload di Android lebih stabil.`,
        );
        e.target.value = "";
        return;
      }

      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));

      if (Capacitor.isNativePlatform()) {
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      }
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;

    setErrorMessage(null);
    try {
      if (Capacitor.isNativePlatform()) {
        Haptics.notification({ type: ImpactStyle.Heavy as any }).catch(() => {});
      }

      startVibeUpload({
        content,
        mood,
        isAnonymous,
        isPermanent,
        mediaFile,
      });

      removeMedia();
      setContent("");
      setMood("chill");
      setIsAnonymous(false);
      setIsPermanent(false);
      onClose();
    } catch (error) {
      console.error("Error creating vibe:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat membuat vibe.",
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-vibe-black/90 px-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md overflow-hidden rounded-[32px] bg-[#111] border border-vibe-line p-8 shadow-2xl"
      >
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[2px] text-vibe-muted">
            {t("newVibe")}
          </h2>
          <button
            onClick={onClose}
            className="text-vibe-muted hover:text-vibe-ink"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("whatsYourVibe")}
              className="h-40 w-full resize-none bg-transparent border-b border-vibe-line py-2 text-2xl font-serif italic focus:outline-none focus:border-vibe-accent transition-colors"
              maxLength={280}
            />

            {mediaPreview && (
              <div className="relative mt-4 overflow-hidden rounded-2xl border border-vibe-line bg-black">
                <button
                  type="button"
                  onClick={removeMedia}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/80 z-10"
                >
                  <X size={16} />
                </button>
                {mediaFile?.type.startsWith("video/") ? (
                  <video
                    src={mediaPreview}
                    controls
                    playsInline
                    className="h-48 w-full object-contain"
                  />
                ) : (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="h-48 w-full object-contain"
                  />
                )}
              </div>
            )}

            {errorMessage && (
              <p className="mt-4 text-sm text-red-400">{errorMessage}</p>
            )}

            {activeUpload?.status === "uploading" && mediaFile && (
              <div className="mt-4 space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-vibe-accent transition-[width] duration-300"
                    style={{ width: `${activeUpload.progress}%` }}
                  />
                </div>
                <p className="text-xs uppercase tracking-[2px] text-vibe-muted">
                  {t("uploadingMedia", { progress: activeUpload.progress })}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-4 block text-[10px] font-bold uppercase tracking-wider text-vibe-muted">
              {t("chooseMood")}
            </label>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMood(m.id)}
                  className={cn(
                    "px-4 py-2 rounded-full border text-[11px] uppercase tracking-wider transition-all",
                    mood === m.id
                      ? "border-vibe-accent text-vibe-accent bg-vibe-accent/5"
                      : "border-vibe-line text-vibe-muted hover:border-vibe-ink hover:text-vibe-ink",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center space-x-4">
              <div>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("media-upload")?.click()
                  }
                  className="text-vibe-muted hover:text-vibe-accent transition-colors"
                  title={t("addImageOrVideo")}
                >
                  <Camera size={24} />
                </button>
                <input
                  id="media-upload"
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={cn(
                  "flex items-center space-x-2 text-[11px] uppercase tracking-wider transition-all",
                  isAnonymous
                    ? "text-vibe-accent"
                    : "text-vibe-muted hover:text-vibe-ink",
                )}
              >
                <Ghost size={14} />
                <span className="hidden sm:inline">
                  {isAnonymous ? t("anonymousMode") : t("postAnonymously")}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsPermanent(!isPermanent)}
                className={cn(
                  "flex items-center space-x-2 text-[11px] uppercase tracking-wider transition-all",
                  isPermanent
                    ? "text-vibe-accent"
                    : "text-vibe-muted hover:text-vibe-ink",
                )}
                title={isPermanent ? t("permanentPost") : t("disappearsIn24h")}
              >
                {isPermanent ? <InfinityIcon size={14} /> : <Clock size={14} />}
                <span className="hidden sm:inline">
                  {isPermanent ? t("permanent") : t("status24h")}
                </span>
              </button>
            </div>

            <button
              disabled={!content.trim() || activeUpload?.status === "uploading"}
              type="submit"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-vibe-accent text-vibe-bg shadow-[0_0_20px_rgba(0,255,209,0.3)] disabled:opacity-50 transition-transform active:scale-95 hover:scale-105"
            >
              <Send size={24} />
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
