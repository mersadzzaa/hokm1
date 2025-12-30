import React, { useState, useEffect, useRef } from "react";
import { GameState, GamePhase, Player, Suit, Rank, Card } from "./types";
import {
  createDeck,
  determineTrickWinner,
  calculateRoundPoints,
} from "./utils";
import PlayingTable from "./PlayingTable";
import {
  Play,
  AlertCircle,
  Loader2,
  Share2,
  Copy,
  Send,
  Zap,
  RotateCcw,
  Users,
  User,
  ArrowRightLeft,
  Edit3,
  PlusCircle,
  LogIn,
} from "lucide-react";
import { db } from "./firebase";
import {
  ref,
  set,
  onValue,
  update,
  get,
  runTransaction,
  onDisconnect,
  remove,
} from "firebase/database";

const App: React.FC = () => {
  // --- State ---
  const [userId] = useState(() => {
    const saved = localStorage.getItem("hokm_user_id");
    if (saved) return saved;
    const newId = "user_" + Math.floor(Math.random() * 100000);
    localStorage.setItem("hokm_user_id", newId);
    return newId;
  });

  const [lastRoomId, setLastRoomId] = useState(
    () => localStorage.getItem("last_room_id") || ""
  );
  const [selectedMode, setSelectedMode] = useState<"2p" | "4p">("2p");
  const [inputName, setInputName] = useState(
    () => localStorage.getItem("hokm_player_name") || ""
  ); // Player Name

  const [roomId, setRoomId] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [inGame, setInGame] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [gameState, setGameState] = useState<GameState>({
    roomId: "",
    mode: "2p",
    phase: GamePhase.LOBBY,
    players: [],
    deck: [],
    hakimId: null,
    hokm: null,
    currentTurnPlayerId: null,
    tableCards: [],
    scores: { 1: 0, 2: 0 },
    currentRoundTricks: { 1: 0, 2: 0 },
    hakimDeterminationCards: [],
    lastWinnerId: null,
    logs: [],
    lastActionTimestamp: 0,
  });

  const stateRef = useRef(gameState);
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  // Save name to local storage
  useEffect(() => {
    if (inputName) localStorage.setItem("hokm_player_name", inputName);
  }, [inputName]);

  // --- Helper to get display name ---
  const getDisplayName = () => inputName.trim() || `بازیکن ${userId.slice(-4)}`;

  // --- Validate Last Room (Rejoin Logic) ---
  useEffect(() => {
    if (!lastRoomId || inGame) return;

    const validateRoom = async () => {
      try {
        const rRef = ref(db, `rooms/${lastRoomId}`);
        const snap = await get(rRef);

        if (!snap.exists()) {
          localStorage.removeItem("last_room_id");
          setLastRoomId("");
          return;
        }

        const data = snap.val();
        if (data.phase === GamePhase.MATCH_END) {
          localStorage.removeItem("last_room_id");
          setLastRoomId("");
          return;
        }

        const players = data.players || [];
        const anyOneConnected = players.some(
          (p: any) => p && p.isConnected === true
        );

        if (
          !anyOneConnected &&
          players.filter((p: any) => p !== null).length > 0
        ) {
          localStorage.removeItem("last_room_id");
          setLastRoomId("");
        }
      } catch (e) {
        console.error("Error validating room:", e);
      }
    };

    validateRoom();
  }, [lastRoomId, inGame]);

  // --- Firebase Sync & Cleanup ---
  useEffect(() => {
    if (!inGame || !roomId) return;

    const roomRef = ref(db, `rooms/${roomId}`);

    get(roomRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const players = data.players || [];
        const myIndex = players.findIndex((p: any) => p && p.id === userId);

        if (myIndex !== -1) {
          const myPresenceRef = ref(db, `rooms/${roomId}/players/${myIndex}`);
          update(myPresenceRef, { isConnected: true });
        }
      }
    });

    const unsubscribe = onValue(
      roomRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const sanitizedData: GameState = {
            ...data,
            mode: data.mode || "2p",
            deck: data.deck || [],
            tableCards: data.tableCards || [],
            hakimDeterminationCards: data.hakimDeterminationCards || [],
            logs: data.logs || [],
            scores: data.scores || { 1: 0, 2: 0 },
            currentRoundTricks: data.currentRoundTricks || { 1: 0, 2: 0 },
            players: data.players
              ? data.players.map((p: any) =>
                  p
                    ? {
                        ...p,
                        hand: p.hand || [],
                        isConnected:
                          p.isConnected !== undefined ? p.isConnected : true,
                      }
                    : null
                )
              : [],
            lastActionTimestamp: data.lastActionTimestamp || 0,
          };

          setGameState(sanitizedData);
          setLoading(false);
        } else {
          setInGame(false);
          setError("بازی بسته شد یا ارتباط قطع گردید.");
          setRoomId("");
          localStorage.removeItem("last_room_id");
          setLastRoomId("");
        }
      },
      (err) => {
        console.error(err);
        setError("خطا در اتصال به سرور");
      }
    );

    return () => {
      unsubscribe();
    };
  }, [inGame, roomId, userId]);

  // --- Dynamic Disconnect Logic (Delete Room if Empty) ---
  useEffect(() => {
    if (!inGame || !roomId || !userId) return;

    const myIndex = gameState.players.findIndex((p) => p && p.id === userId);
    if (myIndex === -1) return;

    const activePlayers = gameState.players.filter((p) => p && p.isConnected);
    const activeCount = activePlayers.length;

    const roomRef = ref(db, `rooms/${roomId}`);
    const myPresenceRef = ref(db, `rooms/${roomId}/players/${myIndex}`);

    if (activeCount <= 1) {
      onDisconnect(myPresenceRef).cancel();
      onDisconnect(roomRef).remove();
    } else {
      onDisconnect(roomRef).cancel();
      onDisconnect(myPresenceRef).update({ isConnected: false });
    }
  }, [gameState.players, inGame, roomId, userId]);

  // --- Game Logic Controllers (Host Only) ---
  const hostId = gameState.players.find((p) => p !== null)?.id;
  const isHost = hostId === userId;
  const filledPlayersCount = gameState.players.filter((p) => p !== null).length;
  const maxPlayers = gameState.mode === "4p" ? 4 : 2;

  useEffect(() => {
    if (!isHost) return;
    if (
      gameState.phase === GamePhase.LOBBY &&
      filledPlayersCount === maxPlayers
    ) {
      const timer = setTimeout(() => {
        update(ref(db, `rooms/${roomId}`), {
          phase: GamePhase.HAKIM_DETERMINATION,
          logs: [...(gameState.logs || []), "بازی شروع شد"],
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [gameState.phase, filledPlayersCount, maxPlayers, isHost, roomId]);

  useEffect(() => {
    if (!isHost) return;

    if (
      gameState.phase === GamePhase.HAKIM_DETERMINATION &&
      gameState.hakimDeterminationCards.length === 0
    ) {
      const deck = createDeck();
      let index = 0;
      let tempCards: Card[] = [];

      const interval = setInterval(() => {
        const card = deck[index];
        index++;
        tempCards.push(card);

        update(ref(db, `rooms/${roomId}`), {
          hakimDeterminationCards: tempCards,
        });

        if (card.rank === Rank.Ace) {
          clearInterval(interval);
          const winningPlayerIndex = (index - 1) % maxPlayers;
          const winner = stateRef.current.players[winningPlayerIndex];

          if (winner) {
            setTimeout(() => {
              update(ref(db, `rooms/${roomId}`), {
                hakimId: winner.id,
                currentTurnPlayerId: winner.id,
                phase: GamePhase.DEALING_INITIAL,
                logs: [
                  ...(stateRef.current.logs || []),
                  `${winner.name} حاکم شد`,
                ],
              });
            }, 2000);
          }
        }
      }, 1500);

      return () => clearInterval(interval);
    }
  }, [gameState.phase, isHost, roomId, maxPlayers]);

  useEffect(() => {
    if (!isHost) return;

    if (gameState.phase === GamePhase.DEALING_INITIAL) {
      const fullDeck = createDeck();
      const hakimIndex = gameState.players.findIndex(
        (p) => p && p.id === gameState.hakimId
      );

      if (hakimIndex === -1) return;

      const p1Hand = fullDeck.slice(0, 5);
      const remainingDeck = fullDeck.slice(5);

      setTimeout(() => {
        const newPlayers = [...gameState.players];
        if (newPlayers[hakimIndex]) {
          newPlayers[hakimIndex] = { ...newPlayers[hakimIndex]!, hand: p1Hand };
        }

        update(ref(db, `rooms/${roomId}`), {
          deck: remainingDeck,
          players: newPlayers,
          phase: GamePhase.HAKIM_CHOOSING_SUIT,
        });
      }, 1000);
    }

    if (gameState.phase === GamePhase.DEALING_REMAINDER) {
      const deck = [...gameState.deck];
      const hakimIndex = gameState.players.findIndex(
        (p) => p && p.id === gameState.hakimId
      );

      if (gameState.mode === "2p") {
        const otherIndex = hakimIndex === 0 ? 1 : 0;
        const hakimExtra = deck.slice(0, 8);
        const opponentHand = deck.slice(8, 21);

        setTimeout(() => {
          const newPlayers = [...gameState.players];
          if (newPlayers[hakimIndex]) {
            const currentHakimHand = newPlayers[hakimIndex]!.hand || [];
            newPlayers[hakimIndex]!.hand = [...currentHakimHand, ...hakimExtra];
          }
          if (newPlayers[otherIndex]) {
            newPlayers[otherIndex]!.hand = opponentHand;
          }

          update(ref(db, `rooms/${roomId}`), {
            players: newPlayers,
            phase: GamePhase.PLAYING,
            currentTurnPlayerId: gameState.hakimId,
          });
        }, 800);
      } else {
        setTimeout(() => {
          const newPlayers = [...gameState.players];
          let currentDeckIdx = 0;
          for (let i = 1; i <= 3; i++) {
            const targetIdx = (hakimIndex + i) % 4;
            const hand = deck.slice(currentDeckIdx, currentDeckIdx + 13);
            currentDeckIdx += 13;
            if (newPlayers[targetIdx]) {
              newPlayers[targetIdx]!.hand = hand;
            }
          }
          const hakimExtra = deck.slice(currentDeckIdx, currentDeckIdx + 8);
          if (newPlayers[hakimIndex]) {
            const currentHand = newPlayers[hakimIndex]!.hand || [];
            newPlayers[hakimIndex]!.hand = [...currentHand, ...hakimExtra];
          }

          update(ref(db, `rooms/${roomId}`), {
            players: newPlayers,
            phase: GamePhase.PLAYING,
            currentTurnPlayerId: gameState.hakimId,
          });
        }, 800);
      }
    }
  }, [gameState.phase, isHost, roomId, gameState.mode]);

  useEffect(() => {
    if (!isHost) return;

    if (
      gameState.tableCards?.length === maxPlayers &&
      gameState.phase === GamePhase.PLAYING
    ) {
      const timer = setTimeout(() => {
        const roomRef = ref(db, `rooms/${roomId}`);

        runTransaction(roomRef, (roomData) => {
          if (
            !roomData ||
            !roomData.tableCards ||
            roomData.tableCards.length < maxPlayers
          ) {
            return;
          }

          const cards = roomData.tableCards;
          const winnerId = determineTrickWinner(
            cards,
            roomData.hokm,
            cards[0].card.suit
          );
          const winnerPlayer = roomData.players.find(
            (p: any) => p && p.id === winnerId
          );
          const winnerTeamId = winnerPlayer.teamId;

          if (!roomData.currentRoundTricks)
            roomData.currentRoundTricks = { 1: 0, 2: 0 };
          roomData.currentRoundTricks[winnerTeamId] =
            (roomData.currentRoundTricks[winnerTeamId] || 0) + 1;

          roomData.lastWinnerId = winnerId;
          roomData.currentTurnPlayerId = winnerId;

          let handOver = false;
          let handWinnerTeamId = 0;
          if (roomData.currentRoundTricks[1] >= 7) {
            handWinnerTeamId = 1;
            handOver = true;
          }
          if (roomData.currentRoundTricks[2] >= 7) {
            handWinnerTeamId = 2;
            handOver = true;
          }

          if (!handOver) {
            roomData.tableCards = [];
          } else {
            const hakimPlayer = roomData.players.find(
              (p: any) => p && p.id === roomData.hakimId
            );
            const isHakimTeam = hakimPlayer?.teamId === handWinnerTeamId;
            const losingTeamId = handWinnerTeamId === 1 ? 2 : 1;
            const losingTricks = roomData.currentRoundTricks[losingTeamId] || 0;

            const points = calculateRoundPoints(7, losingTricks, isHakimTeam);

            if (!roomData.scores) roomData.scores = { 1: 0, 2: 0 };
            roomData.scores[handWinnerTeamId] =
              (roomData.scores[handWinnerTeamId] || 0) + points;

            if (roomData.scores[handWinnerTeamId] >= 7) {
              roomData.phase = GamePhase.MATCH_END;
              roomData.logs = [
                ...(roomData.logs || []),
                `بازی تمام شد. تیم ${handWinnerTeamId} برنده شد.`,
              ];
              return roomData;
            }

            let newHakimId = roomData.hakimId;
            if (!isHakimTeam) {
              const currentHakimIdx = roomData.players.findIndex(
                (p: any) => p && p.id === roomData.hakimId
              );
              const nextIdx = (currentHakimIdx + 1) % maxPlayers;
              const nextPlayer = roomData.players[nextIdx];
              newHakimId = nextPlayer ? nextPlayer.id : null;
            }

            roomData.phase = GamePhase.DEALING_INITIAL;
            roomData.deck = [];
            roomData.tableCards = [];
            roomData.currentRoundTricks = { 1: 0, 2: 0 };
            roomData.hakimId = newHakimId;
            roomData.hokm = null;
            roomData.hakimDeterminationCards = [];

            if (!roomData.logs) roomData.logs = [];
            roomData.logs.push(
              `دست تمام شد. امتیاز جدید: ${roomData.scores[1]} - ${roomData.scores[2]}`
            );
          }

          return roomData;
        });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [gameState.tableCards, isHost, roomId, maxPlayers]);

  // --- Actions ---

  const handleSetHokm = (suit: Suit) => {
    if (gameState.hakimId !== userId) return;
    update(ref(db, `rooms/${roomId}`), {
      hokm: suit,
      phase: GamePhase.DEALING_REMAINDER,
    });
  };

  const handlePlayCard = (card: Card) => {
    if (gameState.currentTurnPlayerId !== userId) return;
    if (gameState.tableCards && gameState.tableCards.length >= maxPlayers)
      return;

    const now = Date.now();
    const lastAction = gameState.lastActionTimestamp || 0;
    if (now - lastAction < 2000) return;

    const player = gameState.players.find((p) => p && p.id === userId);
    if (!player) return;

    if (gameState.tableCards && gameState.tableCards.length > 0) {
      const leadSuit = gameState.tableCards[0].card.suit;
      const hasSuit = player.hand.some((c) => c.suit === leadSuit);
      if (hasSuit && card.suit !== leadSuit) {
        alert(
          "باید " +
            (leadSuit === Suit.Hearts
              ? "دل"
              : leadSuit === Suit.Spades
              ? "پیک"
              : leadSuit === Suit.Clubs
              ? "گشنیز"
              : "خشت") +
            " بازی کنید!"
        );
        return;
      }
    }

    const roomRef = ref(db, `rooms/${roomId}`);
    runTransaction(roomRef, (roomData) => {
      if (!roomData) return;
      if (roomData.currentTurnPlayerId !== userId) return;

      if (roomData.tableCards && roomData.tableCards.length >= maxPlayers)
        return;

      const currentPlayerIndex = roomData.players.findIndex(
        (p: any) => p && p.id === userId
      );
      if (currentPlayerIndex === -1) return;

      const currentPlayer = roomData.players[currentPlayerIndex];
      const newHand = (currentPlayer.hand || []).filter(
        (c: any) => c.id !== card.id
      );
      roomData.players[currentPlayerIndex].hand = newHand;

      if (!roomData.tableCards) roomData.tableCards = [];
      roomData.tableCards.push({ playerId: userId, card });

      roomData.lastActionTimestamp = Date.now();

      const nextPlayerIndex = (currentPlayerIndex + 1) % maxPlayers;
      const nextPlayer = roomData.players[nextPlayerIndex];
      roomData.currentTurnPlayerId = nextPlayer ? nextPlayer.id : null;

      return roomData;
    });
  };

  const createRoom = async (specificId?: string) => {
    setLoading(true);
    const rid =
      specificId || Math.floor(100000 + Math.random() * 900000).toString();

    const players: (Player | null)[] =
      selectedMode === "2p" ? [null, null] : [null, null, null, null];

    // Use the entered name WITHOUT (You) suffix
    const myName = getDisplayName();
    players[0] = {
      id: userId,
      name: myName,
      hand: [],
      teamId: 1,
      isConnected: true,
    };

    const initialState: GameState = {
      roomId: rid,
      mode: selectedMode,
      phase: GamePhase.LOBBY,
      players: players,
      deck: [],
      hakimId: null,
      hokm: null,
      currentTurnPlayerId: null,
      tableCards: [],
      scores: { 1: 0, 2: 0 },
      currentRoundTricks: { 1: 0, 2: 0 },
      hakimDeterminationCards: [],
      lastWinnerId: null,
      logs: ["اتاق ساخته شد"],
      lastActionTimestamp: 0,
    };

    try {
      await set(ref(db, "rooms/" + rid), initialState);
      setRoomId(rid);
      localStorage.setItem("last_room_id", rid);
      setLastRoomId(rid);
      const newUrl =
        window.location.protocol +
        "//" +
        window.location.host +
        window.location.pathname +
        "?room=" +
        rid;
      window.history.pushState({ path: newUrl }, "", newUrl);
      setInGame(true);
    } catch (e) {
      console.error(e);
      setError("خطا در ساخت اتاق");
      setInGame(false);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (specificRoomId?: string) => {
    const targetRoomId = specificRoomId || roomId;
    if (!targetRoomId) return setError("لطفا کد اتاق را وارد کنید");

    setLoading(true);
    if (specificRoomId) setRoomId(specificRoomId);

    try {
      const roomRef = ref(db, `rooms/${targetRoomId}`);
      let snapshot = await get(roomRef);
      let retries = 0;
      while (!snapshot.exists() && retries < 20) {
        await new Promise((r) => setTimeout(r, 500));
        snapshot = await get(roomRef);
        retries++;
      }

      if (!snapshot.exists()) {
        setLoading(false);
        return setError("اتاق یافت نشد (شاید بازی تمام شده است)");
      }

      const data = snapshot.val();
      const players = data.players || [];

      const existingIdx = players.findIndex((p: any) => p && p.id === userId);
      if (existingIdx !== -1) {
        localStorage.setItem("last_room_id", targetRoomId);
        setLastRoomId(targetRoomId);
        setInGame(true);
        return;
      }

      let emptySlotIdx = -1;
      const max = selectedMode === "2p" ? 2 : 4;

      for (let i = 0; i < max; i++) {
        if (!players[i]) {
          emptySlotIdx = i;
          break;
        }
      }

      if (emptySlotIdx === -1) {
        setLoading(false);
        return setError("اتاق پر است");
      }

      const teamId = emptySlotIdx % 2 === 0 ? 1 : 2;
      const myName = getDisplayName();

      const pNew: Player = {
        id: userId,
        name: myName,
        hand: [],
        teamId: teamId,
        isConnected: true,
      };

      const updatedPlayers = [...players];
      updatedPlayers[emptySlotIdx] = pNew;

      await update(roomRef, {
        players: updatedPlayers,
      });

      localStorage.setItem("last_room_id", targetRoomId);
      setLastRoomId(targetRoomId);
      setInGame(true);
    } catch (e) {
      console.error(e);
      setError("خطا در اتصال");
      setLoading(false);
    }
  };

  // --- Switch Seat (Team Selection) ---
  const handleSwitchSeat = async (targetIndex: number) => {
    if (gameState.phase !== GamePhase.LOBBY) return;
    const myCurrentIndex = gameState.players.findIndex(
      (p) => p && p.id === userId
    );
    if (myCurrentIndex === -1) return;

    const targetSlot = gameState.players[targetIndex];
    if (targetSlot) return; // Occupied

    const roomRef = ref(db, `rooms/${roomId}`);

    await runTransaction(roomRef, (roomData) => {
      if (!roomData) return;
      if (roomData.players[targetIndex]) return;

      const me = roomData.players[myCurrentIndex];
      if (!me) return;

      me.teamId = targetIndex % 2 === 0 ? 1 : 2;
      // Keep the existing name (which might be custom)
      // Just update the "(You)" part if needed or leave it as is.
      // Since we set the name on join/create, we assume 'me.name' is correct.

      roomData.players[targetIndex] = me;
      roomData.players[myCurrentIndex] = null;

      return roomData;
    });
  };

  const handleCreatePublicRoom = async () => {
    setLoading(true);
    const targetRoomId = "public_room";

    try {
      const roomRef = ref(db, `rooms/${targetRoomId}`);
      const snapshot = await get(roomRef);

      if (snapshot.exists()) {
        setLoading(false);
        alert("اتاق قبلا ساخته شده و با ورود خودکار به اتاق وصل شوید");
        return;
      }

      await createRoom(targetRoomId);
    } catch (e) {
      console.error(e);
      setError("خطا در بررسی وضعیت اتاق");
      setLoading(false);
    }
  };

  const handleJoinPublicRoom = async () => {
    setLoading(true);
    const targetRoomId = "public_room";

    try {
      const roomRef = ref(db, `rooms/${targetRoomId}`);
      const snapshot = await get(roomRef);

      if (!snapshot.exists()) {
        setLoading(false);
        alert(
          'هنوز اتاقی ساخته نشده است. لطفا ابتدا "ساخت اتاق جدید" را بزنید.'
        );
        return;
      }

      await joinRoom(targetRoomId);
    } catch (e) {
      console.error(e);
      setError("خطا در اتصال");
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoomId = params.get("room");
    if (urlRoomId && !inGame) {
      setRoomId(urlRoomId);
      setTimeout(() => {
        joinRoom(urlRoomId);
      }, 500);
    }
  }, []);

  if (!inGame) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4 text-white font-sans">
        <div className="mb-6 flex flex-col items-center">
          <span className="text-6xl mb-2">♠️</span>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
            حکم حقیقت
          </h1>

          <p className="mt-4 text-cyan-300 text-sm text-center max-w-xs leading-6 bg-black/20 p-3 rounded-xl border border-white/5 backdrop-blur-sm">
            برای شروع، ابتدا نام خود را وارد کنید، حالت بازی را انتخاب کرده و
            دکمه
            <span className="text-yellow-400 font-bold mx-1">
              ساخت اتاق جدید
            </span>
            یا
            <span className="text-green-400 font-bold mx-1">ورود خودکار</span>
            را بزنید.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-4">
          {/* Name Input */}
          <div className="relative mb-2">
            <User className="absolute right-3 top-3 text-gray-400" size={20} />
            <input
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="نام خود را وارد کنید"
              className="w-full bg-black/30 border border-white/20 rounded-xl px-10 py-3 text-right focus:border-yellow-500 outline-none transition-colors"
            />
          </div>

          {/* Mode Selection */}
          <div className="flex bg-black/40 p-1 rounded-xl mb-6">
            <button
              onClick={() => setSelectedMode("2p")}
              className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                selectedMode === "2p"
                  ? "bg-white/10 text-white shadow"
                  : "text-gray-500"
              }`}
            >
              <User size={18} />2 نفره
            </button>
            <button
              onClick={() => setSelectedMode("4p")}
              className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                selectedMode === "4p"
                  ? "bg-white/10 text-white shadow"
                  : "text-gray-500"
              }`}
            >
              <Users size={18} />4 نفره
            </button>
          </div>

          {/* Rejoin */}
          {lastRoomId && (
            <button
              onClick={() => joinRoom(lastRoomId)}
              disabled={loading}
              className="w-full py-4 bg-white/10 hover:bg-white/20 border border-green-500/50 rounded-2xl font-bold text-lg text-green-400 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mb-4 animate-pulse"
            >
              <RotateCcw className="w-6 h-6" />
              ادامه بازی قبل
            </button>
          )}

          {/* Create Public Room */}
          <button
            onClick={handleCreatePublicRoom}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 rounded-2xl font-black text-xl shadow-xl shadow-orange-900/20 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 ring-4 ring-orange-500/20"
          >
            {loading ? (
              <Loader2 className="animate-spin w-8 h-8" />
            ) : (
              <PlusCircle className="text-white w-8 h-8" />
            )}
            ساخت اتاق جدید (میزبان)
          </button>

          {/* Join Public Room (Auto Entry) */}
          <button
            onClick={handleJoinPublicRoom}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-2xl font-black text-xl shadow-xl shadow-green-900/20 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 ring-4 ring-green-500/20"
          >
            {loading ? (
              <Loader2 className="animate-spin w-8 h-8" />
            ) : (
              <LogIn className="text-white w-8 h-8" />
            )}
            ورود خودکار (مهمان)
          </button>

          {/* Join via Code */}
          {!showJoinInput ? (
            <button
              onClick={() => setShowJoinInput(true)}
              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold text-gray-300 transition-all flex justify-center items-center gap-2 mt-4"
            >
              ورود با کد اتاق
            </button>
          ) : (
            <div className="bg-white/5 p-4 rounded-xl border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200 mt-4">
              <div className="flex gap-2">
                <input
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="کد اتاق"
                  type="number"
                  className="flex-1 bg-black/30 border border-white/20 rounded px-3 py-2 font-mono text-center tracking-widest outline-none focus:border-yellow-500"
                />
                <button
                  onClick={() => joinRoom()}
                  disabled={loading}
                  className="bg-blue-600/80 px-4 rounded font-bold hover:bg-blue-500 transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  {loading ? <Loader2 className="animate-spin" /> : "ورود"}
                </button>
              </div>
              {error && (
                <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                  <AlertCircle size={12} /> {error}
                </p>
              )}
              <button
                onClick={() => setShowJoinInput(false)}
                className="w-full text-center text-xs text-gray-500 mt-3 hover:text-white transition-colors"
              >
                بازگشت
              </button>
            </div>
          )}
        </div>

        <div className="mt-12 text-center">
          <p className="text-yellow-500 text-sm font-bold tracking-widest drop-shadow-md opacity-90">
            ساخته شده توسط مرصاد پسر حقیقت
          </p>
        </div>
      </div>
    );
  }

  // --- LOBBY (Waiting Screen) ---
  if (gameState.phase === GamePhase.LOBBY && filledPlayersCount < maxPlayers) {
    const inviteLink = window.location.href.split("?")[0] + "?room=" + roomId;

    const copyLink = () => {
      navigator.clipboard.writeText(inviteLink);
      alert("لینک دعوت کپی شد!");
    };

    const shareToTelegram = () => {
      const text = "بیا حکم بزنیم! روی لینک زیر کلیک کن:";
      const url = `https://telegram.me/share/url?url=${encodeURIComponent(
        inviteLink
      )}&text=${encodeURIComponent(text)}`;
      window.open(url, "_blank");
    };

    return (
      <div className="min-h-screen bg-feltDark flex flex-col items-center justify-center text-white px-4">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
          <span>
            در انتظار بازیکنان ({filledPlayersCount}/{maxPlayers})...
          </span>
        </h2>

        {/* 4 Player Lobby Visualizer */}
        {gameState.mode === "4p" && (
          <div className="w-full max-w-md grid grid-cols-2 gap-4 mb-8">
            {gameState.players.map((p, idx) => {
              const isMe = p?.id === userId;
              const teamName = idx % 2 === 0 ? "تیم ۱" : "تیم ۲";
              const teamColor =
                idx % 2 === 0
                  ? "bg-green-600/20 border-green-500/30"
                  : "bg-red-600/20 border-red-500/30";

              return (
                <div
                  key={idx}
                  className={`relative p-4 rounded-xl border ${
                    p ? teamColor : "bg-white/5 border-dashed border-white/10"
                  } flex flex-col items-center justify-center h-24 transition-all`}
                >
                  <div className="text-xs text-gray-400 absolute top-2 right-2">
                    {teamName}
                  </div>
                  {p ? (
                    <>
                      <div className="font-bold">{p.name}</div>
                      {isMe && (
                        <div className="text-xs text-yellow-500">(شما)</div>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => handleSwitchSeat(idx)}
                      className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors animate-pulse text-yellow-400 font-bold"
                    >
                      <ArrowRightLeft size={12} />
                      یار شدن / انتخاب صندلی
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="w-full max-w-md bg-white/10 p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-2">کد اتاق:</p>
            <div className="text-4xl font-mono font-black tracking-widest text-white">
              {roomId}
            </div>
          </div>

          <div className="w-full h-[1px] bg-white/10 my-2"></div>

          <div className="flex w-full gap-2">
            <button
              onClick={shareToTelegram}
              className="flex-1 bg-blue-500 hover:bg-blue-400 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <Send size={18} />
              تلگرام
            </button>
            <button
              onClick={copyLink}
              className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-white/5"
            >
              <Copy size={18} />
              کپی
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState.phase === GamePhase.MATCH_END) {
    const myPlayer = gameState.players.find((p) => p && p.id === userId);
    const winnerTeam = gameState.scores[1] >= 7 ? 1 : 2;
    const isWinner = myPlayer?.teamId === winnerTeam;

    return (
      <div className="fixed inset-0 z-[100] bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-center p-4 text-white text-center overflow-y-auto">
        <div className="text-9xl mb-4 animate-bounce">
          {isWinner ? "🏆" : "☠️"}
        </div>
        <h1 className="text-5xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600">
          {isWinner ? "شما برنده شدید!" : "شما باختید!"}
        </h1>
        <div className="text-2xl mb-8 opacity-80">
          نتیجه نهایی:{" "}
          <span className="font-mono font-bold text-yellow-400 mx-2">
            {gameState.scores[1]} - {gameState.scores[2]}
          </span>
        </div>
        <button
          onClick={() => {
            const roomRef = ref(db, `rooms/${roomId}`);
            remove(roomRef);

            localStorage.removeItem("last_room_id");
            setLastRoomId("");

            window.history.replaceState({}, "", window.location.pathname);
            window.location.reload();
          }}
          className="bg-white text-black px-8 py-3 rounded-full font-bold text-lg hover:scale-105 transition-transform"
        >
          بازگشت به منو
        </button>
      </div>
    );
  }

  return (
    <PlayingTable
      gameState={gameState}
      myPlayerId={userId}
      onCardPlay={handlePlayCard}
      onSetHokm={handleSetHokm}
    />
  );
};

export default App;
