import React from 'react';
import { LostPetProvider } from '../lostPet/LostPetContext';
import LostPetAlerts from '../Pages/LostPetAlerts';

export default function LostPetAlertsRoute() {
  return (
    <LostPetProvider>
      <LostPetAlerts />
    </LostPetProvider>
  );
}
