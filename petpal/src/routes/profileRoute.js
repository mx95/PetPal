import React from 'react';
import { GameProvider } from '../game/GameContext';
import Profile from '../Pages/Profile';

export default function ProfileRoute() {
  return (
    <GameProvider>
      <Profile />
    </GameProvider>
  );
}
