import React, { useEffect, useState } from "react";
import {
  GameState,
  GamePhase,
  Player,
  Suit,
  Card,
  Rank,
  SUIT_ICONS,
} from "./types";
import CardComponent from "./CardComponent";
import { sortHand, getCardName } from "./utils";
import clsx from "clsx";
import { Share2, Copy, WifiOff } from "lucide-react";

interface PlayingTableProps {
  gameState: GameState;
  myPlayerId: string;
  onCardPlay: (card: Card) => void;
  onSetHokm: (suit: Suit) => void;
}

const PlayingTable: React.FC<PlayingTableProps> = ({
  gameState,
  myPlayerId,
  onCardPlay,
  onSetHokm,
}) => {
  const players = gameState.players;
  const myIndex = players.findIndex((p) => p && p.id === myPlayerId);
  const me = players[myIndex];

  // Derive other players based on relative position
  let teammate: Player | null | undefined = null;
  let leftOpponent: Player | null | undefined = null;
  let rightOpponent: Player | null | undefined = null;
  let topOpponent: Player | null | undefined = null; // For 2p mode

  if (gameState.mode === "2p") {
    topOpponent = players.find((p) => p && p.id !== myPlayerId);
  } else {
    // 4p Mode
    // Indices: 0, 1, 2, 3
    // My Index = i
    // Right = (i + 1) % 4
    // Teammate (Top) = (i + 2) % 4
    // Left = (i + 3) % 4
    if (myIndex !== -1) {
      rightOpponent = players[(myIndex + 1) % 4];
      teammate = players[(myIndex + 2) % 4];
      leftOpponent = players[(myIndex + 3) % 4];
    }
  }

  const [myHand, setMyHand] = useState<Card[]>([]);
  const [cooldownActive, setCooldownActive] = useState(false);

  // Sync hand and sort it
  useEffect(() => {
    if (me?.hand) {
      setMyHand(sortHand(me.hand));
    }
  }, [me?.hand]);

  // Manage 2-second cooldown timer
  useEffect(() => {
    const checkCooldown = () => {
      const now = Date.now();
      const lastAction = gameState.lastActionTimestamp || 0;
      const diff = now - lastAction;

      if (diff < 2000) {
        setCooldownActive(true);
        const remaining = 2000 - diff;
        const timer = setTimeout(() => {
          setCooldownActive(false);
        }, remaining);
        return () => clearTimeout(timer);
      } else {
        setCooldownActive(false);
      }
    };

    return checkCooldown();
  }, [gameState.lastActionTimestamp, gameState.currentTurnPlayerId]);

  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  const isChoosingHokm =
    gameState.phase === GamePhase.HAKIM_CHOOSING_SUIT &&
    gameState.hakimId === myPlayerId;
  const isHakimDetermining = gameState.phase === GamePhase.HAKIM_DETERMINATION;

  // Visual helper for "Hakim determination" animation
  const [flippedCard, setFlippedCard] = useState<Card | null>(null);
  const [flippedCardOwnerName, setFlippedCardOwnerName] = useState<string>("");

  useEffect(() => {
    if (isHakimDetermining && gameState.hakimDeterminationCards.length > 0) {
      const last =
        gameState.hakimDeterminationCards[
          gameState.hakimDeterminationCards.length - 1
        ];
      setFlippedCard(last);

      const lastIndex = gameState.hakimDeterminationCards.length - 1;
      const ownerIndex = lastIndex % (gameState.mode === "4p" ? 4 : 2); // Correct mod for determination
      const owner = gameState.players[ownerIndex];

      if (owner) {
        if (owner.id === myPlayerId) {
          setFlippedCardOwnerName("کارت شما");
        } else {
          setFlippedCardOwnerName(owner.name);
        }
      }
    }
  }, [
    gameState.hakimDeterminationCards,
    isHakimDetermining,
    myPlayerId,
    gameState.players,
    gameState.mode,
  ]);

  if (!me)
    return (
      <div className="text-white text-center mt-20">Waiting for players...</div>
    );

  const getHandSpacing = (count: number) => {
    if (count <= 5) return "-space-x-6 md:-space-x-6";
    if (count <= 8) return "-space-x-10 md:-space-x-8";
    if (count <= 10) return "-space-x-12 md:-space-x-10";
    return "-space-x-[3.4rem] md:-space-x-12";
  };

  const handSpacingClass = getHandSpacing(myHand.length);

  // Check if play is blocked by game logic
  const maxTable = gameState.mode === "4p" ? 4 : 2;
  const isTableFull = gameState.tableCards.length >= maxTable;
  const canPlay =
    isMyTurn &&
    !isChoosingHokm &&
    gameState.phase === GamePhase.PLAYING &&
    !isTableFull &&
    !cooldownActive;

  // Check Opponent Connection (Any disconnect triggers overlay)
  const disconnectedPlayer = players.find(
    (p) => p && p.id !== myPlayerId && p.isConnected === false
  );

  // --- Render Helper for Opponents ---
  const renderOpponentHand = (
    p: Player | null | undefined,
    position: "top" | "left" | "right"
  ) => {
    if (!p) return null;
    const isTurn = gameState.currentTurnPlayerId === p.id;
    const handCount = p.hand?.length || 0;

    let containerStyle = {};
    let wrapperClass = "";
    let cardsContainerClass = "";
    let nameClass = "";

    if (position === "top") {
      wrapperClass =
        "absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-20";
      cardsContainerClass = "flex -space-x-3 rtl:space-x-reverse";
      nameClass = "mt-1 text-center";
    } else if (position === "left") {
      // Rotate the container 90 degrees CCW
      // origin-left ensures it pivots from the left edge of the screen
      wrapperClass =
        "absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center z-20 origin-center -rotate-90 translate-x-[-35%]";
      cardsContainerClass = "flex -space-x-8 rtl:space-x-reverse";
      nameClass = "mt-2 text-center rotate-180"; // Name needs to be readable or rotated?
      // Actually, if container is -90, name is also -90 (reading up).
    } else if (position === "right") {
      // Rotate the container 90 degrees CW
      wrapperClass =
        "absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center z-20 origin-center rotate-90 translate-x-[35%]";
      cardsContainerClass = "flex -space-x-8 rtl:space-x-reverse";
      nameClass = "mt-2 text-center";
    }

    return (
      <div className={wrapperClass} style={containerStyle}>
        <div className="relative">
          <div className={cardsContainerClass}>
            {Array.from({ length: handCount }).map((_, i) => (
              <CardComponent
                key={i}
                card={{ id: "unknown", rank: 2, suit: Suit.Spades }}
                faceDown
                size="sm"
                className="shadow-md border-white/50"
              />
            ))}
          </div>
          {isTurn && (
            <div className="absolute -inset-2 border-2 border-yellow-400 rounded-xl animate-pulse pointer-events-none"></div>
          )}
        </div>
        <div
          className={`text-white text-xs font-bold bg-black/40 px-2 py-0.5 rounded shadow backdrop-blur-sm ${nameClass} whitespace-nowrap`}
        >
          {p.name}
          {position === "top" && gameState.mode === "4p" && (
            <span className="text-green-400 ml-1">(یار)</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-felt flex flex-col overflow-hidden select-none">
      {/* DISCONNECT OVERLAY */}
      {disconnectedPlayer && gameState.phase !== GamePhase.MATCH_END && (
        <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center text-white px-8 text-center animate-in fade-in duration-300">
          <div className="bg-red-500/20 p-6 rounded-full mb-4 animate-pulse">
            <WifiOff className="w-16 h-16 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">بازیکن قطع شد!</h2>
          <p className="text-gray-300 mb-6">
            لطفا منتظر بازگشت {disconnectedPlayer.name} بمانید...
          </p>
          <div className="w-16 h-1 bg-white/20 rounded-full overflow-hidden">
            <div className="w-full h-full bg-white animate-[loading_2s_ease-in-out_infinite] origin-left"></div>
          </div>
        </div>
      )}

      {/* Top Info Bar */}
      <div className="shrink-0 h-14 bg-black/40 backdrop-blur-sm flex justify-between items-center px-4 z-50 text-white shadow-lg border-b border-white/10 relative">
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-gray-300">دست‌ها</span>
            <div className="font-bold text-lg leading-none font-mono flex gap-2">
              <span className="text-green-400">{gameState.scores[1]}</span>
              <span className="text-gray-500">:</span>
              <span className="text-red-400">{gameState.scores[2]}</span>
            </div>
          </div>
          <div className="h-6 w-[1px] bg-white/20"></div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-300">تریک</span>
            <span className="font-bold font-mono text-sm">
              {gameState.currentRoundTricks[1]} -{" "}
              {gameState.currentRoundTricks[2]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {gameState.hokm && (
            <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full border border-white/10">
              <span className="text-[10px]">حکم:</span>
              <span
                className={clsx(
                  "text-lg font-bold",
                  gameState.hokm === Suit.Hearts ||
                    gameState.hokm === Suit.Diamonds
                    ? "text-red-400"
                    : "text-blue-200"
                )}
              >
                {SUIT_ICONS[gameState.hokm]}
              </span>
            </div>
          )}
          <div className="text-[10px] bg-yellow-600 px-2 py-1 rounded text-black font-bold">
            {gameState.hakimId === myPlayerId
              ? "شما حاکم"
              : gameState.hakimId
              ? "حاکم: " +
                players
                  .find((p) => p && p.id === gameState.hakimId)
                  ?.name.split(" ")[0]
              : "..."}
          </div>
        </div>
      </div>

      {/* --- PLAYERS AREA --- */}

      {/* 2P Mode: Just Top */}
      {gameState.mode === "2p" && renderOpponentHand(topOpponent, "top")}

      {/* 4P Mode: Top (Mate), Left, Right */}
      {gameState.mode === "4p" && (
        <>
          {renderOpponentHand(teammate, "top")}
          {renderOpponentHand(leftOpponent, "left")}
          {renderOpponentHand(rightOpponent, "right")}
        </>
      )}

      {/* --- CENTER TABLE --- */}
      <div className="flex-1 w-full relative z-10 flex items-center justify-center">
        {/* HAKIM DETERMINATION ANIMATION */}
        {isHakimDetermining && (
          <div className="absolute inset-0 z-40 bg-black/60 flex flex-col items-center justify-center">
            <h2 className="text-2xl text-white mb-8 font-bold animate-pulse">
              تعیین حاکم
            </h2>
            {flippedCard ? (
              <div className="animate-flip flex flex-col items-center gap-2">
                <span
                  className={clsx(
                    "text-lg font-bold px-3 py-1 rounded-full shadow-lg",
                    flippedCardOwnerName === "کارت شما"
                      ? "bg-green-600 text-white"
                      : "bg-red-600 text-white"
                  )}
                >
                  {flippedCardOwnerName}
                </span>
                <CardComponent card={flippedCard} size="lg" />
              </div>
            ) : (
              <CardComponent
                card={{ id: "deck", rank: 2, suit: Suit.Spades }}
                faceDown
                size="lg"
              />
            )}
            <p className="text-gray-300 mt-4 text-sm">
              در حال انداختن ورق تا آمدن تک...
            </p>
          </div>
        )}

        {/* HOKM SELECTION UI */}
        {isChoosingHokm && (
          <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
            <h2 className="text-white text-xl mb-6 font-bold">
              حکم را انتخاب کنید
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds].map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => onSetHokm(s)}
                    className="bg-white w-24 h-24 rounded-xl flex items-center justify-center text-5xl hover:scale-105 transition-transform shadow-lg"
                  >
                    <span
                      className={
                        s === Suit.Hearts || s === Suit.Diamonds
                          ? "text-red-600"
                          : "text-black"
                      }
                    >
                      {SUIT_ICONS[s]}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* PLAYED CARDS */}
        {!isHakimDetermining && !isChoosingHokm && (
          <div className="w-64 h-64 relative">
            {gameState.tableCards.map((tc, idx) => {
              // Determine Position of Card based on player relation
              let posClass = "translate-y-0"; // Center default

              // Find relative index
              const pIdx = players.findIndex((p) => p && p.id === tc.playerId);

              // Calculate relative offset from me
              // 0 = Me, 1 = Right, 2 = Top, 3 = Left (in 4p)
              // In 2p: 0 = Me, 1 = Top
              let relativePos = 0;
              if (gameState.mode === "2p") {
                relativePos = pIdx === myIndex ? 0 : 2; // Use 2 (Top) for opponent
              } else {
                // (pIdx - myIndex + 4) % 4
                // If pIdx is me (0) -> 0
                // If pIdx is Right (1) -> 1
                // If pIdx is Top (2) -> 2
                // If pIdx is Left (3) -> 3
                relativePos = (pIdx - myIndex + 4) % 4;
              }

              if (relativePos === 0)
                posClass = "bottom-0 left-1/2 -translate-x-1/2 translate-y-8";
              if (relativePos === 1)
                posClass = "right-0 top-1/2 -translate-y-1/2 translate-x-8";
              if (relativePos === 2)
                posClass = "top-0 left-1/2 -translate-x-1/2 -translate-y-8";
              if (relativePos === 3)
                posClass = "left-0 top-1/2 -translate-y-1/2 -translate-x-8";

              return (
                <div
                  key={idx}
                  className={`absolute ${posClass} transition-all duration-300 z-10`}
                >
                  <CardComponent
                    card={tc.card}
                    size="md"
                    className="shadow-2xl ring-1 ring-black/20"
                  />
                  {gameState.tableCards.length > maxTable - 1 &&
                    gameState.lastWinnerId === tc.playerId && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[10px] px-2 rounded-full shadow font-bold whitespace-nowrap z-20">
                        برنده
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}

        {/* Status Message */}
        {gameState.phase === GamePhase.PLAYING && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-none z-30 w-full flex justify-center">
            {gameState.tableCards.length === 0 && (
              <div className="bg-black/40 px-4 py-1 rounded-full text-white/90 text-sm backdrop-blur-md border border-white/10">
                {isMyTurn
                  ? "نوبت شماست"
                  : `نوبت ${
                      players.find(
                        (p) => p && p.id === gameState.currentTurnPlayerId
                      )?.name
                    } ...`}
              </div>
            )}
            {isTableFull && (
              <div className="bg-yellow-600/80 px-4 py-1 rounded-full text-white text-sm backdrop-blur-sm animate-pulse">
                محاسبه امتیاز...
              </div>
            )}
            {cooldownActive && !isTableFull && isMyTurn && (
              <div className="bg-red-600/80 px-4 py-1 rounded-full text-white text-sm backdrop-blur-sm">
                لطفا صبر کنید...
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- MY HAND (Bottom) --- */}
      <div className="shrink-0 mb-4 w-full flex justify-center relative px-2 z-30">
        <div
          className={clsx(
            "flex items-end transition-all duration-300 rtl:space-x-reverse",
            handSpacingClass
          )}
        >
          {myHand.map((card, index) => {
            const zIndex = myHand.length - index;
            return (
              <div
                key={card.id}
                style={{ zIndex }}
                className="hover:z-[100] transition-all origin-bottom hover:scale-110 hover:-translate-y-4 relative"
              >
                <CardComponent
                  card={card}
                  size="md"
                  onClick={() => canPlay && onCardPlay(card)}
                  className={clsx(
                    "shadow-[-2px_2px_5px_rgba(0,0,0,0.3)] border-gray-300",
                    !canPlay && "opacity-90 grayscale-[0.5] cursor-not-allowed"
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite Code Overlay */}
      <div className="absolute top-16 left-4 z-50">
        <div
          className="bg-black/20 backdrop-blur text-white text-xs px-2 py-1 rounded cursor-pointer flex items-center gap-1 hover:bg-black/40 border border-white/5"
          onClick={() => {
            const inviteLink =
              window.location.href.split("?")[0] + "?room=" + gameState.roomId;
            navigator.clipboard.writeText(inviteLink);
            alert("لینک اتاق کپی شد!");
          }}
        >
          <Copy size={12} />
          <span>{gameState.roomId}</span>
        </div>
      </div>
    </div>
  );
};

export default PlayingTable;
