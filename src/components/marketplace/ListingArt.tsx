import { Icon } from '../ui/Icon';
import { cx } from '../../lib/utils';

/**
 * Placeholder listing artwork — deterministic blue-gradient tile with a
 * category icon. Swap for real images when the backend serves uploads.
 */
export function ListingArt({
  icon,
  images,
  gradient = 'blue',
  size = 'md',
  className,
}: {
  icon: string;
  images?: string[];
  gradient?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    sm: 'h-20 w-20 rounded-xl',
    md: 'h-36 w-full rounded-t-2xl',
    lg: 'h-48 w-full rounded-t-2xl',
  };
  const iconSizes = { sm: 28, md: 44, lg: 56 };
  const image = images?.find((src) => src.startsWith('data:image/') || src.startsWith('https://') || src.startsWith('http://'));
  return (
    <div
      className={cx(
        'flex items-center justify-center bg-gradient-to-br text-white',
        gradient === 'blue' && 'from-primary via-primary-500 to-accent',
        sizes[size],
        className,
      )}
    >
      {image ? (
        <img src={image} alt="Listing" className="h-full w-full object-cover" />
      ) : (
        <Icon name={icon} size={iconSizes[size]} className="opacity-90" />
      )}
    </div>
  );
}
