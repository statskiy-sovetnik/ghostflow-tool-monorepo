import { useState, useEffect } from 'react';
import { fetchContractName } from '../services/contractName';

export function useContractName(address: string): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchContractName(address).then((result) => {
      if (!cancelled) {
        setName(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return name;
}
