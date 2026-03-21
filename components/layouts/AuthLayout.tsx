/* eslint-disable i18next/no-literal-string */
import app from '@/lib/app';
import { useTranslation } from 'next-i18next';

interface AuthLayoutProps {
  children: React.ReactNode;
  heading?: string;
  description?: string;
}

export default function AuthLayout({
  children,
  heading,
  description,
}: AuthLayoutProps) {
  const { t } = useTranslation('common');

  return (
    <>
      <style jsx global>{`
        .auth-page .form-control { margin-bottom: 0 !important; }
        .auth-page .label { padding: 0 0 6px 0 !important; }
        .auth-page .label-text {
          font-size: 12px !important;
          color: #71717a !important;
          font-weight: 500 !important;
        }
        .auth-page .label-text-alt { font-size: 11px !important; }
        .auth-page input:not([type='checkbox']):not([type='radio']),
        .auth-page .input {
          height: 42px !important;
          min-height: 42px !important;
          font-size: 14px !important;
          padding: 0 14px !important;
          background: #18181b !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 10px !important;
          color: #e4e4e7 !important;
        }
        .auth-page input:focus {
          border-color: rgba(59,130,246,0.5) !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.08) !important;
        }
        .auth-page input::placeholder {
          color: #3f3f46 !important;
          font-size: 13px !important;
        }
        .auth-page .space-y-5 > * + * {
          margin-top: 18px !important;
        }
        .auth-page .checkbox {
          width: 16px !important;
          height: 16px !important;
          min-height: 16px !important;
          border-radius: 4px !important;
          border-color: rgba(255,255,255,0.1) !important;
          background: #18181b !important;
        }
        .auth-page .btn-primary,
        .auth-page button[type='submit'] {
          height: 44px !important;
          min-height: 44px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          border-radius: 10px !important;
          background-color: #2563eb !important;
          border-color: #2563eb !important;
          color: #fff !important;
        }
        .auth-page .btn-primary:hover,
        .auth-page button[type='submit']:hover {
          background-color: #1d4ed8 !important;
          border-color: #1d4ed8 !important;
        }
        .auth-page .relative.flex {
          position: relative !important;
        }
        .auth-page .relative.flex button[type='button'] {
          position: absolute !important;
          right: 12px !important;
          top: auto !important;
          bottom: 10px !important;
        }
        .auth-page .relative.flex button[type='button'] svg {
          width: 18px !important;
          height: 18px !important;
          color: #52525b !important;
        }
        @media (max-width: 640px) {
          .auth-page input:not([type='checkbox']):not([type='radio']),
          .auth-page .input {
            height: 46px !important;
            min-height: 46px !important;
            font-size: 16px !important;
          }
          .auth-page .btn-primary,
          .auth-page button[type='submit'] {
            height: 48px !important;
            min-height: 48px !important;
            font-size: 15px !important;
          }
        }
      `}</style>

      <div className="auth-page flex min-h-screen" style={{ backgroundColor: '#0c0c0e' }}>

        {/* ── 좌측: 브랜드 (lg+) — 수직/수평 모두 가운데 ── */}
        <div
          className="hidden lg:flex lg:w-[46%] xl:w-[48%]"
          style={{
            backgroundColor: '#fafbfc',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '48px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* accent */}
          <div style={{
            position: 'absolute', top: '-120px', right: '-60px',
            width: '360px', height: '360px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #e0e7ff 0%, #dbeafe 50%, #ede9fe 100%)',
            opacity: 0.25,
          }} />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: '340px', width: '100%' }}>
            <p style={{
              fontSize: '10px', letterSpacing: '4px', color: '#94a3b8',
              fontWeight: 500, textTransform: 'uppercase', margin: '0 0 16px',
            }}>
              {app.name}
            </p>
            <h1 style={{
              fontSize: '28px', fontWeight: 700, color: '#0f172a',
              margin: '0 0 10px', letterSpacing: '-0.6px', lineHeight: 1.35,
            }}>
              현장을 한눈에,<br />업무를 하나로.
            </h1>
            <p style={{
              fontSize: '14px', color: '#94a3b8', margin: '0 0 48px', lineHeight: 1.7,
            }}>
              우수제품 패널 기업을 위한 B2B 현장관리 플랫폼
            </p>

            {[
              { color: '#2563eb', text: '영업부터 출하까지 전 과정 통합 관리' },
              { color: '#16a34a', text: '본사 · 현장 · 시공업체 실시간 협업' },
              { color: '#9333ea', text: '조달청 PDF 업로드로 현장 자동 등록' },
            ].map((feat, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: i < 2 ? '16px' : 0 }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: feat.color, marginTop: '6px', flexShrink: 0,
                }} />
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                  {feat.text}
                </p>
              </div>
            ))}

            <p style={{ fontSize: '11px', color: '#cbd5e1', margin: '56px 0 0' }}>
              © {new Date().getFullYear()} LOOKUP9
            </p>
          </div>
        </div>

        {/* ── 우측: 로그인 폼 ── */}
        <div
          className="flex-1 flex flex-col justify-center items-center px-6 py-12 sm:px-10"
          style={{ backgroundColor: '#0c0c0e', minHeight: '100vh' }}
        >
          <div style={{ width: '100%', maxWidth: '340px' }}>

            {/* 모바일 로고 (lg 미만) */}
            <div className="lg:hidden" style={{ textAlign: 'center', marginBottom: '48px' }}>
              <p style={{
                fontSize: '10px', letterSpacing: '3px', color: '#3f3f46',
                fontWeight: 500, textTransform: 'uppercase', margin: '0 0 10px',
              }}>
                B2B SaaS Platform
              </p>
              <h1 style={{
                fontSize: '22px', fontWeight: 700, color: '#fafafa',
                margin: '0 0 6px', letterSpacing: '-0.3px',
              }}>
                {app.name}
              </h1>
              <p style={{ fontSize: '13px', color: '#52525b', margin: 0, lineHeight: 1.6 }}>
                현장관리 플랫폼
              </p>
            </div>

            {/* 타이틀 — 가운데 */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              {heading && (
                <h2 style={{
                  fontSize: '18px', fontWeight: 600, color: '#fafafa',
                  margin: '0 0 6px', letterSpacing: '-0.2px',
                }}>
                  {t(heading)}
                </h2>
              )}
              {description && (
                <p style={{ fontSize: '13px', color: '#52525b', margin: 0 }}>
                  {t(description)}
                </p>
              )}
            </div>

            {/* 폼 슬롯 */}
            <div>{children}</div>

            {/* 하단 안내 */}
            <div style={{
              marginTop: '32px', paddingTop: '20px',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '11px', color: '#27272a', margin: 0, lineHeight: 1.7 }}>
                상단 메뉴에서 라이트/다크 모드 변경 가능
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
