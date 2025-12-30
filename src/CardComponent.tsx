import React from "react";
import { Card, Suit, Rank, SUIT_ICONS, SUIT_COLORS } from "./types";
import clsx from "clsx";

interface CardProps {
  card: Card;
  onClick?: () => void;
  selected?: boolean;
  faceDown?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const CardComponent: React.FC<CardProps> = ({
  card,
  onClick,
  selected,
  faceDown = false,
  className,
  size = "md",
}) => {
  const isRed = card.suit === Suit.Hearts || card.suit === Suit.Diamonds;

  const sizeClasses = {
    sm: "w-12 h-16 text-xs",
    md: "w-20 h-28 text-base", // Mobile standard
    lg: "w-24 h-36 text-lg",
  };

  const rankDisplay = (r: Rank) => {
    switch (r) {
      case 11:
        return "J";
      case 12:
        return "Q";
      case 13:
        return "K";
      case 14:
        return "A";
      default:
        return r.toString();
    }
  };

  if (faceDown) {
    return (
      <div
        className={clsx(
          "relative bg-white rounded-lg shadow-md border-2 border-white select-none transition-transform",
          sizeClasses[size],
          className
        )}
      >
        <div className="w-full h-full bg-blue-900 rounded-md overflow-hidden card-pattern border border-gray-300 opacity-90">
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <span className="text-white/40 font-bold">♠</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={clsx(
        "relative bg-white rounded-lg shadow-md select-none transition-all duration-200 cursor-pointer border border-gray-200",
        sizeClasses[size],
        SUIT_COLORS[card.suit],
        selected
          ? "-translate-y-4 ring-2 ring-yellow-400 z-10"
          : "hover:-translate-y-1",
        className
      )}
    >
      {/* Top Left Corner */}
      <div className="absolute top-1 left-1 flex flex-col items-center leading-none">
        <span className="font-bold">{rankDisplay(card.rank)}</span>
        <span>{SUIT_ICONS[card.suit]}</span>
      </div>

      {/* Center Big Icon */}
      <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-20 pointer-events-none">
        {SUIT_ICONS[card.suit]}
      </div>

      {/* Center Rank (for readability) */}
      {[11, 12, 13].includes(card.rank) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={clsx(
              "text-2xl font-black border-2 rounded-full w-10 h-10 flex items-center justify-center opacity-80",
              isRed ? "border-red-200" : "border-gray-200"
            )}
          >
            {rankDisplay(card.rank)}
          </span>
        </div>
      )}

      {/* Bottom Right Corner (Rotated) */}
      <div className="absolute bottom-1 right-1 flex flex-col items-center leading-none transform rotate-180">
        <span className="font-bold">{rankDisplay(card.rank)}</span>
        <span>{SUIT_ICONS[card.suit]}</span>
      </div>
    </div>
  );
};

export default CardComponent;
