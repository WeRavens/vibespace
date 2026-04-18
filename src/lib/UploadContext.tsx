import React, { createContext, useContext, useMemo, useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { auth, db } from "./firebase";
import { MoodId } from "./types";

const CLOUDINARY_CLOUD_NAME = "df0sltu6v";
const CLOUDINARY_UPLOAD_PRESET = "zgsciaie";
const MAX_MEDIA_SIZE_MB = 100;
const MAX_MEDIA_SIZE_BYTES = MAX_MEDIA_SIZE_MB * 1024 * 1024;

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface CreateVibeUploadInput {
  content: string;
  mood: MoodId;
  isAnonymous: boolean;
  isPermanent: boolean;
  mediaFile: File | null;
}

interface UploadState {
  id: number;
  progress: number;
  status: UploadStatus;
  errorMessage: string | null;
}

interface UploadContextType {
  activeUpload: UploadState | null;
  maxMediaSizeMb: number;
  startVibeUpload: (input: CreateVibeUploadInput) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

function uploadMediaToCloudinary(
  file: File,
  onProgress: (progress: number) => void,
) {
  return new Promise<string>((resolve, reject) => {
    const formData = new FormData();
    const resourceType = file.type.startsWith("video/") ? "video" : "image";

    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    );
    xhr.timeout = 10 * 60 * 1000;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText || "{}");

        if (xhr.status >= 200 && xhr.status < 300 && response.secure_url) {
          onProgress(100);
          resolve(response.secure_url);
          return;
        }

        reject(
          new Error(
            response?.error?.message ||
              "Upload media gagal. Coba gunakan file yang lebih kecil atau koneksi yang lebih stabil.",
          ),
        );
      } catch {
        reject(new Error("Respons upload media tidak valid."));
      }
    };

    xhr.onerror = () => {
      reject(
        new Error(
          "Koneksi upload terputus. Coba lagi saat jaringan lebih stabil.",
        ),
      );
    };

    xhr.ontimeout = () => {
      reject(
        new Error(
          "Upload media terlalu lama dan dihentikan. Coba kompres video atau gunakan durasi yang lebih pendek.",
        ),
      );
    };

    xhr.send(formData);
  });
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeUpload, setActiveUpload] = useState<UploadState | null>(null);
  const uploadIdRef = useRef(0);
  const clearTimerRef = useRef<number | null>(null);

  const clearActiveUploadLater = (delayMs: number) => {
    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current);
    }

    clearTimerRef.current = window.setTimeout(() => {
      setActiveUpload((current) =>
        current?.status === "uploading" ? current : null,
      );
      clearTimerRef.current = null;
    }, delayMs);
  };

  const startVibeUpload = ({
    content,
    mood,
    isAnonymous,
    isPermanent,
    mediaFile,
  }: CreateVibeUploadInput) => {
    const currentUser = auth?.currentUser ?? user;

    if (!currentUser || !db) {
      throw new Error("Kamu harus login sebelum membuat vibe.");
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new Error("Isi vibe tidak boleh kosong.");
    }

    if (mediaFile && mediaFile.size > MAX_MEDIA_SIZE_BYTES) {
      throw new Error(
        `Ukuran file melebihi ${MAX_MEDIA_SIZE_MB}MB. Video Android yang lebih panjang biasanya perlu dikompres dulu sebelum diupload.`,
      );
    }

    const uploadId = ++uploadIdRef.current;
    setActiveUpload({
      id: uploadId,
      progress: mediaFile ? 0 : 100,
      status: "uploading",
      errorMessage: null,
    });

    void (async () => {
      try {
        let mediaUrl: string | null = null;
        let postType: "text" | "photo" | "video" = "text";

        if (mediaFile) {
          mediaUrl = await uploadMediaToCloudinary(mediaFile, (progress) => {
            setActiveUpload((current) =>
              current?.id === uploadId
                ? { ...current, progress, status: "uploading" }
                : current,
            );
          });
          postType = mediaFile.type.startsWith("video/") ? "video" : "photo";
        }

        const expiresAt = new Date();
        if (isPermanent) {
          expiresAt.setFullYear(9999);
        } else {
          expiresAt.setHours(expiresAt.getHours() + 24);
        }

        await addDoc(collection(db, "vibes"), {
          userId: currentUser.uid,
          authorName: currentUser.displayName,
          authorPhoto: currentUser.photoURL,
          content: trimmedContent,
          mood,
          isAnonymous,
          type: postType,
          mediaUrl,
          createdAt: serverTimestamp(),
          expiresAt,
          isPermanent,
          reactions: {},
        });

        setActiveUpload((current) =>
          current?.id === uploadId
            ? {
                ...current,
                progress: 100,
                status: "success",
                errorMessage: null,
              }
            : current,
        );
        clearActiveUploadLater(1200);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat membuat vibe.";

        setActiveUpload((current) =>
          current?.id === uploadId
            ? { ...current, status: "error", errorMessage: message }
            : current,
        );
        clearActiveUploadLater(4000);
      }
    })();
  };

  const value = useMemo(
    () => ({
      activeUpload,
      maxMediaSizeMb: MAX_MEDIA_SIZE_MB,
      startVibeUpload,
    }),
    [activeUpload],
  );

  return (
    <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUpload must be used within an UploadProvider");
  }
  return context;
}
