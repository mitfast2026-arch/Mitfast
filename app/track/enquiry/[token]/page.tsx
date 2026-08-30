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
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Enquiry tracking</h1>
      {loading && <p className="text-sm text-gray-500">Loading status…</p>}
      {!loading && error && <p className="text-sm text-rose-700">{error}</p>}
      {!loading && !error && !data && (
        <p className="type-subtitle">No enquiry found for this tracking link.</p>
      )}
      {data && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-3 text-sm text-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-gray-500">Status</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
              {String(data.status).replace(/_/g, " ")}
            </span>
          </div>
          {data.productName && (
            <div>
              <span className="text-xs text-gray-500 block">Product</span>
              <span className="font-medium text-gray-900">{data.productName}</span>
            </div>
          )}
          {data.guestName && (
            <div>
              <span className="text-xs text-gray-500 block">Contact</span>
              <span className="font-medium text-gray-900">{data.guestName}</span>
            </div>
          )}
          {data.message && (
            <div>
              <span className="text-xs text-gray-500 block">Specifications</span>
              <p className="text-xs whitespace-pre-wrap text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 mt-1">
                {data.message}
              </p>
            </div>
          )}
          {data.responseMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1">
              <div className="text-[11px] font-semibold uppercase text-emerald-800">
                Response
              </div>
              <p className="text-xs whitespace-pre-wrap text-emerald-900">
                {data.responseMessage}
              </p>
              {data.respondedAt && (
                <div className="text-[10px] text-emerald-700">
                  {new Date(data.respondedAt).toLocaleString()}
                </div>
              )}
            </div>
          )}
          <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
            Submitted {new Date(data.createdAt).toLocaleString()}
          </div>
          {data.order?.trackingToken && (
            <Link
              className="text-xs text-blue-600 hover:underline block pt-1"
              href={`/track/${data.order.trackingToken}`}
            >
              Open order tracking ({data.order.orderNumber})
            </Link>
          )}
        </div>
      )}
      <div>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
