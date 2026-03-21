import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from 'next';

import * as Yup from 'yup';
import Link from 'next/link';
import { useFormik } from 'formik';
import { Button } from 'react-daisyui';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import React, { type ReactElement, useEffect, useState, useRef } from 'react';
import type { ComponentStatus } from 'react-daisyui/dist/types';
import { getCsrfToken, signIn, useSession } from 'next-auth/react';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import env from '@/lib/env';
import type { NextPageWithLayout } from 'types';
import { AuthLayout } from '@/components/layouts';
import { Alert, InputWithLabel, Loading } from '@/components/shared';
import { authProviderEnabled } from '@/lib/auth';
import Head from 'next/head';
import TogglePasswordVisibility from '@/components/shared/TogglePasswordVisibility';
import GoogleReCAPTCHA from '@/components/shared/GoogleReCAPTCHA';
import ReCAPTCHA from 'react-google-recaptcha';
import { maxLengthPolicies } from '@/lib/common';

interface Message {
  text: string | null;
  status: ComponentStatus | null;
}

const Login: NextPageWithLayout<
  InferGetServerSidePropsType<typeof getServerSideProps>
> = ({ csrfToken, authProviders, recaptchaSiteKey }) => {
  const router = useRouter();
  const { status } = useSession();
  const { t } = useTranslation('common');
  const [recaptchaToken, setRecaptchaToken] = useState<string>('');
  const [message, setMessage] = useState<Message>({ text: null, status: null });
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const { error, success, token } = router.query as {
    error: string;
    success: string;
    token: string;
  };

  const handlePasswordVisibility = () => {
    setIsPasswordVisible((prev) => !prev);
  };

  useEffect(() => {
    if (error) {
      setMessage({ text: error, status: 'error' });
    }

    if (success) {
      setMessage({ text: success, status: 'success' });
    }
  }, [error, success]);

  const redirectUrl = token
    ? `/invitations/${token}`
    : env.redirectIfAuthenticated;

  const formik = useFormik({
    initialValues: {
      username: '',
      password: '',
    },
    validationSchema: Yup.object().shape({
      username: Yup.string().required('아이디를 입력하세요.').max(100),
      password: Yup.string().required('비밀번호를 입력하세요.').max(maxLengthPolicies.password),
    }),
    onSubmit: async (values) => {
      const { username, password } = values;

      setMessage({ text: null, status: null });

      const response = await signIn('credentials', {
        username,
        password,
        csrfToken,
        redirect: false,
        callbackUrl: redirectUrl,
        recaptchaToken,
        // 자동로그인 미체크 시 브라우저 세션 쿠키로 처리 (브라우저 닫으면 만료)
        rememberMe: rememberMe ? '1' : '0',
      });

      formik.resetForm();
      recaptchaRef.current?.reset();

      if (response && !response.ok) {
        setMessage({ text: response.error, status: 'error' });
        return;
      }

      // 자동로그인 체크 여부를 localStorage에 저장 (세션 만료 시 참고용)
      if (typeof window !== 'undefined') {
        if (rememberMe) {
          localStorage.setItem('lookup9_remember', '1');
        } else {
          localStorage.removeItem('lookup9_remember');
        }
      }

      router.push(redirectUrl);
    },
  });

  if (status === 'loading') {
    return <Loading />;
  }

  if (status === 'authenticated') {
    router.push(redirectUrl);
  }

  return (
    <>
      <Head>
        <title>{t('login-title')}</title>
      </Head>
      {message.text && message.status && (
        <Alert status={message.status} className="mb-5">
          {t(message.text)}
        </Alert>
      )}
      {authProviders.credentials && (
        <form onSubmit={formik.handleSubmit}>
          <div className="space-y-5">
            <InputWithLabel
              type="text"
              label="아이디"
              name="username"
              placeholder="아이디 입력"
              value={formik.values.username}
              error={formik.touched.username ? formik.errors.username : undefined}
              onChange={formik.handleChange}
            />
            <div className="relative flex">
              <InputWithLabel
                type={isPasswordVisible ? 'text' : 'password'}
                name="password"
                placeholder="비밀번호 입력"
                value={formik.values.password}
                label={
                  <label className="label">
                    <span className="label-text">{t('password')}</span>
                    <span className="label-text-alt">
                      <Link
                        href="/auth/forgot-password"
                        className="hover:opacity-80"
                        style={{color:'#3b82f6', fontSize:'10px', fontWeight: 500}}
                      >
                        {t('forgot-password')}
                      </Link>
                    </span>
                  </label>
                }
                error={
                  formik.touched.password ? formik.errors.password : undefined
                }
                onChange={formik.handleChange}
              />
              <TogglePasswordVisibility
                isPasswordVisible={isPasswordVisible}
                handlePasswordVisibility={handlePasswordVisibility}
              />
            </div>

            {/* 자동 로그인 */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span style={{fontSize:'11px', color:'#52525b'}}>자동 로그인</span>
            </label>

            <GoogleReCAPTCHA
              recaptchaRef={recaptchaRef}
              onChange={setRecaptchaToken}
              siteKey={recaptchaSiteKey}
            />
          </div>
          <div className="mt-5">
            <Button
              type="submit"
              color="primary"
              loading={formik.isSubmitting}
              active={formik.dirty}
              fullWidth
              size="md"
            >
              {t('sign-in')}
            </Button>
          </div>
        </form>
      )}
    </>
  );
};

Login.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthLayout heading="welcome-back" description="log-in-to-account">
      {page}
    </AuthLayout>
  );
};

export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const { locale } = context;

  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
      csrfToken: await getCsrfToken(context),
      authProviders: authProviderEnabled(),
      recaptchaSiteKey: env.recaptcha.siteKey,
    },
  };
};

export default Login;
