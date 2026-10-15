import { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import WebView from 'react-native-webview';
import { GOOGLE_MAPS } from '@/lib/config';
import { leafletHtml } from './leaflet-html';
import type { MapProps } from './types';

function OpenStreetMap(props: MapProps) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  // Keep one WebView document alive; GPS updates only change its layers.
  const [html] = useState(() => leafletHtml(props));
  const payload = JSON.stringify({
    markers: props.markers,
    route: props.route || [],
    selectable: !!props.onPick,
  }).replace(/</g, '\\u003c');
  useEffect(() => {
    if (ready)
      ref.current?.injectJavaScript(`window.flashgoUpdate(${payload});true;`);
  }, [payload, ready]);
  return (
    <View
      style={{
        height: props.height || 280,
        borderRadius: 20,
        overflow: 'hidden',
      }}
    >
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://flashgo.local/' }}
        onLoadEnd={() => setReady(true)}
        javaScriptEnabled
        domStorageEnabled={false}
        mixedContentMode="never"
        userAgent="FlashGoDelivery/1.0 (OpenStreetMap mobile viewer)"
        onShouldStartLoadWithRequest={(request) => {
          if (
            request.url === 'about:blank' ||
            request.url.startsWith('https://flashgo.local/')
          )
            return true;
          if (
            request.navigationType === 'click' &&
            request.url.startsWith('https://www.openstreetmap.org/')
          )
            void Linking.openURL(request.url);
          return false;
        }}
        onMessage={(event) => {
          try {
            const point = JSON.parse(event.nativeEvent.data);
            if (
              typeof point.latitude === 'number' &&
              typeof point.longitude === 'number' &&
              Math.abs(point.latitude) <= 90 &&
              Math.abs(point.longitude) <= 180
            )
              props.onPick?.(point);
          } catch {}
        }}
      />
    </View>
  );
}
export function DeliveryMap(props: MapProps) {
  if (GOOGLE_MAPS) {
    const NativeMap = require('./native-map').default;
    return (
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>
        <NativeMap {...props} />
      </View>
    );
  }
  return <OpenStreetMap {...props} />;
}
