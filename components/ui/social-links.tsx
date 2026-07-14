import type { SVGProps } from 'react';
import { FacebookIcon, InstagramIcon, TiktokIcon, YoutubeIcon } from '@/components/ui/icons';

type Social = {
  id: string;
  label: string;
  href: string;
  Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
};

const SOCIAL_LINKS: readonly Social[] = [
  { id: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/NumerologiaCotidiana', Icon: FacebookIcon },
  { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/numerologia_cotidiana/', Icon: InstagramIcon },
  { id: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/channel/UCLpxV1bxOgtQ6ADN9Xkn5rg', Icon: YoutubeIcon },
  { id: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@lanumerologiadelaura', Icon: TiktokIcon },
];

export function SocialLinks({
  className,
  itemClassName,
  iconSize = 18,
}: {
  className?: string;
  itemClassName?: string;
  iconSize?: number;
}) {
  return (
    <ul className={className}>
      {SOCIAL_LINKS.map(({ id, label, href, Icon }) => (
        <li key={id}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className={itemClassName}
          >
            <Icon width={iconSize} height={iconSize} />
          </a>
        </li>
      ))}
    </ul>
  );
}
