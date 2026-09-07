import { useEffect, useState } from "react";

export const useDebounce = <T = string>(value: T, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};


/*
//Usage

const [search, setSearch] = useState("");
const debouncedSearch = useDebounce(search, 500);

*/