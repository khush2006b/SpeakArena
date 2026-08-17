"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

import { ROUTES } from "@/constants/routes";

const NAV_LINKS = [
  { href: ROUTES.STUDENT.COURSES, label: "Courses" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function DesktopNav() {
  const pathname = usePathname();
  const [hoveredPath, setHoveredPath] = React.useState<string | null>(null);

  return (
    <nav 
      className="hidden md:flex items-center gap-1" 
      aria-label="Main navigation"
      onMouseLeave={() => setHoveredPath(null)}
    >
      {NAV_LINKS.map((link) => {
        const isActive = pathname?.startsWith(link.href);
        const isHovered = hoveredPath === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            onMouseEnter={() => setHoveredPath(link.href)}
            className={cn(
              "relative px-3 py-1.5 text-sm font-medium transition-colors rounded-md",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {link.label}
            {isHovered && (
              <motion.div
                layoutId="nav-hover-bg"
                className="absolute inset-0 -z-10 rounded-md bg-accent/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
            {isActive && !isHovered && (
              <motion.div
                layoutId="nav-active-indicator"
                className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary rounded-full"
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
