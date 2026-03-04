import { GetServerSidePropsContext } from 'next';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

// 서버사이드에서 팀을 찾아 직접 리다이렉트
export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { req, res } = context;
  const session = await getSession(req, res);

  if (!session) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: false,
      },
    };
  }

  // 유저의 팀 찾기
  const teamMember = await prisma.teamMember.findFirst({
    where: { userId: session.user.id },
    include: { team: true },
  });

  if (teamMember) {
    return {
      redirect: {
        destination: `/teams/${teamMember.team.slug}/members`,
        permanent: false,
      },
    };
  }

  // 팀이 없으면 팀 목록으로
  return {
    redirect: {
      destination: '/teams',
      permanent: false,
    },
  };
}

// 이 페이지는 렌더링되지 않음 (항상 리다이렉트)
const Dashboard = () => null;
export default Dashboard;
