import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const HEARTBEAT_INTERVAL = 60000; // 60 seconds
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

        // Use sendBeacon for more reliable delivery on unmount/page hide
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        navigator.sendBeacon(`${API_BASE_URL}/analytics/page-engagement`, blob);
    };

    const sendHeartbeat = () => {
        if (!user) return;
        axios.post(`${API_BASE_URL}/analytics/heartbeat`, {}, { withCredentials: true }).catch(() => {});
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

        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', () => {
            const duration = Date.now() - startTimeRef.current;
            sendEngagementData(lastPathRef.current, duration);
        });

        return () => {
            clearInterval(heartbeatTimer);
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            const duration = Date.now() - startTimeRef.current;
            sendEngagementData(lastPathRef.current, duration);
        };
    }, [user]);

    useEffect(() => {
        // On actual location change
        if (location.pathname !== lastPathRef.current) {
            const duration = Date.now() - startTimeRef.current;
            sendEngagementData(lastPathRef.current, duration);
            
            // Reset for the new path
            lastPathRef.current = location.pathname;
            startTimeRef.current = Date.now();
        }
    }, [location.pathname, user]);
};
