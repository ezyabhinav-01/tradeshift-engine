import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const signInSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

type SignInValues = z.infer<typeof signInSchema>;

const SignIn = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = React.useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<SignInValues>({
        resolver: zodResolver(signInSchema),
    });

    const onSubmit = async (data: SignInValues) => {
        try {
            setError(null);
            await login(data);
            toast.success("Signed in successfully!");
            navigate('/'); // Redirect to dashboard/home after login
        } catch (err: any) {
            console.error("Login failed", err);
            const errorMessage = err.response?.data?.detail || "Invalid email or password";
            setError(errorMessage);
            toast.error("Login failed", {
                description: errorMessage
            });
        }
    };

    return (
        <div className="flex h-full w-full items-center justify-center">
            <Card className="w-full max-w-md border border-white/5 bg-[#141414] rounded-2xl shadow-2xl relative overflow-hidden group mx-auto">
                <CardHeader className="space-y-1 text-center pb-6 pt-8">
                    <CardTitle className="text-3xl font-extrabold tracking-tight text-white mb-1">Welcome Back</CardTitle>
                    <CardDescription className="text-slate-400 text-[13px]">
                        Enter your credentials to access the terminal
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 px-8">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {error && (
                            <div className="p-3 rounded-md bg-rose-500/10 text-rose-400 text-sm font-medium border border-rose-500/20 flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-200 text-xs font-semibold">Email</Label>
                            <Input
                                id="email"
                                placeholder="name@example.com"
                                className="bg-[#0A0A0A] border-white/5 text-white placeholder:text-slate-600 focus:border-[#4A72FF]/50 focus:ring-[#4A72FF]/20 h-11 transition-all rounded-lg"
                                {...register('email')}
                            />
                            {errors.email && <p className="text-rose-400 text-xs mt-1">{errors.email.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-slate-200 text-xs font-semibold">Password</Label>
                                <Link
                                    to="/auth/forgot-password"
                                    className="text-[11px] font-medium text-[#4A72FF] hover:text-[#3b5bdb] transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                className="bg-[#0A0A0A] border-white/5 text-white focus:border-[#4A72FF]/50 focus:ring-[#4A72FF]/20 h-11 transition-all rounded-lg"
                                {...register('password')}
                            />
                            {errors.password && <p className="text-rose-400 text-xs mt-1">{errors.password.message}</p>}
                        </div>
                        <Button
                            className="w-full h-11 mt-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all font-semibold rounded-lg text-sm"
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                    <span>Signing in...</span>
                                </div>
                            ) : 'Sign In'}
                        </Button>
                    </form>
                </CardContent>
                <div className="flex justify-center pb-8 pt-2">
                    <p className="text-xs font-medium text-slate-400">
                        Don't have an account?{' '}
                        <Link to="/auth/sign-up" className="font-semibold text-[#4A72FF] hover:text-[#3b5bdb] transition-colors">
                            Create account
                        </Link>
                    </p>
                </div>
            </Card>
        </div>
    );
};

export default SignIn;
