import { NeuralNetwork } from '../lib/neural-network';

export interface Position {
  x: number;
  y: number;
}

export interface Door {
  position: Position;
  isOpen: boolean;
  isVertical: boolean;
  interactionProgress: number;
  interactingAgent: string | null;
}

export interface Agent {
  id: string;
  position: Position;
  rotation: number;
  type: 'scientist' | 'scp';
  health: number;
  network: NeuralNetwork;
  fitness: number;
  isInteracting: boolean;
  collectedOrbs: Set<string>;
  visitedRooms: Set<string>; // Track which rooms the agent has visited
  lastDoorInteraction: number; // Track when the agent last interacted with a door
}

export interface VisionRay {
  angle: number;
  distance: number;
  hit: {
    type: 'wall' | 'door' | 'checkpoint' | 'scientist' | 'scp' | 'none';
    distance: number;
  };
}

export type GameState = {
  agents: Agent[];
  checkpoints: Position[];
  walls: Position[];
  doors: Door[];
  orbs: Orb[];
  generation: number;
  timeStep: number;
  visionRayCount: number;
  visionAngle: number;
  visionRange: number;
};

export type Orb = {
  id: string;
  position: Position;
  collected: boolean;
};