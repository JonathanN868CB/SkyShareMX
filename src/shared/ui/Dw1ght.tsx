import { useState, useRef, useEffect } from "react";
import { X, Send, ChevronDown } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function Dw1ght() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/.netlify/functions/dw1ght-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: newMessages.slice(0, -1).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply ?? "..." }]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Connection failure. I am reporting this to Jonathan." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {/* Chat panel */}
      {open && (
        <div className="flex flex-col w-80 h-[420px] rounded-xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a1a] border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-[#d4a017] uppercase">DW1GHT</span>
              <span className="text-[10px] text-white/30 tracking-wide uppercase">AI Assistant to the DOM</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/30 hover:text-white/70 transition-colors"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-white/20 text-xs text-center mt-8 leading-relaxed">
                I am DW1GHT.<br />
                AI Assistant to the DOM.<br />
                State your question.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#d4a017]/20 text-white/90"
                      : "bg-white/5 text-white/80"
                  }`}
                >
                  {m.role === "assistant" && (
                    <span className="block text-[10px] font-bold tracking-widest text-[#d4a017] mb-1">DW1GHT</span>
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 rounded-lg px-3 py-2">
                  <span className="block text-[10px] font-bold tracking-widest text-[#d4a017] mb-1">DW1GHT</span>
                  <span className="text-white/30 text-xs animate-pulse">Processing...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/10 bg-[#1a1a1a] flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask DW1GHT..."
              className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[#d4a017]/50 transition-colors"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="text-[#d4a017] hover:text-[#d4a017]/70 disabled:text-white/20 transition-colors p-1"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-[#1a1a1a] border border-white/10 hover:border-[#d4a017]/50 text-[#d4a017] rounded-full px-4 py-2 shadow-lg transition-all hover:shadow-[#d4a017]/10"
      >
        {open ? (
          <X size={14} />
        ) : (
          <span className="text-xs font-bold tracking-widest uppercase">DW1GHT</span>
        )}
      </button>
    </div>
  );
}
