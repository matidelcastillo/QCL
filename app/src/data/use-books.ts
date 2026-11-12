import { useQuery } from "@tanstack/react-query";
import { listBooks } from "./library";

export function useBooks(ownerId: string | undefined) {
  return useQuery({
    queryKey: ["books", ownerId],
    queryFn: () => listBooks(ownerId!),
    enabled: Boolean(ownerId),
  });
}
