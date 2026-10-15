import { useEffect, useState } from 'react';
import { Txt } from './ui';
export function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - now) / 1000),
  );
  return (
    <Txt
      bold
      style={{ color: '#c66a0c' }}
    >{`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}</Txt>
  );
}
