"use client";

import Link from "next/link";
import { Instagram, Twitter, Linkedin, Youtube } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="w-full bg-card border-t border-white/[0.07] text-zinc-300">
      <div className="w-full px-6 sm:px-12 lg:px-20 py-12">

        {/* 6-column layout matching screenshot */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8">

          {/* About Us */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">About Us</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">Our Story</Link></li>
            </ul>
          </div>

          {/* Careers */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">Careers</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/careers" className="hover:text-white transition-colors">Community</Link></li>
              <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
            </ul>
          </div>

          {/* Blog */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">Blog</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              <li><Link href="/blog" className="hover:text-white transition-colors">Press</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">Support</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">Legal</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
            </ul>
          </div>

          {/* Follow Us */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">Follow Us</h4>
            <div className="flex items-center gap-3 flex-wrap">
              <a href="#" aria-label="Instagram" className="text-zinc-400 hover:text-white transition-colors">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" aria-label="Twitter" className="text-zinc-400 hover:text-white transition-colors">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="#" aria-label="LinkedIn" className="text-zinc-400 hover:text-white transition-colors">
                <Linkedin className="h-4 w-4" />
              </a>
              <a href="#" aria-label="YouTube" className="text-zinc-400 hover:text-white transition-colors">
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-white/[0.06] text-xs text-zinc-500 text-center">
          © {new Date().getFullYear()} Speak Arena Inc. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
