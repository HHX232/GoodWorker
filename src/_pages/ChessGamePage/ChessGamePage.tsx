"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Chess, Color, PieceSymbol } from "chess.js";
import styles from "./ChessGamePage.module.scss";
import { Button } from "@/shared/ui/base/Buttons/Button/Button";
import {
  RotateCcw,
  RefreshCw,
  FlipVertical2,
  Brain,
  Users,
  Flag,
  Volume2,
  VolumeX,
  ChessKing,
  ChessQueen,
  ChessRook,
  ChessBishop,
  ChessKnight,
  ChessPawn,
} from "lucide-react";
import { ChessBoard, type BoardMove } from "@/widgets/Chess/Board";
import { CoachPanel, EvalBar, useMoveCoach, type MoveReview } from "@/widgets/Chess/Coach";
import { getEngine, ENGINE_LEVELS } from "@/shared/lib/chess/engine";
import { playMoveSound, useSoundEnabled } from "@/shared/lib/chess/sound";

// ponytail: minimal swap onto the new board/engine/coach; task 04 rebuilds this page as /chess/play.

const PIECE_ICON: Record<string, React.ElementType> = {
  k: ChessKing, q: ChessQueen, r: ChessRook, b: ChessBishop, n: ChessKnight, p: ChessPawn,
};
const capturedIcon = (p: PieceSymbol, c: "w" | "b") => {
  const Icon = PIECE_ICON[p];
  return <Icon className={`${styles.pieceSvg} ${c === "w" ? styles.pieceWhite : styles.pieceBlack}`} />;
};

type GameMode = "vs-ai" | "vs-player";

function soundFor(chess: Chess) {
  const last = chess.history({ verbose: true }).at(-1);
  if (chess.isGameOver()) return playMoveSound("end");
  if (chess.inCheck()) return playMoveSound("check");
  playMoveSound(last?.captured ? "capture" : "move");
}

