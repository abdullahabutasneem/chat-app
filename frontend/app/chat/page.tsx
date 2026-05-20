'use client';

import axios from 'axios';
import Cookies from 'js-cookie';
import { ArrowLeft, ImagePlus, Loader2, LogOut, MessageCircle, Search, Send, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState } from 'react';

interface Participant {
    id: string;
    name: string;
    email?: string;
    unseenCount: number;
}

interface ChatListEntry {
    user: { _id: string; name: string; email?: string };
    chat: { _id: string; unseenCount?: number };
}

interface DirectoryUser {
    _id: string;
    name: string;
    email?: string;
}

const formatUnseen = (n: number): string => (n > 99 ? '99+' : String(n));

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
    const [attachment, setAttachment] = useState<File | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [directory, setDirectory] = useState<DirectoryUser[]>([]);
    const [searching, setSearching] = useState<boolean>(false);
    const [openingChatWith, setOpeningChatWith] = useState<string | null>(null);
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
                    unseenCount: e.chat?.unseenCount ?? 0,
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
        setAttachment(null);
        setAttachmentPreview('');
    }, [selectedId]);

    useEffect(() => {
        if (!attachment) {
            setAttachmentPreview('');
            return;
        }
        const url = URL.createObjectURL(attachment);
        setAttachmentPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [attachment]);

    const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Only image files are supported.');
            return;
        }
        setAttachment(file);
    };

    const clearAttachment = (): void => {
        setAttachment(null);
    };

    const handleSend = async (): Promise<void> => {
        const text = draft.trim();
        if ((!text && !attachment) || !selectedId || sending) return;
        const token = Cookies.get('token');
        if (!token) {
            router.replace('/login');
            return;
        }

        setSending(true);
        try {
            let response;
            if (attachment) {
                const form = new FormData();
                form.append('chatId', selectedId);
                if (text) form.append('text', text);
                form.append('image', attachment);
                response = await axios.post(
                    'http://localhost:5002/api/v1/message',
                    form,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } else {
                response = await axios.post(
                    'http://localhost:5002/api/v1/message',
                    { chatId: selectedId, text },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
            const saved: ChatMessage | undefined = response.data?.message;
            if (saved) {
                setMessages((prev) => [...prev, saved]);
            }
            setDraft('');
            setAttachment(null);
            requestAnimationFrame(() => draftInputRef.current?.focus());
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
        const q = searchQuery.trim();
        if (!q || directory.length > 0 || searching) return;
        const token = Cookies.get('token');
        if (!token) {
            router.replace('/login');
            return;
        }
        setSearching(true);
        axios
            .get('http://localhost:5000/api/v1/user/all', {
                headers: { Authorization: `Bearer ${token}` },
            })
            .then(({ data }) => {
                const list: DirectoryUser[] = Array.isArray(data) ? data : data?.users || [];
                setDirectory(list);
            })
            .catch((error: any) => {
                if (error?.response?.status === 401) {
                    router.replace('/login');
                } else {
                    console.error('Failed to load users:', error);
                    alert(
                        error?.response?.data?.message ||
                            error?.message ||
                            'Failed to load users. Check the browser console.'
                    );
                }
            })
            .finally(() => setSearching(false));
    }, [searchQuery, directory.length, searching, router]);

    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return [] as DirectoryUser[];
        return directory
            .filter((u) => u._id !== currentUserId)
            .filter(
                (u) =>
                    u.name?.toLowerCase().includes(q) ||
                    u.email?.toLowerCase().includes(q)
            )
            .slice(0, 20);
    }, [searchQuery, directory, currentUserId]);

    const startChatWith = async (other: DirectoryUser): Promise<void> => {
        if (openingChatWith) return;
        const token = Cookies.get('token');
        if (!token) {
            router.replace('/login');
            return;
        }
        setOpeningChatWith(other._id);
        try {
            const { data } = await axios.post(
                'http://localhost:5002/api/v1/chat/new',
                { otherUserId: other._id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const chatId: string | undefined = data?.chatId;
            if (!chatId) throw new Error('No chatId returned');

            setParticipants((prev) => {
                if (prev.some((p) => p.id === chatId)) return prev;
                const fresh: Participant = {
                    id: chatId,
                    name: other.name,
                    email: other.email,
                    unseenCount: 0,
                };
                return [fresh, ...prev];
            });
            setSearchQuery('');
            setSelectedId(chatId);
        } catch (error: any) {
            if (error?.response?.status === 401) {
                router.replace('/login');
            } else {
                console.error('Failed to open chat:', error);
                alert(
                    error?.response?.data?.message ||
                        error?.message ||
                        'Could not open chat. Check the browser console.'
                );
            }
        } finally {
            setOpeningChatWith(null);
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

        setParticipants((prev) =>
            prev.map((p) => (p.id === selectedId ? { ...p, unseenCount: 0 } : p))
        );

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

            <div className='px-4 py-3 border-b border-gray-700'>
                <div className='relative'>
                    <Search
                        size={16}
                        className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none'
                    />
                    <input
                        type='text'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder='Search people to chat with'
                        className='w-full pl-9 pr-9 py-2 bg-gray-700/70 border border-gray-600
                        rounded-full text-sm text-white placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    />
                    {searchQuery && (
                        <button
                            type='button'
                            onClick={() => setSearchQuery('')}
                            className='absolute right-2 top-1/2 -translate-y-1/2 text-gray-400
                            hover:text-white p-1 rounded-full'
                            aria-label='Clear search'
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className='flex-1 overflow-y-auto'>
                {searchQuery.trim() ? (
                    searching && directory.length === 0 ? (
                        <div className='h-full flex items-center justify-center'>
                            <Loader2 className='w-6 h-6 text-blue-500 animate-spin' />
                        </div>
                    ) : searchResults.length === 0 ? (
                        <div className='h-full flex flex-col items-center justify-center text-center px-6'>
                            <Search className='w-8 h-8 text-gray-500 mb-2' />
                            <p className='text-gray-400 text-sm'>
                                No people match &ldquo;{searchQuery}&rdquo;
                            </p>
                        </div>
                    ) : (
                        <ul>
                            <li className='px-5 pt-3 pb-1 text-[11px] uppercase tracking-wider text-gray-500'>
                                Suggestions
                            </li>
                            {searchResults.map((u) => {
                                const busy = openingChatWith === u._id;
                                return (
                                    <li key={u._id}>
                                        <button
                                            disabled={busy}
                                            onClick={() => startChatWith(u)}
                                            className='w-full flex items-center gap-3 px-5 py-3 text-left
                                            border-b border-gray-700/60 transition
                                            hover:bg-gray-700/60 disabled:opacity-60
                                            disabled:cursor-not-allowed'
                                        >
                                            <div className='w-11 h-11 rounded-full bg-emerald-600 text-white
                                            flex items-center justify-center font-semibold shrink-0'>
                                                {getInitials(u.name)}
                                            </div>
                                            <div className='min-w-0 flex-1'>
                                                <p className='text-white font-medium truncate'>
                                                    {u.name}
                                                </p>
                                                {u.email && (
                                                    <p className='text-xs text-gray-400 truncate'>
                                                        {u.email}
                                                    </p>
                                                )}
                                            </div>
                                            {busy && (
                                                <Loader2 className='w-4 h-4 text-blue-400 animate-spin shrink-0' />
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )
                ) : loading ? (
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
                                            <div className='flex items-center gap-2'>
                                                <p className='text-white font-medium truncate flex-1'>
                                                    {p.name}
                                                </p>
                                                {p.unseenCount > 0 && (
                                                    <span
                                                        className='shrink-0 min-w-[22px] h-[22px] px-1.5
                                                        inline-flex items-center justify-center
                                                        text-[11px] font-bold text-white rounded-full
                                                        bg-gradient-to-br from-red-500 to-rose-600
                                                        shadow-[0_0_0_2px_rgba(239,68,68,0.15),0_4px_12px_-2px_rgba(239,68,68,0.6)]
                                                        ring-1 ring-red-400/40 animate-pulse'
                                                        aria-label={`${p.unseenCount} unread messages`}
                                                    >
                                                        {formatUnseen(p.unseenCount)}
                                                    </span>
                                                )}
                                            </div>
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
                        {attachment && attachmentPreview && (
                            <div className='mb-2 flex items-center gap-3 bg-gray-700/60 border
                            border-gray-600 rounded-xl p-2 pr-3'>
                                <img
                                    src={attachmentPreview}
                                    alt='preview'
                                    className='w-14 h-14 rounded-lg object-cover border border-gray-600 shrink-0'
                                />
                                <div className='min-w-0 flex-1'>
                                    <p className='text-sm text-white truncate'>
                                        {attachment.name}
                                    </p>
                                    <p className='text-xs text-gray-400'>
                                        {(attachment.size / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                                <button
                                    type='button'
                                    onClick={clearAttachment}
                                    disabled={sending}
                                    className='shrink-0 w-7 h-7 rounded-full bg-gray-600/70 hover:bg-gray-600
                                    text-gray-200 hover:text-white flex items-center justify-center
                                    disabled:opacity-50'
                                    aria-label='Remove attachment'
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        <div className='flex items-end gap-2'>
                            <input
                                ref={fileInputRef}
                                type='file'
                                accept='image/*'
                                onChange={handlePickFile}
                                className='hidden'
                            />
                            <button
                                type='button'
                                onClick={() => fileInputRef.current?.click()}
                                disabled={sending}
                                className='w-10 h-10 shrink-0 rounded-full bg-gray-700/70 hover:bg-gray-700
                                text-gray-300 hover:text-white border border-gray-600
                                flex items-center justify-center transition
                                disabled:opacity-50 disabled:cursor-not-allowed'
                                aria-label='Attach image'
                                title='Attach image'
                            >
                                <ImagePlus size={18} />
                            </button>
                            <textarea
                                ref={draftInputRef}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                rows={1}
                                placeholder={
                                    attachment
                                        ? 'Add a caption (optional)'
                                        : `Message ${selected.name}`
                                }
                                disabled={sending}
                                className='flex-1 resize-none max-h-32 px-4 py-2 bg-gray-700
                                border border-gray-600 rounded-2xl text-white placeholder-gray-400
                                focus:outline-none focus:ring-2 focus:ring-blue-500
                                disabled:opacity-50 disabled:cursor-not-allowed'
                            />
                            <button
                                type='submit'
                                disabled={(!draft.trim() && !attachment) || sending}
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
