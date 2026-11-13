let epoch = 0;
let currentUserId: string | null = null;

export function updateSessionUser(next: string | null) {
  if (currentUserId !== next) {
    currentUserId = next;
    epoch++;
  }
}

export function sessionEpoch() {
  return epoch;
}
