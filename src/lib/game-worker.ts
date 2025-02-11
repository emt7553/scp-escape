// Import necessary types and NeuralNetwork class
import { Agent, VisionRay, Door, Position } from '../types';

// Function to simulate agent vision
function getAgentVision(
  agent: Agent,
  walls: Position[],
  doors: Door[],
  checkpoints: Position[],
  agents: Agent[],
  visionRayCount: number,
  visionAngle: number,
  visionRange: number
): VisionRay[] {
  const rays: VisionRay[] = [];
  const angleStep = visionAngle / (visionRayCount - 1);
  const startAngle = -visionAngle / 2;

  for (let i = 0; i < visionRayCount; i++) {
    const angle = startAngle + angleStep * i;
    const hit = castVisionRay(
      agent,
      angle,
      walls,
      doors,
      checkpoints,
      agents,
      visionRange
    );
    rays.push({ angle, distance: hit.distance, hit });
  }

  return rays;
}

// Function to simulate vision ray casting
function castVisionRay(
  agent: Agent,
  angle: number,
  walls: Position[],
  doors: Door[],
  checkpoints: Position[],
  agents: Agent[],
  visionRange: number
): VisionRay['hit'] {
  const rayX = Math.cos(agent.rotation + angle);
  const rayY = Math.sin(agent.rotation + angle);
  let distance = 0;

  while (distance < visionRange) {
    distance += 0.5;
    const checkX = agent.position.x + rayX * distance;
    const checkY = agent.position.y + rayY * distance;

    // Check walls
    if (
      walls.some(
        (w) => Math.abs(w.x - checkX) < 0.5 && Math.abs(w.y - checkY) < 0.5
      )
    ) {
      return { type: 'wall', distance };
    }

    // Check doors
    const door = doors.find(
      (d) =>
        Math.abs(d.position.x - checkX) < 0.5 &&
        Math.abs(d.position.y - checkY) < 0.5
    );
    if (door && !door.isOpen) {
      return { type: 'door', distance };
    }

    // Check checkpoints
    if (
      checkpoints.some(
        (c) => Math.abs(c.x - checkX) < 0.5 && Math.abs(c.y - checkY) < 0.5
      )
    ) {
      return { type: 'checkpoint', distance };
    }

    // Check other agents
    const hitAgent = agents.find(
      (a) =>
        a !== agent &&
        Math.abs(a.position.x - checkX) < 0.5 &&
        Math.abs(a.position.y - checkY) < 0.5
    );

    if (hitAgent) {
      return { type: hitAgent.type, distance };
    }
  }

  return { type: 'none', distance: visionRange };
}

// Web Worker message handler
self.onmessage = (event) => {
  const {
    agent,
    walls,
    doors,
    checkpoints,
    agents,
    visionRayCount,
    visionAngle,
    visionRange,
    timeStep,
  } = event.data;

  // Simulate agent vision
  const vision = getAgentVision(
    agent,
    walls,
    doors,
    checkpoints,
    agents,
    visionRayCount,
    visionAngle,
    visionRange
  );

  // Prepare inputs for the neural network
  const inputs = [
    ...vision.map((ray) => ray.hit.distance / visionRange),
    agent.health / (agent.type === 'scientist' ? 100 : 200),
    timeStep / 1000,
  ];

  // Run the neural network forward pass
  const outputs = agent.network.forward(inputs);

  // Send the results back to the main thread
  self.postMessage({ agentId: agent.id, outputs });
};
