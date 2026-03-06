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
    const [settings, setSettings] = useState({ memberCount: 12, currentRound: 1 });
    const [newCount, setNewCount] = useState(12);
    const [history, setHistory] = useState<any>(null);
    const [viewingHistory, setViewingHistory] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isAuthenticated) return;

        const settingsRef = ref(db, "settings");
        const unsubSettings = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setSettings({
                    memberCount: data.memberCount || 12,
                    currentRound: data.currentRound || 1
                });
                setNewCount(data.memberCount || 12);
            } else {
                // Initialize settings if missing
                set(settingsRef, { memberCount: 12, currentRound: 1 });
            }
        });

        const historyRef = ref(db, "history");
        const unsubHistory = onValue(historyRef, (snapshot) => {
            if (snapshot.exists()) {
                setHistory(snapshot.val());
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
            unsubHistory();
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

    const startNewRound = async () => {
        if (!confirm(`Are you sure you want to end Round ${settings.currentRound} and start a new one? Current results will be archived.`)) return;
        setLoading(true);
        try {
            const currentRound = settings.currentRound;

            // 1. Archive current members to history
            const roundData = {
                timestamp: Date.now(),
                members: members.filter(m => m.drawnNumber !== null),
                totalSlots: settings.memberCount
            };
            await set(ref(db, `history/round_${currentRound}`), roundData);

            // 2. Increment round number
            await update(ref(db, "settings"), { currentRound: (currentRound || 1) + 1 });

            // 3. Reset drawState (Keep Admin)
            await set(ref(db, "drawState"), {
                assignedNumbers: { "1": "admin" },
                lastAssignedTo: "admin",
                lastAssignedNumber: 1
            });

            // 4. Remove all members except Admin
            const adminMember = members.find(m => m.phone === "admin");
            const newMembersNode = {
                admin: {
                    name: adminMember?.name || "Admin",
                    phone: "admin",
                    drawnNumber: 1,
                    drawnAt: Date.now()
                }
            };

            // Overwrite the members node with only the admin
            await set(ref(db, "members"), newMembersNode);

            alert(`Round ${currentRound} archived. Round ${currentRound + 1} started!`);
        } catch (err) {
            console.error(err);
            setError("Failed to start new round.");
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

    const deleteRound = async (roundKey: string) => {
        if (!confirm(`Are you sure you want to permanently delete the records for ${roundKey.replace('_', ' ')}?`)) return;
        setLoading(true);
        try {
            await remove(ref(db, `history/${roundKey}`));
            if (viewingHistory === roundKey) {
                setViewingHistory(null);
            }
        } catch {
            setError("Failed to delete round record.");
        } finally {
            setLoading(false);
        }
    };

    const clearAllData = async () => {
        const pass = prompt("DANGER: Enter Admin Password to clear EVERYTHING (History, Members, Settings) and reset to Round 1:");
        const adminPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";

        if (pass !== adminPass) {
            if (pass !== null) alert("Incorrect password. Operation cancelled.");
            return;
        }

        if (!confirm("FINAL WARNING: This will permanently delete ALL data including history. This cannot be undone. Are you sure?")) return;

        setLoading(true);
        try {
            // 1. Wipe History
            await remove(ref(db, "history"));

            // 2. Clear Draw State (Keep Admin)
            await set(ref(db, "drawState"), {
                assignedNumbers: { "1": "admin" },
                lastAssignedTo: "admin",
                lastAssignedNumber: 1
            });

            // 3. Reset Settings to Round 1
            await set(ref(db, "settings"), { memberCount: 12, currentRound: 1 });

            // 4. Wipe members EXCEPT Admin
            const adminMember = members.find(m => m.phone === "admin");
            const newMembersNode = {
                admin: {
                    name: adminMember?.name || "Admin",
                    phone: "admin",
                    drawnNumber: 1,
                    drawnAt: Date.now()
                }
            };
            await set(ref(db, "members"), newMembersNode);

            alert("System has been fully reset to Round 1.");
            setViewingHistory(null);
        } catch (err) {
            console.error(err);
            setError("Failed to clear system data.");
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
                    <p className="text-surface-400">Round {settings.currentRound} in progress</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={startNewRound}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-400 rounded-xl transition-all text-white font-bold shadow-lg shadow-brand-500/20 active:scale-95"
                    >
                        <Users className="w-5 h-5" />
                        New Round
                    </button>
                    <button
                        onClick={clearAllData}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl transition-all text-white font-bold shadow-lg shadow-red-500/20 active:scale-95"
                    >
                        <Trash2 className="w-5 h-5" />
                        Clear All
                    </button>
                    <button
                        onClick={resetDraw}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors text-red-500 font-bold active:scale-95"
                        title="Reset Current Round"
                    >
                        <RotateCcw className={cn("w-5 h-5", loading && "animate-spin")} />
                    </button>
                </div>
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
                {/* History Panel */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass-panel p-6 rounded-3xl border-t-4 border-t-accent-500">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <RotateCcw className="text-surface-400 w-5 h-5" />
                            Round History
                        </h2>

                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {history ? (
                                Object.keys(history).reverse().map((roundKey) => (
                                    <div key={roundKey} className="relative group">
                                        <button
                                            onClick={() => setViewingHistory(viewingHistory === roundKey ? null : roundKey)}
                                            className={cn(
                                                "w-full text-left p-4 rounded-2xl border transition-all pr-12",
                                                viewingHistory === roundKey
                                                    ? "bg-brand-500/10 border-brand-500/50"
                                                    : "bg-surface-900/50 border-white/5 hover:border-white/10"
                                            )}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-white font-bold capitalize">{roundKey.replace('_', ' ')}</span>
                                                <span className="text-xs text-surface-500">
                                                    {new Date(history[roundKey].timestamp).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-sm text-surface-400">
                                                {history[roundKey].members?.length || 0} participants
                                            </p>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteRound(roundKey);
                                            }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                            title="Delete History Record"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-surface-500 text-center py-4 text-sm">No history yet.</p>
                            )}
                        </div>

                        {/* Round Detail Modal-like view */}
                        <AnimatePresence>
                            {viewingHistory && history && history[viewingHistory] && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-6 pt-6 border-t border-white/10"
                                >
                                    <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Round Results</h3>
                                    <div className="space-y-2">
                                        {(history[viewingHistory].members || [])
                                            .sort((a: any, b: any) => (a.drawnNumber || 0) - (b.drawnNumber || 0))
                                            .map((m: any) => (
                                                <div key={m.phone} className="flex justify-between items-center p-2 bg-surface-900/30 rounded-lg text-sm">
                                                    <span className="text-surface-400">{m.name}</span>
                                                    <span className="text-brand-400 font-bold">#{m.drawnNumber}</span>
                                                </div>
                                            ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
