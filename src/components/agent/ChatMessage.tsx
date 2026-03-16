'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ProgressBar } from '@/components/ui/ProgressBar';

export type MessageType =
  | 'text'
  | 'progress'
  | 'canvas-ref'
  | 'pipeline-summary'
  | 'decision';

export interface Message {
  id: string;
  role: 'user' | 'agent';
  type: MessageType;
  content: string;
  progress?: number;
  stage?: string;
  canvasNodeId?: string;
  nodeLabel?: string;
  options?: string[];
  pipeline?: { steps: string[]; duration: string; credits: number };
}

interface ChatMessageProps {
  message: Message;
  onCanvasRefClick?: (nodeId: string) => void;
  onOptionSelect?: (option: string) => void;
  onViewOnCanvas?: (nodeId?: string) => void;
}

export default function ChatMessage({
  message,
  onCanvasRefClick,
  onOptionSelect,
  onViewOnCanvas,
}: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-2 mb-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
        style={{
          background: isUser ? '#f5a623' : '#7c3aed',
          color: '#1a1a2e',
        }}
      >
        {isUser ? 'U' : '🤖'}
      </div>

      {/* Content */}
      <div
        className={cn(
          'max-w-[80%] space-y-1',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        {/* Text message */}
        {message.type === 'text' && (
          <div
            className="px-3 py-2 rounded-2xl text-xs leading-relaxed"
            style={{
              background: isUser ? '#f5a623' : '#252542',
              color: isUser ? '#1a1a2e' : '#e2e8f0',
              borderBottomRightRadius: isUser ? 4 : undefined,
              borderBottomLeftRadius: !isUser ? 4 : undefined,
            }}
          >
            {message.content}
          </div>
        )}

        {/* Progress message */}
        {message.type === 'progress' && (
          <div className="w-64">
            <ProgressBar
              percent={message.progress ?? 0}
              stage={message.stage ?? message.content}
              color="purple"
              className="!p-2"
            />
          </div>
        )}

        {/* Canvas reference */}
        {message.type === 'canvas-ref' && (
          <div
            className="px-3 py-2 rounded-2xl text-xs leading-relaxed"
            style={{
              background: '#252542',
              color: '#e2e8f0',
              borderBottomLeftRadius: 4,
            }}
          >
            {message.content}{' '}
            <button
              onClick={() => onCanvasRefClick?.(message.canvasNodeId ?? '')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ml-1 transition-colors hover:opacity-90"
              style={{
                background: '#7c3aed20',
                color: '#a78bfa',
                border: '1px solid #7c3aed40',
              }}
            >
              🧊 {message.nodeLabel ?? 'Asset'} ↗
            </button>
          </div>
        )}

        {/* Decision prompt */}
        {message.type === 'decision' && (
          <div
            className="px-3 py-2.5 rounded-2xl space-y-2"
            style={{
              background: '#252542',
              border: '1px solid #333355',
              borderBottomLeftRadius: 4,
            }}
          >
            <p className="text-xs text-[#e2e8f0]">{message.content}</p>
            <div className="flex flex-wrap gap-1">
              {(message.options ?? []).map((opt) => (
                <button
                  key={opt}
                  onClick={() => onOptionSelect?.(opt)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[#7c3aed] hover:text-white"
                  style={{ background: '#333355', color: '#94a3b8' }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pipeline summary */}
        {message.type === 'pipeline-summary' && message.pipeline && (
          <div
            className="px-3 py-2.5 rounded-2xl space-y-2 w-64"
            style={{
              background: '#252542',
              border: '1px solid #333355',
              borderBottomLeftRadius: 4,
            }}
          >
            <p className="text-xs font-semibold text-white">
              {message.content}
            </p>
            <div className="space-y-1">
              {message.pipeline.steps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[10px] text-[#94a3b8]"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  {step}
                </div>
              ))}
            </div>
            <div className="flex gap-2 text-[10px] text-[#64748b] border-t border-[#333355] pt-1">
              <span>⏱ {message.pipeline.duration}</span>
              <span>⚡ {message.pipeline.credits} credits</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onViewOnCanvas?.()}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-medium text-white transition-colors hover:opacity-90"
                style={{ background: '#7c3aed' }}
              >
                View on Canvas
              </button>
              <button
                className="flex-1 py-1.5 rounded-lg text-[10px] font-medium text-white transition-colors hover:opacity-90"
                style={{ background: '#252542', border: '1px solid #333355' }}
              >
                Export All
              </button>
            </div>
          </div>
        )}

        {/* Timestamp (optional) */}
        <p className="text-[9px] text-[#4b5563] px-1">just now</p>
      </div>
    </div>
  );
}
