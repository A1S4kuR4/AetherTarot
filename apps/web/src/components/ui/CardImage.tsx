import Image from "next/image";
import { cn } from "@/lib/utils";

const CARD_IMAGE_WIDTH = 1000;
const CARD_IMAGE_HEIGHT = 1700;

type CardImageProps = {
  src: string;
  alt: string;
  sizes: string;
  isReversed?: boolean;
  quality?: 50 | 75 | 80;
  priority?: boolean;
  className?: string;
};

export default function CardImage({
  src,
  alt,
  sizes,
  isReversed = false,
  quality = 75,
  priority = false,
  className,
}: CardImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={CARD_IMAGE_WIDTH}
      height={CARD_IMAGE_HEIGHT}
      sizes={sizes}
      quality={quality}
      priority={priority}
      className={cn(
        "block aspect-[1/1.7] w-full object-cover",
        isReversed && "rotate-180",
        className,
      )}
    />
  );
}
