import { useState, useEffect } from 'react';

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const subscribeToPush = async (): Promise<PushSubscription | null> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push messaging is not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
        )
      });

      setSubscription(subscription);
      return subscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (permission === 'granted') {
      new Notification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        ...options
      });
    }
  };

  const scheduleQuestReminder = () => {
    if (permission === 'granted') {
      // Schedule daily quest reminder
      setTimeout(() => {
        sendNotification('⚔️ Your Quest Awaits!', {
          body: 'Do not miss today\'s training, Hunter!',
          tag: 'daily-quest-reminder'
        });
      }, 1000 * 60 * 60 * 24); // 24 hours
    }
  };

  const sendStreakWarning = (daysLeft: number) => {
    sendNotification('⚠️ Hunter, your Rank is at risk!', {
      body: `You have ${daysLeft} day(s) left before rank demotion. Complete your quests now!`,
      tag: 'streak-warning',
      requireInteraction: true
    });
  };

  const sendRankUp = (newRank: string) => {
    sendNotification('🎉 Rank Up Achievement!', {
      body: `Congratulations! You've advanced to ${newRank}-Rank Hunter!`,
      tag: 'rank-up',
      requireInteraction: true
    });
  };

  return {
    permission,
    subscription,
    requestPermission,
    subscribeToPush,
    sendNotification,
    scheduleQuestReminder,
    sendStreakWarning,
    sendRankUp
  };
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}