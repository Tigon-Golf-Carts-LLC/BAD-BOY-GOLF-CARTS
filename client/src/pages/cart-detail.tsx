import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Phone, ChevronLeft, Zap, Fuel, Shield, Users, MapPin, Calendar, Gauge, Clock, Battery, Wrench, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Cart, Store } from "@shared/schema";
import { formatPrice, getAllCartImages, buildCartTitle, PHONE_NUMBER, PHONE_TEL, STATE_ABBREVIATIONS } from "@/lib/constants";
import { useState } from "react";

function SpecRow({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-muted-foreground flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

interface SlugMap {
  slugToId: Record<string, string>;
  idToSlug: Record<string, string>;
}

export default function CartDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [selectedImage, setSelectedImage] = useState(0);

  const { data: slugMap, isLoading: slugMapLoading } = useQuery<SlugMap>({
    queryKey: ["/api/slug-map"],
  });

  const cartId = slugMap?.slugToId[slug || ""] || slug || "";

  const { data: cart, isLoading: cartLoading, error } = useQuery<Cart>({
    queryKey: ["/api/cart", cartId],
    enabled: !!cartId && !slugMapLoading,
  });

  const isLoading = slugMapLoading || cartLoading;

  const { data: stores } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Skeleton className="h-6 w-32 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="aspect-[4/3] rounded-md" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !cart) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Cart Not Found</h1>
        <p className="text-muted-foreground mb-6">This vehicle may no longer be available.</p>
        <Link href="/inventory">
          <Button data-testid="button-back-inventory">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Inventory
          </Button>
        </Link>
      </div>
    );
  }

  const make = cart.cartType?.make || "";
  const model = cart.cartType?.model || "";
  const color = cart.cartAttributes?.cartColor || "";
  const title = buildCartTitle(make, model, color);
  const numericPrice = cart.retailPrice || 0;
  const price = formatPrice(numericPrice);
  const isUsed = cart.isUsed === true;
  const isElectric = cart.isElectric === true;
  const isStreetLegal = cart.title?.isStreetLegal === true;
  const year = cart.cartType?.year || "";
  const passengers = cart.cartAttributes?.passengers || "";
  const images = getAllCartImages(cart.imageUrls);

  const storeId = cart.cartLocation?.locationId;
  const store = stores?.find((s) => s.storeId === storeId);
  const locationStr = store
    ? `${store.address.city}, ${STATE_ABBREVIATIONS[store.address.state || ""] || store.address.state || ""}`
    : "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <Link href="/inventory">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Inventory
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-md bg-muted">
            <img
              src={images[selectedImage]}
              alt={title}
              className="w-full aspect-[4/3] object-cover"
              data-testid="img-cart-main"
            />
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              <Badge variant={isUsed ? "secondary" : "default"}>
                {isUsed ? "Used" : "New"}
              </Badge>
              {isStreetLegal && (
                <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
                  <Shield className="h-3 w-3 mr-1" />
                  Street Legal
                </Badge>
              )}
            </div>
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`shrink-0 w-20 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                    selectedImage === i ? "border-primary" : "border-transparent"
                  }`}
                  data-testid={`button-thumb-${i}`}
                >
                  <img src={img} alt={`${title} - ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            {year && <span className="text-sm text-muted-foreground">{year}</span>}
            <h1 className="hotrod-heading text-2xl sm:text-3xl mt-1" data-testid="text-cart-title">{title}</h1>
            {locationStr && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                <MapPin className="h-4 w-4 text-primary" />
                {locationStr}
                {store && <span>- {store.name}</span>}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {isElectric ? <Zap className="h-3 w-3 mr-1" /> : <Fuel className="h-3 w-3 mr-1" />}
              {isElectric ? "Electric" : "Gas"}
            </Badge>
            {passengers && (
              <Badge variant="outline">
                <Users className="h-3 w-3 mr-1" />
                {passengers}
              </Badge>
            )}
            {cart.cartAttributes?.driveTrain && (
              <Badge variant="outline">{cart.cartAttributes.driveTrain}</Badge>
            )}
            {cart.cartAttributes?.isLifted && (
              <Badge variant="outline">Lifted</Badge>
            )}
          </div>

          <div className="bg-primary/5 dark:bg-primary/10 rounded-md p-5 space-y-3">
            <p className="text-3xl font-bold text-primary" data-testid="text-cart-price">{price}</p>
            {numericPrice > 0 && (
              <div data-testid="text-financing-price">
                <p className="text-lg font-semibold">
                  As low as {formatPrice(numericPrice / 48)}/mo
                </p>
                <p className="text-sm text-muted-foreground">0% APR for 48 months</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <a href={PHONE_TEL} className="block">
              <Button className="w-full redline-glow" size="lg" data-testid="button-call-now">
                <Phone className="h-5 w-5 mr-2" />
                Call Now - {PHONE_NUMBER}
              </Button>
            </a>
            <Link href="/financing">
              <Button variant="outline" className="w-full" size="lg" data-testid="button-apply-now">
                Apply Now - 0% Financing
              </Button>
            </Link>
          </div>

          <Tabs defaultValue="specs" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="specs" className="flex-1" data-testid="tab-specs">Specifications</TabsTrigger>
              <TabsTrigger value="battery" className="flex-1" data-testid="tab-battery">
                {isElectric ? "Battery" : "Engine"}
              </TabsTrigger>
              <TabsTrigger value="details" className="flex-1" data-testid="tab-details">Details</TabsTrigger>
            </TabsList>

            <TabsContent value="specs" className="mt-4">
              <Card className="p-4">
                <div className="divide-y">
                  {make && <SpecRow label="Make" value={make} />}
                  {model && <SpecRow label="Model" value={model} />}
                  {year && <SpecRow label="Year" value={year} icon={Calendar} />}
                  {color && <SpecRow label="Color" value={color} />}
                  {cart.cartAttributes?.seatColor && (
                    <SpecRow label="Seat Color" value={cart.cartAttributes.seatColor} />
                  )}
                  {passengers && <SpecRow label="Passengers" value={passengers} icon={Users} />}
                  {cart.cartAttributes?.driveTrain && (
                    <SpecRow label="Drivetrain" value={cart.cartAttributes.driveTrain} />
                  )}
                  {cart.cartAttributes?.tireType && (
                    <SpecRow label="Tires" value={cart.cartAttributes.tireType} />
                  )}
                  {cart.cartAttributes?.tireRimSize && (
                    <SpecRow label="Rim Size" value={`${cart.cartAttributes.tireRimSize}"`} />
                  )}
                  {isStreetLegal && <SpecRow label="Street Legal" value="Yes" icon={Shield} />}
                  {cart.cartAttributes?.hasSoundSystem !== null && cart.cartAttributes?.hasSoundSystem !== undefined && (
                    <SpecRow label="Sound System" value={cart.cartAttributes.hasSoundSystem ? "Yes" : "No"} />
                  )}
                  {cart.cartAttributes?.isLifted !== null && cart.cartAttributes?.isLifted !== undefined && (
                    <SpecRow label="Lift Kit" value={cart.cartAttributes.isLifted ? "Yes" : "No"} />
                  )}
                  {cart.cartAttributes?.hasHitch !== null && cart.cartAttributes?.hasHitch !== undefined && (
                    <SpecRow label="Receiver Hitch" value={cart.cartAttributes.hasHitch ? "Yes" : "No"} />
                  )}
                  {cart.cartAttributes?.hasExtendedTop !== null && cart.cartAttributes?.hasExtendedTop !== undefined && (
                    <SpecRow label="Extended Top" value={cart.cartAttributes.hasExtendedTop ? "Yes" : "No"} />
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="battery" className="mt-4">
              <Card className="p-4">
                <div className="divide-y">
                  {isElectric && cart.battery ? (
                    <>
                      {cart.battery.type && <SpecRow label="Battery Type" value={cart.battery.type} icon={Battery} />}
                      {cart.battery.brand && <SpecRow label="Brand" value={cart.battery.brand} />}
                      {cart.battery.year && <SpecRow label="Battery Year" value={cart.battery.year} />}
                      {cart.battery.ampHours && <SpecRow label="Capacity" value={`${cart.battery.ampHours} Ah`} />}
                      {cart.battery.packVoltage && <SpecRow label="Pack Voltage" value={`${cart.battery.packVoltage}V`} />}
                      {cart.battery.batteryVoltage && <SpecRow label="Cell Voltage" value={`${cart.battery.batteryVoltage}V`} />}
                      {cart.battery.warrantyLength && <SpecRow label="Battery Warranty" value={cart.battery.warrantyLength} icon={Wrench} />}
                    </>
                  ) : cart.engine ? (
                    <>
                      {cart.engine.make && <SpecRow label="Engine" value={cart.engine.make} />}
                      {cart.engine.horsepower && <SpecRow label="Horsepower" value={`${cart.engine.horsepower} HP`} />}
                      {cart.engine.stroke && <SpecRow label="Stroke" value={cart.engine.stroke} />}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No {isElectric ? "battery" : "engine"} information available.
                    </p>
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              <Card className="p-4">
                <div className="divide-y">
                  <SpecRow label="Condition" value={isUsed ? "Used" : "New"} />
                  <SpecRow label="Power" value={isElectric ? "Electric" : "Gas"} icon={isElectric ? Zap : Fuel} />
                  {cart.vinNo && <SpecRow label="VIN" value={cart.vinNo} />}
                  {cart.serialNo && <SpecRow label="Serial Number" value={cart.serialNo} />}
                  {cart.odometer && <SpecRow label="Odometer" value={String(cart.odometer)} icon={Gauge} />}
                  {cart.hour && <SpecRow label="Hours" value={String(cart.hour)} icon={Clock} />}
                  {cart.warrantyLength && <SpecRow label="Warranty" value={cart.warrantyLength} icon={Wrench} />}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
