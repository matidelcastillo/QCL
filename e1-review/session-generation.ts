/** Prevents a response from one auth epoch from publishing into another. */
export function createSessionGeneration() {
  let generation = 0;
  let owner: string | null = null;

  return {
    change(nextOwner: string | null) {
      owner = nextOwner;
      generation += 1;
    },
    capture() {
      const capturedOwner = owner;
      const capturedGeneration = generation;
      return () =>
        capturedOwner !== null &&
        owner === capturedOwner &&
        generation === capturedGeneration;
    },
  };
}
