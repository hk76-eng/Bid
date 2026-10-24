import React, { useState, useEffect, useRef } from 'react';
import { X, Send, UploadCloud, Image as ImageIcon, CheckCircle2, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { TopupDepositRequest, TopupChatMessage } from '../../types/motoride';
import { motorideApi } from '../../services/motorideApi';
import { realtimeSync } from '../../services/realtimeSync';
import { compressImage } from '../../utils/imageCompressor';

interface TopupChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  depositRequest: TopupDepositRequest;
  currentUserId: string;
  currentUserRole: 'admin' | 'captain';
  currentUserName: string;
  onStatusUpdated?: () => void;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string, reason?: string) => Promise<void>;
}

export const TopupChatModal: React.FC<TopupChatModalProps> = ({
  isOpen,
  onClose,
  depositRequest,
  currentUserId,
  currentUserRole,
  currentUserName,
  onStatusUpdated,
  onApprove,
  onReject,
}) => {
  const [messages, setMessages] = useState<TopupChatMessage[]>([]);
  const [text, setText] = useState<string>('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [isSending, setIsProcessing] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [showRejectInput, setShowRejectInput] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [currentRequestStatus, setCurrentRequestStatus] = useState<'pending' | 'approved' | 'rejected'>(
    depositRequest?.status || 'pending'
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (depositRequest) {
      setCurrentRequestStatus(depositRequest.status);
    }
  }, [depositRequest]);

  useEffect(() => {
    if (isOpen && depositRequest?.id) {
      loadMessages();
    }
  }, [isOpen, depositRequest?.id]);

  useEffect(() => {
    if (!isOpen || !depositRequest?.id) return;

    const handleNewMessage = (data: any) => {
      if (data?.request_id === depositRequest.id && data?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          const merged = [...prev, data.message];
          const seen = new Set<string>();
          return merged.filter((m) => {
            if (!m.id) return true;
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
        });
      }
    };

    const handleTopupUpdated = (data: any) => {
      if (data?.request?.id === depositRequest.id || data?.id === depositRequest.id) {
        const updatedStatus = data?.request?.status || data?.status;
        if (updatedStatus) {
          setCurrentRequestStatus(updatedStatus);
        }
      }
    };

    realtimeSync.on('TOPUP_CHAT_MESSAGE_RECEIVED', handleNewMessage);
    realtimeSync.on('TOPUP_REQUEST_UPDATED', handleTopupUpdated);
    const interval = setInterval(loadMessages, 3000);

    return () => {
      realtimeSync.off('TOPUP_CHAT_MESSAGE_RECEIVED', handleNewMessage);
      realtimeSync.off('TOPUP_REQUEST_UPDATED', handleTopupUpdated);
      clearInterval(interval);
    };
  }, [isOpen, depositRequest?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const list = await motorideApi.getTopupChatMessages(depositRequest.id);
      if (Array.isArray(list)) {
        const seen = new Set<string>();
        const deduped = list.filter((m) => {
          if (!m.id) return true;
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        setMessages(deduped);
      }
    } catch {}
  };

  const handleSend = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const msgToSend = customText !== undefined ? customText : text;
    if (!msgToSend.trim() && !attachment) return;

    setIsProcessing(true);
    try {
      const newMsg = await motorideApi.sendTopupChatMessage(depositRequest.id, {
        sender_id: currentUserId,
        sender_role: currentUserRole,
        sender_name: currentUserName,
        message: msgToSend.trim(),
        image_url: attachment || undefined,
      });

      if (newMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        if (customText === undefined) setText('');
        setAttachment(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveAction = async () => {
    if (isApproving) return;
    setIsApproving(true);
    try {
      if (onApprove) {
        await onApprove(depositRequest.id);
      } else {
        await motorideApi.approveTopupRequest(depositRequest.id);
      }
      setCurrentRequestStatus('approved');
      // Send confirmation message to chat
      await handleSend(undefined, `✅ Payment of ₹${depositRequest.amount} verified and approved by Admin. Wallet balance has been credited instantly!`);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to approve request');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectAction = async () => {
    if (isRejecting) return;
    setIsRejecting(true);
    try {
      const reason = rejectReason.trim() || 'Payment screenshot or UTR number could not be verified.';
      if (onReject) {
        await onReject(depositRequest.id, reason);
      } else {
        await motorideApi.rejectTopupRequest(depositRequest.id, reason);
      }
      setCurrentRequestStatus('rejected');
      setShowRejectInput(false);
      // Send rejection notice to chat
      await handleSend(undefined, `❌ Top-up deposit rejected by Admin: ${reason}`);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to reject request');
    } finally {
      setIsRejecting(false);
    }
  };

  if (!isOpen || !depositRequest) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl h-[90vh] rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                  Top-Up Verification Chat • {depositRequest.captain_name}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  currentRequestStatus === 'approved'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : currentRequestStatus === 'rejected'
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                }`}>
                  {currentRequestStatus === 'approved'
                    ? '✅ Approved & Credited'
                    : currentRequestStatus === 'rejected'
                    ? '❌ Rejected'
                    : '⏳ Pending Verification'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Deposit: <span className="font-extrabold text-amber-400 font-mono-num">₹{depositRequest.amount}</span> • UTR: {depositRequest.utr_number || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ADMIN ACTION BAR (When admin is verifying) */}
        {currentUserRole === 'admin' && (
          <div className="px-5 py-3 bg-slate-950/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Captain:</span>
              <span className="font-bold text-white">{depositRequest.captain_name}</span>
              <span className="text-slate-500 font-mono">({depositRequest.captain_phone || 'Captain'})</span>
            </div>

            {currentRequestStatus === 'pending' ? (
              <div className="flex items-center gap-2">
                {!showRejectInput ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowRejectInput(true)}
                      className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={handleApproveAction}
                      disabled={isApproving}
                      className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>{isApproving ? 'Crediting Wallet...' : `Approve & Credit ₹${depositRequest.amount}`}</span>
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                    <button
                      type="button"
                      onClick={handleRejectAction}
                      disabled={isRejecting}
                      className="px-3 py-1 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 cursor-pointer"
                    >
                      Confirm Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRejectInput(false)}
                      className="px-2 py-1 text-slate-400 text-xs hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">
                  Status: {currentRequestStatus === 'approved' ? 'Credited to Wallet ✅' : 'Rejected ❌'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3.5 scrollbar-thin bg-slate-950/50">
          {/* Initial Request Summary Card with Uploaded Payment Screenshot */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start justify-between gap-4 shadow-md">
            <div className="flex flex-col gap-2 min-w-0">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Uploaded Payment Verification Details</span>
              </span>

              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono-num">
                  ₹{depositRequest.amount.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400">requested via UPI</span>
              </div>

              {depositRequest.utr_number && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">UTR / Ref No:</span>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                    {depositRequest.utr_number}
                  </span>
                </div>
              )}

              <span className="text-[11px] text-slate-500 font-mono">
                Submitted on {new Date(depositRequest.created_at).toLocaleString()}
              </span>
            </div>

            {/* Uploaded Screenshot Proof */}
            {depositRequest.payment_slip_url && (
              <div className="flex flex-col items-center sm:items-end gap-1.5 shrink-0">
                <div
                  onClick={() => setPreviewImage(depositRequest.payment_slip_url || null)}
                  className="relative group cursor-pointer rounded-2xl overflow-hidden border-2 border-amber-500/40 hover:border-amber-400 transition-all shadow-lg"
                >
                  <img
                    src={depositRequest.payment_slip_url}
                    alt="Uploaded Payment Slip"
                    className="w-36 h-36 sm:w-44 sm:h-44 object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                    <ImageIcon className="w-4 h-4" />
                    <span>Zoom Fullscreen</span>
                  </div>
                </div>
                <span className="text-[10px] text-amber-400 font-bold">🔍 Click screenshot to view full size</span>
              </div>
            )}
          </div>

          {/* Quick Admin Action Prompts */}
          {currentUserRole === 'admin' && currentRequestStatus === 'pending' && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleSend(undefined, 'Payment receipt received and verified! Crediting wallet now...')}
                className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                💬 "Payment verified, crediting now"
              </button>
              <button
                type="button"
                onClick={() => handleSend(undefined, 'Please provide the complete 12-digit UTR transaction number.')}
                className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                💬 "Please send 12-digit UTR"
              </button>
              <button
                type="button"
                onClick={() => handleSend(undefined, 'Payment slip is blurry. Please upload a clear receipt showing transaction ID and amount.')}
                className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                💬 "Upload clearer receipt"
              </button>
            </div>
          )}

          {/* Message Stream */}
          {messages.map((msg, idx) => {
            const isMe = msg.sender_id === currentUserId || (currentUserRole === 'admin' && msg.sender_role === 'admin');
            return (
              <div
                key={`${msg.id || 'msg'}_${idx}_${msg.created_at || ''}`}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium px-1">
                  <span className="font-bold text-amber-300">{msg.sender_name}</span>
                  <span className="capitalize">({msg.sender_role})</span>
                  <span>•</span>
                  <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl flex flex-col gap-2 shadow-md ${
                    isMe
                      ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none'
                      : 'bg-slate-900 border border-slate-800 text-white rounded-tl-none'
                  }`}
                >
                  {msg.message && <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>}

                  {msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt="Attachment"
                      onClick={() => setPreviewImage(msg.image_url || null)}
                      className="max-w-xs max-h-60 rounded-xl border border-black/20 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Attachment Preview Box before sending */}
        {attachment && (
          <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={attachment} alt="Upload preview" className="w-10 h-10 rounded-lg object-cover border border-amber-500/40" />
              <span className="text-xs text-amber-400 font-bold">Image Attached</span>
            </div>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="text-xs text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
            >
              Remove
            </button>
          </div>
        )}

        {/* Form Input Footer */}
        <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          <label className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer transition-all shrink-0">
            <UploadCloud className="w-5 h-5 text-emerald-400" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const compressed = await compressImage(file, 1200, 1200, 0.85);
                  setAttachment(compressed);
                } catch {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const res = ev.target?.result as string;
                    if (res) setAttachment(res);
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </label>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={currentUserRole === 'admin' ? "Message captain or confirm payment receipt..." : "Message admin or send another payment proof..."}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500/50"
          />

          <button
            type="submit"
            disabled={isSending || (!text.trim() && !attachment)}
            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-40 shrink-0 flex items-center gap-1.5"
          >
            <Send className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

      </div>

      {/* Full Resolution Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[2200] bg-black/95 flex flex-col items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-3 rounded-2xl bg-slate-800 text-white font-bold cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img src={previewImage} alt="Full resolution proof" className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-white/20 shadow-2xl" />
        </div>
      )}
    </div>
  );
};

