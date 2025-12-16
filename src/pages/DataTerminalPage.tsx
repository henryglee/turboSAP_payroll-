import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [, setCustomers] = useState<string[]>(['default']);
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

  // Customer selection handler (currently unused but kept for future use)
  // const handleCustomerChange = (event: ChangeEvent<HTMLSelectElement>) => {
  //   const value = event.target.value;
  //   setSelectedCustomer(value);
  // };

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
      <div className="flex flex-col gap-6 h-[calc(100vh-200px)]">
        {/* Header & Controls Section */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-card border border-border p-4 rounded-lg shrink-0">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-secondary rounded-lg shrink-0">
              <Brain className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                TurboSAPShell
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">
                  BETA
                </span>
                <div className={clsx(
                  "ml-2 flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset",
                  status === 'connected' && "bg-green-50 text-green-700 ring-green-600/20",
                  status === 'connecting' && "bg-yellow-50 text-yellow-800 ring-yellow-600/20",
                  status === 'error' && "bg-red-50 text-red-700 ring-red-600/20",
                  status === 'idle' && "bg-gray-50 text-gray-600 ring-gray-500/10"
                )}>
                  <span className={clsx("relative flex h-2 w-2")}>
                    {status === 'connected' && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    )}
                    <span className={clsx(
                      "relative inline-flex rounded-full h-2 w-2",
                      status === 'connected' && "bg-green-500",
                      status === 'connecting' && "bg-yellow-500",
                      status === 'error' && "bg-red-500",
                      status === 'idle' && "bg-gray-400"
                    )}></span>
                  </span>
                  {status === 'connected' && 'Online'}
                  {status === 'connecting' && 'Connecting...'}
                  {status === 'idle' && 'Disconnected'}
                  {status === 'error' && 'Error'}
                </div>
              </h2>
              <p className="text-sm text-muted-foreground">
                Direct to <code className="px-1 py-0.5 rounded bg-secondary border border-border font-mono text-xs">/data/reachnett</code>
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
              className="flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm shrink-0">
            <div className="shrink-0 p-1 bg-red-100 rounded-full">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            {errorMessage}
          </div>
        )}

        <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-border shadow-lg bg-[#0f0f0f] flex flex-col">
          <div className="shrink-0 h-6 bg-[#1a1b1e] border-b border-[#2b2d31] flex items-center px-3 gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
            </div>
            <div className="flex-1 text-center text-[10px] font-mono text-muted-foreground">
              secure_shell — -bash — 80x24
            </div>
          </div>
          <div className="terminal-shell flex-1 p-1" ref={containerRef} />
        </div>
      </div>
    </AdminLayout>
  );
}
