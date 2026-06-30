import Image from "next/image";
import { cn } from "@/lib/utils";

const CARD_IMAGE_WIDTH = 1000;
const CARD_IMAGE_HEIGHT = 1700;

type CardImageProps = {
  src: string;
  alt: string;
  sizes?: string;
  isReversed?: boolean;
  intrinsicWidth?: number;
  quality?: 50 | 75 | 80;
  priority?: boolean;
  loading?: "eager" | "lazy";
  className?: string;
};

export default function CardImage({
  src,
  alt,
  sizes,
  isReversed = false,
  intrinsicWidth,
  quality = 75,
  priority = false,
  loading,
  className,
}: CardImageProps) {
  const imageWidth = intrinsicWidth ?? CARD_IMAGE_WIDTH;
  const imageHeight = Math.round(imageWidth * (CARD_IMAGE_HEIGHT / CARD_IMAGE_WIDTH));

  return (
    <Image
      src={src}
      alt={alt}
      width={imageWidth}
      height={imageHeight}
      sizes={sizes}
      quality={quality}
      priority={priority}
      loading={priority ? undefined : loading}
      className={cn(
        "block aspect-[1/1.7] w-full object-contain",
        isReversed && "rotate-180",
        className,
      )}
    />
  );
}
