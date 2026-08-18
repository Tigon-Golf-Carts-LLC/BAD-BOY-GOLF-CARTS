import { Link } from "wouter";
import { Phone, Zap, Fuel, Shield, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Cart } from "@shared/schema";
import { formatPrice, getCartImageUrl, buildCartTitle, PHONE_TEL } from "@/lib/constants";
import { useState } from "react";

interface CartCardProps {
  cart: Cart;
  slug?: string;
}

export function CartCard({ cart, slug }: CartCardProps) {
  const [imageError, setImageError] = useState(false);
  const make = cart.cartType?.make || "";
  const model = cart.cartType?.model || "";
  const color = cart.cartAttributes?.cartColor || "";
  const title = buildCartTitle(make, model, color);
  const price = formatPrice(cart.retailPrice);
  const isUsed = cart.isUsed === true;
  const isElectric = cart.isElectric === true;
  const isStreetLegal = cart.title?.isStreetLegal === true;
  const passengers = cart.cartAttributes?.passengers || "";

  const imageUrl = imageError
    ? "https://tigongolfcarts.com/wp-content/uploads/2024/11/TIGON-GOLF-CARTS-IMAGES-COMING-SOON.jpg"
    : getCartImageUrl(cart.imageUrls);

  const cartUrl = slug ? `/golfcart/${slug}` : `/golfcart/${cart._id}`;

  return (
    <Card className="overflow-visible group hover-elevate" data-testid={`card-cart-${cart._id}`}>
      <Link href={cartUrl}>
        <div className="relative overflow-hidden rounded-t-md">
          <img
            src={imageUrl}
            alt={title}
            className="w-full aspect-[4/3] object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageError(true)}
            data-testid={`img-cart-${cart._id}`}
          />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <Badge variant={isUsed ? "secondary" : "default"} data-testid={`badge-condition-${cart._id}`}>
              {isUsed ? "Used" : "New"}
            </Badge>
            {isStreetLegal && (
              <Badge variant="outline" className="bg-background/80 backdrop-blur-sm" data-testid={`badge-street-legal-${cart._id}`}>
                <Shield className="h-3 w-3 mr-1" />
                Street Legal
              </Badge>
            )}
          </div>
          <div className="absolute top-3 right-3">
            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
              {isElectric ? <Zap className="h-3 w-3 mr-1" /> : <Fuel className="h-3 w-3 mr-1" />}
              {isElectric ? "Electric" : "Gas"}
            </Badge>
          </div>
        </div>
      </Link>

      <div className="p-4 space-y-3">
        <Link href={cartUrl}>
          <h3 className="hotrod-heading text-sm leading-tight line-clamp-2 hover:text-primary transition-colors" data-testid={`text-title-${cart._id}`}>
            {title}
          </h3>
        </Link>

        {(cart.cartType?.year || passengers) && (
          <div className="flex flex-wrap items-center gap-2">
            {cart.cartType?.year && (
              <span className="text-xs text-muted-foreground">{cart.cartType.year}</span>
            )}
            {passengers && (
              <span className="inline-flex items-center text-xs text-muted-foreground">
                <Users className="h-3 w-3 mr-1" />
                {passengers}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-lg font-bold text-primary" data-testid={`text-price-${cart._id}`}>
            {price}
          </p>
          <a href={PHONE_TEL}>
            <Button size="sm" data-testid={`button-call-${cart._id}`}>
              <Phone className="h-3.5 w-3.5 mr-1.5" />
              Call Now
            </Button>
          </a>
        </div>
      </div>
    </Card>
  );
}

export function CartCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="w-full aspect-[4/3]" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </Card>
  );
}
