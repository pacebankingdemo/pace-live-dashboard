import React, { useState, useEffect, createContext } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Zap, Settings, X, MessageSquare } from 'lucide-react';
import { fetchOrgs, fetchProcesses, subscribeToTable } from '../services/supabase';

const ORG_ORDER = [
    '078da434-5802-4e98-b066-24761f56a077',
    'bc1cc87f-db42-4e08-932d-e3437f116300',
    '0649e502-b1ff-490f-8d31-cd8e4fb2d1ab',
];

export const TabsContext = createContext({ openTab: () => {} });

const HIDDEN_PROCESS_IDS = new Set([
    '795b85bb-ef67-4e56-aaec-2a07d5ed8c90',
    'fa91e289-044b-4fc9-a626-ebdb6c0ee64b',
    '634c603a-b18f-4605-aa2a-1160bcc26f20',
    '16ff2409-24ba-4df3-ab36-f1b70d8243e4',
    'ba0c4a4c-815c-4e10-8720-bbb891c6f5b7',
    'ac2bc5a3-8501-466b-bc68-d2d5e7ccaf96',
    '1b9b7c8c-d65b-4c8a-a76e-d1dc1b23ab90',
]);

const DashboardLayout = () => {
    const navigate  = useNavigate();
    const location  = useLocation();
    const [orgs, setOrgs]                     = useState([]);
    const [currentOrg, setCurrentOrg]         = useState(null);
    const [processes, setProcesses]           = useState([]);
    const [currentProcess, setCurrentProcess] = useState(null);
    const [tabs, setTabs]                     = useState([]);
    const [activeTabId, setActiveTabId]       = useState(null);
    // Chat panel open state — lives here so navbar icon can control it
    const [chatOpen, setChatOpen]             = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchOrgs();
                const sorted = [...data].sort((a, b) => {
                    const ai = ORG_ORDER.indexOf(a.id), bi = ORG_ORDER.indexOf(b.id);
                    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                });
                setOrgs(sorted);
                const saved = sessionStorage.getItem('currentOrgId');
                const org   = (saved && sorted.find(o => o.id === saved)) || sorted[0];
                if (org) setCurrentOrg(org);
            } catch (e) { console.error(e); }
        };
        load();
        return subscribeToTable('organizations', undefined, load);
    }, []);

    useEffect(() => {
        if (!currentOrg) return;
        sessionStorage.setItem('currentOrgId',   currentOrg.id);
        sessionStorage.setItem('currentOrgName', currentOrg.name || '');
        const load = async () => {
            try {
                const data = await fetchProcesses(currentOrg.id);
                setProcesses(data);
                const saved = sessionStorage.getItem('currentProcessId');
                const proc  = (saved && data.find(p => p.id === saved)) || data[0];
                setCurrentProcess(proc || null);
            } catch (e) { console.error(e); }
        };
        load();
        return subscribeToTable('processes', `org_id=eq.${currentOrg.id}`, load);
    }, [currentOrg]);

    useEffect(() => {
        if (currentProcess) {
            sessionStorage.setItem('currentProcessId',   currentProcess.id);
            sessionStorage.setItem('currentProcessName', currentProcess.name || '');
        }
    }, [currentProcess]);

    const openTab = ({ id, label }) => {
        setTabs(prev => prev.find(t => t.id === id) ? prev : [...prev, { id, label }]);
        setActiveTabId(id);
    };

    const closeTab = (e, id) => {
        e.stopPropagation();
        setTabs(prev => {
            const next = prev.filter(t => t.id !== id);
            if (activeTabId === id) setActiveTabId(next[next.length - 1]?.id || null);
            return next;
        });
    };

    const isHome     = location.pathname === '/done/home';
    const isTasks    = location.pathname === '/done/tasks';
    const isSettings = location.pathname === '/done/settings';
    // Chat icon is active when on tasks page AND chat is open
    const isChatActive = isTasks && chatOpen;

    const IconBtn = ({ icon: Icon, active, onClick, title }) => (
        <button onClick={onClick} title={title}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                active ? 'bg-[#2a2a2a] text-[#e8e8e8]' : 'text-[#555] hover:text-[#aaa] hover:bg-[#1e1e1e]'
            }`}>
            <Icon size={14} strokeWidth={1.8} />
        </button>
    );

    return (
        <TabsContext.Provider value={{ openTab }}>
        <div className="flex flex-col h-screen bg-[#111] font-sans antialiased">

            {/* ══ TOP NAVBAR ══ */}
            <header className="flex-shrink-0 h-9 flex items-center bg-[#111] border-b border-[#222] px-2 gap-0 relative z-20">

                {/* LEFT: icon buttons */}
                <div className="flex items-center gap-0.5 mr-2">
                    <IconBtn icon={Home}         active={isHome}       onClick={() => navigate('/done/home')}     title="Home" />
                    <IconBtn icon={Zap}          active={isTasks}      onClick={() => navigate('/done/tasks')}    title="Tasks" />
                    <IconBtn icon={Settings}     active={isSettings}   onClick={() => navigate('/done/settings')} title="Settings" />
                    {/* Chat toggle — only relevant on tasks page, always shown for discoverability */}
                    <IconBtn
                        icon={MessageSquare}
                        active={isChatActive}
                        onClick={() => {
                            if (!isTasks) navigate('/done/tasks');
                            setChatOpen(o => !o);
                        }}
                        title={chatOpen ? 'Hide chat' : 'Show chat'}
                    />
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-[#2e2e2e] mx-1.5 flex-shrink-0" />

                {/* CENTER: run tabs */}
                <div className="flex items-center gap-0.5 flex-1 overflow-x-auto no-scrollbar min-w-0">
                    {tabs.map(tab => (
                        <div key={tab.id} onClick={() => setActiveTabId(tab.id)}
                            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md cursor-pointer flex-shrink-0 max-w-[180px] transition-colors group ${
                                activeTabId === tab.id ? 'bg-[#1e1e1e] text-[#e8e8e8]' : 'text-[#555] hover:bg-[#1a1a1a] hover:text-[#aaa]'
                            }`}>
                            <Zap size={11} strokeWidth={1.8} className="flex-shrink-0 text-[#555]" />
                            <span className="text-[12px] truncate">{tab.label}</span>
                            <button onClick={(e) => closeTab(e, tab.id)}
                                className="ml-0.5 text-[#444] hover:text-[#aaa] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={10} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* RIGHT: org name */}
                <div className="flex items-center ml-2 flex-shrink-0">
                    <span className="text-[12px] text-[#444] px-2">{currentOrg?.name || ''}</span>
                </div>
            </header>

            {/* ══ PAGE CONTENT ══ */}
            <main className="flex-1 overflow-hidden bg-[#111]">
                <div className="h-full overflow-hidden">
                    <Outlet context={{ currentOrg, currentProcess, processes, openTab, chatOpen, setChatOpen }} />
                </div>
            </main>
        </div>
        </TabsContext.Provider>
    );
};

export default DashboardLayout;
