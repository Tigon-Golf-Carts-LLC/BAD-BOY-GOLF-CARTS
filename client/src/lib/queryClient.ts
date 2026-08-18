import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { resolveStaticQuery } from "./static-data";

/**
 * There is no backend on GitHub Pages: query keys such as "/api/carts?..." are
 * resolved against the static JSON snapshot in /data instead of being fetched.
 */
export const staticQueryFn: QueryFunction = async ({ queryKey }) =>
  resolveStaticQuery(queryKey.join("/"));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: staticQueryFn,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
