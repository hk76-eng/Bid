import { MotorideRide, MotorideRideStatus } from '../types/motoride';

/**
 * MotoRide Canonical Ride Status State Machine
 *
 * Strict Canonical Lifecycle:
 * requested (1) → accepted (2) → captain_arrived (3) → in_progress (4) → completed (5)
 * Terminal: cancelled (99)
 *
 * Status can NEVER move backward to an earlier status.
 */

export const CANONICAL_STATUSES = [
  'requested',
  'captain_offered',
  'accepted',
  'captain_arrived',
  'in_progress',
  'completed',
  'cancelled',
] as const;

export type CanonicalRideStatus = typeof CANONICAL_STATUSES[number];

export const STATUS_RANK: Record<string, number> = {
  // Rank 1: requested / searching / captain_offered (negotiation & search phase)
  requested: 1,
  searching: 1,
  captain_offered: 1,

  // Rank 2: captain accepted
  accepted: 2,
  captain_accepted: 2,
  captain_assigned: 2,
  captain_arriving: 2,

  // Rank 3: captain arrived at pickup location
  captain_arrived: 3,
  arrived: 3,

  // Rank 4: trip started / in progress
  in_progress: 4,
  trip_started: 4,

  // Rank 5: trip completed
  completed: 5,
  trip_completed: 5,

  // Terminal: Cancelled (Rank 99)
  cancelled: 99,
  cancelled_by_passenger: 99,
  cancelled_by_captain: 99,
};

/**
 * Normalize any status (canonical or legacy alias) to its canonical name.
 */
export function toCanonicalStatus(status: string | null | undefined): MotorideRideStatus {
  if (!status) return 'requested';
  const s = status.trim().toLowerCase();
  if (s === 'requested' || s === 'searching') return 'requested';
  if (s === 'captain_offered') return 'captain_offered';
  if (
    s === 'accepted' ||
    s === 'captain_accepted' ||
    s === 'captain_assigned' ||
    s === 'captain_arriving'
  ) {
    return 'accepted';
  }
  if (s === 'captain_arrived' || s === 'arrived') return 'captain_arrived';
  if (s === 'in_progress' || s === 'trip_started') return 'in_progress';
  if (s === 'completed' || s === 'trip_completed') return 'completed';
  if (s.startsWith('cancelled')) {
    if (s === 'cancelled_by_passenger' || s === 'cancelled_by_captain') return s as MotorideRideStatus;
    return 'cancelled';
  }
  return status as MotorideRideStatus;
}

/**
 * Get the numerical lifecycle rank of a ride status.
 */
export function getStatusRank(status: string | null | undefined): number {
  if (!status) return 0;
  return STATUS_RANK[status.trim().toLowerCase()] ?? 0;
}

/**
 * Validates whether transitioning from `currentStatus` to `nextStatus` is permitted.
 * Status can ONLY advance forward in lifecycle or be cancelled prior to completion.
 */
export function canTransitionStatus(
  currentStatus: string | null | undefined,
  nextStatus: string | null | undefined
): boolean {
  if (!nextStatus) return false;
  if (!currentStatus) return true;

  const currentRank = getStatusRank(currentStatus);
  const nextRank = getStatusRank(nextStatus);

  // If already terminal (completed rank 5 or cancelled rank 99), reject all transitions
  if (currentRank >= 5) {
    return false;
  }

  // Cancellation (rank 99) is allowed from any active pre-completion phase
  if (nextRank === 99) {
    return currentRank < 5;
  }

  // Idempotent transition to same rank (e.g. accepted -> accepted) is permitted
  if (nextRank === currentRank) {
    return true;
  }

  // Forward-only progression: nextRank must be strictly greater than currentRank
  return nextRank > currentRank;
}

/**
 * Checks whether an incoming status (from Supabase Realtime, SSE, or poll) should be applied over the current status.
 * Rejects stale, out-of-order, or backwards events.
 */
