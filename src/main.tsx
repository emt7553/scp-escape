import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { NeuralNetwork } from './lib/neural-network';

console.log('Rendering React application');

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('Root container not found');
}
