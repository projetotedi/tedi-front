import { Avatar as HeroAvatar } from "@heroui/react";

export interface AvatarProps {
  /** Nome de onde saem as iniciais. O avatar é decorativo: o nome precisa estar em texto ao lado. */
  name: string;
  className?: string;
}

/** Primeira letra do primeiro e do último nome ("Ana Paula Torres" → "AT"). */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

export function Avatar({ name, className = "" }: AvatarProps) {
  return (
    <HeroAvatar aria-hidden="true" className={`size-9 shrink-0 ${className}`}>
      <HeroAvatar.Fallback className="text-sm font-semibold">
        {getInitials(name)}
      </HeroAvatar.Fallback>
    </HeroAvatar>
  );
}
