import React, { useState, useEffect } from 'react';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-xs',
    xl: 'w-24 h-24 text-2xl',
  };

  const dimensions = sizeClasses[size] || sizeClasses.md;
  
  const getInitials = (str?: string | null): string => {
    if (!str || !str.trim()) return 'SX';
    const parts = str.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const initials = getInitials(name);

  if (src && !imageError) {
    return (
      <img
        src={src}
        alt={name || 'User Profile'}
        onError={() => setImageError(true)}
        className={`${dimensions} rounded-full object-cover shadow-2xs ${className}`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`${dimensions} rounded-full bg-primary/20 text-primary font-black flex items-center justify-center uppercase border border-primary/30 shadow-2xs ${className}`}
    >
      {initials}
    </div>
  );
};
