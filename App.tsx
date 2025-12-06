import React from 'react';
import GameCanvas from './components/GameCanvas';

function App() {
  return (
    <div className="w-screen h-screen bg-slate-900 flex justify-center items-center">
      <GameCanvas />
    </div>
  );
}

export default App;