import { Agent, GameState, Position, Door, Orb } from '../types';
import { NeuralNetwork } from './neural-network';

export class GameEngine {
  private state: GameState;
  private mapSize: number;
  private populationSize: number;
  private mutationRate: number;
  private visionRayCount: number = 8;
  private visionRange: number = 10;
  private visionAngle: number = Math.PI / 2;
  private gridSize: number = 14;
  private doorInteractionTime: number = 20;
  private doorInteractionRange: number = 3;
  private orbCollectionRange: number = 2;
  private simulationSpeed: number = 1;
  private roomExplorationReward: number = 100;
  private doorInteractionReward: number = 30;
  private batchSize: number = 10;

  private scpSpeed: number = 0.4;
  private scientistSpeed: number = 0.5;
  private shouldRender: boolean = true;

  constructor(mapSize: number = 60, populationSize: number = 20) {
    this.mapSize = mapSize;
    this.populationSize = populationSize;
    this.mutationRate = 0.2;
    this.state = this.initializeGame();
  }

  public setSimulationSpeed(speed: number): void {
    this.simulationSpeed = speed;
    this.shouldRender = speed <= 5;
    this.batchSize = Math.min(Math.ceil(speed * 2), 50);
  }

  public saveState(): string {
    const saveData = {
      agents: this.state.agents.map((agent) => ({
        ...agent,
        network: {
          weights: agent.network.weights,
          biases: agent.network.biases,
        },
        collectedOrbs: Array.from(agent.collectedOrbs),
        visitedRooms: Array.from(agent.visitedRooms),
      })),
      generation: this.state.generation,
      timeStep: this.state.timeStep,
      orbs: this.state.orbs,
      doors: this.state.doors,
    };
    return JSON.stringify(saveData);
  }

  public loadState(saveData: string): void {
    try {
      const parsedData = JSON.parse(saveData);
      
      this.state.agents = parsedData.agents.map((agent: any) => ({
        ...agent,
        network: new NeuralNetwork(this.visionRayCount + 2, 16, 4),
        collectedOrbs: new Set(agent.collectedOrbs),
        visitedRooms: new Set(agent.visitedRooms),
      }));

      this.state.agents.forEach((agent, i) => {
        agent.network.weights = parsedData.agents[i].network.weights;
        agent.network.biases = parsedData.agents[i].network.biases;
      });

      this.state.generation = parsedData.generation;
      this.state.timeStep = parsedData.timeStep;
      this.state.orbs = parsedData.orbs;
      this.state.doors = parsedData.doors;
    } catch (error) {
      console.error('Failed to load save data:', error);
    }
  }

  private initializeGame(): GameState {
    const agents: Agent[] = [];
    const halfPopulation = Math.floor(this.populationSize / 2);

    for (let i = 0; i < halfPopulation; i++) {
      agents.push(this.createInitialAgent('scientist', i));
    }

    for (let i = 0; i < halfPopulation; i++) {
      agents.push(this.createInitialAgent('scp', i));
    }

    const { walls, doors } = this.generateGridMaze();
    const orbs = this.generateOrbs();

    return {
      agents,
      checkpoints: [
        { x: this.mapSize - 5, y: 5 },
        { x: this.mapSize - 5, y: this.mapSize - 5 },
      ],
      walls,
      doors,
      orbs,
      generation: 0,
      timeStep: 0,
      visionRayCount: this.visionRayCount,
      visionAngle: this.visionAngle,
      visionRange: this.visionRange,
    };
  }

  private createInitialAgent(type: 'scientist' | 'scp', index: number): Agent {
    return {
      id: `${type}-${index}`,
      position: {
        x: type === 'scientist' ? 5 : this.mapSize - 5,
        y: 5 + index * 2,
      },
      rotation: type === 'scientist' ? 0 : Math.PI,
      type,
      health: type === 'scientist' ? 100 : 200,
      network: new NeuralNetwork(this.visionRayCount + 2, 16, 4),
      fitness: 0,
      isInteracting: false,
      collectedOrbs: new Set<string>(),
      visitedRooms: new Set<string>(),
      lastDoorInteraction: 0,
    };
  }

