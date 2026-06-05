import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flashgo.delivery',
  appName: 'Flash Go Delivery',

  webDir: 'out',

  server: {
    url: 'https://flash-go-delivery-eth.up.railway.app/',
    cleartext: false,
  },
};

export default config;
