import { createHomeSocialImage, socialImageSize } from '@/lib/og';

export const dynamic = 'force-static';
export const alt = 'discord-player v8, a music framework for Discord powered by Remedia';
export const size = socialImageSize;
export const contentType = 'image/png';

export default function Image() {
  return createHomeSocialImage();
}
