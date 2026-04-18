import { cn } from "../lib/utils";

function getInitial(name?: string | null) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

export function Avatar({
  src,
  name,
  alt,
  className,
  textClassName,
}: {
  src?: string | null;
  name?: string | null;
  alt?: string;
  className?: string;
  textClassName?: string;
}) {
  const hasImage = Boolean(src && src.trim());

  return (
    <div className={cn("overflow-hidden rounded-full bg-vibe-accent", className)}>
      {hasImage ? (
        <img
          src={src!}
          alt={alt || name || "Avatar"}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-vibe-accent to-cyan-400 text-vibe-bg">
          <span className={cn("font-black uppercase", textClassName)}>
            {getInitial(name)}
          </span>
        </div>
      )}
    </div>
  );
}
