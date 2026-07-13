/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RuDataMultipliers {
  roe?: number;
  eps?: number;
  pe?: number;
  marketCap?: number;
}

/**
 * Fetch financial indicators from RuData (Interfax) API.
 * Uses VITE_RUDATA_API_KEY if configured.
 * Endpoint details are based on standard Interfax RuData REST API specifications.
 */
export async function fetchRuDataIndicators(ticker: string): Promise<RuDataMultipliers | null> {
  const apiKey = (import.meta as any).env.VITE_RUDATA_API_KEY;
  if (!apiKey) {
    return null; // Silent skip, fallback to local calculator database
  }

  try {
    const t = ticker.toUpperCase();
    
    // RuData REST API utilizes standard POST endpoints with request bodies containing security identifiers and filters.
    // Standard endpoint for security multipliers: https://rudata.interfax.ru/api/Securities/Multipliers
    const response = await fetch("https://rudata.interfax.ru/api/Securities/Multipliers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        secIds: [t],
        multipliers: ["ROE", "EPS", "PE", "MARKET_CAP"],
        latestOnly: true,
      }),
    });

    if (!response.ok) {
      console.warn(`RuData API returned status ${response.status} for ticker ${t}`);
      return null;
    }

    const json = await response.json();
    if (json && json.data && json.data[t]) {
      const item = json.data[t];
      return {
        roe: item.ROE != null ? parseFloat(item.ROE) : undefined,
        eps: item.EPS != null ? parseFloat(item.EPS) : undefined,
        pe: item.PE != null ? parseFloat(item.PE) : undefined,
        marketCap: item.MARKET_CAP != null ? parseFloat(item.MARKET_CAP) : undefined,
      };
    }
  } catch (error) {
    console.error("Error calling RuData Interfax API:", error);
  }

  return null;
}
