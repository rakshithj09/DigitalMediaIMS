"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

type LoginSignupFrameProps = {
  children: React.ReactNode;
  className?: string;
  cardClassName?: string;
};

export const authInputClassName =
  "auth-input h-10 rounded-lg border-slate-200 bg-white px-3 text-slate-900 placeholder:text-slate-400 focus-visible:border-[#005a78] focus-visible:ring-[#005a78]/10";

export const authSelectClassName =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-shadow focus:border-[#005a78] focus:ring-[3px] focus:ring-[#005a78]/10 disabled:cursor-not-allowed disabled:opacity-50";

export function LoginSignupFrame({ children, className, cardClassName }: LoginSignupFrameProps) {
  return (
    <section
      className={cn(
        "fixed inset-0 overflow-y-auto text-slate-900",
        className,
      )}
      style={{ background: "var(--brand-bg)" }}
    >
      <style>{`
        .card-animate{opacity:0;transform:translateY(20px);animation:fadeUp .8s cubic-bezier(.22,.61,.36,1) .4s forwards}
        .auth-input:-webkit-autofill,
        .auth-input:-webkit-autofill:hover,
        .auth-input:-webkit-autofill:focus,
        .auth-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
          -webkit-text-fill-color: #0f172a !important;
          caret-color: #0f172a;
          transition: background-color 9999s ease-in-out 0s;
        }
        @keyframes fadeUp{to{opacity:1;transform:translateY(0)}}
      `}</style>

      <header className="brand-header absolute left-0 right-0 top-0 z-10 flex min-h-14 items-center px-3 py-2 sm:px-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
            <Image
              src="/ignite-logo.png"
              alt="Ignite logo"
              width={26}
              height={26}
              className="object-contain"
              priority
            />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block text-sm font-bold leading-tight text-white">Digital Media</span>
            <span className="text-kicker hidden sm:block">Equipment Tracker</span>
          </span>
        </Link>
      </header>

      <div className="relative z-10 grid min-h-full w-full place-items-center px-4 py-24">
        <div
          className={cn(
            "card-animate w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm",
            cardClassName,
          )}
          style={{ boxShadow: "0 1px 3px rgba(15,36,55,0.06), 0 4px 14px rgba(15,36,55,0.04)" }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export default LoginSignupFrame;
