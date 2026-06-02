"use client";

import { Facehash } from "facehash";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

interface UserAvatarProps {
  user: { name: string; image: string | null };
  size?: "sm" | "lg" | "xl" | number;
  className?: string;
  intensity3d?: "none" | "medium";
}

const SIZE_MAP = { sm: 24, lg: 40, xl: 48 } as const;

export function UserAvatar({
  user,
  size = "lg",
  className,
  intensity3d = "medium",
}: UserAvatarProps) {
  if (!user.image) {
    return (
      <Facehash
        name={user.name}
        size={typeof size === "number" ? size : SIZE_MAP[size]}
        variant="solid"
        intensity3d={intensity3d}
        enableBlink
        className={className}
      />
    );
  }

  // Build radius-aware classes from the className since the AvatarImage
  // and AvatarFallback need matching radius to look correct.
  const radiusClass = className?.match(/rounded-\S+/g)?.join(" ") ?? "";

  // Named sizes pass the size prop; numeric sizes use inline style
  const isNumeric = typeof size === "number";

  return (
    <Avatar
      size={isNumeric ? undefined : size}
      className={className}
      style={isNumeric ? { width: size, height: size } : undefined}
    >
      <AvatarImage src={user.image} alt={user.name} className={radiusClass} />
      <AvatarFallback className={`${radiusClass} text-[10px] font-semibold`}>
        {getInitials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}
