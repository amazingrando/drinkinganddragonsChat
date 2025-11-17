import Avatar from "boring-avatars";
import { Avatar as UIAvatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface UserAvatarProps {
  src?: string // Email or identifier for fallback avatar
  imageUrl?: string | null // Custom uploaded avatar URL
  size?: number
  className?: string
}

const UserAvatar = ({ src, imageUrl, size = 40, className }: UserAvatarProps) => {
  // If there's a custom imageUrl and it's not empty, use it
  if (imageUrl && imageUrl.trim() !== "") {
    return (
      <UIAvatar className={className} style={{ width: size, height: size }}>
        <AvatarImage src={imageUrl} alt={src ? `Avatar for ${src}` : "User avatar"} />
        <AvatarFallback>
          <Avatar
            className={className}
            size={size}
            name={src || "user"}
            variant="beam"
            colors={["#9184f0ff", "#fb870aff", "#708bf9ff", "#d8116bff"]}
            aria-label={`User avatar for ${src}`}
          />
        </AvatarFallback>
      </UIAvatar>
    );
  }

  // Fallback to boring-avatars
  return (
    <Avatar
      className={className}
      size={size}
      name={src || "user"}
      variant="beam"
      colors={["#9184f0ff", "#fb870aff", "#708bf9ff", "#d8116bff"]}
      aria-label={`User avatar for ${src}`}
    />
  )
}

export default UserAvatar