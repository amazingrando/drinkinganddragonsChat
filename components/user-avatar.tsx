import Avatar from "boring-avatars";

interface UserAvatarProps {
  src?: string
  size?: number
  className?: string
}

const UserAvatar = ({ src, size, className }: UserAvatarProps) => {
  return (
    <>
      <Avatar
        className={className}
        size={size}
        name={src}
        variant="beam"
        colors={["#9184f0ff", "#fb870aff", "#708bf9ff", "#d8116bff"]}
        aria-label={`User avatar for ${src}`}
      />
      {console.log("src", src)}
    </>
  )
}

export default UserAvatar