function kingSquare(chess: Chess): string | null {
  if (!chess.inCheck()) return null;
  for (const row of chess.board()) for (const p of row) if (p?.type === "k" && p.color === chess.turn()) return p.square;
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChessGamePage() {
  const t = useTranslations("Chess");
  const tc = useTranslations("chess.core");
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>("vs-ai");
  const [level, setLevel] = useState(3);
  const [playerColor, setPlayerColor] = useState<Color>("w");
  const [flipped, setFlipped] = useState(false);
  const [resigned, setResigned] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [engineDown, setEngineDown] = useState(false);
  const [review, setReview] = useState<MoveReview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [noAnalysis, setNoAnalysis] = useState(false);
  const [soundOn, setSoundOn] = useSoundEnabled();
  const coach = useMoveCoach();
  const gen = useRef(0); // bumps on new game / undo so stale engine answers are dropped
  const askedFen = useRef<string | null>(null); // position the engine is already thinking about

  const sync = useCallback(() => {
    setFen(chess.fen());
    const last = chess.history({ verbose: true }).at(-1);
    setLastMove(last ? { from: last.from, to: last.to } : null);
  }, [chess]);

  const vsAi = gameMode === "vs-ai" && !engineDown;

  const engineMove = useCallback(async () => {
    if (!vsAi || chess.turn() === playerColor || chess.isGameOver()) return;
    const my = gen.current;
    const asked = chess.fen();
    if (askedFen.current === asked) return;
    askedFen.current = asked;
    setIsThinking(true);
    try {
      const uci = await getEngine().bestMove(asked, level);
      if (my !== gen.current || chess.fen() !== asked) return;
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      sync();
      soundFor(chess);
    } catch (e) {
      if ((e as Error).message === "ENGINE_UNAVAILABLE") {
        setEngineDown(true);
        setGameMode("vs-player");
      }
    } finally {
      if (askedFen.current === asked) askedFen.current = null;
      if (my === gen.current) setIsThinking(false);
    }
  }, [chess, level, playerColor, sync, vsAi]);

  useEffect(() => {
    void engineMove();
  }, [fen, engineMove]);

  const onMove = (m: BoardMove): boolean => {
    if (resigned || isThinking || (vsAi && chess.turn() !== playerColor)) return false;
    const before = chess.fen();
    try {
      chess.move(m);
    } catch {
      return false;
    }
    sync();
    soundFor(chess);
    // engine reply is queued first, the coach's review after it — the reply never waits for analysis
    void engineMove();
    if (vsAi) {
      const my = gen.current;
      setReview(null);
      setNoAnalysis(false);
      setReviewing(true);
      coach
        .review(before, m.from + m.to + (m.promotion ?? ""), "game")
        .then((r) => my === gen.current && setReview(r))
        .catch((e: Error) => {
          if (my !== gen.current || e.message === "ENGINE_CANCELLED") return;
          setReview(null);
          setNoAnalysis(true);
        })
        .finally(() => my === gen.current && setReviewing(false));
    }
    return true;
  };

  const reset = () => {
    gen.current++;
    askedFen.current = null;
    getEngine().cancelAll();
    setIsThinking(false);
    setReviewing(false);
    setReview(null);
    setNoAnalysis(false);
    setResigned(false);
  };

  const handleNewGame = () => {
    reset();
    chess.reset();
    sync();
  };

  const handleUndo = () => {
    reset();
    chess.undo();
    if (vsAi && chess.turn() !== playerColor) chess.undo();
    sync();
  };

  const history = chess.history();
  const caps = { w: [] as PieceSymbol[], b: [] as PieceSymbol[] };
  chess.history({ verbose: true }).forEach((m) => m.captured && caps[m.color].push(m.captured));
  const gameOver = resigned || chess.isGameOver();

  const statusText = resigned
    ? t("resigned")
    : chess.isCheckmate()
    ? t("checkmate_win", { color: chess.turn() === "w" ? t("black_color") : t("white_color") })
    : chess.isStalemate()
    ? t("stalemate")
    : chess.isDraw()
    ? t("draw")
    : isThinking
    ? t("ai_thinking")
    : chess.inCheck()
    ? t("check")
    : "";
  const statusClass = gameOver ? styles.statusGameOver : isThinking ? styles.statusThinking : styles.statusCheck;
  const orientation: "w" | "b" = (vsAi ? playerColor === "b" : false) !== flipped ? "b" : "w";
  const bestArrow =
    review && review.classification !== "best" && review.bestUci
      ? [{ from: review.bestUci.slice(0, 2), to: review.bestUci.slice(2, 4) }]
      : [];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t("title")}</h1>
          <div className={styles.modeButtons}>
            <Button variant={gameMode === "vs-ai" ? "default" : "outline"} size="sm" disabled={engineDown} onClick={() => setGameMode("vs-ai")}>
              <Brain size={14} /> {t("vs_ai")}
            </Button>
            <Button variant={gameMode === "vs-player" ? "default" : "outline"} size="sm" onClick={() => setGameMode("vs-player")}>
              <Users size={14} /> {t("vs_player")}
            </Button>
            <Button variant="outline" size="sm" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)} aria-label={tc(soundOn ? "sound_on" : "sound_off")}>
              {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </Button>
          </div>
        </div>

        {engineDown && <p className={styles.engineDown}>{tc("engine_unavailable")}</p>}

        <div className={styles.layout}>
          <div className={styles.sidePanel}>
            {vsAi && (
              <div className={styles.card}>
                <div className={styles.cardTitle}>{t("ai_settings")}</div>
                <div className={styles.settingRow}>
                  <span>{t("difficulty")}</span>
                  <div className={styles.segmented}>
                    {ENGINE_LEVELS.map((l) => (
                      <button key={l.level} className={`${styles.segBtn} ${level === l.level ? styles.segBtnActive : ""}`} onClick={() => setLevel(l.level)}>
                        {l.level}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.settingRow}>
                  <span>{t("play_as")}</span>
                  <div className={styles.segmented}>
                    <button className={`${styles.segBtn} ${playerColor === "w" ? styles.segBtnActive : ""}`} onClick={() => setPlayerColor("w")}>{t("white")}</button>
                    <button className={`${styles.segBtn} ${playerColor === "b" ? styles.segBtnActive : ""}`} onClick={() => setPlayerColor("b")}>{t("black")}</button>
                  </div>
                </div>
              </div>
            )}

            {vsAi && <CoachPanel review={review} noAnalysis={noAnalysis} explain={coach.explain} analysing={reviewing} />}

            <div className={styles.card}>
              <div className={styles.cardTitle}>{t("captured")}</div>
              <div className={styles.capturedRow}>
                <span className={styles.capturedLabel}>{t("white_took")}</span>
                <div className={styles.capturedPieces}>
                  {caps.w.map((p, i) => <span key={i} className={styles.capturedPiece}>{capturedIcon(p, "b")}</span>)}
                </div>
              </div>
              <div className={styles.capturedRow}>
                <span className={styles.capturedLabel}>{t("black_took")}</span>
                <div className={styles.capturedPieces}>
                  {caps.b.map((p, i) => <span key={i} className={styles.capturedPiece}>{capturedIcon(p, "w")}</span>)}
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>{t("move_history")}</div>
              <div className={styles.moveList}>
                {history.length === 0 ? (
                  <span className={styles.noMoves}>{t("no_moves")}</span>
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
            </div>
          </div>

          <div className={styles.boardArea}>
            <div
              className={`${styles.statusBar} ${statusText ? statusClass : ""}`}
              style={{ visibility: statusText ? "visible" : "hidden" }}
            >
              {statusText || "placeholder"}
            </div>

            <div className={styles.boardStage}>
              {vsAi && <EvalBar cp={review?.evalAfterCp ?? 0} orientation={orientation} />}
              <ChessBoard
                fen={fen}
                orientation={orientation}
                onMove={onMove}
                interactive={!gameOver}
                lastMove={lastMove}
                check={kingSquare(chess)}
                arrows={bestArrow}
              />
            </div>

            <div className={styles.controls}>
              <Button variant="default" size="sm" onClick={handleNewGame}>
                <RefreshCw size={14} /> {t("new_game")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleUndo} disabled={history.length < 1}>
                <RotateCcw size={14} /> {t("undo")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setFlipped((f) => !f)}>
                <FlipVertical2 size={14} /> {t("flip")}
              </Button>
              {vsAi && !gameOver && (
                <Button variant="destructive" size="sm" onClick={() => setResigned(true)}>
                  <Flag size={14} /> {t("resign")}
                </Button>
              )}
            </div>

            <p className={styles.credit}>
              {tc("engine_credit")} ·{" "}
              <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener noreferrer">{tc("engine_source")}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
