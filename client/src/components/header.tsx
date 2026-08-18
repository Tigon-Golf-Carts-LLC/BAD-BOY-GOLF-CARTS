import { Link, useLocation } from "wouter";
import { Phone, Menu, X, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { PHONE_NUMBER, PHONE_TEL } from "@/lib/constants";
import { useState } from "react";
import logoImg from "@assets/DISCOUNTED_GOLF_CARTS_(2)_1770670989091.png";

export function Header() {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/inventory", label: "Inventory" },
    { href: "/inventory?isNew=true", label: "New Carts" },
    { href: "/inventory?isUsed=true", label: "Used Carts" },
    { href: "/financing", label: "Financing" },
  ];

  return (
    <header className="sticky top-0 z-[100] border-b bg-background/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" data-testid="link-home">
            <div className="flex items-center gap-2">
              <img src={logoImg} alt="Bad Boy Golf Carts" className="h-10 w-10 object-contain" />
              <span className="text-xl font-bold tracking-tight">
                Bad Boy <span className="text-primary">Golf Carts</span>
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1" data-testid="nav-desktop">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={location === link.href ? "secondary" : "ghost"}
                  size="sm"
                  data-testid={`nav-${link.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <a href={PHONE_TEL} className="hidden sm:block">
              <Button data-testid="button-call-header">
                <Phone className="h-4 w-4 mr-2" />
                {PHONE_NUMBER}
              </Button>
            </a>
            <a href={PHONE_TEL} className="sm:hidden">
              <Button size="icon" data-testid="button-call-header-mobile">
                <Phone className="h-4 w-4" />
              </Button>
            </a>

            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background" data-testid="nav-mobile">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={location === link.href ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid={`nav-mobile-${link.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  {link.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
