"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function TrackOrderPage() {
  const params = useParams();
  const token = String(params.token || "");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || token === "undefined") {
      setError("Invalid or missing tracking link.");
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/track/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError(json.error?.message || "Not found");
      })
      .catch(() => setError("Unable to load tracking status"))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="container-custom py-12 max-w-xl space-y-4">
      <h1 className="type-page">Production order tracking</h1>
      {loading && <p className="type-subtitle">Loading status…</p>}
      {!loading && error && <p className="text-sm text-rose-700">{error}</p>}
      {!loading && !error && !data && (
        <p className="type-subtitle">No production order found for this tracking link.</p>
      )}
      {data && (
        <div className="saas-panel p-5 space-y-3 text-sm">
          <div className="font-mono font-bold">{data.orderNumber}</div>
          <div>
            Fulfillment: <b>{String(data.status).replace(/_/g, " ")}</b>
          </div>
          <div>
            Payment: <b>{String(data.paymentStatus).replace(/_/g, " ")}</b>
          </div>
          {data.total != null && (
            <div>
              Total: <b>₹{Number(data.total).toLocaleString("en-IN")}</b>
            </div>
          )}
          {data.subtotal != null && (
            <div className="text-xs text-[#6B7280]">
              Subtotal: ₹{Number(data.subtotal).toLocaleString("en-IN")}
            </div>
          )}
          <ul className="text-xs space-y-1">
            {data.items?.map((item: any, idx: number) => (
              <li key={idx}>
                {item.name} × {item.quantity}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link href="/" className="saas-btn-ghost text-xs">
        Back to home
      </Link>
    </div>
  );
}
