import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    ChevronDown, Database, Users, BookOpen, LogOut,
    ArrowLeft, Activity, Search, Lightbulb, BarChart2,
    ListTodo
} from 'lucide-react';
import { fetchOrgs, fetchProcesses, subscribeToTable } from '../services/supabase';

const HIDDEN_PROCESS_IDS = new Set([
    '795b85bb-ef67-4e56-aaec-2a07d5ed8c90',
    'fa91e289-044b-4fc9-a626-ebdb6c0ee64b',
    '634c603a-b18f-4605-aa2a-1160bcc26f20',
    '16ff2409-24ba-4df3-ab36-f1b70d8243e4',
    'ba0c4a4c-815c-4e10-8720-bbb891c6f5b7',
    'ac2bc5a3-8501-466b-bc68-d2d5e7ccaf96',
    '1b9b7c8c-d65b-4c8a-a76e-d1dc1b23ab90',
]);

const ORG_ORDER = [
    '078da434-5802-4e98-b066-24761f56a077',
    'bc1cc87f-db42-4e08-932d-e3437f116300',
    '0649e502-b1ff-490f-8d31-cd8e4fb2d1ab',
];

const DashboardLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
    const [orgSearch, setOrgSearch] = useState('');
    const [orgs, setOrgs] = useState([]);
    const [currentOrg, setCurrentOrg] = useState(null);
    const [processes, setProcesses] = useState([]);
    const [currentProcess, setCurrentProcess] = useState(null);

    useEffect(() => {
        const loadOrgs = async () => {
            try {
                const data = await fetchOrgs();
                const sorted = [...data].sort((a, b) => {
                    const ai = ORG_ORDER.indexOf(a.id);
                    const bi = ORG_ORDER.indexOf(b.id);
                    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                });
                setOrgs(sorted);
                const savedOrgId = sessionStorage.getItem('currentOrgId');
                const org = savedOrgId ? sorted.find(o => o.id === savedOrgId) : sorted[0];
                if (org) setCurrentOrg(org);
            } catch (err) { console.error('Error loading orgs:', err); }
        };
        loadOrgs();
        const unsub = subscribeToTable('organizations', undefined, () => loadOrgs());
        return unsub;
    }, []);

    useEffect(() => {
        if (!currentOrg) return;
        sessionStorage.setItem('currentOrgId', currentOrg.id);
        sessionStorage.setItem('currentOrgName', currentOrg.name || '');
        const loadProcesses = async () => {
            try {
                const data = await fetchProcesses(currentOrg.id);
                setProcesses(data);
                const savedProcId = sessionStorage.getItem('currentProcessId');
                const proc = savedProcId ? data.find(p => p.id === savedProcId) : data[0];
                if (proc) setCurrentProcess(proc);
                else setCurrentProcess(null);
            } catch (err) { console.error('Error loading processes:', err); }
        };
        loadProcesses();
        const unsub = subscribeToTable('processes', `org_id=eq.${currentOrg.id}`, () => loadProcesses());
        return unsub;
    }, [currentOrg]);

    useEffect(() => {
        if (currentProcess) {
            sessionStorage.setItem('currentProcessId', currentProcess.id);
            sessionStorage.setItem('currentProcessName', currentProcess.name || '');
        }
    }, [currentProcess]);

    const handleOrgSwitch = (org) => {
        setCurrentOrg(org);
        setIsOrgDropdownOpen(false);
        setOrgSearch('');
        setCurrentProcess(null);
        navigate('/done/tasks');
    };

    const handleLogout = () => {
        setIsOrgDropdownOpen(false);
        sessionStorage.clear();
        navigate('/');
    };

    const filteredOrgs = orgs.filter(o =>
        o.name.toLowerCase().includes(orgSearch.toLowerCase())
    );

    const isProcessDetailPage = location.pathname.includes('/process/');
    const isKBPage = location.pathname.includes('/knowledge-base');
    const isTasksPage = location.pathname === '/done/tasks';
    const currentProcessName = currentProcess?.name || 'Processes';

    const NavItem = ({ to, label, isActive }) => (
        <NavLink
            to={to}
            className={`flex items-center h-full px-3 text-[13px] font-[500] border-b-2 transition-colors whitespace-nowrap ${
                isActive
                    ? 'border-[#171717] text-[#171717]'
                    : 'border-transparent text-[#8f8f8f] hover:text-[#383838]'
            }`}
        >
            {label}
        </NavLink>
    );

    const insightsOrAccuracy = currentProcess?.id === '6f037763-bd41-410e-ba46-a74dc65dde61'
        ? { to: '/done/accuracy', label: 'Accuracy' }
        : { to: '/done/insights', label: 'Insights' };


    return (
        <div className="flex flex-col h-screen bg-white font-sans antialiased text-[#171717]">

            {/* ══ TOP NAVBAR ══ */}
            <header className="flex-shrink-0 h-11 flex items-center justify-between px-4 bg-[#FAFAFA] border-b border-[#ebebeb] relative z-20">

                {/* LEFT — logo + nav links */}
                <div className="flex items-center h-full gap-1">
                    <img src="/zamp-icon.svg" alt="zamp" className="w-[18px] h-[18px] mr-3 flex-shrink-0" />

                    {/* Back arrow on detail/KB pages */}
                    {(isProcessDetailPage || isKBPage) && (
                        <button
                            onClick={() => navigate('/done/processes')}
                            className="flex items-center justify-center w-7 h-7 rounded-md text-[#b8b8b8] hover:text-[#555] hover:bg-[#f0f0f0] transition-colors mr-1 flex-shrink-0"
                        >
                            <ArrowLeft size={14} />
                        </button>
                    )}

                    <NavItem to="/done/tasks"     label="Tasks"    isActive={location.pathname === '/done/tasks'} />
                    <NavItem to="/done/processes" label="Processes" isActive={location.pathname.includes('/done/processes') || isProcessDetailPage} />
                    <NavItem to="/done/data"      label="Data"     isActive={location.pathname === '/done/data'} />
                    <NavItem to="/done/people"    label="People"   isActive={location.pathname === '/done/people'} />
                    <NavItem to={insightsOrAccuracy.to} label={insightsOrAccuracy.label} isActive={location.pathname === insightsOrAccuracy.to} />
                </div>

                {/* RIGHT — KB button + org switcher */}
                <div className="flex items-center gap-2">
                    {currentProcess && !isTasksPage && (
                        <button
                            onClick={() => navigate('/done/knowledge-base')}
                            title="Knowledge Base"
                            className="flex items-center justify-center w-[28px] h-[28px] rounded-lg bg-white border border-[#e8e8e8] shadow-[0_1px_2px_rgba(0,0,0,0.06)] text-[#5f5f5f] hover:text-[#333] hover:shadow-[0_2px_5px_rgba(0,0,0,0.1)] transition-all"
                        >
                            <BookOpen size={14} strokeWidth={1.6} />
                        </button>
                    )}

                    {/* Org switcher */}
                    <div className="relative">
                        <button
                            onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-[#383838] hover:bg-[#00000008] transition-colors"
                        >
                            <div className="w-5 h-5 bg-[#ebebeb] rounded flex items-center justify-center text-black font-bold text-[10px]">
                                {currentOrg?.avatar_letter || '?'}
                            </div>
                            <span className="font-[500] max-w-[140px] truncate">{currentOrg?.name || 'Select Org'}</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-[#c9c9c9] transition-transform duration-200 ${isOrgDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isOrgDropdownOpen && (
                            <div className="absolute top-full right-0 mt-1 w-[220px] bg-white border border-[#f0f0f0] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.08)] py-1 z-50 max-h-[320px] flex flex-col">
                                <div className="px-2 py-1.5 border-b border-[#f0f0f0]">
                                    <div className="flex items-center gap-2 px-2 py-1 bg-[#f9f9f9] rounded-md border border-[#f0f0f0]">
                                        <Search className="w-3 h-3 text-[#cacaca]" />
                                        <input
                                            type="text"
                                            placeholder="Search organization..."
                                            value={orgSearch}
                                            onChange={(e) => setOrgSearch(e.target.value)}
                                            className="bg-transparent text-[12px] text-[#383838] placeholder-[#cacaca] outline-none w-full"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div className="overflow-y-auto flex-1 py-1">
                                    {filteredOrgs.map(org => (
                                        <button key={org.id} onClick={() => handleOrgSwitch(org)}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-[#fbfbfb] transition-colors ${currentOrg?.id === org.id ? 'bg-[#f7f7f7]' : ''}`}>
                                            <div className="w-5 h-5 bg-[#ebebeb] rounded flex items-center justify-center text-black font-bold text-[10px]">{org.avatar_letter}</div>
                                            <span className="text-[#383838] font-[450]">{org.name}</span>
                                        </button>
                                    ))}
                                    {filteredOrgs.length === 0 && <div className="px-3 py-2 text-[12px] text-[#cacaca]">No orgs found</div>}
                                </div>
                                <div className="border-t border-[#f0f0f0] py-1">
                                    <button onClick={handleLogout} className="w-full flex items-center px-3 py-2 text-xs text-[#383838] hover:bg-[#fbfbfb]">
                                        <LogOut className="w-3.5 h-3.5 mr-2.5" />Logout
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
                    <Outlet context={{ currentOrg, currentProcess, processes }} />
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
