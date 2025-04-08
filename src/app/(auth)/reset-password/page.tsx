'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { auth } from '@/lib/firebase/config';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [formError, setFormError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');
  
  useEffect(() => {
    if (!oobCode) {
      setFormError('Invalid password reset link. Please request a new one.');
      setIsVerifying(false);
      return;
    }
    
    // Verify the reset code
    const verifyCode = async () => {
      try {
        const email = await verifyPasswordResetCode(auth, oobCode);
        setEmail(email);
      } catch (error) {
        console.error('Code verification error:', error);
        setFormError('Invalid or expired reset link. Please request a new one.');
      } finally {
        setIsVerifying(false);
      }
    };
    
    verifyCode();
  }, [oobCode]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    if (!oobCode) {
      setFormError('Invalid password reset link. Please request a new one.');
      return;
    }
    
    // Validate password
    if (newPassword.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setIsSuccess(true);
      
      // Redirect to login after a delay
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error: any) {
      console.error('Reset password error:', error);
      setFormError(error.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isVerifying) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Reset Password</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-fairway"></div>
        </CardContent>
      </Card>
    );
  }
  
  if (isSuccess) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Password Reset</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-md text-center">
            <p className="font-medium">Your password has been reset successfully!</p>
            <p className="mt-2">You will be redirected to the login page...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Reset Password</CardTitle>
        {email && (
          <CardDescription className="text-center">
            Create a new password for {email}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {formError && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md mb-4 text-sm">
            {formError}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            disabled={isLoading}
            helper="Must be at least 6 characters"
          />
          
          <Input
            type="password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
          />
          
          <Button 
            type="submit" 
            className="w-full" 
            isLoading={isLoading}
          >
            Reset Password
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <Link href="/login" className="text-green-fairway hover:underline">
            Back to login
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}