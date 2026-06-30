export function getRevealCardImageUrl(imageUrl: string) {
  if (!imageUrl.startsWith("/cardsV2/")) {
    return imageUrl;
  }

  const fileName = imageUrl.split("/").at(-1);

  if (!fileName) {
    return imageUrl;
  }

  const baseName = fileName.replace(/\.[^.]+$/, "");
  return `/cardsV2/reveal/${baseName}.webp`;
}
