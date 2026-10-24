import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, X, ShieldCheck, CornerDownLeft, Sparkles, CheckCheck } from 'lucide-react';
import { MotorideRide, RideMessage } from '../../types/motoride';
import { motorideApi } from '../../services/motorideApi';
import { realtimeSync } from '../../services/realtimeSync';
import { safeStorage } from '../../lib/safeStorage';

interface RideChatModalProps {
  ride: MotorideRide;
  currentUserId: string;
  currentUserRole: 'passenger' | 'captain' | 'admin';
  currentUserName: string;
  onClose?: () => void;
}

export const RideChatModal: React.FC<RideChatModalProps> = ({
  ride,
  currentUserId,
  currentUserRole,
  currentUserName,
  onClose,
}) => {
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCaptain = currentUserRole === 'captain';
  const isAdmin = currentUserRole === 'admin';
  const otherPartyName = isAdmin
    ? `${ride.passenger_name || 'Passenger'} & ${ride.captain_name || 'Captain'}`
    : isCaptain
    ? (ride.passenger_name || 'Passenger')
    : (ride.captain_name || 'Captain');

  const quickReplies = isAdmin
    ? [
        'Motoride Dispatch: Ride monitored live ✅',
        'Please verify passenger OTP before starting trip',
        'Captain on route to pickup location',
        'Emergency SOS check: Is everything okay?',
        'Support: How can we assist you?',
      ]
    : isCaptain
    ? [
        'I have arrived at Location A',
        'Where are you waiting?',
        'On my way! 🏍️',
        'Heavy traffic, reaching in 2 mins',
        'Please come to the pickup spot',
        'Please be ready with OTP',
      ]
    : [
        'I am standing at the main gate',
        'Coming outside in 1 minute',
        'Where are you now?',
        'Wearing black jacket / helmet',
        'Ok, got it! 👍',
        'Please wait 2 mins',
      ];

  const fetchMessages = async () => {
    try {
      const list = await motorideApi.getRideMessages(ride.id);
      if (Array.isArray(list)) {
        setMessages((prev) => {
          const map = new Map<string, RideMessage>();
          prev.forEach((m) => { if (m?.id) map.set(m.id, m); });
          list.forEach((m) => { if (m?.id) map.set(m.id, m); });
          return Array.from(map.values()).sort(
            (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          );
        });
      }
      safeStorage.setItem(`motoride_last_read_chat_${ride.id}`, Date.now().toString());
    } catch (err) {
      console.warn('Failed to load chat messages:', err);
    }
  };

  useEffect(() => {
    fetchMessages();
    safeStorage.setItem(`motoride_last_read_chat_${ride.id}`, Date.now().toString());
    const interval = setInterval(fetchMessages, 1000);

    const handleIncomingMessage = (payload: any) => {
      if (payload && payload.ride_id === ride.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload].sort(
            (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          );
        });
        safeStorage.setItem(`motoride_last_read_chat_${ride.id}`, Date.now().toString());
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 30);
      }
    };

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent?.detail) {
        if (customEvent.detail.rideId === ride.id && Array.isArray(customEvent.detail.messages)) {
          setMessages(customEvent.detail.messages);
        } else if (customEvent.detail.ride_id === ride.id) {
          handleIncomingMessage(customEvent.detail);
        }
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === `motoride_chat_msgs_${ride.id}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setMessages(parsed);
          }
        } catch {}
      }
    };

    const unsub = realtimeSync.on('RIDE_MESSAGE_RECEIVED', handleIncomingMessage);
    window.addEventListener('motoride_chat_updated', handleCustomEvent);
    window.addEventListener('motoride_chat_message', handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      clearInterval(interval);
      unsub();
      window.removeEventListener('motoride_chat_updated', handleCustomEvent);
      window.removeEventListener('motoride_chat_message', handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
      safeStorage.setItem(`motoride_last_read_chat_${ride.id}`, Date.now().toString());
    };
  }, [ride.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || isSending) return;

    // Optimistic temporary message to display in UI immediately in 0ms
    const tempMsg: RideMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ride_id: ride.id,
      sender_id: currentUserId,
      sender_role: currentUserRole,
      sender_name: currentUserName,
      message: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMsg]);
    setInputText('');
    setIsSending(true);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 20);

    try {
      const sent = await motorideApi.sendRideMessage(ride.id, {
        sender_id: currentUserId,
        sender_role: currentUserRole,
        sender_name: currentUserName,
        message: text,
      });
      if (sent) {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempMsg.id && m.id !== sent.id);
          return [...filtered, sent].sort(
            (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          );
        });
      }
    } catch (err) {
      console.warn('Failed to send message:', err);
      setInputText(text); // restore on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    } finally {
      setIsSending(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl relative text-slate-900">
      
      {/* Top Header (Pinned at Top) */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-white border-b border-slate-200 shrink-0 select-none z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold shadow-xs">
            <MessageSquare className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-slate-950 tracking-tight">
                Chat with {otherPartyName}
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-extrabold border border-emerald-300">
                {isAdmin ? 'Admin Support' : isCaptain ? 'Passenger' : 'Captain'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live In-Ride Channel • #{ride.ride_code}</span>
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close Chat"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Messages Scroll Area (Clean White Background) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-3 bg-white scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3 text-emerald-600 shadow-sm">
              <ShieldCheck className="w-6 h-6 stroke-[2]" />
            </div>
            <p className="font-extrabold text-slate-900 text-sm">Direct & Secure In-Ride Chat</p>
            <p className="text-xs text-slate-500 max-w-xs mt-1 font-medium">
              Communicate pickup location, delays, or directions with {otherPartyName}.
            </p>
          </div>
        ) : (
          messages.map((m, index) => {
            const isMe = m.sender_id === currentUserId || m.sender_role === currentUserRole;
            const timeStr = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            return (
              <div
                key={`${m.id || index}-${m.created_at}`}
                className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isMe ? 'self-end items-end' : 'self-start items-start'} animate-in fade-in slide-in-from-bottom-1 duration-150`}
              >
                <div className="flex items-center gap-1.5 px-1 mb-1 text-[10px] text-slate-500">
                  <span className="font-bold">{isMe ? 'You' : m.sender_name}</span>
                  <span>•</span>
                  <span>{timeStr}</span>
                </div>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    isMe
                      ? 'bg-emerald-600 text-white font-semibold rounded-tr-none shadow-md shadow-emerald-600/20'
                      : 'bg-slate-100 text-slate-950 border border-slate-200 rounded-tl-none font-medium shadow-xs'
                  }`}
                >
                  {m.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Quick Reply Suggestion Chips (Docked above the bottom input bar) */}
      <div className="px-3 sm:px-4 py-2 bg-slate-50 border-t border-slate-200 shrink-0 overflow-x-auto scrollbar-none flex items-center gap-1.5 z-10">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 shrink-0 mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-600" />
          Quick:
        </span>
        {quickReplies.map((reply, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => sendMessage(reply)}
            disabled={isSending}
            className="shrink-0 px-2.5 py-1 rounded-xl bg-white hover:bg-emerald-50 hover:text-emerald-900 text-slate-700 text-[11px] font-bold border border-slate-300 hover:border-emerald-400 transition-all cursor-pointer whitespace-nowrap active:scale-95 disabled:opacity-50 shadow-xs"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* Message Typing Input Form */}
      <form
        onSubmit={handleSend}
        className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2 sm:gap-3 shrink-0 z-10"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Type a message for ${otherPartyName}...`}
          className="flex-1 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-950 placeholder-slate-400 focus:outline-none transition-all shadow-inner"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black transition-all shrink-0 cursor-pointer shadow-lg shadow-emerald-600/25 flex items-center gap-2"
          title="Send message"
        >
          <span className="hidden sm:inline text-xs uppercase tracking-wider font-black">Send</span>
          <Send className="w-4 h-4 stroke-[2.5] text-white" />
        </button>
      </form>

    </div>
  );
};
