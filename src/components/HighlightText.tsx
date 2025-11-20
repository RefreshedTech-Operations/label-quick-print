interface HighlightTextProps {
  text: string;
  searchTerm: string;
}

export const HighlightText = ({ text, searchTerm }: HighlightTextProps) => {
  if (!searchTerm.trim() || !text) {
    return <>{text}</>;
  }

  const parts = text.split(new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  
  return (
    <>
      {parts.map((part, index) => 
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <mark key={index} className="bg-primary/20 text-primary font-semibold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
};
