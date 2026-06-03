"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Stage = 0 | 1 | 2 | 3 | 4;

const PASS_NODES = [
  { label: "User", action: "Initiates" },
  { label: "Oort Vault", action: "Locked" },
  { label: "Oort Guard", action: "Verified" },
  { label: "Protocol", action: "Executed" },
];

const FAIL_NODES = [
  { label: "User", action: "Refunded" },
  { label: "Oort Vault", action: "Locked" },
  { label: "Oort Guard", action: "Rejected" },
  { label: "Protocol", action: "Blocked" },
];

export default function LiveFlow() {
  const [passStage, setPassStage] = useState<Stage>(0);
  const [failStage, setFailStage] = useState<Stage>(0);
  const [failReturn, setFailReturn] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (visible && cycle === 0) setCycle(1);
  }, [visible, cycle]);

  useEffect(() => {
    if (cycle === 0) return;

    setPassStage(0);
    setFailStage(0);
    setFailReturn(false);

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Pass side
    timers.push(setTimeout(() => setPassStage(1), 600));
    timers.push(setTimeout(() => setPassStage(2), 1800));
    timers.push(setTimeout(() => setPassStage(3), 3000));
    timers.push(setTimeout(() => setPassStage(4), 4200));

    // Fail side
    timers.push(setTimeout(() => setFailStage(1), 600));
    timers.push(setTimeout(() => setFailStage(2), 1800));
    timers.push(setTimeout(() => setFailStage(3), 3000));
    timers.push(setTimeout(() => setFailReturn(true), 3800));

    // Reset and loop
    timers.push(setTimeout(() => {
      setPassStage(0);
      setFailStage(0);
      setFailReturn(false);
    }, 6800));
    timers.push(setTimeout(() => setCycle((c) => c + 1), 7200));

    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  return (
    <section id="flow" ref={sectionRef} className="h-full flex items-center px-6 py-8">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-2"
        >
          <h2 className="font-bold text-foreground tracking-tight"
            style={{ fontSize: "clamp(1.8rem, 1rem + 3vw, 3rem)" }}>
            How Funds Flow
          </h2>
          <p className="text-sm text-foreground-muted">
            Watch the verification pipeline in real time.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-6 sm:gap-10 max-w-2xl mx-auto">
          {/* PASS */}
          <div className="space-y-3">
            <div className="text-center text-xs font-mono font-bold text-accent uppercase tracking-wider">
              Verification Passed
            </div>
            <Pipeline
              nodes={PASS_NODES}
              stage={passStage}
              color="accent"
              returnFlow={false}
            />
          </div>

          {/* FAIL */}
          <div className="space-y-3">
            <div className="text-center text-xs font-mono font-bold text-danger uppercase tracking-wider">
              Verification Failed
            </div>
            <Pipeline
              nodes={FAIL_NODES}
              stage={failStage}
              color="danger"
              returnFlow={failReturn}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Pipeline({
  nodes,
  stage,
  color,
  returnFlow,
}: {
  nodes: { label: string; action: string }[];
  stage: Stage;
  color: "accent" | "danger";
  returnFlow: boolean;
}) {
  // Each node row is ~20px (dot+label), each connector is 48px
  // Node 0 top: ~10px, Node 1: 10+48+20=78, Node 2: 78+48+20=146
  const nodeSpacing = 68; // connector(48) + node height(~20)
  const userY = 10;
  const guardY = 10 + nodeSpacing * 2;

  const dotColor = color === "accent" ? "bg-accent" : "bg-danger";
  const dotGlow = color === "accent"
    ? "shadow-[0_0_12px_rgba(13,107,79,0.5)]"
    : "shadow-[0_0_12px_rgba(201,59,59,0.5)]";
  const lineActive = color === "accent" ? "bg-accent/40" : "bg-danger/40";
  const lineIdle = "bg-border";
  const textActive = color === "accent" ? "text-accent" : "text-danger";

  return (
    <div className="relative flex flex-col items-center">
      {/* Return dot — single dot that travels from Guard back to User */}
      {returnFlow && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-danger shadow-[0_0_16px_rgba(201,59,59,0.6)] z-10"
          initial={{ top: guardY }}
          animate={{ top: userY }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
        />
      )}

      {nodes.map((node, i) => {
        const reached = stage > i;
        const isCurrent = stage === i + 1;

        return (
          <div key={i} className="flex flex-col items-center w-full">
            {/* Connector line above (except first) */}
            {i > 0 && (
              <div className="relative w-full flex justify-center" style={{ height: 48 }}>
                {/* Line */}
                <div className={`w-[2px] h-full transition-colors duration-500 ${reached ? lineActive : lineIdle}`} />

                {/* Traveling dot (going down) */}
                {isCurrent && !returnFlow && (
                  <motion.div
                    className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${dotColor} ${dotGlow}`}
                    initial={{ top: 0 }}
                    animate={{ top: 48 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                  />
                )}
              </div>
            )}

            {/* Node */}
            <div className="flex items-center gap-3 w-full justify-center">
              {/* Label (left) */}
              <span className={`text-sm font-bold text-right w-20 sm:w-24 transition-colors duration-400 ${
                reached || isCurrent ? "text-foreground" : "text-foreground-muted/40"
              }`}>
                {node.label}
              </span>

              {/* Dot */}
              <motion.div
                animate={{
                  scale: isCurrent ? 1.4 : reached ? 1 : 0.7,
                  boxShadow: isCurrent
                    ? color === "accent"
                      ? "0 0 16px rgba(13,107,79,0.5)"
                      : "0 0 16px rgba(201,59,59,0.5)"
                    : "0 0 0 transparent",
                }}
                transition={{ duration: 0.4 }}
                className={`w-3 h-3 rounded-full shrink-0 transition-colors duration-400 ${
                  reached || isCurrent ? dotColor : "bg-foreground-muted/20"
                }`}
              />

              {/* Action (right) */}
              <AnimatePresence>
                {(i === 0 && returnFlow) ? (
                  <motion.span
                    key="refund"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-xs w-20 sm:w-24 text-danger font-bold"
                  >
                    Refunded
                  </motion.span>
                ) : (reached || isCurrent) && node.action && i !== 0 ? (
                  <motion.span
                    key="action"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`text-xs w-20 sm:w-24 ${
                      i === 2 && color === "danger" ? "text-danger font-medium"
                        : i === 3 && color === "danger" ? "text-foreground-muted/40"
                        : textActive
                    }`}
                  >
                    {node.action}
                  </motion.span>
                ) : (reached || isCurrent) && i === 0 ? (
                  <motion.span
                    key="init"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`text-xs w-20 sm:w-24 ${textActive}`}
                  >
                    Initiates
                  </motion.span>
                ) : (
                  <span className="w-20 sm:w-24" />
                )}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}
