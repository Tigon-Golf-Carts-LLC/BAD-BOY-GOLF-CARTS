import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Store, CartModel } from "@shared/schema";
import { STATE_ABBREVIATIONS } from "@/lib/constants";
import { getColors, getModels } from "@/lib/static-data";

export interface FilterState {
  searchText: string;
  isNew: boolean;
  isUsed: boolean;
  isElectric: boolean;
  isGas: boolean;
  isStreetLegal: boolean;
  isLifted: boolean;
  makes: string[];
  models: string[];
  colors: string[];
  storeIds: string[];
  seats: string[];
  driveTrain: string[];
  priceSortASC: boolean | null;
}

export const defaultFilters: FilterState = {
  searchText: "",
  isNew: false,
  isUsed: false,
  isElectric: false,
  isGas: false,
  isStreetLegal: false,
  isLifted: false,
  makes: [],
  models: [],
  colors: [],
  storeIds: [],
  seats: [],
  driveTrain: [],
  priceSortASC: null,
};

interface InventoryFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  totalCarts: number;
}

interface BrandItem {
  key: string;
  label: string;
}

const SEAT_OPTIONS = ["2 Passenger", "4 Passenger", "6 Passenger", "8 Passenger"];
const DRIVETRAIN_OPTIONS = ["2X4", "4X4"];

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-2 text-sm font-semibold"
        data-testid={`filter-toggle-${title.toLowerCase().replace(/\s/g, "-")}`}
      >
        {title}
        <span className="text-muted-foreground text-xs">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="pb-3 space-y-2">{children}</div>}
    </div>
  );
}

function CheckboxItem({
  label,
  checked,
  onCheckedChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  testId: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} data-testid={testId} />
      <span>{label}</span>
    </label>
  );
}

