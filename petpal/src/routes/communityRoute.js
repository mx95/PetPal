import React from 'react';
import { GameProvider } from '../game/GameContext';
import { LostPetProvider } from '../lostPet/LostPetContext';
import { CommunityProvider } from '../social/CommunityContext';
import Community from '../Pages/Community';

export default function CommunityRoute() {
  return (
    <GameProvider>
      <LostPetProvider>
        <CommunityProvider>
          <Community />
        </CommunityProvider>
      </LostPetProvider>
    </GameProvider>
  );
}
