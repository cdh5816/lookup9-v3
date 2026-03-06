import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';
import { PlusIcon, XMarkIcon, TrashIcon, EnvelopeIcon, EnvelopeOpenIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface MessageData {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender: { id: string; name: string; position: string | null; department: string | null };
  receiver: { id: string; name: string; position: string | null; department: string | null };
}

type MsgTab = 'inbox' | 'sent';

const MessagesPage = () => {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<MsgTab>('inbox');
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMsg, setSelectedMsg] = useState<MessageData | null>(null);
  const [showCompose, setShowCompose] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const box = activeTab === 'sent' ? 'sent' : 'inbox';
    const res = await fetch(`/api/messages?box=${box}`);
    if (res.ok) { const data = await res.json(); setMessages(data.data || []); }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const handleRead = async (msg: MessageData) => {
    if (activeTab === 'inbox' && !msg.isRead) {
      await fetch('/api/messages', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msg.id }),
      });
    }
    setSelectedMsg(msg);
  };

  const handleDelete = async (msgId: string) => {
    if (!confirm(t('msg-delete-confirm'))) return;
    await fetch('/api/messages', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: msgId }),
    });
    setSelectedMsg(null);
    fetchMessages();
  };

  const tabs: { key: MsgTab; label: string }[] = [
    { key: 'inbox', label: t('msg-inbox') },
    { key: 'sent', label: t('msg-sent') },
  ];

  return (
    <>
      <Head><title>{t('nav-messages')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('nav-messages')}</h2>
          <Button color="primary" size="sm" onClick={() => { setShowCompose(!showCompose); setSelectedMsg(null); }}>
            {showCompose ? <XMarkIcon className="w-4 h-4 mr-1" /> : <PlusIcon className="w-4 h-4 mr-1" />}
            {showCompose ? t('cancel') : t('msg-compose')}
          </Button>
        </div>

        {/* 작성 폼 */}
        {showCompose && <ComposeForm onSent={() => { setShowCompose(false); fetchMessages(); }} />}

        {/* 탭 */}
        <div className="border-b border-gray-800">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSelectedMsg(null); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 상세보기 */}
        {selectedMsg ? (
          <div className="rounded-lg border border-gray-800 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selectedMsg.title}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {activeTab === 'inbox' ? t('msg-from') : t('msg-to')}:{' '}
                  {activeTab === 'inbox'
                    ? `${selectedMsg.sender.position || ''} ${selectedMsg.sender.name}`
                    : `${selectedMsg.receiver.position || ''} ${selectedMsg.receiver.name}`}
                  {' · '}{new Date(selectedMsg.createdAt).toLocaleString('ko-KR')}
                </p>
              </div>
              <div className="flex gap-1">
                <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(selectedMsg.id)}>
                  <TrashIcon className="w-4 h-4" />
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => setSelectedMsg(null)}>
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="border-t border-gray-800 pt-4">
              <p className="text-sm whitespace-pre-wrap">{selectedMsg.content}</p>
            </div>
          </div>
        ) : (
          /* 목록 */
          loading ? (
            <div className="text-center py-10"><span className="loading loading-spinner loading-sm"></span></div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-gray-500">{t('msg-empty')}</div>
          ) : (
            <div className="space-y-1">
              {messages.map((msg) => {
                const other = activeTab === 'inbox' ? msg.sender : msg.receiver;
                const isUnread = activeTab === 'inbox' && !msg.isRead;
                return (
                  <button key={msg.id} onClick={() => handleRead(msg)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center gap-3 ${
                      isUnread ? 'border-blue-800 bg-blue-900/10' : 'border-gray-800 hover:border-gray-700'
                    }`}>
                    {isUnread
                      ? <EnvelopeIcon className="w-4 h-4 text-blue-400 shrink-0" />
                      : <EnvelopeOpenIcon className="w-4 h-4 text-gray-600 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm truncate ${isUnread ? 'font-semibold' : ''}`}>{msg.title}</span>
                        <span className="text-xs text-gray-500 shrink-0 ml-2">{new Date(msg.createdAt).toLocaleDateString('ko-KR')}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {other.position ? `${other.position} ` : ''}{other.name}
                        {other.department && ` (${other.department})`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}
      </div>
    </>
  );
};

// ========= 작성 폼 =========
const ComposeForm = ({ onSent }: { onSent: () => void }) => {
  const { t } = useTranslation('common');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [receiver, setReceiver] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 1) { setSearchResults([]); return; }
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (res.ok) { const data = await res.json(); setSearchResults(data.data || []); }
  };

  const handleSend = async () => {
    if (!receiver || !title || !content) { setError(t('msg-fill-all')); return; }
    setSubmitting(true); setError('');
    const res = await fetch('/api/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId: receiver.id, title, content }),
    });
    if (res.ok) { onSent(); }
    else { const data = await res.json(); setError(data.error?.message || t('unknown-error')); }
    setSubmitting(false);
  };

  return (
    <div className="border border-gray-700 rounded-lg p-5 space-y-3">
      <h3 className="font-semibold">{t('msg-compose')}</h3>
      {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}

      {/* 받는사람 검색 */}
      <div>
        <label className="label"><span className="label-text text-xs">{t('msg-to')} *</span></label>
        {receiver ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="badge">{receiver.position ? `${receiver.position} ` : ''}{receiver.name}</span>
            <button className="btn btn-ghost btn-xs" onClick={() => setReceiver(null)}><XMarkIcon className="w-3 h-3" /></button>
          </div>
        ) : (
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" className="input input-bordered input-sm w-full pl-9"
              placeholder={t('assign-search-placeholder')} value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)} />
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 border border-gray-700 rounded bg-gray-900 max-h-32 overflow-y-auto">
                {searchResults.map((u) => (
                  <button key={u.id} onClick={() => { setReceiver(u); setSearchQuery(''); setSearchResults([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800">
                    {u.position ? `${u.position} ` : ''}{u.name} <span className="text-gray-500">({u.email})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="label"><span className="label-text text-xs">{t('msg-title')} *</span></label>
        <input type="text" className="input input-bordered input-sm w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label"><span className="label-text text-xs">{t('msg-content')} *</span></label>
        <textarea className="textarea textarea-bordered w-full text-sm" rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button color="primary" size="sm" loading={submitting} onClick={handleSend}>{t('msg-send')}</Button>
      </div>
    </div>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default MessagesPage;
