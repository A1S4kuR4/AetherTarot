interface ChapterNumberProps {
  value?: string;
}

export function ChapterNumber({ value }: ChapterNumberProps) {
  if (!value) {
    return null;
  }

  return <p className="reading-chapter-number">CHAPTER {value}</p>;
}
