import React, { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  /** Sizing / shape / ring classes for the rendered element. */
  className?: string;
  /** Optional custom fallback node. Defaults to the sitewide profile icon. */
  fallback?: React.ReactNode;
}

/**
 * Profile avatar used everywhere a voter, candidate, official or committee
 * member is shown. Empty, whitespace-only or failed image URLs fall back to a
 * consistent profile icon instead of the browser's broken-image icon.
 */
export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  className = '',
  fallback,
}) => {
  const normalizedSrc = typeof src === 'string' ? src.trim() : '';
  const [broken, setBroken] = useState(false);

  // A new avatar URL (e.g. after a profile update) gets a fresh attempt.
  useEffect(() => {
    setBroken(false);
  }, [normalizedSrc]);

  if (normalizedSrc && !broken) {
    return (
      <img
        src={normalizedSrc}
        alt={alt}
        className={className}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center overflow-hidden shrink-0 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white ${className}`}
      role="img"
      aria-label={alt ? `${alt}'s profile` : 'Profile'}
    >
      {fallback ?? <UserRound className="w-3/5 h-3/5" strokeWidth={1.8} aria-hidden="true" />}
    </div>
  );
};
