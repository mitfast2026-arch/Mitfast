"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileQuestion,
  ArrowLeft,
  RefreshCw,
  FileText,
  ExternalLink,
  Plus,
  Clock,
  CheckCircle2,
  Building,
  HelpCircle,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function CustomerEnquiriesPage() {
  const router = useRouter();
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadEnquiries() {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth?role=buyer&mode=signin");
        return;
      }

      const res = await fetch(`/api/customer/enquiries`);
      const json = await res.json();
      if (json.success) {
        setEnquiries(json.data.enquiries || []);
      }
    } catch (err) {
      console.error("Failed to load buyer enquiries:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEnquiries();
  }, [router]);

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#6B7280] mb-1">
            <Link
              href="/customer/dashboard"
              className="hover:text-[#111315] flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Dashboard</span>
            </Link>
            <span>/</span>
            <span className="text-[#111315] font-semibold">
              Technical Enquiries
            </span>
          </div>
          <h1 className="type-page">My Custom Drawing & Technical Enquiries</h1>
          <p className="type-subtitle">
            Track engineering review, CAD model feasibility, and bespoke
            quotation feedback from MITFAST specialists.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Link
            href="/enquiry"
            className="saas-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Submit New CAD Drawing</span>
          </Link>
          <button
            onClick={loadEnquiries}
            className="saas-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Enquiries Grid */}
      <div className="space-y-4">
        {loading ? (
          <div className="saas-panel p-12 text-center text-xs text-[#6B7280]">
            Loading enquiries…
          </div>
        ) : enquiries.length === 0 ? (
          <div className="saas-panel p-12 text-center border-[#E2E4E8] space-y-3">
            <FileQuestion className="w-10 h-10 text-[#6B7280] mx-auto stroke-1" />
            <h3 className="text-base font-semibold text-[#111315]">
              No Enquiries Submitted Yet
            </h3>
            <p className="text-xs text-[#6B7280] max-w-md mx-auto">
              Upload custom engineering blueprints (STEP, IGES, DXF, or PDF) for
              custom CNC fabrication or bespoke fastening requirements.
            </p>
            <Link
              href="/enquiry"
              className="saas-btn-primary text-xs mt-2 inline-block"
            >
              Submit Custom Drawing Enquiry
            </Link>
          </div>
        ) : (
          enquiries.map((enq) => (
            <div key={enq.id} className="saas-panel p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E4E8] pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-sm text-[#111315]">
                    {enq.product?.name || "Custom Component CAD Request"}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                      enq.status === "new"
                        ? "bg-[#FEF3C7] text-[#B45309]"
                        : enq.status === "converted_to_order"
                          ? "bg-[#DCFCE7] text-[#15803D]"
                          : enq.status === "contacted"
                            ? "bg-[#E0E7FF] text-[#4338CA]"
                            : "bg-[#ECEEF0] text-[#6B7280]"
                    }`}
                  >
                    {enq.status.replace("_", " ")}
                  </span>
                </div>

                <div className="text-xs font-mono text-[#6B7280]">
                  Submitted:{" "}
                  {new Date(enq.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>

              {/* Message / Requirements */}
              <div className="space-y-2 text-xs font-mono">
                {enq.message && (
                  <div className="p-3 rounded-2xl border border-white/60 bg-white/40 text-[#444444] font-sans leading-relaxed text-xs">
                    "{enq.message}"
                  </div>
                )}

                {enq.response_message && (
                  <div className="p-3 rounded-2xl border border-[#D1FAE5] bg-[#ECFDF5] text-[#065F46] font-sans leading-relaxed text-xs space-y-1">
                    <div className="font-semibold text-[10px] uppercase tracking-wide">
                      Platform response
                    </div>
                    <p className="whitespace-pre-wrap">{enq.response_message}</p>
                    {enq.responded_at && (
                      <div className="text-[10px] text-[#047857] font-mono">
                        {new Date(enq.responded_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="text-[#6B7280] flex items-center gap-2">
                    <span>
                      Contact Reference: {enq.email || enq.guest_email}
                    </span>
                    {enq.phone && <span>• {enq.phone || enq.guest_phone}</span>}
                  </div>

                  {(enq.attachment_url || enq.file_url) && (
                    <a
                      href={enq.attachment_url || enq.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="saas-btn-ghost text-xs font-mono flex items-center gap-1.5 text-[#111315] self-start sm:self-auto"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#15803D]" />
                      <span>View Uploaded CAD Drawing</span>
                      <ExternalLink className="w-3 h-3 text-[#6B7280]" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
