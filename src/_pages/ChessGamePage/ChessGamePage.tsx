"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, Color, PieceSymbol, Square } from "chess.js";
import { HexColorPicker } from "react-colorful";
import styles from "./ChessGamePage.module.scss";
import { Button } from "@/shared/ui/base/Buttons/Button/Button";
import {
  RotateCcw,
  RefreshCw,
  FlipVertical2,
  Brain,
  Users,
  ChevronLeft,
  ChevronRight,
  Flag,
  Palette,
  X,
  ChessKing,
  ChessQueen,
  ChessRook,
  ChessBishop,
  ChessKnight,
  ChessPawn,
} from "lucide-react";

// ─── Piece Icons ───────────────────────────────────────────────────────────────

const PIECE_ICON: Record<string, React.ElementType> = {
  k: ChessKing,
  q: ChessQueen,
  r: ChessRook,
  b: ChessBishop,
  n: ChessKnight,
  p: ChessPawn,
};

const PIECE_SVG: Record<string, (color: "w" | "b") => React.ReactNode> = {
  k: (c) => { const Icon = PIECE_ICON.k; return <Icon className={`${styles.pieceSvg} ${c === "w" ? styles.pieceWhite : styles.pieceBlack}`} />; },
  q: (c) => { const Icon = PIECE_ICON.q; return <Icon className={`${styles.pieceSvg} ${c === "w" ? styles.pieceWhite : styles.pieceBlack}`} />; },
  r: (c) => { const Icon = PIECE_ICON.r; return <Icon className={`${styles.pieceSvg} ${c === "w" ? styles.pieceWhite : styles.pieceBlack}`} />; },
  b: (c) => { const Icon = PIECE_ICON.b; return <Icon className={`${styles.pieceSvg} ${c === "w" ? styles.pieceWhite : styles.pieceBlack}`} />; },
  n: (c) => { const Icon = PIECE_ICON.n; return <Icon className={`${styles.pieceSvg} ${c === "w" ? styles.pieceWhite : styles.pieceBlack}`} />; },
  p: (c) => { const Icon = PIECE_ICON.p; return <Icon className={`${styles.pieceSvg} ${c === "w" ? styles.pieceWhite : styles.pieceBlack}`} />; },
};

// ─── Minimax AI ────────────────────────────────────────────────────────────────

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

