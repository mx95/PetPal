import React from 'react';
import { GameProvider } from '../game/GameContext';
import { PublicWalkProvider } from '../leaderboard/PublicWalkContext';
import Leaderboard from '../Pages/Leaderboard';

export default function LeaderboardRoute() {
  return (
    <GameProvider>
      <PublicWalkProvider>
        <Leaderboard />
      </PublicWalkProvider>
    </GameProvider>
  );
}
