import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    ChevronDown, Database, Users, BookOpen, LogOut,
    ArrowLeft, ChevronRight, MessageSquare, Activity,
    Search, Lightbulb, Settings, CheckCircle, Share2, Command, BarChart2
} from 'lucide-react';
import { supabase, fetchOrgs, fetchProcesses, subscribeToTable } from '../services/supabase';

const DashboardLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
                setOrgs(data);
                const savedOrgId = sessionStorage.getItem('currentOrgId');
                const org = savedOrgId ? data.find(o => o.id === savedOrgId) : data[0];
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
        navigate('/done/processes');
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
    const currentProcessName = currentProcess?.name || 'Processes';

    const SidebarIcon = () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M17.5 17.5L17.5 6.5M7.8 3H16.2C17.8802 3 18.7202 3 19.362 3.32698C19.9265 3.6146 20.3854 4.07354 20.673 4.63803C21 5.27976 21 6.11984 21 7.8V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3Z"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    );

    const SidebarItem = ({ to, icon, label, isActive, onClick }) => {
        const Component = to ? NavLink : 'button';
        const props = to ? { to } : { onClick };
        return (
            <Component
                {...props}
                className={`flex h-[34px] w-full items-center gap-2.5 overflow-hidden rounded-md px-2.5 transition-colors ${
                    isActive ? 'bg-[#efefef] text-[#171717] font-[550]' : 'text-[#383838] hover:bg-[#00000005]'
                }`}
            >
                <div className={isActive ? 'text-[#171717]' : 'text-[#8f8f8f]'}>
                    {React.cloneElement(icon, { size: 14, strokeWidth: isActive ? 2 : 1.5 })}
                </div>
                <span className="text-[13px] truncate select-none">{label}</span>
            </Component>
        );
    };

    return (
        <div className="flex h-screen bg-[#FAFAFA] font-sans antialiased text-[#171717]">

            {!isSidebarOpen && (
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="absolute top-0 left-0 z-30 flex h-11 w-10 items-center justify-center text-[#9f9f9f] hover:text-[#555] transition-colors"
                >
                    <SidebarIcon />
                </button>
            )}

            {/* ── Sidebar ── */}
            <aside className={`fixed top-0 left-0 z-20 flex h-screen w-60 flex-col overflow-hidden bg-[#FAFAFA] transition-transform duration-150 ease-[0.4,0,0.2,1] ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-12 flex items-center justify-between px-4 py-3">
                    <img src="/zamp-icon.svg" alt="zamp" className="w-[20px] h-[20px]" />
                    <button onClick={() => setIsSidebarOpen(false)} className="text-[#9f9f9f] hover:text-[#555] opacity-60 hover:opacity-100 transition-all focus:outline-none">
                        <SidebarIcon />
                    </button>
                </div>
                <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-1 mt-2">
                    <div className="pb-4 border-b border-[#f0f0f0]">
                        <SidebarItem to="/done/data"     icon={<Database />}  label="Data"     isActive={location.pathname === '/done/data'} />
                        <SidebarItem to="/done/people"   icon={<Users />}     label="People"   isActive={location.pathname === '/done/people'} />
                        {currentProcess?.id === '6f037763-bd41-410e-ba46-a74dc65dde61'
                            ? <SidebarItem to="/done/accuracy" icon={<BarChart2 />} label="Accuracy" isActive={location.pathname === '/done/accuracy'} />
                            : <SidebarItem to="/done/insights" icon={<Lightbulb />} label="Insights" isActive={location.pathname === '/done/insights'} />
                        }
                    </div>
                    <div className="pt-4">
                        <div className="flex items-center justify-between px-3 mb-2">
                            <span className="text-[12px] font-[550] text-[#8f8f8f]">Processes</span>
                        </div>
                        {processes.length === 0 ? (
                            <div className="px-3 py-2 text-[12px] text-[#cacaca]">No processes yet</div>
                        ) : (
                            processes.map(proc => (
                                <SidebarItem
                                    key={proc.id}
                                    icon={<Activity />}
                                    label={proc.name}
                                    isActive={currentProcess?.id === proc.id && (location.pathname.includes('processes') || isProcessDetailPage)}
                                    onClick={() => { setCurrentProcess(proc); navigate('/done/processes'); }}
                                />
                            ))
                        )}
                    </div>
                </nav>
                <div className="mt-auto border-t border-[#f0f0f0] relative p-1 bg-[#FAFAFA]">
                    <button
                        onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                        className="w-full flex items-center justify-between px-2.5 py-2 text-[13px] text-[#383838] hover:bg-[#00000008] rounded-md transition-colors"
                    >
                        <div className="flex items-center gap-2.5 font-[500]">
                            <div className="w-6 h-6 bg-[#ebebeb] rounded flex items-center justify-center text-black font-bold text-[11px]">
                                {currentOrg?.avatar_letter || '?'}
                            </div>
                            <span>{currentOrg?.name || 'Select Org'}</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-[#c9c9c9] transition-transform duration-200 ${isOrgDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOrgDropdownOpen && (
                        <div className="absolute bottom-full left-1 right-1 mb-1 bg-white border border-[#f0f0f0] rounded-lg shadow-[0_-4px_20px_rgba(0,0,0,0.05)] py-1 z-50 max-h-[320px] flex flex-col">
                            <div className="px-2 py-1.5 border-b border-[#f0f0f0]">
                                <div className="flex items-center gap-2 px-2 py-1 bg-[#f9f9f9] rounded-md border border-[#f0f0f0]">
                                    <Search className="w-3 h-3 text-[#cacaca]" />
                                    <input type="text" placeholder="Search organization..." value={orgSearch}
                                        onChange={(e) => setOrgSearch(e.target.value)}
                                        className="bg-transparent text-[12px] text-[#383838] placeholder-[#cacaca] outline-none w-full" autoFocus />
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-1 py-1">
                                {filteredOrgs.map(org => (
                                    <button key={org.id} onClick={() => handleOrgSwitch(org)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-[#fbfbfb] transition-colors ${currentOrg?.id === org.id ? 'bg-[#f7f7f7]' : ''}`}>
                                        <div className="w-6 h-6 bg-[#ebebeb] rounded flex items-center justify-center text-black font-bold text-[11px]">{org.avatar_letter}</div>
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
            </aside>

            {/* ── Main content ── */}
            <div className={`flex-1 flex flex-col transition-all duration-150 ease-[0.4,0,0.2,1] ${isSidebarOpen ? 'ml-60' : 'ml-0'}`}>

                {/* ════════ TOP BAR ════════ */}
                <header className="h-11 flex items-center justify-between px-3 bg-[#FAFAFA] border-b border-[#ebebeb] relative">

                    {/* LEFT — back · breadcrumb */}
                    <div className="flex items-center gap-1 min-w-0 pl-2">

                        {/* back arrow — only on detail/KB pages */}
                        {(isProcessDetailPage || isKBPage) && (
                            <button onClick={() => navigate('/done/processes')}
                                className="flex items-center justify-center w-7 h-7 rounded-md text-[#b8b8b8] hover:text-[#555] hover:bg-[#f0f0f0] transition-colors flex-shrink-0">
                                <ArrowLeft size={14} />
                            </button>
                        )}

                        {/* breadcrumb */}
                        <div className="flex items-center gap-1.5 text-[13px] min-w-0 ml-0.5">
                            {isKBPage ? (
                                <>
                                    <span className="text-[#b8b8b8] font-normal truncate max-w-[160px]">{currentProcessName}</span>
                                    <span className="text-[#d8d8d8] flex-shrink-0 text-[12px]">/</span>
                                    <span className="text-[#171717] font-[600] flex-shrink-0">Knowledge Base</span>
                                </>
                            ) : isProcessDetailPage ? (
                                <>
                                    <span className="text-[#b8b8b8] font-normal truncate max-w-[160px]">{currentProcessName}</span>
                                    <span className="text-[#d8d8d8] flex-shrink-0 text-[12px]">/</span>
                                    <span className="text-[#171717] font-[600] flex-shrink-0">Activity Logs</span>
                                </>
                            ) : (
                                <span className="text-[#171717] font-[600] truncate max-w-[240px]">{currentProcessName}</span>
                            )}
                        </div>
                    </div>

                    {/* CENTER — Work with Pace search pill */}
                    <div className="absolute left-1/2 -translate-x-1/2">
                        <button className="flex items-center gap-2 h-[28px] px-3 rounded-lg bg-white border border-[#e8e8e8] shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_1px_4px_rgba(0,0,0,0.08)] hover:border-[#d8d8d8] transition-all">
                            <Search size={11} className="text-[#c0c0c0]" strokeWidth={2} />
                            <span className="text-[12px] text-[#b0b0b0] font-[440] whitespace-nowrap">Work with Pace</span>
                            <div className="flex items-center gap-0.5 ml-1 pl-2 border-l border-[#efefef]">
                                <kbd className="flex items-center justify-center w-[16px] h-[16px] rounded-[4px] bg-[#f5f5f5] border border-[#e8e8e8]">
                                    <Command size={8} className="text-[#b0b0b0]" strokeWidth={1.8} />
                                </kbd>
                                <kbd className="flex items-center justify-center px-1 h-[16px] rounded-[4px] bg-[#f5f5f5] border border-[#e8e8e8] text-[9px] text-[#b0b0b0] font-[600]">K</kbd>
                            </div>
                        </button>
                    </div>

                    {/* RIGHT — KB · comments · settings · checks · share */}
                    <div className="flex items-center gap-0.5">

                        {currentProcess && (
                            <button onClick={() => navigate('/done/knowledge-base')}
                                title="Knowledge Base"
                                className="flex items-center justify-center w-7 h-7 rounded-md text-[#b8b8b8] hover:text-[#555] hover:bg-[#f0f0f0] transition-colors">
                                <BookOpen size={14} strokeWidth={1.6} />
                            </button>
                        )}

                        <button className="flex items-center justify-center w-7 h-7 rounded-md text-[#b8b8b8] hover:text-[#555] hover:bg-[#f0f0f0] transition-colors">
                            <MessageSquare size={14} strokeWidth={1.6} />
                        </button>

                        {/* Settings with badge */}
                        <button className="relative flex items-center justify-center w-7 h-7 rounded-md text-[#b8b8b8] hover:text-[#555] hover:bg-[#f0f0f0] transition-colors">
                            <Settings size={14} strokeWidth={1.6} />
                            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-[14px] px-[3px] rounded-full bg-[#1a1a1a] text-white text-[8px] font-[700] leading-none">2</span>
                        </button>

                        {/* Check with badge */}
                        <button className="relative flex items-center justify-center w-7 h-7 rounded-md text-[#b8b8b8] hover:text-[#555] hover:bg-[#f0f0f0] transition-colors">
                            <CheckCircle size={14} strokeWidth={1.6} />
                            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-[14px] px-[3px] rounded-full bg-[#1a1a1a] text-white text-[8px] font-[700] leading-none">5</span>
                        </button>

                        <div className="w-px h-4 bg-[#e8e8e8] mx-1.5" />

                        <button className="flex items-center gap-1.5 h-[28px] px-2.5 rounded-md bg-[#171717] hover:bg-[#2d2d2d] text-white text-[12px] font-[500] transition-colors">
                            <Share2 size={11} strokeWidth={2} />
                            <span>Share</span>
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <main className={`flex-1 bg-white border-l border-[#f0f0f0] overflow-hidden ${isSidebarOpen ? 'rounded-tl-[24px]' : ''}`}>
                    <div className="h-full overflow-y-auto bg-white">
                        <Outlet context={{ currentOrg, currentProcess, processes }} />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
