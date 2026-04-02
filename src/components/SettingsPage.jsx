import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Settings, Users, Puzzle, ChevronDown, LogOut } from 'lucide-react';
import { fetchOrgs, subscribeToTable } from '../services/supabase';

const ORG_ORDER = [
    '078da434-5802-4e98-b066-24761f56a077',
    'bc1cc87f-db42-4e08-932d-e3437f116300',
    '0649e502-b1ff-490f-8d31-cd8e4fb2d1ab',
];

const MOCK_MEMBERS = [
    { name: 'Vishesh Goel', tag: '(You)', email: 'vishesh@zamp.ai', role: 'System Admin', team: '' },
];

const SettingsPage = () => {
    const { currentOrg } = useOutletContext();
    const navigate        = useNavigate();
    const [section, setSection]         = useState('people');
    const [orgs, setOrgs]               = useState([]);
    const [orgDropOpen, setOrgDropOpen] = useState(false);
    const [activeOrg, setActiveOrg]     = useState(null);

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
                setActiveOrg((saved && sorted.find(o => o.id === saved)) || sorted[0]);
            } catch (e) { console.error(e); }
        };
        load();
    }, []);

    const switchOrg = (org) => {
        setActiveOrg(org);
        sessionStorage.setItem('currentOrgId', org.id);
        sessionStorage.setItem('currentOrgName', org.name || '');
        setOrgDropOpen(false);
        navigate('/done/tasks');
    };

    const handleLogout = () => {
        sessionStorage.clear();
        navigate('/');
    };

    const NAV = [
        { key: 'general',      label: 'General',      icon: Settings },
        { key: 'integrations', label: 'Integrations', icon: Puzzle },
        { key: 'people',       label: 'People',        icon: Users },
    ];

    return (
        <div className="flex h-full bg-[#111] overflow-hidden text-[#ccc]">

            {/* ── LEFT sidebar ── */}
            <div className="w-[260px] flex-shrink-0 border-r border-[#222] flex flex-col bg-[#111]">

                {/* Org header */}
                <div className="px-4 pt-4 pb-3 border-b border-[#222]">
                    <button
                        onClick={() => setOrgDropOpen(o => !o)}
                        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[#1a1a1a] transition-colors"
                    >
                        <div className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0"
                            style={{ background: '#c0392b' }}>
                            {activeOrg?.avatar_letter || activeOrg?.name?.charAt(0) || 'B'}
                        </div>
                        <span className="text-[13px] font-[500] text-[#ddd] truncate flex-1 text-left">
                            {activeOrg?.name || 'Loading…'}
                        </span>
                        <ChevronDown size={13} className={`text-[#444] transition-transform ${orgDropOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {orgDropOpen && (
                        <div className="mt-1 bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg overflow-hidden">
                            {orgs.map(org => (
                                <button key={org.id} onClick={() => switchOrg(org)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[#222] transition-colors ${activeOrg?.id === org.id ? 'bg-[#222]' : ''}`}>
                                    <div className="w-4 h-4 bg-[#333] rounded flex items-center justify-center text-[#aaa] font-bold text-[9px]">
                                        {org.avatar_letter || org.name?.charAt(0)}
                                    </div>
                                    <span className="text-[#ccc]">{org.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Nav */}
                <div className="flex-1 px-3 py-3">
                    <p className="text-[10px] font-[600] text-[#444] uppercase tracking-wider px-2 mb-2">Account</p>
                    {NAV.map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setSection(key)}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors mb-0.5 ${
                                section === key ? 'bg-[#1e1e1e] text-[#e8e8e8]' : 'text-[#666] hover:bg-[#1a1a1a] hover:text-[#aaa]'
                            }`}>
                            <Icon size={13} strokeWidth={1.6} />
                            <span>{label}</span>
                        </button>
                    ))}
                </div>

                {/* Logout */}
                <div className="px-3 pb-4 border-t border-[#222] pt-3">
                    <button onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-[#555] hover:bg-[#1a1a1a] hover:text-[#888] transition-colors">
                        <LogOut size={13} strokeWidth={1.6} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            {/* ── MAIN content ── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {section === 'people' && (
                    <div className="flex-1 overflow-y-auto p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h1 className="text-[20px] font-[600] text-[#e8e8e8]">People</h1>
                            <button className="px-3 py-1.5 bg-white text-black rounded-md text-[12px] font-[500] hover:bg-[#e8e8e8] transition-colors">
                                Invite members
                            </button>
                        </div>

                        {/* Search */}
                        <input
                            type="text"
                            placeholder="Search team members"
                            className="w-[240px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-3 py-1.5 text-[12px] text-[#ccc] placeholder-[#444] outline-none focus:border-[#444] mb-5"
                        />

                        {/* Tabs */}
                        <div className="flex items-center gap-1 border-b border-[#222] mb-4">
                            {['Team members', 'Invited'].map(t => (
                                <button key={t}
                                    className={`px-3 py-2 text-[12px] font-[500] border-b-2 -mb-px transition-colors ${
                                        t === 'Team members'
                                            ? 'border-[#e8e8e8] text-[#e8e8e8]'
                                            : 'border-transparent text-[#555] hover:text-[#888]'
                                    }`}>
                                    {t}
                                </button>
                            ))}
                        </div>

                        {/* Table header */}
                        <div className="grid grid-cols-4 px-2 py-2 text-[11px] font-[600] text-[#444] uppercase tracking-wider border-b border-[#1e1e1e] mb-1">
                            <span>Name</span>
                            <span>Email</span>
                            <span>Role</span>
                            <span>Team</span>
                        </div>

                        {/* Members */}
                        {MOCK_MEMBERS.map((m, i) => (
                            <div key={i} className="grid grid-cols-4 px-2 py-3 items-center border-b border-[#1a1a1a] hover:bg-[#ffffff03] transition-colors">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-6 h-6 rounded-full bg-[#1e3a1e] flex items-center justify-center text-[#44aa44] text-[10px] font-bold flex-shrink-0">
                                        {m.name.charAt(0)}
                                    </div>
                                    <div>
                                        <span className="text-[13px] text-[#ddd]">{m.name}</span>
                                        {m.tag && <span className="text-[11px] text-[#555] ml-1">{m.tag}</span>}
                                    </div>
                                </div>
                                <span className="text-[12px] text-[#888]">{m.email}</span>
                                <span className="text-[12px] text-[#888]">{m.role}</span>
                                <span className="text-[12px] text-[#444]">{m.team || 'Add Team'}</span>
                            </div>
                        ))}
                    </div>
                )}

                {section === 'general' && (
                    <div className="flex-1 overflow-y-auto p-8">
                        <h1 className="text-[20px] font-[600] text-[#e8e8e8] mb-6">General</h1>
                        <div className="text-[13px] text-[#555]">General settings coming soon.</div>
                    </div>
                )}

                {section === 'integrations' && (
                    <div className="flex-1 overflow-y-auto p-8">
                        <h1 className="text-[20px] font-[600] text-[#e8e8e8] mb-6">Integrations</h1>
                        <div className="text-[13px] text-[#555]">Integrations coming soon.</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPage;