const PST: Record<PieceSymbol, number[][]> = {
  p: [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
  n: [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
  b: [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
  r: [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
  q: [[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
  k: [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]],
};

function evaluateBoard(chess: Chess): number {
  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;
      const val = PIECE_VALUES[piece.type];
      const row = piece.color === "w" ? 7 - r : r;
      score += piece.color === "w" ? val + PST[piece.type][row][f] : -(val + PST[piece.type][row][f]);
    }
  }
  return score;
}

function minimax(chess: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (depth === 0 || chess.isGameOver()) return evaluateBoard(chess);
  const moves = chess.moves();
  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      chess.move(move); best = Math.max(best, minimax(chess, depth - 1, alpha, beta, false)); chess.undo();
      alpha = Math.max(alpha, best); if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      chess.move(move); best = Math.min(best, minimax(chess, depth - 1, alpha, beta, true)); chess.undo();
      beta = Math.min(beta, best); if (beta <= alpha) break;
    }
    return best;
  }
}

function getBestMove(chess: Chess, depth: number): string | null {
  const moves = chess.moves();
  if (!moves.length) return null;
  let best: string | null = null, bestVal = Infinity;
  for (const move of moves) {
    chess.move(move);
    const val = minimax(chess, depth - 1, -Infinity, Infinity, true);
    chess.undo();
    if (val < bestVal) { bestVal = val; best = move; }
  }
  return best;
}

// ─── Board themes ────────────────────────────────────────────────────────────

const BOARD_THEMES = [
  { name: "Классик",  light: "#f0d9b5", dark: "#b58863" },
  { name: "Синий",    light: "#dee3e6", dark: "#8ca2ad" },
  { name: "Зелёный",  light: "#ffffdd", dark: "#86a666" },
  { name: "Фиолет",   light: "#f1e9f5", dark: "#9b72cf" },
  { name: "Серый",    light: "#e8e8e8", dark: "#888888" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type GameMode = "vs-ai" | "vs-player";
type AiDifficulty = "easy" | "medium" | "hard";
type PickerTarget = "light" | "dark" | null;

const DIFFICULTY_DEPTH: Record<AiDifficulty, number> = { easy: 1, medium: 2, hard: 3 };

// ─── Component ────────────────────────────────────────────────────────────────

export function ChessGamePage() {
  const [chess] = useState(() => new Chess());
  const [, forceRender] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>("vs-ai");
  const [difficulty, setDifficulty] = useState<AiDifficulty>("medium");
  const [playerColor, setPlayerColor] = useState<Color>("w");
  const [status, setStatus] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [capturedW, setCapturedW] = useState<PieceSymbol[]>([]);
  const [capturedB, setCapturedB] = useState<PieceSymbol[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);
  const [lightColor, setLightColor] = useState(BOARD_THEMES[0].light);
  const [darkColor, setDarkColor] = useState(BOARD_THEMES[0].dark);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerTarget) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerTarget(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerTarget]);

  const syncState = useCallback(() => {
    forceRender(n => n + 1);
    const h = chess.history();
    setHistory(h);
    const caps = { w: [] as PieceSymbol[], b: [] as PieceSymbol[] };
    chess.history({ verbose: true }).forEach((m) => {
      if (m.captured) caps[m.color === "w" ? "w" : "b"].push(m.captured);
    });
    setCapturedW(caps.w);
    setCapturedB(caps.b);
    if (chess.isCheckmate()) setStatus("Мат! Победа " + (chess.turn() === "w" ? "чёрных" : "белых"));
    else if (chess.isDraw()) setStatus("Ничья");
    else if (chess.isStalemate()) setStatus("Пат — ничья");
    else if (chess.isCheck()) setStatus("Шах!");
    else setStatus("");
    setGameOver(chess.isGameOver());
  }, [chess]);

  const triggerAi = useCallback(() => {
    if (gameMode !== "vs-ai" || chess.turn() === playerColor || chess.isGameOver()) return;
    setIsThinking(true);
    aiTimer.current = setTimeout(() => {
      const move = getBestMove(chess, DIFFICULTY_DEPTH[difficulty]);
      if (move) {
        chess.move(move);
        const hist = chess.history({ verbose: true });
        const last = hist[hist.length - 1];
        if (last) setLastMove({ from: last.from as Square, to: last.to as Square });
        syncState();
      }
      setIsThinking(false);
    }, 300);
  }, [chess, difficulty, gameMode, playerColor, syncState]);

  useEffect(() => () => { if (aiTimer.current) clearTimeout(aiTimer.current); }, []);

  const handleSquareClick = (sq: Square) => {
    if (gameOver || isThinking) return;
    if (gameMode === "vs-ai" && chess.turn() !== playerColor) return;

    if (selected) {
      if (validMoves.includes(sq)) {
        const from = selected;
        const piece = chess.get(from);
        const isPawnPromo = piece?.type === "p" &&
          ((piece.color === "w" && sq[1] === "8") || (piece.color === "b" && sq[1] === "1"));
        if (isPawnPromo) {
          setPromotionPending({ from, to: sq });
          setSelected(null); setValidMoves([]);
          return;
        }
        if (chess.move({ from, to: sq })) {
          setLastMove({ from, to: sq });
          setSelected(null); setValidMoves([]);
          syncState();
          setTimeout(triggerAi, 50);
        }
        return;
      }
      const piece = chess.get(sq);
      if (piece && piece.color === chess.turn()) {
        setSelected(sq);
        setValidMoves(chess.moves({ square: sq, verbose: true }).map((m) => m.to as Square));
        return;
      }
      setSelected(null); setValidMoves([]);
      return;
    }
    const piece = chess.get(sq);
    if (piece && piece.color === chess.turn()) {
      setSelected(sq);
      setValidMoves(chess.moves({ square: sq, verbose: true }).map((m) => m.to as Square));
    }
  };

  const handlePromotion = (piece: PieceSymbol) => {
    if (!promotionPending) return;
    if (chess.move({ from: promotionPending.from, to: promotionPending.to, promotion: piece })) {
      setLastMove({ from: promotionPending.from, to: promotionPending.to });
      syncState();
      setTimeout(triggerAi, 50);
    }
    setPromotionPending(null);
  };

  const handleNewGame = () => {
    chess.reset();
    setSelected(null); setValidMoves([]); setLastMove(null);
    setGameOver(false); setStatus(""); setIsThinking(false);
    setPromotionPending(null); setCapturedW([]); setCapturedB([]);
    setHistory([]); forceRender(n => n + 1);
    if (gameMode === "vs-ai" && playerColor === "b") setTimeout(triggerAi, 300);
  };

  const handleUndo = () => {
    chess.undo();
    if (gameMode === "vs-ai") chess.undo();
    setSelected(null); setValidMoves([]); setLastMove(null);
    syncState();
  };

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const displayRanks = flipped ? [...ranks].reverse() : ranks;
  const displayFiles = flipped ? [...files].reverse() : files;

  let kingInCheckSq: Square | null = null;
  if (chess.isCheck()) {
    outer: for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = chess.board()[r][f];
        if (p?.type === "k" && p.color === chess.turn()) {
          kingInCheckSq = (files[f] + ranks[r]) as Square;
          break outer;
        }
      }
    }
  }

  const statusText = isThinking ? "ИИ думает..." : status;
  const statusClass = gameOver
    ? styles.statusGameOver
    : isThinking
    ? styles.statusThinking
    : styles.statusCheck;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>♟ Шахматы</h1>
          <div className={styles.modeButtons}>
            <Button variant={gameMode === "vs-ai" ? "default" : "outline"} size="sm" onClick={() => setGameMode("vs-ai")}>
              <Brain size={14} /> Против ИИ
            </Button>
            <Button variant={gameMode === "vs-player" ? "default" : "outline"} size="sm" onClick={() => setGameMode("vs-player")}>
              <Users size={14} /> 2 игрока
            </Button>
          </div>
        </div>

        <div className={styles.layout}>
          {/* Left panel */}
          <div className={styles.sidePanel}>
            {gameMode === "vs-ai" && (
              <div className={styles.card}>
                <div className={styles.cardTitle}>Настройки ИИ</div>
                <div className={styles.settingRow}>
                  <span>Сложность</span>
                  <div className={styles.segmented}>
                    {(["easy", "medium", "hard"] as AiDifficulty[]).map((d) => (
                      <button key={d} className={`${styles.segBtn} ${difficulty === d ? styles.segBtnActive : ""}`} onClick={() => setDifficulty(d)}>
                        {d === "easy" ? "Лёгкий" : d === "medium" ? "Средний" : "Сложный"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.settingRow}>
                  <span>Играть за</span>
                  <div className={styles.segmented}>
                    <button className={`${styles.segBtn} ${playerColor === "w" ? styles.segBtnActive : ""}`} onClick={() => setPlayerColor("w")}>Белых</button>
                    <button className={`${styles.segBtn} ${playerColor === "b" ? styles.segBtnActive : ""}`} onClick={() => setPlayerColor("b")}>Чёрных</button>
                  </div>
                </div>
              </div>
            )}

            {/* Board color picker */}
            <div className={styles.card}>
              <div className={styles.cardTitle}><Palette size={12} style={{ display: "inline", marginRight: 4 }} />Цвет доски</div>
              <div className={styles.themeRow}>
                {BOARD_THEMES.map((t) => (
                  <button
                    key={t.name}
                    className={styles.themeBtn}
                    title={t.name}
                    onClick={() => { setLightColor(t.light); setDarkColor(t.dark); setPickerTarget(null); }}
                  >
                    <span style={{ background: t.light }} className={styles.themeSwatch} />
                    <span style={{ background: t.dark }} className={styles.themeSwatch} />
                  </button>
                ))}
              </div>
              <div className={styles.colorSwatchRow}>
                <div className={styles.swatchGroup}>
                  <span className={styles.swatchLabel}>Светлые</span>
                  <button
                    className={`${styles.swatch} ${pickerTarget === "light" ? styles.swatchActive : ""}`}
                    style={{ background: lightColor }}
                    onClick={() => setPickerTarget(pickerTarget === "light" ? null : "light")}
                  />
                </div>
                <div className={styles.swatchGroup}>
                  <span className={styles.swatchLabel}>Тёмные</span>
                  <button
                    className={`${styles.swatch} ${pickerTarget === "dark" ? styles.swatchActive : ""}`}
                    style={{ background: darkColor }}
                    onClick={() => setPickerTarget(pickerTarget === "dark" ? null : "dark")}
                  />
                </div>
              </div>
              {pickerTarget && (
                <div ref={pickerRef} className={styles.pickerWrap}>
                  <HexColorPicker
                    color={pickerTarget === "light" ? lightColor : darkColor}
                    onChange={pickerTarget === "light" ? setLightColor : setDarkColor}
                  />
                </div>
              )}
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Захваченные фигуры</div>
              <div className={styles.capturedRow}>
                <span className={styles.capturedLabel}>Белые взяли:</span>
                <div className={styles.capturedPieces}>
                  {capturedW.map((p, i) => <span key={i} className={styles.capturedPiece}>{PIECE_SVG[p]("b")}</span>)}
                </div>
              </div>
              <div className={styles.capturedRow}>
                <span className={styles.capturedLabel}>Чёрные взяли:</span>
                <div className={styles.capturedPieces}>
                  {capturedB.map((p, i) => <span key={i} className={styles.capturedPiece}>{PIECE_SVG[p]("w")}</span>)}
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>История ходов</div>
              <div className={styles.moveList}>
                {history.length === 0 ? (
                  <span className={styles.noMoves}>Ходов пока нет</span>
                ) : (
                  Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => (
                    <div key={i} className={styles.moveRow}>
                      <span className={styles.moveNum}>{i + 1}.</span>
                      <span className={`${styles.moveText} ${history.length - 1 === i * 2 ? styles.moveActive : ""}`}>{history[i * 2]}</span>
                      {history[i * 2 + 1] && (
                        <span className={`${styles.moveText} ${history.length - 1 === i * 2 + 1 ? styles.moveActive : ""}`}>{history[i * 2 + 1]}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className={styles.historyNav}>
                <button className={styles.navBtn}><ChevronLeft size={14} /></button>
                <button className={styles.navBtn}><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>

          {/* Board area */}
          <div className={styles.boardArea}>
            {/* Status bar — always rendered to prevent layout shift */}
            <div
              className={`${styles.statusBar} ${statusText ? statusClass : ""}`}
              style={{ visibility: statusText ? "visible" : "hidden" }}
            >
              {statusText || "placeholder"}
            </div>

            {/* Turn indicator */}
            <div className={styles.turnIndicator} style={{ visibility: gameOver ? "hidden" : "visible" }}>
              <div className={`${styles.turnDot} ${chess.turn() === "w" ? styles.turnDotWhite : styles.turnDotBlack}`} />
              <span>{chess.turn() === "w" ? "Ход белых" : "Ход чёрных"}</span>
            </div>

            <div className={styles.boardWrapper}>
              <div className={styles.fileLabels}>
                {displayFiles.map((f) => <span key={f}>{f}</span>)}
              </div>
              <div className={styles.boardRow}>
                <div className={styles.rankLabels}>
                  {displayRanks.map((r) => <span key={r}>{r}</span>)}
                </div>

                <div
                  className={styles.board}
                  style={{ "--sq-light": lightColor, "--sq-dark": darkColor } as React.CSSProperties}
                >
                  {displayRanks.map((rank, ri) =>
                    displayFiles.map((file, fi) => {
                      const sq = (file + rank) as Square;
                      const piece = chess.get(sq);
                      const isLight = (ri + fi) % 2 !== 0;
                      return (
                        <div
                          key={sq}
                          className={[
                            styles.square,
                            isLight ? styles.squareLight : styles.squareDark,
                            selected === sq ? styles.squareSelected : "",
                            (lastMove?.from === sq || lastMove?.to === sq) ? styles.squareLastMove : "",
                            kingInCheckSq === sq ? styles.squareCheck : "",
                          ].filter(Boolean).join(" ")}
                          onClick={() => handleSquareClick(sq)}
                        >
                          {validMoves.includes(sq) && (
                            <div className={`${styles.validDot} ${piece ? styles.validCapture : ""}`} />
                          )}
                          {piece && <div className={styles.piece}>{PIECE_SVG[piece.type](piece.color)}</div>}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className={styles.rankLabels}>
                  {displayRanks.map((r) => <span key={r}>{r}</span>)}
                </div>
              </div>
              <div className={styles.fileLabels}>
                {displayFiles.map((f) => <span key={f}>{f}</span>)}
              </div>
            </div>

            {/* Controls */}
            <div className={styles.controls}>
              <Button variant="default" size="sm" onClick={handleNewGame}>
                <RefreshCw size={14} /> Новая игра
              </Button>
              <Button variant="outline" size="sm" onClick={handleUndo} disabled={chess.history().length < 1 || gameOver}>
                <RotateCcw size={14} /> Отменить ход
              </Button>
              <Button variant="outline" size="sm" onClick={() => setFlipped((f) => !f)}>
                <FlipVertical2 size={14} /> Повернуть доску
              </Button>
              {gameMode === "vs-ai" && !gameOver && (
                <Button variant="destructive" size="sm" onClick={() => { setGameOver(true); setStatus("Вы сдались. Победа ИИ."); }}>
                  <Flag size={14} /> Сдаться
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Promotion modal */}
      {promotionPending && (
        <div className={styles.overlay}>
          <div className={styles.promoModal}>
            <button className={styles.promoClose} onClick={() => setPromotionPending(null)}><X size={16} /></button>
            <div className={styles.promoTitle}>Выберите фигуру для превращения</div>
            <div className={styles.promoOptions}>
              {(["q", "r", "b", "n"] as PieceSymbol[]).map((p) => (
                <button key={p} className={styles.promoBtn} onClick={() => handlePromotion(p)}>
                  {PIECE_SVG[p](chess.turn())}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
