import { Card, Rank, Suit, Player } from "./types";

// Create a standard 52 card deck
export const createDeck = (): Card[] => {
  const suits = [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds];
  const deck: Card[] = [];
  suits.forEach((suit) => {
    for (let r = 2; r <= 14; r++) {
      deck.push({
        id: `${suit}-${r}`,
        suit,
        rank: r as Rank,
      });
    }
  });
  return shuffleDeck(deck);
};

// Fischer-Yates Shuffle
export const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

// Sort Hand: Alternating Colors (Black, Red, Black, Red) -> Spades, Hearts, Clubs, Diamonds
export const sortHand = (hand: Card[]): Card[] => {
  const suitOrder = {
    [Suit.Spades]: 1, // Black
    [Suit.Hearts]: 2, // Red
    [Suit.Clubs]: 3, // Black
    [Suit.Diamonds]: 4, // Red
  };

  return [...hand].sort((a, b) => {
    if (a.suit !== b.suit) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return b.rank - a.rank; // Descending rank
  });
};

export const getCardName = (card: Card): string => {
  const ranks: Record<number, string> = {
    11: "سرباز",
    12: "بی‌بی",
    13: "شاه",
    14: "تک",
  };
  const suits: Record<Suit, string> = {
    [Suit.Spades]: "پیک",
    [Suit.Hearts]: "دل",
    [Suit.Clubs]: "گشنیز",
    [Suit.Diamonds]: "خشت",
  };

  const r = ranks[card.rank] || card.rank.toString();
  return `${r} ${suits[card.suit]}`;
};

// Determine winner of a trick
export const determineTrickWinner = (
  cards: { playerId: string; card: Card }[],
  hokm: Suit,
  starterSuit: Suit
): string => {
  let winnerId = cards[0].playerId;
  let winningCard = cards[0].card;

  for (let i = 1; i < cards.length; i++) {
    const current = cards[i].card;
    const currentPid = cards[i].playerId;

    // Logic:
    // 1. If current is Hokm and winning wasn't, current wins.
    // 2. If both Hokm, higher rank wins.
    // 3. If neither Hokm, but current follows suit and is higher, current wins.
    // 4. (If current didn't follow suit and isn't Hokm, it loses).

    const isCurrentHokm = current.suit === hokm;
    const isWinningHokm = winningCard.suit === hokm;

    if (isCurrentHokm && !isWinningHokm) {
      winningCard = current;
      winnerId = currentPid;
    } else if (isCurrentHokm && isWinningHokm) {
      if (current.rank > winningCard.rank) {
        winningCard = current;
        winnerId = currentPid;
      }
    } else if (!isCurrentHokm && !isWinningHokm) {
      if (current.suit === starterSuit && current.suit === winningCard.suit) {
        if (current.rank > winningCard.rank) {
          winningCard = current;
          winnerId = currentPid;
        }
      }
    }
  }
  return winnerId;
};

// Calculate Game Points based on Hokm/Kot rules
export const calculateRoundPoints = (
  winningTeamTricks: number,
  losingTeamTricks: number,
  isWinnerHakimTeam: boolean
): number => {
  // If losing team got 0 tricks -> Kot
  if (losingTeamTricks === 0) {
    if (!isWinnerHakimTeam) {
      // Hakim got Kot (Hakim Kot) -> 3 points
      return 3;
    } else {
      // Normal Kot -> 2 points
      return 2;
    }
  }
  // Normal win -> 1 point
  return 1;
};
