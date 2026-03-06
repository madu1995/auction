"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ref, onValue, set, remove, update, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Trash2, RotateCcw, ShieldCheck, Users, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminPanel() {
    const [password, setPassword] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [members, setMembers] = useState<any[]>([]);
    const [settings, setSettings] = useState({ memberCount: 12 });
    const [newCount, setNewCount] = useState(12);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isAuthenticated) return;

        const settingsRef = ref(db, "settings");
        const unsubSettings = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setSettings(data);
                setNewCount(data.memberCount);
            } else {
                // Initialize settings if missing
                set(settingsRef, { memberCount: 12 });
            }
        });

        // Ensure Admin member exists with number 1
        const adminMemberRef = ref(db, "members/admin");

        get(adminMemberRef).then((snapshot: any) => {
            if (!snapshot.exists() || snapshot.val().drawnNumber !== 1) {
                update(ref(db), {
                    "members/admin": {
                        name: "Admin",
                        phone: "admin",
                        drawnNumber: 1,
                        drawnAt: Date.now()
                    },
                    "drawState/assignedNumbers/1": "admin"
                });
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

                setMembers(memberList.sort((a, b) => {
                    if (a.drawnNumber && b.drawnNumber) return a.drawnNumber - b.drawnNumber;
                    if (a.drawnNumber) return -1;
                    if (b.drawnNumber) return 1;
                    return 0;
                }));
            } else {
                setMembers([]);
            }
        });

        return () => {
            unsubSettings();
            unsubMembers();
        };
    }, [isAuthenticated]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Default admin password for prototype
        const adminPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";
        if (password === adminPass) {
            setIsAuthenticated(true);
            setError("");
        } else {
            setError("Invalid admin password.");
        }
    };

    const updateMemberCount = async () => {
        if (newCount < members.length) {
            setError("Cannot reduce member count below current active members!");
            return;
        }
        setLoading(true);
        try {
            await update(ref(db, "settings"), { memberCount: newCount });
            setError("");
        } catch {
            setError("Failed to update settings.");
        } finally {
            setLoading(false);
        }
    };

    const deleteMember = async (phone: string) => {
        if (phone === "admin") return;
        if (!confirm("Are you sure you want to remove this member?")) return;
        try {
            // Find member to check if they have a drawn number
            const member = members.find(m => m.phone === phone);

            // Remove from members
            await remove(ref(db, `members/${phone}`));

            // Remove from drawState if they have a drawn number
            if (member?.drawnNumber) {
                await remove(ref(db, `drawState/assignedNumbers/${member.drawnNumber}`));
            }
        } catch {
            setError("Failed to delete member.");
        }
    };

    const resetDraw = async () => {
        if (!confirm("WARNING: This will erase all drawn numbers. Members will stay, but their numbers will be reset. Proceed?")) return;
        setLoading(true);
        try {
            // 1. Reset drawState but KEEP number 1 for Admin
            await set(ref(db, "drawState"), {
                assignedNumbers: {
                    "1": "admin"
                },
                lastAssignedTo: "admin",
                lastAssignedNumber: 1
            });

            // 2. Clear all drawn numbers from members EXCEPT Admin
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updates: any = {};
            members.forEach(m => {
                if (m.phone === "admin") {
                    updates[`members/${m.phone}/drawnNumber`] = 1;
                    updates[`members/${m.phone}/drawnAt`] = Date.now();
                } else {
                    updates[`members/${m.phone}/drawnNumber`] = null;
                    updates[`members/${m.phone}/drawnAt`] = null;
                }
            });

            if (Object.keys(updates).length > 0) {
                await update(ref(db), updates);
            }

        } catch {
            setError("Failed to reset the draw.");
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="w-full max-w-sm mx-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-panel p-8 rounded-3xl"
                >
                    <div className="text-center mb-8">
                        <ShieldCheck className="w-12 h-12 mx-auto text-brand-500 mb-4" />
                        <h1 className="text-2xl font-black font-outfit text-white">Admin Access</h1>
                        <p className="text-surface-400 text-sm mt-2">Protected area. Enter password.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <p className="text-red-400 text-sm text-center mb-4 bg-red-500/10 p-2 rounded-xl border border-red-500/20">{error}</p>
                        )}
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Admin Password"
                            className="w-full px-4 py-3 bg-surface-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-white placeholder-gray-500"
                            required
                        />
                        <button
                            type="submit"
                            className="w-full bg-white text-surface-900 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            Unlock
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl mx-auto py-8">
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-6 border-b border-surface-700/50 gap-4">
                <div>
                    <h1 className="text-3xl font-black font-outfit text-white flex items-center gap-3">
                        <Settings className="text-brand-500" />
                        Admin <span className="gradient-text">Console</span>
                    </h1>
                    <p className="text-surface-400">Total System Control</p>
                </div>

                <button
                    onClick={resetDraw}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors text-red-500 font-bold active:scale-95"
                >
                    <RotateCcw className={cn("w-5 h-5", loading && "animate-spin")} />
                    Reset Entire Draw
                </button>
            </header>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Settings Panel */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass-panel p-6 rounded-3xl border-t-4 border-t-brand-500">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Users className="text-surface-400 w-5 h-5" />
                            Capacity Status
                        </h2>

                        <div className="mb-6">
                            <label className="text-sm font-medium text-surface-400 block mb-2">Total Member Slots</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    value={newCount}
                                    onChange={e => setNewCount(parseInt(e.target.value) || 0)}
                                    className="w-full bg-surface-900 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                                    min={members.length}
                                />
                                <button
                                    onClick={updateMemberCount}
                                    disabled={loading || newCount === settings.memberCount}
                                    className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition-all"
                                >
                                    Save
                                </button>
                            </div>
                        </div>

                        <div className="p-4 bg-surface-900/50 rounded-2xl border border-white/5">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-surface-400">Slots Used</span>
                                <span className="text-white font-bold">{members.length}</span>
                            </div>
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-surface-400">Available</span>
                                <span className="text-brand-400 font-bold">{settings.memberCount - members.length}</span>
                            </div>

                            <div className="w-full bg-surface-800 rounded-full h-2.5">
                                <div
                                    className="bg-brand-500 h-2.5 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, (members.length / settings.memberCount) * 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Member List */}
                <div className="lg:col-span-2">
                    <div className="glass-panel p-6 rounded-3xl">
                        <h2 className="text-xl font-bold text-white mb-6">Registered Members ({members.length})</h2>

                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            <AnimatePresence>
                                {members.map((member) => (
                                    <motion.div
                                        key={member.phone}
                                        layout
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="flex items-center justify-between p-4 bg-surface-900/50 border border-white/5 rounded-2xl group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl border",
                                                member.drawnNumber
                                                    ? "bg-brand-500 text-white border-brand-400/50 shadow-[0_0_15px_-3px_rgba(99,102,241,0.5)]"
                                                    : "bg-surface-800 text-surface-500 border-surface-700"
                                            )}>
                                                {member.drawnNumber || "?"}
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-lg">{member.name}</p>
                                                <p className="text-sm text-surface-400 font-mono tracking-wide">{member.phone}</p>
                                            </div>
                                        </div>

                                        {member.phone !== "admin" && (
                                            <button
                                                onClick={() => deleteMember(member.phone)}
                                                className="p-3 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                title="Delete Member"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {members.length === 0 && (
                                <div className="text-center py-12 text-surface-500">
                                    Waiting for members to join the draw...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