  private generateOrbs(): Orb[] {
    const orbs: Orb[] = [];
    const spacing = this.gridSize;
    let orbId = 0;

    for (let x = spacing / 2; x < this.mapSize - spacing / 2; x += spacing) {
      for (let y = spacing / 2; y < this.mapSize - spacing / 2; y += spacing) {
        const isRoomCenter =
          x % spacing === spacing / 2 && y % spacing === spacing / 2;

        if (isRoomCenter) {
          orbs.push({
            id: `orb-${orbId++}`,
            position: { x, y },
            collected: false,
          });
        }
      }
    }
    return orbs;
  }

  private generateGridMaze(): { walls: Position[]; doors: Door[] } {
    const walls: Position[] = [];
    const doors: Door[] = [];
    const spacing = this.gridSize;

    for (let x = spacing; x < this.mapSize; x += spacing) {
      for (let y = 0; y < this.mapSize; y++) {
        if (y % spacing === spacing / 2) {
          doors.push({
            position: { x, y },
            isOpen: Math.random() > 0.5,
            isVertical: true,
            interactionProgress: 0,
            interactingAgent: null,
          });
        } else if (y % spacing !== spacing / 2) {
          walls.push({ x, y });
        }
      }
    }

    for (let y = spacing; y < this.mapSize; y += spacing) {
      for (let x = 0; x < this.mapSize; x++) {
        if (x % spacing === spacing / 2) {
          doors.push({
            position: { x, y },
            isOpen: Math.random() > 0.5,
            isVertical: false,
            interactionProgress: 0,
            interactingAgent: null,
          });
        } else if (x % spacing !== spacing / 2) {
          walls.push({ x, y });
        }
      }
    }

    for (let i = 0; i < this.mapSize; i++) {
      walls.push({ x: 0, y: i });
      walls.push({ x: this.mapSize - 1, y: i });
      walls.push({ x: i, y: 0 });
      walls.push({ x: i, y: this.mapSize - 1 });
    }

    return { walls, doors };
  }

  private castVisionRay(agent: Agent, angle: number): VisionRay['hit'] {
    const rayX = Math.cos(agent.rotation + angle);
    const rayY = Math.sin(agent.rotation + angle);
    let distance = 0;
    const step = 0.5;

    while (distance < this.visionRange) {
      distance += step;
      const checkX = agent.position.x + rayX * distance;
      const checkY = agent.position.y + rayY * distance;

      if (
        this.state.walls.some(
          (w) => Math.abs(w.x - checkX) < 0.5 && Math.abs(w.y - checkY) < 0.5
        )
      ) {
        return { type: 'wall', distance };
      }

      const door = this.state.doors.find(
        (d) =>
          Math.abs(d.position.x - checkX) < 0.5 &&
          Math.abs(d.position.y - checkY) < 0.5
      );
      if (door && !door.isOpen) {
        return { type: 'door', distance };
      }

      if (
        this.state.checkpoints.some(
          (c) => Math.abs(c.x - checkX) < 1 && Math.abs(c.y - checkY) < 1
        )
      ) {
        return { type: 'checkpoint', distance };
      }

      const hitAgent = this.state.agents.find(
        (a) =>
          a !== agent &&
          Math.abs(a.position.x - checkX) < 0.5 &&
          Math.abs(a.position.y - checkY) < 0.5
      );
      if (hitAgent) {
        return { type: hitAgent.type, distance };
      }
    }

    return { type: 'none', distance: this.visionRange };
  }

  private getAgentVision(agent: Agent): VisionRay[] {
    const rays: VisionRay[] = [];
    const angleStep = this.visionAngle / (this.visionRayCount - 1);
    const startAngle = -this.visionAngle / 2;

    for (let i = 0; i < this.visionRayCount; i++) {
      const angle = startAngle + angleStep * i;
      const hit = this.castVisionRay(agent, angle);
      rays.push({ angle, distance: hit.distance, hit });
    }

    return rays;
  }

  public update(): void {
    for (let i = 0; i < this.batchSize; i++) {
      this.updateOnce();
      
      if (this.shouldEndGeneration()) {
        this.evolve();
        break;
      }
    }
  }

