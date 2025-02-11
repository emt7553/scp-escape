import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './lib/game-engine';
import { GameState } from './types';
import { Save, RotateCcw, FastForward, Play, Pause } from 'lucide-react';

function App() {
  console.log('App component rendered');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameEngine] = useState(() => new GameEngine(70, 59));
  const [gameState, setGameState] = useState<GameState>(gameEngine.getState());
  const [isPaused, setIsPaused] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const lastRenderTimeRef = useRef<number>(0);

  const handleSave = () => {
    const saveData = gameEngine.saveState();
    const blob = new Blob([saveData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scp-escape-gen-${gameState.generation}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          gameEngine.loadState(content);
          setGameState(gameEngine.getState());
        }
      };
      reader.onabort = () => console.log('File reading was aborted');
      reader.onerror = () => console.error('File reading failed');
      reader.readAsText(file);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setSimulationSpeed(speed);
    gameEngine.setSimulationSpeed(speed);
  };

  useEffect(() => {
    console.log('useEffect hook executed');

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Canvas context not found');
      return;
    }

    console.log('Canvas and context initialized');

    const cellSize = 10;
    canvas.width = 700;
    canvas.height = 700;

    const render = () => {
      console.log('Rendering frame');
      if (!gameEngine.shouldRenderFrame()) {
        // Only update status text when not rendering full graphics
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, 40);
        ctx.fillStyle = '#000000';
        ctx.font = '16px Arial';
        ctx.fillText(`Generation: ${gameState.generation}`, 10, 20);
        ctx.fillText(`Time Step: ${gameState.timeStep}`, 10, 40);
        return;
      }

      // Clear canvas
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw walls
      ctx.fillStyle = '#666666';
      gameState.walls.forEach((wall) => {
        ctx.fillRect(wall.x * cellSize, wall.y * cellSize, cellSize, cellSize);
      });

      // Draw doors as squares
      gameState.doors.forEach((door) => {
        ctx.fillStyle = door.isOpen ? '#88ff88' : '#ff8888';

        if (door.interactingAgent) {
          ctx.fillStyle = `rgba(255, 255, 0, ${door.interactionProgress})`;
        }

        ctx.fillRect(
          door.position.x * cellSize,
          door.position.y * cellSize,
          cellSize,
          cellSize
        );
      });

      // Draw checkpoints
      ctx.fillStyle = '#00ff00';
      gameState.checkpoints.forEach((checkpoint) => {
        ctx.fillRect(
          checkpoint.x * cellSize - cellSize,
          checkpoint.y * cellSize - cellSize,
          cellSize * 2,
          cellSize * 2
        );
      });

      // Draw orbs
      gameState.orbs.forEach((orb) => {
        if (!orb.collected) {
          ctx.fillStyle = '#ffff00';
          ctx.beginPath();
          ctx.arc(
            orb.position.x * cellSize + cellSize / 2,
            orb.position.y * cellSize + cellSize / 2,
            cellSize / 3,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      });

      // Draw agents
      gameState.agents.forEach((agent) => {
        if (agent.health <= 0) return;

        // Draw vision cone
        ctx.fillStyle =
          agent.type === 'scientist'
            ? 'rgba(0, 0, 255, 0.1)'
            : 'rgba(255, 0, 0, 0.1)';
        ctx.beginPath();
        ctx.moveTo(
          agent.position.x * cellSize + cellSize / 2,
          agent.position.y * cellSize + cellSize / 2
        );
        ctx.arc(
          agent.position.x * cellSize + cellSize / 2,
          agent.position.y * cellSize + cellSize / 2,
          100,
          agent.rotation - Math.PI / 4,
          agent.rotation + Math.PI / 4
        );
        ctx.lineTo(
          agent.position.x * cellSize + cellSize / 2,
          agent.position.y * cellSize + cellSize / 2
        );
        ctx.fill();

        // Draw agent
        ctx.fillStyle = agent.type === 'scientist' ? '#0000ff' : '#ff0000';
        if (agent.isInteracting) {
          ctx.fillStyle = '#ffff00';
        }
        ctx.beginPath();
        ctx.arc(
          agent.position.x * cellSize + cellSize / 2,
          agent.position.y * cellSize + cellSize / 2,
          cellSize / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // Draw direction indicator
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(
          agent.position.x * cellSize + cellSize / 2,
          agent.position.y * cellSize + cellSize / 2
        );
        ctx.lineTo(
          agent.position.x * cellSize +
            cellSize / 2 +
            Math.cos(agent.rotation) * cellSize,
          agent.position.y * cellSize +
            cellSize / 2 +
            Math.sin(agent.rotation) * cellSize
        );
        ctx.stroke();

        // Draw health bar
        const healthBarWidth = cellSize;
        const healthBarHeight = 2;
        const healthPercentage =
          agent.health / (agent.type === 'scientist' ? 100 : 200);

        ctx.fillStyle = '#ff0000';
        ctx.fillRect(
          agent.position.x * cellSize,
          agent.position.y * cellSize - cellSize / 2,
          healthBarWidth,
          healthBarHeight
        );

        ctx.fillStyle = '#00ff00';
        ctx.fillRect(
          agent.position.x * cellSize,
          agent.position.y * cellSize - cellSize / 2,
          healthBarWidth * healthPercentage,
          healthBarHeight
        );
      });

      // Draw generation and time info
      ctx.fillStyle = '#000000';
      ctx.font = '16px Arial';
      ctx.fillText(`Generation: ${gameState.generation}`, 10, 20);
      ctx.fillText(`Time Step: ${gameState.timeStep}`, 10, 40);
    };

    const fps = 60;
    const frameInterval = 1000 / fps;

    const update = (currentTime: number) => {
      console.log('Updating game state');
      if (isPaused) {
        animationFrameRef.current = requestAnimationFrame(update);
        return;
      }

      const deltaTime = currentTime - lastTimeRef.current;

      if (deltaTime >= frameInterval) {
        gameEngine.update();
        setGameState(gameEngine.getState());
        
        // Only render at lower simulation speeds or when enough time has passed
        const timeSinceLastRender = currentTime - lastRenderTimeRef.current;
        if (timeSinceLastRender >= 1000 / 30) { // Max 30 FPS for rendering
          render();
          lastRenderTimeRef.current = currentTime;
        }
        
        lastTimeRef.current = currentTime;
      }

      animationFrameRef.current = requestAnimationFrame(update);
    };

    animationFrameRef.current = requestAnimationFrame(update);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameEngine, gameState, isPaused, simulationSpeed]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-4">SCP Escape</h1>

      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {isPaused ? <Play size={20} /> : <Pause size={20} />}
          {isPaused ? 'Resume' : 'Pause'}
        </button>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          <Save size={20} />
          Save Generation
        </button>

        <label className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 cursor-pointer">
          <RotateCcw size={20} />
          Load Generation
          <input
            type="file"
            accept=".json"
            onChange={handleLoad}
            className="hidden"
          />
        </label>

        <div className="flex items-center gap-2">
          <FastForward size={20} />
          <select
            value={simulationSpeed}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            className="px-2 py-1 rounded border border-gray-300"
          >
            <option value="1">1x</option>
            <option value="2">2x</option>
            <option value="5">5x</option>
            <option value="10">10x</option>
            <option value="20">20x</option>
          </select>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-lg">
        <canvas ref={canvasRef} className="border border-gray-300 rounded" />
      </div>

      <div className="mt-4 text-gray-700">
        <p>Generation: {gameState.generation}</p>
        <p>Time Step: {gameState.timeStep}</p>
        <p>Blue dots: Scientists trying to escape</p>
        <p>Red dots: SCPs trying to stop scientists</p>
        <p>Green squares: Escape checkpoints</p>
        <p>Gray squares: Walls</p>
        <p>Red/Green bars: Doors (red = closed, green = open)</p>
        <p>Yellow glow: Door interaction in progress</p>
      </div>
    </div>
  );
}

export default App;