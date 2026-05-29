"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, RotateCcw } from "lucide-react";
import styles from "./PacmanGamePage.module.scss";

// ─── Map ──────────────────────────────────────────────────────────────────────
// 0=empty  1=wall  2=dot  3=power-pellet  4=ghost-door(ghosts only)
const BASE_MAP: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,3,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,3,1],
  [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,1,2,1],
  [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
  [1,1,1,1,2,1,1,1,0,0,1,0,0,1,1,1,2,1,1,1,1],
  [1,1,1,1,2,1,0,0,0,0,4,0,0,0,0,1,2,1,1,1,1],
  [1,1,1,1,2,1,0,1,0,0,0,0,0,1,0,1,2,1,1,1,1],
  [0,0,0,0,2,0,0,1,0,0,0,0,0,1,0,0,2,0,0,0,0],
  [1,1,1,1,2,1,0,1,1,1,1,1,1,1,0,1,2,1,1,1,1],
  [1,1,1,1,2,1,0,0,0,0,0,0,0,0,0,1,2,1,1,1,1],
  [1,1,1,1,2,1,0,1,1,1,1,1,1,1,0,1,2,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
  [1,3,2,1,2,2,2,2,2,2,0,2,2,2,2,2,2,1,2,3,1],
  [1,1,2,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,2,1,1],
  [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
  [1,2,1,1,1,1,1,1,2,1,1,1,2,1,1,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const ROWS = BASE_MAP.length;
const COLS = BASE_MAP[0].length;
const CELL = 28;
const W    = COLS * CELL;
const H    = ROWS * CELL;

// Ghosts exit via col 9 → row 6 (open corridor exists there)
const EXIT_COL = 9;
const EXIT_ROW = 6;

type Vec = { x: number; y: number };

const KEY_DIR: Record<string, Vec> = {
  ArrowLeft: {x:-1,y:0}, a:{x:-1,y:0}, A:{x:-1,y:0},
  ArrowRight:{x: 1,y:0}, d:{x: 1,y:0}, D:{x: 1,y:0},
  ArrowUp:   {x:0,y:-1}, w:{x:0,y:-1}, W:{x:0,y:-1},
  ArrowDown: {x:0,y: 1}, s:{x:0,y: 1}, S:{x:0,y: 1},
};

const GHOST_COLORS  = ["#FF0000","#FFB8FF","#00FFFF","#FFB852"];
const FRIGHT_COLOR  = "#2121DE";
const CHERRY_SCORE  = 100;
const TOTAL_DOTS    = BASE_MAP.flat().filter(v=>v===2||v===3).length;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cloneMap() { return BASE_MAP.map(r=>[...r]); }
function center(col:number, row:number){ return {px:col*CELL+CELL/2, py:row*CELL+CELL/2}; }
function wrap(col:number){ return ((col%COLS)+COLS)%COLS; }

function passable(map:number[][], row:number, col:number, ghost=false):boolean {
  const c = wrap(col);
  if (row<0||row>=ROWS) return false;
  const v = map[row][c];
  if (v===1) return false;
  if (v===4&&!ghost) return false;
  return true;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Mover {
  col:number; row:number; px:number; py:number;
  dir:Vec; nextDir:Vec; prog:number;
}
type GMode = "exiting"|"chase"|"frightened"|"eaten";
interface Ghost extends Mover {
  color:string; mode:GMode;
  frightenTimer:number; releaseTimer:number;
}

// ─── Spawn helpers ────────────────────────────────────────────────────────────
const GHOST_STARTS = [
  // Blinky: starts in MAIN MAZE (above ghost house), exits immediately
  {col:9, row:6,  release:0,   inside:false},
  // Others inside the ghost house with staggered release
  {col:10,row:10, release:180, inside:true},
  {col:8, row:10, release:360, inside:true},
  {col:12,row:10, release:540, inside:true},
];

function spawnPac():Mover {
  const c=center(10,16);
  return {col:10,row:16,px:c.px,py:c.py,dir:{x:0,y:0},nextDir:{x:0,y:0},prog:0};
}
function spawnGhosts():Ghost[] {
  return GHOST_STARTS.map(({col,row,release,inside},i)=>{
    const c=center(col,row);
    return {
      col,row,px:c.px,py:c.py,
      dir:{x:0,y:-1},nextDir:{x:0,y:-1},prog:0,
      color:GHOST_COLORS[i],
      mode: inside ? "exiting" : "chase",
      frightenTimer:0, releaseTimer:release,
    } as Ghost;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export function PacmanGamePage() {
  const cvRef      = useRef<HTMLCanvasElement>(null);
  const mapRef     = useRef(cloneMap());
  const pacRef     = useRef<Mover|null>(null);
  const ghostsRef  = useRef<Ghost[]>([]);
  const scoreRef   = useRef(0);
  const livesRef   = useRef(3);
  const dotsRef    = useRef(TOTAL_DOTS);
  const gameOverRef= useRef(false);
  const wonRef     = useRef(false);
  const mouthRef   = useRef({angle:0.25, spd:-1 as 1|-1});
  // Cherry bonus
  const cherryRef  = useRef<{col:number;row:number;visible:boolean;timer:number}|null>(null);

  const [score,    setScore]    = useState(0);
  const [lives,    setLives]    = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [won,      setWon]      = useState(false);
  const [started,  setStarted]  = useState(false);

  const PAC_SPD    = 7.5;
  const GHOST_SPD  = 5.5;
  const FRIGHT_SPD = 3.5;

  // ─── Init ───────────────────────────────────────────────────────────────────
  const initGame = useCallback(()=>{
    mapRef.current    = cloneMap();
    dotsRef.current   = TOTAL_DOTS;
    scoreRef.current  = 0;
    livesRef.current  = 3;
    gameOverRef.current = false;
    wonRef.current    = false;
    pacRef.current    = spawnPac();
    ghostsRef.current = spawnGhosts();
    cherryRef.current = null;
    setScore(0); setLives(3); setGameOver(false); setWon(false);
  },[]);

  const respawn = useCallback(()=>{
    pacRef.current    = spawnPac();
    ghostsRef.current = spawnGhosts();
    cherryRef.current = null;
  },[]);

  // ─── Draw ───────────────────────────────────────────────────────────────────
  const draw = useCallback(()=>{
    const cv=cvRef.current; if(!cv) return;
    const ctx=cv.getContext("2d")!;
    const map=mapRef.current;

    ctx.fillStyle="#000"; ctx.fillRect(0,0,W,H);

    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const v=map[r][c];
      const x=c*CELL, y=r*CELL;
      if(v===1){
        ctx.fillStyle="#1616cc"; ctx.fillRect(x+1,y+1,CELL-2,CELL-2);
        ctx.strokeStyle="#4444ff"; ctx.lineWidth=1.5;
        ctx.strokeRect(x+1,y+1,CELL-2,CELL-2);
      } else if(v===2){
        ctx.fillStyle="#ffcc00";
        ctx.beginPath(); ctx.arc(x+CELL/2,y+CELL/2,3,0,Math.PI*2); ctx.fill();
      } else if(v===3){
        ctx.fillStyle="#ffcc00";
        ctx.beginPath(); ctx.arc(x+CELL/2,y+CELL/2,7,0,Math.PI*2); ctx.fill();
      } else if(v===4){
        ctx.strokeStyle="#ff8888"; ctx.lineWidth=2; ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.moveTo(x+3,y+CELL/2); ctx.lineTo(x+CELL-3,y+CELL/2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Cherry bonus
    const ch=cherryRef.current;
    if(ch?.visible){
      const cx=ch.col*CELL+CELL/2, cy=ch.row*CELL+CELL/2;
      // stem
      ctx.strokeStyle="#228b22"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(cx,cy-4); ctx.lineTo(cx+5,cy-10); ctx.stroke();
      // two cherries
      ctx.fillStyle="#cc0000";
      ctx.beginPath(); ctx.arc(cx-5,cy+2,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#ee1111";
      ctx.beginPath(); ctx.arc(cx+2,cy+4,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.4)";
      ctx.beginPath(); ctx.arc(cx-7,cy,2,0,Math.PI*2); ctx.fill();
    }

    // Pac-Man
    const pac=pacRef.current;
    if(pac){
      const m=mouthRef.current;
      const angle=m.angle*Math.PI;
      let rot=0;
      if(pac.dir.x===1) rot=0;
      else if(pac.dir.x===-1) rot=Math.PI;
      else if(pac.dir.y===-1) rot=-Math.PI/2;
      else if(pac.dir.y===1) rot=Math.PI/2;
      ctx.fillStyle="#FFE000";
      ctx.beginPath();
      ctx.moveTo(pac.px,pac.py);
      ctx.arc(pac.px,pac.py,CELL*0.43,rot+angle,rot+Math.PI*2-angle);
      ctx.closePath(); ctx.fill();
    }

    // Ghosts
    for(const g of ghostsRef.current){
      const r2=CELL*0.43;
      if(g.mode==="eaten"){
        ctx.fillStyle="#fff";
        ctx.beginPath(); ctx.arc(g.px-5,g.py-4,4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.px+5,g.py-4,4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#00f";
        ctx.beginPath(); ctx.arc(g.px-4+g.dir.x*2,g.py-4+g.dir.y*2,2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.px+6+g.dir.x*2,g.py-4+g.dir.y*2,2,0,Math.PI*2); ctx.fill();
        continue;
      }
      const flash=g.mode==="frightened"&&g.frightenTimer<60&&Math.floor(g.frightenTimer/8)%2===0;
      const col=g.mode==="frightened"?(flash?"#fff":FRIGHT_COLOR):g.color;
      ctx.fillStyle=col;
      ctx.beginPath();
      ctx.arc(g.px,g.py-2,r2,Math.PI,0);
      ctx.lineTo(g.px+r2,g.py+r2);
      const ww=(r2*2)/3;
      for(let i=3;i>=0;i--) ctx.lineTo(g.px-r2+i*ww,g.py+r2+(i%2===0?-5:0));
      ctx.lineTo(g.px-r2,g.py+r2);
      ctx.closePath(); ctx.fill();
      if(g.mode!=="frightened"){
        ctx.fillStyle="#fff";
        ctx.beginPath(); ctx.arc(g.px-5,g.py-4,4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.px+5,g.py-4,4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#00f";
        ctx.beginPath(); ctx.arc(g.px-4+g.dir.x*2,g.py-4+g.dir.y*2,2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.px+6+g.dir.x*2,g.py-4+g.dir.y*2,2,0,Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle="#fff";
        ctx.fillRect(g.px-7,g.py-2,4,3);
        ctx.fillRect(g.px,  g.py-2,4,3);
        ctx.fillRect(g.px+7,g.py-2,4,3);
      }
    }
  },[]);

  // ─── Move ghost one step toward target (used for exiting) ───────────────────
  function stepToward(g:Ghost, tcol:number, trow:number, spd:number){
    let dx=0, dy=0;
    if(g.col!==tcol) dx=Math.sign(tcol-g.col);
    else if(g.row!==trow) dy=Math.sign(trow-g.row);
    if(dx===0&&dy===0) return;

    g.dir={x:dx,y:dy};
    const nc=wrap(g.col+dx), nr=g.row+dy;
    if(!passable(mapRef.current,nr,nc,true)) return;

    g.prog+=spd;
    if(g.prog>=1){
      g.prog=0; g.col=nc; g.row=nr;
      const c=center(g.col,g.row); g.px=c.px; g.py=c.py;
    } else {
      const from=center(g.col,g.row), to=center(nc,nr);
      g.px=from.px+(to.px-from.px)*g.prog;
      g.py=from.py+(to.py-from.py)*g.prog;
    }
  }

  // ─── Tick ───────────────────────────────────────────────────────────────────
  const tick = useCallback((dt:number)=>{
    if(gameOverRef.current||wonRef.current) return;
    const pac=pacRef.current; if(!pac) return;
    const map=mapRef.current;

    // Mouth
    const mo=mouthRef.current;
    mo.angle+=3*dt*mo.spd;
    if(mo.angle>=0.25) mo.spd=-1;
    if(mo.angle<=0.02) mo.spd=1;

    // ── Pac-Man movement ──────────────────────────────────────────────────────
    const pacSpd=PAC_SPD*dt;

    // Apply nextDir when at tile center (prog===0)
    if(pac.prog===0){
      const nd=pac.nextDir;
      if(nd.x!==0||nd.y!==0){
        const nc=wrap(pac.col+nd.x);
        if(passable(map,pac.row+nd.y,nc,false)) pac.dir={...nd};
      }
    }

    if(pac.dir.x!==0||pac.dir.y!==0){
      const nc=wrap(pac.col+pac.dir.x), nr=pac.row+pac.dir.y;
      if(passable(map,nr,nc,false)){
        pac.prog+=pacSpd;
        if(pac.prog>=1){
          pac.prog=0; pac.col=nc; pac.row=nr;
          const c=center(pac.col,pac.row); pac.px=c.px; pac.py=c.py;
          // eat
          const v=map[pac.row][pac.col];
          if(v===2){
            map[pac.row][pac.col]=0;
            scoreRef.current+=10; dotsRef.current--;
            setScore(scoreRef.current);
            // show cherry when half dots eaten
            if(dotsRef.current===Math.floor(TOTAL_DOTS/2)&&!cherryRef.current){
              cherryRef.current={col:10,row:10,visible:true,timer:600};
            }
          } else if(v===3){
            map[pac.row][pac.col]=0;
            scoreRef.current+=50; dotsRef.current--;
            setScore(scoreRef.current);
            ghostsRef.current.forEach(g=>{
              if(g.mode!=="eaten"&&g.mode!=="exiting"){ g.mode="frightened"; g.frightenTimer=120; }
            });
          }
          if(dotsRef.current<=0){ wonRef.current=true; setWon(true); return; }
        } else {
          const from=center(pac.col,pac.row), to=center(nc,nr);
          pac.px=from.px+(to.px-from.px)*pac.prog;
          pac.py=from.py+(to.py-from.py)*pac.prog;
        }
      } else {
        pac.prog=0;
      }
    }

    // Cherry
    const ch=cherryRef.current;
    if(ch?.visible){
      ch.timer--;
      if(ch.timer<=0) ch.visible=false;
      else if(Math.abs(pac.px-(ch.col*CELL+CELL/2))<CELL*0.7&&Math.abs(pac.py-(ch.row*CELL+CELL/2))<CELL*0.7){
        ch.visible=false;
        scoreRef.current+=CHERRY_SCORE;
        setScore(scoreRef.current);
      }
    }

    // ── Ghosts ────────────────────────────────────────────────────────────────
    for(const g of ghostsRef.current){
      if(g.mode==="frightened"){
        g.frightenTimer--;
        if(g.frightenTimer<=0) g.mode="chase";
      }

      // Exiting ghost house
      if(g.mode==="exiting"){
        g.releaseTimer--;
        if(g.releaseTimer>0) continue;
        // Phase 1: align column to EXIT_COL
        // Phase 2: go up to EXIT_ROW
        if(g.col!==EXIT_COL){
          stepToward(g, EXIT_COL, g.row, FRIGHT_SPD*dt);
        } else {
          stepToward(g, EXIT_COL, EXIT_ROW, FRIGHT_SPD*dt);
          if(g.row<=EXIT_ROW){ g.mode="chase"; g.prog=0; }
        }
        continue;
      }

      // Eaten — fly back to ghost house
      if(g.mode==="eaten"){
        const hc=center(EXIT_COL,EXIT_ROW+2);
        const dx=hc.px-g.px, dy=hc.py-g.py, dist=Math.hypot(dx,dy);
        const spd=GHOST_SPD*2*dt*CELL;
        if(dist<spd+2){
          g.px=hc.px; g.py=hc.py; g.col=EXIT_COL; g.row=EXIT_ROW+2;
          g.prog=0; g.mode="exiting"; g.releaseTimer=0;
        } else {
          g.px+=dx/dist*spd; g.py+=dy/dist*spd;
          g.col=Math.floor(g.px/CELL); g.row=Math.floor(g.py/CELL);
        }
        continue;
      }

      // Normal ghost movement
      const gSpd=(g.mode==="frightened"?FRIGHT_SPD:GHOST_SPD)*dt;

      // Pick direction at tile center
      if(g.prog===0){
        const opp={x:-g.dir.x,y:-g.dir.y};
        const opts:Vec[]=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}].filter(d=>{
          if(d.x===opp.x&&d.y===opp.y) return false;
          return passable(map,g.row+d.y,wrap(g.col+d.x),true);
        });
        // if no options, reverse
        if(opts.length===0) opts.push(opp);

        if(g.mode==="frightened"){
          g.dir=opts[Math.floor(Math.random()*opts.length)];
        } else {
          // Chase: pick dir that minimises manhattan distance to pac
          opts.sort((a,b)=>{
            const ac=wrap(g.col+a.x), bc=wrap(g.col+b.x);
            return (Math.abs(ac-pac.col)+Math.abs(g.row+a.y-pac.row))
                  -(Math.abs(bc-pac.col)+Math.abs(g.row+b.y-pac.row));
          });
          g.dir=opts[0];
        }
      }

      const nc=wrap(g.col+g.dir.x), nr=g.row+g.dir.y;
      if(passable(map,nr,nc,true)){
        g.prog+=gSpd;
        if(g.prog>=1){
          g.prog=0; g.col=nc; g.row=nr;
          const c=center(g.col,g.row); g.px=c.px; g.py=c.py;
        } else {
          const from=center(g.col,g.row), to=center(nc,nr);
          g.px=from.px+(to.px-from.px)*g.prog;
          g.py=from.py+(to.py-from.py)*g.prog;
        }
      } else {
        g.prog=0;
        // blocked — force reverse
        g.dir={x:-g.dir.x,y:-g.dir.y};
      }

      // Collision
      if(Math.hypot(g.px-pac.px,g.py-pac.py)<CELL*0.65){
        if(g.mode==="frightened"){
          g.mode="eaten"; scoreRef.current+=200; setScore(scoreRef.current);
        } else if(g.mode==="chase"){
          livesRef.current--;
          setLives(livesRef.current);
          if(livesRef.current<=0){ gameOverRef.current=true; setGameOver(true); return; }
          respawn(); return;
        }
      }
    }

    draw();
  },[draw,respawn]);

  // ─── Game loop ────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!started) return;
    initGame(); draw();

    let last=0, rafId=0;
    const loop=(t:number)=>{
      const dt=Math.min((t-last)/1000,0.05);
      if(last!==0) tick(dt);
      last=t;
      rafId=requestAnimationFrame(loop);
    };
    rafId=requestAnimationFrame(loop);

    const onKey=(e:KeyboardEvent)=>{
      const d=KEY_DIR[e.key];
      if(!d) return;
      e.preventDefault();
      const p=pacRef.current;
      if(p) p.nextDir={...d};
    };
    window.addEventListener("keydown",onKey);
    return ()=>{ cancelAnimationFrame(rafId); window.removeEventListener("keydown",onKey); };
  },[started,initGame,tick,draw]);

  // ─── Touch ────────────────────────────────────────────────────────────────
  const t0=useRef<{x:number;y:number}|null>(null);
  const onTouchStart=(e:React.TouchEvent)=>{ t0.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; };
  const onTouchEnd=(e:React.TouchEvent)=>{
    if(!t0.current) return;
    const dx=e.changedTouches[0].clientX-t0.current.x;
    const dy=e.changedTouches[0].clientY-t0.current.y;
    const p=pacRef.current; if(!p) return;
    if(Math.abs(dx)>Math.abs(dy)) p.nextDir=dx>0?{x:1,y:0}:{x:-1,y:0};
    else p.nextDir=dy>0?{x:0,y:1}:{x:0,y:-1};
    t0.current=null;
  };

  const setDir=(d:Vec)=>{ const p=pacRef.current; if(p) p.nextDir={...d}; };
  const handleRestart=()=>{ initGame(); if(!started) setStarted(true); };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link href="/game" className={styles.back}><ChevronLeft size={18}/>Игры</Link>
        <h1 className={styles.title}>PAC-MAN</h1>
        <button className={styles.restartBtn} onClick={handleRestart}><RotateCcw size={16}/></button>
      </div>

      <div className={styles.hud}>
        <div className={styles.hudItem}>
          <span className={styles.hudLabel}>Счёт</span>
          <span className={styles.hudValue}>{score}</span>
        </div>
        <div className={styles.lives}>
          {Array.from({length:lives}).map((_,i)=><span key={i} className={styles.life}>●</span>)}
        </div>
      </div>

      <div className={styles.canvasWrap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <canvas ref={cvRef} width={W} height={H} className={styles.canvas}/>
        {!started&&(
          <div className={styles.overlay}>
            <div className={styles.overlayBox}>
              <div className={styles.overlayTitle}>PAC-MAN</div>
              <p className={styles.overlayHint}>
                WASD / стрелки — управление<br/>
                Большие точки — призраки синеют (съедаемы)<br/>
                Вишня — бонус +100
              </p>
              <button className={styles.overlayBtn} onClick={()=>setStarted(true)}>Играть</button>
            </div>
          </div>
        )}
        {(gameOver||won)&&(
          <div className={styles.overlay}>
            <div className={styles.overlayBox}>
              <div className={styles.overlayTitle}>{won?"Победа! 🎉":"Игра окончена"}</div>
              <div className={styles.overlayScore}>Счёт: {score}</div>
              <button className={styles.overlayBtn} onClick={handleRestart}>Ещё раз</button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.dpad}>
        <div/>
        <button className={styles.dpadBtn} onClick={()=>setDir({x:0,y:-1})}>▲</button>
        <div/>
        <button className={styles.dpadBtn} onClick={()=>setDir({x:-1,y:0})}>◀</button>
        <div/>
        <button className={styles.dpadBtn} onClick={()=>setDir({x:1,y:0})}>▶</button>
        <div/>
        <button className={styles.dpadBtn} onClick={()=>setDir({x:0,y:1})}>▼</button>
        <div/>
      </div>
      <p className={styles.hint}>WASD / стрелки — движение</p>
    </div>
  );
}
