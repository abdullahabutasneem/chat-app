'use client';

import axios from 'axios';
import Cookies from 'js-cookie';
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';

const OTP_LENGTH = 6;
const EXPIRY_SECONDS = 5 * 60;
const RESEND_COOLDOWN = 60;

const formatTime = (s: number): string => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const r = (s % 60).toString().padStart(2, '0');
    return `${m}:${r}`;
};

const VerifyPageInner = () => {
    const router = useRouter();
    const params = useSearchParams();
    const email = params.get('email') || '';

    const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [loading, setLoading] = useState<boolean>(false);
    const [resending, setResending] = useState<boolean>(false);
    const [expiresIn, setExpiresIn] = useState<number>(EXPIRY_SECONDS);
    const [resendIn, setResendIn] = useState<number>(RESEND_COOLDOWN);
    const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

    useEffect(() => {
        if (!email) {
            router.replace('/login');
            return;
        }
        inputsRef.current[0]?.focus();
    }, [email, router]);

    useEffect(() => {
        if (expiresIn <= 0) return;
        const id = setInterval(() => setExpiresIn((v) => Math.max(0, v - 1)), 1000);
        return () => clearInterval(id);
    }, [expiresIn]);

    useEffect(() => {
        if (resendIn <= 0) return;
        const id = setInterval(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
        return () => clearInterval(id);
    }, [resendIn]);

    const otp = useMemo(() => digits.join(''), [digits]);
    const isComplete = otp.length === OTP_LENGTH && digits.every((d) => d !== '');
    const expired = expiresIn === 0;

    const handleChange = (idx: number, raw: string): void => {
        const value = raw.replace(/\D/g, '');
        if (!value) {
            setDigits((prev) => {
                const next = [...prev];
                next[idx] = '';
                return next;
            });
            return;
        }
        if (value.length > 1) {
            const chars = value.slice(0, OTP_LENGTH - idx).split('');
            setDigits((prev) => {
                const next = [...prev];
                chars.forEach((c, i) => {
                    if (idx + i < OTP_LENGTH) next[idx + i] = c;
                });
                return next;
            });
            const nextIndex = Math.min(idx + chars.length, OTP_LENGTH - 1);
            inputsRef.current[nextIndex]?.focus();
            return;
        }
        setDigits((prev) => {
            const next = [...prev];
            next[idx] = value;
            return next;
        });
        if (idx < OTP_LENGTH - 1) {
            inputsRef.current[idx + 1]?.focus();
        }
    };

    const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
            e.preventDefault();
            const prev = idx - 1;
            setDigits((d) => {
                const n = [...d];
                n[prev] = '';
                return n;
            });
            inputsRef.current[prev]?.focus();
            return;
        }
        if (e.key === 'ArrowLeft' && idx > 0) {
            e.preventDefault();
            inputsRef.current[idx - 1]?.focus();
        }
        if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) {
            e.preventDefault();
            inputsRef.current[idx + 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
        const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (!text) return;
        e.preventDefault();
        const chars = text.split('');
        setDigits(() => {
            const next = Array(OTP_LENGTH).fill('');
            chars.forEach((c, i) => (next[i] = c));
            return next;
        });
        const focusIdx = Math.min(chars.length, OTP_LENGTH - 1);
        inputsRef.current[focusIdx]?.focus();
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        if (!isComplete || expired || loading) return;
        setLoading(true);
        try {
            const { data } = await axios.post(`http://localhost:5000/api/v1/verify`, {
                email,
                otp,
            });
            if (data?.token) {
                Cookies.set('token', data.token, { expires: 15 });
            }
            if (data?.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
            }
            alert(data.message || 'Verified successfully');
            router.push('/chat');
        } catch (error: any) {
            alert(error?.response?.data?.message || 'Verification failed');
            setDigits(Array(OTP_LENGTH).fill(''));
            inputsRef.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async (): Promise<void> => {
        if (resendIn > 0 || resending) return;
        setResending(true);
        try {
            const { data } = await axios.post(`http://localhost:5000/api/v1/login`, { email });
            alert(data.message || 'A new code has been sent');
            setDigits(Array(OTP_LENGTH).fill(''));
            setExpiresIn(EXPIRY_SECONDS);
            setResendIn(RESEND_COOLDOWN);
            inputsRef.current[0]?.focus();
        } catch (error: any) {
            alert(error?.response?.data?.message || 'Could not resend code');
        } finally {
            setResending(false);
        }
    };

    return (
        <div className='min-h-screen bg-gray-900 flex items-center justify-center p-4'>
            <div className='max-w-md w-full'>
                <div className='bg-gray-800 border border-gray-700 rounded-lg p-8'>
                    <div className='text-center mb-6'>
                        <div className='mx-auto w-20 h-20 bg-blue-600 rounded-lg flex items-center justify-center mb-6'>
                            <ShieldCheck size={40} className='text-white' />
                        </div>
                        <h1 className='text-4xl font-bold text-white mb-3'>
                            Verify your email
                        </h1>
                        <p className='text-gray-300 text-lg'>
                            We sent a 6-digit code to
                        </p>
                        <p className='text-blue-400 font-medium mt-1 break-all'>
                            {email}
                        </p>
                    </div>

                    <form className='space-y-6' onSubmit={handleSubmit}>
                        <div>
                            <label className='block text-sm font-medium text-gray-300 mb-3 text-center'>
                                Enter the verification code
                            </label>
                            <div className='flex justify-between gap-2'>
                                {digits.map((d, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => {
                                            inputsRef.current[i] = el;
                                        }}
                                        type='text'
                                        inputMode='numeric'
                                        autoComplete='one-time-code'
                                        maxLength={OTP_LENGTH}
                                        value={d}
                                        onChange={(e) => handleChange(i, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(i, e)}
                                        onPaste={handlePaste}
                                        disabled={loading || expired}
                                        className='w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-semibold
                                        bg-gray-700 border border-gray-600 rounded-lg text-white
                                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                                        disabled:opacity-50 disabled:cursor-not-allowed transition'
                                        aria-label={`Digit ${i + 1}`}
                                    />
                                ))}
                            </div>
                            <div className='mt-3 flex items-center justify-center text-sm'>
                                {expired ? (
                                    <span className='text-red-400'>
                                        Code expired - request a new one
                                    </span>
                                ) : (
                                    <span className='text-gray-400'>
                                        Code expires in{' '}
                                        <span className='text-gray-200 font-mono'>
                                            {formatTime(expiresIn)}
                                        </span>
                                    </span>
                                )}
                            </div>
                        </div>

                        <button
                            type='submit'
                            disabled={!isComplete || loading || expired}
                            className='w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold
                            rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition'
                        >
                            {loading ? (
                                <div className='flex items-center justify-center gap-2'>
                                    <Loader2 size={20} className='w-5 h-5 animate-spin' />
                                    Verifying...
                                </div>
                            ) : (
                                <div className='flex items-center justify-center gap-2'>
                                    <span>Verify & Continue</span>
                                    <ArrowRight size={20} className='w-5 h-5' />
                                </div>
                            )}
                        </button>

                        <div className='flex items-center justify-between text-sm'>
                            <button
                                type='button'
                                onClick={() => router.push('/login')}
                                className='inline-flex items-center gap-1 text-gray-400 hover:text-gray-200 transition'
                            >
                                <ArrowLeft size={16} />
                                Change email
                            </button>
                            <button
                                type='button'
                                onClick={handleResend}
                                disabled={resendIn > 0 || resending}
                                className='text-blue-400 hover:text-blue-300 disabled:text-gray-500
                                disabled:cursor-not-allowed transition'
                            >
                                {resending
                                    ? 'Sending...'
                                    : resendIn > 0
                                        ? `Resend in ${resendIn}s`
                                        : 'Resend code'}
                            </button>
                        </div>
                    </form>
                </div>

                <p className='text-center text-gray-500 text-xs mt-6'>
                    Didn&apos;t get the code? Check your spam folder.
                </p>
            </div>
        </div>
    );
};

const VerifyPage = () => (
    <Suspense
        fallback={
            <div className='min-h-screen bg-gray-900 flex items-center justify-center'>
                <Loader2 className='w-8 h-8 text-blue-500 animate-spin' />
            </div>
        }
    >
        <VerifyPageInner />
    </Suspense>
);

export default VerifyPage;
