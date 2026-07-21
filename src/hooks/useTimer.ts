// src/hooks/useTimer.ts
//
// View adapter for the global timerController. Each timer card calls
// useTimer(ownerKey) — the hook reports the global timer state only when
// this card owns it; otherwise the card sees 'idle' and renders its own
// prescription. remaining === null means "use your local duration".

import {useSyncExternalStore} from 'react';

import {getSnapshot, subscribe} from '../common/timerController';
import type {TimerStatus} from '../common/timerController';

export interface OwnedTimer {
  status: TimerStatus;
  remaining: number | null;
  target: number | null;
  isOwner: boolean;
}

export function useTimer(ownerKey: string): OwnedTimer {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const isOwner = snap.ownerKey === ownerKey;
  if (!isOwner || snap.status === 'idle') {
    return {status: 'idle', remaining: null, target: null, isOwner};
  }
  return {
    status: snap.status,
    remaining: snap.remaining,
    target: snap.target,
    isOwner,
  };
}
