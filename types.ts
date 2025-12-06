export interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Player extends GameObject {
  vx: number;
  vy: number;
  isDead: boolean;
  facingRight: boolean;
}

export interface Platform extends GameObject {
  id: number;
  type: 'normal' | 'moving' | 'breakable';
  isBroken?: boolean;
  speed?: number; // For moving platforms
}

export interface Particle extends GameObject {
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}