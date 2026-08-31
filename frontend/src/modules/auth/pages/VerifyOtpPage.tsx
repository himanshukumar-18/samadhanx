import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '../../../lib/apiClient';
import { Button } from '../../../shared/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { KeyRound, RotateCw, AlertCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export const VerifyOtpPage: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const emailParam = urlParams.get('email') || '';

  const [email] = useState(emailParam);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(600);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      pasted.forEach((char, i) => {
        if (i < 6) newOtp[i] = char;
      });
      setOtp(newOtp);
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value.replace(/\D/g, '');
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setErrorMsg('Please enter all 6 digits of the OTP.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const res = await apiClient.post('/auth/verify-otp', {
        email,
        otp_code: code,
        purpose: 'registration',
      });

      const isApproved = res.data?.data?.is_approved;
      toast.success('Email verified successfully!');

      if (isApproved) {
        toast('Redirecting to login...', { icon: '🚀' });
        setTimeout(() => (window.location.href = '/login'), 1500);
      } else {
        toast('Institutional account pending Admin review.', { icon: '⏳' });
        setTimeout(() => (window.location.href = '/login'), 2000);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Incorrect OTP code. Please try again.';
      setErrorMsg(msg);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setErrorMsg(null);
    try {
      await apiClient.post('/auth/resend-otp', {
        email,
        purpose: 'registration',
      });
      toast.success('A fresh OTP has been sent to your email.');
      setTimeLeft(600);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to resend OTP.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsResending(false);
    }
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <motion.div
          animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          <Card className="shadow-lg border-slate-200 dark:border-slate-800 text-center">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <CardTitle className="text-2xl">Verify Your Email</CardTitle>
              <CardDescription>
                Enter the 6-digit One-Time Password sent to <span className="font-semibold text-slate-800 dark:text-slate-200">{email || 'your email'}</span>
              </CardDescription>
            </CardHeader>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-6">
              <div className="flex justify-center gap-2 sm:gap-3">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all shadow-sm"
                  />
                ))}
              </div>

              <div className="text-xs text-slate-500 flex items-center justify-center gap-2">
                <span>Code expires in:</span>
                <span className={`font-mono font-bold ${timeLeft < 120 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>

              <Button type="submit" className="w-full" isLoading={isVerifying} rightIcon={<ArrowRight className="w-4 h-4" />}>
                Verify & Activate Account
              </Button>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending || timeLeft > 540}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  Resend OTP Code
                </button>
              </div>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
