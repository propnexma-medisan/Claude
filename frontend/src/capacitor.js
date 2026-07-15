// Detect if running inside a Capacitor native app
export const isNative = () => {
  try {
    return window.Capacitor?.isNativePlatform() ?? false;
  } catch {
    return false;
  }
};

export const getPlatform = () => {
  try {
    return window.Capacitor?.getPlatform() ?? 'web';
  } catch {
    return 'web';
  }
};

export async function initCapacitor() {
  if (!isNative()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    if (getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#1e3a5f' });
    }
  } catch (e) {
    console.warn('[Capacitor] StatusBar init failed:', e.message);
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (e) {
    console.warn('[Capacitor] SplashScreen init failed:', e.message);
  }
}

// Request push notification permission and return the FCM/APNs token
export async function registerPushNotifications(onToken, onNotification) {
  if (!isNative()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return;

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token) => {
      console.log('[Push] Token:', token.value);
      if (onToken) onToken(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error:', err);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Received:', notification);
      if (onNotification) onNotification(notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Action performed:', action);
      if (onNotification) onNotification(action.notification);
    });
  } catch (e) {
    console.warn('[Capacitor] PushNotifications init failed:', e.message);
  }
}
