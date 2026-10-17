"use client";

import * as React from "react";
import { apiClient } from "@/services/api/client";

export interface GeoPricingState {
  country: string;
  isIndia: boolean;
  currency: "INR" | "USD";
  currencySymbol: "₹" | "$";
  isLoading: boolean;
  formatPrice: (inrPrice?: number | null, usdPrice?: number | null) => string;
  formatOriginalPrice: (inrOrigPrice?: number | null, usdOrigPrice?: number | null) => string | null;
}

export function useGeoPricing(): GeoPricingState {
  const [state, setState] = React.useState<{
    country: string;
    isIndia: boolean;
    currency: "INR" | "USD";
    isLoading: boolean;
  }>(() => {
    let isIndia = true;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      isIndia =
        tz.includes("Calcutta") ||
        tz.includes("Kolkata") ||
        tz.includes("Asia/Kolkata") ||
        tz.includes("IST");
    } catch {
      isIndia = true;
    }
    return {
      country: isIndia ? "IN" : "US",
      isIndia,
      currency: isIndia ? "INR" : "USD",
      isLoading: true,
    };
  });

  React.useEffect(() => {
    let isMounted = true;

    apiClient
      .get("/api/v1/payments/geo")
      .then((res) => {
        if (!isMounted) return;
        const data = res.data?.data ?? res.data;
        if (data && typeof data.is_india === "boolean") {
          setState({
            country: data.country || (data.is_india ? "IN" : "US"),
            isIndia: data.is_india,
            currency: data.is_india ? "INR" : "USD",
            isLoading: false,
          });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      })
      .catch(() => {
        if (isMounted) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const formatPrice = React.useCallback(
    (inrPrice?: number | null, usdPrice?: number | null): string => {
      const numInr = inrPrice != null ? Number(inrPrice) : 0;
      if (numInr === 0) return "Free";

      if (state.currency === "USD") {
        const numUsd = usdPrice != null && Number(usdPrice) > 0
          ? Number(usdPrice)
          : Math.max(Math.ceil(numInr / 80), 1);
        return `$${numUsd}`;
      }

      return `₹${numInr.toLocaleString("en-IN")}`;
    },
    [state.currency]
  );

  const formatOriginalPrice = React.useCallback(
    (inrOrigPrice?: number | null, usdOrigPrice?: number | null): string | null => {
      if (state.currency === "USD") {
        if (usdOrigPrice != null && Number(usdOrigPrice) > 0) {
          return `$${Number(usdOrigPrice)}`;
        }
        return null;
      }

      if (inrOrigPrice != null && Number(inrOrigPrice) > 0) {
        return `₹${Number(inrOrigPrice).toLocaleString("en-IN")}`;
      }
      return null;
    },
    [state.currency]
  );

  return {
    country: state.country,
    isIndia: state.isIndia,
    currency: state.currency,
    currencySymbol: state.currency === "USD" ? "$" : "₹",
    isLoading: state.isLoading,
    formatPrice,
    formatOriginalPrice,
  };
}
