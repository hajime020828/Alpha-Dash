// pages/api/fetch-market-price.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type MarketPriceResponse = {
    ticker: string;
    price: number;
} | {
    error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MarketPriceResponse>
) {
  const { ticker } = req.query;

  if (typeof ticker !== 'string' || !ticker) {
    return res.status(400).json({ error: 'Ticker query parameter is required and must be a string.' });
  }

  try {
    // blpapi.pyのreference_dataエンドポイントを呼び出し、PX_LASTを取得
    const flaskApiUrl = `http://localhost:5001/api/reference_data?ticker=${encodeURIComponent(ticker)}&fields=PX_LAST`;
    
    console.log(`Fetching market price from Flask API: ${flaskApiUrl}`);
    const marketPriceRes = await fetch(flaskApiUrl);

    if (!marketPriceRes.ok) {
      const errorData = await marketPriceRes.json().catch(() => ({ error: "Failed to parse error response from Flask API" }));
      console.error(`Error from Flask API: ${marketPriceRes.status}`, errorData);
      return res.status(marketPriceRes.status).json({ error: `Failed to fetch market price from backend service: ${errorData.error || marketPriceRes.statusText}` });
    }

    const data: any = await marketPriceRes.json(); // 型をanyにして柔軟に受け取る
    console.log('Received data from Flask API for market price:', data);
    
    // /api/reference_dataからの応答は配列形式 [{"security": "...", "PX_LAST": 123.45}]
    if (Array.isArray(data) && data.length > 0) {
      const securityData = data[0];
      if (securityData && typeof securityData.PX_LAST === 'number' && typeof securityData.security === 'string') {
        return res.status(200).json({ ticker: securityData.security, price: securityData.PX_LAST });
      } else if (securityData && typeof securityData.PX_LAST === 'string' && securityData.PX_LAST.startsWith("Field Error:")) {
        console.error(`Field error for ${ticker}: ${securityData.PX_LAST}`);
        return res.status(404).json({ error: `PX_LAST not available for ${ticker}: ${securityData.PX_LAST}` });
      } else if (securityData && securityData.securityError) {
        return res.status(404).json({ error: securityData.securityError });
      }
    } else {
      console.error("Unexpected response format from Flask API or no data:", data);
      return res.status(500).json({ error: "Unexpected response format from Flask API or no data found" });
    }

  } catch (error: any) {
    console.error('Error fetching market price in Next.js API route:', error);
    return res.status(500).json({ error: error.message || 'Internal server error in Next.js API route' });
  }
}