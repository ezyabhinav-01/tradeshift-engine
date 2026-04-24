import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLearnStore } from '../store/useLearnStore';
import { useAuth } from '../context/AuthContext';

/**
 * Global hook to track learning time across all /learn routes.
 * Sends a heartbeat every 30 seconds to the backend.
 */
export const useLearningTimeTracking = () => {
    const location = useLocation();
    const { user } = useAuth();
    const { logLearningTime } = useLearnStore();
    const lastLogTimeRef = useRef<number>(Date.now());
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const isLearningPage = location.pathname.startsWith('/learn');

    useEffect(() => {
        // Clear existing interval if any
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (user && isLearningPage) {
            // Start heartbeat
            intervalRef.current = setInterval(() => {
                if (!document.hidden) {
                    void logLearningTime(30);
                    lastLogTimeRef.current = Date.now();
                }
            }, 30000);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [user, isLearningPage, logLearningTime]);

    // Cleanup on unmount or user logout
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);
};