  private updateOnce(): void {
    this.state.timeStep++;

    this.updateDoors();
    this.state.agents.forEach((agent) => {
      if (agent.health <= 0) return;

      const vision = this.getAgentVision(agent);
      const inputs = [
        ...vision.map((ray) => ray.hit.distance / this.visionRange),
        agent.health / (agent.type === 'scientist' ? 100 : 200),
        this.state.timeStep / 1000,
      ];

      const outputs = agent.network.forward(inputs);
      this.moveAgent(agent, outputs);
      this.handleDoorInteraction(agent, outputs[3]);
      this.handleOrbCollection(agent);
      this.updateFitness(agent);
    });

    this.handleInteractions();

    if (this.shouldEndGeneration()) {
      this.evolve();
    }
  }

  private updateDoors(): void {
    this.state.doors.forEach((door) => {
      if (door.interactingAgent) {
        door.interactionProgress += 1 / this.doorInteractionTime;
        if (door.interactionProgress >= 1) {
          door.isOpen = !door.isOpen;
          door.interactionProgress = 0;
          door.interactingAgent = null;
        }
      }
    });
  }

  private moveAgent(agent: Agent, outputs: number[]): void {
    if (agent.isInteracting) return;

    const speedMultiplier =
      agent.type === 'scp' ? this.scpSpeed : this.scientistSpeed;
    const speed = outputs[0] * speedMultiplier;

    const rotation = (outputs[2] - outputs[1]) * 0.1;

    agent.rotation += rotation;
    agent.rotation = agent.rotation % (Math.PI * 2);

    const newX = agent.position.x + Math.cos(agent.rotation) * speed;
    const newY = agent.position.y + Math.sin(agent.rotation) * speed;

    const wouldCollide =
      this.state.walls.some(
        (w) => Math.abs(w.x - newX) < 1 && Math.abs(w.y - newY) < 1
      ) ||
      this.state.doors.some(
        (d) =>
          !d.isOpen &&
          Math.abs(d.position.x - newX) < 1 &&
          Math.abs(d.position.y - newY) < 1
      );

    if (!wouldCollide) {
      agent.position.x = Math.max(1, Math.min(this.mapSize - 1, newX));
      agent.position.y = Math.max(1, Math.min(this.mapSize - 1, newY));
    }
  }

  private getRoomKey(position: Position): string {
    const roomX = Math.floor(position.x / this.gridSize);
    const roomY = Math.floor(position.y / this.gridSize);
    return `${roomX},${roomY}`;
  }

  private handleDoorInteraction(agent: Agent, interactOutput: number): void {
    if (interactOutput > 0.5) {
      const nearestDoor = this.state.doors
        .filter((d) => !d.interactingAgent || d.interactingAgent === agent.id)
        .reduce((nearest, door) => {
          const dist = this.distance(agent.position, door.position);
          return dist < this.doorInteractionRange &&
            (!nearest || dist < this.distance(agent.position, nearest.position))
            ? door
            : nearest;
        }, null as Door | null);

      if (nearestDoor) {
        nearestDoor.interactingAgent = agent.id;
        agent.isInteracting = true;
        
        if (this.state.timeStep - agent.lastDoorInteraction > 50) {
          agent.fitness += this.doorInteractionReward;
          agent.lastDoorInteraction = this.state.timeStep;
        }
      }
    } else {
      const interactingDoor = this.state.doors.find(
        (d) => d.interactingAgent === agent.id
      );
      if (interactingDoor) {
        interactingDoor.interactingAgent = null;
        interactingDoor.interactionProgress = 0;
      }
      agent.isInteracting = false;
    }
  }

  private handleOrbCollection(agent: Agent): void {
    if (agent.type !== 'scientist') return;

    this.state.orbs.forEach((orb) => {
      if (
        !orb.collected &&
        !agent.collectedOrbs.has(orb.id) &&
        this.distance(agent.position, orb.position) < this.orbCollectionRange
      ) {
        agent.collectedOrbs.add(orb.id);
        agent.fitness += 50;
      }
    });
  }

  private handleInteractions(): void {
    const scientists = this.state.agents.filter(
      (a) => a.type === 'scientist' && a.health > 0
    );
    const scps = this.state.agents.filter(
      (a) => a.type === 'scp' && a.health > 0
    );

    for (const scp of scps) {
      for (const scientist of scientists) {
        const dist = this.distance(scp.position, scientist.position);
        if (dist < 2) {
          scientist.health = Math.max(0, scientist.health - 10);
          scp.fitness += 10;
        }
      }
    }
  }

