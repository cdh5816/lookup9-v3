import type { GetServerSidePropsContext } from 'next';

// 회원가입 완전 차단 - 로그인 페이지로 리다이렉트
export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  return {
    redirect: {
      destination: '/auth/login',
      permanent: true,
    },
  };
};

const Join = () => {
  return null;
};

export default Join;
