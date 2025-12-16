import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Brain, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import '@xterm/xterm/css/xterm.css';

import { fetchTerminalCustomers } from '../api/dataTerminal';
import { useAuthStore } from '../store/auth';
import { AdminLayout } from '../components/layout/AdminLayout';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function DataTerminalPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const intentionalCloseRef = useRef(false);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const { token, user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [customers, setCustomers] = useState<string[]>(['default']);
  const [selectedCustomer, setSelectedCustomer] = useState('default');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsUrl = useMemo(() => {
    const base = API_BASE_URL.replace(/^http/, 'ws');
    const url = new URL('/api/console/reachnett/ws', base);
    if (token) {
      url.searchParams.set('token', token);
    }
    if (selectedCustomer) {
      url.searchParams.set('customer', selectedCustomer);
    }
    return url.toString();
  }, [token, selectedCustomer]);

  const teardownSocket = useCallback(() => {
    intentionalCloseRef.current = true;
    socketRef.current?.close();
    socketRef.current = null;
  }, []);

  const disconnectTerminal = useCallback(() => {
    teardownSocket();
    termRef.current?.dispose();
    termRef.current = null;
    fitAddonRef.current = null;
  }, [teardownSocket]);

  const initializeTerminal = useCallback(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 14,
      cursorBlink: true,
      convertEol: true,
      theme: {
        background: '#0f0f0f',
        foreground: '#e5e5e5',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    termRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const handleResize = () => {
      requestAnimationFrame(() => fitAddon.fit());
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const connectSocket = useCallback(() => {
    if (!token || !termRef.current || !isAdmin) return;

    // Close existing socket
    intentionalCloseRef.current = true;
    socketRef.current?.close();

    intentionalCloseRef.current = false;
    setStatus('connecting');
    setErrorMessage(null);

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    const term = termRef.current;

    const disposeDataListener = term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    socket.addEventListener('open', () => {
      setStatus('connected');
      term.focus();
    });

    // Ignore transient errors
    socket.addEventListener('error', () => {
      console.warn('WebSocket transient error');
    });

    socket.addEventListener('close', (event) => {
      disposeDataListener.dispose();

      if (intentionalCloseRef.current) {
        setStatus('idle');
        return;
      }

      if (!event.wasClean) {
        setStatus('error');
        // setErrorMessage('Connection lost');
        term.write('\r\n[connection lost]\r\n');
      } else {
        setStatus('idle');
        term.write('\r\n[connection closed]\r\n');
      }
    });

    socket.addEventListener('message', (event) => {
      term.write(event.data ?? '');
    });
  }, [token, wsUrl, isAdmin]);


  useEffect(() => {
    if (!token || !isAdmin) return () => undefined;

    const cleanupResize = initializeTerminal();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    connectSocket();

    return () => {
      cleanupResize?.();
      disconnectTerminal();
    };
  }, [token, isAdmin, initializeTerminal, connectSocket, disconnectTerminal, wsUrl]);

  useEffect(() => {
    let active = true;

    if (!isAdmin) {
      return () => {
        active = false;
      };
    }

    fetchTerminalCustomers()
      .then((response) => {
        if (!active) return;
        const fetched = response.customers.length > 0 ? response.customers : ['default'];
        setCustomers(fetched);
        setSelectedCustomer((current) => (fetched.includes(current) ? current : fetched[0]));
      })
      .catch(() => {
        if (active) {
          setCustomers(['default']);
          setSelectedCustomer('default');
        }
      });
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const handleCustomerChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedCustomer(value);
  };

  if (!token) {
    return (
      <AdminLayout title="Data Console" description="Terminal access for data exploration">
        <div className="terminal-error">Sign in to access the Reachnett data terminal.</div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout title="Data Console" description="Terminal access for data exploration">
        <div className="terminal-error">Only administrators can access the Reachnett data terminal.</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Data Console" description="Terminal access for data exploration">
      <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full h-[calc(100vh-100px)]">
        {/* Header & Controls Section */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg shrink-0">
              <Brain className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                TurboSAPShell
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  BETA
                </span>
                <div className={clsx(
                  "ml-2 flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-medium border",
                  status === 'connected' && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900",
                  status === 'connecting' && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900",
                  status === 'error' && "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900",
                  status === 'idle' && "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                )}>
                  <span className={clsx("relative flex h-2 w-2")}>
                    {status === 'connected' && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span className={clsx(
                      "relative inline-flex rounded-full h-2 w-2",
                      status === 'connected' && "bg-emerald-500",
                      status === 'connecting' && "bg-amber-500",
                      status === 'error' && "bg-rose-500",
                      status === 'idle' && "bg-zinc-400"
                    )}></span>
                  </span>
                  {status === 'connected' && 'Online'}
                  {status === 'connecting' && 'Connecting...'}
                  {status === 'idle' && 'Disconnected'}
                  {status === 'error' && 'Error'}
                </div>
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Direct to <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-xs">/data/reachnett</code>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                disconnectTerminal();
                initializeTerminal();
                connectSocket();
              }}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-400 text-sm shrink-0">
            <div className="shrink-0 p-1 bg-rose-100 dark:bg-rose-900/40 rounded-full">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            {errorMessage}
          </div>
        )}

        <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-zinc-800 shadow-xl bg-[#0f0f0f] flex flex-col">
          <div className="shrink-0 h-6 bg-[#1a1b1e] border-b border-[#2b2d31] flex items-center px-3 gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
            </div>
            <div className="flex-1 text-center text-[10px] font-mono text-zinc-500">
              secure_shell — -bash — 80x24
            </div>
          </div>
          <div className="terminal-shell flex-1 p-1" ref={containerRef} />
        </div>
      </div>
    </AdminLayout>
  );
}
