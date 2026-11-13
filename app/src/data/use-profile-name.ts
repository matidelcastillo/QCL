import { useQuery } from "@tanstack/react-query";
import { profileName } from "./library";

export function useProfileName(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () => profileName(userId!),
    enabled: Boolean(userId),
  });
}
