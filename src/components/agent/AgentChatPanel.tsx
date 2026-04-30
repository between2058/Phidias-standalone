'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ChatMessage from './ChatMessage';
import type { Message } from './ChatMessage';

const SUGGESTIONS = [
  'Generate a car model',
  'Add physics to the scene',
  'Create a sci-fi environment',
  'Segment model parts',
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'welcome',
    role: 'agent',
    type: 'text',
    content:
      "Hi! I'm Phidias Agent. I can help you generate 3D models, segment parts, apply textures, configure physics, and build scenes. What would you like to create today?",
  },
];

interface AgentChatPanelProps {
  onNodeCreated: (node: {
    id: string;
    type: string;
    modelUrl: string;
    label: string;
  }) => void;
  onPanToNode: (nodeId: string) => void;
  width?: number;
}

export default function AgentChatPanel({
  onNodeCreated: _onNodeCreated,
  onPanToNode,
}: AgentChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const progressMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((msg: Omit<Message, 'id'>) => {
    const id = `msg-${Date.now()}-${Math.random()}`;
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    );
  }, []);

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = text ?? inputText.trim();
      if (!msg || isProcessing) return;

      setInputText('');
      addMessage({ role: 'user', type: 'text', content: msg });
      setIsProcessing(true);

      // Add progress message
      const progressId = `progress-${Date.now()}`;
      progressMsgIdRef.current = progressId;
      setMessages((prev) => [
        ...prev,
        {
          id: progressId,
          role: 'agent',
          type: 'progress',
          content: 'Processing...',
          progress: 0,
          stage: 'Starting...',
        },
      ]);

      try {
        // Agent API not yet implemented
        throw new Error('not_implemented');
      } catch {
        updateMessage(progressMsgIdRef.current!, {
          type: 'text',
          content: 'Something went wrong. Please try again.',
        });
      } finally {
        setIsProcessing(false);
        progressMsgIdRef.current = null;
      }
    },
    [inputText, isProcessing, addMessage, updateMessage],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: '#1e1e36', borderLeft: '1px solid #333355' }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: '#333355' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">
            🤖 Phidias Agent
          </span>
          <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
        </div>
        <button
          onClick={() => setMessages(INITIAL_MESSAGES)}
          className="text-xs text-[#64748b] hover:text-white transition-colors px-2 py-1 rounded hover:bg-[#252542]"
        >
          New Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onCanvasRefClick={(nodeId) => onPanToNode(nodeId)}
            onViewOnCanvas={() =>
              msg.canvasNodeId && onPanToNode(msg.canvasNodeId)
            }
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion chips */}
      {!isProcessing && (
        <div className="px-3 py-2 flex flex-wrap gap-1">
          {SUGGESTIONS.slice(0, 3).map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="px-2.5 py-1 text-[10px] rounded-full transition-colors"
              style={{
                background: '#252542',
                color: '#94a3b8',
                border: '1px solid #333355',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.borderColor = '#7c3aed';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.borderColor = '#333355';
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Chat input */}
      <div
        className="flex-shrink-0 p-3 border-t"
        style={{ borderColor: '#333355' }}
      >
        <div
          className="flex items-end gap-2 rounded-xl px-3 py-2"
          style={{ background: '#252542', border: '1px solid #333355' }}
        >
          <button className="text-[#64748b] hover:text-white transition-colors pb-1 flex-shrink-0 text-sm">
            📎
          </button>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what to build or do next..."
            disabled={isProcessing}
            rows={2}
            className="flex-1 bg-transparent text-xs text-white placeholder-[#64748b] resize-none focus:outline-none min-w-0"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isProcessing}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
            style={{ background: '#7c3aed', color: 'white' }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
