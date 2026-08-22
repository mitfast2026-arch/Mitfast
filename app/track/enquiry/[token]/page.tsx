"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function TrackEnquiryPage() {
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
    fetch(`/api/track/enquiry/${token}`)
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
      <h1 className="type-page">Enquiry tracking</h1>
      {loading && <p className="type-subtitle">Loading status…</p>}
      {!loading && error && <p className="text-sm text-rose-700">{error}</p>}
      {!loading && !error && !data && (
        <p className="type-subtitle">No enquiry found for this tracking link.</p>
      )}
      {data && (
        <div className="saas-panel p-5 space-y-2 text-sm">
          <div>
            Status: <b>{String(data.status).replace(/_/g, " ")}</b>
          </div>
          {data.productName && <div>Product: {data.productName}</div>}
          {data.guestName && (
            <div className="text-xs text-[#6B7280]">{data.guestName}</div>
          )}
          {data.message && (
            <p className="text-xs whitespace-pre-wrap">{data.message}</p>
          )}
          {data.responseMessage && (
            <div className="rounded-lg border border-[#D1FAE5] bg-[#ECFDF5] p-3 space-y-1">
              <div className="text-[10px] font-semibold uppercase text-[#065F46]">
                Response
              </div>
              <p className="text-xs whitespace-pre-wrap text-[#065F46]">
                {data.responseMessage}
              </p>
              {data.respondedAt && (
                <div className="text-[10px] text-[#047857]">
                  {new Date(data.respondedAt).toLocaleString()}
                </div>
              )}
            </div>
          )}
          <div className="text-xs text-[#6B7280]">
            Submitted {new Date(data.createdAt).toLocaleString()}
          </div>
          {data.order?.trackingToken && (
            <Link
              className="text-xs underline"
              href={`/track/${data.order.trackingToken}`}
            >
              Open production order tracking ({data.order.orderNumber})
            </Link>
          )}
        </div>
      )}
      <Link href="/" className="saas-btn-ghost text-xs">
        Back to home
      </Link>
    </div>
  );
}
