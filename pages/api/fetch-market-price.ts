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
    // Python FlaskサービスのエンドポイントURL (ポート5001で実行されていると仮定)
    const flaskApiUrl = `http://localhost:5001/api/current_price?ticker=${encodeURIComponent(ticker)}`;
    
    console.log(`Fetching market price from Flask API: ${flaskApiUrl}`);
    const marketPriceRes = await fetch(flaskApiUrl);

    if (!marketPriceRes.ok) {
      const errorData = await marketPriceRes.json().catch(() => ({ error: "Failed to parse error response from Flask API" }));
      console.error(`Error from Flask API: ${marketPriceRes.status}`, errorData);
      return res.status(marketPriceRes.status).json({ error: `Failed to fetch market price from backend service: ${errorData.error || marketPriceRes.statusText}` });
    }

    const data: any = await marketPriceRes.json(); // 型をanyにして柔軟に受け取る
    console.log('Received data from Flask API:', data);
    
    if (data && typeof data.price === 'number' && typeof data.ticker === 'string') { // レスポンスの型を検証
        return res.status(200).json({ ticker: data.ticker, price: data.price });
    } else if (data && typeof data.error === 'string') {
        return res.status(404).json({ error: data.error });
    } else {
        return res.status(500).json({ error: "Unexpected response format from Flask API" });
    }

  } catch (error: any) {
    console.error('Error fetching market price in Next.js API route:', error);
    return res.status(500).json({ error: error.message || 'Internal server error in Next.js API route' });
  }
}