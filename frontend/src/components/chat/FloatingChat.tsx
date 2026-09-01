import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MessageSquare, Send, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { chatApi, ChatMessageItem } from '../../api/chat';
import toast from 'react-hot-toast';

export const FloatingChat: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'requests'>('chat');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [requests, setRequests] = useState<ChatMessageItem[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [activeThreadUserId, setActiveThreadUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const reqs = await chatApi.listMessageRequests();
      setRequests(reqs);

      if (activeThreadUserId) {
        const thread = await chatApi.listThread(activeThreadUserId);
        setMessages(thread);
      }
    } catch (err) {
      console.error('Failed to load chat thread:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, activeThreadUserId]);

  // Connect WebSocket if authenticated
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1')
      .replace(/^http/, 'ws') + `/chat/ws/${user.id}`;

    try {
      const socket = new WebSocket(wsUrl);
      socket.onopen = () => {
        console.log('[Chat WS Connected]');
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message' || data.type === 'message_request') {
            toast.success(`Message from ${data.sender}`);
            fetchData();
          }
        } catch {
          // ignore non-json echo
        }
      };
      socketRef.current = socket;

      return () => {
        socket.close();
      };
    } catch (e) {
      console.warn('WebSocket connection error:', e);
    }
  }, [isAuthenticated, user?.id, fetchData]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, activeThreadUserId, fetchData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || !recipientEmail.trim()) return;

    try {
      const res = await chatApi.sendMessage({ recipient_email: recipientEmail }, inputContent);
      setInputContent('');
      if (res.recipient_id) {
        setActiveThreadUserId(res.recipient_id);
      }
      if (!res.is_accepted) {
        toast.success('Message request sent to email! Awaiting user acceptance.');
      } else {
        toast.success('Message sent!');
      }
      fetchData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: { message?: string } } } };
      toast.error(errorObj.response?.data?.detail?.message || 'Failed to send message.');
    }
  };

  const handleAcceptRequest = async (req: ChatMessageItem) => {
    try {
      await chatApi.acceptMessageRequest(req.id);
      toast.success('Message request accepted!');
      setActiveThreadUserId(req.sender_id);
      setActiveTab('chat');
      fetchData();
    } catch {
      toast.error('Failed to accept request.');
    }
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
        aria-label="Open SamadhanX Assistant Chat"
      >
        <MessageSquare className="w-6 h-6" />
        {requests.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
            {requests.length}
          </span>
        )}
      </button>

      {/* Chat Panel Modal / Bottom Sheet */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:bottom-20 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[500px] max-h-[80vh] transition-all">
          {/* Header */}
          <div className="px-4 py-3 bg-indigo-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <div>
                <h3 className="font-semibold text-sm leading-tight">SamadhanX Chat Engine</h3>
                <p className="text-[11px] text-indigo-100">Direct Messaging & Collaboration</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-indigo-700 rounded-lg text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-border bg-slate-50 dark:bg-slate-900 text-xs font-medium">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 text-center ${activeTab === 'chat' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold bg-background' : 'text-muted-foreground'}`}
            >
              Messages
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-2 text-center relative ${activeTab === 'requests' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold bg-background' : 'text-muted-foreground'}`}
            >
              Requests
              {requests.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full font-bold">
                  {requests.length}
                </span>
              )}
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs bg-slate-50/50 dark:bg-slate-950/50">
            {activeTab === 'requests' ? (
              requests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                  <p className="font-medium text-foreground">No Message Requests</p>
                  <p className="text-[11px]">Messages from non-connections will appear here.</p>
                </div>
              ) : (
                requests.map((req) => (
                  <div key={req.id} className="p-3 bg-card border border-border rounded-xl space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{req.sender_name || 'User'}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">{req.content}</p>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleAcceptRequest(req)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold"
                      >
                        Accept & Chat
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : (
              <>
                {/* Email input for user-facing chat */}
                <div className="mb-2">
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Recipient Email:</label>
                  <input
                    type="email"
                    placeholder="Enter recipient email (e.g. rahul@example.com)..."
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {loading ? (
                  <div className="text-center py-6 text-muted-foreground">Loading chat thread...</div>
                ) : !recipientEmail ? (
                  <div className="h-40 flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 text-indigo-400 mb-2 opacity-50" />
                    <p className="text-xs">Enter a Recipient Email to start chatting.</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">No previous messages in this conversation. Type below to send a message request.</div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`max-w-[80%] p-2.5 rounded-2xl text-xs ${
                            isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-card border border-border text-foreground rounded-bl-none shadow-sm'
                          }`}
                        >
                          {!msg.is_accepted && !isMe && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-500 mb-1">
                              <ShieldAlert className="w-3 h-3" /> Message Request
                            </div>
                          )}
                          <p>{msg.content}</p>
                          <span className={`block text-[9px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-muted-foreground'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Footer Input */}
          {activeTab === 'chat' && (
            <form onSubmit={handleSend} className="p-2 border-t border-border bg-card flex items-center gap-2">
              <input
                type="text"
                placeholder="Type your message..."
                value={inputContent}
                onChange={(e) => setInputContent(e.target.value)}
                disabled={!recipientEmail.trim()}
                className="flex-1 px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!recipientEmail.trim() || !inputContent.trim()}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
};
