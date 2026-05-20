'use client';

import axios from 'axios';
import Cookies from 'js-cookie';
import { ArrowLeft, Loader2, LogOut, MessageCircle, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState } from 'react';

interface Participant {
    id: string;
    name: string;
    email?: string;
}

interface ChatListEntry {
    user: { _id: string; name: string; email?: string };
    chat: { _id: string };
}

interface ChatMessage {
    _id: string;
    chatId: string;
    sender: string;
    text?: string;
    image?: { url: string; publicId: string };
    messageType: 'text' | 'image';
    seen: boolean;
    seenAt?: string | null;
    createdAt: string;
}

const formatTimestamp = (iso: string): string => {
    try {
        return new Date(iso).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
};

const getInitials = (name: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const ChatApp = () => {
    const router = useRouter();
    const [username, setUsername] = useState<string>('');
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messagesLoading, setMessagesLoading] = useState<boolean>(false);
    const [draft, setDraft] = useState<string>('');
    const [sending, setSending] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const handleLogout = (): void => {
        Cookies.remove('token');
        try {
            localStorage.removeItem('user');
        } catch {
            // ignore
        }
        router.replace('/login');
    };

    useEffect(() => {
        try {
            const stored = localStorage.getItem('user');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.name) setUsername(parsed.name);
                if (parsed?._id) setCurrentUserId(parsed._id);
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        const token = Cookies.get('token');
        if (!token) {
            router.replace('/login');
            return;
        }

        const fetchChats = async () => {
            try {
                const { data } = await axios.get(
                    'http://localhost:5002/api/v1/chat/all',
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const entries: ChatListEntry[] = data?.chats || [];
                const mapped: Participant[] = entries.map((e) => ({
                    id: e.chat._id,
                    name: e.user?.name || 'Unknown',
                    email: e.user?.email,
                }));
                setParticipants(mapped);
            } catch (error: any) {
                if (error?.response?.status === 401) {
                    router.replace('/login');
                } else {
                    console.error('Failed to load chats:', error);
                    alert(
                        error?.response?.data?.message ||
                            error?.message ||
                            'Failed to load chats. Check the browser console.'
                    );
                }
            } finally {
                setLoading(false);
            }
        };

        fetchChats();
    }, [router]);

    useEffect(() => {
        setDraft('');
    }, [selectedId]);

    const handleSend = async (): Promise<void> => {
        const text = draft.trim();
        if (!text || !selectedId || sending) return;
        const token = Cookies.get('token');
        if (!token) {
            router.replace('/login');
            return;
        }

        setSending(true);
        try {
            const { data } = await axios.post(
                'http://localhost:5002/api/v1/message',
                { chatId: selectedId, text },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const saved: ChatMessage | undefined = data?.message;
            if (saved) {
                setMessages((prev) => [...prev, saved]);
            }
            setDraft('');
        } catch (error: any) {
            if (error?.response?.status === 401) {
                router.replace('/login');
            } else {
                console.error('Failed to send message:', error);
                alert(
                    error?.response?.data?.message ||
                        error?.message ||
                        'Failed to send message. Check the browser console.'
                );
            }
        } finally {
            setSending(false);
        }
    };

    useEffect(() => {
        if (!selectedId) {
            setMessages([]);
            return;
        }
        const token = Cookies.get('token');
        if (!token) {
            router.replace('/login');
            return;
        }

        let cancelled = false;
        setMessagesLoading(true);
        setMessages([]);

        const fetchMessages = async () => {
            try {
                const { data } = await axios.get(
                    `http://localhost:5002/api/v1/message/${selectedId}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (cancelled) return;
                setMessages(data?.messages || []);
            } catch (error: any) {
                if (cancelled) return;
                if (error?.response?.status === 401) {
                    router.replace('/login');
                } else {
                    console.error('Failed to load messages:', error);
                    alert(
                        error?.response?.data?.message ||
                            error?.message ||
                            'Failed to load messages. Check the browser console.'
                    );
                }
            } finally {
                if (!cancelled) setMessagesLoading(false);
            }
        };

        fetchMessages();
        return () => {
            cancelled = true;
        };
    }, [selectedId, router]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const selected = useMemo(
        () => participants.find((p) => p.id === selectedId) || null,
        [participants, selectedId]
    );

    const Sidebar = (
        <aside
            className={`${
                selectedId ? 'hidden md:flex' : 'flex'
            } flex-col w-full md:w-80 lg:w-96 bg-gray-800 border-r border-gray-700 h-screen`}
        >
            <div className='px-5 py-4 border-b border-gray-700 flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <h2 className='text-xl font-semibold text-white'>Chats</h2>
                    {username && (
                        <p className='text-sm text-gray-400 mt-0.5 truncate'>
                            Signed in as {username}
                        </p>
                    )}
                </div>
                <button
                    onClick={handleLogout}
                    className='inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white
                    bg-gray-700/60 hover:bg-gray-700 border border-gray-600 px-3 py-1.5 rounded-md
                    transition shrink-0'
                    aria-label='Log out'
                >
                    <LogOut size={16} />
                    <span className='hidden sm:inline'>Logout</span>
                </button>
            </div>

            <div className='flex-1 overflow-y-auto'>
                {loading ? (
                    <div className='h-full flex items-center justify-center'>
                        <Loader2 className='w-6 h-6 text-blue-500 animate-spin' />
                    </div>
                ) : participants.length === 0 ? (
                    <div className='h-full flex flex-col items-center justify-center text-center px-6'>
                        <MessageCircle className='w-10 h-10 text-gray-500 mb-3' />
                        <p className='text-gray-400 text-sm'>No conversations yet</p>
                    </div>
                ) : (
                    <ul>
                        {participants.map((p) => {
                            const active = p.id === selectedId;
                            return (
                                <li key={p.id}>
                                    <button
                                        onClick={() => setSelectedId(p.id)}
                                        className={`w-full flex items-center gap-3 px-5 py-3 text-left
                                        border-b border-gray-700/60 transition
                                        ${active ? 'bg-gray-700' : 'hover:bg-gray-700/60'}`}
                                    >
                                        <div className='w-11 h-11 rounded-full bg-blue-600 text-white
                                        flex items-center justify-center font-semibold shrink-0'>
                                            {getInitials(p.name)}
                                        </div>
                                        <div className='min-w-0 flex-1'>
                                            <p className='text-white font-medium truncate'>
                                                {p.name}
                                            </p>
                                            {p.email && (
                                                <p className='text-xs text-gray-400 truncate'>
                                                    {p.email}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </aside>
    );

    const ChatArea = (
        <main
            className={`${
                selectedId ? 'flex' : 'hidden md:flex'
            } flex-col flex-1 h-screen bg-gray-900`}
        >
            {selected ? (
                <>
                    <div className='flex items-center gap-3 px-5 py-3 border-b border-gray-700 bg-gray-800'>
                        <button
                            onClick={() => setSelectedId(null)}
                            className='md:hidden text-gray-300 hover:text-white p-1'
                            aria-label='Back'
                        >
                            <ArrowLeft size={22} />
                        </button>
                        <div className='w-10 h-10 rounded-full bg-blue-600 text-white
                        flex items-center justify-center font-semibold'>
                            {getInitials(selected.name)}
                        </div>
                        <div className='min-w-0'>
                            <p className='text-white font-semibold truncate'>{selected.name}</p>
                            {selected.email && (
                                <p className='text-xs text-gray-400 truncate'>{selected.email}</p>
                            )}
                        </div>
                    </div>

                    <div className='flex-1 overflow-y-auto px-4 py-4'>
                        {messagesLoading ? (
                            <div className='h-full flex items-center justify-center'>
                                <Loader2 className='w-6 h-6 text-blue-500 animate-spin' />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className='h-full flex items-center justify-center text-center'>
                                <p className='text-gray-500 text-sm'>
                                    No messages yet. Say hi to {selected.name}.
                                </p>
                            </div>
                        ) : (
                            <ul className='space-y-2'>
                                {messages.map((m) => {
                                    const mine = m.sender === currentUserId;
                                    return (
                                        <li
                                            key={m._id}
                                            className={`flex ${
                                                mine ? 'justify-end' : 'justify-start'
                                            }`}
                                        >
                                            <div
                                                className={`max-w-[75%] sm:max-w-[65%] rounded-2xl px-4 py-2
                                                ${
                                                    mine
                                                        ? 'bg-blue-600 text-white rounded-br-md'
                                                        : 'bg-gray-700 text-gray-100 rounded-bl-md'
                                                }`}
                                            >
                                                {m.messageType === 'image' && m.image?.url && (
                                                    <img
                                                        src={m.image.url}
                                                        alt='attachment'
                                                        className='rounded-lg max-w-full mb-1'
                                                    />
                                                )}
                                                {m.text && (
                                                    <p className='whitespace-pre-wrap break-words text-[15px]'>
                                                        {m.text}
                                                    </p>
                                                )}
                                                <p
                                                    className={`text-[10px] mt-1 ${
                                                        mine ? 'text-blue-100/80' : 'text-gray-400'
                                                    } text-right`}
                                                >
                                                    {formatTimestamp(m.createdAt)}
                                                    {mine && (
                                                        <span className='ml-1'>
                                                            {m.seen ? '✓✓' : '✓'}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </li>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </ul>
                        )}
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                        className='border-t border-gray-700 bg-gray-800 px-4 py-3'
                    >
                        <div className='flex items-end gap-2'>
                            <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                rows={1}
                                placeholder={`Message ${selected.name}`}
                                disabled={sending}
                                className='flex-1 resize-none max-h-32 px-4 py-2 bg-gray-700
                                border border-gray-600 rounded-2xl text-white placeholder-gray-400
                                focus:outline-none focus:ring-2 focus:ring-blue-500
                                disabled:opacity-50 disabled:cursor-not-allowed'
                            />
                            <button
                                type='submit'
                                disabled={!draft.trim() || sending}
                                className='w-10 h-10 shrink-0 rounded-full bg-blue-600 hover:bg-blue-700
                                text-white flex items-center justify-center
                                disabled:opacity-50 disabled:cursor-not-allowed transition'
                                aria-label='Send'
                            >
                                {sending ? (
                                    <Loader2 size={18} className='animate-spin' />
                                ) : (
                                    <Send size={18} />
                                )}
                            </button>
                        </div>
                    </form>
                </>
            ) : (
                <div className='flex-1 flex flex-col items-center justify-center px-6 text-center'>
                    <div className='w-20 h-20 rounded-2xl bg-blue-600/15 border border-blue-600/30
                    flex items-center justify-center mb-5'>
                        <MessageCircle className='w-10 h-10 text-blue-400' />
                    </div>
                    <h1 className='text-3xl font-bold text-white mb-2'>
                        Welcome{username ? `, ${username}` : ''}
                    </h1>
                    <p className='text-gray-400 max-w-sm'>
                        Select a participant from the list to open the conversation.
                    </p>
                </div>
            )}
        </main>
    );

    return (
        <div className='flex h-screen bg-gray-900 overflow-hidden'>
            {Sidebar}
            {ChatArea}
        </div>
    );
};

export default ChatApp;
