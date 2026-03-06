"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ref, get, set } from "firebase/database";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import { LogIn, Phone, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const existingUser = localStorage.getItem("auction_user");
    if (existingUser) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || phone.length < 9) {
      setError("Please enter a valid name and phone number.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Clean phone number (alphanumeric only)
      const cleanPhone = phone.replace(/[^0-9+]/g, "");
      const userRef = ref(db, `members/${cleanPhone}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        // Login existing user
        localStorage.setItem("auction_user", JSON.stringify(data));
      } else {
        // Create new user
        const newUser = {
          name: name.trim(),
          phone: cleanPhone,
          drawnNumber: null,
          drawnAt: null,
        };
        await set(userRef, newUser);
        localStorage.setItem("auction_user", JSON.stringify(newUser));
      }

      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Failed to connect to the database. Please check your network.");
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="w-full max-w-md mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-8 rounded-3xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-accent-500" />

        <div className="text-center mb-8">
          <h1 className="text-4xl font-black font-outfit mb-2 text-white">
            Auction <span className="gradient-text">Seettu</span>
          </h1>
          <p className="text-surface-700 dark:text-gray-400">Join the live lottery secure draw</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                <UserIcon className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="w-full pl-12 pr-4 py-4 bg-surface-900/50 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-white placeholder-gray-500 transition-all font-medium"
                required
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                <Phone className="w-5 h-5" />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone Number"
                className="w-full pl-12 pr-4 py-4 bg-surface-900/50 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-white placeholder-gray-500 transition-all font-medium"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white p-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand-500/30 transition-all transform active:scale-95",
              loading && "opacity-70 cursor-not-allowed"
            )}
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <>
                <span>Enter Draw</span>
                <LogIn className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