export function shouldApplyIncomingStatus(
  currentStatus: string | null | undefined,
  incomingStatus: string | null | undefined
): boolean {
  if (!incomingStatus) return false;
  if (!currentStatus) return true;

  const currentRank = getStatusRank(currentStatus);
  const incomingRank = getStatusRank(incomingStatus);

  // Once terminal (completed rank 5, cancelled rank 99), NEVER allow an earlier status
  if (currentRank >= 5 && incomingRank < currentRank) {
    return false;
  }

  // Allow bidirectional updates between requested and captain_offered during bidding phase
  const curCanonical = toCanonicalStatus(currentStatus);
  const inCanonical = toCanonicalStatus(incomingStatus);
  if (
    (curCanonical === 'requested' && inCanonical === 'captain_offered') ||
    (curCanonical === 'captain_offered' && inCanonical === 'requested')
  ) {
    return true;
  }

  // Stale backwards status: ignore
  if (incomingRank < currentRank) {
    return false;
  }

  return true;
}

/**
 * Resolves the authoritative state when merging two ride representations.
 * Guarantees that the higher rank status always wins, canonical names are preferred, and terminal states are locked.
 */
export function resolveAuthoritativeRide(
  current: MotorideRide | null | undefined,
  incoming: MotorideRide | null | undefined
): MotorideRide {
  if (!current) {
    if (!incoming) return {} as MotorideRide;
    return {
      ...incoming,
      status: toCanonicalStatus(incoming.status),
    };
  }
  if (!incoming) {
    return {
      ...current,
      status: toCanonicalStatus(current.status),
    };
  }

  const currentRank = getStatusRank(current.status);
  const incomingRank = getStatusRank(incoming.status);

  // Determine authoritative status
  let finalStatus = current.status;
  if (incomingRank > currentRank) {
    finalStatus = incoming.status;
  } else if (incomingRank === currentRank) {
    // If same rank, prefer canonical status
    const inCanonical = toCanonicalStatus(incoming.status);
    if (incoming.status === inCanonical) {
      finalStatus = incoming.status;
    } else {
      const curTime = new Date(current.updated_at || 0).getTime();
      const inTime = new Date(incoming.updated_at || 0).getTime();
      finalStatus = inTime >= curTime ? incoming.status : current.status;
    }
  } else {
    // incomingRank < currentRank: STALE EVENT! Retain current status!
    finalStatus = current.status;
  }

  // Terminal states guard: once completed (rank 5) or cancelled (rank 99), NEVER revert
  if (currentRank >= 5 && incomingRank < currentRank) {
    finalStatus = current.status;
  }

  const canonicalFinalStatus = toCanonicalStatus(finalStatus);

  // Base merge order depends on which record is newer in the state machine
  const baseRide =
    incomingRank > currentRank
      ? { ...current, ...incoming }
      : incomingRank < currentRank
      ? { ...incoming, ...current }
      : new Date(incoming.updated_at || 0).getTime() >= new Date(current.updated_at || 0).getTime()
      ? { ...current, ...incoming }
      : { ...incoming, ...current };

  const finalRide: MotorideRide = {
    ...baseRide,
    id: current.id || incoming.id,
    status: canonicalFinalStatus,
    updated_at: new Date(
      Math.max(
        new Date(current.updated_at || 0).getTime(),
        new Date(incoming.updated_at || 0).getTime(),
        Date.now()
      )
    ).toISOString(),
  };

  // Ensure timestamps are preserved
  if (current.trip_started_at || incoming.trip_started_at) {
    finalRide.trip_started_at = current.trip_started_at || incoming.trip_started_at;
  }
  if (current.trip_completed_at || incoming.trip_completed_at) {
    finalRide.trip_completed_at = current.trip_completed_at || incoming.trip_completed_at;
  }
  if ((current as any).completed_at || (incoming as any).completed_at) {
    (finalRide as any).completed_at = (current as any).completed_at || (incoming as any).completed_at;
  }

  // Ensure captain offers are merged and never lost when merging state
  const mergedOffersMap = new Map<string, any>();
  if (Array.isArray(current.offers)) {
    current.offers.forEach((o) => {
      if (o && (o.id || o.captain_id)) mergedOffersMap.set(o.id || o.captain_id, o);
    });
  }
  if (Array.isArray(incoming.offers)) {
    incoming.offers.forEach((o) => {
      if (o && (o.id || o.captain_id)) {
        const key = o.id || o.captain_id;
        mergedOffersMap.set(key, { ...(mergedOffersMap.get(key) || {}), ...o });
      }
    });
  }
  if (mergedOffersMap.size > 0) {
    finalRide.offers = Array.from(mergedOffersMap.values());
  }

  return finalRide;
}
