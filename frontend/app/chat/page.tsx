'use client';

import { ArrowLeft, MessageCircle } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

interface Participant {
    id: string;
    name: string;
    email?: string;
}

// Placeholder participants — just so the layout is visible.
// Will be replaced by data from the backend when fetching is wired up.
const placeholderParticipants: Participant[] = [
    
];

const getInitials = (name: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const ChatApp = () => {
    const [username, setUsername] = useState<string>('');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('user');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.name) setUsername(parsed.name);
            }
        } catch {
            // ignore
        }
    }, []);

    const selected = useMemo(
        () => placeholderParticipants.find((p) => p.id === selectedId) || null,
        [selectedId]
    );

    const Sidebar = (
        <aside
            className={`${
                selectedId ? 'hidden md:flex' : 'flex'
            } flex-col w-full md:w-80 lg:w-96 bg-gray-800 border-r border-gray-700 h-screen`}
        >
            <div className='px-5 py-4 border-b border-gray-700'>
                <h2 className='text-xl font-semibold text-white'>Chats</h2>
                {username && (
                    <p className='text-sm text-gray-400 mt-0.5'>Signed in as {username}</p>
                )}
            </div>

            <div className='flex-1 overflow-y-auto'>
                <ul>
                    {placeholderParticipants.map((p) => {
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
                    <div className='flex-1' />
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
