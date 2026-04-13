import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { trackPageView } from '../utils/analytics';

const HEARTBEAT_INTERVAL = 60000; // 60 seconds
const ANALYTICS_BASE_URL = '/api/analytics';

export const usePageTracking = () => {
    const location = useLocation();
    const { user } = useAuth();
    const startTimeRef = useRef<number>(Date.now());
    const lastPathRef = useRef<string>(location.pathname);

    // Persistence helper to send the data
    const sendEngagementData = (path: string, duration: number) => {
        if (!user || duration < 1000) return; // Only track for logged in users and durations > 1s

        const data = {
            page_path: path,
            duration_seconds: Math.floor(duration / 1000),
            session_id: window.sessionStorage.getItem('analytics_session_id') || undefined
        };

        // keepalive + credentials preserves auth cookies during unload/visibility changes
        fetch(`${ANALYTICS_BASE_URL}/page-engagement`, {
            method: 'POST',
            credentials: 'include',
            keepalive: true,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        }).catch(() => {});
    };

    const sendHeartbeat = () => {
        if (!user) return;
        axios.post(`${ANALYTICS_BASE_URL}/heartbeat`, {}, { withCredentials: true }).catch(() => {});
    }

    useEffect(() => {
        // Init session ID if not exists
        if (!window.sessionStorage.getItem('analytics_session_id')) {
            window.sessionStorage.setItem('analytics_session_id', Math.random().toString(36).substring(2, 15));
        }

        // Heartbeat timer
        const heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

        // Initial heartbeat
        sendHeartbeat();

        // Handle page visibility (pause tracking when tab is hidden)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                const duration = Date.now() - startTimeRef.current;
                sendEngagementData(lastPathRef.current, duration);
            } else {
                // When coming back, reset the start timer
                startTimeRef.current = Date.now();
            }
        };

        const handleBeforeUnload = () => {
            const duration = Date.now() - startTimeRef.current;
            sendEngagementData(lastPathRef.current, duration);
        };

        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            clearInterval(heartbeatTimer);
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            const duration = Date.now() - startTimeRef.current;
            sendEngagementData(lastPathRef.current, duration);
        };
    }, [user]);

    useEffect(() => {
        // Track the initial page view (or on user login state change if desired)
        if (location.pathname === lastPathRef.current && startTimeRef.current === Date.now()) {
             // Handle first mount manually if we wanted, but the effect triggers anyway.
        }
    }, [user]);

    useEffect(() => {
        // On actual location change
        if (location.pathname !== lastPathRef.current) {
            const duration = Date.now() - startTimeRef.current;
            sendEngagementData(lastPathRef.current, duration);
            
            // Send standard standard GA/Mixpanel Page View
            trackPageView(location.pathname, location.search);

            // Reset for the new path
            lastPathRef.current = location.pathname;
            startTimeRef.current = Date.now();
        }
    }, [location.pathname, location.search, user]);
};
