import React, { useState, useEffect, useContext, createContext } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Zap, Settings, X, LayoutGrid, ChevronDown, Search, LogOut } from 'lucide-react';
import { fetchOrgs, fetchProcesses, subscribeToTable } from '../services/supabase';

const ORG_ORDER = [
    '078da434-5802-4e98-b066-24761f56a077',
    'bc1cc87f-db42-4e08-932d-e3437f116300',
    '0649e502-b1ff-490f-8d31-cd8e4fb2d1ab',
];

// Context so children can open a run tab
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
    const navigate   = useNavigate();
    const location   = useLocation();
    const [orgs, setOrgs]               = useState([]);
    const [currentOrg, setCurrentOrg]   = useState(null);
    const [processes, setProcesses]     = useState([]);
    const [currentProcess, setCurrentProcess] = useState(null);
    const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
    const [orgSearch, setOrgSearch]     = useState('');
    // Run tabs: [{ id, label, icon }]
    const [tabs, setTabs]               = useState([]);
    const [activeTabId, setActiveTabId] = useState(null);

    // ── Orgs ──
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

    // ── Processes ──
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

    // ── Tab management ──
    const openTab = ({ id, label, icon = 'zap' }) => {
        setTabs(prev => {
            if (prev.find(t => t.id === id)) return prev;
            return [...prev, { id, label, icon }];
        });
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

    const handleOrgSwitch = (org) => {
        setCurrentOrg(org);
        setOrgDropdownOpen(false);
        setOrgSearch('');
        setCurrentProcess(null);
        navigate('/done/tasks');
    };

    const handleLogout = () => {
        sessionStorage.clear();
        setOrgDropdownOpen(false);
        navigate('/');
    };

    const filteredOrgs = orgs.filter(o =>
        o.name.toLowerCase().includes(orgSearch.toLowerCase())
    );

    const isHome   = location.pathname === '/done/home';
    const isTasks  = location.pathname === '/done/tasks';

    // Nav icon button
    const IconBtn = ({ icon: Icon, active, onClick, title }) => (
        <button
            onClick={onClick}
            title={title}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                active
                    ? 'bg-[#2a2a2a] text-white'
                    : 'text-[#666] hover:text-[#aaa] hover:bg-[#1e1e1e]'
            }`}
        >
            <Icon size={14} strokeWidth={1.8} />
        </button>
    );

    return (
        <TabsContext.Provider value={{ openTab }}>
        <div className="flex flex-col h-screen bg-white font-sans antialiased text-[#171717]">

            {/* ══ TOP NAVBAR — dark ══ */}
            <header className="flex-shrink-0 h-9 flex items-center bg-[#111] border-b border-[#222] px-2 gap-0 relative z-20">

                {/* LEFT: icon nav buttons */}
                <div className="flex items-center gap-0.5 mr-2">
                    <IconBtn icon={Home}     active={isHome}  onClick={() => navigate('/done/home')}  title="Home" />
                    <IconBtn icon={Zap}      active={isTasks} onClick={() => navigate('/done/tasks')} title="Tasks" />
                    <IconBtn icon={Settings}                  onClick={() => navigate('/done/tasks')} title="Settings" />
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-[#2e2e2e] mx-1.5 flex-shrink-0" />

                {/* CENTER: run tabs */}
                <div className="flex items-center gap-0.5 flex-1 overflow-x-auto no-scrollbar min-w-0">
                    {tabs.map(tab => (
                        <div
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md cursor-pointer flex-shrink-0 max-w-[180px] transition-colors group ${
                                activeTabId === tab.id
                                    ? 'bg-[#1e1e1e] text-white'
                                    : 'text-[#555] hover:bg-[#1a1a1a] hover:text-[#aaa]'
                            }`}
                        >
                            <Zap size={11} strokeWidth={1.8} className="flex-shrink-0 text-[#888]" />
                            <span className="text-[12px] truncate">{tab.label}</span>
                            <button
                                onClick={(e) => closeTab(e, tab.id)}
                                className="ml-0.5 text-[#555] hover:text-[#ccc] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* RIGHT: process explorer + org switcher */}
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <IconBtn icon={LayoutGrid} onClick={() => navigate('/done/processes')} title="Processes" />

                    {/* Org switcher */}
                    <div className="relative">
                        <button
                            onClick={() => setOrgDropdownOpen(o => !o)}
                            className="flex items-center gap-1.5 h-7 px-2 rounded-md text-[#666] hover:text-[#aaa] hover:bg-[#1e1e1e] transition-colors"
                        >
                            <div className="w-4 h-4 bg-[#2e2e2e] rounded flex items-center justify-center text-[#aaa] font-bold text-[9px]">
                                {currentOrg?.avatar_letter || '?'}
                            </div>
                            <span className="text-[12px] max-w-[100px] truncate text-[#666]">{currentOrg?.name || '…'}</span>
                            <ChevronDown size={10} className={`text-[#444] transition-transform ${orgDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {orgDropdownOpen && (
                            <div className="absolute top-full right-0 mt-1 w-[220px] bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.5)] py-1 z-50 max-h-[320px] flex flex-col">
                                <div className="px-2 py-1.5 border-b border-[#2e2e2e]">
                                    <div className="flex items-center gap-2 px-2 py-1 bg-[#222] rounded-md">
                                        <Search size={11} className="text-[#555]" />
                                        <input
                                            type="text"
                                            placeholder="Search org..."
                                            value={orgSearch}
                                            onChange={(e) => setOrgSearch(e.target.value)}
                                            className="bg-transparent text-[12px] text-[#ccc] placeholder-[#555] outline-none w-full"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div className="overflow-y-auto flex-1 py-1">
                                    {filteredOrgs.map(org => (
                                        <button key={org.id} onClick={() => handleOrgSwitch(org)}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[#222] transition-colors ${currentOrg?.id === org.id ? 'bg-[#222]' : ''}`}>
                                            <div className="w-4 h-4 bg-[#333] rounded flex items-center justify-center text-[#aaa] font-bold text-[9px]">{org.avatar_letter}</div>
                                            <span className="text-[#ccc]">{org.name}</span>
                                        </button>
                                    ))}
                                    {filteredOrgs.length === 0 && <div className="px-3 py-2 text-[12px] text-[#555]">No orgs found</div>}
                                </div>
                                <div className="border-t border-[#2e2e2e] py-1">
                                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#888] hover:bg-[#222] hover:text-[#ccc] transition-colors">
                                        <LogOut size={12} /> Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ══ PAGE CONTENT ══ */}
            <main className="flex-1 overflow-hidden bg-white">
                <div className="h-full overflow-y-auto">
                    <Outlet context={{ currentOrg, currentProcess, processes, openTab }} />
                </div>
            </main>
        </div>
        </TabsContext.Provider>
    );
};

export default DashboardLayout;
