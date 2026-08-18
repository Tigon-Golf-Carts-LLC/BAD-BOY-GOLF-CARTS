import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CartCard, CartCardSkeleton } from "@/components/cart-card";
import { InventoryFilters, defaultFilters, type FilterState } from "@/components/inventory-filters";
import type { CartsResult } from "@/lib/static-data";
import type { Store } from "@shared/schema";

interface SlugMap {
  slugToId: Record<string, string>;
  idToSlug: Record<string, string>;
}

const PAGE_SIZE = 20;

/**
 * Reads a filter state out of the URL. These are the facet URLs published in
 * the sitemaps and feeds (?make=, ?condition=, ?powerType=, ?seats=, ...), so
 * every indexed URL has to land on the inventory it advertises.
 */
function filtersFromParams(params: URLSearchParams): FilterState {
  const initial: FilterState = { ...defaultFilters };
  const list = (key: string) =>
    (params.get(key) || "").split(",").map((v) => v.trim()).filter(Boolean);
  const flag = (key: string) => params.get(key) === "true";

  if (flag("isNew")) initial.isNew = true;
  if (flag("isUsed")) initial.isUsed = true;
  if (flag("isElectric")) initial.isElectric = true;
  if (flag("isGas")) initial.isGas = true;
  if (flag("isStreetLegal")) initial.isStreetLegal = true;
  if (flag("isLifted")) initial.isLifted = true;

  const condition = (params.get("condition") || "").toLowerCase();
  if (condition === "new") initial.isNew = true;
  if (condition === "used") initial.isUsed = true;

  const power = (params.get("powerType") || "").toLowerCase();
  if (power === "electric") initial.isElectric = true;
  if (power === "gas") initial.isGas = true;

  initial.makes = [...list("make"), ...list("makes")];
  initial.models = [...list("model"), ...list("models")];
  initial.colors = [...list("color"), ...list("colors")];
  initial.seats = list("seats");
  initial.driveTrain = list("driveTrain");
  initial.searchText = params.get("search") || params.get("searchText") || "";

  return initial;
}

export default function Inventory() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);

  const locationParam = params.get("location") || "";

  const [filters, setFilters] = useState<FilterState>(() => filtersFromParams(params));

  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState(filters.searchText);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.searchText);

  // Re-read the URL when it changes under a mounted page (e.g. a brand link on
  // the home page navigating to /inventory?make=Denago).
  useEffect(() => {
    const next = filtersFromParams(new URLSearchParams(searchString));
    setFilters(next);
    setSearchInput(next.searchText);
    setDebouncedSearch(next.searchText);
    setPage(0);
  }, [searchString]);

  // ?location=<city> targets a store, which the snapshot only exposes by id.
  const { data: locationStores } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
    enabled: !!locationParam,
  });

  useEffect(() => {
    if (!locationParam || !locationStores) return;
    const storeIds = locationStores
      .filter((store) => (store.address?.city || "").toLowerCase() === locationParam.toLowerCase())
      .map((store) => store.storeId);
    if (storeIds.length === 0) return;
    setFilters((prev) =>
      prev.storeIds.length > 0 ? prev : { ...prev, storeIds },
    );
  }, [locationParam, locationStores]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (debouncedSearch !== filters.searchText) {
      setFilters((prev) => ({ ...prev, searchText: debouncedSearch }));
      setPage(0);
    }
  }, [debouncedSearch]);

  const buildQueryParams = useCallback(() => {
    const p = new URLSearchParams();
    p.set("pageNumber", String(page));
    p.set("pageSize", String(PAGE_SIZE));
    if (filters.searchText) p.set("searchText", filters.searchText);
    if (filters.priceSortASC !== null) p.set("priceSortASC", String(filters.priceSortASC));
    if (filters.isNew) p.set("isNew", "true");
    if (filters.isUsed) p.set("isUsed", "true");
    if (filters.isElectric) p.set("isElectric", "true");
    if (filters.isGas) p.set("isGas", "true");
    if (filters.isStreetLegal) p.set("isStreetLegal", "true");
    if (filters.isLifted) p.set("isLifted", "true");
    if (filters.makes.length > 0) p.set("makes", filters.makes.join(","));
    if (filters.models.length > 0) p.set("models", filters.models.join(","));
    if (filters.colors.length > 0) p.set("colors", filters.colors.join(","));
    if (filters.seats.length > 0) p.set("seats", filters.seats.join(","));
    if (filters.driveTrain.length > 0) p.set("driveTrain", filters.driveTrain.join(","));
    if (filters.storeIds.length > 0) p.set("storeIds", filters.storeIds.join(","));
    return p.toString();
  }, [page, filters]);

  const queryKey = `/api/carts?${buildQueryParams()}`;

  const { data, isLoading, isFetching } = useQuery<CartsResult>({
    queryKey: [queryKey],
    staleTime: 60_000,
  });

  const { data: slugMap } = useQuery<SlugMap>({
    queryKey: ["/api/slug-map"],
  });

  const totalPages = data ? Math.ceil(data.totalCarts / PAGE_SIZE) : 0;

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(0);
  };

  const handleSortChange = (value: string) => {
    if (value === "default") {
      setFilters((prev) => ({ ...prev, priceSortASC: null }));
    } else if (value === "low") {
      setFilters((prev) => ({ ...prev, priceSortASC: true }));
    } else if (value === "high") {
      setFilters((prev) => ({ ...prev, priceSortASC: false }));
    }
    setPage(0);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="hotrod-heading text-2xl" data-testid="text-inventory-title">
          Golf Cart Inventory
        </h1>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-inventory-count">
          {data ? `${data.totalCarts.toLocaleString()} discounted vehicles found` : "Loading discounted inventory..."}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by make, model, color..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="lg:hidden">
            <InventoryFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              totalCarts={data?.totalCarts || 0}
            />
          </div>
          <Select
            value={filters.priceSortASC === null ? "default" : filters.priceSortASC ? "low" : "high"}
            onValueChange={handleSortChange}
          >
            <SelectTrigger className="w-[160px]" data-testid="select-sort">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Latest</SelectItem>
              <SelectItem value="low">Price: Low to High</SelectItem>
              <SelectItem value="high">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-6">
        <InventoryFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          totalCarts={data?.totalCarts || 0}
        />

        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <CartCardSkeleton key={i} />
              ))}
            </div>
          ) : data?.carts && data.carts.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="grid-inventory">
                {data.carts.map((cart) => (
                  <CartCard key={cart._id} cart={cart} slug={slugMap?.idToSlug[cart._id]} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8" data-testid="pagination">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                      let pageNum: number;
                      if (totalPages <= 7) {
                        pageNum = i;
                      } else if (page < 4) {
                        pageNum = i;
                      } else if (page > totalPages - 4) {
                        pageNum = totalPages - 7 + i;
                      } else {
                        pageNum = page - 3 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                          data-testid={`button-page-${pageNum}`}
                          className="w-9"
                        >
                          {pageNum + 1}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-md bg-muted mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="text-no-results">No carts found</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Try adjusting your filters or search terms to find what you're looking for.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
