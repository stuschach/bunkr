import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fallback?: string;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt = "", size = 'md', fallback, ...props }, ref) => {
    // Size mappings
    const sizeMap = {
      xs: { container: "h-6 w-6", text: "text-xs" },
      sm: { container: "h-8 w-8", text: "text-sm" },
      md: { container: "h-10 w-10", text: "text-base" },
      lg: { container: "h-12 w-12", text: "text-lg" },
      xl: { container: "h-16 w-16", text: "text-xl" },
    };
    
    // Generate initials from alt text if no src and no fallback provided
    const getInitials = () => {
      if (fallback) return fallback;
      if (!alt) return "";
      
      return alt
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    };
    
    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-full overflow-hidden flex items-center justify-center bg-green-fairway/10",
          sizeMap[size].container,
          className
        )}
        {...props}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
          />
        ) : (
          <span className={cn("text-green-fairway font-medium", sizeMap[size].text)}>
            {getInitials()}
          </span>
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar };