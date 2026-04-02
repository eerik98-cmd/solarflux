'use client';

import { Login } from '@/components/Login';
import { useApp } from '@/app/providers';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { users, setCurrentUser } = useApp();

  console.log(users);
  
  const router = useRouter();

  const handleLogin = (username: string, password: string) => {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      setCurrentUser(user);
      router.push('/dashboard');
    } else {
      throw new Error("Invalid credentials");
    }
  };

  return <Login onLogin={handleLogin} />;
}