  private distance(p1: Position, p2: Position): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  private updateFitness(agent: Agent): void {
    const currentRoom = this.getRoomKey(agent.position);
    if (!agent.visitedRooms.has(currentRoom)) {
      agent.visitedRooms.add(currentRoom);
      agent.fitness += this.roomExplorationReward;
    }

    if (agent.type === 'scientist') {
      const distToCheckpoints = this.state.checkpoints.map((checkpoint) =>
        this.distance(agent.position, checkpoint)
      );
      const minDist = Math.min(...distToCheckpoints);
      agent.fitness += (1000 - minDist) / 1000;

      const nearestDoor = this.state.doors.reduce((nearest, door) => {
        const dist = this.distance(agent.position, door.position);
        return !nearest || dist < this.distance(agent.position, nearest.position)
          ? door
          : nearest;
      }, this.state.doors[0]);

      const doorDist = this.distance(agent.position, nearestDoor.position);
      if (doorDist < this.doorInteractionRange) {
        agent.fitness += 0.5;
      }
    } else {
      const scientists = this.state.agents.filter(
        (a) => a.type === 'scientist' && a.health > 0
      );
      if (scientists.length > 0) {
        const minDist = Math.min(
          ...scientists.map((s) => this.distance(agent.position, s.position))
        );
        agent.fitness += (100 - minDist) / 100;
      }
    }
  }

  private shouldEndGeneration(): boolean {
    const scientists = this.state.agents.filter((a) => a.type === 'scientist');
    return (
      this.state.timeStep >= 1000 ||
      scientists.every((s) => s.health <= 0 || this.hasEscaped(s))
    );
  }

  private hasEscaped(scientist: Agent): boolean {
    return this.state.checkpoints.some(
      (checkpoint) => this.distance(scientist.position, checkpoint) < 2
    );
  }

  private evolve(): void {
    const scientists = this.state.agents.filter((a) => a.type === 'scientist');
    const scps = this.state.agents.filter((a) => a.type === 'scp');
    const newAgents: Agent[] = [];
    const halfPopulation = Math.floor(this.populationSize / 2);

    if (scientists.length > 0) {
      scientists.sort((a, b) => b.fitness - a.fitness);
      const bestScientist = scientists[0];
      for (let i = 0; i < halfPopulation; i++) {
        newAgents.push(this.createOffspring(bestScientist));
      }
    } else {
      for (let i = 0; i < halfPopulation; i++) {
        newAgents.push(this.createInitialAgent('scientist', i));
      }
    }

    if (scps.length > 0) {
      scps.sort((a, b) => b.fitness - a.fitness);
      const bestSCP = scps[0];
      for (let i = 0; i < halfPopulation; i++) {
        newAgents.push(this.createOffspring(bestSCP));
      }
    } else {
      for (let i = 0; i < halfPopulation; i++) {
        newAgents.push(this.createInitialAgent('scp', i));
      }
    }

    this.state.agents = newAgents;
    this.state.orbs.forEach((orb) => (orb.collected = false));
    this.state.generation++;
    this.state.timeStep = 0;
  }

  private createOffspring(parent: Agent): Agent {
    const offspring: Agent = {
      id: `${parent.type}-${Math.random()}`,
      position: {
        x: parent.type === 'scientist' ? 5 : this.mapSize - 5,
        y: 5 + Math.random() * 10,
      },
      rotation: parent.type === 'scientist' ? 0 : Math.PI,
      type: parent.type,
      health: parent.type === 'scientist' ? 100 : 200,
      network: new NeuralNetwork(this.visionRayCount + 2, 16, 4),
      fitness: 0,
      isInteracting: false,
      collectedOrbs: new Set<string>(),
      visitedRooms: new Set<string>(),
      lastDoorInteraction: 0,
    };

    offspring.network.weights = JSON.parse(JSON.stringify(parent.network.weights));
    offspring.network.biases = [...parent.network.biases];
    offspring.network.mutate(this.mutationRate);

    return offspring;
  }

  public getState(): GameState {
    return this.state;
  }

  public shouldRenderFrame(): boolean {
    return this.shouldRender;
  }
}