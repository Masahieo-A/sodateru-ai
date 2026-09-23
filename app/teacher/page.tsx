"use client";

import { AppIcon } from "@/components/AppIcon";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TeacherLoginPage() {
  const router = useRouter();
  const redirect = "/teacher/dashboard";
  useEffect(() => {
    fetch("/api/teacher").then((res) => res.json()).then((data) => {
      if (data?.teacher) router.replace(redirect);
    }).catch(() => {});
  }, [redirect, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="text-center mb-10">
          <AppIcon name="plant" size={52} className="mb-3 text-green-600" />
          <h1 className="text-2xl font-black text-indigo-700">育てるAI</h1>
          <p className="text-sm text-gray-500 mt-1">教員ログイン</p>
        </div>

        {/* ログインカード */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3 text-center">教員ログイン</h2>
          <p className="text-sm text-gray-500 text-center mb-6">tomidah.com の Google アカウントでログインしてください。</p>
          <a href={`/api/auth/google?redirect=${encodeURIComponent(redirect)}`} className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white text-center font-bold py-2.5 px-4 rounded-xl transition text-sm">
            Google でログイン
          </a>
        </div>
      </div>
    </div>
  );
}
