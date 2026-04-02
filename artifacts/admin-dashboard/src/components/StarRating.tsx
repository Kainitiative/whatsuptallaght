import { useState } from "react";

interface StarRatingProps {
  value: number | null;
  onChange?: (rating: number | null) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}

export default function StarRating({ value, onChange, readonly = false, size = "md" }: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value ?? 0;
  const starSize = size === "sm" ? "text-sm" : "text-xl";

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => {
            if (!readonly && onChange) {
              onChange(value === star ? null : star);
            }
          }}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(null)}
          className={`${starSize} transition-colors ${readonly ? "cursor-default" : "cursor-pointer"} ${
            star <= display ? "text-amber-400" : "text-gray-200"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
