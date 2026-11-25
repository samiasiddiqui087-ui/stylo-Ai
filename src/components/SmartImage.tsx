import { useState } from 'react';
import { Sparkles } from 'lucide-react';

interface SmartImageProps {
  src?: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

export function SmartImage({ src, alt, className = '', loading = 'lazy' }: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`bg-gradient-to-br from-[#F7F3EC] via-[#EAE2D6] to-[#DFD5C5] flex flex-col items-center justify-center p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Sparkles className="w-5 h-5 text-[#B5945B] mb-1.5 opacity-80" />
        <span className="font-editorial text-xs text-[#70685E] line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
