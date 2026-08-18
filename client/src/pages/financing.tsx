import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, ArrowRight, CreditCard, DollarSign, Shield, Clock } from "lucide-react";

const financingPartners = [
  {
    name: "Sheffield BBT",
    heading: "Prequalify Now!",
    description: "Get prequalified with no impact to your credit.*",
    url: "https://prequalify.sheffieldfinancial.com/Apply/Dealer/56712?source=web",
    imageUrl: "https://tigongolfcarts.com/wp-content/uploads/2024/08/Sheffield-BBT-And-TIGON-Golf-Carts.jpg",
  },
  {
    name: "BLI Heartland",
    heading: "Rent To Own",
    description: "Helping Golf Cart Customers Achieve Ownership.*",
    url: "https://blirentals.com/app/TIGON_GOLFCARTS_LLC",
    imageUrl: "https://tigongolfcarts.com/wp-content/uploads/2024/08/RENT-TO-OWN-Golf-Carts-BLI-Heartland-And-TIGON-Golf-Carts.jpg",
  },
  {
    name: "DLL Financial Solutions",
    heading: "DLL Financial Solutions",
    description: "Get the lowest APR without hidden fees.*",
    url: "https://applynow-cica-prd.dllgroup.com/?entityId=4&dealerCode=015639",
    imageUrl: "https://tigongolfcarts.com/wp-content/uploads/2024/08/DLL-Financial-Solutions-And-TIGON-Golf-Carts.jpg",
  },
  {
    name: "Roadrunner / Octane",
    heading: "Consumer Financing",
    description: "Get Ready To Ride With Consumer Financing.",
    url: "https://octane.co/flex/034170",
    imageUrl: "https://tigongolfcarts.com/wp-content/uploads/2024/08/Roadrunner-Financial-Octane-And-Tigon-Golf-Carts-1.jpg",
  },
  {
    name: "Univest Capital",
    heading: "Univest Capital",
    description: "Customized a solution for your specific business needs.",
    url: "https://form.jotform.com/UnivestCapital/credit-application-bakos?utm_source=TIGON+Golf+Carts&utm_medium=Financing&utm_campaign=Business&utm_term=Best+Golf+Cart+Financing",
    imageUrl: "https://tigongolfcarts.com/wp-content/uploads/2025/04/Univest-capital-2.jpg",
  },
  {
    name: "Dealer Direct",
    heading: "Dealer Direct Financing",
    description: "Buy Now, Pay Later With Dealer Direct Financing.*",
    url: "https://dealerdirect.apptraker.com/my/guest?dealer=10735",
    imageUrl: "https://tigongolfcarts.com/wp-content/uploads/2024/11/trio-capital-leanding-And-TIGON-Golf-Carts.jpg",
  },
];

const benefits = [
  {
    icon: CreditCard,
    title: "Flexible Options",
    description: "Multiple financing plans to fit every budget and lifestyle.",
  },
  {
    icon: Clock,
    title: "Quick Approval",
    description: "Fast application process with decisions in minutes.",
  },
  {
    icon: DollarSign,
    title: "Competitive Rates",
    description: "Low monthly payments and competitive interest rates.",
  },
  {
    icon: Shield,
    title: "No Hidden Fees",
    description: "Transparent terms with no surprise charges.",
  },
];

export default function Financing() {
  return (
    <div className="min-h-screen">
      <section className="relative py-16 md:py-24 bg-card">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6"
            data-testid="text-financing-title"
          >
            Apply For Street Legal LSV, NEV &<br className="hidden sm:block" />
            Golf Cart Financing
          </h1>
          <p
            className="text-muted-foreground text-base md:text-lg max-w-3xl mx-auto leading-relaxed"
            data-testid="text-financing-intro"
          >
            At Bad Boy Golf Carts, we understand that financing your purchase is an important aspect of the buying process.
            That's why we offer flexible financing options to suit every budget. Whether you're looking for low monthly
            payments or competitive interest rates, our financing team is here to help you find the best plan for your
            needs. We make the application process straightforward and hassle-free, ensuring you can drive away in your
            new or used golf cart, LSV, or NEV without delay.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="text-center p-6"
                data-testid={`benefit-${benefit.title.toLowerCase().replace(/\s/g, "-")}`}
              >
                <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-12 md:pb-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2
            className="text-2xl md:text-3xl font-bold text-center mb-10"
            data-testid="text-partners-heading"
          >
            Our Financing Partners
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {financingPartners.map((partner) => (
              <Card
                key={partner.name}
                className="overflow-visible flex flex-col"
                data-testid={`card-partner-${partner.name.toLowerCase().replace(/[\s\/]/g, "-")}`}
              >
                <a
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={partner.imageUrl}
                    alt={partner.name}
                    className="w-full h-48 object-cover rounded-t-md"
                    loading="lazy"
                  />
                </a>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-lg font-semibold mb-1" data-testid={`text-partner-name-${partner.name.toLowerCase().replace(/[\s\/]/g, "-")}`}>
                    {partner.heading}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    {partner.description}
                  </p>
                  <a
                    href={partner.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button className="w-full" data-testid={`button-apply-${partner.name.toLowerCase().replace(/[\s\/]/g, "-")}`}>
                      Quick Apply
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-card">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4" data-testid="text-cta-heading">
            Apply For Street Legal LSV, NEV & Golf Cart Financing
          </h2>
          <p className="text-muted-foreground mb-6">
            To find out which financing company is best for you, or for more information,
            please call the office.
          </p>
          <a href="tel:1-888-840-4490">
            <Button size="lg" data-testid="button-call-financing">
              <Phone className="w-5 h-5 mr-2" />
              1-888-840-4490
            </Button>
          </a>
        </div>
      </section>
    </div>
  );
}
