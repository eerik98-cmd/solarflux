import React, { useState, useRef, useEffect } from 'react';
import { InventoryItem } from '../types';
import { analyzeInventoryWithGemini } from '../services/geminiService';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';

interface AIAssistantProps {
  inventory: InventoryItem[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ inventory }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am your Solar Stock Assistant. I can help you analyze inventory levels, suggest restocks, or check if you have specific parts available. What would you like to know?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await analyzeInventoryWithGemini(inventory, userMessage.content);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <header className="px-8 py-6 border-b border-slate-700 flex items-center gap-3 bg-slate-800">
        <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg">
          <Sparkles className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">AI Inventory Analyst</h1>
          <p className="text-xs text-slate-400">Powered by Gemini 2.5 Flash</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-600">
                <Bot size={16} className="text-amber-400" />
              </div>
            )}
            
            <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-md ${
              msg.role === 'user' 
                ? 'bg-amber-600 text-white rounded-tr-none' 
                : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
            }`}>
              <div className="whitespace-pre-wrap leading-relaxed text-sm">
                {msg.content}
              </div>
              <div className={`text-[10px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-amber-100' : 'text-slate-500'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

             {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-600">
                <User size={16} className="text-slate-400" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
             <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-600">
                <Bot size={16} className="text-amber-400" />
              </div>
              <div className="bg-slate-800 rounded-2xl rounded-tl-none px-5 py-4 border border-slate-700 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-amber-500" />
                <span className="text-xs text-slate-400 font-medium">Analyzing stock data...</span>
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 border-t border-slate-700 bg-slate-800">
        <form onSubmit={handleSend} className="relative max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about inventory, low stock, or compatibility..."
            className="w-full bg-slate-900 border border-slate-600 rounded-xl pl-6 pr-14 py-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none shadow-inner"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 rounded-lg transition-colors"
          >
            <Send size={20} />
          </button>
        </form>
        <div className="text-center mt-3">
          <p className="text-[10px] text-slate-500">
            AI can make mistakes. Verify critical stock levels manually.
          </p>
        </div>
      </div>
    </div>
  );
};
