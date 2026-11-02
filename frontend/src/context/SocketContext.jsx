import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { notify } from '@/components/common/ToastProvider';
import { getIncomingChatRequests, getNotifications } from '@/services/api';
import { getApiBaseUrl, getSocketBaseUrl } from '@/utils/apiUrl';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // Initial load of counts
  const loadCounts = async () => {
    if (!isAuthenticated) return;
    try {
      const [reqData, notifData] = await Promise.all([
        getIncomingChatRequests(),
        getNotifications()
      ]);
      if (reqData.success) {
        setPendingRequestsCount(reqData.requests?.length || 0);
      }
      if (notifData.success) {
        setUnreadNotificationsCount(notifData.unreadCount || 0);
      }
    } catch (err) {
      // Ignore background fetch errors
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setPendingRequestsCount(0);
      setUnreadNotificationsCount(0);
      return;
    }

    loadCounts();

    const socketUrl = getSocketBaseUrl();
    const token = localStorage.getItem('melt_token') || localStorage.getItem('admin_token');
    const s = io(socketUrl, {
      withCredentials: true,
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling']
    });

    s.on('connect', () => {
      console.log(`[Socket] Connected to MELT real-time gateway: ${s.id}`);
    });

    // Real-time listener for incoming chat requests
    s.on('new_chat_request', (data) => {
      setPendingRequestsCount((prev) => prev + 1);
      setUnreadNotificationsCount((prev) => prev + 1);
      notify.info(`New chat request from @${data.sender.username}!`);
    });

    // Real-time listener when someone accepted your request
    s.on('chat_request_accepted', (data) => {
      setUnreadNotificationsCount((prev) => prev + 1);
      notify.success(`@${data.acceptedBy.username} accepted your chat request!`);
    });

    // Real-time listener when someone declined your request
    s.on('chat_request_declined', () => {
      // Passive notification
    });

    // Real-time listener when sender cancelled
    s.on('chat_request_cancelled', () => {
      setPendingRequestsCount((prev) => Math.max(0, prev - 1));
    });

    // Real-time centralized notification listener
    s.on('new_notification', (data) => {
      if (data?.unreadCount !== undefined) {
        setUnreadNotificationsCount(data.unreadCount);
      } else {
        setUnreadNotificationsCount((prev) => prev + 1);
      }
      if (data?.notification?.title) {
        notify.info(`${data.notification.title}: ${data.notification.description || ''}`);
      }
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [isAuthenticated, user?.id]);

  const value = {
    socket,
    pendingRequestsCount,
    setPendingRequestsCount,
    unreadNotificationsCount,
    setUnreadNotificationsCount,
    refreshCounts: loadCounts
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;

