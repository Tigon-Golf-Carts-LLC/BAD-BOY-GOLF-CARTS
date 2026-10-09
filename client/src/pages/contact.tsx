import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LeadForm } from "@/components/lead-form";
import { PHONE_NUMBER, PHONE_TEL } from "@/lib/constants";
import type { Store } from "@shared/schema";

export default function Contact() {
  const { data: stores } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  return (
    <div className="min-h-screen">
      <section className="relative py-12 md:py-16 bg-card">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="hotrod-heading text-3xl md:text-4xl lg:text-5xl mb-4" data-testid="text-contact-title">
            Contact <span className="text-primary">Bad Boy Golf Carts</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-3xl mx-auto leading-relaxed">
            Questions about a cart, pricing, trade-ins or financing? Send us a message and our team will get back to
            you shortly, or call us for an instant answer.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-xl font-bold mb-1">Send Us a Message</h2>
            <p className="text-sm text-muted-foreground mb-6">Fields marked * are required.</p>
            <LeadForm idPrefix="contact-lead" />
          </Card>

          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="font-semibold mb-3">Call Us</h2>
              <a href={PHONE_TEL} className="block">
                <Button size="lg" className="w-full redline-glow" data-testid="button-call-contact">
                  <Phone className="h-5 w-5 mr-2" />
                  {PHONE_NUMBER}
                </Button>
              </a>
              <p className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
                <Clock className="h-4 w-4 text-primary" />
                Our experts are standing by to help.
              </p>
            </Card>

            {stores && stores.length > 0 && (
              <Card className="p-6">
                <h2 className="font-semibold mb-3">Locations</h2>
                <div className="space-y-2">
                  {stores.map((store) => (
                    <div key={store.storeId} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                      <span>
                        {store.address.city}, {store.address.state}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
