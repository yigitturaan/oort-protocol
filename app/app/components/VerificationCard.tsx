import type { VerificationEntry } from "../lib/events";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}sn`;
  if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
  return `${Math.floor(diff / 3600)}sa`;
}

type LayerStatus = "pass" | "fail" | "skip";

function LayerRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: LayerStatus;
  detail?: string;
}) {
  const icon = status === "pass" ? "✅" : status === "fail" ? "❌" : "⏭️";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-4 text-center">{icon}</span>
      <span className="text-foreground/50 w-36">{label}</span>
      {detail && (
        <span className="text-foreground/40">{detail}</span>
      )}
    </div>
  );
}

export default function VerificationCard({
  entry,
}: {
  entry: VerificationEntry;
}) {
  const isVerified = entry.type === "verified";
  const borderColor = isVerified ? "border-success/40" : "border-danger/40";
  const bgColor = isVerified ? "bg-success/5" : "bg-danger/5";

  const deviationPct = (entry.deviationBps / 100).toFixed(1);
  const amountXlm = (Number(entry.amount) / 1e7).toFixed(1);

  const hashStatus: LayerStatus = "pass";
  const oracleStatus: LayerStatus =
    entry.oracleVerdict === "Passed" ? "pass" : "fail";
  const footprintStatus: LayerStatus =
    oracleStatus === "pass" ? "pass" : "skip";
  const policyStatus: LayerStatus =
    footprintStatus === "pass" ? (isVerified ? "pass" : "fail") : "skip";

  const oracleDetail =
    entry.oracleVerdict === "Passed"
      ? `%${deviationPct} sapma`
      : entry.oracleVerdict === "SoftReject"
        ? `%${deviationPct} sapma (SOFT)`
        : `%${deviationPct} sapma (HARD)`;

  return (
    <div
      className={`rounded-lg border ${borderColor} ${bgColor} p-4 space-y-3`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isVerified ? "bg-success" : "bg-danger"}`}
          />
          <span className="text-xs text-foreground/40" suppressHydrationWarning>
            {timeAgo(entry.timestamp)} ago
          </span>
          <span className="text-sm font-bold text-foreground/80">
            {shortAddr(entry.agent)}
          </span>
        </div>
        <span className="text-sm font-mono text-foreground/60">
          {amountXlm} XLM
        </span>
      </div>

      {/* Verification layers */}
      <div className="space-y-1 pl-1">
        <LayerRow label="Hash eslesmesi" status={hashStatus} />
        <LayerRow
          label="Oracle kontrolu"
          status={oracleStatus}
          detail={oracleDetail}
        />
        <LayerRow label="Footprint kontrolu" status={footprintStatus} />
        <LayerRow label="Politika uyumu" status={policyStatus} />
      </div>

      {/* Result */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <div className="flex items-center gap-2">
          {isVerified ? (
            <span className="text-success text-sm font-bold">
              DOGRULANDI
            </span>
          ) : (
            <span className="text-danger text-sm font-bold">
              REDDEDILDI
            </span>
          )}
          {isVerified ? (
            <span className="text-xs text-foreground/40">
              → fonlar gonderildi
            </span>
          ) : (
            <span className="text-xs text-foreground/40">
              → fonlar iade edildi
              {entry.slashAmount > BigInt(0) &&
                ` | ${(Number(entry.slashAmount) / 1e7).toFixed(0)} XLM slash`}
            </span>
          )}
        </div>
        {entry.reputation && (
          <span
            className={`text-xs font-mono ${
              entry.reputation.newScore > entry.reputation.oldScore
                ? "text-success"
                : "text-danger"
            }`}
          >
            {entry.reputation.oldScore} → {entry.reputation.newScore} (
            {entry.reputation.newScore - entry.reputation.oldScore > 0
              ? "+"
              : ""}
            {entry.reputation.newScore - entry.reputation.oldScore})
          </span>
        )}
      </div>
    </div>
  );
}
