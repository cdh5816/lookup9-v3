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
    <div className="flex min-h-screen" style={{ backgroundColor: '#09090B' }}>

      {/* ── 좌측: 브랜드 소개 (lg 이상에서만 표시) ── */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-[48%]"
        style={{
          backgroundColor: '#FFFFFF',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '3rem 2.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 배경 장식 — 미니멀 그리드 */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'linear-gradient(#0F172A 1px, transparent 1px), linear-gradient(90deg, #0F172A 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '380px', width: '100%' }}>
          {/* 로고 + 타이틀 */}
          <p style={{
            fontSize: '11px', letterSpacing: '2.5px', color: '#94A3B8',
            margin: '0 0 14px', fontWeight: 500, textTransform: 'uppercase',
          }}>
            B2B SaaS Platform
          </p>
          <h1 style={{
            fontSize: '36px', fontWeight: 700, color: '#0F172A',
            margin: '0 0 8px', letterSpacing: '-0.5px',
          }}>
            {app.name}
          </h1>
          <p style={{
            fontSize: '15px', color: '#64748B', margin: '0 0 40px',
            lineHeight: 1.7,
          }}>
            우수제품 패널 기업을 위한<br />통합 현장관리 플랫폼
          </p>

          {/* 피처 카드 1 */}
          <div style={{
            background: '#F8FAFC', borderRadius: '14px', padding: '20px',
            marginBottom: '14px', border: '1px solid #F1F5F9',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E',
                boxShadow: '0 0 0 3px rgba(34,197,94,0.15)',
              }} />
              <p style={{ fontSize: '14px', color: '#334155', margin: 0, fontWeight: 600 }}>
                영업 → 수주 → 생산 → 출하
              </p>
            </div>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>
              조달청 계약부터 납품까지 전 과정을 하나의 플랫폼에서 관리합니다.
            </p>
          </div>

          {/* 피처 카드 2 */}
          <div style={{
            background: '#F8FAFC', borderRadius: '14px', padding: '20px',
            marginBottom: '14px', border: '1px solid #F1F5F9',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', background: '#3B82F6',
                boxShadow: '0 0 0 3px rgba(59,130,246,0.15)',
              }} />
              <p style={{ fontSize: '14px', color: '#334155', margin: 0, fontWeight: 600 }}>
                실시간 협업
              </p>
            </div>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>
              본사 · 현장 · 시공업체 — 권한 기반 정보 공유
            </p>
          </div>

          {/* 피처 카드 3 */}
          <div style={{
            background: '#F8FAFC', borderRadius: '14px', padding: '20px',
            border: '1px solid #F1F5F9',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', background: '#A855F7',
                boxShadow: '0 0 0 3px rgba(168,85,247,0.15)',
              }} />
              <p style={{ fontSize: '14px', color: '#334155', margin: 0, fontWeight: 600 }}>
                PDF 자동 파싱
              </p>
            </div>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>
              조달청 분할납품요구서를 업로드하면 현장이 자동으로 등록됩니다.
            </p>
          </div>

          {/* 하단 카피라이트 */}
          <p style={{
            fontSize: '11px', color: '#CBD5E1', margin: '40px 0 0',
            textAlign: 'center',
          }}>
            © {new Date().getFullYear()} LOOKUP9. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── 우측: 로그인 폼 (항상 표시) ── */}
      <div
        className="flex-1 flex flex-col justify-center items-center px-5 py-10 sm:px-8"
        style={{ backgroundColor: '#09090B', minHeight: '100vh' }}
      >
        <div style={{ maxWidth: '400px', width: '100%' }}>
          {/* 모바일 로고 (lg 미만에서만) */}
          <div className="lg:hidden" style={{ textAlign: 'center', marginBottom: '32px' }}>
            <p style={{
              fontSize: '10px', letterSpacing: '2px', color: '#52525B',
              margin: '0 0 8px', fontWeight: 500, textTransform: 'uppercase',
            }}>
              B2B SaaS Platform
            </p>
            <h1 style={{
              fontSize: '28px', fontWeight: 700, color: '#FAFAFA',
              margin: '0 0 6px', letterSpacing: '-0.5px',
            }}>
              {app.name}
            </h1>
            <p style={{
              fontSize: '13px', color: '#71717A', margin: 0, lineHeight: 1.6,
            }}>
              우수제품 패널 기업을 위한 통합 현장관리 플랫폼
            </p>
          </div>

          {/* 타이틀 */}
          <div style={{ marginBottom: '28px' }}>
            {heading && (
              <h2 style={{
                fontSize: '24px', fontWeight: 600, color: '#FAFAFA',
                margin: '0 0 6px',
              }}>
                {t(heading)}
              </h2>
            )}
            {description && (
              <p style={{
                fontSize: '14px', color: '#71717A', margin: 0,
              }}>
                {t(description)}
              </p>
            )}
          </div>

          {/* 로그인 폼 슬롯 */}
          <div>{children}</div>

          {/* 테마 변경 안내 */}
          <div style={{
            marginTop: '28px', paddingTop: '20px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}>
            <p style={{
              fontSize: '12px', color: '#3F3F46', margin: 0, lineHeight: 1.7,
            }}>
              로그인 후 우측 상단
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', margin: '0 4px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              </span>
              아이콘으로 배경을 변경할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
