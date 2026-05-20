import Cookies from 'js-cookie';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5002';

let socket: Socket | null = null;

export const getSocket = (): Socket | null => {
    if (typeof window === 'undefined') return null;

    if (socket && (socket.connected || socket.active)) {
        return socket;
    }

    const token = Cookies.get('token');
    if (!token) return null;

    socket = io(SOCKET_URL, {
        auth: { token },
    });

    return socket;
};

export const disconnectSocket = (): void => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
