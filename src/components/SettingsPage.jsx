import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Settings, Users, Puzzle, ChevronDown, LogOut, Copy, Check } from 'lucide-react';
import { fetchOrgs, subscribeToTable } from '../services/supabase';
import InlineChatPanel from './InlineChatPanel';

const ORG_ORDER = [
    '078da434-5802-4e98-b066-24761f56a077',
    'bc1cc87f-db42-4e08-932d-e3437f116300',
    '0649e502-b1ff-490f-8d31-cd8e4fb2d1ab',
];

const MOCK_MEMBERS = [
    { name: 'Vishesh Goel', tag: '(You)', email: 'vishesh@zamp.ai', role: 'System Admin', team: '' },
];

const MOCK_USER = {
    email:  'vishesh@zamp.ai',
    userId: '943bf487-378f-43fd-add9-8f88cef789e1',
};

const TIMEZONES = [
    '(GMT+05:30) Calcutta',
    '(GMT+00:00) UTC',
    '(GMT-05:00) Eastern Time',
    '(GMT-08:00) Pacific Time',
    '(GMT+01:00) London',
    '(GMT+02:00) Berlin',
    '(GMT+08:00) Singapore',
    '(GMT+09:00) Tokyo',
];

// Outlined action button used throughout
const OutlineBtn = ({ children, danger, onClick }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1 text-[12px] rounded border transition-colors flex-shrink-0 ${
            danger
                ? 'border-red-700 text-red-500 hover:bg-red-950 hover:border-red-500'
                : 'border-[#333] text-[#aaa] hover:border-[#555] hover:text-[#e8e8e8] bg-transparent'
        }`}
    >
        {children}
    </button>
);

// A card containing rows, each separated by a divider
const SettingsCard = ({ children }) => (
    <div className="border border-[#1e1e1e] rounded-lg overflow-hidden mb-8">
        {React.Children.map(children, (child, i) => (
            <>
                {i > 0 && <div className="border-t border-[#1e1e1e]" />}
                {child}
            </>
        ))}
    </div>
);

const SettingsRow = ({ label, value, action, subtext }) => (
    <div className="flex items-center justify-between px-5 py-4">
        <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[12px] text-[#555]">{label}</span>
            {value && <span className="text-[13px] text-[#ccc]">{value}</span>}
            {subtext && <span className="text-[12px] text-[#555] mt-0.5">{subtext}</span>}
        </div>
        {action && <div className="ml-6 flex-shrink-0">{action}</div>}
    </div>
);

// ── General section ──────────────────────────────────────────
const GeneralSection = () => {
    const [copied, setCopied]     = useState(false);
    const [timezone, setTimezone] = useState('(GMT+05:30) Calcutta');
    const [tzOpen, setTzOpen]     = useState(false);

    const copyUserId = () => {
        navigator.clipboard.writeText(MOCK_USER.userId).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex-1 overflow-y-auto px-8 py-8">
            {/* Profile */}
            <h2 className="text-[15px] font-[600] text-[#e8e8e8] mb-4">Profile</h2>
            <SettingsCard>
                <SettingsRow
                    label="Email"
                    value={MOCK_USER.email}
                    action={<OutlineBtn>Manage</OutlineBtn>}
                />
                <SettingsRow
                    label="User ID"
                    value={MOCK_USER.userId}
                    action={
                        <OutlineBtn onClick={copyUserId}>
                            <span className="flex items-center gap-1.5">
                                {copied ? <Check size={11} /> : <Copy size={11} />}
                                {copied ? 'Copied' : 'Copy'}
                            </span>
                        </OutlineBtn>
                    }
                />
                <SettingsRow
                    label="Delete account"
                    subtext="Permanently delete your account. You'll no longer be able to access your pages or any of the workspaces you belong to."
                    action={<OutlineBtn danger>Delete account</OutlineBtn>}
                />
            </SettingsCard>

            {/* Preferences */}
            <h2 className="text-[15px] font-[600] text-[#e8e8e8] mb-4">Preferences</h2>
            <SettingsCard>
                <SettingsRow
                    label="Theme"
                    value="Dark"
                    action={
                        <div className="relative">
                            <button
                                onClick={() => {}}
                                className="flex items-center gap-1.5 px-3 py-1 border border-[#333] rounded text-[12px] text-[#aaa] hover:border-[#555] transition-colors"
                            >
                                Dark
                                <ChevronDown size={11} className="text-[#555]" />
                            </button>
                        </div>
                    }
                />
                <SettingsRow
                    label="Time Zone"
                    value={timezone}
                    action={
                        <div className="relative">
                            <OutlineBtn onClick={() => setTzOpen(o => !o)}>Change</OutlineBtn>
                            {tzOpen && (
                                <div className="absolute right-0 top-8 z-50 w-56 bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg shadow-xl overflow-hidden">
                                    {TIMEZONES.map(tz => (
                                        <button
                                            key={tz}
                                            onClick={() => { setTimezone(tz); setTzOpen(false); }}
                                            className={`w-full text-left px-3 py-2 text-[12px] hover:bg-[#222] transition-colors ${
                                                tz === timezone ? 'text-[#e8e8e8] bg-[#222]' : 'text-[#888]'
                                            }`}
                                        >
                                            {tz}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    }
                />
            </SettingsCard>
        </div>
    );
};

// ── People section ───────────────────────────────────────────
const PeopleSection = () => (
    <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-[15px] font-[600] text-[#e8e8e8]">People</h2>
            <button className="px-3 py-1.5 bg-white text-black rounded-md text-[12px] font-[500] hover:bg-[#e8e8e8] transition-colors">
                Invite members
            </button>
        </div>

        <input
            type="text"
            placeholder="Search team members"
            className="w-[240px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-3 py-1.5 text-[12px] text-[#ccc] placeholder-[#444] outline-none focus:border-[#444] mb-5"
        />

        <div className="flex items-center gap-1 border-b border-[#222] mb-4">
            {['Team members', 'Invited'].map((t, i) => (
                <button key={t} className={`px-3 py-2 text-[12px] font-[500] border-b-2 -mb-px transition-colors ${
                    i === 0 ? 'border-[#e8e8e8] text-[#e8e8e8]' : 'border-transparent text-[#555] hover:text-[#888]'
                }`}>{t}</button>
            ))}
        </div>

        <div className="grid grid-cols-4 px-2 py-2 text-[11px] font-[600] text-[#444] uppercase tracking-wider border-b border-[#1e1e1e] mb-1">
            <span>Name</span><span>Email</span><span>Role</span><span>Team</span>
        </div>

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
);

// ── Integrations section ─────────────────────────────────────
const IntegrationsSection = () => (
    <div className="flex-1 overflow-y-auto px-8 py-8">
        <h2 className="text-[15px] font-[600] text-[#e8e8e8] mb-6">Integrations</h2>
        <div className="text-[13px] text-[#555]">Integrations coming soon.</div>
    </div>
);

// ── Main ─────────────────────────────────────────────────────
const SettingsPage = () => {
    const { currentOrg, chatOpen } = useOutletContext();
    const navigate        = useNavigate();
    const [section, setSection]         = useState('general');
    const [orgs, setOrgs]               = useState([]);
    const [orgDropOpen, setOrgDropOpen] = useState(false);
    const [activeOrg, setActiveOrg]     = useState(null);
    const [chatVisible, setChatVisible] = useState(false);

    // Sync with navbar chat toggle
    useEffect(() => {
        setChatVisible(chatOpen);
    }, [chatOpen]);

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
        sessionStorage.setItem('currentOrgId',   org.id);
        sessionStorage.setItem('currentOrgName', org.name || '');
        setOrgDropOpen(false);
        navigate('/done/tasks');
    };

    const NAV = [
        { key: 'general',      label: 'General',      icon: Settings },
        { key: 'integrations', label: 'Integrations', icon: Puzzle },
        { key: 'people',       label: 'People',       icon: Users },
    ];

    return (
        <div className="flex h-full bg-[#0d0d0d] overflow-hidden text-[#ccc]">

            {/* ── Chat Panel ── */}
            <div className={`flex flex-col overflow-hidden bg-[#111] border-r border-[#222] transition-all duration-200 ${chatVisible ? 'w-[320px] flex-shrink-0' : 'w-0'}`}>
                {chatVisible && <InlineChatPanel />}
            </div>

            {/* ── Sidebar ── */}
            <div className="w-[160px] flex-shrink-0 border-r border-[#1e1e1e] flex flex-col bg-[#0d0d0d]">

                {/* Org header */}
                <div className="px-3 pt-3 pb-3 border-b border-[#1e1e1e]">
                    <button
                        onClick={() => setOrgDropOpen(o => !o)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#1a1a1a] transition-colors"
                    >
                        <div className="w-5 h-5 rounded bg-[#c0392b] flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                            {activeOrg?.name?.charAt(0) || 'Z'}
                        </div>
                        <span className="text-[13px] font-[500] text-[#ddd] truncate flex-1 text-left">
                            {activeOrg?.name || 'Loading…'}
                        </span>
                        <ChevronDown size={12} className={`text-[#444] flex-shrink-0 transition-transform ${orgDropOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {orgDropOpen && (
                        <div className="mt-1 bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg overflow-hidden">
                            {orgs.map(org => (
                                <button key={org.id} onClick={() => switchOrg(org)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[#222] transition-colors ${activeOrg?.id === org.id ? 'bg-[#222]' : ''}`}>
                                    <span className="font-bold text-[#888]">{org.name?.charAt(0)}</span>
                                    <span className="text-[#ccc] truncate">{org.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Nav */}
                <div className="flex-1 px-2 py-3">
                    <p className="text-[10px] font-[600] text-[#505050] uppercase tracking-wider px-2 mb-2">Account</p>
                    {NAV.map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setSection(key)}
                            className={`w-full flex items-center gap-2 px-2 py-[7px] rounded-md text-[12px] transition-colors mb-0.5 ${
                                section === key ? 'bg-[#1e1e1e] text-[#d8d8d8]' : 'text-[#666] hover:bg-[#181818] hover:text-[#aaa]'
                            }`}>
                            <Icon size={13} strokeWidth={1.6} />
                            <span>{label}</span>
                        </button>
                    ))}
                </div>

                {/* Logout */}
                <div className="px-2 pb-4 border-t border-[#1e1e1e] pt-3">
                    <button onClick={() => { sessionStorage.clear(); navigate('/'); }}
                        className="w-full flex items-center gap-2 px-2 py-[7px] rounded-md text-[12px] text-[#555] hover:bg-[#1a1a1a] hover:text-[#888] transition-colors">
                        <LogOut size={13} strokeWidth={1.6} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#111]">
                {section === 'general'      && <GeneralSection />}
                {section === 'people'       && <PeopleSection />}
                {section === 'integrations' && <IntegrationsSection />}
            </div>
        </div>
    );
};

export default SettingsPage;
