'use client';

import { Product } from '@aze-mini/demo-contracts';
import { Wire } from '@aze-mini/platform-contracts';
import { useState, useEffect } from 'react';

// The catalogue as it arrives: the same Product the API answers with, with the
// timestamps as the strings JSON left them. Neither is redeclared here.
type CatalogueEntry = Wire<Product>;

export default function MyComponent() {
  const [data, setData] = useState<CatalogueEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:3030/api/products');
        console.log('Response:', response);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result: CatalogueEntry[] = await response.json();
        setData(result.slice(0, 5)); // Limit to first 5 items
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-4">
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.id} className="border p-4 rounded-lg">
            <h2 className="text-xl font-semibold">{item.name}</h2>
            <p className="text-gray-600 mt-2">{item.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}