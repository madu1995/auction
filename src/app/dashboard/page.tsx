"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ref, onValue, runTransaction, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { Confetti } from "@/components/Confetti";
import { LogOut, RefreshCw, Trophy } from "lucide-react";

export default function Dashboard() {
    const router = useRouter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [user, setUser] = useState<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [members, setMembers] = useState<any[]>([]);
    const [settings, setSettings] = useState({ memberCount: 12 });
    const [drawing, setDrawing] = useState(false);
    const [error, setError] = useState("");
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        const userData = localStorage.getItem("auction_user");
        if (!userData) {
            router.push("/");
            return;
        }
        setUser(JSON.parse(userData));

        const settingsRef = ref(db, "settings");
        const unsubSettings = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                setSettings(snapshot.val());
            }
        });

        const membersRef = ref(db, "members");
        const unsubMembers = onValue(membersRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const memberList = Object.keys(data).map((key) => ({
                    phone: key,
                    ...data[key],
                }));

                // Always up-to-date user instance
                const currentUser = memberList.find(m => m.phone === JSON.parse(userData).phone);
                if (currentUser) setUser(currentUser);

                setMembers(memberList.sort((a, b) => {
                    // Sort by number, then unassigned
                    if (a.drawnNumber && b.drawnNumber) return a.drawnNumber - b.drawnNumber;
                    if (a.drawnNumber) return -1;
                    if (b.drawnNumber) return 1;
                    return 0;
                }));
            }
        });

        return () => {
            unsubSettings();
            unsubMembers();
        };
    }, [router]);

    const handleDrawNumber = async () => {
        if (!user || drawing || user.drawnNumber) return;
        setDrawing(true);
        setError("");

        try {
            const stateRef = ref(db, 'drawState');

            const transactionResult = await runTransaction(stateRef, (state) => {
                // Initialize state if empty
                if (!state) {
                    state = { assignedNumbers: {} };
                }
                if (!state.assignedNumbers) {
                    state.assignedNumbers = {};
                }

                // If user already assigned, abort
                const values = Object.values(state.assignedNumbers) as string[];
                if (values.includes(user.phone)) {
                    return undefined; // Already drawn (prevents overwrite)
                }

                // Available numbers between 1 and memberCount
                const available = [];
                for (let i = 1; i <= settings.memberCount; i++) {
                    if (!state.assignedNumbers[i]) {
                        available.push(i);
                    }
                }

                if (available.length === 0) {
                    return state; // No numbers left
                }

                // Pick random
                const randomIndex = Math.floor(Math.random() * available.length);
                const picked = available[randomIndex];

                state.assignedNumbers[picked] = user.phone;
                state.lastAssignedTo = user.phone;
                state.lastAssignedNumber = picked;

                return state;
            });

            if (!transactionResult.committed) {
                setError("You already have a number or transaction failed.");
                setDrawing(false);
                return;
            }

            // Read back what was assigned 
            const newState = transactionResult.snapshot.val();

            // If no valid draw happened (e.g., all numbers taken)
            if (newState.lastAssignedTo !== user.phone) {
                setError("No numbers available!");
                setDrawing(false);
                return;
            }

            const assignedNumber = newState.lastAssignedNumber;

            // Update user node
            await update(ref(db, `members/${user.phone}`), {
                drawnNumber: assignedNumber,
                drawnAt: Date.now()
            });

            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);

        } catch (err) {
            console.error(err);
            setError("Something went wrong while drawing.");
        } finally {
            setDrawing(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("auction_user");
        router.push("/");
    };

    if (!user) return null;

    return (
        <div className="w-full max-w-4xl mx-auto py-8">
            {showConfetti && <Confetti />}

            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-6 border-b border-surface-700/50 gap-4">
                <div>
                    <h1 className="text-3xl font-black font-outfit text-white">Live <span className="gradient-text">Draw</span> Dashboard</h1>
                    <p className="text-surface-400">Welcome, <span className="font-semibold text-white">{user.name}</span></p>
                </div>

                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-surface-800 rounded-xl transition-colors text-red-400 font-medium"
                >
                    <LogOut className="w-4 h-4" />
                    Leave
                </button>
            </header>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm font-medium">
                    {error}
                </div>
            )}

            {/* Main Feature: Draw Number */}
            <div className="flex flex-col items-center justify-center p-8 glass-panel rounded-3xl mb-12 shadow-[0_0_50px_-12px_rgba(99,102,241,0.2)]">
                {user.drawnNumber ? (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center"
                    >
                        <h2 className="text-xl font-medium text-surface-400 mb-4 uppercase tracking-widest">Your Lucky Number</h2>
                        <div className="w-48 h-48 mx-auto flex items-center justify-center bg-gradient-to-br from-brand-600 to-accent-500 rounded-full shadow-[0_0_60px_-10px_rgba(236,72,153,0.5)] border-4 border-white/20">
                            <span className="text-7xl font-black font-outfit text-white drop-shadow-lg">{user.drawnNumber}</span>
                        </div>
                    </motion.div>
                ) : (
                    <div className="text-center w-full max-w-md">
                        <Trophy className="w-16 h-16 mx-auto mb-6 text-brand-500/50" />
                        <h2 className="text-2xl font-bold text-white mb-2">Ready for the draw?</h2>
                        <p className="text-surface-400 mb-8">Click the button below to receive your unique and permanent number.</p>

                        <button
                            onClick={handleDrawNumber}
                            disabled={drawing}
                            className="w-full relative group"
                        >
                            <div className="absolute -inset-1 bg-gradient-to-r from-brand-600 to-accent-600 rounded-2xl blur opacity-30 group-hover:opacity-75 transition duration-500"></div>
                            <div className="relative w-full flex items-center justify-center gap-2 bg-surface-800 border-2 border-brand-500 text-white p-6 rounded-2xl font-bold text-xl hover:bg-surface-700 transition-all active:scale-[0.98]">
                                {drawing ? (
                                    <RefreshCw className="w-6 h-6 animate-spin text-brand-400" />
                                ) : (
                                    <span>Draw My Number</span>
                                )}
                            </div>
                        </button>
                    </div>
                )}
            </div>

            {/* Live List */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold font-outfit">Members List</h3>
                    <span className="bg-surface-800 px-3 py-1 rounded-full text-sm font-medium text-surface-400 border border-white/5">
                        {members.length} / {settings.memberCount} Participants
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence>
                        {members.map((member) => (
                            <motion.div
                                key={member.phone}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center justify-between p-4 bg-surface-800/40 border border-white/5 rounded-2xl hover:bg-surface-800/80 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-surface-700 flex items-center justify-center font-bold text-surface-400 uppercase">
                                        {member.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white leading-tight">{member.name}</p>
                                        <p className="text-xs text-surface-500 mt-1">{member.phone}</p>
                                    </div>
                                </div>

                                {member.drawnNumber ? (
                                    <div className="w-12 h-12 rounded-xl bg-brand-500/10 text-brand-400 font-black text-xl flex items-center justify-center border border-brand-500/20 shadow-inner">
                                        {member.drawnNumber}
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 rounded-xl bg-surface-700/30 text-surface-600 font-medium text-sm flex items-center justify-center border border-surface-600/20">
                                        --
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {members.length === 0 && (
                        <div className="col-span-full py-12 text-center text-surface-500">
                            No members have joined yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
