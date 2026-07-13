/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CbondsMultipliers {
  roe?: number;
  eps?: number;
  pe?: number;
  marketCap?: number;
}

/**
 * Fetch financial indicators from Cbonds API.
 * Uses VITE_CBONDS_API_USER and VITE_CBONDS_API_PASSWORD if configured.
 * Endpoint details are based on Cbonds corporate REST API.
 */
export async function fetchCbondsIndicators(ticker: string): Promise<CbondsMultipliers | null> {
  const apiUser = (import.meta as any).env.VITE_CBONDS_API_USER;
  const apiPassword = (import.meta as any).env.VITE_CBONDS_API_PASSWORD;

  if (!apiUser || !apiPassword) {
    return null; // Silent skip, fallback to local calculator database
  }

  try {
    const t = ticker.toUpperCase();
    
    // 1. Get Session Token from Cbonds Auth endpoint
    const authRes = await fetch("https://api.cbonds.info/v2/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: apiUser,
        password: apiPassword,
      }),
    });

    if (!authRes.ok) {
      console.warn(`Cbonds Auth failed with status ${authRes.status}`);
      return null;
    }

    const authData = await authRes.json();
    const token = authData.token || authData.data?.token;

    if (!token) {
      console.warn("Could not retrieve authorization token from Cbonds response");
      return null;
    }

    // 2. Fetch multipliers from Cbonds indicators endpoint
    const response = await fetch(`https://api.cbonds.info/v2/financial_ratios?ticker=${t}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`Cbonds indicators fetch returned status ${response.status} for ${t}`);
      return null;
    }

    const json = await response.json();
    // Assuming structure: { data: [ { roe: X, eps: Y, pe: Z, market_cap: W } ] }
    if (json && json.data && json.data.length > 0) {
      const item = json.data[0];
      return {
        roe: item.roe != null ? parseFloat(item.roe) : undefined,
        eps: item.eps != null ? parseFloat(item.eps) : undefined,
        pe: item.pe != null ? parseFloat(item.pe) : undefined,
        marketCap: item.market_cap != null ? parseFloat(item.market_cap) : undefined,
      };
    }
  } catch (error) {
    console.error("Error calling Cbonds API:", error);
  }

  return null;
}
