// pages/api/fetch-market-price.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type MarketDataResponse = {
    ticker: string;
    price: number | null;
    allDayVWAP: number | null;
} | {
    error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MarketDataResponse>
) {
  const { ticker } = req.query;

  if (typeof ticker !== 'string' || !ticker) {
    return res.status(400).json({ error: 'Ticker query parameter is required and must be a string.' });
  }

  try {
    // blpapi.pyのエンドポイントを呼び出し、PX_LASTとALL_DAY_VWAPを同時に取得
    const flaskApiUrl = `http://localhost:5001/api/reference_data?ticker=${encodeURIComponent(ticker)}&fields=PX_LAST,ALL_DAY_VWAP`;
    
    console.log(`Fetching market data from Flask API: ${flaskApiUrl}`);
    const marketDataRes = await fetch(flaskApiUrl);

    if (!marketDataRes.ok) {
      const errorData = await marketDataRes.json().catch(() => ({ error: "Failed to parse error response from Flask API" }));
      console.error(`Error from Flask API: ${marketDataRes.status}`, errorData);
      return res.status(marketDataRes.status).json({ error: `Failed to fetch market data from backend service: ${errorData.error || marketDataRes.statusText}` });
    }

    const data: any[] = await marketDataRes.json();
    console.log('Received data from Flask API for market data:', data);
    
    if (Array.isArray(data) && data.length > 0) {
      const securityData = data[0];
      if (securityData && typeof securityData.security === 'string') {
        
        const price = typeof securityData.PX_LAST === 'number' ? securityData.PX_LAST : null;
        const allDayVWAP = typeof securityData.ALL_DAY_VWAP === 'number' ? securityData.ALL_DAY_VWAP : null;

        // 個別のフィールドエラーも確認
        if (typeof securityData.PX_LAST === 'string' && securityData.PX_LAST.startsWith("Field Error:")) {
            console.error(`Field error for PX_LAST on ${ticker}: ${securityData.PX_LAST}`);
        }
        if (typeof securityData.ALL_DAY_VWAP === 'string' && securityData.ALL_DAY_VWAP.startsWith("Field Error:")) {
            console.error(`Field error for ALL_DAY_VWAP on ${ticker}: ${securityData.ALL_DAY_VWAP}`);
        }
        
        if (securityData.securityError) {
             return res.status(404).json({ error: securityData.securityError });
        }
        
        return res.status(200).json({ 
            ticker: securityData.security, 
            price: price,
            allDayVWAP: allDayVWAP 
        });

      }
    }
    
    // データが見つからなかった場合や予期しない形式の場合
    console.error("Unexpected response format from Flask API or no data:", data);
    return res.status(500).json({ error: "Unexpected response format from Flask API or no data found" });

  } catch (error: any) {
    console.error('Error fetching market data in Next.js API route:', error);
    return res.status(500).json({ error: error.message || 'Internal server error in Next.js API route' });
  }
}