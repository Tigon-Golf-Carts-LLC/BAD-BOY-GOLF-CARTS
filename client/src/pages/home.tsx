import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Phone, ChevronRight, Tag, Shield, MapPin, Truck, Award, Headphones, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CartCard, CartCardSkeleton } from "@/components/cart-card";
import type { Store } from "@shared/schema";
import type { CartsResult } from "@/lib/static-data";
import { PHONE_NUMBER, PHONE_TEL } from "@/lib/constants";
import heroBg from "@assets/DISCOUNTED_GOLF_CARTS_DEALERSHIP_1770671250863.png";

interface SlugMap {
  slugToId: Record<string, string>;
  idToSlug: Record<string, string>;
}

export default function Home() {
  const { data: featured, isLoading: featuredLoading } = useQuery<CartsResult>({
    queryKey: ["/api/carts?pageNumber=0&pageSize=8"],
  });

  const { data: stores } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  const { data: brands } = useQuery<Array<{ key: string; label: string }>>({
    queryKey: ["/api/brands"],
  });

  const { data: slugMap } = useQuery<SlugMap>({
    queryKey: ["/api/slug-map"],
  });

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="Bad Boy Golf Carts Showroom" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-24 relative">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-6" data-testid="badge-hero-tag">
              <Tag className="h-3 w-3 mr-1" />
              Discounted Golf Cart Inventory
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6 text-white" data-testid="text-hero-title">
              Bad Boy Golf Carts
              <span className="text-green-400 block mt-1">Updated Daily</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/80 max-w-2xl mb-8 leading-relaxed" data-testid="text-hero-description">
              Browse our discounted inventory of new and used golf carts from top brands.
              Street legal, electric, gas, and more — updated every day with the best deals.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/inventory">
                <Button size="lg" data-testid="button-browse-inventory">
                  Browse Discounted Inventory
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <a href={PHONE_TEL}>
                <Button variant="outline" size="lg" className="backdrop-blur-sm bg-white/10 border-white/30 text-white" data-testid="button-hero-call">
                  <Phone className="h-4 w-4 mr-2" />
                  {PHONE_NUMBER}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 border-b">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: RefreshCw, label: "Updated Daily", desc: "Inventory refreshed at 10:55 PM EST" },
              { icon: Shield, label: "Warranty Included", desc: "Coverage on all carts" },
              { icon: Award, label: "Top Brands", desc: "Denago, Evolution & more" },
              { icon: Truck, label: "Nationwide Delivery", desc: "We ship across the US" },
            ].map((item) => (
              <div key={item.label} className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">{item.label}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {brands && brands.length > 0 && (
        <section className="py-12 border-b" data-testid="section-brands">
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold">Shop by Brand</h2>
                <p className="text-sm text-muted-foreground mt-1">Browse discounted golf carts from top manufacturers</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {brands.map((brand) => (
                <Link key={brand.key} href={`/inventory?make=${encodeURIComponent(brand.label)}`}>
                  <Button variant="outline" className="h-auto py-2.5 px-5" data-testid={`button-brand-${brand.key}`}>
                    {brand.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-12" data-testid="section-featured">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold">Latest Discounted Inventory</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {featured?.totalCarts
                  ? `${featured.totalCarts.toLocaleString()} discounted carts available`
                  : "Browse our discounted selection"}
              </p>
            </div>
            <Link href="/inventory">
              <Button variant="outline" data-testid="button-view-all">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {featuredLoading
              ? Array.from({ length: 8 }).map((_, i) => <CartCardSkeleton key={i} />)
              : featured?.carts.map((cart) => <CartCard key={cart._id} cart={cart} slug={slugMap?.idToSlug[cart._id]} />)}
          </div>
        </div>
      </section>

      {stores && stores.length > 0 && (
        <section className="py-12 border-t" data-testid="section-locations">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold">Our Locations</h2>
              <p className="text-sm text-muted-foreground mt-1">Visit us at one of our dealerships</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {stores.map((store) => (
                <Card key={store.storeId} className="p-4 hover-elevate" data-testid={`card-store-${store.storeId}`}>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm">{store.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {store.address.address1}
                        {store.address.address2 ? `, ${store.address.address2}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {store.address.city}, {store.address.state} {store.address.postalCode}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-16 bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Find Your Golf Cart?</h2>
          <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
            Our experts are standing by to help you find the perfect cart at the best price. Call now to learn about
            our current discounted inventory, pricing, and financing options.
          </p>
          <a href={PHONE_TEL}>
            <Button variant="secondary" size="lg" data-testid="button-cta-call">
              <Phone className="h-5 w-5 mr-2" />
              Call {PHONE_NUMBER}
            </Button>
          </a>
        </div>
      </section>
    </div>
  );
}