function FilterContent({ filters, onFiltersChange, totalCarts }: InventoryFiltersProps) {
  const { data: stores } = useQuery<Store[]>({ queryKey: ["/api/stores"] });
  const { data: brands } = useQuery<BrandItem[]>({ queryKey: ["/api/brands"] });

  const [models, setModels] = useState<CartModel[]>([]);
  const [colors, setColors] = useState<string[]>([]);

  const selectedMakeKeys = filters.makes.map((m) => {
    const found = brands?.find((b) => b.label === m);
    return found ? found.key : m.toLowerCase().replace(/[^a-z0-9]/g, "_");
  });

  useEffect(() => {
    if (selectedMakeKeys.length === 0) {
      setModels([]);
      setColors([]);
      return;
    }
    getModels(selectedMakeKeys)
      .then(setModels)
      .catch(() => setModels([]));

    getColors(selectedMakeKeys)
      .then(setColors)
      .catch(() => setColors([]));
  }, [filters.makes.join(",")]);

  const update = useCallback(
    (partial: Partial<FilterState>) => {
      onFiltersChange({ ...filters, ...partial });
    },
    [filters, onFiltersChange]
  );

  const toggleArray = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const activeCount =
    (filters.isNew ? 1 : 0) +
    (filters.isUsed ? 1 : 0) +
    (filters.isElectric ? 1 : 0) +
    (filters.isGas ? 1 : 0) +
    (filters.isStreetLegal ? 1 : 0) +
    (filters.isLifted ? 1 : 0) +
    filters.makes.length +
    filters.models.length +
    filters.colors.length +
    filters.storeIds.length +
    filters.seats.length +
    filters.driveTrain.length;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 mb-3">
        <h2 className="font-bold text-base">Filters</h2>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFiltersChange({ ...defaultFilters, searchText: filters.searchText })}
            data-testid="button-reset-filters"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset ({activeCount})
          </Button>
        )}
      </div>

      <FilterSection title="Condition">
        <CheckboxItem label="New" checked={filters.isNew} onCheckedChange={(c) => update({ isNew: !!c })} testId="filter-new" />
        <CheckboxItem label="Used" checked={filters.isUsed} onCheckedChange={(c) => update({ isUsed: !!c })} testId="filter-used" />
      </FilterSection>
      <Separator />

      <FilterSection title="Power Type">
        <CheckboxItem label="Electric" checked={filters.isElectric} onCheckedChange={(c) => update({ isElectric: !!c })} testId="filter-electric" />
        <CheckboxItem label="Gas" checked={filters.isGas} onCheckedChange={(c) => update({ isGas: !!c })} testId="filter-gas" />
      </FilterSection>
      <Separator />

      <FilterSection title="Features">
        <CheckboxItem label="Street Legal" checked={filters.isStreetLegal} onCheckedChange={(c) => update({ isStreetLegal: !!c })} testId="filter-street-legal" />
        <CheckboxItem label="Lifted" checked={filters.isLifted} onCheckedChange={(c) => update({ isLifted: !!c })} testId="filter-lifted" />
      </FilterSection>
      <Separator />

      <FilterSection title="Brand">
        {brands && brands.length > 0 ? (
          brands.map((m) => (
            <CheckboxItem
              key={m.key}
              label={m.label}
              checked={filters.makes.includes(m.label)}
              onCheckedChange={() => update({ makes: toggleArray(filters.makes, m.label) })}
              testId={`filter-make-${m.key}`}
            />
          ))
        ) : (
          <p className="text-xs text-muted-foreground py-1">Loading brands...</p>
        )}
      </FilterSection>
      <Separator />

      {models.length > 0 && (
        <>
          <FilterSection title="Model">
            {models.map((m) => (
              <CheckboxItem
                key={m._id}
                label={m.label}
                checked={filters.models.includes(m.label)}
                onCheckedChange={() => update({ models: toggleArray(filters.models, m.label) })}
                testId={`filter-model-${m.key || m._id}`}
              />
            ))}
          </FilterSection>
          <Separator />
        </>
      )}

      {colors.length > 0 && (
        <>
          <FilterSection title="Color">
            {colors.map((c) => (
              <CheckboxItem
                key={c}
                label={c}
                checked={filters.colors.includes(c)}
                onCheckedChange={() => update({ colors: toggleArray(filters.colors, c) })}
                testId={`filter-color-${c.toLowerCase().replace(/\s/g, "-")}`}
              />
            ))}
          </FilterSection>
          <Separator />
        </>
      )}

      <FilterSection title="Seating">
        {SEAT_OPTIONS.map((s) => (
          <CheckboxItem
            key={s}
            label={s}
            checked={filters.seats.includes(s)}
            onCheckedChange={() => update({ seats: toggleArray(filters.seats, s) })}
            testId={`filter-seats-${s.split(" ")[0]}`}
          />
        ))}
      </FilterSection>
      <Separator />

      <FilterSection title="Drivetrain">
        {DRIVETRAIN_OPTIONS.map((d) => (
          <CheckboxItem
            key={d}
            label={d}
            checked={filters.driveTrain.includes(d)}
            onCheckedChange={() => update({ driveTrain: toggleArray(filters.driveTrain, d) })}
            testId={`filter-drive-${d.toLowerCase()}`}
          />
        ))}
      </FilterSection>
      <Separator />

      {stores && stores.length > 0 && (
        <FilterSection title="Location">
          {stores.map((store) => (
            <CheckboxItem
              key={store.storeId}
              label={`${store.address.city || ""}, ${STATE_ABBREVIATIONS[store.address.state || ""] || store.address.state || ""}`}
              checked={filters.storeIds.includes(store.storeId)}
              onCheckedChange={() => update({ storeIds: toggleArray(filters.storeIds, store.storeId) })}
              testId={`filter-store-${store.storeId}`}
            />
          ))}
        </FilterSection>
      )}
    </div>
  );
}

export function InventoryFilters({ filters, onFiltersChange, totalCarts }: InventoryFiltersProps) {
  const activeCount =
    (filters.isNew ? 1 : 0) +
    (filters.isUsed ? 1 : 0) +
    (filters.isElectric ? 1 : 0) +
    (filters.isGas ? 1 : 0) +
    (filters.isStreetLegal ? 1 : 0) +
    (filters.isLifted ? 1 : 0) +
    filters.makes.length +
    filters.models.length +
    filters.colors.length +
    filters.storeIds.length +
    filters.seats.length +
    filters.driveTrain.length;

  return (
    <>
      <div className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-20">
          <ScrollArea className="h-[calc(100vh-6rem)]">
            <div className="pr-4">
              <FilterContent filters={filters} onFiltersChange={onFiltersChange} totalCarts={totalCarts} />
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-open-filters">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
              {activeCount > 0 && (
                <Badge variant="default" className="ml-2">{activeCount}</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="px-4 pt-4 pb-2">
              <SheetTitle>Filter Inventory</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-4rem)] px-4 pb-4">
              <FilterContent filters={filters} onFiltersChange={onFiltersChange} totalCarts={totalCarts} />
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
