import React from 'react';
import { GameProvider } from '../game/GameContext';
import ActivityHub from '../Pages/ActivityHub';

export default function ActivityRoute() {
  return (
    <GameProvider>
      <ActivityHub />
    </GameProvider>
  );
}
