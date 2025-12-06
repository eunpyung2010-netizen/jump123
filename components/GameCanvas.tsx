import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Player, Platform, GameState, Particle } from '../types';
import { Play, RotateCcw, Trophy } from 'lucide-react';

// Game Constants
const GRAVITY = 0.4;
const JUMP_FORCE = -11;
const MOVE_SPEED = 5;
const CANVAS_WIDTH = 400; // Virtual width
const CANVAS_HEIGHT = 700; // Virtual height
const PLATFORM_WIDTH = 70;
const PLATFORM_HEIGHT = 15;

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Game State handled via Refs for performance (avoiding React render cycle for game loop)
  const playerRef = useRef<Player>({ x: 200, y: 500, width: 30, height: 30, vx: 0, vy: 0, isDead: false, facingRight: true });
  const platformsRef = useRef<Platform[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef<number>(0);
  const cameraYRef = useRef<number>(0);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  
  // UI State
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [displayScore, setDisplayScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Initialize Game
  const initGame = useCallback(() => {
    playerRef.current = {
      x: CANVAS_WIDTH / 2 - 15,
      y: CANVAS_HEIGHT - 150,
      width: 30,
      height: 30,
      vx: 0,
      vy: 0,
      isDead: false,
      facingRight: true
    };
    
    // Initial platforms
    platformsRef.current = [
      { id: 1, x: CANVAS_WIDTH / 2 - PLATFORM_WIDTH / 2, y: CANVAS_HEIGHT - 50, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT, type: 'normal' },
      { id: 2, x: 100, y: CANVAS_HEIGHT - 200, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT, type: 'normal' },
      { id: 3, x: 250, y: CANVAS_HEIGHT - 350, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT, type: 'normal' },
      { id: 4, x: 50, y: CANVAS_HEIGHT - 500, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT, type: 'normal' },
      { id: 5, x: 300, y: CANVAS_HEIGHT - 650, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT, type: 'moving', speed: 2 },
    ];

    particlesRef.current = [];
    scoreRef.current = 0;
    cameraYRef.current = 0;
    setDisplayScore(0);
    setGameState(GameState.PLAYING);
  }, []);

  // Helpers
  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
      particlesRef.current.push({
        x,
        y,
        width: 4,
        height: 4,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        color
      });
    }
  };

  const generatePlatform = (minY: number) => {
    const y = minY - (Math.random() * 80 + 40); // Random gap between 40 and 120
    const x = Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH);
    
    // Difficulty scaling
    const score = scoreRef.current;
    let type: 'normal' | 'moving' | 'breakable' = 'normal';
    
    if (score > 1000 && Math.random() < 0.2) type = 'breakable';
    else if (score > 500 && Math.random() < 0.3) type = 'moving';
    
    platformsRef.current.push({
      id: Date.now() + Math.random(),
      x,
      y,
      width: PLATFORM_WIDTH,
      height: PLATFORM_HEIGHT,
      type,
      speed: type === 'moving' ? (Math.random() > 0.5 ? 2 : -2) : 0
    });
  };

  // Main Game Loop
  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;

    const player = playerRef.current;
    
    // 1. Input Handling
    if (keysPressed.current['ArrowLeft'] || keysPressed.current['TouchLeft']) {
      player.vx = -MOVE_SPEED;
      player.facingRight = false;
    } else if (keysPressed.current['ArrowRight'] || keysPressed.current['TouchRight']) {
      player.vx = MOVE_SPEED;
      player.facingRight = true;
    } else {
      player.vx *= 0.8; // Friction
    }

    // 2. Physics
    player.x += player.vx;
    player.y += player.vy;
    player.vy += GRAVITY;

    // Screen wrap
    if (player.x < -player.width / 2) player.x = CANVAS_WIDTH - player.width / 2;
    if (player.x > CANVAS_WIDTH - player.width / 2) player.x = -player.width / 2;

    // 3. Platform Collision (Only when falling)
    if (player.vy > 0) {
      platformsRef.current.forEach(platform => {
        if (
          !platform.isBroken &&
          player.x + player.width > platform.x &&
          player.x < platform.x + platform.width &&
          player.y + player.height > platform.y &&
          player.y + player.height < platform.y + platform.height + 20 // Tolerance
        ) {
          player.vy = JUMP_FORCE; // Jump!
          
          if (platform.type === 'breakable') {
             platform.isBroken = true;
             createExplosion(platform.x + platform.width/2, platform.y, '#94a3b8');
          } else {
             createExplosion(player.x + player.width/2, player.y + player.height, '#fff');
          }
        }
      });
    }

    // 4. Update Platforms
    platformsRef.current.forEach(p => {
      if (p.type === 'moving') {
        p.x += p.speed || 0;
        if (p.x <= 0 || p.x + p.width >= CANVAS_WIDTH) {
          p.speed = -(p.speed || 0);
        }
      }
    });

    // 5. Camera / Scrolling
    if (player.y < CANVAS_HEIGHT / 2) {
      const diff = CANVAS_HEIGHT / 2 - player.y;
      player.y = CANVAS_HEIGHT / 2;
      
      // Move platforms down
      platformsRef.current.forEach(p => p.y += diff);
      
      // Update Score
      scoreRef.current += Math.floor(diff);
      setDisplayScore(scoreRef.current);
      
      // Cleanup old platforms
      platformsRef.current = platformsRef.current.filter(p => p.y < CANVAS_HEIGHT + 100 && !p.isBroken);
      
      // Generate new platforms
      const highestPlatformY = Math.min(...platformsRef.current.map(p => p.y));
      if (highestPlatformY > 100) {
        generatePlatform(highestPlatformY);
      }
    }

    // 6. Particles
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // 7. Game Over Check
    if (player.y > CANVAS_HEIGHT) {
      setGameState(GameState.GAME_OVER);
      if (scoreRef.current > highScore) {
        setHighScore(scoreRef.current);
        localStorage.setItem('hamster_jump_highscore', scoreRef.current.toString());
      }
    }

  }, [gameState, highScore]);

  // Render Loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Background (Gradient based on score)
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    const score = scoreRef.current;
    if (score < 2000) {
        // Blue Sky
        gradient.addColorStop(0, '#60a5fa');
        gradient.addColorStop(1, '#dbeafe');
    } else if (score < 5000) {
        // Sunset
        gradient.addColorStop(0, '#4c1d95');
        gradient.addColorStop(1, '#f472b6');
    } else {
        // Space
        gradient.addColorStop(0, '#0f172a');
        gradient.addColorStop(1, '#312e81');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Stars/Clouds (Simple decoration)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for(let i=0; i<5; i++) {
        const cx = (Date.now() / 50 + i * 100) % CANVAS_WIDTH;
        ctx.beginPath();
        ctx.arc(cx, (i * 150 + 50) % CANVAS_HEIGHT, 20, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw Platforms
    platformsRef.current.forEach(p => {
      if (p.isBroken) return;
      
      // Platform Style
      ctx.fillStyle = p.type === 'moving' ? '#3b82f6' : (p.type === 'breakable' ? '#94a3b8' : '#84cc16');
      
      // Rounded Rectangle for cute look
      const radius = 8;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.width, p.height, radius);
      ctx.fill();
      
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(p.x + 5, p.y + 2, p.width - 10, p.height/2);
    });

    // Draw Particles
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.globalAlpha = 1.0;
    });

    // Draw Player (Hamster)
    const player = playerRef.current;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    
    // Body
    ctx.fillStyle = '#fbbf24'; // Amber-400
    ctx.beginPath();
    ctx.arc(px, py, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Ears
    ctx.fillStyle = '#d97706'; // Darker amber
    ctx.beginPath();
    ctx.arc(px - 10, py - 12, 6, 0, Math.PI * 2);
    ctx.arc(px + 10, py - 12, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Face
    ctx.fillStyle = '#000';
    // Eyes
    if (player.facingRight) {
        ctx.beginPath(); ctx.arc(px + 4, py - 2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 10, py - 2, 2, 0, Math.PI * 2); ctx.fill();
    } else {
        ctx.beginPath(); ctx.arc(px - 10, py - 2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px - 4, py - 2, 2, 0, Math.PI * 2); ctx.fill();
    }
    
    // Nose
    ctx.fillStyle = '#pink';
    ctx.beginPath(); ctx.arc(px + (player.facingRight ? 7 : -7), py + 2, 2, 0, Math.PI * 2); ctx.fill();

  }, []);

  // Loop Driver
  const loop = useCallback(() => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    // Load High Score
    const saved = localStorage.getItem('hamster_jump_highscore');
    if (saved) setHighScore(parseInt(saved, 10));

    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  // Input Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleTouchStart = (side: 'left' | 'right') => {
    if (side === 'left') keysPressed.current['TouchLeft'] = true;
    else keysPressed.current['TouchRight'] = true;
  };

  const handleTouchEnd = (side: 'left' | 'right') => {
    if (side === 'left') keysPressed.current['TouchLeft'] = false;
    else keysPressed.current['TouchRight'] = false;
  };

  return (
    <div 
        className="relative w-full h-full bg-slate-800 flex justify-center items-center overflow-hidden no-select"
        onContextMenu={(e) => e.preventDefault()} // Disable context menu (long press) for mobile
    >
      {/* Game Layer */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="max-h-full max-w-full aspect-[400/700] shadow-2xl bg-sky-200"
      />

      {/* UI Overlay - Added safe area support */}
      <div 
        className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-4 max-w-[450px] mx-auto"
        style={{ 
            paddingTop: 'max(1rem, env(safe-area-inset-top))', 
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' 
        }}
      >
        <div className="flex justify-between items-start pt-2">
            <div className="bg-black/40 text-white px-4 py-2 rounded-full backdrop-blur-sm font-bold text-xl">
                {displayScore} m
            </div>
            {gameState === GameState.PLAYING && (
                <div className="bg-yellow-500/80 text-white px-3 py-1 rounded-full text-sm font-bold">
                    최고기록: {highScore}
                </div>
            )}
        </div>
      </div>

      {/* Touch Controls (Invisible Layer) */}
      {gameState === GameState.PLAYING && (
          <div className="absolute inset-0 flex z-10">
            <div 
                className="w-1/2 h-full active:bg-white/5 transition-colors"
                onTouchStart={() => handleTouchStart('left')}
                onTouchEnd={() => handleTouchEnd('left')}
                onMouseDown={() => handleTouchStart('left')}
                onMouseUp={() => handleTouchEnd('left')}
            ></div>
            <div 
                className="w-1/2 h-full active:bg-white/5 transition-colors"
                onTouchStart={() => handleTouchStart('right')}
                onTouchEnd={() => handleTouchEnd('right')}
                onMouseDown={() => handleTouchStart('right')}
                onMouseUp={() => handleTouchEnd('right')}
            ></div>
          </div>
      )}

      {/* Menus */}
      {gameState === GameState.START && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-6 text-center">
            <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full animate-bounce-slight">
                <div className="flex justify-center mb-4">
                    <div className="w-20 h-20 bg-amber-400 rounded-full flex items-center justify-center shadow-lg border-4 border-amber-600">
                        <span className="text-4xl">🐹</span>
                    </div>
                </div>
                <h1 className="text-3xl font-black text-slate-800 mb-2">햄스터 스카이 점프</h1>
                <p className="text-slate-500 mb-6 font-medium">화면 좌우를 터치해서<br/>하늘 끝까지 올라가보세요!</p>
                
                <button 
                    onClick={initGame}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xl font-bold py-4 rounded-xl shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2"
                >
                    <Play size={24} fill="currentColor" />
                    게임 시작
                </button>
            </div>
        </div>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm p-6 text-center">
            <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full">
                <h2 className="text-2xl font-bold text-slate-800 mb-1">게임 오버!</h2>
                <div className="text-5xl font-black text-amber-500 mb-6 drop-shadow-md">{scoreRef.current}m</div>
                
                <div className="bg-slate-100 rounded-xl p-4 mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500 font-bold">
                        <Trophy size={20} className="text-yellow-500" />
                        최고 기록
                    </div>
                    <div className="text-xl font-bold text-slate-700">{highScore}m</div>
                </div>

                <button 
                    onClick={initGame}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xl font-bold py-4 rounded-xl shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2"
                >
                    <RotateCcw size={24} />
                    다시 하기
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;