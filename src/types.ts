export enum Suit {
  Spades = "S",
  Hearts = "H",
  Clubs = "C",
  Diamonds = "D",
}

export enum Rank {
  Two = 2,
  Three,
  Four,
  Five,
  Six,
  Seven,
  Eight,
  Nine,
  Ten,
  Jack = 11,
  Queen = 12,
  King = 13,
  Ace = 14,
}

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export enum GamePhase {
  LOBBY = "LOBBY",
  HAKIM_DETERMINATION = "HAKIM_DETERMINATION",
  DEALING_INITIAL = "DEALING_INITIAL", // First 4
  HAKIM_CHOOSING_SUIT = "HAKIM_CHOOSING_SUIT",
  DEALING_REMAINDER = "DEALING_REMAINDER",
  PLAYING = "PLAYING",
  ROUND_END = "ROUND_END",
  MATCH_END = "MATCH_END",
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  teamId: number; // 1 or 2
  isConnected: boolean;
}

export interface GameState {
  roomId: string;
  mode: "2p" | "4p"; // Game Mode
  phase: GamePhase;
  players: (Player | null)[]; // Array of 2 or 4 players (nullable for empty slots in lobby)
  deck: Card[];
  hakimId: string | null;
  hokm: Suit | null;
  currentTurnPlayerId: string | null;
  tableCards: { playerId: string; card: Card }[];

  scores: { [teamId: number]: number };
  currentRoundTricks: { [teamId: number]: number };

  hakimDeterminationCards: Card[];
  lastWinnerId: string | null;
  logs: string[];

  lastActionTimestamp?: number;
}

export const SUIT_ICONS = {
  [Suit.Spades]: "♠",
  [Suit.Hearts]: "♥",
  [Suit.Clubs]: "♣",
  [Suit.Diamonds]: "♦",
};

export const SUIT_COLORS = {
  [Suit.Spades]: "text-cardBlack",
  [Suit.Hearts]: "text-cardRed",
  [Suit.Clubs]: "text-cardBlack",
  [Suit.Diamonds]: "text-cardRed",
};
