import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth.js";
import { useServices } from "../contexts/ServicesContext.jsx";

export function useUser() {
  const { userService } = useServices();
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ["me"],
    queryFn: userService.getMe,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10,
  });
}
