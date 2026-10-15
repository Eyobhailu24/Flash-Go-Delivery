import { useEffect, useRef, useState } from 'react';
import { leafletHtml } from './leaflet-html';
import type { MapProps } from './types';
export function DeliveryMap(props: MapProps) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const onPick = useRef(props.onPick);
  onPick.current = props.onPick;
  const [html] = useState(() => leafletHtml(props));
  const [ready, setReady] = useState(false);
  const payload = JSON.stringify({
    markers: props.markers,
    route: props.route || [],
    selectable: !!props.onPick,
  });
  useEffect(() => {
    if (ready)
      iframe.current?.contentWindow?.postMessage(
        { type: 'flashgo-map-update', payload: JSON.parse(payload) },
        '*',
      );
  }, [payload, ready]);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (
        event.source !== iframe.current?.contentWindow ||
        event.data?.type !== 'flashgo-map-pick'
      )
        return;
      const point = event.data.point;
      if (
        typeof point?.latitude === 'number' &&
        typeof point?.longitude === 'number' &&
        Math.abs(point.latitude) <= 90 &&
        Math.abs(point.longitude) <= 180
      )
        onPick.current?.(point);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);
  return (
    <iframe
      ref={iframe}
      title="Delivery map"
      srcDoc={html}
      onLoad={() => setReady(true)}
      sandbox="allow-scripts allow-popups"
      style={{
        width: '100%',
        height: props.height || 280,
        border: 0,
        borderRadius: 20,
      }}
    />
  );
}
