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
        .auth-input,
        .auth-page input:not([type='checkbox']):not([type='radio']),
        .auth-page .input {
          height: 36px !important;
          min-height: 36px !important;
          max-height: 36px !important;
          font-size: 13px !important;
          padding: 0 12px !important;
          background: #111113 !important;
          border: 1px solid rgba(255,255,255,0.06) !important;
          border-radius: 7px !important;
          color: #d4d4d8 !important;
        }
        .auth-page input:focus {
          border-color: rgba(59,130,246,0.4) !important;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.1) !important;
        }
        .auth-page input::placeholder {
          color: #3f3f46 !important;
          font-size: 12.5px !important;
        }
        .auth-page .label {
          padding: 0 0 5px 0 !important;
        }
        .auth-page .label-text {
          font-size: 10.5px !important;
          color: #52525b !important;
          font-weight: 500 !important;
          letter-spacing: 0.3px !important;
        }
        .auth-page .label-text-alt {
          font-size: 10px !important;
        }
        .auth-page .form-control {
          margin-bottom: 0 !important;
        }
        .auth-page .btn-primary,
        .auth-page button[type='submit'] {
          height: 38px !important;
          min-height: 38px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          border-radius: 7px !important;
          letter-spacing: 0.3px !important;
        }
        .auth-page .checkbox {
          width: 14px !important;
          height: 14px !important;
          min-height: 14px !important;
          border-radius: 3px !important;
        }
        .auth-page .space-y-5 > * + * {
          margin-top: 14px !important;
        }
        @media (max-width: 640px) {
          .auth-page input:not([type='checkbox']):not([type='radio']),
          .auth-page .input {
            height: 40px !important;
            min-height: 40px !important;
            max-height: 40px !important;
            font-size: 14px !important;
          }
          .auth-page .btn-primary,
          .auth-page button[type='submit'] {
            height: 42px !important;
            min-height: 42px !important;
            font-size: 14px !important;
          }
        }
      `}</style>

      <div className="auth-page flex min-h-screen" style={{ backgroundColor: '#0a0a0c' }}>

        {/* ── 좌측: 브랜드 (lg+) ── */}
        <div
          className="hidden lg:flex lg:w-[46%] xl:w-[48%]"
          style={{
            backgroundColor: '#fafbfc',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '56px 48px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* accent circle */}
          <div style={{
            position: 'absolute', top: '-100px', right: '-100px',
            width: '320px', height: '320px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #e0e7ff 0%, #dbeafe 50%, #ede9fe 100%)',
            opacity: 0.3,
          }} />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: '360px' }}>
            <p style={{
              fontSize: '10px', letterSpacing: '4px', color: '#94a3b8',
              fontWeight: 500, textTransform: 'uppercase', margin: '0 0 14px',
            }}>
              {app.name}
            </p>
            <h1 style={{
              fontSize: '30px', fontWeight: 700, color: '#0f172a',
              margin: '0 0 8px', letterSpacing: '-0.8px', lineHeight: 1.3,
            }}>
              현장을 한눈에,<br />업무를 하나로.
            </h1>
            <p style={{
              fontSize: '13px', color: '#94a3b8', margin: '0 0 44px', lineHeight: 1.7,
            }}>
              우수제품 패널 기업을 위한 B2B 현장관리 플랫폼
            </p>

            {[
              { color: '#2563eb', text: '영업부터 출하까지 전 과정 통합 관리' },
              { color: '#16a34a', text: '본사 · 현장 · 시공업체 실시간 협업' },
              { color: '#9333ea', text: '조달청 PDF 업로드로 현장 자동 등록' },
            ].map((feat, i) => (
              <div key={i} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', marginBottom: i < 2 ? '14px' : 0 }}>
                <div style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: feat.color, marginTop: '5px', flexShrink: 0,
                }} />
                <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                  {feat.text}
                </p>
              </div>
            ))}

            <p style={{ fontSize: '10px', color: '#cbd5e1', margin: '48px 0 0' }}>
              © {new Date().getFullYear()} LOOKUP9
            </p>
          </div>
        </div>

        {/* ── 우측: 로그인 폼 ── */}
        <div
          className="flex-1 flex flex-col justify-center items-center px-6 py-12 sm:px-10"
          style={{ backgroundColor: '#0a0a0c', minHeight: '100vh' }}
        >
          <div style={{ width: '100%', maxWidth: '280px' }}>

            {/* 모바일 로고 (lg 미만) */}
            <div className="lg:hidden" style={{ textAlign: 'center', marginBottom: '40px' }}>
              <p style={{
                fontSize: '9px', letterSpacing: '3.5px', color: '#3f3f46',
                fontWeight: 500, textTransform: 'uppercase', margin: '0 0 8px',
              }}>
                B2B SaaS Platform
              </p>
              <h1 style={{
                fontSize: '24px', fontWeight: 700, color: '#fafafa',
                margin: '0 0 6px', letterSpacing: '-0.5px',
              }}>
                {app.name}
              </h1>
              <p style={{ fontSize: '12px', color: '#52525b', margin: 0, lineHeight: 1.6 }}>
                우수제품 패널 기업을 위한 통합 현장관리
              </p>
            </div>

            {/* 로그인 타이틀 — 가운데 */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              {heading && (
                <h2 style={{
                  fontSize: '17px', fontWeight: 600, color: '#e4e4e7',
                  margin: '0 0 4px', letterSpacing: '-0.2px',
                }}>
                  {t(heading)}
                </h2>
              )}
              {description && (
                <p style={{ fontSize: '11.5px', color: '#3f3f46', margin: 0 }}>
                  {t(description)}
                </p>
              )}
            </div>

            {/* 폼 슬롯 */}
            <div>{children}</div>

            {/* 하단 안내 */}
            <div style={{
              marginTop: '28px', paddingTop: '18px',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '10px', color: '#27272a', margin: 0, lineHeight: 1.7 }}>
                상단 메뉴에서 라이트/다크 모드 변경 가능
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
