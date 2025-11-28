'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to survey page - we're focusing on survey-based UI only
    router.push('/survey');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to survey...</p>
      </div>
    </div>
  );
}
