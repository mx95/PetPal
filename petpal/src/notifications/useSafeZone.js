import { useEffect, useState } from 'react';
import { subscribeSafeZone } from './notificationsFirestore';

/** Live safe-zone doc for one pet (null when none is set). */
export function useSafeZone(uid, petId) {
  const [state, setState] = useState({ zone: null, loaded: false, key: '' });
  const key = `${uid || ''}/${petId || ''}`;

  useEffect(() => {
    if (!uid || !petId) return undefined;
    return subscribeSafeZone(uid, petId, (zone) => setState({ zone, loaded: true, key }));
  }, [uid, petId, key]);

  if (state.key !== key) return { zone: null, loaded: false };
  return { zone: state.zone, loaded: state.loaded };
}
