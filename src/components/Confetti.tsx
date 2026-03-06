"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

interface ConfettiProps {
    duration?: number;
}

export function Confetti({ duration = 3000 }: ConfettiProps) {
    useEffect(() => {
        const end = Date.now() + duration;

        const colors = ["#6366f1", "#ec4899", "#ffffff", "#e0e7ff"];

        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors,
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors,
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        })();
    }, [duration]);

    return null;
}
